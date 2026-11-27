-- =====================================================================
-- Corrigir uma inspeção de campo já encerrada.
--
-- ANTES:  encerrou a visita, acabou. O RIC saiu com o nome errado de
--         quem inspecionou, com a hora de encerramento do dia em que o
--         celular pegou sinal, ou com um apontamento mal descrito — e
--         não havia tela nenhuma para corrigir. A saída era abrir
--         outra visita, que gera OUTRO código RIC e deixa dois
--         documentos contando o mesmo dia.
-- DEPOIS: gestor e admin corrigem a inspeção inteira — o cabeçalho
--         (local, quem inspecionou, início, encerramento, coordenada,
--         observações) e os apontamentos, reabrindo a visita. Toda
--         correção exige motivo, fica no histórico e sobe a revisão do
--         relatório. O código RIC nunca muda.
-- MOTIVO: pedido dele em 27/11/2026, olhando o RIC-2026-0001: "preciso
--         poder editar toda a inspeção".
--
-- POR QUE A EMPRESA NÃO ENTRA NA CORREÇÃO. O código RIC é por empresa
-- e por ano. Mover a visita de cliente deixaria um buraco na sequência
-- de um e um número fora de ordem no outro — e o número fora de ordem
-- é o fim da utilidade dele. Visita no cliente errado se cancela e se
-- refaz.
--
-- POR QUE SÓ GESTOR E ADMIN. Documento já entregue ao cliente. Quem
-- inspecionou corrige enquanto a visita está aberta; depois de emitido,
-- mexer é decisão de quem responde pelo documento. Decisão dele em
-- 27/11/2026.
--
-- POR QUE A REVISÃO SOBE SOZINHA AQUI. "Registrar revisão" existe para
-- o caso de o dado ter mudado por fora (um prazo repactuado numa NC).
-- Quando a própria correção acontece por esta função, ela SABE que o
-- documento mudou — e deixar isso para um segundo clique produziria
-- duas folhas na revisão 02 dizendo coisas diferentes. É o que a ISO
-- 7.5.2 espera: o código identifica, a revisão conta as mudanças.
--
-- Depende de supabase/inspecoes.sql (pode_gerir_inspecoes) e de
-- supabase/visitas-e-relatorios-emitidos.sql (inspecao_visitas,
-- relatorios_emitidos, revisar_relatorio).
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -------------------------------------------
do $$
begin
  if to_regclass('public.inspecao_visitas') is null then
    raise exception 'Rode antes supabase/visitas-e-relatorios-emitidos.sql.';
  end if;
  if to_regclass('public.relatorios_emitidos') is null then
    raise exception 'Rode antes supabase/visitas-e-relatorios-emitidos.sql.';
  end if;
end
$$;


-- ---------- 1. Quem responde pelo documento -----------------------------
/*
 * Gestor e admin. Separada de eh_equipe() de propósito: atendimento é
 * equipe e aplica inspeção, mas não mexe em documento já emitido.
 */
create or replace function public.eh_gestao()
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
       and p.perfil in ('gestor', 'admin')
  );
$fn$;

revoke all on function public.eh_gestao() from public, anon;
grant execute on function public.eh_gestao() to authenticated;


-- ---------- 2. O histórico das correções --------------------------------
/*
 * Mesma ideia de inspecoes_alteracoes (supabase/inspecoes-reabrir.sql):
 * o que protege o documento não é impedir a correção, é deixar claro o
 * que foi corrigido, por quem e por quê. Sem motivo registrado, a
 * correção é indistinguível de maquiar resultado.
 */
create table if not exists public.inspecao_visitas_alteracoes (
  id         bigint generated always as identity primary key,
  visita_id  uuid not null references public.inspecao_visitas (id) on delete cascade,
  -- 'reabertura' (voltou para a tela de campo), 'cabecalho' (corrigiu a
  -- identificação) ou 'reencerramento' (fechou de novo depois de mexer).
  acao       text not null,
  motivo     text not null,
  -- Quais campos mudaram de fato. Vazio quando nada mudou.
  campos     text,
  -- A revisão que o relatório passou a ter depois desta correção.
  revisao    integer,
  por        uuid references public.profiles (id) on delete set null,
  por_nome   text,
  created_at timestamptz not null default now()
);

alter table public.inspecao_visitas_alteracoes
  drop constraint if exists inspecao_visitas_alteracoes_acao;
alter table public.inspecao_visitas_alteracoes
  add constraint inspecao_visitas_alteracoes_acao
  check (acao in ('reabertura', 'cabecalho', 'reencerramento'));

create index if not exists inspecao_visitas_alteracoes_visita
  on public.inspecao_visitas_alteracoes (visita_id, created_at desc);

alter table public.inspecao_visitas_alteracoes enable row level security;

/*
 * Lê quem já lê a visita — inclusive o cliente. O histórico de
 * correção é parte do documento: esconder dele qual linha mudou é
 * pedir que confie no papel sem poder conferir.
 */
