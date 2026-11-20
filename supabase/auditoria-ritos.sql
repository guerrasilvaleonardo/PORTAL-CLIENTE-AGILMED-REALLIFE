-- =====================================================================
-- Os ritos da auditoria, como a ABNT NBR ISO 19011:2018 os descreve.
--
-- ANTES:  a auditoria era o checklist respondido. Faltava tudo o que
--         cerca o checklist e que uma auditoria de verdade exige.
-- DEPOIS: programa anual, plano da auditoria, reunião de abertura e de
--         encerramento, conclusões do auditor líder e o registro de
--         para quem o relatório foi distribuído.
-- MOTIVO: pedido dele em 20/11/2026 — "não esqueça dos ritos que estão
--         dentro das normas da ABNT, plano de auditoria, relatórios".
--
-- O QUE A 19011 PEDE, E ONDE FICA AQUI:
--   5     gerenciando o programa de auditoria .. auditoria_programas
--   6.2   iniciando a auditoria ................ inspecoes.objetivo/escopo
--   6.3   preparando (plano de auditoria) ...... inspecoes.plano_*, equipe
--   6.4.3 reunião de abertura .................. abertura_em, abertura_*
--   6.4.8 gerando constatações ................. inspecao_respostas (já)
--   6.4.9 determinando conclusões .............. conclusao
--   6.4.10 reunião de encerramento ............. encerramento_em, *
--   6.5   preparando e distribuindo o relatório  auditoria_envios
--   6.7   conduzindo o acompanhamento .......... nao_conformidades (já)
--
-- POR QUE OS CAMPOS FICAM NA INSPEÇÃO, E NÃO NUMA TABELA NOVA. A
-- auditoria JÁ É uma linha de inspecoes com tipo = 'auditoria'. Separar
-- criaria duas telas para a mesma coisa e dois lugares para procurar o
-- mesmo documento. Inspeção de campo simplesmente deixa os campos
-- vazios.
--
-- NADA AQUI É OBRIGATÓRIO NO BANCO. Auditoria que começa hoje e termina
-- hoje mesmo não tem plano escrito de véspera, e travar a conclusão por
-- causa disso faria o auditor inventar texto para passar. A tela cobra,
-- a norma cobra, e o relatório mostra o que ficou em branco — que é
-- mais honesto do que um campo preenchido para desbloquear o botão.
--
-- Depende de supabase/inspecoes.sql e supabase/inspecoes-modo-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.inspecoes') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;
end
$$;


-- ---------- 1. Programa de auditoria (19011, seção 5) -------------------
-- O programa é do ANO e da EMPRESA: diz o que será auditado, quando e
-- com que critério. A auditoria avulsa, sem programa, continua podendo
-- existir — mas numa certificação ela é justamente o que o auditor
-- externo cobra.
create table if not exists public.auditoria_programas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  ano          integer not null,
  norma        text,
  objetivos    text,
  -- Riscos e oportunidades do programa (5.3 da 19011).
  riscos       text,
  responsavel_id   uuid references public.profiles (id) on delete set null,
  responsavel_nome text,
  situacao     text not null default 'ativo',
  observacoes  text,
  criado_por   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.auditoria_programas drop constraint if exists auditoria_programas_ano;
alter table public.auditoria_programas
  add constraint auditoria_programas_ano check (ano between 2020 and 2100);

alter table public.auditoria_programas drop constraint if exists auditoria_programas_situacao;
alter table public.auditoria_programas
  add constraint auditoria_programas_situacao check (situacao in ('ativo', 'encerrado'));

create index if not exists auditoria_programas_empresa
  on public.auditoria_programas (empresa_id, ano desc);


-- ---------- 2. O plano e as reuniões, na própria auditoria --------------
alter table public.inspecoes
  add column if not exists programa_id      uuid references public.auditoria_programas (id) on delete set null,
  -- 6.2 — iniciando a auditoria
  add column if not exists objetivo         text,
  add column if not exists escopo           text,
  add column if not exists criterios        text,
  -- 6.3 — preparando as atividades
  add column if not exists equipe           text,
  add column if not exists auditor_lider    text,
  add column if not exists plano_agenda     text,
  add column if not exists plano_enviado_em timestamptz,
  -- 6.4.3 e 6.4.10 — as duas reuniões
  add column if not exists abertura_em      timestamptz,
  add column if not exists abertura_participantes text,
  add column if not exists encerramento_em  timestamptz,
  add column if not exists encerramento_participantes text,
  -- 6.4.9 — conclusões da auditoria
  add column if not exists conclusao        text,
  -- 6.5 — relatório
  add column if not exists relatorio_em     timestamptz;


