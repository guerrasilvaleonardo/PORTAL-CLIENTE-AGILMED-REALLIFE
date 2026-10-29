-- =====================================================================
-- Gestão de desempenho — etapa 2: cadastros de contexto e metas.
--
-- ANTES:  o relatório mensal não sabia a função, o gestor, a jornada,
--         as férias e os afastamentos de cada pessoa, nem havia metas
--         aprovadas. Tudo isso aparecia como "não disponível".
-- DEPOIS: três cadastros novos, usados pelo relatório a partir da
--         etapa 3:
--           desempenho_perfil    função, equipe, gestor, início na
--                                função e jornada de cada pessoa;
--           desempenho_ausencias férias, afastamentos, folgas e
--                                treinamentos (só tipo e datas — o
--                                motivo de saúde NÃO é registrado);
--           desempenho_metas     metas por indicador: o portal propõe
--                                pela linha de base, a direção aprova.
--                                Só meta APROVADA vale no relatório.
--         Só a direção (acesso ao relatório de gestão) lê e altera.
--         Toda alteração guarda quem fez e quando.
-- MOTIVO: avaliação justa (considerar disponibilidade e contexto) e
--         metas aprovadas pela gestão em vez de números inventados
--         (decisão do Leonardo em 29/10/2026).
--
-- Não apaga nem altera dados existentes. Pode rodar mais de uma vez.
-- Depende de supabase/relatorio-desempenho.sql
-- (função pode_ver_relatorio_gestao).
-- =====================================================================

do $$
begin
  if to_regprocedure('public.pode_ver_relatorio_gestao()') is null then
    raise exception 'Rode antes supabase/relatorio-desempenho.sql (falta pode_ver_relatorio_gestao).';
  end if;
end
$$;

-- ---------- Perfil de trabalho ------------------------------------------
create table if not exists public.desempenho_perfil (
  pessoa_id            uuid primary key references public.profiles (id) on delete cascade,
  funcao               text check (funcao is null or char_length(btrim(funcao)) between 2 and 80),
  equipe               text check (equipe is null or char_length(btrim(equipe)) between 2 and 80),
  gestor_id            uuid references public.profiles (id) on delete set null,
  inicio_funcao        date,
  jornada_horas_semana numeric(4,1) check (jornada_horas_semana is null or jornada_horas_semana between 1 and 60),
  observacao           text check (observacao is null or char_length(observacao) <= 500),
  atualizado_em        timestamptz not null default now(),
  atualizado_por       uuid references public.profiles (id) on delete set null
);

-- ---------- Ausências ---------------------------------------------------
create table if not exists public.desempenho_ausencias (
  id          bigserial primary key,
  pessoa_id   uuid not null references public.profiles (id) on delete cascade,
  tipo        text not null check (tipo in ('ferias', 'afastamento', 'folga', 'treinamento', 'outro')),
  inicio      date not null,
  fim         date not null,
  observacao  text check (observacao is null or char_length(observacao) <= 300),
  criado_em   timestamptz not null default now(),
  criado_por  uuid references public.profiles (id) on delete set null,
  check (fim >= inicio)
);

create index if not exists desempenho_ausencias_pessoa
  on public.desempenho_ausencias (pessoa_id, inicio);

