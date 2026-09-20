#!/usr/bin/env python3
"""
Converte todas as lições em Markdown deste curso para páginas .html
estáticas, prontas para abrir direto no navegador (sem servidor,
sem internet).

Uso:
    python3 scripts/build_html.py

Requer o pacote "markdown" (pip install markdown). O script instala
automaticamente se não encontrar o pacote.
"""
import json
import os
import re
import sys
import subprocess

try:
    import markdown
except ImportError:
    print("Pacote 'markdown' não encontrado. Instalando...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "markdown"])
    import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, "assets")

# Pastas/arquivos .md que fazem parte do curso e devem virar .html
MD_ROOTS = [
    "README.md",
    "GUIA-DE-ESTUDOS.md",
    "CADASTRO-SETUP.md",
    "niveis",
    "ingles-mercado-de-trabalho",
    "recursos",
]

# rel_dir -> (crumb label, selo/badge code, classe CSS de nível)
LEVEL_META = {
    "niveis/A1-iniciante": ("A1 · Iniciante", "A1", "lvl-a1"),
    "niveis/A2-elementar": ("A2 · Elementar", "A2", "lvl-a2"),
    "niveis/B1-intermediario": ("B1 · Intermediário", "B1", "lvl-b1"),
    "niveis/B2-intermediario-superior": ("B2 · Intermediário Superior", "B2", "lvl-b2"),
    "niveis/C1-avancado": ("C1 · Avançado", "C1", "lvl-c1"),
    "niveis/C2-proficiencia": ("C2 · Proficiência", "C2", "lvl-c2"),
    "ingles-mercado-de-trabalho": ("Inglês para o Mercado de Trabalho", "TRAB", "lvl-extra"),
    "recursos": ("Recursos", "REF", "lvl-recursos"),
}
ROOT_META = ("Guia do curso", "EN", "lvl-root")

# Pastas cujas páginas contam como "aula" (ganham botão de concluir e
# entram na conta do certificado). README/GUIA/recursos são material de
# apoio, não aulas.
LESSON_ROOTS = ("niveis", "ingles-mercado-de-trabalho")

MD_LINK_RE = re.compile(r'href="([^"#]+?)\.md(#[^"]*)?"')
BLANK_RE = re.compile(r"▁{2,}")
RAW_UNDERSCORE_BLANK_RE = re.compile(r"_{3,}")

# Monograma NextFluent — referencia assets/brand/mark.svg (o mesmo arquivo
# usado no favicon e na home), em vez de duplicar a arte inline em cada
# página: um <img> é bem mais leve que repetir defs/gradientes de SVG 70x,
# e evita colisão de id quando a home usa o monograma duas vezes na mesma
# página (barra superior + letterhead do hero).
BRAND_MARK_IMG = '<img class="brand-mark" src="{root}assets/brand/mark.svg" width="24" height="24" alt="">'

FAVICON_LINKS = (
    '<link rel="icon" type="image/svg+xml" href="{root}assets/brand/mark-badge.svg">\n'
    '<link rel="icon" type="image/png" sizes="32x32" href="{root}assets/brand/favicon-32.png">\n'
    '<link rel="apple-touch-icon" sizes="180x180" href="{root}assets/brand/favicon-180.png">'
)

SITE_BASE_URL = "https://vaz2984.github.io/nextfluent/"
OG_DESCRIPTION = (
    "Curso gratuito de inglês em português, do A1 ao C2 (topo da escala CEFR), "
    "com módulo extra de inglês para o mercado de trabalho."
)
OG_TAGS = (
    '<meta property="og:type" content="website">\n'
    '<meta property="og:site_name" content="NextFluent">\n'
    '<meta property="og:title" content="{title}">\n'
    '<meta property="og:description" content="{description}">\n'
    '<meta property="og:image" content="{base}assets/brand/og-image.png">\n'
    '<meta property="og:url" content="{url}">\n'
    '<meta name="twitter:card" content="summary_large_image">\n'
    '<meta name="twitter:title" content="{title}">\n'
    '<meta name="twitter:description" content="{description}">\n'
    '<meta name="twitter:image" content="{base}assets/brand/og-image.png">'
)

