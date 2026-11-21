-- =====================================================================
-- Os passos da ISO 45001:2024 — capítulos 4 a 6.
--
-- A 45001 não é a 9001 com outro assunto. Duas coisas mudam a forma de
-- auditar, e os passos refletem isso:
--
-- O TRABALHADOR PARTICIPA, e isso é requisito (5.4, 6.1.2). Não basta
-- o documento existir: a norma exige que quem faz o trabalho tenha
-- participado de identificar o perigo. Por isso vários passos mandam
-- perguntar a quem está no posto, e não ao técnico de segurança.
--
-- AQUI O ERRO MACHUCA. Na 9001 uma falha gera retrabalho; aqui gera
-- acidente. Os passos pedem ir ao local com mais frequência, e a
-- hierarquia de controles (8.1.2) é verificada no que está instalado,
-- não no que está escrito.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(req, marca, passos) as (
  values
    ('4.1'::text, 'questoes'::text, array[
      'Abra o documento de contexto do sistema de SSO;',
      'Confira se as questões listadas afetam de fato a segurança: terceirização, rotatividade, turno da noite, idade da equipe, exigência de cliente;',
      'Veja se foi revisado no último ano;',
      'Suba o documento.'
    ]::text[]),

    ('4.1', 'clima', array[
      'Procure, no mesmo documento, se a mudança climática foi considerada;',
      'Em SSO isso costuma ser concreto: calor extremo, chuva na operação externa, estiagem, evento climático que isola a unidade;',
      'A resposta pode ser não, mas precisa estar escrita — a emenda de 2024 tornou a pergunta obrigatória;',
      'Se for sim, confira se virou perigo no levantamento de 6.1.2;',
      'Suba o trecho do documento.'
    ]::text[]),

    ('4.2', 'x', array[
      'Abra a lista de partes interessadas do sistema de SSO;',
      'Confira se os trabalhadores aparecem, e o que eles exigem;',
      'Veja se sindicato, cliente e órgão fiscalizador estão lá quando se aplicam;',
      'Confira se as exigências legais foram separadas das demais;',
      'Suba a lista.'
    ]::text[]),

    ('4.3', 'x', array[
      'Abra a declaração de escopo do sistema de SSO;',
      'Confira se ela cobre todas as atividades, locais e turnos — inclusive o trabalho em campo e na casa do cliente;',
      'Veja se contratados e terceiros estão considerados;',
      'Escopo que exclui a área mais perigosa não se sustenta na certificação;',
      'Suba a declaração.'
    ]::text[]),

    ('4.4', 'x', array[
      'Peça o desenho dos processos do sistema de SSO e como eles se ligam;',
      'Escolha um processo e siga: o que entra, quem responde, o que sai;',
      'Confira se há indicador para pelo menos os processos críticos;',
      'Suba o mapa.'
    ]::text[]),

    ('5.1', 'x', array[
      'Peça as atas em que a direção tratou de SSO no último ano;',
      'Procure decisão com dinheiro ou prioridade envolvida: parada de máquina, compra de proteção, mudança de método;',
      'Pergunte a dois trabalhadores se a direção aparece no local e o que ela pergunta;',
      'Veja se houve caso de produção interrompida por segurança — a resposta diz mais que qualquer ata;',
      'Suba as atas.'
    ]::text[]),

    ('5.2', 'x', array[
      'Abra a política de SSO e confira assinatura e data;',
      'Confira se ela traz o compromisso de eliminar perigos e reduzir riscos, e o de consulta e participação dos trabalhadores;',
      'Vá ao local e pergunte a duas pessoas o que a política significa no trabalho delas;',
      'Suba a política e a evidência da comunicação.'
    ]::text[]),

    ('5.3', 'x', array[
      'Peça a matriz de responsabilidades de SSO;',
      'Confira quem responde por: parar o trabalho inseguro, investigar incidente, manter o PGR, liberar atividade de risco;',
      'Pergunte a essas pessoas se elas sabem que respondem por isso;',
      'Confira se alguém que saiu ainda consta;',
      'Suba a matriz.'
    ]::text[]),

    ('5.4', 'x', array[
      'Pergunte COMO os trabalhadores participam: CIPA, DDS, reunião, caixa de sugestão, inspeção conjunta;',
      'Peça as atas das três últimas participações;',
      'Pergunte a quem está no posto se ele já foi consultado sobre risco do trabalho dele, e o que aconteceu depois;',
      'Confira se há barreira à participação: medo de represália, falta de tempo, documento só em português para equipe estrangeira;',
      'Participação que só existe na ata é a constatação mais comum deste requisito;',
      'Suba as atas e o registro das conversas.'
    ]::text[]),

    ('6.1.1', 'x', array[
      'Confira se o planejamento do sistema partiu do contexto (4.1) e das partes interessadas (4.2);',
      'Veja se considerou os perigos já conhecidos e os requisitos legais;',
      'Suba o documento de planejamento.'
    ]::text[]),

    ('6.1.2', 'perigos', array[
      'Abra o levantamento de perigos (costuma estar no PGR ou no inventário de riscos);',
      'Escolha uma atividade e vá ao local: os perigos listados são os que você vê?',
      'Pergunte a quem executa se ele participou de identificar aqueles perigos — a norma exige a participação, não só a consulta;',
      'Confira se o levantamento cobre rotina e não rotina, e também emergência;',
      'Veja se inclui fatores organizacionais: jornada, pressão por produção, assédio;',
      'Suba o levantamento.'
    ]::text[]),

    ('6.1.2', 'riscos', array[
      'Confira qual é o critério escrito de avaliação do risco;',
      'Escolha três riscos avaliados e refaça a conta pelo critério: dá o mesmo resultado?',
      'Veja se o critério é aplicado igual por áreas diferentes;',
      'Confira se o risco alto tem tratamento definido e prazo;',
      'Suba a matriz de risco.'
    ]::text[]),

    ('6.1.3', 'x', array[
      'Abra a lista de requisitos legais de SSO e confira a data da última revisão;',
      'Confira se as NRs aplicáveis à atividade estão lá;',
      'Escolha dois requisitos e verifique o atendimento no local, não no papel;',
      'Veja se há registro de quem revisa a lista e com que frequência;',
      'Suba a lista e a evidência do que conferiu.'
    ]::text[]),

    ('6.1.4', 'x', array[
      'Peça o plano de ação dos riscos, dos requisitos legais e das emergências;',
      'Confira se cada ação tem responsável, prazo e recurso definido;',
      'Escolha duas ações vencidas e veja o que aconteceu;',
      'Confira se a eficácia das ações concluídas foi avaliada;',
      'Suba o plano.'
    ]::text[]),

    ('6.2.1', 'x', array[
      'Abra os objetivos de SSO;',
      'Confira se são mensuráveis e se conversam com os riscos levantados — objetivo que não ataca o risco principal da empresa é enfeite;',
      'Veja o resultado atual de cada um;',
      'Suba os objetivos com o acompanhamento.'
    ]::text[]),

    ('6.2.2', 'x', array[
      'Para cada objetivo, confira se há plano: o que será feito, com que recursos, por quem, até quando e como avaliar;',
      'Confira se os trabalhadores foram consultados na definição;',
      'Suba os planos.'
    ]::text[])
)
update public.inspecao_modelo_itens i
   set passos = d.passos
  from dados d
  join public.inspecao_modelos m
    on m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 45001'
 where i.modelo_id = m.id
   and i.requisito = d.req
   and (
     d.marca = 'x'
     -- "quest" sozinho casaria também com a pergunta do clima, que diz
     -- "se a mudança climática é uma questão relevante". Os dois itens
     -- do 4.1 ficariam com os mesmos passos, e o Postgres escolheria
     -- qual sem avisar. O critério precisa ser exclusivo.
     or (d.marca = 'questoes' and i.pergunta ilike '%questões internas%')
     or (d.marca = 'clima'    and i.pergunta ilike '%climática%')
     or (d.marca = 'perigos'  and i.pergunta ilike '%perigo%')
     or (d.marca = 'riscos'   and i.pergunta ilike '%avaliad%')
   );


-- ---------- Conferência -------------------------------------------------
select i.requisito, coalesce(array_length(i.passos, 1), 0) as passos
  from public.inspecao_modelo_itens i
  join public.inspecao_modelos m on m.id = i.modelo_id
 where m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 45001'
   and i.ordem <= 16
 order by i.ordem;
