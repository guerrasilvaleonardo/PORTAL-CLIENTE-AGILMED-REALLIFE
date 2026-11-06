-- =====================================================================
-- Limite de chamados "Em andamento" por atendente — FASE 1: SÓ AVISO.
--
-- ANTES:  não havia referência de carga: cada atendente podia acumular
--         quantos chamados "Em andamento" quisesse, sem a gestão ver.
-- DEPOIS: um limite único para toda a equipe (decisão do Leonardo,
--         06/11/2026), definido pelo gestor/admin.
--   * Conta só a situação 'em_atendimento' com a pessoa como responsável.
--     "Aguardando cliente" e "Suspenso" ficam fora (têm controle próprio).
--   * FASE 1: o portal só AVISA (contador "X de Y" e alerta ao assumir).
--     Nada é bloqueado no banco. Urgente nunca recebe o alerta.
--   * Limite vazio (null) = aviso desligado; o contador continua.
--   * Fase 2 (bloqueio, com exceções para urgente e para o gestor com
--     motivo) só depois de 2 a 4 semanas de dados e nova decisão.
-- MOTIVO: dar visibilidade de sobrecarga antes de travar o trabalho, e
--         escolher o número a partir dos dados reais.
--
-- Não mexe em SLA, prazo nem estrelas. Não apaga nem altera dados.
-- Pode rodar mais de uma vez. Depende de programa-estrelas.sql
-- (estrelas_eh_equipe, estrelas_eh_gestor).
-- =====================================================================

create table if not exists public.atendimento_config (
  id                   int primary key default 1 check (id = 1),
  limite_em_andamento  int check (limite_em_andamento is null or limite_em_andamento between 1 and 50),
  atualizado_por       uuid references public.profiles (id) on delete set null,
  atualizado_em        timestamptz not null default now()
);

-- Linha única. Começa SEM limite (aviso desligado) até o gestor definir.
insert into public.atendimento_config (id, limite_em_andamento)
values (1, null)
on conflict (id) do nothing;

alter table public.atendimento_config enable row level security;

drop policy if exists "Equipe ve config de atendimento" on public.atendimento_config;
create policy "Equipe ve config de atendimento" on public.atendimento_config
  for select to authenticated using (public.estrelas_eh_equipe());

grant select on public.atendimento_config to authenticated;
revoke insert, update, delete on public.atendimento_config from anon, authenticated;

-- Só gestor/admin define o limite. null desliga o aviso.
create or replace function public.definir_limite_em_andamento(p_limite int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.estrelas_eh_gestor() then
    raise exception 'Somente gestor ou administrador define o limite de chamados em andamento.';
  end if;
  if p_limite is not null and (p_limite < 1 or p_limite > 50) then
    raise exception 'O limite precisa ficar entre 1 e 50 (ou vazio para desligar o aviso).';
  end if;

  insert into public.atendimento_config (id, limite_em_andamento, atualizado_por, atualizado_em)
  values (1, p_limite, auth.uid(), now())
  on conflict (id) do update
     set limite_em_andamento = excluded.limite_em_andamento,
         atualizado_por      = excluded.atualizado_por,
         atualizado_em       = excluded.atualizado_em;
end;
$fn$;

revoke all on function public.definir_limite_em_andamento(int) from public, anon;
grant execute on function public.definir_limite_em_andamento(int) to authenticated;


-- ---------- Conferência -------------------------------------------------
select limite_em_andamento, atualizado_em from public.atendimento_config;

-- Carga atual por atendente (para escolher o número):
-- select p.nome, count(*) as em_andamento
--   from public.chamados c join public.profiles p on p.id = c.responsavel_id
--  where c.status = 'em_atendimento'
--  group by p.nome order by 2 desc;
