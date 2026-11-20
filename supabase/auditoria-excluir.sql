-- =====================================================================
-- Excluir uma auditoria ou inspeção — com registro do que foi excluído.
--
-- ANTES:  não dava para apagar. Auditoria de teste ficava na lista para
--         sempre, poluindo a contagem e o painel.
-- DEPOIS: a equipe exclui, informando o motivo, e fica registrado o que
--         existia antes de sumir.
-- MOTIVO: pedido dele em 20/11/2026 — "preciso poder apagar uma
--         auditoria que estamos fazendo testes".
--
-- POR QUE NÃO BASTA UM DELETE. As não conformidades apontam para a
-- inspeção com `on delete set null`. Apagar a inspeção no SQL direto
-- deixaria as constatações ÓRFÃS na tela do cliente, sem origem e sem
-- como encerrar. Pior do que o problema.
--
-- POR QUE UMA FUNÇÃO, E NÃO SOLTAR O DELETE NA TABELA. Soltar o delete
-- daria à tela o poder de apagar qualquer inspeção por engano. A função
-- é um caminho único, que confere quem está chamando, apaga na ordem
-- certa e registra.
--
-- O QUE FICA. A auditoria some; o registro de que ela existiu, não.
-- Quantos itens, quantas constatações, quem apagou e por quê ficam em
-- inspecoes_excluidas, que não tem chave estrangeira de propósito —
-- registro que some junto com o que ele registra não serve para nada.
--
-- CANCELAR CONTINUA SENDO O CAMINHO NORMAL. Auditoria com histórico
-- real se cancela, não se apaga: o cliente precisa ver que ela existiu.
-- Excluir é para teste e engano.
--
-- Depende de supabase/inspecoes.sql.
-- Não apaga nada por conta própria. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.inspecoes_excluidas (
  id           bigint generated always as identity primary key,
  inspecao_id  uuid not null,
  empresa_id   uuid,
  tipo         text,
  modelo_nome  text,
  norma        text,
  situacao     text,
  iniciada_em  timestamptz,
  itens        integer,
  constatacoes integer,
  mensagens    integer,
  motivo       text not null,
  por          uuid,
  por_nome     text,
  created_at   timestamptz not null default now()
);

create index if not exists inspecoes_excluidas_empresa
  on public.inspecoes_excluidas (empresa_id, created_at desc);

alter table public.inspecoes_excluidas enable row level security;

drop policy if exists inspecoes_excluidas_leitura on public.inspecoes_excluidas;
create policy inspecoes_excluidas_leitura
  on public.inspecoes_excluidas for select to authenticated
  using (public.eh_equipe());

grant select on public.inspecoes_excluidas to authenticated;
revoke insert, update, delete, truncate on public.inspecoes_excluidas from anon, authenticated;
revoke all on public.inspecoes_excluidas from anon;


create or replace function public.excluir_inspecao(p_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_i      public.inspecoes%rowtype;
  v_nome   text;
  v_itens  integer;
  v_ncs    integer;
  v_msgs   integer;
begin
  if not public.eh_equipe() then
    raise exception 'Só a equipe Real Life pode excluir.';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Diga o motivo da exclusão.';
  end if;

  select * into v_i from public.inspecoes where id = p_id;
  if not found then
    raise exception 'Inspeção não encontrada.';
  end if;

  select coalesce(p.nome, p.email) into v_nome
    from public.profiles p where p.id = auth.uid();

  select count(*) into v_itens
    from public.inspecao_respostas where inspecao_id = p_id;

  select count(*) into v_ncs
    from public.nao_conformidades where inspecao_id = p_id;

  select count(*) into v_msgs
    from public.inspecao_resposta_mensagens m
    join public.inspecao_respostas r on r.id = m.resposta_id
   where r.inspecao_id = p_id;

  insert into public.inspecoes_excluidas (
    inspecao_id, empresa_id, tipo, modelo_nome, norma, situacao,
    iniciada_em, itens, constatacoes, mensagens, motivo, por, por_nome
  ) values (
    p_id, v_i.empresa_id, v_i.tipo, v_i.modelo_nome, v_i.norma, v_i.situacao,
    v_i.iniciada_em, v_itens, v_ncs, v_msgs, btrim(p_motivo), auth.uid(), v_nome
  );

  -- Ordem importa: a constatação aponta para a inspeção com
  -- `set null`, então ela some ANTES, senão fica órfã.
  delete from public.nao_conformidades where inspecao_id = p_id;
  -- As respostas e as mensagens caem por cascata.
  delete from public.inspecoes where id = p_id;

  return jsonb_build_object(
    'itens', v_itens, 'constatacoes', v_ncs, 'mensagens', v_msgs
  );
end;
$fn$;

revoke all on function public.excluir_inspecao(uuid, text) from public, anon;
grant execute on function public.excluir_inspecao(uuid, text) to authenticated;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.inspecoes_excluidas)        as ja_excluidas,
       (select count(*) from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'excluir_inspecao') as funcao;
