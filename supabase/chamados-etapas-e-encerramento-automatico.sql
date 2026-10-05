-- =====================================================================
-- Chamados: ETAPAS (sublista com % de conclusão) + ENCERRAMENTO AUTOMÁTICO
-- Rode no Supabase -> SQL Editor. Pode rodar mais de uma vez.
--
-- Pré-requisito: supabase/sla-pausa-horas-uteis.sql já aplicado
-- (usa public.horas_uteis_entre e public.somar_horas_uteis).
--
-- O que este script FAZ:
--   1. Cria a tabela chamado_etapas (sublista do chamado) com RLS:
--        equipe interna lê e edita tudo; cliente só LÊ as etapas
--        marcadas como visíveis, e só dos chamados que ele já enxerga.
--   2. Cria a view v_chamados_progresso (total, concluídas, %).
--   3. Mensagem do CLIENTE em chamado "Resolvido" -> volta para
--        "Em atendimento" (é o que o portal já promete ao cliente).
--   4. Saída de "Resolvido" para um status em aberto: o prazo do SLA
--        é estendido pelas horas úteis em que ficou resolvido (mesma
--        lógica da pausa "Aguardando cliente") e resolvido_em é limpo.
--        O histórico continua em chamado_eventos.
--   5. Função encerrar_chamados_resolvidos(24): "Resolvido" há 24 horas
--        úteis ou mais -> "Encerrado".
--   6. Agenda essa função no pg_cron, de hora em hora (minuto 05).
--
-- O que este script NÃO faz:
--   - não apaga nem altera dados existentes;
--   - não altera a função registrar_mudanca_chamado (fica igual);
--   - não mexe em chamados "Resolvido" sem resolvido_em (veja a
--     consulta de conferência no final).
-- =====================================================================

do $$
begin
  if to_regprocedure('public.horas_uteis_entre(timestamptz, timestamptz)') is null
     or to_regprocedure('public.somar_horas_uteis(timestamptz, numeric)') is null then
    raise exception 'Rode antes o supabase/sla-pausa-horas-uteis.sql (funções de horas úteis).';
  end if;
end
$$;


-- ---------- 1. Tabela de etapas ---------------------------------------
-- O tipo de chamados.id é lido do banco para a FK casar (uuid ou bigint).
do $$
declare
  tipo_id text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_id
  from pg_attribute a
  where a.attrelid = 'public.chamados'::regclass
    and a.attname = 'id';

  execute format($f$
    create table if not exists public.chamado_etapas (
      id               bigint generated always as identity primary key,
      chamado_id       %s not null
                         references public.chamados (id) on delete cascade,
      titulo           text not null check (length(btrim(titulo)) between 1 and 200),
      ordem            integer not null default 0,
      concluida        boolean not null default false,
      visivel_cliente  boolean not null default true,
      concluida_em     timestamptz,
      concluida_por    uuid references public.profiles (id) on delete set null,
      criado_por       uuid references public.profiles (id) on delete set null,
      created_at       timestamptz not null default now(),
      updated_at       timestamptz not null default now()
    )$f$, tipo_id);
end
$$;

create index if not exists chamado_etapas_chamado
  on public.chamado_etapas (chamado_id, ordem, id);

alter table public.chamado_etapas enable row level security;

-- Permissão de tabela; quem pode o quê é decidido pela RLS abaixo.
grant select, insert, update, delete on public.chamado_etapas to authenticated;

drop policy if exists chamado_etapas_equipe_tudo on public.chamado_etapas;
create policy chamado_etapas_equipe_tudo
  on public.chamado_etapas
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.ativo = true
        and p.perfil in ('atendimento', 'gestor', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.ativo = true
        and p.perfil in ('atendimento', 'gestor', 'admin')
    )
  );

-- Cliente: só leitura, só etapas visíveis, só de chamados que a RLS de
-- chamados já libera para ele (a subconsulta respeita essa RLS).
drop policy if exists chamado_etapas_cliente_leitura on public.chamado_etapas;
create policy chamado_etapas_cliente_leitura
  on public.chamado_etapas
  for select to authenticated
  using (
    visivel_cliente = true
    and exists (
      select 1 from public.chamados c
      where c.id = chamado_etapas.chamado_id
    )
  );


-- ---------- Carimbo de conclusão e de atualização ---------------------
create or replace function public.chamado_etapas_carimbo()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
  end if;

  if new.concluida and (tg_op = 'INSERT' or not old.concluida) then
    new.concluida_em  := now();
    new.concluida_por := auth.uid();
  elsif not new.concluida then
    new.concluida_em  := null;
    new.concluida_por := null;
  end if;

  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists chamado_etapas_carimbo on public.chamado_etapas;
create trigger chamado_etapas_carimbo
  before insert or update on public.chamado_etapas
  for each row execute function public.chamado_etapas_carimbo();


-- ---------- Histórico das etapas em chamado_eventos -------------------
-- Protegido: se chamado_eventos recusar o tipo 'etapa', a etapa é
-- salva do mesmo jeito (o histórico é complementar).
create or replace function public.chamado_etapas_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  acao text;
  alvo record;
