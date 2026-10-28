-- =====================================================================
-- Trava de horário da equipe: segunda a quinta até 18h, sexta até 17h.
--
-- ANTES:  a equipe movimentava chamados de segunda a sexta, das 8h às
--         17h (Porto Velho). Depois disso, só consulta (exceto quem tem
--         "Pode atender fora do horário").
-- DEPOIS: segunda a quinta, das 8h às 18h; sexta, das 8h às 17h.
--         Fim de semana e feriados cadastrados continuam fechados.
--         Autorizados e rotinas automáticas continuam sem trava.
-- MOTIVO: novo horário da equipe (pedido do Leonardo em 28/10/2026).
--
-- Só troca a função do horário e a mensagem de bloqueio. O prazo (SLA)
-- dos chamados NÃO muda: continua em horas úteis 8h–12h e 13h–17h.
-- Depende de supabase/trava-horario-equipe.sql. Pode rodar mais de uma vez.
-- =====================================================================

create or replace function public.dentro_horario_atendimento(p_quando timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  with t as (select (p_quando at time zone 'America/Porto_Velho') as local)
  select extract(isodow from t.local) between 1 and 5
     and t.local::time >= time '08:00'
     and t.local::time <  case when extract(isodow from t.local) = 5
                               then time '17:00'
                               else time '18:00' end
     and not exists (select 1 from public.feriados f where f.data = t.local::date)
    from t;
$fn$;

create or replace function public.exigir_horario_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.equipe_bloqueada_agora() then
    raise exception 'Fora do horário de atendimento (segunda a quinta, 8h às 18h; sexta, 8h às 17h; horário de Porto Velho). Você pode consultar, mas responder e movimentar chamados agora só com autorização da gestão.'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$fn$;


-- ---------- Conferência -------------------------------------------------
-- Esperado: seg 17h30 = true, qui 17h59 = true, qui 18h = false,
--           sex 16h59 = true, sex 17h = false, sáb 10h = false.
-- (09/11/2026 é segunda; troque as datas se alguma for feriado cadastrado.)
select
  public.dentro_horario_atendimento('2026-11-09 17:30-04') as seg_17h30,
  public.dentro_horario_atendimento('2026-11-12 17:59-04') as qui_17h59,
  public.dentro_horario_atendimento('2026-11-12 18:00-04') as qui_18h,
  public.dentro_horario_atendimento('2026-11-13 16:59-04') as sex_16h59,
  public.dentro_horario_atendimento('2026-11-13 17:00-04') as sex_17h,
  public.dentro_horario_atendimento('2026-11-14 10:00-04') as sab_10h;
