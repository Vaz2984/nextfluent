-- NextFluent — tabela de alunos + regras de segurança (Row Level
-- Security do Postgres/Supabase).
--
-- COMO USAR: Supabase → seu projeto → "SQL Editor" → "New query" →
-- cole este arquivo inteiro → "Run".
--
-- IMPORTANTE: troque o e-mail 'mgvz11232@gmail.com' abaixo (aparece 3
-- vezes) pelo(s) MESMO(S) e-mail(is) que você colocou em
-- window.NEXTFLUENT_ADMIN_EMAILS (assets/supabase-config.js). Essas
-- políticas aqui são as que realmente protegem os dados; a lista no
-- supabase-config.js só controla o que aparece na tela.

create table if not exists public.students (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  completed_lessons jsonb not null default '{}'::jsonb,
  completed_count integer not null default 0,
  total_lessons integer not null default 0,
  certificate_date text,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);

-- Se a tabela já existia (de uma versão anterior deste arquivo) sem a
-- coluna phone, este comando adiciona ela sem apagar dados.
alter table public.students add column if not exists phone text not null default '';

alter table public.students enable row level security;

-- Cada aluno lê, cria e atualiza só a própria linha (id = seu próprio
-- id de login).
drop policy if exists "students read own" on public.students;
create policy "students read own" on public.students
  for select using (auth.uid() = id);

drop policy if exists "students insert own" on public.students;
create policy "students insert own" on public.students
  for insert with check (auth.uid() = id);

drop policy if exists "students update own" on public.students;
create policy "students update own" on public.students
  for update using (auth.uid() = id);

-- Admin: lê, atualiza e apaga qualquer linha — é isso que faz o
-- painel admin.html funcionar (listar todo mundo, exportar CSV).
drop policy if exists "admin reads all" on public.students;
create policy "admin reads all" on public.students
  for select using (auth.jwt() ->> 'email' in ('mgvz11232@gmail.com'));

drop policy if exists "admin updates all" on public.students;
create policy "admin updates all" on public.students
  for update using (auth.jwt() ->> 'email' in ('mgvz11232@gmail.com'));

drop policy if exists "admin deletes" on public.students;
create policy "admin deletes" on public.students
  for delete using (auth.jwt() ->> 'email' in ('mgvz11232@gmail.com'));
