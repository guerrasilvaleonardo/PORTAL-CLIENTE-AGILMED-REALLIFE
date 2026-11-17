-- =====================================================================
-- Cadastro de EPIs da empresa.
--
-- ANTES:  o portal não conhecia equipamento de proteção. Para registrar
--         uma entrega era preciso digitar o nome do EPI e o número do CA
--         a cada vez, como acontecia com o nome das pessoas antes de
--         supabase/colaboradores.sql.
-- DEPOIS: nova tabela epis, uma linha por equipamento em cada empresa,
--         com CA, validade do CA, vida útil em dias e fabricante. Na
--         entrega, escolher o equipamento já traz o CA e calcula a data
--         da próxima troca — ninguém digita CA na pressa do almoxarifado.
-- MOTIVO: a ficha da NR-06 exige o CA de cada equipamento entregue, e o
--         CA vencido é um dos achados mais comuns de fiscalização. Com o
--         cadastro, o portal avisa antes de vencer em vez de descobrir
--         depois.
--
-- Fica de fora, de propósito: controle de estoque e kit por função. A
-- primeira entrega precisa de equipamento com CA e prazo de troca; saldo
-- de almoxarifado é outro problema, para depois.
--
-- Depende de supabase/usuarios-varias-empresas.sql (usuario_pertence_empresa).
-- Não altera nem apaga nada do que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regprocedure('public.usuario_pertence_empresa(uuid, uuid)') is null then
    raise exception 'Rode antes supabase/usuarios-varias-empresas.sql (falta a função usuario_pertence_empresa).';
  end if;
end
$$;


-- ---------- 1. Tabela -------------------------------------------------
create table if not exists public.epis (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  nome           text not null,
  tipo           text not null default 'epi',
  ca             text,
  validade_ca    date,
  vida_util_dias integer not null default 90,
  complemento    text,
  fabricante     text,
  codigo_externo text,
  observacoes    text,
  ativo          boolean not null default true,
  criado_por     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 'epi' = equipamento de proteção, com CA. 'outros' = fardamento,
-- uniforme e afins, que entram na mesma entrega mas não têm CA.
alter table public.epis drop constraint if exists epis_tipo;
alter table public.epis add constraint epis_tipo check (tipo in ('epi', 'outros'));

-- CA é só número, do jeito que sai no certificado do MTE.
alter table public.epis drop constraint if exists epis_ca_formato;
alter table public.epis add constraint epis_ca_formato check (ca is null or ca ~ '^[0-9]{1,8}$');

-- Vida útil em dias: de um dia a dez anos.
alter table public.epis drop constraint if exists epis_vida_util;
alter table public.epis add constraint epis_vida_util check (vida_util_dias between 1 and 3650);

-- O mesmo equipamento não entra duas vezes na mesma empresa. O
-- complemento faz parte da identidade: "luva vaqueta P" e "luva vaqueta
-- G" são dois cadastros, com estoques e tamanhos diferentes.
create unique index if not exists epis_empresa_item
  on public.epis (empresa_id, lower(nome), coalesce(lower(complemento), ''), coalesce(ca, ''));
create index if not exists epis_empresa on public.epis (empresa_id);
create index if not exists epis_validade_ca on public.epis (validade_ca) where validade_ca is not null;


-- ---------- 2. Ajustes e proteção dos campos ---------------------------
create or replace function public.epis_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.nome := btrim(coalesce(new.nome, ''));
  if new.nome = '' then
    raise exception 'Informe o nome do equipamento.';
  end if;

  -- CA vem com "CA", ponto ou espaço conforme quem digita; guardamos só o número.
  new.ca := nullif(regexp_replace(coalesce(new.ca, ''), '\D', '', 'g'), '');

  new.complemento    := nullif(btrim(coalesce(new.complemento, '')), '');
  new.fabricante     := nullif(btrim(coalesce(new.fabricante, '')), '');
  new.codigo_externo := nullif(btrim(coalesce(new.codigo_externo, '')), '');
  new.observacoes    := nullif(btrim(coalesce(new.observacoes, '')), '');

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

drop trigger if exists epis_ajustes on public.epis;
create trigger epis_ajustes
  before insert or update on public.epis
  for each row execute function public.epis_ajustes();


-- ---------- 3. Regras de acesso (RLS) ----------------------------------
-- Mesma regra dos colaboradores: equipe interna ativa vê todas as
-- empresas; cliente ativo, só as dele. Sem DELETE — equipamento que saiu
-- de linha é desmarcado em "ativo", para não sumir das entregas antigas.
alter table public.epis enable row level security;

create or replace function public.pode_gerir_epis(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and coalesce(p.ativo, true)
       and (p.perfil in ('atendimento', 'gestor', 'admin')
            or (p.perfil = 'cliente' and public.usuario_pertence_empresa(p.id, p_empresa)))
  );
$fn$;

revoke all on function public.pode_gerir_epis(uuid) from public, anon;
grant execute on function public.pode_gerir_epis(uuid) to authenticated;

drop policy if exists epis_leitura on public.epis;
create policy epis_leitura
  on public.epis for select to authenticated
  using (public.pode_gerir_epis(empresa_id));

drop policy if exists epis_inclusao on public.epis;
create policy epis_inclusao
  on public.epis for insert to authenticated
  with check (public.pode_gerir_epis(empresa_id));

drop policy if exists epis_alteracao on public.epis;
create policy epis_alteracao
  on public.epis for update to authenticated
  using (public.pode_gerir_epis(empresa_id))
  with check (public.pode_gerir_epis(empresa_id));

grant select, insert, update on public.epis to authenticated;
revoke delete, truncate on public.epis from anon, authenticated;
revoke all on public.epis from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.epis)                                      as epis,
       (select count(*) from public.epis where ca is not null)                 as com_ca,
       (select count(*) from public.epis
         where validade_ca is not null and validade_ca < current_date)         as ca_vencido,
       (select count(distinct empresa_id) from public.epis)                    as empresas,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'epis')                   as politicas;
