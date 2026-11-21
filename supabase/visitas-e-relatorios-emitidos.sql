-- =====================================================================
-- A visita vira registro, e todo relatório emitido ganha código.
--
-- MOTIVO: pedido dele em 21/11/2026. "relatórios de inspeção deve gerar
-- todos os relatórios realizados (...) todo relatório tem que seguir um
-- padrão com data hora e código individual para que eu possa imprimir e
-- cumprir requisitos de ISO, ter qualificação técnica."
--
-- O PROBLEMA QUE VEM ANTES DO PEDIDO. A visita não existia. Apontar
-- cinco coisas no cliente criava cinco não conformidades soltas, e o
-- agrupamento "esta visita" vivia só na memória da tela — fechou o
-- navegador, acabou. Não havia o que listar como "relatórios
-- realizados", porque nunca houve relatório: houve impressão de tela.
--
-- POR QUE O CÓDIGO É RESERVADO NO ENCERRAMENTO, E NÃO NA IMPRESSÃO.
-- Reservado na impressão, duas pessoas imprimindo ao mesmo tempo pegam
-- o mesmo número. Reservado no encerramento da visita, o código é do
-- EVENTO: a visita aconteceu uma vez, tem um código para sempre, e
-- reimprimir não inventa documento novo.
--
-- REIMPRIMIR DEPOIS DE MUDANÇA GERA REVISÃO, não código novo. Decisão
-- dele, e é o que a ISO 7.5.2 espera: o código identifica o documento,
-- a revisão conta quantas vezes ele mudou. Código novo a cada impressão
-- deixaria o cliente com duas folhas sem saber qual substitui qual.
--
-- DOIS PREFIXOS PORQUE SÃO DOIS DOCUMENTOS. RIC é o relatório da visita,
-- que fica com o cliente na saída. RIP é o consolidado do período, que
-- vai para a reunião. Numeração única faria "o relatório 0007" ser
-- ambíguo quando alguém pede por telefone.
--
-- A SEQUÊNCIA É POR EMPRESA E POR ANO. Cliente não quer receber o
-- relatório número 4.312 — quer o sétimo dele no ano. E numeração
-- global vazaria o tamanho da carteira para quem recebe o documento.
--
-- Depende de supabase/inspecoes.sql (pode_gerir_inspecoes, eh_equipe) e
-- de supabase/locais-trabalho.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 1. A visita -------------------------------------------------
create table if not exists public.inspecao_visitas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  local_id      uuid references public.locais_trabalho (id) on delete set null,
  -- Congelado: o local pode ser renomeado ou desativado depois, e o
  -- relatório emitido precisa continuar dizendo onde foi.
  local_nome    text,
  responsavel_id   uuid references public.profiles (id) on delete set null,
  responsavel_nome text,
  iniciada_em   timestamptz not null default now(),
  encerrada_em  timestamptz,
  situacao      text not null default 'em_andamento',
  -- Onde o aparelho estava quando a visita começou.
  latitude      numeric(10, 7),
  longitude     numeric(10, 7),
  precisao_m    integer,
  observacoes   text,
  -- Ciência do responsável pela área, colhida na saída. É o que
  -- transforma a folha entregue em evidência de comunicação.
  ciente_nome   text,
  ciente_cargo  text,
  ciente_em     timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.inspecao_visitas drop constraint if exists inspecao_visitas_situacao;
alter table public.inspecao_visitas
  add constraint inspecao_visitas_situacao
  check (situacao in ('em_andamento', 'encerrada', 'cancelada'));

create index if not exists inspecao_visitas_empresa
  on public.inspecao_visitas (empresa_id, iniciada_em desc);

/* O apontamento passa a saber de que visita veio. Fica opcional: os
   registros que já existem não vieram de visita nenhuma, e as outras
   telas que escrevem nesta tabela (checklist, incidente, auditoria)
   continuam sem ela. */
alter table public.nao_conformidades
  add column if not exists visita_id uuid references public.inspecao_visitas (id) on delete set null;

create index if not exists nao_conformidades_visita
  on public.nao_conformidades (visita_id)
  where visita_id is not null;

/* A inspeção com checklist respondida dentro de uma visita. */
alter table public.inspecoes
  add column if not exists visita_id uuid references public.inspecao_visitas (id) on delete set null;

create index if not exists inspecoes_visita
  on public.inspecoes (visita_id)
  where visita_id is not null;


-- ---------- 2. Os relatórios emitidos -----------------------------------
create table if not exists public.relatorios_emitidos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  tipo        text not null,
  prefixo     text not null,
  ano         integer not null,
  sequencia   integer not null,
  -- Montado na gravação: RIC-2026-0007. Guardado pronto porque é o que
  -- o cliente lê, cita por telefone e procura depois.
  codigo      text not null,
  revisao     integer not null default 1,
  visita_id   uuid references public.inspecao_visitas (id) on delete set null,
  inspecao_id uuid references public.inspecoes (id) on delete set null,
  periodo_de  date,
  periodo_ate date,
  emitido_por      uuid references public.profiles (id) on delete set null,
  emitido_por_nome text,
  emitido_em  timestamptz not null default now(),
  revisado_em timestamptz,
  -- Os números do documento, congelados na emissão. O relatório
  -- reimpresso daqui a um ano precisa dizer o que dizia — e não o que
  -- os dados viraram desde então.
  resumo      jsonb,
  created_at  timestamptz not null default now()
);

