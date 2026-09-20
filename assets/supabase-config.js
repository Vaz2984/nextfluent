/*
 * NextFluent — configuração do Supabase (cadastro de alunos + painel do
 * admin). Este arquivo é o ÚNICO lugar que você precisa editar para
 * ativar a área de cadastro.
 *
 * COMO CONFIGURAR (5 minutos, de graça, sem cartão de crédito):
 *
 *   1. Acesse https://supabase.com, crie uma conta e clique em
 *      "New project" (qualquer nome e senha de banco — anote a senha
 *      em algum lugar seguro, mas ela não é usada em nada aqui).
 *   2. No menu lateral do projeto, abra "Authentication" → "Providers"
 *      → "Email" → deixe ativado. Ainda nessa tela, DESATIVE a opção
 *      "Confirm email" (assim a conta já entra logada na hora, sem
 *      precisar clicar num link por e-mail primeiro). Se preferir
 *      manter a confirmação por e-mail ativada, o cadastro também
 *      funciona — só que o aluno vê uma mensagem pedindo pra confirmar
 *      o e-mail antes de conseguir entrar.
 *   3. No menu lateral, abra "SQL Editor" → "New query" → cole o
 *      conteúdo do arquivo supabase-schema.sql (na raiz deste
 *      repositório) → "Run". Isso cria a tabela de alunos e as regras
 *      de segurança (cada aluno só vê o próprio cadastro; só o(s)
 *      e-mail(is) admin veem todos).
 *      Antes de rodar, troque o e-mail de exemplo dentro do arquivo
 *      pelo(s) seu(s) e-mail(is) de admin.
 *   4. No menu lateral, abra "Project Settings" (ícone de engrenagem)
 *      → "API" → copie os valores "Project URL" e "anon public" (a
 *      chave pública, não a "service_role").
 *   5. Cole os dois valores no objeto abaixo.
 *   6. Salve, dê commit e push. Pronto: cadastro.html, login.html e
 *      admin.html passam a funcionar sozinhos.
 *
 * Enquanto os valores abaixo continuarem como "REPLACE_ME", o site
 * inteiro continua funcionando exatamente como antes (100% local, sem
 * conta) — o cadastro só é "ligado" depois que você preenche isto
 * aqui. Nenhum desses valores é secreto: a chave "anon" do Supabase é
 * feita pra ficar visível no navegador do usuário; quem protege os
 * dados de verdade são as regras (Row Level Security) do arquivo
 * supabase-schema.sql.
 *
 * IMPORTANTE: depois de preenchido, as aulas passam a exigir login pra
 * abrir (veja "Atenção ao que muda depois do passo 5" em
 * CADASTRO-SETUP.md). A home e os guias continuam abertos sem conta.
 */
window.NEXTFLUENT_SUPABASE_CONFIG = {
  url: "https://gjcrflggmrscqupwhifn.supabase.co",
  anonKey: "sb_publishable_3O717v3jMUYtVXg8FhbU1w_drhhTBJM",
};

/*
 * E-mails com acesso ao painel de alunos (admin.html — lista de quem se
 * cadastrou, progresso de cada um e exportação em CSV). Troque pelo(s)
 * seu(s) e-mail(is) de login do curso. Isto aqui é só pra esconder o
 * link/UI do painel de quem não é admin — quem realmente protege os
 * dados no banco são as regras do supabase-schema.sql (troque nos dois
 * lugares).
 */
window.NEXTFLUENT_ADMIN_EMAILS = ["mgvz11232@gmail.com"];
