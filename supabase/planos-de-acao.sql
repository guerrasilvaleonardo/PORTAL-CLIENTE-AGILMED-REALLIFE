-- ---------------------------------------------------------------
-- Planos de ação: o tratamento da não conformidade vira entidade.
--
-- O QUE ESTAVA ERRADO. A não conformidade tinha UMA ação corretiva,
-- um prazo e um responsável, em três campos de texto. Na vida real
-- um desvio sério gera várias ações, de naturezas diferentes e com
-- donos diferentes: isolar a área hoje, mudar o procedimento no mês
-- que vem, estender a lição para as outras frentes. Espremer isso em
-- um campo só obriga quem preenche a escolher qual ação registrar — e
-- as outras simplesmente não existem para o sistema, logo não vencem,
-- não cobram ninguém e não aparecem em relatório nenhum.
--
-- OS QUATRO TIPOS, e por que a lista é fechada. São o vocabulário da
-- ISO 9001/45001 (8.7, 10.2) e o que um auditor procura:
--   correcao   — resolve o que está na frente, agora. Não ataca causa.
--   corretiva  — ataca a causa-raiz desta NC, para não voltar.
--   preventiva — estende a lição para onde ainda não aconteceu.
--   verificacao— confere, depois, se o que foi feito funcionou.
-- Texto livre aqui viria "Correção", "correção", "ação corretiva" e
-- "corrigir", e nenhum gráfico sairia disso.
--
-- OS CAMPOS ANTIGOS DA NC CONTINUAM. Nada é apagado e nada é migrado
-- à força: NC antiga segue legível como está, e a tela mostra o campo
-- velho quando não há ação nenhuma cadastrada. Apagar texto que o
-- cliente escreveu para caber num modelo novo não se faz.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- Antes das ações: a não conformidade ganha número.
--
-- POR QUE. Sem código, falar de uma NC exige reler a descrição
-- inteira, e o relatório impresso não tem como ser citado em ata, em
-- e-mail, nem numa auditoria ("mostre-me o tratamento da NC-2026-0007").
-- É o mesmo motivo que já levou o relatório de visita a ter código.
--
-- COMO. Sequência por empresa, por tipo e por ano, sem buraco e sem
-- repetição — a trava de transação garante que duas pessoas apontando
-- ao mesmo tempo não recebam o mesmo número. Inspeção usa NC;
-- auditoria usa CA (constatação de auditoria), porque são dois
-- processos distintos e misturar as sequências esconde se faltou uma.
--
-- AS NCs QUE JÁ EXISTEM recebem número agora, na ordem em que foram
-- criadas. Nada do que foi escrito é alterado: só se preenche um campo
-- que estava vazio porque ainda não existia.
-- ---------------------------------------------------------------

alter table public.nao_conformidades
  add column if not exists ano    integer,
  add column if not exists numero integer,
  add column if not exists codigo text;

create unique index if not exists nc_codigo_unico
  on public.nao_conformidades (empresa_id, tipo, ano, numero)
  where numero is not null;

create or replace function public.nc_numerar()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ano     integer;
  v_prefixo text;
  v_seq     integer;
begin
  if new.codigo is not null then
    return new;
  end if;

  v_ano := extract(year from coalesce(new.created_at, now()))::integer;
  v_prefixo := case when coalesce(new.tipo, 'inspecao') = 'auditoria' then 'CA' else 'NC' end;

  perform pg_advisory_xact_lock(hashtext(new.empresa_id::text || v_prefixo || v_ano::text));

  select coalesce(max(numero), 0) + 1
    into v_seq
    from public.nao_conformidades
   where empresa_id = new.empresa_id
     and coalesce(tipo, 'inspecao') = coalesce(new.tipo, 'inspecao')
     and ano = v_ano;

  new.ano := v_ano;
  new.numero := v_seq;
  new.codigo := v_prefixo || '-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');

  return new;
end;
$fn$;

