# NextFluent · Inglês sem Fronteiras

Bem-vindo(a) ao **NextFluent**! Este é um curso completo de inglês, criado para levar você de **iniciante absoluto** até a **proficiência máxima (C2)**, cobrindo os **6 níveis completos** do padrão internacional **CEFR** (Common European Framework of Reference for Languages), o mesmo usado em exames como Cambridge, IELTS e TOEFL.

**Aprenda • Evolua • Conquiste.**

Todo o conteúdo é explicado **em português**, com exemplos, diálogos e exercícios **em inglês**, para você entender a teoria sem depender de tradutor e praticar de verdade.

---

## Estrutura do curso

O curso é dividido em **6 níveis**, todo o padrão internacional CEFR, do A1 ao C2, cada um com **8 lições** (explicação + vocabulário + exercícios + gabarito):

| Nível CEFR | Nome | Pasta | O que você vai saber fazer |
|---|---|---|---|
| **A1** | Iniciante | [`niveis/A1-iniciante`](niveis/A1-iniciante/00-visao-geral.md) | Se apresentar, falar do dia a dia, fazer perguntas simples |
| **A2** | Elementar | [`niveis/A2-elementar`](niveis/A2-elementar/01-passado-simples.md) | Contar o passado, planejar o futuro, viajar, comparar coisas |
| **B1** | Intermediário | [`niveis/B1-intermediario`](niveis/B1-intermediario/01-present-perfect.md) | Falar de experiências, condições, opiniões, notícias |
| **B2** | Intermediário Superior | [`niveis/B2-intermediario-superior`](niveis/B2-intermediario-superior/01-condicionais-3-mistos.md) | Discutir ideias complexas, hipóteses, textos acadêmicos |
| **C1** | Avançado | [`niveis/C1-avancado`](niveis/C1-avancado/01-inversao-enfase.md) | Se expressar com fluência, nuance e naturalidade, nível profissional |
| **C2** | Proficiência | [`niveis/C2-proficiencia`](niveis/C2-proficiencia/00-visao-geral.md) | Nível de falante nativo culto: retórica, humor, ironia, nuance, o topo oficial da escala CEFR |

### Módulo extra: Inglês para o Mercado de Trabalho

Depois (ou durante) os níveis CEFR, há um módulo dedicado 100% ao **inglês profissional**, com **12 lições** práticas, recomendado a partir do nível B1:

| Pasta | O que você vai aprender |
|---|---|
| [`ingles-mercado-de-trabalho/`](ingles-mercado-de-trabalho/00-visao-geral.md) | Currículo e cover letter, entrevista de emprego (técnica STAR), e-mails profissionais, reuniões e apresentações, small talk e networking, telefonemas e videochamadas, negociação salarial e feedback, LinkedIn e marca pessoal, vocabulário por área (TI, finanças, marketing, vendas, RH, atendimento), comunicação intercultural, e um simulado final de processo seletivo |

---

## Como usar este curso

1. **Não sabe seu nível?** Comece pelo A1. Se achar muito fácil, avance rapidamente até sentir dificuldade real. É ali que você deve estudar com calma.
2. **Siga a ordem das lições.** Elas foram organizadas para que cada uma use o que você aprendeu na anterior.
3. **Faça os exercícios sempre, sem pular.** O gabarito está no final de cada lição. Resista à tentação de olhar antes de tentar.
4. **Fale e escreva em voz alta.** Ler é importante, mas o inglês só "gruda" quando você pratica ativamente (falando, escrevendo, ouvindo).
5. **Revise.** Cada nível termina com uma lição de **revisão final** com um mini teste. Use-a para confirmar que pode avançar.

### Estrutura de cada lição

Toda lição segue o mesmo formato:

- **Objetivos**: o que você vai aprender
- **Explicação**: a teoria, em português, com exemplos em inglês
- **Vocabulário**: palavras e expressões novas, com tradução e exemplo
- **Prática oral / diálogo**: frases prontas para praticar
- **Exercícios**: para fixar o conteúdo
- **Gabarito**: respostas comentadas

---

## Trilha completa

```
A1 (Iniciante)
└─ verbo to be, artigos, presente simples, there is/are, can, presente contínuo
A2 (Elementar)
└─ passado simples e contínuo, futuro, modais, quantificadores, phrasal verbs básicos
B1 (Intermediário)
└─ present perfect, condicionais 1 e 2, voz passiva, discurso indireto
B2 (Intermediário Superior)
└─ condicionais 3 e mistos, tempos perfeitos contínuos, orações relativas, collocations
C1 (Avançado)
└─ inversão, subjuntivo, nuances de vocabulário, inglês de negócios, preparação para exames
C2 (Proficiência, topo do CEFR)
└─ retórica e persuasão, humor e ironia, variedades do inglês, coesão avançada, nuance e tradução literária

Inglês para o Mercado de Trabalho (a partir do B1)
└─ currículo, entrevistas, e-mails, reuniões, networking, negociação, LinkedIn, vocabulário por área
```

---

## Progresso e certificado

