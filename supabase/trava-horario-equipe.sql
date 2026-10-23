-- =====================================================================
-- Trava de horário para a equipe nos chamados.
--
-- ANTES:  qualquer pessoa da equipe podia responder e movimentar chamados
--         a qualquer hora (noite, fim de semana, feriado).
-- DEPOIS: fora do horário de atendimento, a equipe só CONSULTA. Responder
--         ao cliente, mudar situação, assumir/transferir, prioridade,
--         etapas, anexos, links e abrir chamado ficam bloqueados, exceto
--         para quem tem "Pode atender fora do horário" marcado no
--         cadastro (só administrador marca).
--         Horário: segunda a sexta, 8h às 17h (Porto Velho), exceto os
--         feriados cadastrados. 12h às 13h fica liberado.
--         Clientes e rotinas automáticas (cron) não são afetados.
--         Já ficam marcados: Priscila Vanzini e Leonardo Guerra.
-- MOTIVO: controle de jornada da equipe; trabalho fora do horário só por
--         quem a gestão autorizou.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.profiles
  add column if not exists pode_fora_horario boolean not null default false;

-- O próprio usuário não marca a si mesmo (o protetor de campos do
-- perfil cobre empresa/perfil/ativo; este cobre a nova marcação).
create or replace function public.profiles_proteger_fora_horario()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is not null
     and new.pode_fora_horario is distinct from old.pode_fora_horario
     and not exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.perfil = 'admin' and p.ativo = true) then
    new.pode_fora_horario := old.pode_fora_horario;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_proteger_fora_horario on public.profiles;
create trigger profiles_proteger_fora_horario
  before update on public.profiles
  for each row execute function public.profiles_proteger_fora_horario();


-- ---------- Horário de atendimento -------------------------------------
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
     and t.local::time <  time '17:00'
     and not exists (select 1 from public.feriados f where f.data = t.local::date)
    from t;
$fn$;

-- Pessoa da equipe que está bloqueada agora? (cliente e cron: nunca)
create or replace function public.equipe_bloqueada_agora()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select auth.uid() is not null
     and exists (select 1 from public.profiles p
                  where p.id = auth.uid()
                    and p.perfil in ('atendimento', 'gestor', 'admin')
                    and p.pode_fora_horario is not true)
     and not public.dentro_horario_atendimento(now());
$fn$;

revoke all on function public.dentro_horario_atendimento(timestamptz) from public, anon;
revoke all on function public.equipe_bloqueada_agora() from public, anon;
grant execute on function public.dentro_horario_atendimento(timestamptz) to authenticated;
grant execute on function public.equipe_bloqueada_agora() to authenticated;

create or replace function public.exigir_horario_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.equipe_bloqueada_agora() then
    raise exception 'Fora do horário de atendimento (segunda a sexta, 8h às 17h, horário de Porto Velho). Você pode consultar, mas responder e movimentar chamados agora só com autorização da gestão.'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$fn$;

-- "aa_" para rodar antes dos demais gatilhos (recusa logo de cara).
drop trigger if exists aa_horario_equipe on public.chamados;
create trigger aa_horario_equipe
  before insert or update on public.chamados
  for each row execute function public.exigir_horario_equipe();

drop trigger if exists aa_horario_equipe on public.chamado_mensagens;
create trigger aa_horario_equipe
  before insert on public.chamado_mensagens
  for each row execute function public.exigir_horario_equipe();

do $$
declare
  t text;
begin
  foreach t in array array['chamado_etapas', 'chamado_anexos', 'chamado_links'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists aa_horario_equipe on public.%I', t);
      execute format('create trigger aa_horario_equipe before insert or update or delete on public.%I
                        for each row execute function public.exigir_horario_equipe()', t);
    end if;
  end loop;
end $$;


-- ---------- Autorizados iniciais ---------------------------------------
update public.profiles
   set pode_fora_horario = true
 where perfil in ('atendimento', 'gestor', 'admin')
   and (nome ilike 'Priscila Vanzini%' or nome ilike 'Leonardo Guerra%');


-- ---------- Conferência -------------------------------------------------
select nome, perfil, pode_fora_horario
  from public.profiles
 where perfil in ('atendimento', 'gestor', 'admin') and ativo
 order by pode_fora_horario desc, nome;