drop policy if exists inspecao_visitas_alteracoes_leitura on public.inspecao_visitas_alteracoes;
create policy inspecao_visitas_alteracoes_leitura
  on public.inspecao_visitas_alteracoes for select to authenticated
  using (exists (
    select 1 from public.inspecao_visitas v
     where v.id = inspecao_visitas_alteracoes.visita_id
       and public.pode_gerir_inspecoes(v.empresa_id)
  ));

/* Sem política de escrita: a linha só nasce pelas funções abaixo, que
   conferem a permissão. Deixar a tela inserir direto permitiria
   registrar correção que não aconteceu. */


-- ---------- 3. Reabrir a visita para mexer nos apontamentos -------------
/*
 * Volta a visita para 'em_andamento', que é o que a tela de campo
 * exige para deixar editar. NÃO limpa o encerramento nem o código: a
 * visita aconteceu uma vez, naquele dia, e o documento continua sendo
 * o mesmo — o que muda é que ele está sendo corrigido.
 */
create or replace function public.reabrir_visita(p_visita uuid, p_motivo text)
returns public.inspecao_visitas
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_linha public.inspecao_visitas;
  v_nome  text;
begin
  select * into v_linha from public.inspecao_visitas where id = p_visita;
  if not found then
    raise exception 'Visita não encontrada.';
  end if;
  if not public.pode_gerir_inspecoes(v_linha.empresa_id) then
    raise exception 'Sem permissão para esta visita.';
  end if;
  if not public.eh_gestao() then
    raise exception 'Só gestor ou admin corrige inspeção já encerrada.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' or length(btrim(p_motivo)) < 5 then
    raise exception 'Diga o motivo da correção.';
  end if;
  if v_linha.situacao = 'cancelada' then
    raise exception 'Visita cancelada não se corrige.';
  end if;
  if v_linha.situacao = 'em_andamento' then
    /* Já está aberta: devolve como está, sem registrar correção que
       não houve. A tela pode ter sido aberta duas vezes. */
    return v_linha;
  end if;

  select nome into v_nome from public.profiles where id = auth.uid();

  update public.inspecao_visitas
     set situacao = 'em_andamento'
   where id = p_visita
  returning * into v_linha;

  insert into public.inspecao_visitas_alteracoes
    (visita_id, acao, motivo, por, por_nome)
  values
    (p_visita, 'reabertura', btrim(p_motivo), auth.uid(), v_nome);

  return v_linha;
end;
$fn$;

revoke all on function public.reabrir_visita(uuid, text) from public, anon;
grant execute on function public.reabrir_visita(uuid, text) to authenticated;


-- ---------- 4. Corrigir o cabeçalho -------------------------------------
/*
 * Os campos vêm num jsonb para a função distinguir "não mexeu" de
 * "apagou": com parâmetros soltos, nulo seria as duas coisas ao mesmo
 * tempo, e não haveria como limpar uma coordenada errada.
 *
 * A empresa não está na lista, e é de propósito (ver o cabeçalho).
 */
create or replace function public.corrigir_visita(
  p_visita uuid,
  p_motivo text,
  p_campos jsonb
)
returns public.inspecao_visitas
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_linha  public.inspecao_visitas;
  v_antes  jsonb;
  v_depois jsonb;
  v_mudou  text;
  v_nome   text;
  v_rel    public.relatorios_emitidos;
  v_revisao integer;
