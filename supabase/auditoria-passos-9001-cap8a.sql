-- =====================================================================
-- Os passos do capítulo 8 da ISO 9001:2026 — parte A: planejamento
-- operacional, requisitos do produto e projeto. Dez requisitos.
--
-- É o capítulo que a certificadora audita no chão, com a ordem de
-- produção na mão. Por isso quase todo passo aqui manda PEGAR UM
-- PEDIDO REAL e seguir o caminho dele — auditar pelo procedimento
-- mostra o que a empresa escreveu; auditar pelo pedido mostra o que
-- ela faz.
--
-- O 8.3 PODE NÃO SE APLICAR. É a exclusão mais comum da norma: quem
-- fabrica conforme projeto do cliente não desenvolve produto. O
-- primeiro passo do 8.3.1 é conferir a exclusão declarada no escopo,
-- e aí os demais ficam dispensados.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(req, passos) as (
  values
    ('8.1'::text, array[
      'Escolha o processo produtivo principal e peça para acompanhar um pedido do começo ao fim;',
      'Confira se existem critérios escritos de aceitação do que é produzido;',
      'Veja qual registro prova que o processo rodou conforme o planejado;',
      'Confira se esse registro existe para o pedido que você escolheu;',
      'Suba o registro.'
    ]::text[]),

    ('8.2.1', array[
      'Pergunte por quais canais o cliente fala com a empresa;',
      'Peça o registro das três últimas reclamações e veja o que foi feito;',
      'Confira se o cliente é avisado quando o pedido muda ou atrasa;',
      'Suba os registros de comunicação com o cliente.'
    ]::text[]),

    ('8.2.2', array[
      'Pegue três pedidos recentes e confira se dá para saber, por eles, exatamente o que foi prometido;',
      'Veja se os requisitos legais do produto aparecem, e não só preço e prazo;',
      'Confira se a empresa registrou que é capaz de atender ao que declarou;',
      'Suba os pedidos conferidos.'
    ]::text[]),

    ('8.2.3', array[
      'Para os mesmos pedidos, procure o registro da análise crítica feita ANTES de aceitar;',
      'Confira o que foi verificado: capacidade, prazo, material, exigência especial do cliente;',
      'Veja quem analisou e quando;',
      'Pergunte o que acontece quando o pedido chega por telefone e não é formalizado;',
      'Suba o registro da análise crítica.'
    ]::text[]),

    ('8.2.4', array[
      'Pergunte se algum dos pedidos sofreu alteração depois de aceito;',
      'Para os que sofreram, confira se o documento foi atualizado;',
      'Confirme com a produção se ela foi avisada da mudança — é aqui que a peça sai pela versão antiga;',
      'Suba o registro da alteração.'
    ]::text[]),

    ('8.3.1', array[
      'Primeiro confira se o requisito se aplica: a empresa define o que o produto é, ou executa projeto de terceiro?',
      'Se não desenvolve, procure a exclusão declarada no escopo (4.3) com a justificativa;',
      'Se a exclusão existe e se sustenta, registre como não aplicável e siga adiante;',
      'Se desenvolve, peça um projeto concluído no último ano para acompanhar nos próximos itens;',
      'Suba o escopo com a exclusão, ou o projeto escolhido.'
    ]::text[]),

    ('8.3.3', array[
      'Para o projeto escolhido, peça as entradas registradas;',
      'Confira se incluem requisitos funcionais, legais e de desempenho;',
      'Veja se há referência a projetos anteriores semelhantes;',
      'Confira se conflitos entre entradas foram resolvidos antes de seguir;',
      'Suba o registro das entradas.'
    ]::text[]),

    ('8.3.4', array[
      'Procure os três registros separados: análise crítica, verificação e validação;',
      'Confirme que não são a mesma coisa com nomes diferentes — verificação confere a saída contra a entrada, no papel; validação prova que o produto funciona no uso real;',
      'Veja quem participou de cada uma;',
      'Confira o que foi feito quando algum resultado não foi aprovado;',
      'Suba os três registros.'
    ]::text[]),

    ('8.3.5', array[
      'Peça as saídas do projeto: desenho, especificação, ficha técnica;',
      'Confira se elas dizem como se verifica a conformidade do produto;',
      'Veja se trazem os critérios de aceitação e as características essenciais para o uso seguro;',
      'Confira se foram aprovadas antes de irem para a produção;',
      'Suba as saídas.'
    ]::text[]),

    ('8.3.6', array[
      'Pergunte se o projeto sofreu revisão depois de liberado;',
      'Confira o controle de versão: quem autorizou, o que mudou, quem foi avisado;',
      'Vá até a produção e veja se há desenho antigo em circulação;',
      'Suba o registro das revisões.'
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
   and i.requisito like '8.%'
 order by i.ordem;
