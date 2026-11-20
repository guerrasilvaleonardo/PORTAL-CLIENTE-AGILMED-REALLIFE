-- =====================================================================
-- Prescrição: o requisito explicado a quem nunca montou um sistema.
--
-- ANTES:  o item tinha a pergunta e uma linha de orientação — "peça o
--         documento e veja a data". Serve para o auditor. Não serve
--         para a empresa que não sabe nem por onde começar.
-- DEPOIS: cada requisito ganha um texto longo que ensina: o que fazer,
--         como fazer, por que a norma pede isso, como aquilo garante o
--         que promete, e o que o cliente precisa entregar.
-- MOTIVO: pedido dele em 20/11/2026.
--
-- POR QUE CAMPO NOVO E NÃO ESTICAR A EXPLICAÇÃO. São dois leitores
-- diferentes. `explicacao` é a cola do auditor na hora da auditoria:
-- curta, olhada de relance. `prescricao` é aula, lida antes, com calma.
-- Juntar as duas faria o auditor rolar meia tela para achar o que pedir
-- e a empresa ler um resumo que não ensina.
--
-- E É O QUE DIFERENCIA O PRODUTO. Checklist qualquer tem a pergunta.
-- Dizer à empresa COMO atender, e por quê, é consultoria embutida na
-- ferramenta — que é o que a Real Life vende.
--
-- Depende de supabase/inspecoes.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.inspecao_modelo_itens
  add column if not exists prescricao text;


-- ---------- Conferência -------------------------------------------------
select m.nome,
       count(*)                                           as itens,
       count(i.prescricao)                                as com_prescricao
  from public.inspecao_modelos m
  join public.inspecao_modelo_itens i on i.modelo_id = m.id
 where m.empresa_id is null and m.tipo = 'auditoria'
 group by m.nome
 order by m.nome;
