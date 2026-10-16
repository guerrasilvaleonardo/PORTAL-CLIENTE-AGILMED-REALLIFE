-- =====================================================================
-- PROGRAMA DE RECONHECIMENTO POR ESTRELAS (atendimento de chamados)
--
-- Cada chamado gera no máximo 3 estrelas para o atendente que o resolveu:
--   * 1 estrela se resolvido dentro do prazo (resolução no limite exato
--     conta como dentro);
--   * bônus pela avaliação do cliente: Bom (nota 2) = +1, Excelente
--     (nota 3) = +2, Ruim (nota 1) ou sem avaliação = 0.
--
-- Princípios:
--   * Todo cálculo e toda permissão ficam no banco (funções SECURITY
--     DEFINER). Ninguém grava estrelas ou avaliações direto nas tabelas.
--   * Um lançamento por chamado (chave primária = chamado_id): repetir
--     eventos, atualizar a página ou reprocessar nunca duplica estrelas.
--   * O SLA do portal continua exatamente como era (pausa automática em
--     "Aguardando cliente", sem feriados, seg-sex 08-12h/13-17h,
--     horário de Brasília). Este script só OBSERVA o SLA.
--   * Alterações de prazo feitas sem mudança de status (ex.: troca de
--     prioridade) são registradas. Para as estrelas, uma EXTENSÃO de
--     prazo só vale se um gestor autorizar, e nunca se o prazo antigo já
--     tinha vencido no momento da alteração.
--   * O horário de resolução passa a ser o do servidor (now()), não o
--     do navegador.
--
-- Rode no Supabase: SQL Editor -> cole tudo -> Run. Pode rodar de novo
-- sem problema (idempotente).
-- =====================================================================


-- ---------- 0. Funções de apoio (perfis) ------------------------------
create or replace function public.estrelas_perfil()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select p.perfil
    from public.profiles p
   where p.id = auth.uid()
     and coalesce(p.ativo, true);
$fn$;

create or replace function public.estrelas_eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(public.estrelas_perfil() in ('atendimento', 'gestor', 'admin'), false);
$fn$;

create or replace function public.estrelas_eh_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(public.estrelas_perfil() in ('gestor', 'admin'), false);
$fn$;


-- ---------- 1. Configuração (linha única) -----------------------------
create table if not exists public.estrelas_config (
  id                    boolean primary key default true check (id),
  ativo                 boolean not null default false,
  data_inicio           date,
  prazo_avaliacao_dias  integer check (prazo_avaliacao_dias between 1 and 365),
  alerta_prazo_horas    numeric not null default 1
                        check (alerta_prazo_horas > 0 and alerta_prazo_horas <= 40),
  regra_versao          integer not null default 1,
  estrelas_prazo        smallint not null default 1 check (estrelas_prazo between 0 and 1),
  bonus_bom             smallint not null default 1 check (bonus_bom between 0 and 2),
  bonus_excelente       smallint not null default 2 check (bonus_excelente between 0 and 2),
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid
);

insert into public.estrelas_config (id) values (true) on conflict (id) do nothing;

-- Fechamento anual (uma linha por ano).
create table if not exists public.estrelas_fechamentos (
  ano              integer primary key check (ano between 2020 and 2100),
  data_fechamento  date not null,
  definido_por     uuid,
  definido_em      timestamptz not null default now(),
  fechado_em       timestamptz,
  fechado_por      uuid,
  classificacao    jsonb
);


-- ---------- 2. Avaliação do cliente (1 por chamado) -------------------
-- nota: 1 = Ruim, 2 = Bom, 3 = Excelente (escala do CLIENTE, não é
-- a quantidade de estrelas do ranking).
create table if not exists public.chamado_avaliacoes (
  chamado_id              uuid primary key references public.chamados(id) on delete cascade,
  nota                    smallint not null check (nota between 1 and 3),
  comentario              text check (comentario is null or char_length(comentario) <= 2000),
  autor_id                uuid not null references public.profiles(id),
  created_at              timestamptz not null default now(),
  acompanhado_em          timestamptz,
  acompanhado_por         uuid references public.profiles(id),
  acompanhamento          text
);


