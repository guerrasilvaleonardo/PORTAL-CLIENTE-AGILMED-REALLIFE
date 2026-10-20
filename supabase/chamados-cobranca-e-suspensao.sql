-- =====================================================================
-- Chamados: COBRANÇA DO CLIENTE e ATENDIMENTO SUSPENSO
-- Rode no Supabase ("projeto ticket") -> SQL Editor, DEPOIS de
-- chamados-leitura.sql. Pode rodar mais de uma vez.
--
-- Decisões (19/10/2026):
--   Cobrança: só chamados em "Aguardando cliente". Prazo por empresa
--     (padrão 7 dias corridos parados). E-mail no 1º dia útil depois do
--     prazo e repetido a cada 3 dias úteis até o cliente responder.
--     Painel do cliente pisca em vermelho. Empresa interna fica fora.
--   Atendimento suspenso: nova situação. Motivo, observação e próxima
--     atualização obrigatórios. O SLA pausa na hora e o prazo é
--     estendido nas horas úteis suspensas quando o atendimento volta.
--     Para as ESTRELAS a extensão entra "Aguardando gestor": só vale se
--     o gestor autorizar (mesma tela de hoje). O cliente vê a situação,
--     o motivo e a próxima atualização; a observação é só da equipe.
--
-- ANTES -> DEPOIS (o que este script altera)
--   empresas: + dias_cobranca (padrão 7). Nenhum dado existente muda.
--   chamados: + suspenso_em, suspensao_motivo, suspensao_proxima.
--             status passa a aceitar 'suspenso' (se houver regra/enum).
--   estrelas_prazo_alteracoes.origem: aceita também 'suspensao'.
--   Novas tabelas: chamado_cobrancas, chamado_suspensoes.
--   Novas funções: cobrancas_pendentes, suspender_chamado,
--     cobranca_limite_dias e o gatilho zy_chamado_suspensao.
--   Novos textos de mensagem automática: 'suspenso' e 'retomado'
--     (só insere se ainda não existirem).
--   Não apaga nada.
-- =====================================================================


-- ---------- 1. Cobrança: prazo por empresa ----------------------------
alter table public.empresas
  add column if not exists dias_cobranca integer not null default 7;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'empresas_dias_cobranca_check'
                    and conrelid = 'public.empresas'::regclass) then
    alter table public.empresas
      add constraint empresas_dias_cobranca_check check (dias_cobranca between 1 and 60);
  end if;
end $$;

-- Histórico de e-mails de cobrança (gravado pelo servidor).
create table if not exists public.chamado_cobrancas (
  id             bigserial primary key,
  chamado_id     uuid not null references public.chamados (id) on delete cascade,
  enviada_em     timestamptz not null default now(),
  destinatarios  integer not null default 0
);

create index if not exists chamado_cobrancas_chamado
  on public.chamado_cobrancas (chamado_id, enviada_em desc);

alter table public.chamado_cobrancas enable row level security;

drop policy if exists "Equipe ve cobrancas" on public.chamado_cobrancas;
create policy "Equipe ve cobrancas" on public.chamado_cobrancas
  for select to authenticated using (public.estrelas_eh_equipe());

grant select on public.chamado_cobrancas to authenticated;
revoke insert, update, delete on public.chamado_cobrancas from anon, authenticated;