begin
  if tg_op = 'DELETE' then
    alvo := old;
    acao := 'removida';
  elsif tg_op = 'INSERT' then
    alvo := new;
    acao := case when new.concluida then 'concluida' else 'criada' end;
  elsif new.concluida is distinct from old.concluida then
    alvo := new;
    acao := case when new.concluida then 'concluida' else 'reaberta' end;
  else
    return null;
  end if;

  begin
    insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id, observacao)
    values (alvo.chamado_id, 'etapa', alvo.titulo, acao, auth.uid(), null);
  exception when others then
    null;
  end;

  return null;
end;
$fn$;

drop trigger if exists chamado_etapas_historico on public.chamado_etapas;
create trigger chamado_etapas_historico
  after insert or update or delete on public.chamado_etapas
  for each row execute function public.chamado_etapas_historico();


-- ---------- 2. Progresso por chamado ----------------------------------
-- security_invoker: a equipe vê o % sobre todas as etapas; o cliente,
-- sobre as etapas visíveis (é o que a RLS deixa ele contar).
create or replace view public.v_chamados_progresso
with (security_invoker = true) as
select
  e.chamado_id,
  count(*)::int                                   as total,
  count(*) filter (where e.concluida)::int        as concluidas,
  round(100.0 * count(*) filter (where e.concluida) / count(*))::int as percentual
from public.chamado_etapas e
group by e.chamado_id;

grant select on public.v_chamados_progresso to authenticated;


-- ---------- 3. Mensagem do cliente reabre chamado "Resolvido" ---------
create or replace function public.reabrir_chamado_por_mensagem_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if exists (
       select 1 from public.profiles p
       where p.id = new.autor_id
         and p.perfil = 'cliente'
     ) then
    update public.chamados
       set status = 'em_atendimento'
     where id = new.chamado_id
       and status = 'resolvido';
  end if;

  return null;
end;
$fn$;

drop trigger if exists reabrir_chamado_por_mensagem_cliente on public.chamado_mensagens;
create trigger reabrir_chamado_por_mensagem_cliente
  after insert on public.chamado_mensagens
  for each row execute function public.reabrir_chamado_por_mensagem_cliente();


-- ---------- 4. Saída de "Resolvido": estende o SLA e limpa a data -----
create or replace function public.chamado_saida_de_resolvido()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  espera_util numeric;
begin
  if old.status = 'resolvido'
     and new.status in ('aberto', 'em_atendimento', 'aguardando_cliente') then

    if old.resolvido_em is not null and new.prazo_sla is not null then
      espera_util := public.horas_uteis_entre(old.resolvido_em, now());
      new.prazo_sla := public.somar_horas_uteis(new.prazo_sla, espera_util);

      insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
      values (new.id, 'sla', 'retomado', auth.uid(),
              'Chamado reaberto; prazo estendido em ' || round(espera_util, 1)
              || 'h uteis em que ficou resolvido');
    end if;

    new.resolvido_em := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists chamado_saida_de_resolvido on public.chamados;
create trigger chamado_saida_de_resolvido
  before update of status on public.chamados
  for each row execute function public.chamado_saida_de_resolvido();


-- ---------- 5. Encerramento automático --------------------------------
create or replace function public.encerrar_chamados_resolvidos(p_horas_uteis numeric default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c record;
  total integer := 0;
begin
  for c in
    select ch.id
      from public.chamados ch
     where ch.status = 'resolvido'
       and ch.resolvido_em is not null
       and public.horas_uteis_entre(ch.resolvido_em, now()) >= p_horas_uteis
       -- Defesa extra: cliente escreveu depois de resolvido? Não encerra.
       and not exists (
             select 1
               from public.chamado_mensagens m
               join public.profiles p on p.id = m.autor_id
              where m.chamado_id = ch.id
                and p.perfil = 'cliente'
                and m.created_at > ch.resolvido_em
           )
     for update of ch skip locked
  loop
    update public.chamados
       set status = 'encerrado',
           encerrado_em = now()
     where id = c.id
       and status = 'resolvido';

    begin
      insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
      values (c.id, 'automacao', 'encerrado', null,
              'Encerrado automaticamente apos ' || p_horas_uteis
              || 'h uteis em Resolvido sem retorno do cliente');
    exception when others then
      null;
    end;

    total := total + 1;
  end loop;

  return total;
end;
$fn$;

revoke all on function public.encerrar_chamados_resolvidos(numeric) from public, anon, authenticated;


-- ---------- 6. Agenda no pg_cron (de hora em hora, minuto 05) ---------
-- Se der erro aqui: Supabase -> Integrations -> Cron -> Enable, e rode
-- de novo só este bloco.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobid)
     from cron.job
    where jobname = 'encerrar-chamados-resolvidos';

  perform cron.schedule(
    'encerrar-chamados-resolvidos',
    '5 * * * *',
    'select public.encerrar_chamados_resolvidos(24)'
  );
end
$$;


-- =====================================================================
-- CONFERÊNCIA (rode à parte, se quiser)
--
-- a) Chamados "Resolvido" SEM resolvido_em (o automático ignora):
--    select id, numero, assunto, updated_at from public.chamados
--     where status = 'resolvido' and resolvido_em is null;
--
-- b) Quem será encerrado na próxima rodada:
--    select id, numero, resolvido_em,
--           round(public.horas_uteis_entre(resolvido_em, now()), 1) as h_uteis
--      from public.chamados
--     where status = 'resolvido' and resolvido_em is not null
--     order by resolvido_em;
--
-- c) Histórico das execuções do agendamento:
--    select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'encerrar-chamados-resolvidos')
--     order by start_time desc limit 20;
-- =====================================================================