-- ---------- 3. Lançamento de estrelas (1 por chamado) -----------------
create table if not exists public.estrelas_lancamentos (
  chamado_id          uuid primary key references public.chamados(id) on delete cascade,
  atendente_id        uuid not null references public.profiles(id),
  resolvido_em        timestamptz not null,
  prazo_referencia    timestamptz,
  dentro_prazo        boolean,
  estrelas_prazo      smallint not null default 0 check (estrelas_prazo between 0 and 1),
  nota                smallint check (nota between 1 and 3),
  estrelas_avaliacao  smallint not null default 0 check (estrelas_avaliacao between 0 and 2),
  situacao            text not null default 'valida'
                      check (situacao in ('valida', 'suspensa', 'estornada')),
  motivo              text,
  regras              jsonb not null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists estrelas_lancamentos_atendente_idx
  on public.estrelas_lancamentos (atendente_id, resolvido_em);
create index if not exists estrelas_lancamentos_resolvido_idx
  on public.estrelas_lancamentos (resolvido_em);


-- ---------- 4. Histórico / auditoria ----------------------------------
-- tipo: concessao, avaliacao, recalculo, suspensa, restabelecida,
--       estornada, prazo_alterado, prazo_decidido, config, fechamento,
--       acompanhamento
create table if not exists public.estrelas_eventos (
  id             bigserial primary key,
  chamado_id     uuid references public.chamados(id) on delete cascade,
  atendente_id   uuid references public.profiles(id),
  tipo           text not null,
  antes          jsonb,
  depois         jsonb,
  motivo         text,
  autor_id       uuid references public.profiles(id) on delete set null,
  comemorar      text check (comemorar in ('prazo', 'avaliacao')),
  comemorado_em  timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists estrelas_eventos_atendente_idx
  on public.estrelas_eventos (atendente_id, created_at desc);
create index if not exists estrelas_eventos_chamado_idx
  on public.estrelas_eventos (chamado_id, created_at);


-- ---------- 5. Alterações de prazo (sem mudança de status) ------------
create table if not exists public.estrelas_prazo_alteracoes (
  id              bigserial primary key,
  chamado_id      uuid not null references public.chamados(id) on delete cascade,
  prazo_anterior  timestamptz not null,
  prazo_novo      timestamptz not null,
  origem          text not null check (origem in ('prioridade', 'manual')),
  alterado_por    uuid,
  alterado_em     timestamptz not null default now(),
  autorizado      boolean,          -- null = pendente
  decidido_por    uuid,
  decidido_em     timestamptz,
  justificativa   text
);

create index if not exists estrelas_prazo_alteracoes_chamado_idx
  on public.estrelas_prazo_alteracoes (chamado_id);


-- ---------- 6. Última posição vista (mensagem "Você subiu") -----------
create table if not exists public.estrelas_posicoes_vistas (
  usuario_id  uuid not null references public.profiles(id) on delete cascade,
  periodo     text not null,   -- 'mes:2026-10' ou 'ano:2026'
  posicao     integer not null,
  visto_em    timestamptz not null default now(),
  primary key (usuario_id, periodo)
);


-- ---------- 7. RLS: leitura controlada, nenhuma escrita direta --------
alter table public.estrelas_config            enable row level security;
alter table public.estrelas_fechamentos       enable row level security;
alter table public.chamado_avaliacoes         enable row level security;
alter table public.estrelas_lancamentos       enable row level security;
alter table public.estrelas_eventos           enable row level security;
alter table public.estrelas_prazo_alteracoes  enable row level security;
alter table public.estrelas_posicoes_vistas   enable row level security;

drop policy if exists "Equipe le config de estrelas" on public.estrelas_config;
create policy "Equipe le config de estrelas" on public.estrelas_config
  for select to authenticated using (public.estrelas_eh_equipe());

drop policy if exists "Equipe le fechamentos" on public.estrelas_fechamentos;
create policy "Equipe le fechamentos" on public.estrelas_fechamentos
  for select to authenticated using (public.estrelas_eh_equipe());

-- Avaliação: quem abriu o chamado e a equipe interna (histórico do chamado).
drop policy if exists "Cliente e equipe leem avaliacao" on public.chamado_avaliacoes;
create policy "Cliente e equipe leem avaliacao" on public.chamado_avaliacoes
  for select to authenticated
  using (
    public.estrelas_eh_equipe()
    or exists (select 1 from public.chamados c
                where c.id = chamado_avaliacoes.chamado_id
                  and c.criado_por = auth.uid())
  );

drop policy if exists "Atendente ve os proprios lancamentos" on public.estrelas_lancamentos;
create policy "Atendente ve os proprios lancamentos" on public.estrelas_lancamentos
  for select to authenticated
  using (atendente_id = auth.uid() or public.estrelas_eh_gestor());

drop policy if exists "Atendente ve os proprios eventos" on public.estrelas_eventos;
create policy "Atendente ve os proprios eventos" on public.estrelas_eventos
  for select to authenticated
  using (atendente_id = auth.uid() or public.estrelas_eh_gestor());

drop policy if exists "Equipe ve alteracoes de prazo" on public.estrelas_prazo_alteracoes;
create policy "Equipe ve alteracoes de prazo" on public.estrelas_prazo_alteracoes
  for select to authenticated using (public.estrelas_eh_equipe());

drop policy if exists "Usuario ve as proprias posicoes" on public.estrelas_posicoes_vistas;
create policy "Usuario ve as proprias posicoes" on public.estrelas_posicoes_vistas
  for select to authenticated using (usuario_id = auth.uid());

grant select on public.estrelas_config, public.estrelas_fechamentos,
                public.chamado_avaliacoes, public.estrelas_lancamentos,
                public.estrelas_eventos, public.estrelas_prazo_alteracoes,
                public.estrelas_posicoes_vistas
   to authenticated;
revoke insert, update, delete on public.estrelas_config, public.estrelas_fechamentos,
                public.chamado_avaliacoes, public.estrelas_lancamentos,
                public.estrelas_eventos, public.estrelas_prazo_alteracoes,
                public.estrelas_posicoes_vistas
   from anon, authenticated;


-- ---------- 8. Cálculo (núcleo) ---------------------------------------
-- Prazo usado para a estrela: prazo do SLA menos as extensões de prazo
-- feitas sem mudança de status que NÃO foram autorizadas por gestor.
create or replace function public.estrelas_prazo_referencia(p_chamado uuid, p_prazo timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $fn$
  select p_prazo - coalesce((
           select sum(a.prazo_novo - a.prazo_anterior)
             from public.estrelas_prazo_alteracoes a
            where a.chamado_id = p_chamado
              and a.prazo_novo > a.prazo_anterior
              and a.autorizado is not true
         ), interval '0');
$fn$;

create or replace function public.estrelas_recalcular(p_chamado uuid, p_autor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg        public.estrelas_config%rowtype;
  c          record;
  l          public.estrelas_lancamentos%rowtype;
  tem_l      boolean;
  v_res      timestamptz;
  v_atend    uuid;
  v_regras   jsonb;
  v_ref      timestamptz;
  v_dentro   boolean;
  v_ep       smallint;
  v_nota     smallint;
  v_ea       smallint;
  v_tipo     text;
  v_comemorar text;
begin
  select * into cfg from public.estrelas_config where id;
  select id, status, prazo_sla, resolvido_em, encerrado_em, responsavel_id
    into c from public.chamados where id = p_chamado;
  if not found then return; end if;

  select * into l from public.estrelas_lancamentos where chamado_id = p_chamado for update;
  tem_l := found;

  -- Estorno só se desfaz por ação explícita do gestor.
  if tem_l and l.situacao = 'estornada' then return; end if;

  v_res := case when c.status in ('resolvido', 'encerrado')
                then coalesce(c.resolvido_em, c.encerrado_em) end;

  -- Chamado reaberto: suspende (preserva valores e histórico).
  if v_res is null then
    if tem_l and l.situacao = 'valida' then
      update public.estrelas_lancamentos
         set situacao = 'suspensa', motivo = 'Chamado reaberto', atualizado_em = now()
       where chamado_id = p_chamado;
      insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id)
      values (p_chamado, l.atendente_id, 'suspensa',
              jsonb_build_object('situacao', 'valida'),
              jsonb_build_object('situacao', 'suspensa'),
              'Chamado reaberto: pontuação suspensa até nova resolução', p_autor);
    end if;
    return;
  end if;

  -- Primeira concessão: só com programa ativo e resolução a partir da data inicial.
  if not tem_l then
    if not cfg.ativo or cfg.data_inicio is null
       or (v_res at time zone 'America/Sao_Paulo')::date < cfg.data_inicio then
      return;
    end if;
    if c.responsavel_id is null then return; end if;
  end if;

  -- Atendente: quem era responsável na resolução válida. Uma
  -- transferência depois de resolvido não move as estrelas.
  if tem_l and l.resolvido_em = v_res then
    v_atend := l.atendente_id;
  else
    v_atend := coalesce(c.responsavel_id, l.atendente_id);
  end if;
  if v_atend is null then return; end if;

  -- Regras: as do momento da primeira concessão (mudança de regra vale
  -- só para novas concessões).
  v_regras := coalesce(case when tem_l then l.regras end,
                       jsonb_build_object('versao', cfg.regra_versao,
                                          'prazo', cfg.estrelas_prazo,
                                          'bom', cfg.bonus_bom,
                                          'excelente', cfg.bonus_excelente));

  v_ref    := public.estrelas_prazo_referencia(p_chamado, c.prazo_sla);
  v_dentro := case when v_ref is null then null else v_res <= v_ref end;
  v_ep     := case when v_dentro then (v_regras->>'prazo')::smallint else 0 end;

  select a.nota into v_nota from public.chamado_avaliacoes a where a.chamado_id = p_chamado;
  v_ea := case v_nota when 3 then (v_regras->>'excelente')::smallint
                      when 2 then (v_regras->>'bom')::smallint
                      else 0 end;

  if not tem_l then
    insert into public.estrelas_lancamentos
           (chamado_id, atendente_id, resolvido_em, prazo_referencia, dentro_prazo,
            estrelas_prazo, nota, estrelas_avaliacao, situacao, regras)
    values (p_chamado, v_atend, v_res, v_ref, v_dentro, v_ep, v_nota, v_ea, 'valida', v_regras);

    v_comemorar := case when v_ep > 0 then 'prazo'
                        when v_ea > 0 then 'avaliacao' end;
    insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, depois, motivo, autor_id, comemorar)
    values (p_chamado, v_atend, 'concessao',
            jsonb_build_object('estrelas_prazo', v_ep, 'estrelas_avaliacao', v_ea,
                               'dentro_prazo', v_dentro, 'resolvido_em', v_res,
                               'prazo_referencia', v_ref, 'nota', v_nota),
            case when v_dentro then 'Resolvido dentro do prazo'
                 when v_dentro is null then 'Chamado sem prazo de SLA'
                 else 'Resolvido fora do prazo' end,
            p_autor, v_comemorar);
    return;
  end if;

  -- Nada mudou: não grava nada (idempotente).
  if l.situacao = 'valida' and l.atendente_id = v_atend and l.resolvido_em = v_res
     and l.prazo_referencia is not distinct from v_ref
     and l.dentro_prazo is not distinct from v_dentro
     and l.estrelas_prazo = v_ep and l.nota is not distinct from v_nota
     and l.estrelas_avaliacao = v_ea then
    return;
  end if;

  update public.estrelas_lancamentos
     set atendente_id = v_atend, resolvido_em = v_res, prazo_referencia = v_ref,
         dentro_prazo = v_dentro, estrelas_prazo = v_ep, nota = v_nota,
         estrelas_avaliacao = v_ea, situacao = 'valida', motivo = null,
         atualizado_em = now()
   where chamado_id = p_chamado;

  v_comemorar := null;
  if l.situacao = 'suspensa' then
    v_tipo := 'restabelecida';
  elsif l.estrelas_avaliacao is distinct from v_ea or l.nota is distinct from v_nota then
    v_tipo := 'avaliacao';
    if v_ea > l.estrelas_avaliacao then v_comemorar := 'avaliacao'; end if;
  else
    v_tipo := 'recalculo';
  end if;

  insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id, comemorar)
  values (p_chamado, v_atend, v_tipo,
          jsonb_build_object('atendente_id', l.atendente_id, 'estrelas_prazo', l.estrelas_prazo,
                             'estrelas_avaliacao', l.estrelas_avaliacao, 'situacao', l.situacao,
                             'resolvido_em', l.resolvido_em, 'nota', l.nota),
          jsonb_build_object('atendente_id', v_atend, 'estrelas_prazo', v_ep,
                             'estrelas_avaliacao', v_ea, 'situacao', 'valida',
                             'resolvido_em', v_res, 'nota', v_nota,
                             'dentro_prazo', v_dentro, 'prazo_referencia', v_ref),
          case v_tipo
            when 'restabelecida' then 'Chamado resolvido novamente: pontuação restabelecida (sem nova concessão)'
            when 'avaliacao' then 'Bônus pela avaliação do cliente'
            else 'Pontuação recalculada' end,
          p_autor, v_comemorar);
end;
$fn$;

revoke all on function public.estrelas_recalcular(uuid, uuid) from public, anon, authenticated;
revoke all on function public.estrelas_prazo_referencia(uuid, timestamptz) from public, anon, authenticated;


-- ---------- 9. Gatilhos em chamados -----------------------------------
-- ANTES (nome "zz_" para rodar depois dos outros gatilhos BEFORE):
--   * horário de resolução/encerramento do servidor;
--   * datas de resolução não mudam sem mudança de status;
--   * registra alterações de prazo feitas sem mudança de status.
create or replace function public.estrelas_chamado_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status is distinct from old.status then
    if new.status = 'resolvido' then
      new.resolvido_em := now();
    end if;
    if new.status = 'encerrado' and old.status is distinct from 'encerrado' then
      new.encerrado_em := now();
    end if;
  else
    new.resolvido_em := old.resolvido_em;
    new.encerrado_em := old.encerrado_em;

    if old.prazo_sla is not null and new.prazo_sla is not null
       and new.prazo_sla is distinct from old.prazo_sla then
      insert into public.estrelas_prazo_alteracoes
             (chamado_id, prazo_anterior, prazo_novo, origem, alterado_por)
      values (new.id, old.prazo_sla, new.prazo_sla,
              case when new.prioridade is distinct from old.prioridade then 'prioridade' else 'manual' end,
              auth.uid());
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists zz_estrelas_chamado_antes on public.chamados;
create trigger zz_estrelas_chamado_antes
  before update on public.chamados
  for each row execute function public.estrelas_chamado_antes();

create or replace function public.estrelas_chamado_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status is distinct from old.status
     or new.resolvido_em is distinct from old.resolvido_em
     or new.encerrado_em is distinct from old.encerrado_em
     or new.prazo_sla is distinct from old.prazo_sla then
    perform public.estrelas_recalcular(new.id, auth.uid());
  end if;
  return null;
end;
$fn$;

drop trigger if exists zz_estrelas_chamado_depois on public.chamados;
create trigger zz_estrelas_chamado_depois
  after update on public.chamados
  for each row execute function public.estrelas_chamado_depois();


-- ---------- 10. Avaliação pelo cliente --------------------------------
create or replace function public.avaliar_chamado(p_chamado uuid, p_nota integer, p_comentario text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg   public.estrelas_config%rowtype;
  c     record;
  v_res timestamptz;
  v_com text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  if auth.uid() is null then raise exception 'Faça login para avaliar.'; end if;
  if public.estrelas_perfil() is distinct from 'cliente' then
    raise exception 'Somente o cliente que abriu o chamado pode avaliar.';
  end if;
  if p_nota not in (1, 2, 3) then raise exception 'Nota inválida.'; end if;
  if v_com is not null and char_length(v_com) > 2000 then
    raise exception 'Comentário muito longo (máximo 2000 caracteres).';
  end if;

  select id, status, criado_por, resolvido_em, encerrado_em
    into c from public.chamados where id = p_chamado for update;
  if not found or c.criado_por is distinct from auth.uid() then
    raise exception 'Somente o cliente que abriu o chamado pode avaliar.';
  end if;
  if c.status not in ('resolvido', 'encerrado') then
    raise exception 'A avaliação fica disponível quando o chamado é resolvido.';
  end if;
  if exists (select 1 from public.chamado_avaliacoes where chamado_id = p_chamado) then
    raise exception 'Este chamado já foi avaliado.';
  end if;

  select * into cfg from public.estrelas_config where id;
  v_res := coalesce(
    (select l.resolvido_em from public.estrelas_lancamentos l where l.chamado_id = p_chamado),
    c.resolvido_em, c.encerrado_em);
  if cfg.prazo_avaliacao_dias is not null and v_res is not null
     and now() > v_res + make_interval(days => cfg.prazo_avaliacao_dias) then
    raise exception 'O prazo para avaliar este chamado terminou.';
  end if;

  insert into public.chamado_avaliacoes (chamado_id, nota, comentario, autor_id)
  values (p_chamado, p_nota, v_com, auth.uid());

  perform public.estrelas_recalcular(p_chamado, auth.uid());

  return jsonb_build_object('ok', true, 'nota', p_nota);
end;
$fn$;

revoke all on function public.avaliar_chamado(uuid, integer, text) from public, anon;
grant execute on function public.avaliar_chamado(uuid, integer, text) to authenticated;


-- ---------- 11. Ranking (sem comentários de clientes) -----------------
create or replace function public.estrelas_ranking(p_inicio date, p_fim date)
returns table (
  atendente_id        uuid,
  nome                text,
  posicao             integer,
  estrelas_prazo      integer,
  estrelas_avaliacao  integer,
  total               integer,
  resolvidos          integer,
  dentro_prazo        integer,
  fora_prazo          integer,
  avaliados           integer,
  media_nota          numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.estrelas_eh_equipe() then
    raise exception 'Acesso restrito à equipe.';
  end if;

  return query
  with base as (
    select l.atendente_id,
           sum(l.estrelas_prazo)::int                              as ep,
           sum(l.estrelas_avaliacao)::int                          as ea,
           count(*)::int                                           as resolvidos,
           count(*) filter (where l.dentro_prazo)::int             as dentro,
           count(*) filter (where l.dentro_prazo = false)::int     as fora,
           count(l.nota)::int                                      as avaliados,
           round(avg(l.nota)::numeric, 2)                          as media
      from public.estrelas_lancamentos l
     where l.situacao = 'valida'
       and (l.resolvido_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
     group by l.atendente_id
  )
  select b.atendente_id,
         coalesce(p.nome, p.email, 'Atendente')::text,
         (rank() over (order by (b.ep + b.ea) desc))::int,
         b.ep, b.ea, b.ep + b.ea, b.resolvidos, b.dentro, b.fora, b.avaliados, b.media
    from base b
    left join public.profiles p on p.id = b.atendente_id
   order by (b.ep + b.ea) desc, coalesce(p.nome, '');
end;
$fn$;

revoke all on function public.estrelas_ranking(date, date) from public, anon;
grant execute on function public.estrelas_ranking(date, date) to authenticated;


-- ---------- 12. Comemorações e posição vista --------------------------
create or replace function public.estrelas_comemoracoes_pendentes()
returns setof public.estrelas_eventos
language sql
stable
security definer
set search_path = public
as $fn$
  select e.*
    from public.estrelas_eventos e
   where e.atendente_id = auth.uid()
     and e.comemorar is not null
     and e.comemorado_em is null
   order by e.created_at
   limit 10;
$fn$;

create or replace function public.estrelas_marcar_comemorado(p_ids bigint[])
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.estrelas_eventos
     set comemorado_em = now()
   where id = any(p_ids)
     and atendente_id = auth.uid()
     and comemorado_em is null;
$fn$;

-- Guarda a posição vista e devolve a anterior (null na primeira vez).
create or replace function public.estrelas_registrar_posicao(p_periodo text, p_posicao integer)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  anterior integer;
begin
  if not public.estrelas_eh_equipe() then return null; end if;
  if p_periodo !~ '^(mes:\d{4}-\d{2}|ano:\d{4})$' then return null; end if;

  select posicao into anterior from public.estrelas_posicoes_vistas
   where usuario_id = auth.uid() and periodo = p_periodo;

  insert into public.estrelas_posicoes_vistas (usuario_id, periodo, posicao)
  values (auth.uid(), p_periodo, p_posicao)
  on conflict (usuario_id, periodo)
  do update set posicao = excluded.posicao, visto_em = now();

  return anterior;
end;
$fn$;

revoke all on function public.estrelas_comemoracoes_pendentes() from public, anon;
revoke all on function public.estrelas_marcar_comemorado(bigint[]) from public, anon;
revoke all on function public.estrelas_registrar_posicao(text, integer) from public, anon;
grant execute on function public.estrelas_comemoracoes_pendentes() to authenticated;
grant execute on function public.estrelas_marcar_comemorado(bigint[]) to authenticated;
grant execute on function public.estrelas_registrar_posicao(text, integer) to authenticated;


-- ---------- 13. Ações do gestor ---------------------------------------
create or replace function public.estrelas_exigir_gestor()
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.estrelas_eh_gestor() then
    raise exception 'Somente gestores podem fazer esta ação.';
  end if;
end;
$fn$;

create or replace function public.estrelas_exigir_motivo(p_motivo text)
returns text
language plpgsql
immutable
as $fn$
begin
  if p_motivo is null or char_length(btrim(p_motivo)) < 5 then
    raise exception 'Informe a justificativa (mínimo de 5 caracteres).';
  end if;
  return btrim(p_motivo);
end;
$fn$;

-- Prévia de pontuação retroativa (antes de ativar com data no passado).
create or replace function public.estrelas_previa_retroativa(p_data_inicio date)
returns table (atendente_id uuid, nome text, chamados integer, dentro_prazo integer, fora_prazo integer, sem_prazo integer)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  perform public.estrelas_exigir_gestor();
  return query
  select ch.responsavel_id,
         coalesce(p.nome, p.email, 'Atendente')::text,
         count(*)::int,
         count(*) filter (where ch.prazo_sla is not null
            and coalesce(ch.resolvido_em, ch.encerrado_em)
                <= public.estrelas_prazo_referencia(ch.id, ch.prazo_sla))::int,
         count(*) filter (where ch.prazo_sla is not null
            and coalesce(ch.resolvido_em, ch.encerrado_em)
                > public.estrelas_prazo_referencia(ch.id, ch.prazo_sla))::int,
         count(*) filter (where ch.prazo_sla is null)::int
    from public.chamados ch
    left join public.profiles p on p.id = ch.responsavel_id
   where ch.status in ('resolvido', 'encerrado')
     and ch.responsavel_id is not null
     and coalesce(ch.resolvido_em, ch.encerrado_em) is not null
     and (coalesce(ch.resolvido_em, ch.encerrado_em) at time zone 'America/Sao_Paulo')::date >= p_data_inicio
     and not exists (select 1 from public.estrelas_lancamentos l where l.chamado_id = ch.id)
   group by ch.responsavel_id, p.nome, p.email
   order by 3 desc;
end;
$fn$;

create or replace function public.estrelas_salvar_config(
  p_ativo boolean,
  p_data_inicio date,
  p_prazo_avaliacao_dias integer,
  p_alerta_prazo_horas numeric,
  p_estrelas_prazo smallint,
  p_bonus_bom smallint,
  p_bonus_excelente smallint,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  antes   public.estrelas_config%rowtype;
  depois  public.estrelas_config%rowtype;
  v_motivo text;
  v_versao integer;
  n integer := 0;
  r record;
begin
  perform public.estrelas_exigir_gestor();
  v_motivo := public.estrelas_exigir_motivo(p_motivo);

  select * into antes from public.estrelas_config where id for update;

  if p_ativo then
    if p_data_inicio is null then
      raise exception 'Defina a data inicial do programa antes de ativar.';
    end if;
    if p_prazo_avaliacao_dias is null then
      raise exception 'Defina o prazo para receber avaliações antes de ativar.';
    end if;
    if not exists (select 1 from public.estrelas_fechamentos f
                    where f.ano = extract(year from (now() at time zone 'America/Sao_Paulo'))::int) then
      raise exception 'Defina a data de fechamento anual do ano corrente antes de ativar.';
    end if;
  end if;

  v_versao := antes.regra_versao;
  if p_estrelas_prazo is distinct from antes.estrelas_prazo
     or p_bonus_bom is distinct from antes.bonus_bom
     or p_bonus_excelente is distinct from antes.bonus_excelente then
    v_versao := v_versao + 1;
  end if;

  update public.estrelas_config
     set ativo = p_ativo,
         data_inicio = p_data_inicio,
         prazo_avaliacao_dias = p_prazo_avaliacao_dias,
         alerta_prazo_horas = coalesce(p_alerta_prazo_horas, antes.alerta_prazo_horas),
         estrelas_prazo = p_estrelas_prazo,
         bonus_bom = p_bonus_bom,
         bonus_excelente = p_bonus_excelente,
         regra_versao = v_versao,
         atualizado_em = now(),
         atualizado_por = auth.uid()
   where id
  returning * into depois;

  insert into public.estrelas_eventos (tipo, antes, depois, motivo, autor_id)
  values ('config', to_jsonb(antes), to_jsonb(depois), v_motivo, auth.uid());

  -- Ao ativar: processa os chamados já resolvidos desde a data inicial
  -- (a prévia foi mostrada ao gestor na tela antes da confirmação).
  if depois.ativo then
    for r in
      select ch.id from public.chamados ch
       where ch.status in ('resolvido', 'encerrado')
         and coalesce(ch.resolvido_em, ch.encerrado_em) is not null
         and (coalesce(ch.resolvido_em, ch.encerrado_em) at time zone 'America/Sao_Paulo')::date >= depois.data_inicio
         and not exists (select 1 from public.estrelas_lancamentos l where l.chamado_id = ch.id)
    loop
      perform public.estrelas_recalcular(r.id, auth.uid());
      n := n + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'processados', n, 'regra_versao', v_versao);
end;
$fn$;

create or replace function public.estrelas_definir_fechamento(p_ano integer, p_data date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  antes public.estrelas_fechamentos%rowtype;
begin
  perform public.estrelas_exigir_gestor();
  if p_data is null or extract(year from p_data)::int not in (p_ano, p_ano + 1) then
    raise exception 'A data de fechamento deve estar no próprio ano ou no início do ano seguinte.';
  end if;

  select * into antes from public.estrelas_fechamentos where ano = p_ano for update;
  if found and antes.fechado_em is not null then
    raise exception 'O ano % já foi fechado; a classificação final não pode mudar.', p_ano;
  end if;

  insert into public.estrelas_fechamentos (ano, data_fechamento, definido_por, definido_em)
  values (p_ano, p_data, auth.uid(), now())
  on conflict (ano) do update
     set data_fechamento = excluded.data_fechamento,
         definido_por = excluded.definido_por,
         definido_em = now();

  insert into public.estrelas_eventos (tipo, antes, depois, motivo, autor_id)
  values ('fechamento',
          case when antes.ano is not null then to_jsonb(antes) end,
          jsonb_build_object('ano', p_ano, 'data_fechamento', p_data),
          public.estrelas_exigir_motivo(coalesce(p_motivo, 'Data de fechamento definida')),
          auth.uid());
end;
$fn$;

-- Fecha o ano: grava a classificação final usada na premiação.
create or replace function public.estrelas_fechar_ano(p_ano integer, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  f public.estrelas_fechamentos%rowtype;
  v_class jsonb;
begin
  perform public.estrelas_exigir_gestor();
  select * into f from public.estrelas_fechamentos where ano = p_ano for update;
  if not found then raise exception 'Defina antes a data de fechamento de %.', p_ano; end if;
  if f.fechado_em is not null then raise exception 'O ano % já foi fechado.', p_ano; end if;
  if (now() at time zone 'America/Sao_Paulo')::date < f.data_fechamento then
    raise exception 'O fechamento de % só pode ser feito a partir de %.', p_ano, to_char(f.data_fechamento, 'DD/MM/YYYY');
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.posicao, r.nome), '[]'::jsonb)
    into v_class
    from public.estrelas_ranking(make_date(p_ano, 1, 1), make_date(p_ano, 12, 31)) r;

  update public.estrelas_fechamentos
     set fechado_em = now(), fechado_por = auth.uid(), classificacao = v_class
   where ano = p_ano;

  insert into public.estrelas_eventos (tipo, depois, motivo, autor_id)
  values ('fechamento', jsonb_build_object('ano', p_ano, 'fechado', true, 'classificacao', v_class),
          coalesce(nullif(btrim(p_motivo), ''), 'Fechamento anual da classificação'), auth.uid());

  return jsonb_build_object('ok', true, 'ano', p_ano, 'classificacao', v_class);
end;
$fn$;

create or replace function public.estrelas_estornar(p_chamado uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  l public.estrelas_lancamentos%rowtype;
  v_motivo text;
begin
  perform public.estrelas_exigir_gestor();
  v_motivo := public.estrelas_exigir_motivo(p_motivo);
  select * into l from public.estrelas_lancamentos where chamado_id = p_chamado for update;
  if not found then raise exception 'Este chamado não tem estrelas lançadas.'; end if;
  if l.situacao = 'estornada' then raise exception 'As estrelas deste chamado já foram estornadas.'; end if;

  update public.estrelas_lancamentos
     set situacao = 'estornada', motivo = v_motivo, atualizado_em = now()
   where chamado_id = p_chamado;

  insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id)
  values (p_chamado, l.atendente_id, 'estornada',
          jsonb_build_object('situacao', l.situacao, 'estrelas_prazo', l.estrelas_prazo,
                             'estrelas_avaliacao', l.estrelas_avaliacao),
          jsonb_build_object('situacao', 'estornada'),
          v_motivo, auth.uid());
end;
$fn$;

create or replace function public.estrelas_restabelecer(p_chamado uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  l public.estrelas_lancamentos%rowtype;
  v_motivo text;
begin
  perform public.estrelas_exigir_gestor();
  v_motivo := public.estrelas_exigir_motivo(p_motivo);
  select * into l from public.estrelas_lancamentos where chamado_id = p_chamado for update;
  if not found or l.situacao <> 'estornada' then
    raise exception 'Só é possível restabelecer estrelas estornadas.';
  end if;

  update public.estrelas_lancamentos
     set situacao = 'suspensa', motivo = v_motivo, atualizado_em = now()
   where chamado_id = p_chamado;

  insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id)
  values (p_chamado, l.atendente_id, 'restabelecida',
          jsonb_build_object('situacao', 'estornada'),
          jsonb_build_object('situacao', 'recalculada'),
          v_motivo, auth.uid());

  perform public.estrelas_recalcular(p_chamado, auth.uid());
end;
$fn$;

-- Autoriza ou recusa uma extensão de prazo (efeito só nas estrelas).
create or replace function public.estrelas_decidir_prazo(p_alteracao bigint, p_autorizar boolean, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a public.estrelas_prazo_alteracoes%rowtype;
  v_motivo text;
begin
  perform public.estrelas_exigir_gestor();
  v_motivo := public.estrelas_exigir_motivo(p_justificativa);
  select * into a from public.estrelas_prazo_alteracoes where id = p_alteracao for update;
  if not found then raise exception 'Alteração de prazo não encontrada.'; end if;
  if a.autorizado is not null then raise exception 'Esta alteração já foi decidida.'; end if;

  if p_autorizar and a.prazo_novo > a.prazo_anterior and a.prazo_anterior < a.alterado_em then
    raise exception 'Não é possível autorizar: o prazo anterior já estava vencido quando foi alterado (alteração retroativa).';
  end if;

  update public.estrelas_prazo_alteracoes
     set autorizado = p_autorizar, decidido_por = auth.uid(), decidido_em = now(),
         justificativa = v_motivo
   where id = p_alteracao;

  insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id)
  values (a.chamado_id,
          (select l.atendente_id from public.estrelas_lancamentos l where l.chamado_id = a.chamado_id),
          'prazo_decidido',
          jsonb_build_object('prazo_anterior', a.prazo_anterior, 'prazo_novo', a.prazo_novo),
          jsonb_build_object('autorizado', p_autorizar),
          v_motivo, auth.uid());

  perform public.estrelas_recalcular(a.chamado_id, auth.uid());
end;
$fn$;

-- Registro de acompanhamento de avaliação ruim (reservado ao gestor).
create or replace function public.estrelas_registrar_acompanhamento(p_chamado uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_texto text;
begin
  perform public.estrelas_exigir_gestor();
  v_texto := public.estrelas_exigir_motivo(p_texto);
  update public.chamado_avaliacoes
     set acompanhado_em = now(), acompanhado_por = auth.uid(), acompanhamento = v_texto
   where chamado_id = p_chamado;
  if not found then raise exception 'Avaliação não encontrada.'; end if;

  insert into public.estrelas_eventos (chamado_id, tipo, motivo, autor_id)
  values (p_chamado, 'acompanhamento', v_texto, auth.uid());
end;
$fn$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'estrelas_previa_retroativa(date)',
    'estrelas_salvar_config(boolean, date, integer, numeric, smallint, smallint, smallint, text)',
    'estrelas_definir_fechamento(integer, date, text)',
    'estrelas_fechar_ano(integer, text)',
    'estrelas_estornar(uuid, text)',
    'estrelas_restabelecer(uuid, text)',
    'estrelas_decidir_prazo(bigint, boolean, text)',
    'estrelas_registrar_acompanhamento(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

revoke all on function public.estrelas_exigir_gestor() from public, anon, authenticated;


-- ---------- 14. Situação da avaliação (tela do cliente) ---------------
create or replace function public.avaliacao_situacao(p_chamado uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cfg   public.estrelas_config%rowtype;
  c     record;
  a     public.chamado_avaliacoes%rowtype;
  v_res timestamptz;
  v_ate timestamptz;
  eh_autor boolean;
begin
  select id, status, criado_por, resolvido_em, encerrado_em
    into c from public.chamados where id = p_chamado;
  if not found then return null; end if;

  eh_autor := c.criado_por = auth.uid();
  if not eh_autor and not public.estrelas_eh_equipe() then return null; end if;

  select * into a from public.chamado_avaliacoes where chamado_id = p_chamado;
  if found then
    return jsonb_build_object('avaliado', true, 'nota', a.nota,
                              'comentario', a.comentario, 'avaliado_em', a.created_at,
                              'pode_avaliar', false);
  end if;

  select * into cfg from public.estrelas_config where id;
  v_res := coalesce(
    (select l.resolvido_em from public.estrelas_lancamentos l where l.chamado_id = p_chamado),
    c.resolvido_em, c.encerrado_em);
  v_ate := case when cfg.prazo_avaliacao_dias is not null and v_res is not null
                then v_res + make_interval(days => cfg.prazo_avaliacao_dias) end;

  return jsonb_build_object(
    'avaliado', false,
    'avaliar_ate', v_ate,
    'pode_avaliar', eh_autor
                    and public.estrelas_perfil() = 'cliente'
                    and c.status in ('resolvido', 'encerrado')
                    and (v_ate is null or now() <= v_ate));
end;
$fn$;

revoke all on function public.avaliacao_situacao(uuid) from public, anon;
grant execute on function public.avaliacao_situacao(uuid) to authenticated;


-- ---------- 15. Convite para avaliar: um por chamado ------------------
-- Gravado pelo servidor (service role) ao enviar o e-mail de convite.
create table if not exists public.chamado_avaliacao_convites (
  chamado_id  uuid primary key references public.chamados(id) on delete cascade,
  enviado_em  timestamptz not null default now()
);
alter table public.chamado_avaliacao_convites enable row level security;
revoke all on public.chamado_avaliacao_convites from anon, authenticated;
