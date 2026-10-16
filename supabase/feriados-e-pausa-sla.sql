-- =====================================================================
-- Calendário de FERIADOS no SLA + correção da pausa "Aguardando cliente"
-- Rode no Supabase ("projeto ticket") -> SQL Editor -> cole tudo -> Run.
-- Pode rodar de novo sem problema (idempotente). Não apaga dados.
--
-- 1) CALENDÁRIO DE FERIADOS
--    ANTES:  horas úteis = seg-sex, 08-12h e 13-17h (Porto Velho), sem
--            feriados.
--    DEPOIS: dia cadastrado em public.feriados não conta hora útil.
--            Vale para o cálculo de prazo, retomada da pausa,
--            encerramento automático (24h úteis) e telas do portal.
--            Gestor/admin cadastram e removem; todos os usuários leem
--            (o cliente precisa ler para calcular o prazo ao abrir).
--    Carga inicial: feriados NACIONAIS de 2026 e 2027 (lei federal) +
--            Sexta-feira Santa. NÃO entram: Carnaval e Corpus Christi
--            (ponto facultativo) nem feriados estaduais de RO e
--            municipais de Porto Velho — o gestor cadastra os que a
--            empresa observa.
--
-- 2) FERIADO CADASTRADO COM CHAMADO EM ANDAMENTO ("conflito")
--    Ao cadastrar um feriado, todo chamado ainda aberto (inclusive em
--    "Aguardando cliente") cujo período abertura -> prazo passa por
--    aquele dia tem o prazo estendido pelas horas úteis do dia que
--    tinham sido contadas. A extensão já entra AUTORIZADA no programa
--    de estrelas (não penaliza o atendente).
--    Remover um feriado NÃO encurta prazos já estendidos.
--
-- 3) "AGUARDANDO CLIENTE" SEM INÍCIO DA PAUSA
--    Chamado que ficou em "Aguardando cliente" sem sla_pausado_em
--    (ex.: status mudado antes de existir o gatilho da pausa) era
--    tratado como relógio correndo. Correção: preenche sla_pausado_em
--    com a data em que o chamado entrou em "Aguardando cliente"
--    (histórico) ou, sem histórico, a última atualização.
--
-- 4) TROCA DE PRIORIDADE DEPOIS DE UMA PAUSA (caso do #150)
--    ANTES:  trocar a prioridade recalculava o prazo a partir da
--            abertura e APAGAVA as horas de espera do cliente que o
--            prazo já tinha recebido -> chamado aparecia atrasado.
--    DEPOIS: a tela passa a manter essas horas (lib/prazo.ts). Aqui,
--            os chamados abertos que já sofreram isso têm o prazo
--            refeito: abertura + SLA da prioridade atual + horas de
--            espera já registradas no histórico. Extensão já entra
--            autorizada nas estrelas.
-- =====================================================================


-- ---------- 1. Tabela de feriados ---------------------------------------
create table if not exists public.feriados (
  data         date primary key,
  descricao    text not null check (length(trim(descricao)) between 2 and 120),
  abrangencia  text not null default 'nacional'
               check (abrangencia in ('nacional', 'estadual', 'municipal', 'empresa')),
  criado_por   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

alter table public.feriados enable row level security;

drop policy if exists "Usuarios leem feriados" on public.feriados;
create policy "Usuarios leem feriados"
  on public.feriados for select
  to authenticated
  using (true);

drop policy if exists "Gestor cadastra feriados" on public.feriados;
create policy "Gestor cadastra feriados"
  on public.feriados for insert
  to authenticated
  with check (exists (select 1 from public.profiles p
                       where p.id = auth.uid()
                         and p.perfil in ('gestor', 'admin')
                         and coalesce(p.ativo, true)));

drop policy if exists "Gestor remove feriados" on public.feriados;
create policy "Gestor remove feriados"
  on public.feriados for delete
  to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid()
                    and p.perfil in ('gestor', 'admin')
                    and coalesce(p.ativo, true)));

grant select, insert, delete on public.feriados to authenticated;


