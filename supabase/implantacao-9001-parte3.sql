-- =====================================================================
-- Trilha de implantação da ISO 9001:2026 — parte 3 de 4.
--
-- Atividades das etapas 9 a 12: Comercial, Compras, Gestão Operacional
-- e Projeto e Desenvolvimento.
--
-- AQUI A NORMA ENCOSTA NO NEGÓCIO. As etapas anteriores montaram a
-- estrutura; estas quatro são o processo que ganha dinheiro. É onde a
-- empresa costuma descobrir que já faz quase tudo o que a norma pede —
-- só não registra. A maior parte do trabalho é escrever o que já
-- acontece, não inventar processo novo.
--
-- A ETAPA 12 PODE NÃO SE APLICAR. Projeto e desenvolvimento é a
-- exclusão mais comum da 9001: quem fabrica conforme projeto do
-- cliente não desenvolve produto. A primeira atividade dela é
-- justamente decidir isso, e a decisão vai direto para o campo de
-- exclusões do escopo.
--
-- UM COMANDO POR ETAPA. O arquivo da parte 2 era um VALUES único e
-- chegava corrompido no editor; partido assim, cada pedaço é pequeno e
-- se um falhar só ele é refeito.
--
-- Depende de supabase/implantacao-9001-parte1.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

-- ========================= 9. Comercial =============================
  (9, 1, 'Comunicação com o cliente'::text, 'atividade'::text, '8.2.1'::text,
   'O 8.2.1 pede que a empresa determine como se comunica com o cliente: sobre o produto, '
   || 'sobre pedidos e alterações, sobre reclamações, sobre a propriedade dele que esteja '
   || 'com a gente, e sobre requisitos de contingência quando pertinentes.'
   || E'\n\n' ||
   'Não é um procedimento longo. É registrar quem fala com o cliente, por qual canal, e o '
   || 'que fica guardado dessa conversa — porque "foi combinado por telefone" não se defende '
   || 'quando o pedido chega errado.'::text,
   array[
     'Liste os canais pelos quais o cliente fala com a empresa hoje (telefone, WhatsApp, e-mail, visita);',
     'Para cada um, diga quem atende e onde o combinado fica registrado;',
     'Defina o que vira registro obrigatório: pedido, alteração de pedido, reclamação;',
     'Faça o upload do quadro de comunicação com o cliente.'
   ]::text[], true, true),

  (9, 2, 'Requisitos do produto ou serviço', 'atividade', '8.2.2',
   'Antes de prometer, é preciso saber o que está sendo prometido. O 8.2.2 pede que a '
   || 'empresa determine os requisitos do que oferece — os que o cliente pede, os que a lei '
   || 'exige, e os que a própria empresa considera necessários.'
   || E'\n\n' ||
   'E pede que a empresa seja capaz de atender ao que declara. Prometer prazo que a produção '
   || 'não entrega é não conformidade antes mesmo de o pedido entrar.',
   array[
     'Baixe o formulário de requisitos do produto;',
     'Liste, por linha de produto ou serviço, o que define que ele está certo;',
     'Inclua os requisitos legais levantados na etapa 5;',
     'Inclua o que a empresa promete por conta própria (prazo, garantia, assistência);',
     'Faça o upload do formulário.'
   ]::text[], true, true),

  (9, 3, 'Análise crítica antes de assumir o pedido', 'atividade', '8.2.3',
   'É o requisito mais prático do capítulo 8: antes de dizer sim ao cliente, alguém confere '
   || 'se a empresa consegue entregar aquilo, naquele prazo, por aquele preço.'
   || E'\n\n' ||
   'Em empresa pequena isso acontece de cabeça, e funciona — até o dia em que o vendedor '
   || 'promete o que a fábrica não faz. O que a norma acrescenta é o registro: quem analisou, '
   || 'quando, e o que foi verificado.',
   array[
     'Defina quem faz a análise crítica de cada tipo de pedido;',
     'Defina o que é conferido: capacidade, prazo, material, requisito especial do cliente;',
     'Escolha onde o registro fica — pode ser um campo no próprio pedido, não precisa de formulário novo;',
     'Combine o que fazer quando o cliente não formaliza o pedido por escrito;',
     'Faça o upload do registro de análise crítica em uso.'
   ]::text[], true, true),

  (9, 4, 'Mudanças no pedido', 'atividade', '8.2.4',
   'Cliente muda de ideia. O 8.2.4 pede que, quando isso acontece, a informação documentada '
   || 'seja alterada e as pessoas envolvidas fiquem sabendo.'
   || E'\n\n' ||
   'A falha clássica: o comercial aceita a mudança, a produção não é avisada, e a peça sai '
   || 'do jeito antigo. O registro da mudança é o que impede isso.',
   array[
     'Defina como uma alteração de pedido é registrada;',
     'Defina quem precisa ser avisado e como;',
     'Combine o prazo-limite para aceitar mudança sem renegociar prazo;',
     'Anote no comentário o que foi combinado;',
     'Envie.'
   ]::text[], false, true),

  (9, 5, 'Satisfação do cliente', 'atividade', '9.1.2',
   'O 9.1.2 pede que a empresa monitore a percepção do cliente sobre o grau em que suas '
   || 'necessidades e expectativas foram atendidas — e que determine os métodos para obter, '
   || 'monitorar e analisar essa informação.'
   || E'\n\n' ||
   'Pesquisa formal é um método, não o único. Reclamação, devolução, índice de recompra e '
   || 'elogio registrado também contam. Em empresa com poucos clientes, uma conversa anotada '
   || 'vale mais que um formulário que ninguém responde.',
   array[
     'Escolha dois métodos que a empresa consegue manter;',
     'Defina a frequência e quem coleta;',
     'Defina como o resultado é analisado e para onde vai (entra na análise crítica do 9.3);',
     'Faça a primeira coleta com pelo menos três clientes;',
     'Faça o upload do método e do primeiro resultado.'
   ]::text[], true, true),

  (9, 6, 'Feedback da etapa', 'feedback', null,
   'O comercial costuma ser a área que mais resiste a registrar. Conte como foi.',
   array[
     'Diga o que a equipe comercial achou mais trabalhoso;',
     'Conte se algum registro novo atrapalhou a venda;',
     'Envie.'
   ]::text[], false, false)

)
insert into public.implantacao_atividades
  (etapa_id, ordem, titulo, tipo, requisito, aula, passos,
   upload_obrigatorio, aprovacao_obrigatoria)
