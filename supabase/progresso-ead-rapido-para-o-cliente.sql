-- =====================================================================
-- O cliente volta a ver o andamento do EAD — agora dentro do tempo.
--
-- O SINTOMA. Na tela de Certificados, a equipe interna via a barra de
-- progresso de cada curso EAD; o cliente via "− Não informado" em
-- todas as linhas. Parecia falta de permissão, e não era.
--
-- O QUE REALMENTE ACONTECIA. A regra de leitura chamava
-- `pode_ver_progresso_ead(email)` UMA VEZ POR LINHA, e cada chamada
-- varria `certificados` perguntando, certificado a certificado, se o
-- usuário pertence àquela empresa — outra função, outra consulta.
-- Medido no banco: a leitura do cliente levava cerca de 25 segundos.
-- O papel `authenticated` tem `statement_timeout = 8s`, então o
-- navegador dele recebia erro, não dados. A tela, que trata erro como
-- "sem progresso", mostrava a lista inteira em branco. A equipe
-- interna escapava porque a regra decide pelo perfil na primeira
-- condição e nem chega a varrer nada.
--
-- A CORREÇÃO. A pergunta "quais e-mails eu posso ver" passa a ser
-- respondida UMA VEZ por consulta, como um conjunto, em vez de uma vez
-- por linha. É a mesma regra de visibilidade de antes — ninguém passa
-- a ver o que não via:
--   - equipe interna ativa (atendimento, gestor, admin): tudo;
--   - cliente ativo: os e-mails que têm certificado em alguma empresa
--     dele, comparados sem maiúsculas e sem espaços.
--
-- Só troca a REGRA DE LEITURA e cria índices. Não altera nenhum dado,
-- não mexe nas regras de gravação e pode rodar mais de uma vez.
-- =====================================================================

-- ---------- Índices que a regra nova usa -----------------------------

-- Casar o e-mail do progresso com o do certificado sem varrer a tabela.
create index if not exists certificados_email_normalizado
  on public.certificados (lower(btrim(email_colaborador)))
  where email_colaborador is not null;

create index if not exists treinamentos_progresso_email_normalizado
  on public.treinamentos_progresso (lower(btrim(email)));

-- As empresas de um usuário, do jeito que a regra pergunta.
create index if not exists usuario_empresas_usuario
  on public.usuario_empresas (usuario_id);

-- ---------- Quem é da equipe, numa pergunta só -----------------------

create or replace function public.eh_equipe_ativa()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and coalesce(p.ativo, true)
       and p.perfil in ('atendimento', 'gestor', 'admin')
  );
$fn$;

revoke all on function public.eh_equipe_ativa() from public, anon;
grant execute on function public.eh_equipe_ativa() to authenticated;

-- ---------- Os e-mails que este usuário pode ver ---------------------
-- Devolve um CONJUNTO. É isto que tira a consulta do "uma vez por
-- linha": o Postgres monta a lista uma vez e depois só compara.

create or replace function public.emails_ead_do_usuario()
returns table (email_norm text)
language sql
stable
security definer
set search_path = public
as $fn$
  select distinct lower(btrim(c.email_colaborador))
    from public.certificados c
   where c.email_colaborador is not null
     and (
       c.empresa_id in (
         select ue.empresa_id from public.usuario_empresas ue
          where ue.usuario_id = auth.uid()
       )
       or c.empresa_id = (
         select p.empresa_id from public.profiles p where p.id = auth.uid()
       )
     )
     and exists (
       select 1 from public.profiles p
        where p.id = auth.uid() and coalesce(p.ativo, true)
     );
$fn$;

revoke all on function public.emails_ead_do_usuario() from public, anon;
grant execute on function public.emails_ead_do_usuario() to authenticated;

-- ---------- A regra de leitura ---------------------------------------

alter table public.treinamentos_progresso enable row level security;

drop policy if exists treinamentos_progresso_leitura_portal on public.treinamentos_progresso;
create policy treinamentos_progresso_leitura_portal
  on public.treinamentos_progresso
  for select
  to authenticated
  using (
    public.eh_equipe_ativa()
    or lower(btrim(email)) in (select email_norm from public.emails_ead_do_usuario())
  );

-- A regra antiga fazia a mesma varredura por linha e, sendo
-- permissiva, era somada à nova: mantê-la anularia o ganho.
drop policy if exists treinamentos_progresso_select on public.treinamentos_progresso;

-- ---------- Conferência ----------------------------------------------
-- Rode e compare: a contagem tem de ser a mesma de antes (442 para a
-- VALLOR), e agora em menos de um segundo.
select
  (select count(*) from pg_policies
    where tablename = 'treinamentos_progresso')                         as politicas_de_leitura,
  (select count(*) from pg_proc where proname = 'emails_ead_do_usuario') as funcao_emails,
  (select count(*) from pg_proc where proname = 'eh_equipe_ativa')       as funcao_equipe;
