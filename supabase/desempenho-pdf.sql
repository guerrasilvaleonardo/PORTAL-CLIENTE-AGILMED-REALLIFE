-- =====================================================================
-- O PDF do relatório individual fechado fica guardado no portal.
--
-- ANTES:  o relatório fechado existia como dado (o JSON congelado na
--         liberação) e como tela. Arquivo, não havia: para ter o PDF,
--         alguém precisava abrir a tela e mandar imprimir — e o que
--         não é gerado na hora certa não é gerado nunca. Numa
--         auditoria, "posso abrir o portal e imprimir agora" é
--         resposta pior do que entregar o arquivo.
-- DEPOIS: ao registrar a ciência, o portal monta o PDF do relatório
--         fechado e guarda num balde privado. Fica para baixar depois,
--         pela pessoa e pela direção, no mesmo lugar onde o relatório
--         é lido.
-- MOTIVO: pedido dele em 27/11/2026: "quando eu acessar também os
--         relatórios, de cada um precisa estar guardado o pdf do
--         relatório fechado".
--
-- POR QUE SÓ DEPOIS DA CIÊNCIA. Antes dela, a liberação ainda pode ser
-- revogada ou refeita, e o documento ainda não é definitivo. PDF
-- gerado a cada versão encheria o balde de folhas que se contradizem,
-- e a pergunta "qual é o relatório de outubro?" voltaria a ter mais de
-- uma resposta.
--
-- O BALDE É PRIVADO E NÃO TEM POLÍTICA DE LEITURA, de propósito.
-- Ninguém baixa direto: o portal gera um link temporário pela função
-- de serviço, depois de conferir quem está pedindo. Relatório de
-- desempenho com link público seria o pior vazamento possível do
-- portal — vai nome, números e avaliação de pessoa.
--
-- Depende de supabase/desempenho-ciencia.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

do $$
begin
  if to_regclass('public.desempenho_publicacoes') is null then
    raise exception 'Rode antes supabase/desempenho-ciencia.sql.';
  end if;
end
$$;


-- ---------- 1. Onde fica o arquivo --------------------------------------
alter table public.desempenho_publicacoes
  -- Caminho dentro do balde: <pessoa_id>/<publicacao_id>.pdf
  add column if not exists pdf_path text,
  add column if not exists pdf_em   timestamptz;


-- ---------- 2. O balde ---------------------------------------------------
/*
 * Privado (public = false). O portal escreve pela chave de serviço e
 * entrega link temporário; ninguém lê direto.
 */
insert into storage.buckets (id, name, public)
values ('desempenho-pdf', 'desempenho-pdf', false)
on conflict (id) do nothing;


-- ---------- 3. Conferência ----------------------------------------------
-- Esperado: as duas colunas (t), o balde existe e é privado (t), e
-- quantos relatórios já têm PDF guardado (0 na primeira vez).
select
  (select count(*) = 2 from information_schema.columns
    where table_schema = 'public' and table_name = 'desempenho_publicacoes'
      and column_name in ('pdf_path', 'pdf_em'))                       as colunas_criadas,
  (select not public from storage.buckets where id = 'desempenho-pdf') as balde_privado,
  (select count(*) from public.desempenho_publicacoes
    where pdf_path is not null)                                        as com_pdf;
