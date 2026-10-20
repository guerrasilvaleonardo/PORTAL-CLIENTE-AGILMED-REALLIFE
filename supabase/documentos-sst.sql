-- =====================================================================
-- Documentos SST: controle de vencimento, revisão e versão assinada
-- dos documentos de cada empresa (PGR, PCMSO, AET, AEP, LTCAT, laudos,
-- PCA, PPR e outros tipos cadastrados).
--
-- ANTES:  o portal não tinha onde registrar documentos SST.
-- DEPOIS: duas tabelas novas (tipos e documentos), com regras de acesso:
--         equipe (atendimento, gestor, admin) cadastra e edita; o cliente
--         só lê os documentos da própria empresa.
-- MOTIVO: acompanhar prazos, revisões e o link do documento assinado.
--
-- Não altera nem apaga nada que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 1. Tipos de documento (lista personalizável) --------------
create table if not exists public.documentos_sst_tipos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  sigla       text,
  ordem       int not null default 100,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.documentos_sst_tipos (nome, sigla, ordem) values
  ('Programa de Gerenciamento de Riscos', 'PGR', 10),
  ('Programa de Controle Médico de Saúde Ocupacional', 'PCMSO', 20),
  ('Análise Ergonômica do Trabalho', 'AET', 30),
  ('Avaliação Ergonômica Preliminar', 'AEP', 40),
  ('Laudo Técnico das Condições Ambientais do Trabalho', 'LTCAT', 50),
  ('Laudo de Insalubridade', null, 60),
  ('Laudo de Periculosidade', null, 70),
  ('Programa de Conservação Auditiva', 'PCA', 80),
  ('Programa de Proteção Respiratória', 'PPR', 90)
on conflict (nome) do nothing;

alter table public.documentos_sst_tipos enable row level security;

drop policy if exists documentos_sst_tipos_leitura on public.documentos_sst_tipos;
create policy documentos_sst_tipos_leitura
  on public.documentos_sst_tipos for select to authenticated
  using (true);

drop policy if exists documentos_sst_tipos_equipe on public.documentos_sst_tipos;
create policy documentos_sst_tipos_equipe
  on public.documentos_sst_tipos for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.ativo = true
                   and p.perfil in ('atendimento', 'gestor', 'admin')))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.ativo = true
                        and p.perfil in ('atendimento', 'gestor', 'admin')));


-- ---------- 2. Documentos ---------------------------------------------
-- empresa_id usa o mesmo tipo de empresas.id.
do $$
declare
  tipo_empresa text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_empresa
  from pg_attribute a
  where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.documentos_sst (
      id                  uuid primary key default gen_random_uuid(),
      empresa_id          %s not null references public.empresas (id) on delete cascade,
      unidade             text,
      tipo_id             uuid not null references public.documentos_sst_tipos (id),
      titulo              text,
      emissao             date,
      vencimento          date,
      sem_vencimento      boolean not null default false,
      proxima_revisao     date,
      revisao_pendente    boolean not null default false,
      motivo_revisao      text,
      responsavel_id      uuid references public.profiles (id) on delete set null,
      responsavel_tecnico text,
      link_assinado       text,
      versao              text,
      observacoes         text,
      alertas             int[] not null default '{90,60,30,15,7}',
      situacao            text not null default 'vigente'
                            check (situacao in ('vigente', 'substituido')),
      substitui_id        uuid references public.documentos_sst (id) on delete set null,
      criado_por          uuid default auth.uid() references public.profiles (id) on delete set null,
      created_at          timestamptz not null default now(),
      updated_at          timestamptz not null default now()
    )$f$, tipo_empresa);
end
$$;

create index if not exists documentos_sst_empresa on public.documentos_sst (empresa_id, situacao);
create index if not exists documentos_sst_substitui on public.documentos_sst (substitui_id);

-- Sem vencimento fixo => não guarda data de vencimento.
create or replace function public.documentos_sst_ajustes()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.sem_vencimento then
    new.vencimento := null;
  end if;

  if not new.revisao_pendente then
    new.motivo_revisao := null;
  end if;

  new.updated_at := now();
  return new;
end
$fn$;

drop trigger if exists documentos_sst_ajustes on public.documentos_sst;
create trigger documentos_sst_ajustes
  before insert or update on public.documentos_sst
  for each row execute function public.documentos_sst_ajustes();

-- Nova revisão: a anterior vira "substituído" e fica no histórico,
-- com o link dela preservado.
create or replace function public.documentos_sst_substituir()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.substitui_id is not null then
    update public.documentos_sst
       set situacao = 'substituido'
     where id = new.substitui_id
       and situacao = 'vigente';
  end if;

  return new;
end
$fn$;

drop trigger if exists documentos_sst_substituir on public.documentos_sst;
create trigger documentos_sst_substituir
  after insert on public.documentos_sst
  for each row execute function public.documentos_sst_substituir();

alter table public.documentos_sst enable row level security;

-- Equipe: tudo.
drop policy if exists documentos_sst_equipe on public.documentos_sst;
create policy documentos_sst_equipe
  on public.documentos_sst for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.ativo = true
                   and p.perfil in ('atendimento', 'gestor', 'admin')))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.ativo = true
                        and p.perfil in ('atendimento', 'gestor', 'admin')));

-- Cliente: só lê os documentos da própria empresa.
drop policy if exists documentos_sst_cliente_leitura on public.documentos_sst;
create policy documentos_sst_cliente_leitura
  on public.documentos_sst for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.ativo = true
                   and p.empresa_id = documentos_sst.empresa_id));

-- ---------- 3. Registro dos alertas enviados ----------------------------
-- Um aviso por documento, por prazo (vencimento ou revisão), por data e
-- por marco (90, 60, 30, 15, 7 dias; -1 = vencido). Evita e-mail repetido.
create table if not exists public.documentos_sst_alertas (
  id            bigint generated always as identity primary key,
  documento_id  uuid not null references public.documentos_sst (id) on delete cascade,
  prazo         text not null check (prazo in ('vencimento', 'revisao')),
  data_prazo    date not null,
  marco         int not null,
  enviado_em    timestamptz not null default now(),
  unique (documento_id, prazo, data_prazo, marco)
);

alter table public.documentos_sst_alertas enable row level security;

drop policy if exists documentos_sst_alertas_equipe on public.documentos_sst_alertas;
create policy documentos_sst_alertas_equipe
  on public.documentos_sst_alertas for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.ativo = true
                   and p.perfil in ('atendimento', 'gestor', 'admin')));

-- ---------- 4. Chamado de renovação -----------------------------------
-- Liga o chamado ao documento. Pedido feito pelo botão "Solicitar
-- renovação" ou aberto automaticamente pelo portal a 60 dias do prazo
-- (quando ninguém pediu). Só ADICIONA uma coluna em chamados, vazia
-- para todos os chamados que já existem.
alter table public.chamados
  add column if not exists documento_sst_id uuid
    references public.documentos_sst (id) on delete set null;

create index if not exists chamados_documento_sst
  on public.chamados (documento_sst_id) where documento_sst_id is not null;

-- Documento que a empresa prefere tratar por conta própria: desliga o
-- chamado automático (o alerta por e-mail continua).
alter table public.documentos_sst
  add column if not exists chamado_automatico boolean not null default true;

-- Conferência
select (select count(*) from public.documentos_sst_tipos) as tipos,
       (select count(*) from public.documentos_sst) as documentos;
