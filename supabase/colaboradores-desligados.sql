-- =====================================================================
-- Colaborador desligado (inativo) em Certificados.
--
-- ANTES:  quem saiu da empresa continuava com os certificados aparecendo
--         como "Vencido" ou "Vence em X dias", somando nos cartões e no
--         painel, entrando no Boletim de Antecedência e no aviso diário
--         de treinamentos. Não havia como dizer "esta pessoa saiu".
-- DEPOIS: nova tabela colaboradores_desligados. A equipe (atendimento,
--         gestor, admin) e o cliente (só nas empresas dele) marcam uma
--         pessoa como desligada, com a data e um motivo opcional. Os
--         certificados dela saem da lista (dá para mostrar de novo com
--         "Mostrar desligados"), dos cartões, do painel, dos e-mails e
--         dos avisos de treinamento. "Reativar" não apaga nada: grava a
--         data e quem reativou na mesma linha, que fica como histórico.
--         Não existe cadastro de colaboradores: a pessoa é a mesma regra
--         do histórico de certificados (empresa + nome em maiúsculas, sem
--         acento e com espaços simples, lib/historicoCertificados.ts).
-- MOTIVO: parar alertas e contagens de quem não trabalha mais na empresa
--         sem apagar os certificados dela.
--
-- Depende de supabase/usuarios-varias-empresas.sql (função
-- usuario_pertence_empresa). Não altera nem apaga certificados, empresas
-- ou usuários. Sem política de exclusão: ninguém apaga linhas pelo
-- portal. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito -----------------------------------------
do $$
begin
  if to_regprocedure('public.usuario_pertence_empresa(uuid, uuid)') is null then
    raise exception 'Rode antes supabase/usuarios-varias-empresas.sql (falta a função usuario_pertence_empresa).';
  end if;
end
$$;


-- ---------- 1. Tabela -------------------------------------------------
create table if not exists public.colaboradores_desligados (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  nome           text not null,
  nome_chave     text not null,
  desligado_em   date not null default current_date,
  motivo         text,
  criado_por     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  reativado_em   timestamptz,
  reativado_por  uuid references public.profiles (id) on delete set null
);

-- Colunas da reativação, caso a tabela tenha sido criada sem elas.
alter table public.colaboradores_desligados add column if not exists reativado_em timestamptz;
alter table public.colaboradores_desligados
  add column if not exists reativado_por uuid references public.profiles (id) on delete set null;

-- Uma pessoa só pode estar desligada uma vez ao mesmo tempo. As linhas
-- reativadas ficam como histórico e não entram nesta regra.
create unique index if not exists colaboradores_desligados_ativo
  on public.colaboradores_desligados (empresa_id, nome_chave)
  where reativado_em is null;

create index if not exists colaboradores_desligados_empresa
  on public.colaboradores_desligados (empresa_id);


-- ---------- 2. Nome normalizado ---------------------------------------
-- Mesma regra de normalizarTexto() em lib/historicoCertificados.ts:
-- maiúsculas, sem acento e com espaços simples. O portal já envia a
-- chave pronta; esta função só preenche quando ela vier vazia.
create or replace function public.nome_colaborador_chave(p_nome text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select btrim(regexp_replace(
           translate(upper(coalesce(p_nome, '')),
                     'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝáàâãäåéèêëíìîïóòôõöúùûüçñý',
                     'AAAAAAEEEEIIIIOOOOOUUUUCNYAAAAAAEEEEIIIIOOOOOUUUUCNY'),
           '\s+', ' ', 'g'));
$fn$;


-- ---------- 3. Ajustes e proteção dos campos ---------------------------
-- Inserção: nome sem espaços nas pontas, chave preenchida, autor = quem
-- está logado, nunca entra já reativado.
-- Alteração: empresa, pessoa, autor e data de criação não mudam. Linha
-- reativada não volta a valer (marcar de novo cria outra linha). Quem
-- reativa fica registrado.
create or replace function public.colaboradores_desligados_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    new.nome := btrim(new.nome);
    if new.nome = '' then
      raise exception 'Informe o nome do colaborador.';
    end if;
    new.nome_chave := coalesce(nullif(btrim(new.nome_chave), ''), public.nome_colaborador_chave(new.nome));
    new.desligado_em := coalesce(new.desligado_em, current_date);
    new.motivo := nullif(btrim(coalesce(new.motivo, '')), '');
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.created_at := now();
    new.reativado_em := null;
    new.reativado_por := null;
    return new;
  end if;

  if old.reativado_em is not null then
    raise exception 'Este desligamento já foi encerrado (colaborador reativado). Marque como desligado de novo, se for o caso.';
  end if;

  new.id := old.id;
  new.empresa_id := old.empresa_id;
  new.nome := old.nome;
  new.nome_chave := old.nome_chave;
  new.criado_por := old.criado_por;
  new.created_at := old.created_at;
  new.motivo := nullif(btrim(coalesce(new.motivo, '')), '');

  if new.reativado_em is not null then
    new.reativado_em := now();
    new.reativado_por := coalesce(auth.uid(), new.reativado_por);
  else
    new.reativado_por := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists colaboradores_desligados_ajustes on public.colaboradores_desligados;
create trigger colaboradores_desligados_ajustes
  before insert or update on public.colaboradores_desligados
  for each row execute function public.colaboradores_desligados_ajustes();


-- ---------- 4. Regras de acesso (RLS) ----------------------------------
-- Equipe interna ativa: todas as empresas. Cliente ativo: só empresas a
-- que pertence (usuario_pertence_empresa, a mesma regra de participante e
-- solicitante de chamado, que aceita qualquer empresa da pessoa).
-- Sem política de DELETE: ninguém apaga pelo portal.
alter table public.colaboradores_desligados enable row level security;

create or replace function public.pode_gerir_desligados(p_empresa uuid)
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

revoke all on function public.pode_gerir_desligados(uuid) from public, anon;
grant execute on function public.pode_gerir_desligados(uuid) to authenticated;

drop policy if exists colaboradores_desligados_leitura on public.colaboradores_desligados;
create policy colaboradores_desligados_leitura
  on public.colaboradores_desligados for select to authenticated
  using (public.pode_gerir_desligados(empresa_id));

drop policy if exists colaboradores_desligados_inclusao on public.colaboradores_desligados;
create policy colaboradores_desligados_inclusao
  on public.colaboradores_desligados for insert to authenticated
  with check (public.pode_gerir_desligados(empresa_id));

drop policy if exists colaboradores_desligados_alteracao on public.colaboradores_desligados;
create policy colaboradores_desligados_alteracao
  on public.colaboradores_desligados for update to authenticated
  using (public.pode_gerir_desligados(empresa_id))
  with check (public.pode_gerir_desligados(empresa_id));

grant select, insert, update on public.colaboradores_desligados to authenticated;
revoke delete, truncate on public.colaboradores_desligados from anon, authenticated;
revoke all on public.colaboradores_desligados from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.colaboradores_desligados where reativado_em is null) as desligados_ativos,
       (select count(*) from public.colaboradores_desligados where reativado_em is not null) as reativados,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'colaboradores_desligados') as politicas;