select e.id, d.ordem, d.titulo, d.tipo, d.requisito, d.aula, d.passos,
       d.upload, d.aprova
  from dados d
  join public.implantacao_etapas e   on e.ordem = d.etapa
  join public.implantacao_modelos m  on m.id = e.modelo_id
 where m.nome = 'Implantação — ISO 9001:2026'
on conflict (etapa_id, ordem) do update
   set titulo = excluded.titulo,
       tipo = excluded.tipo,
       requisito = excluded.requisito,
       aula = excluded.aula,
       passos = excluded.passos,
       upload_obrigatorio = excluded.upload_obrigatorio,
       aprovacao_obrigatoria = excluded.aprovacao_obrigatoria;


with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

-- ========================== 10. Compras =============================
  (10, 1, 'Critérios para escolher um fornecedor'::text, 'atividade'::text, '8.4.1'::text,
   'O 8.4.1 pede que a empresa determine os controles a aplicar a processos, produtos e '
   || 'serviços providos externamente, e que estabeleça critérios para avaliar, selecionar, '
   || 'monitorar o desempenho e reavaliar os provedores.'
   || E'\n\n' ||
   'Critério não precisa ser nota de zero a dez. Pode ser: entrega no prazo, produto dentro '
   || 'da especificação, atendimento quando dá problema. O que não pode é escolher fornecedor '
   || 'sem saber dizer por quê.'::text,
   array[
     'Baixe a planilha de fornecedores;',
     'Liste os fornecedores que afetam a qualidade do que a empresa entrega;',
     'Defina de dois a quatro critérios de avaliação;',
     'Avalie cada fornecedor atual com esses critérios;',
     'Faça o upload da planilha.'
   ]::text[], true, true),

  (10, 2, 'Quanto controle cada fornecedor precisa', 'atividade', '8.4.2',
   'O 8.4.2 pede que a empresa assegure que o que vem de fora não comprometa a entrega ao '
   || 'cliente — e que defina a verificação necessária.'
   || E'\n\n' ||
   'A regra prática: quanto mais o item afeta o cliente, mais controle. Parafuso comum se '
   || 'confere no olho; aço estrutural pede certificado do lote. Controlar tudo igual é caro '
   || 'e ninguém sustenta.',
   array[
     'Para cada fornecedor da planilha, defina como o recebimento é conferido;',
     'Diga o que é exigido na entrega: nota, certificado, laudo, amostra;',
     'Defina o que acontece quando chega fora do especificado;',
     'Registre na mesma planilha;',
     'Faça o upload da planilha atualizada.'
   ]::text[], true, true),

  (10, 3, 'O que a empresa informa ao fornecedor', 'atividade', '8.4.3',
   'O 8.4.3 pede que a empresa comunique ao provedor externo o que espera dele: o processo '
   || 'ou produto a ser fornecido, a aprovação necessária, a competência exigida das pessoas, '
   || 'a interação com o SGQ, o controle que será aplicado e as atividades de verificação que '
   || 'a empresa pretende realizar no local do fornecedor.'
   || E'\n\n' ||
   'Na prática, é ter um pedido de compra que diga o que se quer. Pedido que só traz '
   || '"material diverso" e um valor é o que gera a entrega errada.',
   array[
     'Pegue três pedidos de compra recentes;',
     'Veja se dá para saber, por eles, exatamente o que foi pedido;',
     'Ajuste o modelo de pedido para incluir especificação, prazo e o que exigir na entrega;',
     'Faça o upload do novo modelo de pedido de compra.'
   ]::text[], true, true),

  (10, 4, 'Reavaliação periódica', 'atividade', '8.4.1',
   'Fornecedor bom hoje pode piorar. A norma pede reavaliação — e pede o registro dela.'
   || E'\n\n' ||
   'Uma vez por ano resolve na maioria das empresas. O que importa é que aconteça e que '
   || 'tenha consequência: fornecedor reprovado duas vezes seguidas e mantido sem '
   || 'justificativa é pergunta certa do auditor.',
   array[
     'Defina a frequência da reavaliação;',
     'Defina o que acontece com quem for reprovado;',
     'Marque a data da primeira reavaliação no calendário;',
     'Anote no comentário o que foi combinado;',
     'Envie.'
   ]::text[], false, true),

  (10, 5, 'Feedback da etapa', 'feedback', null,
   'Compras costuma ser rápida quando a empresa tem poucos fornecedores. Como foi aqui?',
   array[
     'Diga quantos fornecedores entraram na planilha;',
     'Conte se algum critério foi difícil de definir;',
     'Envie.'
   ]::text[], false, false)

)
insert into public.implantacao_atividades
  (etapa_id, ordem, titulo, tipo, requisito, aula, passos,
   upload_obrigatorio, aprovacao_obrigatoria)
