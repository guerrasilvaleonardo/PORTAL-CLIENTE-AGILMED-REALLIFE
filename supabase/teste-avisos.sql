-- =====================================================================
-- O teste de 7 dias passa a avisar por e-mail.
--
-- ANTES:  o aviso do teste existia só dentro do portal. Quem não
--         entrasse no dia 6 descobria no dia 8, com a ferramenta já
--         fechada — e a sensação é de armadilha, não de teste.
-- DEPOIS: duas marcas de data em modulo_testes, para o cron saber o
--         que já avisou. Sem elas o cliente receberia o mesmo e-mail
--         todo dia até o teste acabar.
-- MOTIVO: aviso que chega depois do fato não é aviso.
--
-- Só acrescenta duas colunas. Não apaga nem altera dado nenhum, e não
-- muda política, função ou gatilho.
--
-- Depende de supabase/teste-de-7-dias.sql.
-- Pode rodar mais de uma vez.
-- =====================================================================

do $$
begin
  if to_regclass('public.modulo_testes') is null then
    raise exception 'Rode antes supabase/teste-de-7-dias.sql.';
  end if;
end
$$;

alter table public.modulo_testes
  -- "Faltam 2 dias": sai uma vez só, na reta final.
  add column if not exists avisado_faltam_em timestamptz,
  -- "Seu teste terminou": sai uma vez só, no dia seguinte ao fim.
  add column if not exists avisado_fim_em timestamptz;

-- O cron varre por prazo; o índice evita ler a tabela inteira quando
-- ela crescer.
create index if not exists modulo_testes_a_avisar_idx
  on public.modulo_testes (termina_em)
  where convertido_em is null
    and (avisado_faltam_em is null or avisado_fim_em is null);


-- ---------- Conferência -------------------------------------------------
-- Esperado: as duas colunas com true, e o índice com 1.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'modulo_testes'
      and column_name = 'avisado_faltam_em')                                  as tem_coluna_faltam,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'modulo_testes'
      and column_name = 'avisado_fim_em')                                     as tem_coluna_fim,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'modulo_testes_a_avisar_idx')  as tem_indice,
  (select count(*) from public.modulo_testes)                                  as testes_existentes;