drop trigger if exists nc_numerar on public.nao_conformidades;
create trigger nc_numerar
  before insert on public.nao_conformidades
  for each row execute function public.nc_numerar();

-- As que já existem, na ordem em que nasceram.
with ordenadas as (
  select
    id,
    extract(year from created_at)::integer as ano_criacao,
    case when coalesce(tipo, 'inspecao') = 'auditoria' then 'CA' else 'NC' end as prefixo,
    row_number() over (
      partition by empresa_id, coalesce(tipo, 'inspecao'), extract(year from created_at)
      order by created_at, id
    ) as seq
  from public.nao_conformidades
  where numero is null
)
update public.nao_conformidades n
   set ano = o.ano_criacao,
       numero = o.seq,
       codigo = o.prefixo || '-' || o.ano_criacao::text || '-' || lpad(o.seq::text, 4, '0')
  from ordenadas o
 where o.id = n.id;

create table if not exists public.nc_acoes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  nc_id         uuid not null references public.nao_conformidades (id) on delete cascade,

  -- O "#" que sai no relatório impresso. Serve para conversar sobre a
  -- ação sem reler a descrição inteira ("a 3 está atrasada").
  ordem         integer not null default 1,

  tipo          text not null default 'corretiva'
                check (tipo in ('correcao', 'corretiva', 'preventiva', 'verificacao')),
  descricao     text not null,

  responsavel_id   uuid references public.profiles (id) on delete set null,
  -- Congelado: o responsável pode sair da empresa, e o relatório
  -- emitido precisa continuar dizendo de quem era a ação.
  responsavel_nome text,
  prazo         date,

  situacao      text not null default 'aberta'
                check (situacao in ('aberta', 'execucao', 'verificacao', 'encerrada', 'cancelada')),
  concluida_em  timestamptz,

  -- Eficácia só tem resposta depois de verificada. Nulo = ainda não
  -- se sabe, e é diferente de "não funcionou".
  eficaz           boolean,
  verificacao_obs  text,
  verificada_em    timestamptz,
  verificada_por   uuid references public.profiles (id) on delete set null,

  notas         text,
  criada_por    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- A lista da NC abre por ordem; o painel varre por prazo.
create index if not exists nc_acoes_por_nc
  on public.nc_acoes (nc_id, ordem);

create index if not exists nc_acoes_por_prazo
  on public.nc_acoes (empresa_id, situacao, prazo);

-- Atrasadas: o índice parcial atende a pergunta mais repetida do
-- módulo ("o que venceu e ninguém fechou") sem varrer o resto.
create index if not exists nc_acoes_em_aberto
  on public.nc_acoes (empresa_id, prazo)
  where situacao in ('aberta', 'execucao', 'verificacao');

create or replace function public.nc_acoes_tocar()
returns trigger
language plpgsql
as $fn$
begin
  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists nc_acoes_tocar on public.nc_acoes;
create trigger nc_acoes_tocar
  before update on public.nc_acoes
  for each row execute function public.nc_acoes_tocar();

alter table public.nc_acoes enable row level security;

-- Mesma regra da não conformidade a que a ação pertence: quem pode
-- gerir inspeções da empresa gere as ações dela. Sem política própria
-- aqui, a tabela ficaria aberta ou fechada demais, e as duas coisas
-- dão o mesmo tipo de susto.
drop policy if exists nc_acoes_ler on public.nc_acoes;
create policy nc_acoes_ler on public.nc_acoes
  for select using (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists nc_acoes_inserir on public.nc_acoes;
create policy nc_acoes_inserir on public.nc_acoes
  for insert with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists nc_acoes_alterar on public.nc_acoes;
create policy nc_acoes_alterar on public.nc_acoes
  for update using (public.pode_gerir_inspecoes(empresa_id))
  with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists nc_acoes_apagar on public.nc_acoes;
create policy nc_acoes_apagar on public.nc_acoes
  for delete using (public.pode_gerir_inspecoes(empresa_id));
