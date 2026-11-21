-- =====================================================================
-- Os passos dos capítulos 5 e 6 da ISO 9001:2026 — Liderança e
-- Planejamento. Nove requisitos.
--
-- Mesmo formato do capítulo 4: abra, confira, suba. Verbo no
-- imperativo, uma ação por linha, e o último passo é sempre a
-- evidência.
--
-- O CAPÍTULO 5 SE AUDITA CONVERSANDO. Liderança não tem documento
-- próprio: prova-se pela ata que mostra a direção decidindo, pelo
-- recurso que foi aprovado, pelo indicador que alguém cobrou. Por isso
-- vários passos aqui mandam procurar evidência em documento de outro
-- requisito — é assim que se audita o 5.
--
-- NA 4ª EDIÇÃO O 6.1 VIROU TRÊS. 6.1.1 determina riscos e
-- oportunidades, 6.1.2 planeja as ações, 6.1.3 avalia se funcionaram.
-- O terceiro é o que quase ninguém tem, e é o que o auditor pergunta
-- na segunda auditoria.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(req, passos) as (
  values
    ('5.1.1'::text, array[
      'Peça as atas em que a direção tratou do sistema de gestão no último ano;',
      'Procure DECISÃO, não presença: recurso aprovado, meta mudada, ação cobrada;',
      'Pergunte a quem conduz o sistema com que frequência a direção cobra os indicadores;',
      'Confira se a direção sabe dizer, sem consultar, quais são os objetivos da qualidade;',
      'Suba as atas que sustentam isso.'
    ]::text[]),

    ('5.1.2', array[
      'Pergunte como a empresa descobre o que o cliente exige antes de aceitar o pedido;',
      'Peça os três últimos pedidos e confira se os requisitos do cliente estão registrados;',
      'Veja se os requisitos legais do produto aparecem junto, e não só os comerciais;',
      'Confira se há registro de pedido recusado ou renegociado por não conseguir atender — a ausência total costuma indicar que ninguém analisa;',
      'Suba os pedidos conferidos.'
    ]::text[]),

    ('5.2', array[
      'Abra a política da qualidade e confira se tem aprovação e data;',
      'Leia e pergunte: ela diz o que ESTA empresa faz, ou serve para qualquer uma?',
      'Confira se ela traz o compromisso de atender requisitos e de melhorar continuamente;',
      'Vá até o chão e pergunte a duas pessoas o que a política significa no trabalho delas — se ninguém souber, é constatação, por mais bonito que seja o quadro;',
      'Suba a política e o registro de como ela foi comunicada.'
    ]::text[]),

    ('5.3', array[
      'Peça o organograma e a matriz de responsabilidades do sistema;',
      'Escolha três papéis e pergunte às próprias pessoas se elas sabem que respondem por aquilo;',
      'Confira quem aprova documento, quem trata não conformidade e quem fala com o cliente;',
      'Veja se há papel atribuído a quem saiu da empresa;',
      'Suba a matriz de responsabilidades.'
    ]::text[]),

    ('6.1.1', array[
      'Abra a planilha ou o documento de riscos e oportunidades;',
      'Confira se as entradas vieram do contexto (4.1) e das partes interessadas (4.2) — risco que não sai de lá costuma ter sido inventado para preencher linha;',
      'Veja se a mudança climática, quando considerada relevante no 4.1, aparece aqui;',
      'Confira se há oportunidades, e não só riscos: a norma pede as duas;',
      'Suba o documento.'
    ]::text[]),

    ('6.1.2', array[
      'Para cada risco que a empresa decidiu tratar, confira se há ação, responsável e prazo;',
      'Pergunte onde essa ação aparece no dia a dia — integrada ao processo, não numa planilha paralela;',
      'Escolha duas ações vencidas e veja o que aconteceu de fato;',
      'Confira se as ações são proporcionais ao risco: risco alto com ação de "reforçar orientação" não se sustenta;',
      'Suba o plano de ação.'
    ]::text[]),

    ('6.1.3', array[
      'Para as ações já concluídas, pergunte: como vocês souberam que funcionou?',
      'Procure o critério definido ANTES da ação, não a justificativa escrita depois;',
      'Confira se alguma ação foi considerada ineficaz e refeita — nunca ter acontecido é sinal de que ninguém avalia;',
      'Veja se a avaliação entra na análise crítica pela direção;',
      'Suba o registro da avaliação de eficácia.'
    ]::text[]),

    ('6.2', array[
      'Abra a lista de objetivos da qualidade;',
      'Confira se cada um tem número, prazo e método de medição — "melhorar a satisfação" não é objetivo;',
      'Veja se conversam com a política da qualidade;',
      'Peça o resultado atual de cada um e confira se alguém acompanha mês a mês;',
      'Confira se há plano para cada objetivo: o que será feito, com que recursos, por quem, até quando e como avaliar;',
      'Suba os objetivos e o acompanhamento.'
    ]::text[]),

    ('6.3', array[
      'Pergunte que mudanças o sistema sofreu no último ano — processo novo, software, endereço, saída de pessoa-chave;',
      'Para as que encontrar, procure o registro do planejamento: propósito, consequências, recursos e responsáveis;',
      'Confira se os documentos afetados foram revisados junto;',
      'Mudança sem registro nenhum é a constatação típica deste requisito;',
      'Suba os registros de planejamento de mudança.'
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
select i.requisito, coalesce(array_length(i.passos, 1), 0) as passos
  from public.inspecao_modelo_itens i
  join public.inspecao_modelos m on m.id = i.modelo_id
 where m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 9001'
   and (i.requisito like '5.%' or i.requisito like '6.%')
 order by i.ordem;
