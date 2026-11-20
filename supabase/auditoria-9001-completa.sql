-- =====================================================================
-- ISO 9001: o checklist passa a cobrir a norma inteira.
--
-- ANTES:  28 perguntas. Cobriam o esqueleto, mas deixavam de fora
--         requisitos auditáveis inteiros — entre eles TODO o 8.3
--         (projeto e desenvolvimento), o 8.6 (liberação), o 7.3
--         (conscientização) e o 7.4 (comunicação).
-- DEPOIS: 52 perguntas, uma por requisito auditável de 4 a 10.
-- MOTIVO: pedido dele em 20/11/2026 — "veja se não está faltando
--         pergunta, na íntegra, sem deixar passar uma letra".
--
-- CONFERIDO CONTRA O SUMÁRIO DA NORMA, aberto no catálogo da ABNT via
-- CONFEA: ABNT NBR ISO 9001:2026, 4ª edição, 13.10.2026. Não foi de
-- memória.
--
-- O QUE A 4ª EDIÇÃO MUDOU, e que o checklist antigo ignorava:
--   6.1 foi desdobrado em 6.1.1 determinando riscos e oportunidades,
--       6.1.2 ações para abordar riscos e 6.1.3 ações para abordar
--       oportunidades. Tínhamos uma pergunta só, genérica.
--   10 tem só 10.1 Melhoria contínua e 10.2 Não conformidade e ação
--       corretiva. Não existe 10.3. Isso já estava certo.
--
-- O TEXTO CONTINUA SENDO NOSSO. O número é referência, como citar
-- artigo de lei. Nada aqui transcreve a norma, que é vendida pela ABNT.
--
-- ONDE MANTIVE UMA PERGUNTA GENÉRICA, foi porque a subdivisão não muda
-- o que se pede para ver: 7.5 (a lista mestra responde pelos três
-- subitens), 9.2 e 9.3. Dividir ali geraria três perguntas com a mesma
-- evidência, e checklist que repete pergunta cansa o auditado sem
-- aumentar o rigor.
--
-- AUDITORIA JÁ ABERTA NÃO MUDA. As perguntas são copiadas para a
-- auditoria no momento em que ela é aberta — é documento do dia. As
-- novas valem para as próximas.
--
-- Depende de supabase/inspecoes-auditoria.sql e
-- supabase/auditoria-numero-do-requisito.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

do $$
declare
  v_modelo uuid;