Cada uma das 62 aulas (níveis A1–C2 + módulo de mercado de trabalho) tem um botão **"Marcar aula como concluída"** no final. Seu progresso fica sempre salvo no navegador (`localStorage`) primeiro, por isso funciona até sem internet.

- A página inicial (`index.html`) mostra uma barra com o total de aulas concluídas e um atalho **"Continuar de onde parei"**.
- Ao concluir as 62 aulas, a página [`certificado.html`](certificado.html) libera um **certificado de conclusão** com seu nome e a data. Pode ser impresso ou salvo em PDF pelo próprio navegador.

### Área de cadastro (opcional)

O curso também tem uma área de cadastro pronta (`cadastro.html` / `login.html`), pra quem quiser **salvar o progresso na nuvem** e acessá-lo de mais de um aparelho, além de um **painel para o responsável pelo curso** (`admin.html`) ver e baixar em CSV a lista de quem se cadastrou, com o progresso de cada um. Ela só funciona depois de configurada (veja [`CADASTRO-SETUP.md`](CADASTRO-SETUP.md)). Sem essa configuração, o curso continua 100% local como descrito acima, sem nenhuma tela de login no caminho.

## Áudio das aulas

Cada aula tem um botão **"Ouvir a aula"** no topo: ele narra a aula inteira, na ordem do texto: títulos e explicações com uma voz em português, exemplos e diálogos em inglês com uma voz em inglês, trocando de voz automaticamente conforme o idioma do trecho. Tem também um ícone ao lado de cada frase/palavra específica (vocabulário, diálogos, exemplos), pra ouvir só aquele trecho isolado. Dá pra ajustar a velocidade da narração (devagar/normal/rápido).

Isso usa a **leitura em voz do próprio navegador** (Web Speech API), com vozes já instaladas no seu sistema, por isso não precisa de nenhum arquivo de áudio no curso nem internet.

### Opção 1: usar a voz do seu sistema (já vem pronto, zero configuração)

Por padrão o curso lê tudo com a voz nativa do seu computador. A qualidade depende de **quais vozes existem no seu sistema**. O botão **"Vozes"** na barra de áudio deixa escolher e testar a voz de português e a de inglês, e marca com **(natural)** as melhores disponíveis. Se não aparecer nenhuma "(natural)":

- **Windows 10/11:** Configurações → Hora e Idioma → Fala → *Adicionar vozes*. Instale as vozes **Natural** (ex: "Francisca"/"Thalita" para português, "Ava"/"Andrew" para inglês). Feche e reabra o navegador depois.
- **Chrome/Edge:** já vêm com vozes "Google"/"Online (Natural)", geralmente melhores que as locais do Windows.
- **macOS:** Ajustes → Acessibilidade → Conteúdo Falado → Voz do sistema → *Gerenciar vozes* → baixe as versões **Premium/Aprimorada**.
- **Android/iOS:** as vozes do Google/Siri já são naturais por padrão.

### Opção 2: gerar áudio de verdade com voz neural (a que soa melhor)

O curso também sabe tocar **arquivos de áudio de verdade**, pré-gerados com uma voz neural bem mais natural que a leitura ao vivo do navegador (usa o serviço de voz gratuito da Microsoft, o mesmo do "Ler em voz alta" do Edge). É **opcional** e só precisa de internet **uma vez**, na hora de gerar. Depois disso, o curso continua 100% offline como sempre:

```
pip install edge-tts
python3 scripts/gerar_audio.py
```

Isso gera os arquivos em `assets/audio/` (um `.mp3` curto por trecho de cada aula: são vários milhares de arquivos pequenos, pode levar um tempo). Assim que existirem, o botão **"Ouvir a aula"** e os ícones de play individuais passam a tocar esses arquivos automaticamente, sem precisar mudar nada no código, sem escolher nada na tela. Aulas ainda não geradas continuam funcionando normalmente com a voz do navegador (opção 1), então dá pra gerar aos poucos.

Outras opções úteis do script:

```
python3 scripts/gerar_audio.py --licao niveis/A1-iniciante/01-saudacoes-e-verbo-to-be   # só uma aula (bom pra testar)
python3 scripts/gerar_audio.py --listar-vozes                                            # ver as vozes disponíveis
python3 scripts/gerar_audio.py --voz-pt pt-BR-ThalitaNeural --voz-en en-US-AndrewNeural   # trocar de voz
python3 scripts/gerar_audio.py --forcar                                                  # regenerar tudo do zero
```

Rodar de novo é seguro a qualquer momento: ele retoma de onde parou e só gera o que ainda falta.

> Esses arquivos não vão para o Git (estão no `.gitignore`), são milhares de arquivos pequenos e cada aluno gera o seu. Se quiser levar pra outro computador, basta copiar a pasta `assets/audio/` junto.

O curso também varia sutilmente o tom e o ritmo da narração ao vivo entre as frases, pra não soar uma leitura toda no mesmo tom. Se o navegador não tiver suporte a leitura em voz e você não tiver gerado os arquivos, os botões simplesmente não aparecem naquela aula.

Bons estudos! *Learning a language is a marathon, not a sprint. Keep going.*
