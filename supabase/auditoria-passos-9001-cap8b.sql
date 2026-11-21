-- =====================================================================
-- Os passos do capítulo 8 da ISO 9001:2026 — parte B: provedores
-- externos, produção e liberação. Onze requisitos.
--
-- Mesma regra da parte A: audita-se com o pedido na mão, não com o
-- procedimento. E quase todo passo aqui pede uma ida ao local —
-- almoxarifado, chão de fábrica, expedição. O 8.5 não se audita
-- sentado.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(req, passos) as (
  values
    ('8.4.1'::text, array[
      'Peça a lista de fornecedores que afetam a qualidade do que a empresa entrega;',
      'Confira se há critérios escritos de seleção e avaliação;',
      'Veja a avaliação dos três principais e quando foi feita;',
      'Procure fornecedor reprovado que continua sendo usado — se houver, confira a justificativa;',
      'Suba a lista e as avaliações.'
    ]::text[]),

    ('8.4.2', array[
      'Vá ao recebimento e acompanhe uma entrega, ou peça o registro da última;',
      'Confira o que é conferido na chegada: quantidade, especificação, certificado, validade;',
      'Veja se o controle é proporcional ao risco — parafuso comum e aço estrutural não se conferem igual;',
      'Pergunte o que acontece quando chega fora do especificado e peça o registro da última vez;',
      'Suba os registros de recebimento.'
    ]::text[]),

    ('8.4.3', array[
      'Pegue três pedidos de compra recentes;',
      'Confira se dá para saber, só por eles, exatamente o que foi pedido;',
      'Veja se o pedido informa o que será exigido na entrega e os critérios de aprovação;',
      'Pedido que diz apenas "material diverso" e um valor é o que gera a entrega errada;',
      'Suba os pedidos conferidos.'
    ]::text[]),

    ('8.5.1', array[
      'Vá ao local onde o produto é feito ou o serviço é prestado;',
      'Confira se quem está executando tem à mão a informação do que produzir e dos critérios de aceitação;',
      'Veja se os pontos de verificação acontecem de fato, e não só no procedimento;',
      'Pergunte a quem executa como ele sabe que o trabalho está certo;',
      'Suba as instruções de trabalho e os registros do que foi verificado.'
    ]::text[]),

    ('8.5.2', array[
      'No local, confira como o produto é identificado ao longo do processo;',
      'Veja se dá para distinguir o que já foi inspecionado do que ainda não foi;',
      'Pergunte se a rastreabilidade é exigida por cliente, contrato ou lei, e até que nível;',
      'Se for exigida, escolha um produto pronto e tente chegar ao lote da matéria-prima;',
      'Suba a evidência do método de identificação.'
    ]::text[]),

    ('8.5.3', array[
      'Pergunte o que está na empresa e não é dela: material, ferramenta, molde, desenho, dado do cliente;',
      'Confira como cada item é identificado e protegido;',
      'Veja se há registro de algo perdido ou danificado e se o dono foi avisado;',
      'Se a empresa disser que não se aplica, confira: o desenho que o cliente mandou é propriedade dele;',
      'Suba o levantamento.'
    ]::text[]),

    ('8.5.4', array[
      'Siga o caminho do produto pronto até a saída: embalagem, estoque, carregamento;',
      'Em cada ponto, veja o que poderia estragá-lo;',
      'Confira se a proteção definida está sendo usada de fato;',
      'Procure produto danificado ou enferrujado no estoque — é a evidência mais direta deste requisito;',
      'Suba o procedimento de preservação e fotos do local.'
    ]::text[]),

    ('8.5.5', array[
      'Pergunte o que a empresa se compromete a fazer depois da entrega: garantia, assistência, descarte;',
      'Peça o registro dos três últimos atendimentos pós-venda;',
      'Confira se o prazo prometido foi cumprido;',
      'Suba os registros.'
    ]::text[]),

    ('8.5.6', array[
      'Pergunte que mudanças a operação sofreu no último ano: máquina, material, método, fornecedor;',
      'Para as que encontrar, procure o registro da análise e de quem autorizou;',
      'Confira se os documentos afetados foram revisados junto;',
      'Suba os registros de mudança.'
    ]::text[]),

    ('8.6', array[
      'Pegue três entregas recentes e pergunte quem autorizou a liberação de cada uma;',
      'Confira se existe o registro com a evidência de que os requisitos foram atendidos;',
      'Veja se há caso de entrega liberada antes da verificação concluída — se houver, confira a autorização de quem podia fazer isso;',
      'Suba os registros de liberação.'
    ]::text[]),

    ('8.7', array[
      'Pergunte o que a empresa faz quando o produto sai errado;',
      'Peça os registros das últimas saídas não conformes do ano;',
      'Confira se está registrado o que foi feito: corrigido, segregado, devolvido, aceito com concessão;',
      'Se houve concessão, confira quem autorizou e se o cliente foi informado quando exigido;',
      'Nenhum registro no ano todo costuma significar que ninguém registra, não que nada saiu errado;',
      'Suba os registros.'
    ]::text[])
)
update public.inspecao_modelo_itens i
   set passos = d.passos
  from dados d
  join public.inspecao_modelos m
    on m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 9001'
 where i.modelo_id = m.id
   and i.requisito = d.req;


-- ---------- Conferência -------------------------------------------------
select count(*) filter (where array_length(i.passos, 1) > 0) as com_passos,
       count(*)                                              as itens
  from public.inspecao_modelo_itens i
  join public.inspecao_modelos m on m.id = i.modelo_id
 where m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 9001';
