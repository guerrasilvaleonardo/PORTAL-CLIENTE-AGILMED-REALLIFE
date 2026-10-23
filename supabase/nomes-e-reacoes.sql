-- =====================================================================
-- 1) Cliente vê o nome de quem respondeu no chamado.
-- 2) Reações com emoji nas mensagens (chamados e Conversas).
--
-- 1) ANTES:  na tela do cliente, a mensagem do atendente aparecia como
--            "Usuário · Cliente": a regra de leitura de perfis não mostra a
--            equipe ao cliente, então o portal não achava o nome e caía no
--            padrão.
--    DEPOIS: uma função do banco entrega, para quem pode ver o chamado, o
--            nome de quem escreveu ou reagiu nele e se é da equipe. A tela
--            mostra "Nome · Equipe Real Life/ÁgilMed". Nada além do nome é
--            exposto (sem e-mail, telefone ou cargo).
--
-- 2) ANTES:  não havia como reagir a uma mensagem.
--    DEPOIS: cada pessoa pode deixar UMA reação por mensagem (👍 ❤️ 😂 😮
--            🙏 ✅), trocar ou retirar a própria. Só reage quem pode ler a
--            mensagem. Reagir não movimenta o chamado (não mexe em prazo,
--            situação nem estrelas e não depende do horário de atendimento).
--
-- Não apaga nem altera mensagens, chamados ou perfis. Pode rodar mais de
-- uma vez.
-- =====================================================================


-- ---------- Quem pode ver o chamado / a mensagem ------------------------
-- Mesma regra da leitura de mensagens do chamado (equipe vê tudo; cliente
-- vê os chamados da empresa ativa).
create or replace function public.chamado_visivel_para_mim(p_chamado uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.chamados c
     where c.id = p_chamado
       and (public.e_equipe_interna() or c.empresa_id = public.minha_empresa_id())
  );
$fn$;

create or replace function public.chamado_mensagem_visivel(p_mensagem uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.chamado_mensagens m
     where m.id = p_mensagem
       and public.chamado_visivel_para_mim(m.chamado_id)
  );
$fn$;

revoke all on function public.chamado_visivel_para_mim(uuid) from public, anon;
revoke all on function public.chamado_mensagem_visivel(uuid) from public, anon;
grant execute on function public.chamado_visivel_para_mim(uuid) to authenticated;
grant execute on function public.chamado_mensagem_visivel(uuid) to authenticated;


-- ---------- Reações nas mensagens dos chamados --------------------------
create table if not exists public.chamado_mensagem_reacoes (
  mensagem_id  uuid not null references public.chamado_mensagens (id) on delete cascade,
  usuario_id   uuid not null references public.profiles (id) on delete cascade,
  emoji        text not null check (emoji in ('👍', '❤️', '😂', '😮', '🙏', '✅')),
  created_at   timestamptz not null default now(),
  primary key (mensagem_id, usuario_id)
);

alter table public.chamado_mensagem_reacoes enable row level security;

drop policy if exists chamado_reacoes_leitura on public.chamado_mensagem_reacoes;
create policy chamado_reacoes_leitura on public.chamado_mensagem_reacoes
  for select to authenticated
  using (public.chamado_mensagem_visivel(mensagem_id));

drop policy if exists chamado_reacoes_inclusao on public.chamado_mensagem_reacoes;
create policy chamado_reacoes_inclusao on public.chamado_mensagem_reacoes
  for insert to authenticated
  with check (usuario_id = auth.uid() and public.chat_eu_estou_ativo() and public.chamado_mensagem_visivel(mensagem_id));

drop policy if exists chamado_reacoes_troca on public.chamado_mensagem_reacoes;
create policy chamado_reacoes_troca on public.chamado_mensagem_reacoes
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid() and public.chamado_mensagem_visivel(mensagem_id));

drop policy if exists chamado_reacoes_retirada on public.chamado_mensagem_reacoes;
create policy chamado_reacoes_retirada on public.chamado_mensagem_reacoes
  for delete to authenticated
  using (usuario_id = auth.uid());

revoke all on public.chamado_mensagem_reacoes from anon;
revoke all on public.chamado_mensagem_reacoes from authenticated;
grant select, insert, update, delete on public.chamado_mensagem_reacoes to authenticated;


-- ---------- Nomes de quem escreveu ou reagiu no chamado ------------------
create or replace function public.pessoas_do_chamado(p_chamado uuid)
returns table (id uuid, nome text, equipe boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id,
         coalesce(nullif(btrim(p.nome), ''),
                  case when p.perfil in ('atendimento', 'gestor', 'admin') then 'Equipe de atendimento' else 'Usuário' end)::text,
         p.perfil in ('atendimento', 'gestor', 'admin')
    from public.profiles p
   where public.chamado_visivel_para_mim(p_chamado)
     and p.id in (
       select m.autor_id from public.chamado_mensagens m
        where m.chamado_id = p_chamado and m.autor_id is not null
       union
       select r.usuario_id from public.chamado_mensagem_reacoes r
         join public.chamado_mensagens m on m.id = r.mensagem_id
        where m.chamado_id = p_chamado
     );
$fn$;

revoke all on function public.pessoas_do_chamado(uuid) from public, anon;
grant execute on function public.pessoas_do_chamado(uuid) to authenticated;


-- ---------- Reações no chat (Conversas) ---------------------------------
-- Mesma regra de quem lê a mensagem (supabase/conversas-audio-imagem.sql).
create or replace function public.chat_mensagem_visivel(p_mensagem uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.chat_equipe c
     where c.id = p_mensagem
       and (c.autor_id = auth.uid()
            or c.destinatario_id = auth.uid()
            or (c.destinatario_id is null and public.chat_eu_sou_equipe()))
  );
$fn$;

revoke all on function public.chat_mensagem_visivel(uuid) from public, anon;
grant execute on function public.chat_mensagem_visivel(uuid) to authenticated;

create table if not exists public.chat_reacoes (
  mensagem_id  uuid not null references public.chat_equipe (id) on delete cascade,
  usuario_id   uuid not null references public.profiles (id) on delete cascade,
  emoji        text not null check (emoji in ('👍', '❤️', '😂', '😮', '🙏', '✅')),
  created_at   timestamptz not null default now(),
  primary key (mensagem_id, usuario_id)
);

alter table public.chat_reacoes enable row level security;

drop policy if exists chat_reacoes_leitura on public.chat_reacoes;
create policy chat_reacoes_leitura on public.chat_reacoes
  for select to authenticated
  using (public.chat_mensagem_visivel(mensagem_id));

drop policy if exists chat_reacoes_inclusao on public.chat_reacoes;
create policy chat_reacoes_inclusao on public.chat_reacoes
  for insert to authenticated
  with check (usuario_id = auth.uid() and public.chat_eu_estou_ativo() and public.chat_mensagem_visivel(mensagem_id));

drop policy if exists chat_reacoes_troca on public.chat_reacoes;
create policy chat_reacoes_troca on public.chat_reacoes
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid() and public.chat_mensagem_visivel(mensagem_id));

drop policy if exists chat_reacoes_retirada on public.chat_reacoes;
create policy chat_reacoes_retirada on public.chat_reacoes
  for delete to authenticated
  using (usuario_id = auth.uid());

revoke all on public.chat_reacoes from anon;
revoke all on public.chat_reacoes from authenticated;
grant select, insert, update, delete on public.chat_reacoes to authenticated;


-- ---------- Conferência -------------------------------------------------
select 'chamado_mensagem_reacoes' as tabela, count(*) from public.chamado_mensagem_reacoes
union all
select 'chat_reacoes', count(*) from public.chat_reacoes;
