-- =====================================================================
-- Cadastro de colaboradores da empresa.
--
-- ANTES:  não existia cadastro de pessoas. O nome era digitado em cada
--         certificado (certificados.colaborador, texto livre) e o portal
--         juntava tudo pela regra de empresa + nome normalizado, ou pelo
--         CPF quando havia (supabase/certificados-cpf.sql). Funciona para
--         listar certificado, mas não sustenta nada que precise de uma
--         pessoa de verdade: matrícula, função, admissão.
-- DEPOIS: nova tabela colaboradores, uma linha por pessoa em cada
--         empresa, com nome, CPF, matrícula, função, local de trabalho,
--         admissão e situação. A tabela nasce preenchida a partir dos
--         certificados que já existem, pelas mesmas regras de
--         agrupamento, então o cliente abre a tela com a equipe dele já
--         lá, sem digitar nada.
-- MOTIVO: a entrega de EPI precisa de pessoa com CPF, matrícula e
--         função — a ficha da NR-06 exige isso, e um nome digitado
--         diferente em cada entrega não fecha histórico nenhum. O mesmo
--         cadastro arruma os certificados, onde hoje a mesma pessoa
--         aparece escrita de várias formas.
--
-- DESLIGAMENTO FICA ONDE JÁ ESTÁ. Quem saiu da empresa continua sendo
-- marcado em colaboradores_desligados, que já tira a pessoa dos cartões,
-- do painel, dos e-mails e dos avisos de treinamento. Por isso a coluna
-- situacao aqui só trata de 'ativo' e 'afastado': duas tabelas dizendo
-- quem está desligado acabariam discordando. A tela mostra as três
-- situações lendo as duas, ligadas por empresa + nome_chave.
--
-- Depende de supabase/usuarios-varias-empresas.sql (usuario_pertence_empresa)
-- e de supabase/colaboradores-desligados.sql (nome_colaborador_chave).
-- Não altera nem apaga certificados, empresas, usuários ou
-- desligamentos. Pode rodar mais de uma vez: a carga inicial só inclui
-- quem ainda não está na tabela.
-- =====================================================================

-- ---------- 0. Pré-requisitos ----------------------------------------
do $$
begin
  if to_regprocedure('public.usuario_pertence_empresa(uuid, uuid)') is null then
    raise exception 'Rode antes supabase/usuarios-varias-empresas.sql (falta a função usuario_pertence_empresa).';
  end if;
  if to_regprocedure('public.nome_colaborador_chave(text)') is null then
    raise exception 'Rode antes supabase/colaboradores-desligados.sql (falta a função nome_colaborador_chave).';
  end if;
end
$$;


