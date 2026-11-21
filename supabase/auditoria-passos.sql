-- =====================================================================
-- Os passos do requisito: o que fazer, na ordem, numerado.
--
-- ANTES:  o item tinha a pergunta, a explicação (a cola do auditor) e a
--         prescrição (a aula longa, escondida atrás de um "+ Como
--         atender este requisito"). Quem nunca montou um sistema lê a
--         aula, entende, e continua sem saber por onde começar.
-- DEPOIS: uma lista numerada de três a cinco passos concretos — separe
--         o documento, confira a data, suba o arquivo. É o formato que
--         o concorrente usa, e é o que transforma leitura em ação.
-- MOTIVO: pedido dele em 20/11/2026, com a tela do Blwinner na mão.
--
-- POR QUE ARRAY E NÃO TEXTO. A tela numera sozinha e, mais adiante, vai
-- poder marcar passo a passo. Parágrafo corrido faria o cliente perder
-- o lugar no meio de uma lista de cinco instruções — que é exatamente
-- o problema que os passos vêm resolver.
--
-- POR QUE NÃO SUBSTITUI A PRESCRIÇÃO. São dois momentos. A prescrição
-- explica por que a norma pede aquilo e o que a empresa ganha; é lida
-- uma vez, com calma. Os passos são lidos com o arquivo aberto, na
-- hora de fazer. Fundir os dois daria um texto que não serve para
-- nenhum dos dois usos.
--
-- O VÍDEO entra agora porque é barato: o campo custa nada e evita uma
-- segunda migração quando a Real Life gravar os primeiros.
--
-- Depende de supabase/inspecoes.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.inspecao_modelo_itens
  add column if not exists passos    text[] not null default '{}',
  add column if not exists video_url text;


-- ---------- Conferência -------------------------------------------------
select m.nome,
       count(*)                                        as itens,
       count(*) filter (where array_length(i.passos, 1) > 0) as com_passos,
       count(i.prescricao)                             as com_prescricao
  from public.inspecao_modelos m
  join public.inspecao_modelo_itens i on i.modelo_id = m.id
 where m.empresa_id is null and m.tipo = 'auditoria'
 group by m.nome
 order by m.nome;
