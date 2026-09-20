# Como ativar a área de cadastro

O curso já vem com uma área de cadastro completa (criar conta, entrar,
progresso sincronizado entre aparelhos, certificado ligado à conta e um
painel para você ver/baixar a lista de alunos). Ela roda em cima do
[Supabase](https://supabase.com) (gratuito, sem cartão de crédito no
plano usado aqui) e leva uns 5 minutos pra configurar.

**Enquanto você não configurar**, o curso continua funcionando
exatamente como antes: sem cadastro, 100% local, com o progresso salvo
só no navegador de cada aluno. Nada quebra: o cadastro só "liga"
depois do passo 5 abaixo.

**Atenção ao que muda depois do passo 5**: assim que o Supabase estiver
configurado, todas as aulas (`niveis/` e
`ingles-mercado-de-trabalho/`) passam a **exigir login** — quem tentar
abrir uma aula sem estar logado é redirecionado para `login.html` e
volta pra aula assim que entra ou cria a conta. A home (`index.html`),
os guias (`README.html`, `GUIA-DE-ESTUDOS.html`) e os recursos
(`recursos/`) continuam abertos pra qualquer visitante, sem conta,
servindo de "vitrine" antes do cadastro. Se preferir manter as aulas
abertas mesmo depois de configurar o Supabase, é só remover o bloco
`LESSON_GATE_SCRIPT` de `scripts/build_html.py` e rodar
`python3 scripts/build_html.py` de novo.

## Passo a passo

1. Acesse [supabase.com](https://supabase.com), crie uma conta (dá pra
   entrar com GitHub ou Google) e clique em **"New project"**. Dê
   qualquer nome, escolha uma senha de banco (anote em algum lugar
   seguro, ela não é usada em nenhum arquivo deste repositório) e uma
   região perto do seu público (ex. South America - São Paulo).
2. No menu lateral do projeto, abra **Authentication → Providers →
   Email**. Deixe o provedor de e-mail ativado e **desative a opção
   "Confirm email"**, assim, ao criar a conta, o aluno já entra
   logado na hora, sem precisar clicar num link de confirmação
   primeiro. (Se preferir manter a confirmação por e-mail ligada, o
   cadastro também funciona: o aluno só vê uma mensagem pedindo pra
   confirmar o e-mail antes de conseguir entrar.)
3. No menu lateral, abra **SQL Editor → New query**, cole o conteúdo
   do arquivo [`supabase-schema.sql`](supabase-schema.sql) (na raiz
   deste repositório) e clique em **Run**. Isso cria a tabela de
   alunos e as regras de segurança (Row Level Security).
   - Antes de rodar, troque o e-mail `mgvz11232@gmail.com` (aparece 3
     vezes no arquivo) pelo(s) seu(s) e-mail(is) de admin (quem vai
     acessar o painel de alunos).
4. No menu lateral, abra o ícone de engrenagem **Project Settings →
   API**. Copie os valores **"Project URL"** e **"anon public"** (a
   chave pública, não use a "service_role", essa é secreta e não
   deve ir pra este repositório).
5. Abra [`assets/supabase-config.js`](assets/supabase-config.js) neste
   repositório e:
   - cole os dois valores dentro de `window.NEXTFLUENT_SUPABASE_CONFIG`
     (`url` e `anonKey`);
   - troque `window.NEXTFLUENT_ADMIN_EMAILS` pelos mesmos e-mails que
     você colocou no passo 3 (são dois lugares diferentes porque um
     protege os dados de verdade, as regras do banco, e o outro só
     controla o que aparece na tela).
6. Salve, dê `git commit` e `git push`. Pronto, `cadastro.html`,
   `login.html` e `admin.html` passam a funcionar sozinhos.

## O que cada e-mail admin consegue fazer

Quem estiver logado com um e-mail listado em `NEXTFLUENT_ADMIN_EMAILS`
(e em `supabase-schema.sql`) vê um link **"Alunos"** na barra superior
do site, que leva a `admin.html`: uma lista com nome, e-mail, data de
cadastro, progresso (aulas concluídas/total) e data do certificado de
cada aluno, com um botão **"Baixar CSV"** para exportar tudo numa
planilha.

## Nenhum desses dados é secreto

A chave **anon** do Supabase é feita pra ficar visível no navegador de
quem acessa o site, ela não é uma senha nem dá acesso de
administrador ao banco. Quem realmente protege os dados dos alunos são
as políticas de Row Level Security do arquivo `supabase-schema.sql`:
cada aluno só lê/escreve o próprio cadastro, e só os e-mails admin
conseguem listar todos. **Nunca** copie a chave `service_role` (essa
sim é secreta) para nenhum arquivo deste site.

## Se algo der errado

- **O botão "Entrar"/"Criar conta" não aparece na barra superior**:
  confira se `assets/supabase-config.js` não está mais com `url`/
  `anonKey` como `"REPLACE_ME"` e se você deu `git push` depois de
  editar.
- **Erro "new row violates row-level security policy"**: as políticas
  do passo 3 ainda não foram criadas (rode `supabase-schema.sql` de
  novo) ou o e-mail admin não bate entre `supabase-schema.sql` e
  `assets/supabase-config.js`.
- **O aluno cria a conta mas não consegue entrar em seguida**: a opção
  "Confirm email" (passo 2) está ativada, ou ele confirma o e-mail
  primeiro, ou você desativa essa opção no painel do Supabase.
- **Quer voltar ao modo 100% local (sem cadastro)**: basta desfazer o
  passo 5, deixando `url`/`anonKey` de volta como `"REPLACE_ME"`.
