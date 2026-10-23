-- =====================================================================
-- Relatório mensal de desempenho da equipe (governança).
--
-- ANTES:  o desempenho só era visto na tela "Desempenho da equipe", com
--         números do momento, sem registro do que foi analisado em cada
--         mês nem plano de ação.
-- DEPOIS: todo dia 1º o portal gera o relatório do mês anterior (equipe e
--         ficha individual: indicadores, comparação com o mês anterior e
--         com a mediana da equipe, evidências, pontos fortes, pontos de
--         atenção, plano de ação e roteiro de conversa).
--         Os DADOS de cada relatório ficam congelados (como uma ata): não
--         podem ser alterados nem apagados. Gerar de novo cria uma nova
--         versão; refazer só o texto da análise guarda o texto anterior.
--         Só lê quem tem "acesso ao relatório de gestão": Leonardo Guerra
--         e Priscila Vanzini. Essa marcação NÃO pode ser mudada pelo
--         portal (nem por administrador); só por aqui, no SQL.
--         Cada abertura e cada PDF ficam registrados (quem e quando).
-- MOTIVO: governança do atendimento e desenvolvimento da equipe com
--         base em dados, com acesso restrito à direção.
--
-- Não apaga nem altera chamados, usuários ou estrelas. Pode rodar mais
-- de uma vez.
-- =====================================================================

alter table public.profiles
  add column if not exists acesso_relatorio_gestao boolean not null default false;

-- Ninguém muda essa marcação pelo portal (só SQL / chave de serviço).
create or replace function public.profiles_proteger_relatorio_gestao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is not null
     and new.acesso_relatorio_gestao is distinct from old.acesso_relatorio_gestao then
    new.acesso_relatorio_gestao := old.acesso_relatorio_gestao;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_proteger_relatorio_gestao on public.profiles;
create trigger profiles_proteger_relatorio_gestao
  before update on public.profiles
  for each row execute function public.profiles_proteger_relatorio_gestao();

create or replace function public.pode_ver_relatorio_gestao()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.profiles p
                  where p.id = auth.uid()
                    and p.ativo = true
                    and p.perfil in ('atendimento', 'gestor', 'admin')
                    and p.acesso_relatorio_gestao = true);
$fn$;

revoke all on function public.pode_ver_relatorio_gestao() from public, anon;
grant execute on function public.pode_ver_relatorio_gestao() to authenticated;


-- ---------- Relatórios ---------------------------------------------------
create table if not exists public.relatorios_desempenho (
  id                     bigserial primary key,
  mes                    date not null,          -- 1º dia do mês analisado
  versao                 integer not null default 1,
  periodo_ini            timestamptz not null,
  periodo_fim            timestamptz not null,   -- exclusivo
  parcial                boolean not null default false,  -- mês ainda em andamento
  gerado_em              timestamptz not null default now(),
  gerado_por             uuid references public.profiles (id) on delete set null,  -- null = automático
  dados                  jsonb not null,
  analise                jsonb,
  analise_origem         text check (analise_origem in ('ia', 'regras')),
  analise_modelo         text,
  analise_erro           text,
  analise_em             timestamptz,
  analises_anteriores    jsonb not null default '[]'::jsonb,
  unique (mes, versao)
);

create index if not exists relatorios_desempenho_mes on public.relatorios_desempenho (mes desc, versao desc);

alter table public.relatorios_desempenho enable row level security;

drop policy if exists relatorios_desempenho_leitura on public.relatorios_desempenho;
create policy relatorios_desempenho_leitura on public.relatorios_desempenho
  for select to authenticated
  using (public.pode_ver_relatorio_gestao());

revoke all on public.relatorios_desempenho from anon;
revoke all on public.relatorios_desempenho from authenticated;
grant select on public.relatorios_desempenho to authenticated;

-- Ata: dados e período não mudam e nada é apagado. Ao trocar o texto da
-- análise, o texto anterior vai para o histórico.
create or replace function public.relatorios_desempenho_ata()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'Relatório de desempenho é registro de governança e não pode ser apagado.';
  end if;

  if new.dados is distinct from old.dados
     or new.mes is distinct from old.mes
     or new.versao is distinct from old.versao
     or new.periodo_ini is distinct from old.periodo_ini
     or new.periodo_fim is distinct from old.periodo_fim
     or new.gerado_em is distinct from old.gerado_em then
    raise exception 'Os dados do relatório ficam congelados. Para recalcular, gere uma nova versão.';
  end if;

  if old.analise is not null and new.analise is distinct from old.analise then
    new.analises_anteriores := coalesce(old.analises_anteriores, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
           'analise', old.analise,
           'origem', old.analise_origem,
           'modelo', old.analise_modelo,
           'em', old.analise_em));
  end if;

  return new;
end;
$fn$;

drop trigger if exists relatorios_desempenho_ata on public.relatorios_desempenho;
create trigger relatorios_desempenho_ata
  before update or delete on public.relatorios_desempenho
  for each row execute function public.relatorios_desempenho_ata();


-- ---------- Registro de acesso -------------------------------------------
create table if not exists public.relatorios_desempenho_acessos (
  id            bigserial primary key,
  relatorio_id  bigint not null references public.relatorios_desempenho (id),
  usuario_id    uuid not null references public.profiles (id),
  acao          text not null check (acao in ('abriu', 'pdf', 'gerou', 'reanalisou')),
  em            timestamptz not null default now()
);

create index if not exists relatorios_desempenho_acessos_rel on public.relatorios_desempenho_acessos (relatorio_id, em desc);

alter table public.relatorios_desempenho_acessos enable row level security;

drop policy if exists relatorios_desempenho_acessos_leitura on public.relatorios_desempenho_acessos;
create policy relatorios_desempenho_acessos_leitura on public.relatorios_desempenho_acessos
  for select to authenticated
  using (public.pode_ver_relatorio_gestao());

revoke all on public.relatorios_desempenho_acessos from anon;
revoke all on public.relatorios_desempenho_acessos from authenticated;
grant select on public.relatorios_desempenho_acessos to authenticated;

create or replace function public.registrar_acesso_relatorio(p_relatorio bigint, p_acao text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.pode_ver_relatorio_gestao() then
    raise exception 'Acesso restrito.';
  end if;
  if p_acao not in ('abriu', 'pdf') then
    raise exception 'Ação inválida.';
  end if;
  insert into public.relatorios_desempenho_acessos (relatorio_id, usuario_id, acao)
  values (p_relatorio, auth.uid(), p_acao);
end;
$fn$;

revoke all on function public.registrar_acesso_relatorio(bigint, text) from public, anon;
grant execute on function public.registrar_acesso_relatorio(bigint, text) to authenticated;


-- ---------- Quem tem acesso ----------------------------------------------
update public.profiles
   set acesso_relatorio_gestao = true
 where perfil in ('atendimento', 'gestor', 'admin')
   and (nome ilike 'Priscila Vanzini%' or nome ilike 'Leonardo Guerra%');


-- ---------- Conferência ---------------------------------------------------
select nome, perfil, acesso_relatorio_gestao
  from public.profiles
 where acesso_relatorio_gestao
 order by nome;
