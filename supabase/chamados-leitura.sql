-- =====================================================================
-- Chamados: MENSAGENS NÃO LIDAS (balão vermelho na aba Chamados)
-- Rode no Supabase ("projeto ticket") -> SQL Editor. Pode rodar mais
-- de uma vez. Não altera nem apaga dados existentes: só cria 2
-- tabelas novas e 2 funções.
--
-- COMO FUNCIONA
--   chamado_leituras guarda, por pessoa e por chamado, quando ela abriu
--   o chamado pela última vez. Mensagem (inclusive automática) de outra
--   pessoa depois disso = não lida.
--   Para não acender o histórico inteiro no primeiro dia, só contam
--   mensagens posteriores ao início do recurso (chamado_leitura_config)
--   e dos últimos 60 dias.
--   Quem conta:
--     cliente: todos os chamados que ele vê (regras atuais do banco);
--     equipe : chamados em que é responsável, abriu ou é solicitante.
--   As funções rodam com as permissões de quem chama: ninguém conta
--   mensagem de chamado que não pode ver.
-- =====================================================================


create table if not exists public.chamado_leituras (
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  lido_em    timestamptz not null default now(),
  primary key (chamado_id, usuario_id)
);

create index if not exists chamado_leituras_usuario
  on public.chamado_leituras (usuario_id);

alter table public.chamado_leituras enable row level security;

drop policy if exists "Cada um le as proprias leituras" on public.chamado_leituras;
create policy "Cada um le as proprias leituras" on public.chamado_leituras
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists "Cada um grava as proprias leituras" on public.chamado_leituras;
create policy "Cada um grava as proprias leituras" on public.chamado_leituras
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists "Cada um atualiza as proprias leituras" on public.chamado_leituras;
create policy "Cada um atualiza as proprias leituras" on public.chamado_leituras
  for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());


create table if not exists public.chamado_leitura_config (
  id     boolean primary key default true check (id),
  inicio timestamptz not null default now()
);

insert into public.chamado_leitura_config (id) values (true) on conflict (id) do nothing;

alter table public.chamado_leitura_config enable row level security;

drop policy if exists "Todos leem o inicio" on public.chamado_leitura_config;
create policy "Todos leem o inicio" on public.chamado_leitura_config
  for select to authenticated using (true);


-- Marca o chamado como lido agora por quem está logado.
create or replace function public.marcar_chamado_lido(p_chamado uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  if auth.uid() is null then return; end if;
  /* Só marca chamado que a pessoa enxerga (regras de chamados). */
  if not exists (select 1 from public.chamados c where c.id = p_chamado) then return; end if;

  insert into public.chamado_leituras (chamado_id, usuario_id, lido_em)
  values (p_chamado, auth.uid(), now())
  on conflict (chamado_id, usuario_id) do update set lido_em = excluded.lido_em;
end;
$fn$;

revoke all on function public.marcar_chamado_lido(uuid) from public, anon;
grant execute on function public.marcar_chamado_lido(uuid) to authenticated;


-- Chamados com mensagens novas para quem está logado.
create or replace function public.chamados_nao_lidos()
returns table (chamado_id uuid, novas integer)
language sql
stable
security invoker
set search_path = public
as $fn$
  select m.chamado_id, count(*)::integer
    from public.chamado_mensagens m
    join public.chamados c on c.id = m.chamado_id
    left join public.chamado_leituras l
           on l.chamado_id = m.chamado_id and l.usuario_id = auth.uid()
   where m.created_at > greatest(
           coalesce(l.lido_em, '-infinity'::timestamptz),
           (select inicio from public.chamado_leitura_config where id),
           now() - interval '60 days')
     and m.autor_id is distinct from auth.uid()
     and (
           not public.estrelas_eh_equipe()
        or c.responsavel_id = auth.uid()
        or c.criado_por = auth.uid()
        or c.solicitante_id = auth.uid()
         )
   group by m.chamado_id;
$fn$;

revoke all on function public.chamados_nao_lidos() from public, anon;
grant execute on function public.chamados_nao_lidos() to authenticated;
