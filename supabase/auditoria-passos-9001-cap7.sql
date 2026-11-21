-- =====================================================================
-- Os passos do capítulo 7 da ISO 9001:2026 — Apoio. Dez requisitos.
--
-- É o capítulo que a empresa mais subestima e onde o auditor mais
-- encontra coisa: competência sem comprovação, instrumento vencido,
-- documento sem controle de versão.
--
-- O 7.3 SE AUDITA NO CHÃO, NÃO NA PASTA. Conscientização não tem
-- documento próprio: prova-se perguntando a quem trabalha. Por isso o
-- passo manda conversar, e é o passo que mais derruba certificação.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(req, passos) as (
  values
    ('7.1.1'::text, array[
      'Pergunte a quem conduz o sistema o que falta hoje para ele funcionar — gente, hora, equipamento, software;',
      'Procure o registro dessa necessidade levada à direção;',
      'Confira o que foi aprovado e o que ficou para depois: limitação declarada é tratável, limitação escondida vira constatação;',
      'Suba a ata ou o registro em que os recursos foram discutidos.'
    ]::text[]),

    ('7.1.2', array[
      'Compare as funções que afetam a qualidade com quem de fato existe na empresa hoje;',
      'Pergunte se algum registro do sistema atrasa por falta de gente;',
      'Confira se a direção sabe dessa falta e decidiu alguma coisa;',
      'Suba o registro dessa decisão.'
    ]::text[]),

    ('7.1.3', array[
      'Peça a lista do que é essencial para entregar o produto ou serviço — máquina, veículo, prédio, sistema;',
      'Escolha dois itens críticos e pergunte quando foi a última manutenção;',
      'Confira se existe plano de manutenção ou se só se conserta quando quebra;',
      'Em máquina crítica, manutenção apenas corretiva é difícil de defender;',
      'Suba a lista e os registros de manutenção.'
    ]::text[]),

    ('7.1.4', array[
      'Pergunte que condições do ambiente afetam a qualidade do que a empresa entrega — temperatura, poeira, ruído, iluminação, limpeza;',
      'Veja no local se o que está escrito corresponde ao que se vê;',
      'Confira também o lado social: pressão, jornada, clima da equipe. A norma pede, e isso aparece no retrabalho antes de aparecer em pesquisa;',
      'Se houver laudo de ruído, calor ou iluminação, confira a validade;',
      'Suba o levantamento e os laudos.'
    ]::text[]),

    ('7.1.5', array[
      'Peça a lista dos instrumentos usados para aceitar ou rejeitar produto;',
      'Escolha três e confira o certificado de calibração e a validade;',
      'Veja se cada instrumento tem identificação que o ligue ao certificado;',
      'Pergunte o que a empresa faz quando encontra um instrumento fora de calibração — a norma pede avaliar o que já foi medido com ele;',
      'Se a empresa não mede nada para aceitar o próprio trabalho, confira se a não aplicação está registrada;',
      'Suba a lista e os certificados conferidos.'
    ]::text[]),

    ('7.1.6', array[
      'Pergunte que conhecimento hoje está só na cabeça de uma pessoa;',
      'Confira se existe algum registro disso — instrução, vídeo, foto do ajuste;',
      'Veja o que aconteceu da última vez que alguém com conhecimento crítico saiu;',
      'Suba o que a empresa já registrou desse conhecimento.'
    ]::text[]),

    ('7.2', array[
      'Abra a matriz de competência e escolha três funções que afetam a qualidade;',
      'Para cada pessoa, confira a comprovação: certificado, avaliação prática ou registro de experiência — a norma aceita as três;',
      'Onde houver lacuna, confira se há ação com prazo;',
      'Para treinamentos já feitos, peça a avaliação de eficácia: lista de presença prova que a pessoa esteve na sala, não que aprendeu;',
      'Suba a matriz e os comprovantes conferidos.'
    ]::text[]),

    ('7.3', array[
      'Vá ao local de trabalho e converse com duas ou três pessoas, de turnos diferentes se houver;',
      'Pergunte o que é a política da qualidade e o que ela muda no trabalho delas;',
      'Pergunte que objetivo da qualidade afeta a área delas;',
      'Pergunte o que acontece se o requisito não for atendido;',
      'Resposta vaga aqui é constatação, por melhor que seja o quadro na parede — registre o que ouviu;',
      'Suba o registro das conversas e os comprovantes de integração.'
    ]::text[]),

    ('7.4', array[
      'Abra o plano de comunicação e confira se ele descreve o que de fato acontece;',
      'Escolha dois itens e procure a evidência: a reunião semanal aconteceu? o mural foi atualizado?',
      'Confira se a comunicação externa está lá: cliente, fornecedor, órgão fiscalizador;',
      'Plano que descreve uma empresa que não existe é pior que plano nenhum;',
      'Suba o plano e uma evidência de cada canal.'
    ]::text[]),

    ('7.5', array[
      'Abra a lista mestra de documentos e registros;',
      'Escolha três documentos e confira se a versão que está em uso no local é a mesma da lista;',
      'Confira se cada um tem código, revisão e aprovação;',
      'Procure documento antigo ainda circulando — é a constatação mais comum deste requisito;',
      'Pergunte como é feito o backup e quando foi o último teste de restauração;',
      'Suba a lista mestra e os documentos conferidos.'
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
   and i.requisito like '7.%'
 order by i.ordem;
