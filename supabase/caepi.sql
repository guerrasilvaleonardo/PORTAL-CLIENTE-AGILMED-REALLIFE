-- =====================================================================
-- Base de CAs do MTE (CAEPI).
--
-- ANTES:  quem cadastrava um EPI digitava o nome, o CA e a validade na
--         mão, de cabeça ou olhando o certificado. Errar um dígito do
--         CA passava despercebido, e a descrição oficial do
--         equipamento — a que a ficha imprime — nunca estava lá.
-- DEPOIS: uma cópia da base oficial dentro do portal. Digitou o número
--         do CA, o cadastro se preenche: nome, descrição, fabricante,
--         validade e situação.
-- MOTIVO: é o que falta para a Configuração de EPI's ficar como a do
--         OnSafety, e é o que faz a ficha sair com a descrição certa.
--
-- POR QUE UMA CÓPIA, E NÃO UMA CONSULTA AO VIVO. A página de consulta
-- do CAEPI está atrás de proteção anti-robô: um pedido feito por
-- servidor leva 403. O Ministério publica a base inteira num arquivo
-- (tgg_export_caepi), atualizado todo dia às 20h — essa é a porta da
-- frente, e é por ela que entramos. A cópia também deixa a busca
-- instantânea e não depende do site estar no ar.
--
-- A TABELA É PÚBLICA PARA QUEM ESTÁ LOGADO e não pertence a empresa
-- nenhuma: é dado oficial, igual para todo mundo. Só a chave de serviço
-- escreve nela — a importação roda fora do navegador.
--
-- Não apaga nem altera dados de ninguém. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.caepi (
  -- O próprio número do CA é a chave: é assim que se procura.
  ca              text primary key,
  validade        date,
  situacao        text,
  cnpj            text,
  razao_social    text,
  natureza        text,
  nome_equipamento text,
  descricao       text,
  marca           text,
  referencia      text,
  cor             text,
  norma           text,
  atualizado_em   timestamptz not null default now()
);

create index if not exists caepi_nome on public.caepi using gin (to_tsvector('portuguese', coalesce(nome_equipamento, '')));
create index if not exists caepi_validade on public.caepi (validade);

alter table public.caepi enable row level security;

-- Qualquer pessoa logada consulta; ninguém escreve pelo navegador.
drop policy if exists caepi_leitura on public.caepi;
create policy caepi_leitura
  on public.caepi for select to authenticated
  using (true);

grant select on public.caepi to authenticated;
revoke insert, update, delete, truncate on public.caepi from anon, authenticated;
revoke all on public.caepi from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.caepi)                                     as cas,
       (select count(*) from public.caepi where situacao = 'VÁLIDO')           as validos,
       (select max(atualizado_em) from public.caepi)                           as ultima_importacao,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'caepi')                  as politicas;