-- Dias para cobrar (null = empresa interna, sem cobrança).
create or replace function public.cobranca_limite_dias(p_empresa uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select case when e.interna then null else e.dias_cobranca end
    from public.empresas e
   where e.id = p_empresa;
$fn$;

revoke all on function public.cobranca_limite_dias(uuid) from public, anon;
grant execute on function public.cobranca_limite_dias(uuid) to authenticated;

-- Chamados que esperam o cliente além do prazo. Roda com as permissões
-- de quem chama: o cliente só recebe chamados que ele já enxerga.
create or replace function public.cobrancas_pendentes()
returns table (id uuid, numero integer, assunto text, aguardando_desde timestamptz,
               dias integer, limite_dias integer)
language sql
stable
security invoker
set search_path = public
as $fn$
  select x.id, x.numero, x.assunto, x.desde, x.dias, x.limite
    from (
      select c.id, c.numero::integer as numero, c.assunto,
             c.sla_pausado_em as desde,
             floor(extract(epoch from (now() - c.sla_pausado_em)) / 86400)::integer as dias,
             public.cobranca_limite_dias(c.empresa_id) as limite
        from public.chamados c
       where c.status = 'aguardando_cliente'
         and c.sla_pausado_em is not null
    ) x
   where x.limite is not null
     and x.desde <= now() - make_interval(days => x.limite)
   order by x.desde;
$fn$;

revoke all on function public.cobrancas_pendentes() from public, anon;
grant execute on function public.cobrancas_pendentes() to authenticated;


-- ---------- 2. Situação 'suspenso' --------------------------------------
-- Se a coluna status for enum, acrescenta o valor; se houver regra
-- (check) listando as situações, recria a regra com 'suspenso'.
do $$
declare
  v_tipo text;
  v_udt  text;
  r      record;
  v_def  text;
begin
  select data_type, udt_name into v_tipo, v_udt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'chamados' and column_name = 'status';

  if v_tipo = 'USER-DEFINED' then
    execute format('alter type public.%I add value if not exists %L', v_udt, 'suspenso');
  end if;

  for r in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.chamados'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%aguardando_cliente%'
       and pg_get_constraintdef(oid) not like '%suspenso%'
  loop
    v_def := replace(r.def, '''aguardando_cliente''::text',
                     '''aguardando_cliente''::text, ''suspenso''::text');
    if v_def = r.def then
      raise exception 'Regra % em chamados tem formato inesperado: %. Ajuste manual necessário.',
        r.conname, r.def;
    end if;
    execute format('alter table public.chamados drop constraint %I', r.conname);
    execute format('alter table public.chamados add constraint %I %s', r.conname, v_def);
    raise notice 'Regra % atualizada: %', r.conname, v_def;
  end loop;
end $$;

alter table public.chamados
  add column if not exists suspenso_em       timestamptz,
  add column if not exists suspensao_motivo  text,
  add column if not exists suspensao_proxima date;

-- Registro completo de cada suspensão (observação é só da equipe).
create table if not exists public.chamado_suspensoes (
  id                  bigserial primary key,
  chamado_id          uuid not null references public.chamados (id) on delete cascade,
  motivo              text not null check (char_length(btrim(motivo)) between 3 and 120),
  observacao          text not null check (char_length(btrim(observacao)) between 10 and 2000),
  proxima_atualizacao date not null,
  status_anterior     text not null,
  inicio              timestamptz not null default now(),
  fim                 timestamptz,
  horas_uteis         numeric,
  solicitado_por      uuid references public.profiles (id) on delete set null,
  encerrado_por       uuid references public.profiles (id) on delete set null
);

create index if not exists chamado_suspensoes_chamado
  on public.chamado_suspensoes (chamado_id, inicio desc);
create unique index if not exists chamado_suspensoes_uma_aberta
  on public.chamado_suspensoes (chamado_id) where fim is null;

alter table public.chamado_suspensoes enable row level security;

drop policy if exists "Equipe ve suspensoes" on public.chamado_suspensoes;
create policy "Equipe ve suspensoes" on public.chamado_suspensoes
  for select to authenticated using (public.estrelas_eh_equipe());

grant select on public.chamado_suspensoes to authenticated;
revoke insert, update, delete on public.chamado_suspensoes from anon, authenticated;

-- Extensão por suspensão entra na fila de decisão do gestor.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.estrelas_prazo_alteracoes'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%origem%'
       and pg_get_constraintdef(oid) not like '%suspensao%'
  loop
    execute format('alter table public.estrelas_prazo_alteracoes drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.estrelas_prazo_alteracoes'::regclass
                    and conname = 'estrelas_prazo_alteracoes_origem_check') then
    alter table public.estrelas_prazo_alteracoes
      add constraint estrelas_prazo_alteracoes_origem_check
      check (origem in ('prioridade', 'manual', 'suspensao'));
  end if;
end $$;

-- Textos automáticos (não sobrescreve se já existirem/forem editados).
-- Marcadores: {numero}, {assunto}, {motivo}, {proxima}.
insert into public.chamado_mensagens_modelo (gatilho, texto) values
('suspenso',
 E'O atendimento do chamado #{numero} foi suspenso temporariamente.\n\nMotivo: {motivo}\nPróxima atualização prevista: {proxima}\n\nEnquanto a suspensão durar, o prazo de atendimento fica pausado. Avisaremos por aqui assim que o atendimento for retomado.'),
('retomado',
 E'O atendimento do chamado #{numero} foi retomado. Seguimos com a sua solicitação e voltaremos com novidades por aqui.')
on conflict (gatilho) do nothing;

create or replace function public.mensagem_suspensao(p_chamado uuid, p_gatilho text,
                                                     p_motivo text, p_proxima date)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  modelo text;
  c record;
begin
  select texto into modelo from public.chamado_mensagens_modelo
   where gatilho = p_gatilho and ativo;
  if modelo is null then return; end if;

  select numero, assunto into c from public.chamados where id = p_chamado;

  insert into public.chamado_mensagens (chamado_id, autor_id, mensagem, automatica)
  values (p_chamado, null,
          replace(replace(replace(replace(modelo,
            '{numero}', coalesce(c.numero::text, '')),
            '{assunto}', coalesce(c.assunto, '')),
            '{motivo}', coalesce(p_motivo, '')),
            '{proxima}', coalesce(to_char(p_proxima, 'DD/MM/YYYY'), 'a definir')),
          true);
exception when others then
  raise warning 'Mensagem de suspensao nao enviada (%): %', p_gatilho, sqlerrm;
end;
$fn$;

revoke all on function public.mensagem_suspensao(uuid, text, text, date) from public, anon, authenticated;


-- ---------- 3. Suspender (único caminho para 'suspenso') ---------------
create or replace function public.suspender_chamado(p_chamado uuid, p_motivo text,
                                                    p_observacao text, p_proxima date)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c record;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_obs    text := btrim(coalesce(p_observacao, ''));
  v_hoje   date := (now() at time zone 'America/Porto_Velho')::date;
begin
  if not public.estrelas_eh_equipe() then
    raise exception 'Somente a equipe de atendimento pode suspender um chamado.';
  end if;
  if char_length(v_motivo) < 3 then raise exception 'Informe o motivo da suspensão.'; end if;
  if char_length(v_obs) < 10 then
    raise exception 'Descreva o problema e a condição para retomar (mínimo de 10 caracteres).';
  end if;
  if p_proxima is null or p_proxima < v_hoje then
    raise exception 'Informe a data prevista da próxima atualização (hoje ou depois).';
  end if;

  select id, status into c from public.chamados where id = p_chamado for update;
  if not found then raise exception 'Chamado não encontrado.'; end if;
  if c.status not in ('aberto', 'em_atendimento', 'aguardando_cliente') then
    raise exception 'Só é possível suspender chamado em aberto (situação atual: %).', c.status;
  end if;

  insert into public.chamado_suspensoes
         (chamado_id, motivo, observacao, proxima_atualizacao, status_anterior, solicitado_por)
  values (p_chamado, v_motivo, v_obs, p_proxima, c.status, auth.uid());

  update public.chamados
     set status = 'suspenso'
   where id = p_chamado;

  begin
    insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
    values (p_chamado, 'suspensao', 'suspenso', auth.uid(),
            'Motivo: ' || v_motivo || ' · próxima atualização ' || to_char(p_proxima, 'DD/MM/YYYY'));
  exception when others then null;
  end;
end;
$fn$;

revoke all on function public.suspender_chamado(uuid, text, text, date) from public, anon;
grant execute on function public.suspender_chamado(uuid, text, text, date) to authenticated;


-- ---------- 4. Gatilho: entrada e saída de 'suspenso' -------------------
-- Nome "zy_" para rodar depois dos gatilhos de SLA e antes do
-- zz_estrelas_chamado_antes. Usa colunas próprias (suspenso_em), sem
-- mexer em sla_pausado_em, que é da pausa "Aguardando cliente".
create or replace function public.chamado_suspensao_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s      public.chamado_suspensoes%rowtype;
  v_h    numeric;
  v_novo timestamptz;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Entrando em suspensão: exige o registro feito por suspender_chamado.
  if new.status = 'suspenso' then
    select * into s from public.chamado_suspensoes
     where chamado_id = new.id and fim is null
     order by inicio desc limit 1;
    if not found then
      raise exception 'Para suspender, use "Suspender atendimento" e informe motivo, observação e próxima atualização.';
    end if;
    new.suspenso_em       := s.inicio;
    new.suspensao_motivo  := s.motivo;
    new.suspensao_proxima := s.proxima_atualizacao;
    return new;
  end if;

  -- Saindo da suspensão: estende o prazo pelas horas úteis suspensas.
  if old.status = 'suspenso' then
    select * into s from public.chamado_suspensoes
     where chamado_id = new.id and fim is null
     order by inicio desc limit 1 for update;

    if found then
      v_h := coalesce(public.horas_uteis_entre(s.inicio, now()), 0);

      if new.prazo_sla is not null and v_h > 0 then
        v_novo := public.somar_horas_uteis(new.prazo_sla, v_h);
        if v_novo is not null and v_novo > new.prazo_sla then
          -- Para as estrelas: pendente de decisão do gestor. alterado_em =
          -- início da suspensão, para a regra "prazo já vencido" olhar o
          -- momento em que a suspensão começou.
          insert into public.estrelas_prazo_alteracoes
                 (chamado_id, prazo_anterior, prazo_novo, origem, alterado_por, alterado_em)
          values (new.id, new.prazo_sla, v_novo, 'suspensao', s.solicitado_por, s.inicio);
          new.prazo_sla := v_novo;
        end if;
      end if;

      update public.chamado_suspensoes
         set fim = now(), horas_uteis = round(v_h, 2), encerrado_por = auth.uid()
       where id = s.id;
    end if;

    new.suspenso_em       := null;
    new.suspensao_motivo  := null;
    new.suspensao_proxima := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists zy_chamado_suspensao on public.chamados;
create trigger zy_chamado_suspensao
  before update of status on public.chamados
  for each row execute function public.chamado_suspensao_antes();

-- Depois: mensagem automática ao cliente.
create or replace function public.chamado_suspensao_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status is distinct from old.status then
    if new.status = 'suspenso' then
      perform public.mensagem_suspensao(new.id, 'suspenso', new.suspensao_motivo, new.suspensao_proxima);
    elsif old.status = 'suspenso' and new.status in ('aberto', 'em_atendimento') then
      perform public.mensagem_suspensao(new.id, 'retomado', null, null);
    end if;
  end if;
  return null;
end;
$fn$;

drop trigger if exists zy_chamado_suspensao_depois on public.chamados;
create trigger zy_chamado_suspensao_depois
  after update of status on public.chamados
  for each row execute function public.chamado_suspensao_depois();


-- ---------- Conferência -------------------------------------------------
-- select id, nome_fantasia, interna, dias_cobranca from public.empresas order by 2;
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.chamados'::regclass and contype = 'c';
