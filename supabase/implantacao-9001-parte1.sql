-- =====================================================================
-- Trilha de implantação da ISO 9001:2026 — parte 1 de 4.
--
-- Cria a trilha, as 16 etapas do cronograma e as atividades das etapas
-- 1 a 4: Iniciando meu Projeto, Sistema de Gestão, Alta Direção e
-- Processos da Empresa.
--
-- POR QUE AS ETAPAS SÃO ÁREAS DA EMPRESA, NÃO CAPÍTULOS DA NORMA.
-- "Recursos Humanos" e "Compras" é como o cliente pensa o próprio
-- negócio. "7.2 Competência" é como a norma escreve. Organizar a
-- implantação pela norma obriga o dono da padaria a aprender a norma
-- antes de começar — que é exatamente o que ele contratou alguém para
-- não precisar fazer. A coluna `requisitos` guarda a ponte, para
-- provarmos a cobertura quando a certificadora perguntar.
--
-- POR QUE A AULA É ESCRITA POR NÓS. A norma é obra protegida: copiar o
-- texto dela para dentro do produto é problema de direito autoral, e
-- além disso o texto dela não ensina ninguém. A aula diz o que fazer
-- em português de empresa e cita o número do requisito.
--
-- POR QUE OS PASSOS SÃO ARRAY E NÃO UM PARÁGRAFO. A tela numera e, mais
-- adiante, vai poder marcar passo a passo. Parágrafo corrido faria o
-- cliente perder o lugar no meio de uma lista de nove instruções.
--
-- SEM LGPD, por decisão dele em 20/11/2026. O concorrente vende 9001 e
-- LGPD juntas; a etapa 5 aqui é só a legislação aplicável ao produto e
-- ao serviço.
--
-- Depende de supabase/implantacao.sql.
-- Não apaga nada. Pode rodar mais de uma vez: reescreve pelo número da
-- etapa e da atividade, então corrigir um texto é editar e rodar de novo.
-- =====================================================================

-- ---------- 1. A trilha -------------------------------------------------
insert into public.implantacao_modelos (nome, norma, descricao)
values (
  'Implantação — ISO 9001:2026',
  'ABNT NBR ISO 9001:2026',
  'Do zero ao certificado, por área da empresa. Cada atividade tem a aula, '
  || 'os passos, o modelo para baixar e a aprovação do consultor.'
)
on conflict (nome) do update
   set norma = excluded.norma, descricao = excluded.descricao;