begin
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Auditoria interna — ISO 9001';

  if v_modelo is null then
    raise exception 'Rode antes supabase/inspecoes-auditoria.sql.';
  end if;

  -- ---------- 1. Tira a ordem do caminho ------------------------------
  -- Reordenar com os números finais colidiria com os atuais. Empurra
  -- tudo para uma faixa alta e traz de volta já no lugar certo.
  update public.inspecao_modelo_itens
     set ordem = ordem + 1000
   where modelo_id = v_modelo;

  -- ---------- 2. As que já existiam, no lugar novo --------------------
  update public.inspecao_modelo_itens i
     set ordem = m.nova, requisito = coalesce(m.req, i.requisito)
    from (values
      (1001,  1, null), (1002,  2, null), (1003,  3, null), (1004,  4, null),
      (1005,  5, '5.1.1'), (1007,  6, null), (1006,  7, null),
      (1008,  9, '6.1.1'), (1009, 12, null), (1010, 13, null),
      (1011, 14, '7.1.1'), (1012, 18, null), (1013, 20, null), (1014, 23, null),
      (1015, 27, null), (1016, 28, null), (1017, 34, '8.4.1'),
      (1018, 37, null), (1019, 38, null), (1020, 39, null), (1021, 44, null),
      (1022, 47, null), (1023, 46, null), (1024, 48, null), (1025, 49, null),
      (1026, 50, null), (1027, 51, null), (1028, 52, null)
    ) as m(antiga, nova, req)
   where i.modelo_id = v_modelo and i.ordem = m.antiga;

  -- ---------- 3. As que faltavam --------------------------------------
  insert into public.inspecao_modelo_itens
    (modelo_id, ordem, categoria, requisito, pergunta, orientacao)
  select v_modelo, x.ordem, x.categoria, x.requisito, x.pergunta, x.orientacao
    from (values
      (8, '5 Liderança', '5.3',
       'Os papéis, as responsabilidades e as autoridades do sistema estão atribuídos e são conhecidos por quem os exerce?',
       'Peça o documento e depois pergunte a duas pessoas o que cabe a elas. Papel atribuído que o próprio não conhece não está atribuído.'),

      (10, '6 Planejamento', '6.1.2',
       'Para cada risco determinado, existe ação definida, proporcional ao efeito que ele teria?',
       'Risco listado e sem ação é lista, não planejamento. Veja se a ação é compatível com o tamanho do risco.'),

      (11, '6 Planejamento', '6.1.3',
       'As oportunidades determinadas viraram ação, e não apenas intenção registrada?',
       'A 4ª edição cobra oportunidade em item próprio. Peça duas e pergunte o que foi feito com elas.'),

      (15, '7 Apoio', '7.1.2',
       'As pessoas necessárias para operar os processos estão disponíveis em quantidade suficiente?',
       'Compare o quadro com a demanda. Processo que só funciona com hora extra permanente é falta de pessoas, não de esforço.'),

      (16, '7 Apoio', '7.1.3',
       'A infraestrutura necessária está disponível e é mantida — prédio, equipamento, software, transporte?',
       'Peça o plano de manutenção e o registro da última feita, não só a lista de equipamentos.'),

      (17, '7 Apoio', '7.1.4',
       'O ambiente de trabalho necessário aos processos é determinado e mantido?',
       'Temperatura, limpeza, ruído, iluminação — o que o processo exige. Vale também o ambiente social, quando afeta o resultado.'),

      (19, '7 Apoio', '7.1.6',
       'O conhecimento necessário aos processos está identificado e preservado quando alguém sai?',
       'Pergunte o que acontece se a pessoa mais antiga do processo sair amanhã. Se a resposta for "a gente se vira", não há controle.'),

      (21, '7 Apoio', '7.3',
       'As pessoas sabem a política, os objetivos que lhes cabem e o que acontece se não cumprirem o sistema?',
       'Conscientização se audita perguntando ao trabalhador, não olhando a lista de presença.'),

      (22, '7 Apoio', '7.4',
       'A comunicação do sistema está definida: o que, quando, com quem e por quem?',
       'Peça o quadro de comunicação. "A gente avisa por e-mail" não responde o requisito.'),

      (24, '8 Operação', '8.1',
       'Os processos necessários para entregar o produto ou serviço estão planejados, com critérios e controles definidos?',
       'Peça o planejamento de um pedido real, do recebimento à entrega, com os critérios de aceitação.'),

      (25, '8 Operação', '8.2.1',
       'A comunicação com o cliente está definida, inclusive para dúvidas, pedidos, reclamações e propriedade do cliente?',
       'Veja um caso real de reclamação e siga o caminho que ela percorreu.'),

      (26, '8 Operação', '8.2.2',
       'Os requisitos do produto ou serviço são determinados antes de oferecer, inclusive os legais e os não declarados pelo cliente?',
       'Requisito não declarado é o que o cliente espera sem pedir. Pergunte como a empresa descobre esses.'),

      (29, '8 Operação', '8.3.1',
       'A empresa faz projeto e desenvolvimento? Se não faz, a exclusão está justificada no escopo?',
       'Produzir conforme desenho do cliente costuma justificar; criar o próprio produto, não. Exclusão sem justificativa é não conformidade.'),

      (30, '8 Operação', '8.3.3',
       'As entradas de projeto são definidas por escrito — requisitos funcionais, legais, consequências de falha?',
       'Só se aplica se a empresa projeta. Peça o projeto mais recente.'),

      (31, '8 Operação', '8.3.4',
       'O projeto passa por análise crítica, verificação e validação, com registro de cada uma?',
       'São três coisas distintas e costumam ser tratadas como uma. Verifique se há registro separado.'),

      (32, '8 Operação', '8.3.5',
       'As saídas de projeto atendem às entradas e trazem os critérios de aceitação do produto?',
       'Compare a saída com a entrada do mesmo projeto.'),

      (33, '8 Operação', '8.3.6',
       'As mudanças de projeto são analisadas, aprovadas e registradas antes de valer?',
       'Procure uma mudança recente e veja se a aprovação é anterior à produção.'),

      (35, '8 Operação', '8.4.2',
       'O tipo e a extensão do controle sobre cada provedor externo são definidos conforme o impacto dele no produto?',
       'Fornecedor de item crítico controlado igual ao de material de escritório indica controle no automático.'),

      (36, '8 Operação', '8.4.3',
       'O que a empresa exige do provedor externo é comunicado a ele de forma clara antes do fornecimento?',
       'Peça o pedido de compra de um item crítico e veja o que ele informa.'),

      (40, '8 Operação', '8.5.4',
       'As saídas são preservadas durante a produção e a entrega, de modo a manter a conformidade?',
       'Identificação, embalagem, armazenagem, transporte. Olhe o estoque e a expedição.'),

      (41, '8 Operação', '8.5.5',
       'As atividades pós-entrega exigidas são atendidas — garantia, manutenção, suporte, descarte?',
       'Veja o que o contrato e a lei exigem depois da entrega, e como a empresa cumpre.'),

      (42, '8 Operação', '8.5.6',
       'As mudanças na produção ou na prestação do serviço são analisadas e aprovadas antes de acontecer?',
       'Mudança feita e depois comunicada não atende o requisito.'),

      (43, '8 Operação', '8.6',
       'O produto ou serviço só é liberado depois de verificado contra os critérios, com registro de quem liberou?',
       'Peça o registro de liberação de uma entrega recente. Tem de dizer quem autorizou.'),

      (45, '9 Avaliação', '9.1.1',
       'Está definido o que é monitorado e medido, com que método e quando — e os resultados são registrados?',
       'Peça a lista do que é medido. Medir sem método definido dá número que ninguém compara.')
    ) as x(ordem, categoria, requisito, pergunta, orientacao)
   where not exists (
     select 1 from public.inspecao_modelo_itens i
      where i.modelo_id = v_modelo and i.requisito = x.requisito
   );