# Botao de "concluir aula" (fica no rodape de cada pagina de licao) e os
# scripts que leem/gravam o progresso no localStorage do navegador.
LESSON_WIDGET = (
    '<div class="lesson-complete" data-lesson-id="{lesson_id}" data-root="{root}">\n'
    '      <button type="button" class="complete-btn" data-lesson-toggle>'
    "Marcar aula como concluída</button>\n"
    "    </div>"
)
LESSON_SCRIPTS = (
    '<script src="{root}assets/lessons-data.js"></script>\n'
    '<script src="{root}assets/progress.js"></script>\n'
    '<script src="{root}assets/audio.js"></script>\n'
    "<script>NF.initLessonButton(); NFAudio.initLessonAudio();</script>"
)

# Área de cadastro (assets/auth.js) — carregada em TODA página (não só
# aulas), pra mostrar "Entrar/Criar conta" (ou o nome do aluno logado) na
# barra superior do site inteiro. O SDK do Supabase publica um build
# pronto pra <script src> comum (sem "type=module", sem bundler), igual
# ao resto do site. Se o aluno estiver offline, a tag simplesmente falha
# em silêncio e assets/auth.js cai no modo "não configurado" (ver esse
# arquivo).
SUPABASE_SDK_VERSION = "2"
AUTH_SCRIPTS = (
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@{v}"></script>\n'
    '<script src="{{root}}assets/supabase-config.js"></script>\n'
    '<script src="{{root}}assets/auth.js"></script>'
).format(v=SUPABASE_SDK_VERSION)

# Mini-área de conta na barra superior (preenchida por assets/auth.js).
AUTH_SLOT = '<span id="nf-auth-slot" class="auth-slot" data-root="{root}"></span>'

# Trava de acesso: só existe em páginas de aula (niveis/ e
# ingles-mercado-de-trabalho/). Se a área de cadastro já foi configurada
# (assets/supabase-config.js preenchido) e ninguém está logado, manda pra
# tela de login, levando de volta pra esta aula depois. Enquanto o dono do
# curso não configurar o Supabase, NFAuth.isConfigured() é false e a trava
# fica desligada (aula continua aberta), pra não trancar o site inteiro
# antes do cadastro estar pronto.
LESSON_GATE_SCRIPT = (
    "<script>\n"
    "  (function () {{\n"
    "    if (!window.NFAuth || !window.NFAuth.isConfigured()) return;\n"
    "    var checked = false;\n"
    "    window.NFAuth.onChange(function (user) {{\n"
    "      if (checked) return;\n"
    "      checked = true;\n"
    '      if (!user) window.location.href = "{root}login.html?next=" + encodeURIComponent("{href}");\n'
    "    }});\n"
    "  }})();\n"
    "</script>"
)

# Barra de áudio (preenchida por audio.js) — fica no topo do conteúdo da aula.
AUDIO_BAR = '<div id="nf-audio-bar"></div>'


def find_md_files():
    """Lista, em ordem, todos os arquivos .md dentro de MD_ROOTS."""
    files = []
    for entry in MD_ROOTS:
        full = os.path.join(ROOT, entry)
        if os.path.isfile(full) and full.endswith(".md"):
            files.append(full)
        elif os.path.isdir(full):
            for dirpath, _dirnames, filenames in os.walk(full):
                for fn in sorted(filenames):
                    if fn.endswith(".md"):
                        files.append(os.path.join(dirpath, fn))
    return sorted(set(files))


def rewrite_md_links(html):
    """Troca href="algo.md" (e algo.md#ancora) por algo.html na saída já convertida."""
    return MD_LINK_RE.sub(lambda m: f'href="{m.group(1)}.html{m.group(2) or ""}"', html)


def wrap_tables(html):
    """Envolve cada <table> em uma div com scroll horizontal (tabelas largas em telas pequenas)."""
    return html.replace("<table>", '<div class="table-scroll"><table>').replace(
        "</table>", "</table></div>"
    )