alter table public.relatorios_emitidos drop constraint if exists relatorios_emitidos_tipo;
alter table public.relatorios_emitidos
  add constraint relatorios_emitidos_tipo
  check (tipo in ('visita', 'periodo', 'inspecao', 'auditoria'));

create unique index if not exists relatorios_emitidos_sequencia
  on public.relatorios_emitidos (empresa_id, prefixo, ano, sequencia);

create unique index if not exists relatorios_emitidos_codigo
  on public.relatorios_emitidos (empresa_id, codigo);

create index if not exists relatorios_emitidos_lista
  on public.relatorios_emitidos (empresa_id, emitido_em desc);


-- ---------- 3. A numeração ----------------------------------------------
/*
 * Reserva o próximo número da empresa, naquele prefixo, naquele ano.
 *
 * O TRAVA É O PONTO DA FUNÇÃO. Duas pessoas encerrando visita no mesmo
 * segundo leriam o mesmo "último número" e gravariam o mesmo código —
 * e o índice único recusaria a segunda, com a visita já encerrada e
 * sem documento. O advisory lock segura a segunda por milissegundos,
 * até a primeira gravar.
 *
 * Devolve a linha inteira para quem chamou não precisar buscar de novo.
 */
create or replace function public.emitir_relatorio(
  p_empresa     uuid,
  p_tipo        text,
  p_prefixo     text,
  p_visita      uuid default null,
  p_inspecao    uuid default null,
  p_de          date default null,
  p_ate         date default null,
  p_resumo      jsonb default null
)
returns public.relatorios_emitidos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ano   integer := extract(year from now())::integer;
  v_seq   integer;
  v_nome  text;
  v_linha public.relatorios_emitidos;
begin
  if not public.pode_gerir_inspecoes(p_empresa) then
    raise exception 'Sem permissão para emitir relatório desta empresa.';
  end if;

  /* Um emissor por vez, por empresa + prefixo + ano. */
  perform pg_advisory_xact_lock(hashtext(p_empresa::text || p_prefixo || v_ano::text));

  select coalesce(max(sequencia), 0) + 1
    into v_seq
    from public.relatorios_emitidos
   where empresa_id = p_empresa and prefixo = p_prefixo and ano = v_ano;

  select nome into v_nome from public.profiles where id = auth.uid();

  insert into public.relatorios_emitidos
    (empresa_id, tipo, prefixo, ano, sequencia, codigo, visita_id, inspecao_id,
     periodo_de, periodo_ate, emitido_por, emitido_por_nome, resumo)
  values
    (p_empresa, p_tipo, p_prefixo, v_ano, v_seq,
     p_prefixo || '-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0'),
     p_visita, p_inspecao, p_de, p_ate, auth.uid(), v_nome, p_resumo)
  returning * into v_linha;

  return v_linha;
end;
$fn$;

revoke all on function public.emitir_relatorio(uuid, text, text, uuid, uuid, date, date, jsonb) from public, anon;
grant execute on function public.emitir_relatorio(uuid, text, text, uuid, uuid, date, date, jsonb) to authenticated;


/*
 * Nova revisão de um relatório que já existe. O código não muda; o
 * número da revisão sobe e a data da revisão é registrada.
 */
create or replace function public.revisar_relatorio(p_relatorio uuid, p_resumo jsonb default null)
returns public.relatorios_emitidos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_linha public.relatorios_emitidos;
begin
  select * into v_linha from public.relatorios_emitidos where id = p_relatorio;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;
  if not public.pode_gerir_inspecoes(v_linha.empresa_id) then
    raise exception 'Sem permissão para revisar este relatório.';
  end if;

  update public.relatorios_emitidos
     set revisao = revisao + 1,
         revisado_em = now(),
         resumo = coalesce(p_resumo, resumo)
   where id = p_relatorio
  returning * into v_linha;

  return v_linha;
end;
$fn$;

revoke all on function public.revisar_relatorio(uuid, jsonb) from public, anon;
grant execute on function public.revisar_relatorio(uuid, jsonb) to authenticated;


-- ---------- 4. Quem enxerga o quê ---------------------------------------
alter table public.inspecao_visitas enable row level security;
alter table public.relatorios_emitidos enable row level security;

drop policy if exists inspecao_visitas_leitura on public.inspecao_visitas;
create policy inspecao_visitas_leitura
  on public.inspecao_visitas for select to authenticated
  using (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists inspecao_visitas_escrita on public.inspecao_visitas;
create policy inspecao_visitas_escrita
  on public.inspecao_visitas for all to authenticated
  using (public.pode_gerir_inspecoes(empresa_id))
  with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists relatorios_emitidos_leitura on public.relatorios_emitidos;
create policy relatorios_emitidos_leitura
  on public.relatorios_emitidos for select to authenticated
  using (public.pode_gerir_inspecoes(empresa_id));

/*
 * Não há política de inserção: relatório só nasce pela função, que
 * confere a permissão e segura a numeração. Deixar a tela inserir
 * direto abriria caminho para código fora de sequência — e código fora
 * de sequência é o fim da utilidade dele.
 */


-- ---------- Conferência -------------------------------------------------
select (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name in ('inspecao_visitas', 'relatorios_emitidos'))        as tabelas,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'nao_conformidades'
           and column_name = 'visita_id')                                        as nc_tem_visita,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecoes'
           and column_name = 'visita_id')                                        as inspecao_tem_visita,
       (select count(*) from pg_proc
         where proname in ('emitir_relatorio', 'revisar_relatorio'))             as funcoes;