end
$$;


-- ---------- Conferência -------------------------------------------------
-- `faltando` tem de ser 0: nenhum requisito auditável da norma sem
-- pergunta no checklist.
with exigidos(requisito) as (values
  ('4.1'),('4.2'),('4.3'),('4.4'),
  ('5.1.1'),('5.1.2'),('5.2'),('5.3'),
  ('6.1.1'),('6.1.2'),('6.1.3'),('6.2'),('6.3'),
  ('7.1.1'),('7.1.2'),('7.1.3'),('7.1.4'),('7.1.5'),('7.1.6'),
  ('7.2'),('7.3'),('7.4'),('7.5'),
  ('8.1'),('8.2.1'),('8.2.2'),('8.2.3'),('8.2.4'),
  ('8.3.1'),('8.3.3'),('8.3.4'),('8.3.5'),('8.3.6'),
  ('8.4.1'),('8.4.2'),('8.4.3'),
  ('8.5.1'),('8.5.2'),('8.5.3'),('8.5.4'),('8.5.5'),('8.5.6'),
  ('8.6'),('8.7'),
  ('9.1.1'),('9.1.2'),('9.1.3'),('9.2'),('9.3'),
  ('10.1'),('10.2')
)
select (select count(*) from public.inspecao_modelo_itens i
         join public.inspecao_modelos m on m.id = i.modelo_id
        where m.nome = 'Auditoria interna — ISO 9001')                   as perguntas,
       (select count(*) from exigidos e
         where not exists (
           select 1 from public.inspecao_modelo_itens i
             join public.inspecao_modelos m on m.id = i.modelo_id
            where m.nome = 'Auditoria interna — ISO 9001'
              and i.requisito = e.requisito))                            as faltando;
