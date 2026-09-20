#!/usr/bin/env python3
"""
Gera os arquivos de áudio reais (voz neural) de cada aula do curso, usando
o Edge TTS da Microsoft — gratuito, sem chave de API, mas precisa de
internet na hora de rodar (só na hora de gerar; depois o áudio funciona
100% offline, como todo o resto do curso).

Uso:
    pip install edge-tts
    python3 scripts/gerar_audio.py                    # gera tudo (retoma se já tiver parte pronta)
    python3 scripts/gerar_audio.py --forcar            # regenera tudo do zero
    python3 scripts/gerar_audio.py --licao niveis/A1-iniciante/01-saudacoes-e-verbo-to-be
    python3 scripts/gerar_audio.py --listar-vozes      # lista vozes pt/en disponíveis
    python3 scripts/gerar_audio.py --voz-pt pt-BR-ThalitaNeural --voz-en en-US-AndrewNeural

Gera um .mp3 por trecho de narração em assets/audio/<id-da-aula>/NNN.mp3 —
o próprio audio.js detecta e toca esses arquivos automaticamente (e cai de
volta pra voz do navegador nas aulas ainda não geradas).
"""
import argparse
import asyncio
import os
import ssl
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

try:
    import edge_tts
    import edge_tts.communicate as _edge_comm  # pylint: disable=wrong-import-position
except ImportError:
    print("Pacote 'edge-tts' não encontrado. Instale com:\n    pip install edge-tts")
    sys.exit(1)

from extrair_narracao import extrair_aula, listar_aulas  # pylint: disable=wrong-import-position

AUDIO_DIR = os.path.join(ROOT, "assets", "audio")

VOZ_PADRAO_PT = "pt-BR-ThalitaMultilingualNeural"
VOZ_PADRAO_EN = "en-US-AvaMultilingualNeural"

CONCORRENCIA = 4


def _confiar_no_ca_da_organizacao():
    """Só é usado dentro do sandbox de desenvolvimento (proxy que reintercepta
    TLS); no seu computador isso não faz efeito nenhum (o arquivo não existe)."""
    caminho_ca = "/root/.ccr/ca-bundle.crt"
    if os.path.exists(caminho_ca):
        _edge_comm._SSL_CTX = ssl.create_default_context(  # pylint: disable=protected-access
            cafile=caminho_ca
        )


def slug_da_aula(lesson_id):
    """Transforma o id da aula (com "/") num nome de pasta seguro."""
    return lesson_id.replace("/", "__")


async def gerar_trecho(texto, voz, destino, semaforo, tentativas=3):
    """Sintetiza um trecho e grava em `destino`; tenta de novo em caso de falha de rede."""
    async with semaforo:
        for tentativa in range(1, tentativas + 1):
            try:
                return await _sintetizar_um(texto, voz, destino)
            except (OSError, RuntimeError) as erro:
                if tentativa == tentativas:
                    print(f"  [falhou] {destino}: {erro}")
                    return False
                await asyncio.sleep(1.5 * tentativa)
    return False


async def _sintetizar_um(texto, voz, destino):
    comunicador = edge_tts.Communicate(texto, voz)
    dados = bytearray()
    async for pedaco in comunicador.stream():
        if pedaco["type"] == "audio":
            dados.extend(pedaco["data"])
    if not dados:
        raise RuntimeError("resposta vazia do serviço de voz")
    with open(destino, "wb") as fh:
        fh.write(dados)
    return True


# pylint: disable-next=too-many-arguments,too-many-positional-arguments
def _tarefas_pendentes(trechos, pasta, vozes, forcar, semaforo, stats):
    """Monta a lista de corrotinas de geração pra quem ainda não tem arquivo."""
    voz_pt, voz_en = vozes
    tarefas = []
    for i, trecho in enumerate(trechos):
        destino = os.path.join(pasta, f"{i:03d}.mp3")
        if not forcar and os.path.isfile(destino) and os.path.getsize(destino) > 0:
            stats["ja_existia"] += 1
            continue
        voz = voz_en if trecho["idioma"] == "en" else voz_pt
        tarefas.append(gerar_trecho(trecho["texto"], voz, destino, semaforo))
    return tarefas


