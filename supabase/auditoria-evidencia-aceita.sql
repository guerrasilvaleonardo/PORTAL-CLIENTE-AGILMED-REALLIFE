-- =====================================================================
-- Evidência aceita ou recusada, arquivo por arquivo.
--
-- ANTES:  o cliente anexava e o auditor avaliava o ITEM. O arquivo
--         ficava lá, sem dizer se serviu ou não.
-- DEPOIS: cada anexo carrega o estado — aceita, recusada ou ainda sem
--         avaliar — e a tela mostra ao lado do arquivo.
-- MOTIVO: pedido dele em 20/11/2026, com a maquete na mão.
--
-- ISTO NÃO SUBSTITUI A AVALIAÇÃO DO ITEM. O veredito da auditoria
-- continua sendo do requisito: atende, atende em parte, não atende. O
-- estado do arquivo responde outra pergunta, que é operacional e
-- aparece em toda auditoria real: "o documento que você mandou serve
-- como evidência?" Recusar um arquivo e pedir outro acontece antes de
-- fechar o requisito, e sem registro disso o cliente reenvia o mesmo
-- PDF três vezes.
--
-- POR QUE JSONB E NÃO OUTRA TABELA. O estado só existe enquanto o
-- arquivo estiver na lista de anexos daquela resposta — não tem vida
-- própria, não é consultado sozinho e morre junto com o anexo. Tabela
-- separada criaria linhas órfãs a cada remoção.
--
-- A CHAVE É O CAMINHO NO BALDE, que já é único (uuid). Tirou o anexo,
-- a entrada fica órfã no jsonb e é ignorada: não vale o risco de
-- reescrever o jsonb inteiro a cada remoção.
--
-- Depende de supabase/inspecoes-modo-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'inspecao_respostas'
       and column_name = 'anexos'
  ) then
    raise exception 'Rode antes supabase/inspecoes-modo-auditoria.sql.';
  end if;
end
$$;

alter table public.inspecao_respostas
  add column if not exists anexos_estado jsonb not null default '{}'::jsonb;

-- Só aceita objeto, e só com os valores previstos. jsonb aceita
-- qualquer coisa por padrão, e "qualquer coisa" vira bug de tela.
alter table public.inspecao_respostas drop constraint if exists inspecao_respostas_anexos_estado;
alter table public.inspecao_respostas
  add constraint inspecao_respostas_anexos_estado
  check (
    jsonb_typeof(anexos_estado) = 'object'
    and not exists (
      select 1 from jsonb_each_text(anexos_estado) e
       where e.value not in ('aceita', 'recusada')
    )
  );


-- ---------- Conferência -------------------------------------------------
select (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecao_respostas'
           and column_name = 'anexos_estado')                        as campo,
       (select count(*) from public.inspecao_respostas
         where anexos_estado <> '{}'::jsonb)                          as com_avaliacao;
