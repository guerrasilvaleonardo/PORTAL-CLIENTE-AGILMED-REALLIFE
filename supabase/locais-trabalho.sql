-- =====================================================================
-- Locais de trabalho: obras, frentes, unidades e setores de uma empresa.
--
-- ANTES:  o portal era plano — um nível só, o CNPJ. O local em que a
--         pessoa trabalha era texto livre em colaboradores.local_trabalho,
--         então "Obra Jardins", "obra jardins" e "OBRA JARDINS" eram três
--         lugares diferentes, não dava para filtrar entrega por frente nem
--         tirar ficha de uma obra só.
-- DEPOIS: nova tabela locais_trabalho, uma linha por lugar dentro da
--         empresa, com tipo (obra, frente, unidade, setor), endereço, CNO
--         e responsável. colaboradores.local_id aponta para ela, e a
--         entrega de EPI guarda o nome do local do jeito que estava na
--         hora (epi_entregas.local_nome).
-- MOTIVO: o OnSafety trabalha em dois níveis — 34 empregadores e 63
--         estabelecimentos — e o portal só tinha o de cima. Estabelecimento
--         com CNPJ próprio continua sendo outra empresa aqui; esta tabela
--         é o nível de baixo, a frente de trabalho dentro do mesmo CNPJ.
--
-- O TEXTO ANTIGO NÃO É APAGADO. colaboradores.local_trabalho continua
-- onde está e vira o rótulo de quem ainda não foi ligado a um local. A
-- carga inicial cria um local para cada texto distinto da empresa e já
-- liga os colaboradores — ninguém precisa redigitar.
--
-- Depende de supabase/colaboradores.sql. Não altera nem apaga nada do que
-- já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.colaboradores') is null then
    raise exception 'Rode antes supabase/colaboradores.sql (falta a tabela colaboradores).';
  end if;
  if to_regprocedure('public.pode_gerir_colaboradores(uuid)') is null then
    raise exception 'Rode antes supabase/colaboradores.sql (falta pode_gerir_colaboradores).';
  end if;
end
$$;


-- ---------- 1. Tabela -------------------------------------------------
create table if not exists public.locais_trabalho (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  nome          text not null,
  tipo          text not null default 'obra',
  endereco      text,
  cidade_uf     text,
  -- Cadastro Nacional de Obras, quando é canteiro (NR-18, eSocial).
  cno           text,
  responsavel   text,
  observacoes   text,
  ativo         boolean not null default true,
  criado_por    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.locais_trabalho drop constraint if exists locais_trabalho_tipo;
alter table public.locais_trabalho
  add constraint locais_trabalho_tipo check (tipo in ('obra', 'frente', 'unidade', 'setor'));

-- O mesmo lugar não entra duas vezes na mesma empresa.
create unique index if not exists locais_trabalho_empresa_nome
  on public.locais_trabalho (empresa_id, lower(nome));
create index if not exists locais_trabalho_empresa on public.locais_trabalho (empresa_id);


-- ---------- 2. Ajustes e proteção dos campos ---------------------------
create or replace function public.locais_trabalho_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.nome := btrim(coalesce(new.nome, ''));
  if new.nome = '' then
    raise exception 'Informe o nome do local.';
  end if;

  new.endereco    := nullif(btrim(coalesce(new.endereco, '')), '');
  new.cidade_uf   := nullif(btrim(coalesce(new.cidade_uf, '')), '');
  new.cno         := nullif(regexp_replace(coalesce(new.cno, ''), '\D', '', 'g'), '');
  new.responsavel := nullif(btrim(coalesce(new.responsavel, '')), '');
  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

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

drop trigger if exists locais_trabalho_ajustes on public.locais_trabalho;
create trigger locais_trabalho_ajustes
  before insert or update on public.locais_trabalho
  for each row execute function public.locais_trabalho_ajustes();


-- ---------- 3. Regras de acesso (RLS) ----------------------------------
-- Reusa pode_gerir_colaboradores: o local é atributo de quem trabalha na
-- empresa, e quem cuida de um cuida do outro. Sem DELETE — lugar que
-- fechou vira ativo = false e some das listas, sem sumir do histórico.
alter table public.locais_trabalho enable row level security;

drop policy if exists locais_trabalho_leitura on public.locais_trabalho;
create policy locais_trabalho_leitura
  on public.locais_trabalho for select to authenticated
  using (public.pode_gerir_colaboradores(empresa_id));

drop policy if exists locais_trabalho_inclusao on public.locais_trabalho;
create policy locais_trabalho_inclusao
  on public.locais_trabalho for insert to authenticated
  with check (public.pode_gerir_colaboradores(empresa_id));

drop policy if exists locais_trabalho_alteracao on public.locais_trabalho;
create policy locais_trabalho_alteracao
  on public.locais_trabalho for update to authenticated
  using (public.pode_gerir_colaboradores(empresa_id))
  with check (public.pode_gerir_colaboradores(empresa_id));

grant select, insert, update on public.locais_trabalho to authenticated;
revoke delete, truncate on public.locais_trabalho from anon, authenticated;
revoke all on public.locais_trabalho from anon;


-- ---------- 4. Ligações -----------------------------------------------
alter table public.colaboradores
  add column if not exists local_id uuid references public.locais_trabalho (id) on delete set null;
create index if not exists colaboradores_local on public.colaboradores (local_id);

-- Na entrega, o local fica congelado como o CA e o prazo: a pessoa muda
-- de obra, e a ficha precisa dizer onde ela estava naquele dia.
do $$
begin
  if to_regclass('public.epi_entregas') is not null then
    alter table public.epi_entregas add column if not exists local_nome text;
  end if;
end
$$;


-- ---------- 5. Carga inicial a partir do texto que já existe -----------
-- Um local por texto distinto de cada empresa. O tipo entra como 'obra',
-- que é o caso mais comum de quem usa EPI; a tela deixa corrigir.
insert into public.locais_trabalho (empresa_id, nome, tipo)
select distinct c.empresa_id, btrim(c.local_trabalho), 'obra'
  from public.colaboradores c
 where nullif(btrim(coalesce(c.local_trabalho, '')), '') is not null
   and not exists (
         select 1 from public.locais_trabalho l
          where l.empresa_id = c.empresa_id
            and lower(l.nome) = lower(btrim(c.local_trabalho))
       )
on conflict do nothing;

-- Liga quem ainda não está ligado.
update public.colaboradores c
set local_id = l.id
from public.locais_trabalho l
where c.local_id is null
  and l.empresa_id = c.empresa_id
  and lower(l.nome) = lower(btrim(coalesce(c.local_trabalho, '')))
  and nullif(btrim(coalesce(c.local_trabalho, '')), '') is not null;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.locais_trabalho)                            as locais,
       (select count(distinct empresa_id) from public.locais_trabalho)           as empresas,
       (select count(*) from public.colaboradores where local_id is not null)    as colaboradores_ligados,
       (select count(*) from public.colaboradores
         where local_id is null
           and nullif(btrim(coalesce(local_trabalho, '')), '') is not null)      as com_texto_sem_local,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'locais_trabalho')          as politicas;