-- ---------- 2. As 16 etapas do cronograma -------------------------------
with dados(ordem, nome, resumo, requisitos, livre) as (
  values
    (1,  'Iniciando meu Projeto'::text,
         'Quem conduz, quem participa, onde os documentos vão morar e quanto custa.'::text,
         null::text, true),
    (2,  'Sistema de Gestão',
         'O desenho do SGQ e a regra de como os documentos nascem, mudam e são guardados.',
         '4.4, 7.1.1, 7.5', false),
    (3,  'Alta Direção',
         'Contexto, partes interessadas, escopo, política, riscos, objetivos e análise crítica.',
         '4.1, 4.2, 4.3, 5.1.1, 5.1.2, 5.2, 5.3, 6.1.1, 6.1.2, 6.1.3, 6.2, 6.3, 9.3', false),
    (4,  'Processos da Empresa',
         'Quais são os processos, o que entra, o que sai e como se mede cada um.',
         '4.4, 8.1', false),
    (5,  'Requisitos Legais',
         'A legislação que se aplica ao que a empresa vende, e como ela é mantida em dia.',
         '4.2, 8.2.2', false),
    (6,  'Tecnologia da Informação',
         'Onde a informação do SGQ vive: acesso, backup e proteção contra perda.',
         '7.1.3, 7.5.3', false),
    (7,  'Gestão da Informação e Infraestrutura',
         'Prédio, máquina, ambiente de trabalho e instrumento de medição.',
         '7.1.3, 7.1.4, 7.1.5', false),
    (8,  'Recursos Humanos',
         'Quem faz, se sabe fazer, se sabe por que faz e como a empresa comunica.',
         '7.1.2, 7.1.6, 7.2, 7.3, 7.4', false),
    (9,  'Comercial',
         'Do pedido ao cliente satisfeito: requisitos, análise crítica, mudança e satisfação.',
         '8.2.1, 8.2.2, 8.2.3, 8.2.4, 9.1.2', false),
    (10, 'Compras',
         'Fornecedor escolhido com critério, controlado e informado do que precisa entregar.',
         '8.4.1, 8.4.2, 8.4.3', false),
    (11, 'Gestão Operacional',
         'A produção ou a prestação do serviço sob controle, do início à entrega.',
         '8.5.1, 8.5.2, 8.5.3, 8.5.4, 8.5.5, 8.5.6, 8.6', false),
    (12, 'Projeto e Desenvolvimento',
         'Só para quem projeta o que vende. Quem executa projeto de terceiro exclui esta etapa.',
         '8.3.1, 8.3.2, 8.3.3, 8.3.4, 8.3.5, 8.3.6', false),
    (13, 'Gestão de Melhorias',
         'Medir, analisar e melhorar — o que faz o sistema andar em vez de envelhecer.',
         '9.1.1, 9.1.3, 10.1', false),
    (14, 'Saídas Não Conformes e Ação Corretiva',
         'O que fazer quando sai errado, e como impedir que volte a sair.',
         '8.7, 10.2', false),
    (15, 'Preparação para Auditoria Externa',
         'A auditoria interna de verdade, rodada aqui no portal, antes de a certificadora chegar.',
         '9.2', false),
    (16, 'Certificação',
         'Escolha do organismo, fase 1, fase 2 e o tratamento das constatações.',
         null, false)
)
insert into public.implantacao_etapas (modelo_id, ordem, nome, resumo, requisitos, livre)
select m.id, d.ordem, d.nome, d.resumo, d.requisitos, d.livre
  from dados d
  cross join public.implantacao_modelos m
 where m.nome = 'Implantação — ISO 9001:2026'
on conflict (modelo_id, ordem) do update
   set nome = excluded.nome,
       resumo = excluded.resumo,
       requisitos = excluded.requisitos,
       livre = excluded.livre;


