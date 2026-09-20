#!/usr/bin/env python3
"""
Extrai o roteiro de narração de cada aula a partir das páginas .html geradas.

Espelha a mesma lógica de assets/audio.js (mesma ordem, mesma divisão de
trechos e mesma detecção de idioma), pra que o áudio gerado bata exatamente
com o que a narração do navegador falaria.

Uso como biblioteca:
    from extrair_narracao import extrair_aula, listar_aulas
"""
import json
import os
import re
import unicodedata
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EMOJI_RE = re.compile(
    "["
    "\U0001F1E0-\U0001F1FF\U0001F300-\U0001F5FF\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF\U0001F700-\U0001F7FF\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF\U0001FA00-\U0001FAFF\U00002600-\U000026FF"
    "\U00002700-\U000027BF\U00002B00-\U00002BFF\U0001F000-\U0001F0FF"
    "\U0000FE0F\U0000200D"
    "]+"
)

PT_ACCENTS = re.compile(r"[ãâàçéêíõôóúÃÂÀÇÉÊÍÕÔÓÚ]")
PT_WORDS = re.compile(
    r"\b("
    r"que|nao|nunca|sempre|voce|para|pelo|pela|pelos|pelas|com|sem|uma|uns|umas|"
    r"mais|menos|como|quando|onde|porque|pois|isso|isto|aquilo|entao|assim|"
    r"pode|podem|deve|devem|use|usar|usamos|coloque|repare|veja|lembre|"
    r"verbo|verbos|frase|frases|exemplo|exemplos|significa|traducao|portugues|ingles|"
    r"ele|ela|eles|elas|nos|seu|sua|seus|suas|dos|das|nas|dele|dela|"
    r"muito|muita|tambem|apenas|ainda|depois|antes|entre|cada|todo|toda|todos|todas|"
    r"certo|errado|correto|incorreto|atencao|dica|obs|estrutura|negativa|interrogativa|"
    r"afirmativa|resposta|pergunta|regra|forma|sentido|significado|caso|casos"
    r")\b",
    re.IGNORECASE,
)

ENGLISH_COLUMN_HEADERS = {
    "inglês", "ingles", "english", "palavra", "pronome", "modal",
    "verbo", "expressão", "expressao", "frase", "preposição", "preposicao",
    "phrasal verb", "phrasal verbs",
}

PAUSE_MS = 140
PAUSE_HEADING_MS = 420


def limpar(texto):
    """Tira emoji e normaliza espaços (equivale a cleanForSpeech do audio.js)."""
    return re.sub(r"\s+", " ", EMOJI_RE.sub("", texto or "")).strip()


def sem_acento(texto):
    """Tira os acentos (NFD + remove marcas), pra comparar com/sem eles."""
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def parece_portugues(texto):
    """Heurística: acento típico do português ou uma palavra comum do idioma."""
    if PT_ACCENTS.search(texto):
        return True
    return bool(PT_WORDS.search(sem_acento(texto)))


def parte_inglesa(texto):
    """O que vem antes da seta, sem parênteses e sem rótulo de falante."""
    texto_en = texto.split("→")[0]
    texto_en = re.sub(r"\([^)]*\)", " ", texto_en)
    texto_en = re.sub(r"^\s*[A-Z]\s*:\s*", "", texto_en)
    return limpar(texto_en)


def depois_da_seta(texto):
    """Parte depois da seta (a tradução/nota, quando existe)."""
    partes = texto.split("→")
    if len(partes) < 2:
        return ""
    return limpar(re.sub(r"\([^)]*\)", " ", "→".join(partes[1:])))


def eh_falavel_em_ingles(texto):
    """True se o texto parece uma frase/expressão em inglês (não português)."""
    if not texto or len(texto) < 6:
        return False
    if len(texto.split()) < 2:
        return False
    if not re.search(r"[a-zA-Z]", texto):
        return False
    return not parece_portugues(texto)


class ArtigoParser(HTMLParser):
    """Monta uma árvore simplificada do <article> da página da aula."""

    BLOCOS = (
        "h1", "h2", "h3", "p", "li", "blockquote", "table", "thead", "tbody", "tr", "th", "td",
    )

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.no_artigo = False
        self.profundidade_artigo = 0
        self.pilha = []
        self.raiz = {"tag": "root", "filhos": [], "texto": ""}
        self.atual = self.raiz

    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.no_artigo = True
            self.profundidade_artigo = 0
            return
        if not self.no_artigo:
            return
        if tag == "article":
            self.profundidade_artigo += 1
        if tag in self.BLOCOS:
            no = {"tag": tag, "filhos": [], "texto": ""}
            self.atual["filhos"].append(no)
            self.pilha.append(self.atual)
            self.atual = no
        elif tag == "br":
            self.atual["texto"] += "\n"

    def handle_endtag(self, tag):
        if tag == "article" and self.no_artigo:
            self.no_artigo = False
            return
        if not self.no_artigo:
            return
        if tag in self.BLOCOS and self.pilha:
            self.atual = self.pilha.pop()

    def handle_data(self, data):
        if self.no_artigo:
            self.atual["texto"] += data


def texto_de(no):
    """Texto concatenado do nó e descendentes (equivale a textContent)."""
    partes = [no["texto"]]
    for filho in no["filhos"]:
        partes.append(texto_de(filho))
    return "".join(partes)


def _iterar_blocos(no, saida):
    """Percorre em ordem de documento, como o querySelectorAll do audio.js."""
    for filho in no["filhos"]:
        if filho["tag"] in ("h2", "h3", "p", "li", "blockquote", "table"):
            saida.append(filho)
            if filho["tag"] in ("blockquote", "table"):
                continue  # tratados por inteiro, não recursa nos filhos
        _iterar_blocos(filho, saida)


