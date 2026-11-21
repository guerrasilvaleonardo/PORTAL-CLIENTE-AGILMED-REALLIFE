-- =====================================================================
-- Os passos do capítulo 4 da ISO 9001:2026 — amostra do formato.
--
-- Cinco requisitos escritos para ele conferir o formato antes de eu
-- escrever os 89 (53 da 9001 e 36 da 45001).
--
-- COMO OS PASSOS SÃO ESCRITOS AQUI. Isto é auditoria, não implantação:
-- quem lê já tem (ou devia ter) o documento. Então o passo não é
-- "escreva a política" — é "abra o documento X, confira Y, suba o
-- arquivo". Verbo no imperativo, uma ação por linha, três a cinco por
-- requisito. Passo que não dá para fazer sentado com o computador
-- aberto não é passo, é conselho.
--
-- O ÚLTIMO PASSO É SEMPRE A EVIDÊNCIA. Auditoria sem arquivo anexado
-- vira palavra contra palavra seis meses depois, e é a primeira coisa
-- que a certificadora pede.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez: reescreve pelo número do
-- requisito, então corrigir um texto é editar e rodar de novo.
-- =====================================================================

with dados(req, marca, passos) as (
  values
    ('4.1'::text, 'contexto'::text, array[
      'Abra o documento em que a empresa registrou as questões internas e externas — costuma se chamar análise de contexto, SWOT ou matriz de cenário;',
      'Confira se ele tem data e se foi revisado no último ano: contexto de três anos atrás descreve outra empresa;',
      'Veja se as questões listadas são as que a direção realmente discute, e não frases genéricas de modelo;',
      'Confira se cada questão diz se ajuda ou atrapalha o resultado;',
      'Suba o documento aqui como evidência.'
    ]::text[]),

    ('4.1', 'clima', array[
      'Procure, no mesmo documento de contexto, se a mudança climática foi considerada;',
      'A resposta pode ser não — o que não pode é o assunto não aparecer: desde a emenda de 2024 a pergunta é obrigatória;',
      'Se foi considerada relevante, confira se virou risco ou ação em algum lugar; se não foi, confira se há a justificativa de uma linha;',
      'Suba a página ou o trecho do documento onde isso está registrado.'
    ]::text[]),

    ('4.2', 'partes', array[
      'Abra a lista de partes interessadas (cliente, órgão fiscalizador, colaborador, fornecedor, vizinhança);',
      'Para cada uma, confira se está escrito O QUE ela exige — lista de nomes sem exigência não serve para nada;',
      'Confirme que as exigências legais aparecem ali, e não só as comerciais;',
      'Veja se a lista foi revisada depois da última mudança relevante no negócio;',
      'Suba a lista aqui.'
    ]::text[]),

    ('4.3', 'escopo', array[
      'Abra a declaração de escopo do sistema de gestão;',
      'Confira se ela diz quais produtos e serviços cobre, e em quais endereços;',
      'Se houver requisito excluído, confira se a justificativa está escrita — a exclusão mais comum é 8.3, projeto e desenvolvimento;',
      'Confira se o escopo declarado bate com o que a empresa faz de fato hoje;',
      'Suba a declaração de escopo.'
    ]::text[]),

    ('4.4', 'processos', array[
      'Abra o mapa de processos e a caracterização de cada um;',
      'Escolha dois processos e siga o caminho: o que entra, de onde vem, o que sai, para onde vai;',
      'Confira se cada processo tem responsável declarado e ao menos um indicador com meta;',
      'Verifique se há processo no mapa que ninguém consegue explicar — costuma ser processo que não existe mais;',
      'Suba o mapa e a caracterização.'
    ]::text[])
)
update public.inspecao_modelo_itens i
   set passos = d.passos
  from dados d
  join public.inspecao_modelos m
    on m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 9001'
 where i.modelo_id = m.id
   and i.requisito = d.req
   -- O 4.1 tem duas perguntas (contexto e clima). A marca diz qual é
   -- qual sem depender da ordem, que pode mudar quando o checklist
   -- crescer.
   and (
     (d.marca = 'contexto' and i.pergunta ilike '%quest%')
     or (d.marca = 'clima' and i.pergunta ilike '%clim%')
     or d.marca not in ('contexto', 'clima')
   );


-- ---------- Conferência -------------------------------------------------
select i.requisito,
       left(i.pergunta, 58)                as pergunta,
       coalesce(array_length(i.passos, 1), 0) as passos
  from public.inspecao_modelo_itens i
  join public.inspecao_modelos m on m.id = i.modelo_id
 where m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 9001'
   and i.requisito like '4.%'
 order by i.ordem;