def _limpar_sobras(pasta, total_trechos):
    """Remove .mp3 de gerações antigas que sobraram (a aula ficou com menos trechos)."""
    if not os.path.isdir(pasta):
        return
    for nome in os.listdir(pasta):
        if not nome.endswith(".mp3"):
            continue
        try:
            indice = int(nome[:-4])
        except ValueError:
            continue
        if indice >= total_trechos:
            os.remove(os.path.join(pasta, nome))


async def gerar_aula(lesson, vozes, forcar, semaforo, stats):
    """Gera (ou completa) o áudio de uma aula inteira."""
    caminho_html = os.path.join(ROOT, lesson["href"])
    if not os.path.isfile(caminho_html):
        print(f"  [pulado] {lesson['href']} não existe (rode scripts/build_html.py antes)")
        return

    trechos = extrair_aula(caminho_html)
    pasta = os.path.join(AUDIO_DIR, slug_da_aula(lesson["id"]))
    os.makedirs(pasta, exist_ok=True)

    tarefas = _tarefas_pendentes(trechos, pasta, vozes, forcar, semaforo, stats)
    if tarefas:
        print(f"  {lesson['id']}: gerando {len(tarefas)} de {len(trechos)} trechos...")
        resultados = await asyncio.gather(*tarefas)
        stats["gerados"] += sum(1 for r in resultados if r)
        stats["falhas"] += sum(1 for r in resultados if not r)
    else:
        print(f"  {lesson['id']}: já completo ({len(trechos)} trechos)")

    _limpar_sobras(pasta, len(trechos))


async def listar_vozes_pt_en():
    """Imprime as vozes em português e inglês oferecidas pelo serviço."""
    todas = await edge_tts.list_voices()
    for prefixo, titulo in (("pt", "Português"), ("en", "Inglês")):
        print(f"\n=== {titulo} ===")
        for v in sorted(todas, key=lambda x: x["ShortName"]):
            if v["Locale"].lower().startswith(prefixo):
                multi = " [multilíngue]" if "Multilingual" in v["ShortName"] else ""
                print(f"  {v['ShortName']:35s} {v['Gender']}{multi}")


def _selecionar_aulas(licao):
    todas_aulas = listar_aulas()
    if not licao:
        return todas_aulas
    aulas = [a for a in todas_aulas if a["id"] == licao]
    if not aulas:
        print(f"Aula não encontrada: {licao}")
        print("Exemplo de id válido: niveis/A1-iniciante/01-saudacoes-e-verbo-to-be")
        sys.exit(1)
    return aulas


async def main_async(args):
    """Ponto de entrada assíncrono: decide a ação (listar vozes ou gerar) e roda."""
    _confiar_no_ca_da_organizacao()

    if args.listar_vozes:
        await listar_vozes_pt_en()
        return

    todas_aulas = _selecionar_aulas(args.licao)
    semaforo = asyncio.Semaphore(CONCORRENCIA)
    stats = {"gerados": 0, "falhas": 0, "ja_existia": 0}

    print(
        f"Gerando áudio de {len(todas_aulas)} aula(s) — "
        f"voz PT: {args.voz_pt} · voz EN: {args.voz_en}"
    )
    for lesson in todas_aulas:
        await gerar_aula(lesson, (args.voz_pt, args.voz_en), args.forcar, semaforo, stats)

    print(
        f"\nPronto! {stats['gerados']} arquivos gerados, "
        f"{stats['ja_existia']} já existiam, {stats['falhas']} falharam."
    )
    if stats["falhas"]:
        print("Rode o comando de novo — ele retoma de onde parou e só refaz o que faltou.")


def _criar_parser():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--licao", help="gera só esta aula (id, ex: niveis/A1-iniciante/01-saudacoes-e-verbo-to-be)"
    )
    parser.add_argument("--forcar", action="store_true", help="regenera mesmo o que já existe")
    parser.add_argument(
        "--voz-pt",
        default=VOZ_PADRAO_PT,
        help=f"voz para trechos em português (padrão: {VOZ_PADRAO_PT})",
    )
    parser.add_argument(
        "--voz-en",
        default=VOZ_PADRAO_EN,
        help=f"voz para trechos em inglês (padrão: {VOZ_PADRAO_EN})",
    )
    parser.add_argument(
        "--listar-vozes", action="store_true", help="lista as vozes pt/en disponíveis e sai"
    )
    return parser


def main():
    """Lê os argumentos da linha de comando e roda a geração."""
    args = _criar_parser().parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