select e.id, d.ordem, d.titulo, d.tipo, d.requisito, d.aula, d.passos,
       d.upload, d.aprova
  from dados d
  join public.implantacao_etapas e   on e.ordem = d.etapa
  join public.implantacao_modelos m  on m.id = e.modelo_id
 where m.nome = 'Implantação — ISO 9001:2026'
on conflict (etapa_id, ordem) do update
   set titulo = excluded.titulo,
       tipo = excluded.tipo,
       requisito = excluded.requisito,
       aula = excluded.aula,
       passos = excluded.passos,
       upload_obrigatorio = excluded.upload_obrigatorio,
       aprovacao_obrigatoria = excluded.aprovacao_obrigatoria;


with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

-- ===================== 11. Gestão Operacional =======================
  (11, 1, 'Produção sob condições controladas'::text, 'atividade'::text, '8.5.1'::text,
   'O 8.5.1 é a espinha da operação. Pede que a produção ou a prestação do serviço aconteça '
   || 'sob condições controladas: com a informação disponível sobre o que se produz e sobre '
   || 'os resultados a alcançar, com os recursos de medição adequados, com infraestrutura e '
   || 'ambiente apropriados, com pessoas competentes, e com as atividades de monitoramento '
   || 'nos pontos certos.'
   || E'\n\n' ||
   'Traduzindo: quem está fazendo sabe o que fazer e como saber se está certo. Isso costuma '
   || 'existir na cabeça do supervisor — a atividade é passar para o papel onde isso importa.'::text,
   array[
     'Escolha o processo produtivo principal;',
     'Liste os pontos onde um erro passaria despercebido até o cliente;',
     'Para cada ponto, defina a verificação e quem faz;',
     'Escreva a instrução de trabalho dos dois ou três pontos mais críticos;',
     'Faça o upload das instruções.'
   ]::text[], true, true),

  (11, 2, 'Identificação e rastreabilidade', 'atividade', '8.5.2',
   'O 8.5.2 pede que a empresa identifique as saídas quando necessário para assegurar a '
   || 'conformidade, identifique a situação delas quanto aos requisitos de monitoramento, e '
   || 'controle a identificação unívoca quando a rastreabilidade for requisito.'
   || E'\n\n' ||
   'Em bom português: saber qual peça é qual, saber se já foi inspecionada ou não, e — '
   || 'quando o cliente ou a lei exigem — saber de que lote veio.',
   array[
     'Defina como o produto é identificado ao longo do processo;',
     'Defina como se distingue o que já foi aprovado do que ainda não foi;',
     'Diga se a rastreabilidade é exigida (cliente, lei, contrato) e até que nível;',
     'Faça o upload do procedimento ou da foto do método em uso.'
   ]::text[], true, true),

  (11, 3, 'Propriedade do cliente ou do fornecedor', 'atividade', '8.5.3',
   'Material, ferramenta, projeto, dado ou equipamento que não é da empresa e está sob a '
   || 'guarda dela. O 8.5.3 pede identificar, verificar, proteger e salvaguardar — e avisar '
   || 'o dono se algo se perder, danificar ou ficar inadequado.'
   || E'\n\n' ||
   'Muita empresa acha que não se aplica e se engana: o desenho que o cliente mandou é '
   || 'propriedade dele.',
   array[
     'Liste o que está na empresa e não é dela;',
     'Para cada item, diga como é identificado e protegido;',
     'Defina o que fazer e a quem avisar se algo acontecer;',
     'Se nada se aplicar, registre isso com justificativa;',
     'Faça o upload do levantamento.'
   ]::text[], true, true),

  (11, 4, 'Preservação', 'atividade', '8.5.4',
   'O produto precisa chegar ao cliente como saiu. O 8.5.4 cobre manuseio, embalagem, '
   || 'armazenamento, proteção e transporte.'
   || E'\n\n' ||
   'É o requisito que aparece em devolução por produto amassado, enferrujado ou trocado — '
   || 'defeito que não veio da produção, veio do caminho.',
   array[
     'Mapeie o caminho do produto pronto até o cliente;',
     'Em cada ponto, diga o que pode estragá-lo;',
     'Defina a proteção de cada etapa (embalagem, local de estoque, forma de transporte);',
     'Faça o upload do procedimento de preservação.'
   ]::text[], true, true),

  (11, 5, 'Atividades pós-entrega', 'atividade', '8.5.5',
   'Garantia, assistência técnica, reciclagem, descarte final. O 8.5.5 pede que a empresa '
   || 'determine a extensão dessas atividades considerando requisitos legais, consequências '
   || 'indesejáveis do produto, tempo de vida, requisitos do cliente e retorno do cliente.'
   || E'\n\n' ||
   'Se a empresa dá garantia, ela precisa conseguir honrá-la — e registrar o que foi feito.',
   array[
     'Liste o que a empresa se compromete a fazer depois da entrega;',
     'Para cada compromisso, diga quem executa e em que prazo;',
     'Defina o registro do atendimento pós-venda;',
     'Faça o upload do levantamento.'
   ]::text[], true, true),

  (11, 6, 'Controle de mudanças na operação', 'atividade', '8.5.6',
   'Mudou o processo, a máquina, o material ou o fornecedor? O 8.5.6 pede análise crítica e '
   || 'controle dessa mudança, na medida necessária para continuar conforme, e o registro de '
   || 'quem autorizou e das ações decorrentes.'
   || E'\n\n' ||
   'É o irmão operacional do 6.3, que você já tratou na etapa 3. Aqui é no chão de fábrica.',
   array[
     'Defina o que conta como mudança de operação;',
     'Defina quem autoriza;',
     'Use o mesmo formulário de planejamento de mudanças da etapa 3, se servir;',
     'Anote no comentário o que foi combinado;',
     'Envie.'
   ]::text[], false, true),

  (11, 7, 'Liberação do produto', 'atividade', '8.6',
   'O 8.6 pede que a empresa implemente arranjos planejados para verificar se os requisitos '
   || 'foram atendidos, e que a liberação ao cliente não aconteça até que isso esteja '
   || 'satisfatoriamente concluído — a menos que aprovado por autoridade pertinente e, quando '
   || 'aplicável, pelo cliente. E pede o registro: evidência da conformidade e quem autorizou.'
   || E'\n\n' ||
   'É a assinatura que diz "pode entregar". Entrega sem essa evidência é constatação fácil, '
   || 'porque o auditor pede um pedido entregue e pergunta quem liberou.',
   array[
     'Defina quem autoriza a liberação de cada tipo de produto;',
     'Defina o registro que acompanha a liberação;',
     'Confira três entregas recentes: dá para saber quem liberou?',
     'Faça o upload do registro de liberação em uso.'
   ]::text[], true, true),

  (11, 8, 'Feedback da etapa', 'feedback', null,
   'Esta é a etapa que mais mexe no dia a dia de quem produz. Como a equipe reagiu?',
   array[
     'Conte o que foi mais difícil de implantar no chão;',
     'Diga se algum controle novo atrapalhou a produção;',
     'Envie.'
   ]::text[], false, false)

)
insert into public.implantacao_atividades
  (etapa_id, ordem, titulo, tipo, requisito, aula, passos,
   upload_obrigatorio, aprovacao_obrigatoria)
