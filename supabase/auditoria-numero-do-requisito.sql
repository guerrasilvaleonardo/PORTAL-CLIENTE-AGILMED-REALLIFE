-- =====================================================================
-- O número do requisito da norma, ao lado da pergunta.
--
-- ANTES:  o item guardava só a seção ("9 Avaliação"). Quem auditava
--         sabia o capítulo, não o requisito.
-- DEPOIS: cada pergunta carrega o item exato — 9.2.2, 8.1.4, 10.2 — e
--         a tela mostra ao lado.
-- MOTIVO: pedido dele em 20/11/2026.
--
-- POR QUE ISSO IMPORTA. Constatação de auditoria se escreve contra um
-- requisito, não contra uma impressão. "Não atende ao 9.3" é auditável
-- e contestável; "a direção não acompanha" é conversa. E na auditoria
-- de certificação o auditor externo lê pelo número.
--
-- O TEXTO CONTINUA NOSSO. O número é referência — como citar artigo de
-- lei. Nada aqui transcreve norma, que é conteúdo vendido pela ABNT.
--
-- O CASAMENTO É POR MODELO + ORDEM, não por texto da pergunta: texto se
-- corrige, ordem não muda. Se alguém já tiver reordenado o modelo, a
-- conferência no fim aponta.
--
-- NUMERAÇÃO DA 9001 É A DE 2026: capítulo 10 enxugado, 10.1 Melhoria
-- contínua e 10.2 Não conformidade e ação corretiva.
--
-- Depende de supabase/inspecoes-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.inspecao_modelo_itens
  add column if not exists requisito text;


-- ---------- ISO 45001:2024 ---------------------------------------------
-- Onde a pergunta cobre mais de um item, fica o item onde o requisito
-- nasce. Ex.: a hierarquia de controles é cobrada no 8.1.2, ainda que o
-- planejamento dela apareça no 6.1.4.
with mapa(ordem, requisito) as (values
  ( 1, '4.1'),   ( 2, '4.2'),   ( 3, '4.3'),
  ( 4, '5.1'),   ( 5, '5.2'),   ( 6, '5.3'),   ( 7, '5.4'),
  ( 8, '6.1.2'), ( 9, '6.1.2'), (10, '8.1.2'), (11, '6.1.3'), (12, '6.2'),
  (13, '7.1'),   (14, '7.2'),   (15, '7.3'),   (16, '7.4'),   (17, '7.5'),
  (18, '8.1.1'), (19, '8.1.3'), (20, '8.1.4'), (21, '8.2'),
  (22, '9.1.1'), (23, '9.1.2'), (24, '9.2.2'), (25, '9.2.2'), (26, '9.3'),
  (27, '10.2'),  (28, '10.2'),  (29, '10.2'),  (30, '10.3')
)
update public.inspecao_modelo_itens i
   set requisito = m.requisito
  from mapa m, public.inspecao_modelos mo
 where mo.id = i.modelo_id
   and mo.empresa_id is null
   and mo.nome = 'Auditoria interna — ISO 45001'
   and i.ordem = m.ordem
   and coalesce(i.requisito, '') <> m.requisito;


-- ---------- ISO 9001:2026 ----------------------------------------------
with mapa(ordem, requisito) as (values
  ( 1, '4.1'),   ( 2, '4.2'),   ( 3, '4.3'),   ( 4, '4.4'),
  ( 5, '5.1'),   ( 6, '5.2'),   ( 7, '5.1.2'),
  ( 8, '6.1'),   ( 9, '6.2'),   (10, '6.3'),
  (11, '7.1'),   (12, '7.1.5'), (13, '7.2'),   (14, '7.5'),
  (15, '8.2.3'), (16, '8.2.4'), (17, '8.4'),   (18, '8.5.1'),
  (19, '8.5.2'), (20, '8.5.3'), (21, '8.7'),
  (22, '9.1.3'), (23, '9.1.2'), (24, '9.2'),   (25, '9.3'),
  (26, '10.1'),  (27, '10.2'),  (28, '10.2')
)
update public.inspecao_modelo_itens i
   set requisito = m.requisito
  from mapa m, public.inspecao_modelos mo
 where mo.id = i.modelo_id
   and mo.empresa_id is null
   and mo.nome = 'Auditoria interna — ISO 9001'
   and i.ordem = m.ordem
   and coalesce(i.requisito, '') <> m.requisito;


-- ---------- Conferência -------------------------------------------------
-- `sem_numero` tem de ser 0 nos dois. Se não for, o modelo foi
-- reordenado e o mapa precisa ser refeito — número errado de norma é
-- pior do que número nenhum.
select mo.nome,
       count(*)                                        as itens,
       count(*) filter (where i.requisito is null)     as sem_numero,
       min(i.requisito) || ' … ' || max(i.requisito)   as faixa
  from public.inspecao_modelos mo
  join public.inspecao_modelo_itens i on i.modelo_id = mo.id
 where mo.empresa_id is null and mo.tipo = 'auditoria'
 group by mo.nome
 order by mo.nome;