-- ---------- 2. Horas úteis sem feriados ---------------------------------
create or replace function public.horas_uteis_entre(p_ini timestamptz, p_fim timestamptz)
returns numeric
language sql
stable
set search_path = public
as $fn$
  with dias as (
    select d::date as dia
    from generate_series((p_ini at time zone 'America/Porto_Velho')::date,
                         (p_fim at time zone 'America/Porto_Velho')::date,
                         interval '1 day') d
    where p_ini < p_fim
      and extract(isodow from d) <= 5
      and not exists (select 1 from public.feriados f where f.data = d::date)
  ),
  janelas as (
    select (dia + time '08:00') at time zone 'America/Porto_Velho' as j_ini,
           (dia + time '12:00') at time zone 'America/Porto_Velho' as j_fim from dias
    union all
    select (dia + time '13:00') at time zone 'America/Porto_Velho',
           (dia + time '17:00') at time zone 'America/Porto_Velho' from dias
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

  dia   := (p_ini at time zone 'America/Porto_Velho')::date;
  resto := p_horas * 3600;

  for i in 0..2000 loop
    if extract(isodow from dia) <= 5
       and not exists (select 1 from public.feriados f where f.data = dia) then
      for j in
        select * from (values (time '08:00', time '12:00'),
                              (time '13:00', time '17:00')) v(ini, fim)
      loop
        a := greatest((dia + j.ini) at time zone 'America/Porto_Velho', p_ini);
        b := (dia + j.fim) at time zone 'America/Porto_Velho';
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


-- ---------- 3. Feriado novo estende prazos em andamento -----------------
create or replace function public.feriado_ajustar_prazos()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c        record;
  v_horas  numeric;
  v_novo   timestamptz;
  v_alt    bigint;
  v_estrelas boolean := to_regclass('public.estrelas_prazo_alteracoes') is not null;
begin
  -- Fim de semana não tinha hora útil: nada a ajustar.
  if extract(isodow from new.data) > 5 then
    return new;
  end if;

  for c in
    select id, created_at, prazo_sla
      from public.chamados
     where status not in ('resolvido', 'encerrado')
       and prazo_sla is not null
       and created_at < (new.data + time '17:00') at time zone 'America/Porto_Velho'
       and prazo_sla  > (new.data + time '08:00') at time zone 'America/Porto_Velho'
     for update
  loop
    -- Horas úteis daquele dia que estavam dentro do período do chamado.
    select coalesce(sum(extract(epoch from (least(j_fim, c.prazo_sla) - greatest(j_ini, c.created_at)))) / 3600.0, 0)
      into v_horas
      from (values ((new.data + time '08:00') at time zone 'America/Porto_Velho',
                    (new.data + time '12:00') at time zone 'America/Porto_Velho'),
                   ((new.data + time '13:00') at time zone 'America/Porto_Velho',
                    (new.data + time '17:00') at time zone 'America/Porto_Velho')) v(j_ini, j_fim)
     where least(j_fim, c.prazo_sla) > greatest(j_ini, c.created_at);

    continue when v_horas <= 0;

    v_novo := public.somar_horas_uteis(c.prazo_sla, v_horas);
    continue when v_novo is null or v_novo <= c.prazo_sla;

    update public.chamados set prazo_sla = v_novo where id = c.id;

    begin
      insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
      values (c.id, 'sla', 'feriado', auth.uid(),
              'Prazo estendido em ' || round(v_horas, 1) || 'h uteis: feriado em '
              || to_char(new.data, 'DD/MM/YYYY') || ' (' || new.descricao || ')');
    exception when others then null;
    end;

    -- Programa de estrelas: a extensão por feriado já vale como autorizada.
    if v_estrelas then
      select max(a.id) into v_alt
        from public.estrelas_prazo_alteracoes a
       where a.chamado_id = c.id
         and a.prazo_anterior = c.prazo_sla
         and a.prazo_novo = v_novo
         and a.autorizado is null;

      if v_alt is not null then
        update public.estrelas_prazo_alteracoes
           set autorizado = true, decidido_por = auth.uid(), decidido_em = now(),
               justificativa = 'Feriado ' || to_char(new.data, 'DD/MM/YYYY') || ' - ' || new.descricao
         where id = v_alt;
      end if;
    end if;
  end loop;

  return new;
end;
$fn$;

drop trigger if exists feriado_ajustar_prazos on public.feriados;
create trigger feriado_ajustar_prazos
  after insert on public.feriados
  for each row execute function public.feriado_ajustar_prazos();


-- ---------- 4. Carga inicial (feriados nacionais 2026-2027) -------------
-- Roda DEPOIS do gatilho: chamados abertos que passam por estes dias
-- já recebem a extensão.
insert into public.feriados (data, descricao, abrangencia, criado_por) values
  ('2026-01-01', 'Confraternização Universal', 'nacional', null),
  ('2026-04-03', 'Paixão de Cristo (Sexta-feira Santa)', 'nacional', null),
  ('2026-04-21', 'Tiradentes', 'nacional', null),
  ('2026-05-01', 'Dia do Trabalho', 'nacional', null),
  ('2026-09-07', 'Independência do Brasil', 'nacional', null),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional', null),
  ('2026-11-02', 'Finados', 'nacional', null),
  ('2026-11-15', 'Proclamação da República', 'nacional', null),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional', null),
  ('2026-12-25', 'Natal', 'nacional', null),
  ('2027-01-01', 'Confraternização Universal', 'nacional', null),
  ('2027-03-26', 'Paixão de Cristo (Sexta-feira Santa)', 'nacional', null),
  ('2027-04-21', 'Tiradentes', 'nacional', null),
  ('2027-05-01', 'Dia do Trabalho', 'nacional', null),
  ('2027-09-07', 'Independência do Brasil', 'nacional', null),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional', null),
  ('2027-11-02', 'Finados', 'nacional', null),
  ('2027-11-15', 'Proclamação da República', 'nacional', null),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional', null),
  ('2027-12-25', 'Natal', 'nacional', null)
on conflict (data) do nothing;


-- ---------- 5. "Aguardando cliente" sem início da pausa -----------------
update public.chamados c
   set sla_pausado_em = coalesce(
         (select max(e.created_at) from public.chamado_eventos e
           where e.chamado_id = c.id and e.tipo = 'status' and e.para = 'aguardando_cliente'),
         c.updated_at, now())
 where c.status = 'aguardando_cliente'
   and c.sla_pausado_em is null;


-- ---------- 6. Prioridade trocada depois de pausa (ex.: #150) ----------
do $$
declare
  c        record;
  v_novo   timestamptz;
  v_alt    bigint;
begin
  for c in
    select ch.id, ch.numero, ch.created_at, ch.prazo_sla, ch.prioridade,
           (select coalesce(sum(substring(e.observacao from 'estendido em ([0-9.]+)h')::numeric), 0)
              from public.chamado_eventos e
             where e.chamado_id = ch.id and e.tipo = 'sla' and e.para = 'retomado') as espera
      from public.chamados ch
     where ch.status in ('aberto', 'em_atendimento', 'aguardando_cliente')
       and exists (
         select 1 from public.chamado_eventos p
          where p.chamado_id = ch.id and p.tipo = 'prioridade'
            and p.created_at > (select min(r.created_at) from public.chamado_eventos r
                                 where r.chamado_id = ch.id and r.tipo = 'sla' and r.para = 'retomado'))
  loop
    v_novo := public.somar_horas_uteis(
      c.created_at,
      case c.prioridade when 'baixa' then 48 when 'alta' then 8 when 'urgente' then 4 else 24 end
      + c.espera);

    continue when v_novo is null or c.prazo_sla is null or v_novo <= c.prazo_sla;

    update public.chamados set prazo_sla = v_novo where id = c.id;
    raise notice 'Chamado #%: prazo % -> % (devolvidas % h de espera)', c.numero, c.prazo_sla, v_novo, c.espera;

    begin
      insert into public.chamado_eventos (chamado_id, tipo, para, observacao)
      values (c.id, 'sla', 'corrigido',
              'Prazo corrigido: troca de prioridade tinha descartado ' || c.espera || 'h uteis de espera do cliente');
    exception when others then null;
    end;

    if to_regclass('public.estrelas_prazo_alteracoes') is not null then
      select max(a.id) into v_alt from public.estrelas_prazo_alteracoes a
       where a.chamado_id = c.id and a.prazo_novo = v_novo and a.autorizado is null;
      if v_alt is not null then
        update public.estrelas_prazo_alteracoes
           set autorizado = true, decidido_em = now(),
               justificativa = 'Correcao: espera do cliente descartada na troca de prioridade'
         where id = v_alt;
      end if;
    end if;
  end loop;
end;
$$;


-- Conferência:
-- select * from public.feriados order by data;
-- select round(public.horas_uteis_entre('2026-11-19 08:00-04', '2026-11-21 08:00-04'), 1); -- 8 (20/11 não conta)
-- select count(*) from public.chamados where status = 'aguardando_cliente' and sla_pausado_em is null; -- 0