select e.id, d.ordem, d.titulo, d.tipo, d.requisito, d.aula, d.passos,
       d.upload, d.aprova
  from dados d
  join public.implantacao_etapas e   on e.ordem = d.etapa
  join public.implantacao_modelos m  on m.id = e.modelo_id
 where m.nome = 'Implantação — ISO 9001:2026'
on conflict (etapa_id, ordem) do update
   set titulo = excluded.titulo,
       tipo = excluded.tipo,
       requisito = excluded.requisito,
       aula = excluded.aula,
       passos = excluded.passos,
       upload_obrigatorio = excluded.upload_obrigatorio,
       aprovacao_obrigatoria = excluded.aprovacao_obrigatoria;


with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

-- ================= 12. Projeto e Desenvolvimento ====================
  (12, 1, 'Esta etapa se aplica à sua empresa?'::text, 'atividade'::text, '8.3.1'::text,
   'Projeto e desenvolvimento é a exclusão mais comum da ISO 9001. Aplica-se a quem cria o '
   || 'produto: define o que ele é, como funciona, que material leva.'
   || E'\n\n' ||
   'NÃO se aplica a quem fabrica conforme projeto fornecido pelo cliente, nem a quem executa '
   || 'serviço segundo norma técnica de terceiro, nem a quem revende.'
   || E'\n\n' ||
   'A pergunta tem de ser respondida antes de seguir. Se a resposta for não, a justificativa '
   || 'vai para o campo de exclusões do escopo e esta etapa inteira é dispensada — e dizer '
   || '"não se aplica" com justificativa é totalmente aceito na certificação.'::text,
   array[
     'Responda: a empresa define o que o produto é, ou executa projeto de terceiro?',
     'Se desenvolve, siga para a atividade 2 desta etapa;',
     'Se não desenvolve, escreva a justificativa no comentário e leve-a para o campo de exclusões no escopo (etapa 3);',
     'Envie para a nossa conferência — nós confirmamos se a exclusão se sustenta.'
   ]::text[], false, true),

  (12, 2, 'Planejamento do projeto', 'atividade', '8.3.2',
   'O 8.3.2 pede que a empresa considere, ao planejar: a natureza e a duração do projeto, as '
   || 'etapas necessárias, a verificação e a validação, as responsabilidades, os recursos, as '
   || 'interfaces entre as pessoas envolvidas, o envolvimento do cliente, o que será '
   || 'necessário para o fornecimento posterior, e o nível de controle esperado pelo cliente.'
   || E'\n\n' ||
   'Em empresa pequena isso cabe numa folha por projeto.',
   array[
     'Baixe o formulário de planejamento de projeto;',
     'Preencha para um projeto em andamento ou recém-concluído;',
     'Defina as etapas e quem responde por cada uma;',
     'Faça o upload do formulário preenchido.'
   ]::text[], true, true),

  (12, 3, 'Entradas de projeto', 'atividade', '8.3.3',
   'O que o projeto precisa saber antes de começar: requisitos funcionais e de desempenho, '
   || 'informações de projetos anteriores semelhantes, requisitos legais, normas que a '
   || 'empresa se comprometeu a seguir, e as consequências potenciais de falha.'
   || E'\n\n' ||
   'Entradas incompletas são a causa mais comum de retrabalho de projeto — e a norma pede '
   || 'que conflitos entre entradas sejam resolvidos antes de seguir.',
   array[
     'Liste as entradas do projeto escolhido;',
     'Verifique se há conflito entre elas e resolva antes de seguir;',
     'Registre a aprovação das entradas;',
     'Faça o upload do registro.'
   ]::text[], true, true),

  (12, 4, 'Controles: análise crítica, verificação e validação', 'atividade', '8.3.4',
   'São três coisas diferentes, e a norma cobra as três no 8.3.4.'
   || E'\n\n' ||
   'ANÁLISE CRÍTICA pergunta: o projeto está andando bem? VERIFICAÇÃO pergunta: a saída '
   || 'atende à entrada, no papel? VALIDAÇÃO pergunta: o produto funciona na mão do cliente, '
   || 'no uso real?'
   || E'\n\n' ||
   'Confundir verificação com validação é o erro mais frequente. Desenho conferido não prova '
   || 'que a peça funciona montada.',
   array[
     'Defina quando acontece cada uma das três no seu processo;',
     'Defina quem participa e o que fica registrado;',
     'Faça o registro das três para o projeto escolhido;',
     'Faça o upload dos registros.'
   ]::text[], true, true),

  (12, 5, 'Saídas de projeto', 'atividade', '8.3.5',
   'O que sai do projeto precisa atender aos requisitos de entrada, ser adequado aos '
   || 'processos seguintes, incluir ou referenciar requisitos de monitoramento e critérios de '
   || 'aceitação, e especificar as características essenciais para o uso pretendido e para o '
   || 'fornecimento seguro e adequado.'
   || E'\n\n' ||
   'É o desenho, a especificação, a ficha técnica — com a informação que a produção e o '
   || 'cliente precisam.',
   array[
     'Liste as saídas do projeto escolhido;',
     'Confira se cada uma diz como se verifica a conformidade;',
     'Registre a aprovação das saídas antes da liberação;',
     'Faça o upload.'
   ]::text[], true, true),

  (12, 6, 'Mudanças de projeto', 'atividade', '8.3.6',
   'Projeto muda, inclusive depois de pronto. O 8.3.6 pede identificar, analisar criticamente '
   || 'e controlar essas mudanças, e reter informação documentada sobre as mudanças, os '
   || 'resultados das análises, as autorizações e as ações tomadas para evitar impacto '
   || 'adverso.'
   || E'\n\n' ||
   'Mudança de projeto sem controle de revisão produz duas versões do mesmo desenho no chão '
   || 'de fábrica — e a peça sai pela versão errada.',
   array[
     'Defina como uma revisão de projeto é identificada;',
     'Defina quem autoriza e quem é avisado;',
     'Confira que não existe desenho antigo em circulação;',
     'Faça o upload do controle de revisões.'
   ]::text[], true, true),

  (12, 7, 'Feedback da etapa', 'feedback', null,
   'Se esta etapa se aplicou, foi provavelmente a mais técnica da trilha.',
   array[
     'Diga se a etapa se aplicou ou foi excluída;',
     'Se se aplicou, conte o que foi mais difícil;',
     'Envie.'
   ]::text[], false, false)

)
insert into public.implantacao_atividades
  (etapa_id, ordem, titulo, tipo, requisito, aula, passos,
   upload_obrigatorio, aprovacao_obrigatoria)
select e.id, d.ordem, d.titulo, d.tipo, d.requisito, d.aula, d.passos,
       d.upload, d.aprova
  from dados d
  join public.implantacao_etapas e   on e.ordem = d.etapa
  join public.implantacao_modelos m  on m.id = e.modelo_id
 where m.nome = 'Implantação — ISO 9001:2026'
on conflict (etapa_id, ordem) do update
   set titulo = excluded.titulo,
       tipo = excluded.tipo,
       requisito = excluded.requisito,
       aula = excluded.aula,
       passos = excluded.passos,
       upload_obrigatorio = excluded.upload_obrigatorio,
       aprovacao_obrigatoria = excluded.aprovacao_obrigatoria;


-- ---------- Conferência -------------------------------------------------
select e.ordem, e.nome, count(a.id) as atividades
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
  left join public.implantacao_atividades a on a.etapa_id = e.id
 where m.nome = 'Implantação — ISO 9001:2026'
 group by e.ordem, e.nome
 order by e.ordem;