-- ---------- 3. Para quem o relatório foi distribuído (6.5.2) ------------
-- Registro de envio: numa auditoria, "eu mandei" sem data e destinatário
-- não vale nada seis meses depois.
create table if not exists public.auditoria_envios (
  id           bigint generated always as identity primary key,
  inspecao_id  uuid not null references public.inspecoes (id) on delete cascade,
  tipo         text not null default 'relatorio',
  destinatarios text not null,
  assunto      text,
  enviado_em   timestamptz not null default now(),
  enviado_por  uuid references public.profiles (id) on delete set null,
  enviado_por_nome text
);

alter table public.auditoria_envios drop constraint if exists auditoria_envios_tipo;
alter table public.auditoria_envios
  add constraint auditoria_envios_tipo check (tipo in ('plano', 'relatorio', 'cobranca'));

create index if not exists auditoria_envios_inspecao
  on public.auditoria_envios (inspecao_id, enviado_em desc);


-- ---------- 4. Ajustes na gravação --------------------------------------
create or replace function public.auditoria_programas_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.objetivos   := nullif(btrim(coalesce(new.objetivos, '')), '');
  new.riscos      := nullif(btrim(coalesce(new.riscos, '')), '');
  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');
  new.norma       := nullif(btrim(coalesce(new.norma, '')), '');

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.created_at := now();
  else
    new.empresa_id := old.empresa_id;
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists auditoria_programas_ajustes on public.auditoria_programas;
create trigger auditoria_programas_ajustes
  before insert or update on public.auditoria_programas
  for each row execute function public.auditoria_programas_ajustes();


-- ---------- 5. RLS ------------------------------------------------------
alter table public.auditoria_programas enable row level security;
alter table public.auditoria_envios    enable row level security;

drop policy if exists auditoria_programas_leitura on public.auditoria_programas;
create policy auditoria_programas_leitura
  on public.auditoria_programas for select to authenticated
  using (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists auditoria_programas_inclusao on public.auditoria_programas;
create policy auditoria_programas_inclusao
  on public.auditoria_programas for insert to authenticated
  with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists auditoria_programas_alteracao on public.auditoria_programas;
create policy auditoria_programas_alteracao
  on public.auditoria_programas for update to authenticated
  using (public.pode_gerir_inspecoes(empresa_id))
  with check (public.pode_gerir_inspecoes(empresa_id));

-- O envio é registro: entra e não se mexe mais.
drop policy if exists auditoria_envios_leitura on public.auditoria_envios;
create policy auditoria_envios_leitura
  on public.auditoria_envios for select to authenticated
  using (exists (
    select 1 from public.inspecoes i
     where i.id = auditoria_envios.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

drop policy if exists auditoria_envios_inclusao on public.auditoria_envios;
create policy auditoria_envios_inclusao
  on public.auditoria_envios for insert to authenticated
  with check (exists (
    select 1 from public.inspecoes i
     where i.id = auditoria_envios.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

grant select, insert, update on public.auditoria_programas to authenticated;
grant select, insert on public.auditoria_envios to authenticated;
revoke delete, truncate on public.auditoria_programas from anon, authenticated;
revoke update, delete, truncate on public.auditoria_envios from anon, authenticated;
revoke all on public.auditoria_programas from anon;
revoke all on public.auditoria_envios    from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.auditoria_programas)                        as programas,
       (select count(*) from public.auditoria_envios)                           as envios,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecoes'
           and column_name in ('objetivo', 'escopo', 'criterios', 'equipe',
                               'auditor_lider', 'plano_agenda', 'abertura_em',
                               'encerramento_em', 'conclusao', 'programa_id'))  as campos_do_plano;