-- ---------- 1. Tabela -------------------------------------------------
create table if not exists public.colaboradores (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  nome           text not null,
  nome_chave     text not null,
  cpf            text,
  matricula      text,
  funcao         text,
  local_trabalho text,
  admissao       date,
  situacao       text not null default 'ativo',
  email          text,
  telefone       text,
  observacoes    text,
  origem         text not null default 'manual',
  criado_por     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Só dígitos, 11 posições (ou vazio), igual ao CPF dos certificados.
alter table public.colaboradores drop constraint if exists colaboradores_cpf_formato;
alter table public.colaboradores
  add constraint colaboradores_cpf_formato check (cpf is null or cpf ~ '^[0-9]{11}$');

-- 'ativo' e 'afastado' só. Desligado mora em colaboradores_desligados.
alter table public.colaboradores drop constraint if exists colaboradores_situacao;
alter table public.colaboradores
  add constraint colaboradores_situacao check (situacao in ('ativo', 'afastado'));

-- De onde veio a linha: 'certificados' = carga inicial, 'manual' = cadastrada
-- no portal, 'importacao' = planilha.
alter table public.colaboradores drop constraint if exists colaboradores_origem;
alter table public.colaboradores
  add constraint colaboradores_origem check (origem in ('manual', 'certificados', 'importacao'));

-- A mesma pessoa não entra duas vezes na mesma empresa. Pelo CPF quando
-- existe; pelo nome normalizado sempre.
create unique index if not exists colaboradores_empresa_cpf
  on public.colaboradores (empresa_id, cpf) where cpf is not null;
create unique index if not exists colaboradores_empresa_nome
  on public.colaboradores (empresa_id, nome_chave);
create index if not exists colaboradores_empresa on public.colaboradores (empresa_id);


-- ---------- 2. Ajustes e proteção dos campos ---------------------------
-- Nome sem espaços nas pontas e chave preenchida; CPF sem pontuação;
-- textos em branco viram vazio, para não guardar ' '. Empresa e autor não
-- mudam depois de criados.
create or replace function public.colaboradores_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.nome := btrim(coalesce(new.nome, ''));
  if new.nome = '' then
    raise exception 'Informe o nome do colaborador.';
  end if;
  new.nome_chave := public.nome_colaborador_chave(new.nome);

  new.cpf := nullif(regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g'), '');
  if new.cpf is not null and length(new.cpf) = 10 then
    new.cpf := '0' || new.cpf;
  end if;

  new.matricula      := nullif(btrim(coalesce(new.matricula, '')), '');
  new.funcao         := nullif(btrim(coalesce(new.funcao, '')), '');
  new.local_trabalho := nullif(btrim(coalesce(new.local_trabalho, '')), '');
  new.email          := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.telefone       := nullif(btrim(coalesce(new.telefone, '')), '');
  new.observacoes    := nullif(btrim(coalesce(new.observacoes, '')), '');

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.created_at := now();
  else
    new.empresa_id := old.empresa_id;
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
    new.origem     := old.origem;
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists colaboradores_ajustes on public.colaboradores;
create trigger colaboradores_ajustes
  before insert or update on public.colaboradores
  for each row execute function public.colaboradores_ajustes();


-- ---------- 3. Regras de acesso (RLS) ----------------------------------
-- Mesma regra dos desligamentos: equipe interna ativa vê todas as
-- empresas; cliente ativo, só as empresas dele. Sem política de DELETE —
-- ninguém apaga pessoa pelo portal; quem saiu é marcado como desligado.
alter table public.colaboradores enable row level security;

create or replace function public.pode_gerir_colaboradores(p_empresa uuid)
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

revoke all on function public.pode_gerir_colaboradores(uuid) from public, anon;
grant execute on function public.pode_gerir_colaboradores(uuid) to authenticated;

drop policy if exists colaboradores_leitura on public.colaboradores;
create policy colaboradores_leitura
  on public.colaboradores for select to authenticated
  using (public.pode_gerir_colaboradores(empresa_id));

drop policy if exists colaboradores_inclusao on public.colaboradores;
create policy colaboradores_inclusao
  on public.colaboradores for insert to authenticated
  with check (public.pode_gerir_colaboradores(empresa_id));

drop policy if exists colaboradores_alteracao on public.colaboradores;
create policy colaboradores_alteracao
  on public.colaboradores for update to authenticated
  using (public.pode_gerir_colaboradores(empresa_id))
  with check (public.pode_gerir_colaboradores(empresa_id));

grant select, insert, update on public.colaboradores to authenticated;
revoke delete, truncate on public.colaboradores from anon, authenticated;
revoke all on public.colaboradores from anon;


-- ---------- 4. Carga inicial a partir dos certificados -----------------
-- Uma linha por pessoa de cada empresa. A pessoa é reconhecida pelo CPF
-- quando ele existe; senão, pelo nome normalizado — as mesmas regras que
-- lib/historicoCertificados.ts já usa para montar o histórico.
--
-- Função e matrícula vêm do certificado mais recente da pessoa, que é o
-- dado mais confiável que temos. Nada é sobrescrito: quem já está na
-- tabela não é tocado.
with base as (
  select c.empresa_id,
         btrim(c.colaborador)                              as nome,
         public.nome_colaborador_chave(c.colaborador)      as nome_chave,
         nullif(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g'), '') as cpf,
         nullif(btrim(coalesce(c.funcao, '')), '')         as funcao,
         nullif(lower(btrim(coalesce(c.email_colaborador, ''))), '') as email,
         coalesce(c.emissao, '1900-01-01'::date)           as quando
    from public.certificados c
   where c.empresa_id is not null
     and nullif(btrim(coalesce(c.colaborador, '')), '') is not null
),
-- Um CPF por pessoa: se a mesma pessoa tem certificados com e sem CPF,
-- vale o CPF encontrado.
comcpf as (
  select distinct on (empresa_id, cpf)
         empresa_id, cpf, nome, nome_chave, funcao, email
    from base
   where cpf is not null
   order by empresa_id, cpf, quando desc
),
-- Quem não tem CPF em certificado nenhum entra pelo nome.
semcpf as (
  select distinct on (empresa_id, nome_chave)
         empresa_id, null::text as cpf, nome, nome_chave, funcao, email
    from base b
   where b.cpf is null
     and not exists (
       select 1 from base x
        where x.empresa_id = b.empresa_id
          and x.nome_chave = b.nome_chave
          and x.cpf is not null
     )
   order by empresa_id, nome_chave, quando desc
),
pessoas as (
  select * from comcpf
  union all
  select * from semcpf
)
insert into public.colaboradores (empresa_id, nome, nome_chave, cpf, funcao, email, origem)
select p.empresa_id, p.nome, p.nome_chave, p.cpf, p.funcao, p.email, 'certificados'
  from pessoas p
 where not exists (
         select 1 from public.colaboradores k
          where k.empresa_id = p.empresa_id
            and (k.nome_chave = p.nome_chave
                 or (p.cpf is not null and k.cpf = p.cpf))
       )
on conflict do nothing;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.colaboradores)                               as colaboradores,
       (select count(*) from public.colaboradores where cpf is not null)         as com_cpf,
       (select count(*) from public.colaboradores where origem = 'certificados') as da_carga_inicial,
       (select count(distinct empresa_id) from public.colaboradores)             as empresas,
       (select count(*) from public.colaboradores k
          join public.colaboradores_desligados d
            on d.empresa_id = k.empresa_id
           and d.nome_chave = k.nome_chave
           and d.reativado_em is null)                                           as ja_desligados,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'colaboradores')            as politicas;