def style_blanks(html):
    """Troca sequências de ▁ (lacunas de exercício) por spans com sublinhado estilizado."""

    def repl(m):
        n = len(m.group())
        size = "blank-s" if n <= 6 else "blank-m" if n <= 14 else "blank-l"
        return f'<span class="blank {size}"></span>'

    return BLANK_RE.sub(repl, html)


def extract_title(md_text, fallback):
    """Usa o primeiro título H1 do markdown como <title> da página, sem marcações."""
    m = re.search(r"^#\s+(.+)$", md_text, re.MULTILINE)
    if m:
        return re.sub(r"[*_`]", "", m.group(1)).strip()
    return fallback


def meta_for(rel_dir):
    """Retorna (label, código do selo, classe CSS) do nível dono de rel_dir."""
    rel_dir = rel_dir.replace(os.sep, "/")
    if rel_dir in (".", ""):
        return ROOT_META
    return LEVEL_META.get(rel_dir, ROOT_META)


def is_lesson_dir(rel_dir):
    """True se a página mora em niveis/ ou ingles-mercado-de-trabalho/ — ou
    seja, conta como aula pro botão de concluir e pro certificado."""
    rel_dir = rel_dir.replace(os.sep, "/")
    if rel_dir in (".", ""):
        return False
    return rel_dir.split("/")[0] in LESSON_ROOTS


class PageContext:
    # pylint: disable=too-few-public-methods,too-many-instance-attributes
    # pylint: disable=too-many-arguments,too-many-positional-arguments
    """Agrupa tudo que o template de build_page() precisa, pra não estourar
    o limite de variáveis locais só com caminhos relativos e metadados."""

    def __init__(self, paths, lesson_bits, meta):
        (
            self.home_rel,
            self.css_rel,
            self.favicon_html,
            self.brand_img,
            self.og_url,
            self.auth_scripts,
            self.auth_slot,
        ) = paths
        self.lesson_widget, self.lesson_scripts, self.cert_link, self.audio_bar, self.auth_gate = lesson_bits
        self.label, self.code, self.css_class = meta


def build_page_context(md_path, rel_path, rel_dir):
    """Calcula links relativos, favicon, metadados de nível e — se for
    aula — o widget/scripts de progresso, tudo agrupado num PageContext."""
    page_dir = os.path.dirname(md_path)
    home_rel = os.path.relpath(os.path.join(ROOT, "index.html"), page_dir).replace(os.sep, "/")
    css_rel = os.path.relpath(os.path.join(ASSETS_DIR, "style.css"), page_dir).replace(os.sep, "/")
    root_prefix = os.path.relpath(ROOT, page_dir).replace(os.sep, "/")
    root_prefix = "" if root_prefix == "." else root_prefix + "/"
    favicon_html = FAVICON_LINKS.format(root=root_prefix)
    brand_img = BRAND_MARK_IMG.format(root=root_prefix)
    og_url = SITE_BASE_URL + os.path.splitext(rel_path)[0].replace(os.sep, "/") + ".html"
    auth_scripts = AUTH_SCRIPTS.format(root=root_prefix)
    auth_slot = AUTH_SLOT.format(root=root_prefix)

    lesson_widget = lesson_scripts = cert_link = audio_bar = auth_gate = ""
    if is_lesson_dir(rel_dir):
        lesson_id = os.path.splitext(rel_path)[0].replace(os.sep, "/")
        lesson_href = lesson_id + ".html"
        lesson_widget = LESSON_WIDGET.format(lesson_id=lesson_id, root=root_prefix)
        lesson_scripts = LESSON_SCRIPTS.format(root=root_prefix)
        cert_link = f' · <a href="{root_prefix}certificado.html">Ver certificado</a>'
        audio_bar = AUDIO_BAR
        auth_gate = LESSON_GATE_SCRIPT.format(root=root_prefix, href=lesson_href)

    return PageContext(
        (home_rel, css_rel, favicon_html, brand_img, og_url, auth_scripts, auth_slot),
        (lesson_widget, lesson_scripts, cert_link, audio_bar, auth_gate),
        meta_for(rel_dir),
    )