-- ---------- 3. Atividades das etapas 1 a 4 ------------------------------
with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

  -- ===================== 1. Iniciando meu Projeto =====================
  (1, 1, 'Perfil do interlocutor'::text, 'atividade'::text, null::text,
   'Toda implantação tem uma pessoa que responde pela empresa no dia a dia. '
   || 'Não precisa ser o dono nem alguém da qualidade: precisa ser alguém que '
   || 'consiga abrir portas internamente e que tenha algumas horas por semana. '
   || E'\n\n' ||
   'Quando esse papel não é definido no começo, cada atividade cai em alguém '
   || 'diferente, ninguém se sente dono, e a implantação para na terceira etapa.'::text,
   array[
     'Baixe a ficha do interlocutor logo abaixo;',
     'Preencha nome, cargo, telefone e e-mail de quem vai conduzir;',
     'Diga quantas horas por semana essa pessoa consegue dedicar — seja realista, não otimista;',
     'Indique um substituto, para férias e imprevistos;',
     'Salve e faça o upload do arquivo preenchido.'
   ]::text[], true, true),

  (1, 2, 'Definição da equipe do SGQ', 'atividade', null,
   'O interlocutor não implanta sozinho. Cada área da empresa precisa de alguém '
   || 'que responda por ela quando a trilha chegar lá — Compras, RH, Comercial, '
   || 'Operação.'
   || E'\n\n' ||
   'Essa lista não é burocracia: é ela que vamos usar para marcar as reuniões e '
   || 'para saber a quem cobrar cada entrega.',
   array[
     'Baixe a planilha da equipe;',
     'Liste uma pessoa por área, com cargo e e-mail;',
     'Marque quem já participou de alguma certificação antes;',
     'Faça o upload da planilha preenchida.'
   ]::text[], true, true),

  (1, 3, 'Organizar as pastas no computador', 'atividade', null,
   'Antes de produzir o primeiro documento, é preciso ter onde guardá-lo. A '
   || 'empresa que começa sem estrutura termina com três versões da política da '
   || 'qualidade em três computadores diferentes — e nenhuma delas é a válida.'
   || E'\n\n' ||
   'O portal gera a estrutura pronta, uma pasta por requisito da norma, com um '
   || 'LEIA-ME dentro de cada uma explicando o que vai ali.',
   array[
     'Abra "Antes de começar" no menu de Auditorias;',
     'Baixe o arquivo que cria as pastas e execute-o na pasta onde o SGQ vai morar;',
     'Confira que as pastas apareceram com os nomes certos;',
     'Combine com a equipe que esta é a única cópia válida — e que ninguém guarda documento do SGQ no desktop;',
     'Tire um print da estrutura criada e suba aqui.'
   ]::text[], true, false),

  (1, 4, 'Plano de investimento e cronograma', 'atividade', null,
   'Certificar custa dinheiro em três frentes: a consultoria, as adequações '
   || 'internas (calibração, treinamento, às vezes obra) e o organismo '
   || 'certificador. Quem descobre a terceira só no fim trava o projeto a dois '
   || 'meses do final.'
   || E'\n\n' ||
   'Esta atividade existe para a direção aprovar o investimento inteiro agora, '
   || 'com data, e não em pedaços.',
   array[
     'Baixe o modelo de plano de investimento;',
     'Preencha os custos das três frentes, com a melhor estimativa que você tem hoje;',
     'Defina a data-alvo da auditoria de certificação e trabalhe de trás para frente;',
     'Leve à direção e obtenha a aprovação formal (assinatura ou e-mail);',
     'Faça o upload do plano aprovado.'
   ]::text[], true, true),

  (1, 5, 'Feedback da etapa', 'feedback', null,
   'Fim da primeira etapa. Antes de seguir, queremos saber como foi: o que '
   || 'ficou confuso, o que demorou mais do que devia, o que faltou explicar.'
   || E'\n\n' ||
   'Isso muda a trilha de verdade — o que você escrever aqui é lido por quem '
   || 'escreve as próximas atividades.',
   array[
     'Escreva no campo de comentário o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou de verdade;',
     'Envie.'
   ]::text[], false, false),

  -- ======================= 2. Sistema de Gestão =======================
  (2, 1, 'O que é um sistema de gestão da qualidade', 'leitura', '4.4',
   'Um SGQ não é uma pilha de documentos. É o conjunto de processos da empresa, '
   || 'com as regras de como eles se conectam e como se sabe que estão '
   || 'funcionando. O requisito 4.4 pede justamente isso: que a empresa '
   || 'determine seus processos, as entradas e saídas de cada um, a sequência '
   || 'entre eles, quem responde por cada um e como são medidos.'
   || E'\n\n' ||
   'Documento é consequência, não objetivo. Quem inverte isso produz trinta '
   || 'procedimentos que ninguém lê e continua errando a mesma coisa.'
   || E'\n\n' ||
   'Leia com calma. As próximas atividades só fazem sentido depois disto.',
   array[
     'Leia o texto acima;',
     'Assista ao vídeo da etapa, se houver;',
     'Marque como concluída.'
   ]::text[], false, false),

  (2, 2, 'Procedimento de controle da informação documentada', 'atividade', '7.5',
   'Esta é a regra que governa todas as outras: como um documento do SGQ nasce, '
   || 'quem aprova, como se identifica a versão, onde fica guardado, por quanto '
   || 'tempo e como se descarta. É o 7.5.'
   || E'\n\n' ||
   'É o primeiro procedimento a escrever porque todos os outros vão seguir o '
   || 'formato que ele define. Fazer ao contrário obriga a refazer o cabeçalho '
   || 'de tudo depois.',
   array[
     'Baixe o "Procedimento — Controle da Informação Documentada" abaixo;',
     'Salve o arquivo na pasta 07 - Apoio da estrutura criada na etapa 1;',
     'Inclua a logomarca no cabeçalho e o nome da empresa nos campos em vermelho;',
     'Leia o procedimento inteiro antes de alterar qualquer coisa;',
     'Ajuste os itens de backup e de tempo de guarda para a realidade da empresa;',
     'Preencha o rodapé (nome, data de aprovação) e a tabela de histórico de alterações;',
     'Salve e faça o upload para o consultor conferir;',
     'Depois de aprovado, guarde a versão final na pasta 07 - Apoio.'
   ]::text[], true, true),

  (2, 3, 'Mapa dos processos', 'atividade', '4.4',
   'Um desenho de uma página mostrando os processos da empresa e as setas entre '
   || 'eles. Quem entrega para quem, e em que ordem.'
   || E'\n\n' ||
   'É o documento que o auditor pede primeiro, porque é por ele que ele decide '
   || 'o que vai auditar. E é o que mais revela: processo que ninguém consegue '
   || 'desenhar costuma ser processo que ninguém controla.',
   array[
     'Baixe o modelo de mapa de processos;',
     'Liste os processos que existem de fato, não os que deveriam existir;',
     'Desenhe as setas: o que cada processo recebe e o que entrega, e para quem;',
     'Marque quais são os processos que tocam o cliente diretamente;',
     'Faça o upload do mapa.'
   ]::text[], true, true),

  (2, 4, 'Lista mestra de documentos e registros', 'atividade', '7.5.3',
   'A relação de tudo o que o SGQ tem: nome do documento, código, versão em '
   || 'vigor, onde está guardado e por quanto tempo.'
   || E'\n\n' ||
   'Sem ela, a resposta para "qual é a versão válida?" vira memória de uma '
   || 'pessoa só — e essa pessoa sai de férias.',
   array[
     'Baixe a planilha da lista mestra;',
     'Registre, por enquanto, o procedimento de informação documentada e o mapa de processos;',
     'Combine quem é o responsável por manter esta lista atualizada;',
     'Faça o upload da planilha.'
   ]::text[], true, true),

  (2, 5, 'Recursos necessários ao SGQ', 'atividade', '7.1.1',
   'O 7.1.1 pede que a empresa determine e providencie o que o sistema precisa '
   || 'para funcionar — gente, tempo, equipamento, software. É uma conversa '
   || 'curta com a direção, não um documento grande.'
   || E'\n\n' ||
   'O ponto é registrar o que foi decidido, inclusive quando a decisão foi '
   || '"não agora". Auditor aceita limitação declarada; não aceita silêncio.',
   array[
     'Liste o que falta hoje para o SGQ rodar (pessoa, hora, sistema, equipamento);',
     'Leve a lista à direção e anote o que foi aprovado e o que ficou para depois;',
     'Registre no campo de comentário o que foi decidido, com a data;',
     'Envie.'
   ]::text[], false, true),

  (2, 6, 'Feedback da etapa', 'feedback', null,
   'Como foi montar a base do sistema? Esta é a etapa em que mais gente trava, '
   || 'e queremos saber onde.',
   array[
     'Conte o que foi mais difícil;',
     'Diga se algum modelo veio confuso ou incompleto;',
     'Envie.'
   ]::text[], false, false),

  -- ========================= 3. Alta Direção ==========================
  (3, 1, 'Análise do negócio e contexto da empresa', 'atividade', '4.1',
   'O 4.1 pede que a empresa determine o que, de fora e de dentro, afeta a '
   || 'capacidade de entregar o que promete. Mercado, concorrência, tecnologia, '
   || 'fornecedores, mão de obra, situação financeira, clima organizacional.'
   || E'\n\n' ||
   'Não é redação escolar. É a lista de coisas que tiram o sono da direção — e '
   || 'ela vira a matéria-prima dos riscos na atividade 9 desta etapa.',
   array[
     'Baixe o modelo de análise de contexto;',
     'Reúna a direção por uma hora, não mais;',
     'Liste as questões externas e as internas, uma linha cada;',
     'Para cada uma, diga se hoje ela ajuda ou atrapalha;',
     'Faça o upload do documento preenchido.'
   ]::text[], true, true),

  (3, 2, 'Mudança climática: é questão relevante?', 'atividade', '4.1',
   'Desde a emenda de 2024, a norma exige que a empresa determine se a mudança '
   || 'climática é uma questão relevante para o seu contexto. A pergunta é '
   || 'obrigatória; a resposta pode ser não.'
   || E'\n\n' ||
   'O que não pode é ficar em branco. Auditor de certificação procura isso '
   || 'especificamente, porque é novidade e quase todo mundo esquece.'
   || E'\n\n' ||
   'Para uma transportadora, costuma ser sim (combustível, estiagem, estrada). '
   || 'Para um escritório de dois andares, costuma ser não — e tudo bem, desde '
   || 'que esteja registrado que a pergunta foi feita.',
   array[
     'Discuta na mesma reunião do contexto: o clima afeta o que vendemos, como produzimos ou quem nos fornece?',
     'Registre a conclusão no documento de contexto, com uma frase de justificativa;',
     'Se a resposta for sim, anote quais questões entram (vão virar risco na atividade 9);',
     'Envie o documento atualizado.'
   ]::text[], true, true),

  (3, 3, 'Partes interessadas e o que elas exigem', 'atividade', '4.2',
   'Quem tem interesse no que a empresa faz: cliente, funcionário, órgão '
   || 'fiscalizador, fornecedor, vizinhança, banco. E, de cada um, o que ele '
   || 'exige — porque é isso que vira requisito do sistema.'
   || E'\n\n' ||
   'A nota da emenda climática vale aqui também: se alguma parte interessada '
   || 'tem exigência ligada ao clima, ela entra nesta lista.',
   array[
     'Baixe o modelo de partes interessadas;',
     'Liste cada parte e o que ela exige, em linguagem direta;',
     'Marque quais exigências são lei (vão reaparecer na etapa 5);',
     'Faça o upload.'
   ]::text[], true, true),

  (3, 4, 'Escopo do sistema de gestão', 'atividade', '4.3',
   'A frase que diz o que está dentro do SGQ: quais produtos, quais serviços, '
   || 'quais unidades. E, se algum requisito da norma não se aplica, qual e por '
   || 'quê.'
   || E'\n\n' ||
   'O escopo é o que vai impresso no certificado. Escopo largo demais obriga a '
   || 'auditar o que não precisava; estreito demais faz o certificado não servir '
   || 'para o cliente que você queria atender.',
   array[
     'Baixe o modelo de escopo;',
     'Escreva em uma ou duas frases o que o SGQ cobre;',
     'Liste os endereços incluídos;',
     'Declare as exclusões com a justificativa (a mais comum é 8.3 Projeto e desenvolvimento);',
     'Confirme com a direção que é isso que vai no certificado;',
     'Faça o upload.'
   ]::text[], true, true),

  (3, 5, 'Missão, visão e valores', 'atividade', null,
   'A norma não exige. A implantação pede porque a política da qualidade, que '
   || 'vem a seguir, tem de ser coerente com isso — e porque quase toda empresa '
   || 'tem os três escritos em algum lugar, geralmente desatualizados.'
   || E'\n\n' ||
   'Se a empresa não tem, esta é a hora de escrever. Se tem, é a hora de ler '
   || 'em voz alta e perguntar se ainda é verdade.',
   array[
     'Procure a versão atual, se existir;',
     'Leve à direção e pergunte se ainda descreve a empresa;',
     'Atualize o que estiver vencido;',
     'Faça o upload da versão em vigor.'
   ]::text[], true, false),

  (3, 6, 'Política da qualidade', 'atividade', '5.2',
   'A política é o compromisso público da direção. O 5.2 pede que ela seja '
   || 'apropriada ao propósito e ao contexto da empresa, que sustente a direção '
   || 'estratégica, que inclua o compromisso de atender requisitos e de melhorar '
   || 'continuamente, e que sirva de base para os objetivos.'
   || E'\n\n' ||
   'Precisa estar disponível como informação documentada, ser comunicada e '
   || 'entendida dentro da empresa, e estar disponível às partes interessadas '
   || 'quando apropriado.'
   || E'\n\n' ||
   'Política copiada da internet se reconhece de longe: fala de "excelência" e '
   || 'não diz o que a empresa faz. O auditor pergunta a um funcionário do chão '
   || 'o que ela significa; se ninguém souber, vira constatação.',
   array[
     'Baixe o modelo de política da qualidade;',
     'Escreva de cinco a oito linhas, citando o que a empresa faz de fato;',
     'Confira que ela conversa com o contexto e com a missão;',
     'Leve para a direção aprovar e assinar;',
     'Combine como ela será comunicada (quadro, integração, e-mail) — a comunicação é a etapa 8;',
     'Faça o upload da política assinada.'
   ]::text[], true, true),

  (3, 7, 'Papéis, responsabilidades e autoridades', 'atividade', '5.3',
   'Quem responde pelo quê dentro do sistema. O 5.3 pede que a direção atribua '
   || 'e comunique isso.'
   || E'\n\n' ||
   'Na prática, é o organograma mais uma matriz dizendo quem aprova documento, '
   || 'quem trata não conformidade, quem fala com o cliente, quem autoriza '
   || 'mudança.',
   array[
     'Baixe a matriz de responsabilidades;',
     'Preencha uma linha por papel do SGQ;',
     'Confirme com cada pessoa que ela sabe que é responsável — atribuição que a pessoa desconhece não existe;',
     'Faça o upload da matriz.'
   ]::text[], true, true),

  (3, 8, 'Liderança e foco no cliente', 'atividade', '5.1.1',
   'O 5.1.1 e o 5.1.2 cobram a direção: ela precisa demonstrar liderança no '
   || 'sistema e garantir que os requisitos do cliente e os legais sejam '
   || 'determinados, entendidos e atendidos de forma consistente.'
   || E'\n\n' ||
   'Isso não se prova com declaração. Prova-se com evidência: a direção '
   || 'participou da análise crítica, aprovou recursos, acompanha indicadores, '
   || 'cobra o que foi decidido.'
   || E'\n\n' ||
   'Esta atividade existe para combinar desde já como essa evidência vai '
   || 'aparecer ao longo do ano.',
   array[
     'Defina a frequência da reunião da direção sobre o SGQ (mínimo uma por ano, o recomendado é trimestral);',
     'Registre quem participa e o que entra na pauta;',
     'Anote no comentário a data da primeira reunião já marcada;',
     'Envie.'
   ]::text[], false, true),

  (3, 9, 'Riscos e oportunidades', 'atividade', '6.1.1',
   'Na 4ª edição o 6.1 ficou dividido em três: o 6.1.1 pede considerar o '
   || 'contexto e as partes interessadas ao determinar riscos e oportunidades; '
   || 'o 6.1.2 pede planejar as ações para tratá-los e integrá-las aos '
   || 'processos; o 6.1.3 trata de como avaliar a eficácia dessas ações.'
   || E'\n\n' ||
   'Repare que as entradas são exatamente o que você já produziu: o contexto '
   || '(atividade 1), o clima (atividade 2) e as partes interessadas '
   || '(atividade 3). Risco que não sai de lá costuma ser risco inventado para '
   || 'preencher planilha.',
   array[
     'Baixe a planilha de riscos e oportunidades;',
     'Traga cada questão do contexto e cada exigência das partes interessadas;',
     'Para cada uma, diga o que pode dar errado — e o que pode dar certo se agirmos;',
     'Classifique por gravidade e probabilidade;',
     'Para os que não dá para conviver, escreva a ação, o responsável e o prazo;',
     'Defina como saberá, depois, se a ação funcionou (é o 6.1.3);',
     'Faça o upload da planilha.'
   ]::text[], true, true),

  (3, 10, 'Objetivos da qualidade', 'atividade', '6.2',
   'Os objetivos precisam ser coerentes com a política, mensuráveis, levar em '
   || 'conta os requisitos aplicáveis, ser monitorados, comunicados e '
   || 'atualizados. E o 6.2.2 pede o plano: o que será feito, com que recursos, '
   || 'quem responde, quando termina e como o resultado será avaliado.'
   || E'\n\n' ||
   '"Melhorar a satisfação do cliente" não é objetivo — não dá para medir. '
   || '"Chegar a 90% de satisfação até dezembro, medindo por pesquisa trimestral" '
   || 'é objetivo.',
   array[
     'Baixe o modelo de objetivos e planos;',
     'Escreva de três a cinco objetivos, cada um com número e prazo;',
     'Confira que cada um conversa com a política;',
     'Para cada objetivo, preencha o plano: ação, recurso, responsável, prazo, como avaliar;',
     'Faça o upload.'
   ]::text[], true, true),

  (3, 11, 'Planejamento de mudanças', 'atividade', '6.3',
   'Quando a empresa muda alguma coisa no sistema — processo novo, software '
   || 'novo, mudança de endereço, saída de uma pessoa-chave — o 6.3 pede que '
   || 'isso seja feito de forma planejada: propósito da mudança, consequências, '
   || 'recursos e responsabilidades.'
   || E'\n\n' ||
   'O documento aqui é curto. O que importa é combinar o gatilho: o que conta '
   || 'como mudança que precisa de planejamento, e quem decide isso.',
   array[
     'Baixe o formulário de planejamento de mudanças;',
     'Combine com a direção o que dispara o uso dele;',
     'Registre quem aprova uma mudança no SGQ;',
     'Faça o upload do formulário em branco, já com as regras preenchidas no cabeçalho.'
   ]::text[], true, false),

  (3, 12, 'Análise crítica pela direção', 'atividade', '9.3',
   'A reunião em que a direção olha o sistema inteiro e decide. A norma lista '
   || 'o que tem de entrar na pauta — situação das ações anteriores, mudanças '
   || 'no contexto, desempenho e tendências, suficiência de recursos, eficácia '
   || 'das ações sobre riscos, oportunidades de melhoria — e o que tem de sair: '
   || 'decisões sobre melhoria, mudanças no sistema e necessidade de recursos.'
   || E'\n\n' ||
   'Ata sem decisão não é análise crítica. Se a reunião terminou sem nada '
   || 'decidido, ou o sistema está perfeito, ou a reunião não aconteceu de '
   || 'verdade.',
   array[
     'Baixe o modelo de ata de análise crítica;',
     'Monte a pauta seguindo os tópicos do modelo — nenhum fica de fora;',
     'Marque a reunião com antecedência e convoque a direção;',
     'Registre decisão por decisão, com responsável e prazo;',
     'Faça o upload da ata assinada.'
   ]::text[], true, true),

  (3, 13, 'Feedback da etapa', 'feedback', null,
   'Esta é a etapa mais longa da trilha, e a mais importante. Nos conte como foi.',
   array[
     'Diga quantas reuniões foram necessárias;',
     'Conte o que a direção achou mais difícil de responder;',
     'Envie.'
   ]::text[], false, false),

  -- ====================== 4. Processos da Empresa =====================
  (4, 1, 'Caracterização dos processos', 'atividade', '4.4',
   'Para cada processo do mapa que você desenhou na etapa 2, uma ficha: o que '
   || 'entra, o que sai, quem responde, quais são os critérios de aceitação e '
   || 'como se mede o desempenho.'
   || E'\n\n' ||
   'É aqui que o sistema deixa de ser desenho e vira operação. E é a etapa que '
   || 'mais desmascara processo fantasma: se ninguém sabe dizer o que entra e '
   || 'o que sai, aquilo não é um processo, é um hábito.',
   array[
     'Baixe o modelo de caracterização (uma aba por processo);',
     'Comece pelos processos que tocam o cliente;',
     'Preencha entradas, saídas, responsável, critérios e indicador;',
     'Para cada indicador, diga a meta e de onde vem o número;',
     'Faça o upload da planilha completa.'
   ]::text[], true, true),

  (4, 2, 'Interação entre os processos', 'atividade', '4.4',
   'O mapa mostrou as setas. Esta atividade confere se elas fecham: toda saída '
   || 'de um processo é entrada de outro ou vai para o cliente, e toda entrada '
   || 'tem origem declarada.'
   || E'\n\n' ||
   'Processo que recebe de lugar nenhum, ou entrega para lugar nenhum, é erro '
   || 'de desenho — e normalmente é também um ponto onde as coisas se perdem na '
   || 'vida real.',
   array[
     'Pegue a caracterização e confira saída por saída: para onde vai?',
     'Confira entrada por entrada: de onde vem?',
     'Corrija o mapa de processos onde houver ponta solta;',
     'Faça o upload do mapa corrigido.'
   ]::text[], true, true),

  (4, 3, 'Planejamento operacional', 'atividade', '8.1',
   'O 8.1 pede que a empresa planeje, implemente e controle os processos '
   || 'necessários para atender aos requisitos — determinando requisitos, '
   || 'critérios, recursos, controles e a informação documentada necessária '
   || 'para confiar que tudo saiu como planejado.'
   || E'\n\n' ||
   'Na prática, é o que já foi feito nas duas atividades anteriores, mais a '
   || 'pergunta: que registro fica provando que o processo rodou certo?',
   array[
     'Para cada processo, decida qual registro prova que ele rodou (ordem de serviço, checklist, relatório);',
     'Anote esse registro na caracterização;',
     'Inclua os registros novos na lista mestra da etapa 2;',
     'Faça o upload da caracterização e da lista mestra atualizadas.'
   ]::text[], true, true),

  (4, 4, 'Revisão das atividades', 'revisao', null,
   'Antes de sair da etapa, uma conferida geral: tudo o que foi aprovado até '
   || 'aqui continua coerente entre si?'
   || E'\n\n' ||
   'É comum o escopo mudar depois que os processos são desenhados, ou a '
   || 'política envelhecer em duas semanas. Melhor descobrir agora do que na '
   || 'auditoria.',
   array[
     'Releia o escopo e confirme que ele cobre os processos caracterizados;',
     'Confira que todo processo tem responsável e que esse responsável está na matriz;',
     'Confira que os indicadores dos processos conversam com os objetivos da qualidade;',
     'Anote no comentário o que precisou ser ajustado;',
     'Envie.'
   ]::text[], false, true)

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
select e.ordem,
       e.nome,
       e.requisitos,
       count(a.id) as atividades
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
  left join public.implantacao_atividades a on a.etapa_id = e.id
 where m.nome = 'Implantação — ISO 9001:2026'
 group by e.ordem, e.nome, e.requisitos
 order by e.ordem;