-- ---------- Metas --------------------------------------------------------
create table if not exists public.desempenho_metas (
  id              bigserial primary key,
  indicador       text not null check (char_length(indicador) between 2 and 60),
  pessoa_id       uuid references public.profiles (id) on delete cascade, -- null = equipe
  valor           numeric not null,
  unidade         text not null check (unidade in ('%', 'horas úteis', 'dias', 'chamados')),
  direcao         text not null check (direcao in ('maior', 'menor')),
  linha_base      numeric,
  base_texto      text check (base_texto is null or char_length(base_texto) <= 300),
  vigencia_inicio date not null,
  vigencia_fim    date,
  situacao        text not null default 'proposta' check (situacao in ('proposta', 'aprovada', 'encerrada')),
  justificativa   text check (justificativa is null or char_length(justificativa) <= 500),
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.profiles (id) on delete set null,
  aprovada_em     timestamptz,
  aprovada_por    uuid references public.profiles (id) on delete set null,
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index if not exists desempenho_metas_indicador
  on public.desempenho_metas (indicador, situacao, vigencia_inicio desc);

-- Quem altera e quando (gravado pelo banco, não pela tela).
create or replace function public.desempenho_carimbo()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_table_name = 'desempenho_perfil' then
    new.atualizado_em := now();
    new.atualizado_por := auth.uid();
  elsif tg_table_name = 'desempenho_ausencias' then
    if tg_op = 'INSERT' then
      new.criado_em := now();
      new.criado_por := auth.uid();
    else
      new.criado_em := old.criado_em;
      new.criado_por := old.criado_por;
    end if;
  elsif tg_table_name = 'desempenho_metas' then
    if tg_op = 'INSERT' then
      new.criado_em := now();
      new.criado_por := auth.uid();
      new.aprovada_em := null;
      new.aprovada_por := null;
      if new.situacao = 'aprovada' then
        new.aprovada_em := now();
        new.aprovada_por := auth.uid();
      end if;
    else
      new.criado_em := old.criado_em;
      new.criado_por := old.criado_por;
      -- Meta aprovada não muda de valor: encerre e crie outra.
      if old.situacao = 'aprovada' and (new.valor is distinct from old.valor
          or new.indicador is distinct from old.indicador
          or new.pessoa_id is distinct from old.pessoa_id
          or new.vigencia_inicio is distinct from old.vigencia_inicio) then
        raise exception 'Meta aprovada não pode ser alterada. Encerre a vigência e cadastre uma nova.';
      end if;
      if new.situacao = 'aprovada' and old.situacao is distinct from 'aprovada' then
        new.aprovada_em := now();
        new.aprovada_por := auth.uid();
      else
        new.aprovada_em := old.aprovada_em;
        new.aprovada_por := old.aprovada_por;
      end if;
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists desempenho_perfil_carimbo on public.desempenho_perfil;
create trigger desempenho_perfil_carimbo
  before insert or update on public.desempenho_perfil
  for each row execute function public.desempenho_carimbo();

drop trigger if exists desempenho_ausencias_carimbo on public.desempenho_ausencias;
create trigger desempenho_ausencias_carimbo
  before insert or update on public.desempenho_ausencias
  for each row execute function public.desempenho_carimbo();

drop trigger if exists desempenho_metas_carimbo on public.desempenho_metas;
create trigger desempenho_metas_carimbo
  before insert or update on public.desempenho_metas
  for each row execute function public.desempenho_carimbo();

-- ---------- Acesso: só a direção ----------------------------------------
alter table public.desempenho_perfil enable row level security;
alter table public.desempenho_ausencias enable row level security;
alter table public.desempenho_metas enable row level security;

drop policy if exists desempenho_perfil_direcao on public.desempenho_perfil;
create policy desempenho_perfil_direcao on public.desempenho_perfil
  for all to authenticated
  using (public.pode_ver_relatorio_gestao())
  with check (public.pode_ver_relatorio_gestao());

drop policy if exists desempenho_ausencias_direcao on public.desempenho_ausencias;
create policy desempenho_ausencias_direcao on public.desempenho_ausencias
  for all to authenticated
  using (public.pode_ver_relatorio_gestao())
  with check (public.pode_ver_relatorio_gestao());

-- Metas: direção lê, cria e altera; ninguém apaga (encerra a vigência).
drop policy if exists desempenho_metas_ler on public.desempenho_metas;
create policy desempenho_metas_ler on public.desempenho_metas
  for select to authenticated using (public.pode_ver_relatorio_gestao());
drop policy if exists desempenho_metas_criar on public.desempenho_metas;
create policy desempenho_metas_criar on public.desempenho_metas
  for insert to authenticated with check (public.pode_ver_relatorio_gestao());
drop policy if exists desempenho_metas_alterar on public.desempenho_metas;
create policy desempenho_metas_alterar on public.desempenho_metas
  for update to authenticated
  using (public.pode_ver_relatorio_gestao())
  with check (public.pode_ver_relatorio_gestao());

grant select, insert, update, delete on public.desempenho_perfil to authenticated;
grant select, insert, update, delete on public.desempenho_ausencias to authenticated;
grant select, insert, update on public.desempenho_metas to authenticated;
grant usage, select on sequence public.desempenho_ausencias_id_seq to authenticated;
grant usage, select on sequence public.desempenho_metas_id_seq to authenticated;


-- ---------- Conferência -------------------------------------------------
-- Deve listar as 3 tabelas, cada uma com a regra de acesso ligada (true).
select c.relname as tabela, c.relrowsecurity as regra_de_acesso
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('desempenho_perfil', 'desempenho_ausencias', 'desempenho_metas')
 order by c.relname;
