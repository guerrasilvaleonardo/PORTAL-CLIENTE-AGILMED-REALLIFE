-- =====================================================================
-- Pausa do SLA em HORAS ÚTEIS
--
-- ANTES: ao sair de "Aguardando cliente", o prazo_sla era estendido pelo
--        tempo CORRIDO da espera (noites e fim de semana incluídos).
-- DEPOIS: o prazo_sla é estendido só pelas horas ÚTEIS que passaram
--        durante a espera. O chamado volta com o mesmo saldo que tinha
--        ao pausar.
--
-- Expediente igual ao de lib/prazo.ts: seg-sex, 08-12h e 13-17h,
-- horário de Brasília (America/Sao_Paulo). Sem feriados, como no app.
-- sla_pausa_total continua guardando o tempo corrido (só informativo).
-- O restante da função registrar_mudanca_chamado fica igual.
-- =====================================================================

create or replace function public.horas_uteis_entre(p_ini timestamptz, p_fim timestamptz)
returns numeric
language sql
stable
set search_path = public
as $fn$
  with dias as (
    select d::date as dia
    from generate_series((p_ini at time zone 'America/Sao_Paulo')::date,
                         (p_fim at time zone 'America/Sao_Paulo')::date,
                         interval '1 day') d
    where p_ini < p_fim
      and extract(isodow from d) <= 5
  ),
  janelas as (
    select (dia + time '08:00') at time zone 'America/Sao_Paulo' as j_ini,
           (dia + time '12:00') at time zone 'America/Sao_Paulo' as j_fim from dias
    union all
    select (dia + time '13:00') at time zone 'America/Sao_Paulo',
           (dia + time '17:00') at time zone 'America/Sao_Paulo' from dias
  )
  select coalesce(sum(extract(epoch from (least(j_fim, p_fim) - greatest(j_ini, p_ini)))) / 3600.0, 0)
  from janelas
  where least(j_fim, p_fim) > greatest(j_ini, p_ini);
$fn$;

create or replace function public.somar_horas_uteis(p_ini timestamptz, p_horas numeric)
returns timestamptz
language plpgsql
stable
set search_path = public
as $fn$
declare
  dia   date;
  resto numeric;
  a     timestamptz;
  b     timestamptz;
  dur   numeric;
  j     record;
begin
  if p_ini is null or p_horas is null then return p_ini; end if;
  if p_horas <= 0 then return p_ini; end if;

  dia   := (p_ini at time zone 'America/Sao_Paulo')::date;
  resto := p_horas * 3600;

  for i in 0..2000 loop
    if extract(isodow from dia) <= 5 then
      for j in
        select * from (values (time '08:00', time '12:00'),
                              (time '13:00', time '17:00')) v(ini, fim)
      loop
        a := greatest((dia + j.ini) at time zone 'America/Sao_Paulo', p_ini);
        b := (dia + j.fim) at time zone 'America/Sao_Paulo';
        if b > a then
          dur := extract(epoch from (b - a));
          if dur >= resto then
            return a + make_interval(secs => resto::double precision);
          end if;
          resto := resto - dur;
        end if;
      end loop;
    end if;
    dia := dia + 1;
  end loop;
  return p_ini;
end;
$fn$;

create or replace function public.registrar_mudanca_chamado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
 ator uuid := auth.uid();
 espera interval;
 espera_util numeric;
 nome_antigo text;
 nome_novo text;
begin
 if new.status is distinct from old.status then
 insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id)
 values (new.id, 'status', old.status, new.status, ator);
 if new.status = 'aguardando_cliente' then
 new.sla_pausado_em := now();
 insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
 values (new.id, 'sla', 'pausado', ator, 'Relogio do SLA pausado enquanto aguarda o cliente');
 elsif old.status = 'aguardando_cliente' and old.sla_pausado_em is not null then
 espera := now() - old.sla_pausado_em;
 -- Estende o prazo só pelas horas úteis da espera.
 espera_util := public.horas_uteis_entre(old.sla_pausado_em, now());
 new.prazo_sla := public.somar_horas_uteis(new.prazo_sla, espera_util);
 new.sla_pausa_total := coalesce(old.sla_pausa_total, interval '0') + espera;
 new.sla_pausado_em := null;
 insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
 values (new.id, 'sla', 'retomado', ator,
 'Prazo estendido em ' || round(espera_util, 1) || 'h uteis de espera do cliente');
 end if;
 end if;
 if new.prioridade is distinct from old.prioridade then
 insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id)
 values (new.id, 'prioridade', old.prioridade, new.prioridade, ator);
 end if;
 if new.responsavel_id is distinct from old.responsavel_id then
 select nome into nome_antigo from public.profiles where id = old.responsavel_id;
 select nome into nome_novo from public.profiles where id = new.responsavel_id;
 insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id)
 values (new.id, 'responsavel', coalesce(nome_antigo, 'Sem responsavel'),
 coalesce(nome_novo, 'Sem responsavel'), ator);
 end if;
 return new;
end;
$function$;