def build_page(md_path):
    """Converte um .md em .html estático. Devolve (out_path, lesson_info) —
    lesson_info é None pra páginas que não são aula (README, recursos...)."""
    rel_path = os.path.relpath(md_path, ROOT)
    rel_dir = os.path.dirname(rel_path)

    with open(md_path, encoding="utf-8") as fh:
        md_text = fh.read()

    # Defesa contra o bug de "___" (lacunas de exercício) sendo interpretado
    # como negrito/itálico pelo Markdown — normaliza para ▁ ANTES da conversão,
    # mesmo que o arquivo fonte tenha sido escrito com sublinhados por engano.
    md_text = RAW_UNDERSCORE_BLANK_RE.sub(lambda m: "▁" * len(m.group()), md_text)

    body_html = markdown.markdown(md_text, extensions=["tables"])
    body_html = rewrite_md_links(body_html)
    body_html = wrap_tables(body_html)
    body_html = style_blanks(body_html)

    title = extract_title(md_text, os.path.splitext(os.path.basename(md_path))[0])
    full_title = f"{title} · NextFluent"
    ctx = build_page_context(md_path, rel_path, rel_dir)
    og_html = OG_TAGS.format(
        title=full_title, description=OG_DESCRIPTION, base=SITE_BASE_URL, url=ctx.og_url
    )
    tail_scripts = "\n".join(s for s in (ctx.auth_gate, ctx.lesson_scripts) if s)

    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{full_title}</title>
<meta name="description" content="{OG_DESCRIPTION}">
{ctx.favicon_html}
{og_html}
<link rel="stylesheet" href="{ctx.css_rel}">
</head>
<body class="{ctx.css_class}">
<div class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="{ctx.home_rel}">{ctx.brand_img}<span>NextFluent</span></a>
    <span class="stampbadge"><span class="dot">{ctx.code}</span>{ctx.label}</span>
    {ctx.auth_slot}
  </div>
</div>
<main class="page">
  <div class="wrap">
    {ctx.audio_bar}
    <article>
{body_html}
    </article>
    {ctx.lesson_widget}
    <footer class="page-footer">
      <span>NextFluent · Inglês sem Fronteiras</span>
      <span><a href="{ctx.home_rel}">← Voltar ao início</a>{ctx.cert_link}</span>
    </footer>
  </div>
</main>
{ctx.auth_scripts}
{tail_scripts}
</body>
</html>
"""

    out_path = os.path.splitext(md_path)[0] + ".html"
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(html)

    lesson_info = None
    if is_lesson_dir(rel_dir):
        lesson_info = {
            "id": os.path.splitext(rel_path)[0].replace(os.sep, "/"),
            "title": title,
            "href": os.path.splitext(rel_path)[0].replace(os.sep, "/") + ".html",
            "level": ctx.label,
        }
    return out_path, lesson_info


def write_lessons_data(lessons):
    """Grava assets/lessons-data.js com a lista de aulas, pro progress.js e
    pro index.html/certificado.html saberem quantas aulas existem e quais são."""
    out_path = os.path.join(ASSETS_DIR, "lessons-data.js")
    payload = json.dumps(lessons, ensure_ascii=False, indent=2)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write("// Gerado automaticamente por scripts/build_html.py — não edite à mão.\n")
        fh.write(f"window.NEXTFLUENT_LESSONS = {payload};\n")
    return out_path


def main():
    """Reconstrói todas as páginas .html do curso a partir dos arquivos .md."""
    md_files = find_md_files()
    print(f"Encontrados {len(md_files)} arquivos .md")
    lessons = []
    for md_path in md_files:
        out_path, lesson_info = build_page(md_path)
        print(" ->", os.path.relpath(out_path, ROOT))
        if lesson_info:
            lessons.append(lesson_info)
    lessons_path = write_lessons_data(lessons)
    print(" ->", os.path.relpath(lessons_path, ROOT), f"({len(lessons)} aulas)")
    print(f"\nPronto! {len(md_files)} páginas .html geradas.")
    print("Abra 'index.html' no navegador para começar.")


if __name__ == "__main__":
    main()
