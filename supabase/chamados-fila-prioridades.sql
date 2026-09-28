-- =====================================================================
-- Chamados: fila por área e posição do cliente.
-- Rode no Supabase -> SQL Editor. Pode rodar mais de uma vez.
-- Não altera nem apaga nada que já existe: só cria uma view e uma função.
--
-- Critério da fila (vale para a lista de prioridades e para a posição
-- que o cliente vê):
--   entram ........ status 'aberto' e 'em_atendimento'
--                   ('aguardando_cliente' fica fora: o SLA está pausado)
--   ordem ......... prazo_sla mais próximo primeiro. Quem já venceu tem o
--                   prazo mais antigo, então os atrasados ficam no topo,
--                   do maior atraso para o menor. Depois: prioridade
--                   (urgente > alta > normal > baixa) e data de abertura.
--   posição ....... por área (coluna categoria)
-- =====================================================================

create or replace view public.v_chamados_fila
with (security_invoker = true) as
select
  c.id,
  c.numero,
  c.empresa_id,
  c.categoria,
  c.prioridade,
  c.status,
  c.responsavel_id,
  c.prazo_sla,
  c.created_at,
  (c.status in ('aberto', 'em_atendimento')) as na_fila,
  case when c.status in ('aberto', 'em_atendimento')
       then row_number() over w_area end                                as posicao_area,
  case when c.status in ('aberto', 'em_atendimento')
       then count(*) over (partition by c.status in ('aberto', 'em_atendimento'),
                                        c.categoria) end                as total_area,
  case when c.status in ('aberto', 'em_atendimento')
       then row_number() over w_resp end                                as posicao_responsavel,
  case when c.status in ('aberto', 'em_atendimento')
       then row_number() over w_geral end                               as posicao_geral
from public.chamados c
window
  w_area  as (partition by c.status in ('aberto', 'em_atendimento'), c.categoria
              order by c.prazo_sla asc nulls last,
                       case c.prioridade when 'urgente' then 1 when 'alta' then 2
                                         when 'baixa' then 4 else 3 end,
                       c.created_at),
  w_resp  as (partition by c.status in ('aberto', 'em_atendimento'), c.responsavel_id
              order by c.prazo_sla asc nulls last,
                       case c.prioridade when 'urgente' then 1 when 'alta' then 2
                                         when 'baixa' then 4 else 3 end,
                       c.created_at),
  w_geral as (partition by c.status in ('aberto', 'em_atendimento')
              order by c.prazo_sla asc nulls last,
                       case c.prioridade when 'urgente' then 1 when 'alta' then 2
                                         when 'baixa' then 4 else 3 end,
                       c.created_at);

grant select on public.v_chamados_fila to authenticated;


-- Posição do chamado para o cliente. Devolve só números do chamado
-- pedido: o cliente não enxerga chamados de outras empresas. Quem não
-- tem acesso ao chamado não recebe nada.
create or replace function public.posicao_do_chamado(p_chamado_id uuid)
returns table (
  numero        bigint,
  area          text,
  status        text,
  posicao_area  bigint,
  total_area    bigint,
  prazo_sla     timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select f.numero, f.categoria, f.status, f.posicao_area, f.total_area, f.prazo_sla
  from public.v_chamados_fila f
  where f.id = p_chamado_id
    and (public.e_equipe_interna() or f.empresa_id = public.minha_empresa_id());
$fn$;

revoke all on function public.posicao_do_chamado(uuid) from public;
grant execute on function public.posicao_do_chamado(uuid) to authenticated;