begin
  select * into v_linha from public.inspecao_visitas where id = p_visita;
  if not found then
    raise exception 'Visita não encontrada.';
  end if;
  if not public.pode_gerir_inspecoes(v_linha.empresa_id) then
    raise exception 'Sem permissão para esta visita.';
  end if;
  if not public.eh_gestao() then
    raise exception 'Só gestor ou admin corrige inspeção já encerrada.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' or length(btrim(p_motivo)) < 5 then
    raise exception 'Diga o motivo da correção.';
  end if;

  v_antes := to_jsonb(v_linha);

  update public.inspecao_visitas v
     set local_id = case when p_campos ? 'local_id'
                         then nullif(p_campos->>'local_id', '')::uuid else v.local_id end,
         local_nome = case when p_campos ? 'local_nome'
                         then nullif(btrim(p_campos->>'local_nome'), '') else v.local_nome end,
         responsavel_nome = case when p_campos ? 'responsavel_nome'
                         then nullif(btrim(p_campos->>'responsavel_nome'), '') else v.responsavel_nome end,
         iniciada_em = case when p_campos ? 'iniciada_em'
                         then coalesce(nullif(p_campos->>'iniciada_em', '')::timestamptz, v.iniciada_em)
                         else v.iniciada_em end,
         encerrada_em = case when p_campos ? 'encerrada_em'
                         then nullif(p_campos->>'encerrada_em', '')::timestamptz else v.encerrada_em end,
         latitude = case when p_campos ? 'latitude'
                         then nullif(p_campos->>'latitude', '')::numeric else v.latitude end,
         longitude = case when p_campos ? 'longitude'
                         then nullif(p_campos->>'longitude', '')::numeric else v.longitude end,
         precisao_m = case when p_campos ? 'precisao_m'
                         then nullif(p_campos->>'precisao_m', '')::integer else v.precisao_m end,
         observacoes = case when p_campos ? 'observacoes'
                         then nullif(btrim(p_campos->>'observacoes'), '') else v.observacoes end,
         ciente_nome = case when p_campos ? 'ciente_nome'
                         then nullif(btrim(p_campos->>'ciente_nome'), '') else v.ciente_nome end,
         ciente_cargo = case when p_campos ? 'ciente_cargo'
                         then nullif(btrim(p_campos->>'ciente_cargo'), '') else v.ciente_cargo end
   where v.id = p_visita
  returning * into v_linha;

  /* iniciada_em nunca fica nula: a visita começou. encerrada_em pode
     ficar, porque visita em andamento não tem encerramento. */

  v_depois := to_jsonb(v_linha);

  select string_agg(k, ', ' order by k)
    into v_mudou
    from (
      select key as k
        from jsonb_each_text(v_antes)
       where key in ('local_id', 'local_nome', 'responsavel_nome', 'iniciada_em',
                     'encerrada_em', 'latitude', 'longitude', 'precisao_m',
                     'observacoes', 'ciente_nome', 'ciente_cargo')
         and coalesce(value, '') is distinct from coalesce(v_depois->>key, '')
      union
      select key
        from jsonb_each_text(v_depois)
       where key in ('local_id', 'local_nome', 'responsavel_nome', 'iniciada_em',
                     'encerrada_em', 'latitude', 'longitude', 'precisao_m',
                     'observacoes', 'ciente_nome', 'ciente_cargo')
         and coalesce(value, '') is distinct from coalesce(v_antes->>key, '')
    ) d;

  if v_mudou is null then
    /* Clicou em salvar sem mudar nada: não sobe revisão e não
       registra correção. Revisão que sobe à toa não prova nada. */
    return v_linha;
  end if;

  select nome into v_nome from public.profiles where id = auth.uid();

  /* Sobe a revisão do relatório da visita, se já houver um. */
  select * into v_rel
    from public.relatorios_emitidos
   where visita_id = p_visita
   order by emitido_em desc
   limit 1;

  if found then
    v_rel := public.revisar_relatorio(v_rel.id, null);
    v_revisao := v_rel.revisao;
  end if;

  insert into public.inspecao_visitas_alteracoes
    (visita_id, acao, motivo, campos, revisao, por, por_nome)
  values
    (p_visita, 'cabecalho', btrim(p_motivo), v_mudou, v_revisao, auth.uid(), v_nome);

  return v_linha;
end;
$fn$;

revoke all on function public.corrigir_visita(uuid, text, jsonb) from public, anon;
grant execute on function public.corrigir_visita(uuid, text, jsonb) to authenticated;


-- ---------- 5. Registrar que a visita corrigida foi fechada de novo -----
/*
 * A tela de campo já sabe reencerrar: ela grava a visita e, no lugar de
 * emitir código novo, pede revisão do que já existe. Esta função só
 * guarda a linha do histórico, para o documento dizer quantas vezes foi
 * corrigido e por quê.
 */
create or replace function public.registrar_reencerramento_visita(
  p_visita uuid,
  p_motivo text default 'Reencerrada depois de correção',
  p_revisao integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_empresa uuid;
  v_nome    text;
begin
  select empresa_id into v_empresa from public.inspecao_visitas where id = p_visita;
  if v_empresa is null then
    raise exception 'Visita não encontrada.';
  end if;
  if not public.pode_gerir_inspecoes(v_empresa) then
    raise exception 'Sem permissão para esta visita.';
  end if;

  select nome into v_nome from public.profiles where id = auth.uid();

  insert into public.inspecao_visitas_alteracoes
    (visita_id, acao, motivo, revisao, por, por_nome)
  values
    (p_visita, 'reencerramento', coalesce(nullif(btrim(p_motivo), ''), 'Reencerrada depois de correção'),
     p_revisao, auth.uid(), v_nome);
end;
$fn$;

revoke all on function public.registrar_reencerramento_visita(uuid, text, integer) from public, anon;
grant execute on function public.registrar_reencerramento_visita(uuid, text, integer) to authenticated;


-- ---------- 6. Conferência ----------------------------------------------
-- Esperado: a tabela existe (t), as quatro funções existem (t) e
-- nenhuma visita foi tocada por este script (correcoes = 0).
select
  to_regclass('public.inspecao_visitas_alteracoes') is not null as tabela_criada,
  to_regproc('public.eh_gestao')                    is not null as fn_eh_gestao,
  to_regproc('public.reabrir_visita')               is not null as fn_reabrir,
  to_regproc('public.corrigir_visita')              is not null as fn_corrigir,
  to_regproc('public.registrar_reencerramento_visita') is not null as fn_reencerrar,
  (select count(*) from public.inspecao_visitas_alteracoes) as correcoes;