def _linhas_do_paragrafo(paragrafo):
    """Blockquote de várias linhas vira um <p> com quebras de linha."""
    return [l.strip() for l in texto_de(paragrafo).split("\n")]


def _coluna_inglesa(tabela):
    cabecalhos = []
    def achar_th(no):
        for filho in no["filhos"]:
            if filho["tag"] == "th":
                cabecalhos.append(texto_de(filho).strip().lower())
            achar_th(filho)
    achar_th(tabela)
    for i, rotulo in enumerate(cabecalhos):
        if rotulo in ENGLISH_COLUMN_HEADERS:
            return i
    return -1


def _linhas_da_tabela(tabela):
    linhas = []
    def achar_tr(no, dentro_tbody):
        for filho in no["filhos"]:
            if filho["tag"] == "tbody":
                achar_tr(filho, True)
                continue
            if filho["tag"] == "tr" and dentro_tbody:
                celulas = [texto_de(c).strip() for c in filho["filhos"] if c["tag"] == "td"]
                if celulas:
                    linhas.append(celulas)
            achar_tr(filho, dentro_tbody)
    achar_tr(tabela, False)
    return linhas


def _achar_h1(raiz):
    """Primeiro <h1> do artigo, em busca em profundidade."""
    pilha = list(raiz["filhos"])
    while pilha:
        no = pilha.pop(0)
        if no["tag"] == "h1":
            return no
        pilha = no["filhos"] + pilha
    return None


def _trechos_da_tabela(tabela):
    """[{texto, idioma, pausa_ms}] de uma tabela de vocabulário (ou [] se
    a tabela não tiver uma coluna reconhecida como inglês)."""
    col = _coluna_inglesa(tabela)
    if col == -1:
        return []
    trechos = []
    for celulas in _linhas_da_tabela(tabela):
        if col >= len(celulas):
            continue
        ingles = parte_inglesa(celulas[col])
        if not ingles or not re.search(r"[a-zA-Z]", ingles):
            continue
        trechos.append({"texto": ingles, "idioma": "en", "pausa_ms": 0})
        if col + 1 < len(celulas):
            trechos.append({"texto": celulas[col + 1], "idioma": "pt", "pausa_ms": PAUSE_MS})
    return trechos


def _trechos_da_linha(linha):
    """[{texto, idioma, pausa_ms}] de uma linha de blockquote — vira um
    trecho em inglês (+ a tradução depois da seta, se houver) ou um trecho
    único em português, dependendo do que a linha parece ser."""
    ingles = parte_inglesa(linha)
    if not eh_falavel_em_ingles(ingles):
        return [{"texto": linha, "idioma": "pt", "pausa_ms": 0}]
    trechos = [{"texto": ingles, "idioma": "en", "pausa_ms": 0}]
    traducao = depois_da_seta(linha)
    if traducao:
        trechos.append({"texto": traducao, "idioma": "pt", "pausa_ms": PAUSE_MS})
    return trechos


def _trechos_do_blockquote(blockquote):
    trechos = []
    for paragrafo in blockquote["filhos"]:
        if paragrafo["tag"] != "p":
            continue
        for linha in _linhas_do_paragrafo(paragrafo):
            if linha:
                trechos.extend(_trechos_da_linha(linha))
    return trechos


def _trechos_do_bloco(bloco):
    """Despacha um bloco (h2/h3/p/li/table/blockquote) pra sua extração
    específica, devolvendo sempre uma lista de trechos (pode ser vazia)."""
    tag = bloco["tag"]
    if tag in ("h2", "h3"):
        return [{"texto": texto_de(bloco), "idioma": "pt", "pausa_ms": PAUSE_HEADING_MS}]
    if tag in ("p", "li"):
        pausa = 0 if tag == "li" else PAUSE_MS
        return [{"texto": texto_de(bloco), "idioma": "pt", "pausa_ms": pausa}]
    if tag == "table":
        return _trechos_da_tabela(bloco)
    if tag == "blockquote":
        return _trechos_do_blockquote(bloco)
    return []


def extrair_aula(caminho_html):
    """Devolve a lista de trechos [{texto, idioma, pausa_ms}] de uma aula,
    na mesma ordem e com a mesma divisão que assets/audio.js narraria."""
    with open(caminho_html, encoding="utf-8") as fh:
        parser = ArtigoParser()
        parser.feed(fh.read())

    trechos = []
    h1 = _achar_h1(parser.raiz)
    if h1 is not None:
        trechos.append({"texto": texto_de(h1), "idioma": "pt", "pausa_ms": PAUSE_HEADING_MS})

    blocos = []
    _iterar_blocos(parser.raiz, blocos)
    for bloco in blocos:
        trechos.extend(_trechos_do_bloco(bloco))

    for trecho in trechos:
        trecho["texto"] = limpar(trecho["texto"])
    return [t for t in trechos if t["texto"]]


def listar_aulas():
    """Lê assets/lessons-data.js e devolve [{id, title, href, level}]."""
    caminho = os.path.join(ROOT, "assets", "lessons-data.js")
    with open(caminho, encoding="utf-8") as fh:
        bruto = fh.read().split("=", 1)[1].rstrip(";\n ")
    return json.loads(bruto)


if __name__ == "__main__":
    import sys

    _padrao = "niveis/A1-iniciante/01-saudacoes-e-verbo-to-be.html"
    alvo = sys.argv[1] if len(sys.argv) > 1 else _padrao
    lista = extrair_aula(os.path.join(ROOT, alvo))
    print(f"{alvo}: {len(lista)} trechos")
    for t in lista[:15]:
        print(f"  [{t['idioma']}] {t['texto'][:70]}")
