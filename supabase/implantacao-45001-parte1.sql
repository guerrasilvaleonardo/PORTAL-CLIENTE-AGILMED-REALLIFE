-- =====================================================================
-- Trilha de implantação da ISO 45001:2024 — parte 1 de 4.
--
-- Cria a trilha, as 16 etapas do cronograma e as atividades das etapas
-- 1 a 4: Iniciando meu Projeto, Sistema de Gestão, Alta Direção e
-- Consulta e Participação dos Trabalhadores.
--
-- POR QUE UMA TRILHA SEPARADA E NÃO UM "MÓDULO SSO" DENTRO DA 9001.
-- São duas certificações, dois escopos e dois auditores. A empresa pode
-- querer só uma delas, e normalmente quer: quem vende para obra precisa
-- da 45001 e nunca vai tirar a 9001. Misturar as duas obrigaria todo
-- cliente a percorrer requisito que não é dele.
--
-- O QUE MUDA EM RELAÇÃO À TRILHA DA 9001. Três coisas, e elas são a
-- razão de a 45001 ser mais difícil de implantar do que parece:
--   1. CONSULTA E PARTICIPAÇÃO DOS TRABALHADORES (5.4) não tem
--      equivalente na 9001 e é onde a maioria das empresas falha. Por
--      isso virou etapa inteira, não uma atividade solta.
--   2. PERIGO E RISCO (6.1.2) é o coração: sem inventário de risco não
--      há o que controlar, e a norma pede identificação contínua, não
--      uma planilha feita uma vez e esquecida.
--   3. REQUISITO LEGAL (6.1.3) aqui é pesado de verdade — as NRs, as
--      licenças, o PCMSO, os laudos. Na 9001 é quase nada.
--
-- A LIGAÇÃO COM AS NRs É PROPOSITAL. O inventário de riscos da 45001 e
-- o da NR-01 são o mesmo trabalho feito uma vez. Quem implanta sem
-- perceber isso termina com duas planilhas que se contradizem na frente
-- do auditor.
--
-- A AULA É ESCRITA POR NÓS. A norma é obra protegida: copiar o texto
-- dela para dentro do produto é problema de direito autoral, e o texto
-- dela não ensina ninguém. A aula diz o que fazer em português de
-- empresa e cita o número do requisito.
--
-- Depende de supabase/implantacao.sql.
-- Não apaga nada. Pode rodar mais de uma vez: reescreve pelo número da
-- etapa e da atividade, então corrigir um texto é editar e rodar de novo.
-- =====================================================================

-- ---------- 1. A trilha -------------------------------------------------
insert into public.implantacao_modelos (nome, norma, descricao)
values (
  'Implantação — ISO 45001:2024',
  'ABNT NBR ISO 45001:2024',
  'Do zero ao certificado em saúde e segurança ocupacional, por área da '
  || 'empresa. Cada atividade tem a aula, os passos, o modelo para baixar e '
  || 'a aprovação do consultor.'
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
         'O desenho do SGSSO e a regra de como os documentos nascem, mudam e são guardados.',
         '4.4, 7.1, 7.5', false),
    (3,  'Alta Direção',
         'Contexto, partes interessadas, escopo, política, papéis, objetivos e análise crítica.',
         '4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.2, 9.3', false),
    (4,  'Consulta e Participação dos Trabalhadores',
         'Como o trabalhador opina, onde isso fica registrado e o que a empresa faz com a opinião.',
         '5.4', false),
    (5,  'Perigos e Riscos',
         'Levantar o perigo, avaliar o risco e decidir o controle. É a base de tudo que vem depois.',
         '6.1.1, 6.1.2, 6.1.4', false),
    (6,  'Requisitos Legais e Outros Requisitos',
         'As NRs que se aplicam, as licenças, os laudos e como tudo isso é mantido em dia.',
         '6.1.3, 9.1.2', false),
    (7,  'Gestão Operacional',
         'Eliminar o perigo onde dá, reduzir onde não dá, e controlar a mudança antes dela acontecer.',
         '8.1.1, 8.1.2, 8.1.3', false),
    (8,  'Compras, Contratadas e Terceirizados',
         'O risco que entra pelo portão com quem não é seu empregado.',
         '8.1.4.1, 8.1.4.2, 8.1.4.3', false),
    (9,  'Recursos Humanos',
         'Quem faz, se sabe fazer, se sabe o risco que corre e como a empresa comunica.',
         '7.1, 7.2, 7.3, 7.4', false),
    (10, 'Infraestrutura e Saúde Ocupacional',
         'Prédio, máquina, ambiente, EPI e a saúde de quem trabalha — o PCMSO e os exames.',
         '7.1, 8.1.2', false),
    (11, 'Emergências',
         'O que a empresa faz no dia em que der errado, e como ela treina isso antes.',
         '8.2', false),
    (12, 'Monitoramento e Medição',
         'Os indicadores de SSO e a avaliação periódica de que a empresa cumpre a lei.',
         '9.1.1, 9.1.2', false),
    (13, 'Incidentes, Não Conformidades e Ação Corretiva',
         'Acidente, quase-acidente e desvio: investigar a causa e impedir que volte.',
         '10.2', false),
    (14, 'Melhoria Contínua',
         'O que faz o sistema andar em vez de envelhecer — e por que a 45001 cobra isso por escrito.',
         '10.1, 10.3', false),
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
 where m.nome = 'Implantação — ISO 45001:2024'
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
   || 'Na 45001 há uma tentação a evitar: entregar tudo ao técnico de segurança '
   || 'e seguir a vida. Segurança que mora só no SESMT não muda comportamento '
   || 'de ninguém — e a norma inteira é sobre comportamento.'
   || E'\n\n' ||
   'O interlocutor ideal é alguém da operação, que conheça o chão da empresa e '
   || 'tenha abertura com a direção. O técnico de segurança entra como apoio '
   || 'técnico, não como dono do projeto.'::text,
   array[
     'Baixe a ficha do interlocutor logo abaixo;',
     'Preencha nome, cargo, telefone e e-mail de quem vai conduzir;',
     'Diga quantas horas por semana essa pessoa consegue dedicar — seja realista, não otimista;',
     'Indique um substituto, para férias e imprevistos;',
     'Salve e faça o upload do arquivo preenchido.'
   ]::text[], true, true),

  (1, 2, 'Definição da equipe do SGSSO', 'atividade', null,
   'O interlocutor não implanta sozinho. Cada área precisa de alguém que '
   || 'responda por ela quando a trilha chegar lá — Operação, Manutenção, RH, '
   || 'Compras.'
   || E'\n\n' ||
   'Nesta lista entra também quem a empresa já tem em segurança: o SESMT, se '
   || 'houver, e os membros da CIPA. Eles não conduzem o projeto, mas nada que '
   || 'envolva risco pode ser decidido sem eles na sala.',
   array[
     'Baixe a planilha da equipe;',
     'Liste uma pessoa por área, com cargo e e-mail;',
     'Inclua o SESMT e os membros da CIPA, quando existirem;',
     'Marque quem já participou de alguma certificação antes;',
     'Faça o upload da planilha preenchida.'
   ]::text[], true, true),

  (1, 3, 'Organizar as pastas no computador', 'atividade', null,
   'Antes de produzir o primeiro documento, é preciso ter onde guardá-lo. A '
   || 'empresa que começa sem estrutura termina com três versões da política de '
   || 'SSO em três computadores diferentes — e nenhuma delas é a válida.'
   || E'\n\n' ||
   'Vale um cuidado extra aqui: documento de saúde ocupacional tem dado médico '
   || 'de pessoa identificada. ASO, atestado e resultado de exame não ficam na '
   || 'pasta geral do SGSSO, e sim em pasta com acesso restrito.',
   array[
     'Abra "Antes de começar", aqui mesmo em Implantar o sistema;',
     'Baixe o arquivo que cria as pastas e execute-o na pasta onde o SGSSO vai morar;',
     'Confira que as pastas apareceram com os nomes certos;',
     'Crie uma pasta separada, de acesso restrito, para documento médico individual;',
     'Combine com a equipe que esta é a única cópia válida — e que ninguém guarda documento do SGSSO no desktop;',
     'Tire um print da estrutura criada e suba aqui.'
   ]::text[], true, false),

  (1, 4, 'Plano de investimento e cronograma', 'atividade', null,
   'Certificar em 45001 custa em quatro frentes, e a quarta costuma ser a '
   || 'surpresa: a consultoria, o organismo certificador, as adequações de '
   || 'documento e treinamento — e a adequação física. Guarda-corpo, proteção '
   || 'de máquina, exaustão, sinalização. Essa última é a que tem preço de obra.'
   || E'\n\n' ||
   'Nesta etapa você ainda não sabe quanto a adequação física vai custar, '
   || 'porque o inventário de riscos só vem na etapa 5. Coloque uma reserva e '
   || 'avise a direção de que esse número será revisto — melhor um número '
   || 'provisório declarado do que um susto no meio do projeto.',
   array[
     'Baixe o modelo de plano de investimento;',
     'Preencha os custos das quatro frentes, com a melhor estimativa de hoje;',
     'Marque a adequação física como provisória, a revisar depois da etapa 5;',
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
  (2, 1, 'O que é um sistema de gestão de SSO', 'leitura', '4.4',
   'Um SGSSO não é uma pilha de documentos nem um departamento. É o conjunto '
   || 'de processos da empresa olhado por uma pergunta: onde alguém pode se '
   || 'machucar ou adoecer por causa do trabalho, e o que a empresa faz a '
   || 'respeito. O requisito 4.4 pede que a empresa determine esses processos, '
   || 'a sequência entre eles e como são medidos.'
   || E'\n\n' ||
   'Há uma diferença de fundo em relação à qualidade que vale entender agora: '
   || 'na 9001 o cliente insatisfeito reclama e a empresa corrige. Em SSO o '
   || 'aviso quase sempre chega depois do acidente. Por isso a norma insiste '
   || 'tanto em identificar perigo antes, e não em medir resultado depois.'
   || E'\n\n' ||
   'Leia com calma. As próximas atividades só fazem sentido depois disto.',
   array[
     'Leia o texto acima;',
     'Assista ao vídeo da etapa, se houver;',
     'Marque como concluída.'
   ]::text[], false, false),

  (2, 2, 'Procedimento de controle da informação documentada', 'atividade', '7.5',
   'Esta é a regra que governa todas as outras: como um documento do SGSSO '
   || 'nasce, quem aprova, como se identifica a versão, onde fica guardado, por '
   || 'quanto tempo e como se descarta. É o 7.5.'
   || E'\n\n' ||
   'Em SSO esse procedimento carrega uma responsabilidade a mais: ele é o lugar '
   || 'onde se escreve que documento médico individual tem acesso restrito, e '
   || 'quem pode abri-lo. O auditor vai perguntar, e "ninguém mexe" não é '
   || 'resposta — a regra precisa estar escrita.',
   array[
     'Baixe o modelo de procedimento;',
     'Ajuste os nomes dos cargos ao que a sua empresa usa de verdade;',
     'Defina quem aprova cada tipo de documento;',
     'Escreva a regra de acesso ao documento médico individual;',
     'Defina por quanto tempo cada registro é guardado — alguns de SSO têm prazo legal longo;',
     'Faça o upload do procedimento aprovado.'
   ]::text[], true, true),

  (2, 3, 'Lista mestra de documentos e registros', 'atividade', '7.5',
   'A lista mestra é o índice do sistema: o que existe, em que versão, quem '
   || 'aprovou e onde está. Sem ela, descobrir se um documento é o atual vira '
   || 'arqueologia.'
   || E'\n\n' ||
   'Comece agora, com os dois documentos que você já tem, e acrescente uma '
   || 'linha a cada entrega da trilha. Quem deixa para preencher no fim gasta '
   || 'dois dias e erra metade.',
   array[
     'Baixe a lista mestra;',
     'Lance os documentos que já existem;',
     'Defina quem mantém a lista atualizada;',
     'Faça o upload.'
   ]::text[], true, false),

  (2, 4, 'Feedback da etapa', 'feedback', null,
   'Conte como foi esta etapa: o que ficou claro, o que não ficou, e se o '
   || 'modelo de procedimento serviu à sua empresa sem reescrita grande.',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ========================= 3. Alta Direção ==========================
  (3, 1, 'Análise do contexto da organização', 'atividade', '4.1',
   'Contexto é o que, de fora e de dentro, afeta a segurança de quem trabalha '
   || 'aqui. De fora: a legislação, o clima da região, a fiscalização, o que o '
   || 'cliente exige em contrato. De dentro: a idade do parque de máquinas, a '
   || 'rotatividade, o turno da noite, a cultura de "sempre foi assim".'
   || E'\n\n' ||
   'A Emenda 1:2025 acrescentou a mudança climática ao 4.1: a empresa precisa '
   || 'determinar se ela é questão relevante. Para SSO isso não é formalidade — '
   || 'calor extremo, chuva fora de época e queimada mudam o risco de quem '
   || 'trabalha exposto, e em boa parte do Brasil isso já é realidade.',
   array[
     'Baixe o modelo de análise de contexto;',
     'Liste as questões externas e internas que afetam a segurança e a saúde;',
     'Responda expressamente se a mudança climática é questão relevante para a empresa, e por quê;',
     'Leve à direção para validar — contexto escrito pela qualidade sozinha não vale;',
     'Faça o upload.'
   ]::text[], true, true),

  (3, 2, 'Partes interessadas e suas necessidades', 'atividade', '4.2',
   'Parte interessada em SSO é quem pode ser afetado pelo que a empresa faz, e '
   || 'não só quem compra dela. O trabalhador em primeiro lugar — a norma dá a '
   || 'ele posição de destaque. Depois o sindicato, o cliente que audita, a '
   || 'fiscalização, o vizinho da fábrica, a família de quem trabalha.'
   || E'\n\n' ||
   'Para cada um, a pergunta é: o que ele precisa e espera, e qual parte disso '
   || 'a empresa assume como requisito.',
   array[
     'Baixe o levantamento de partes interessadas;',
     'Liste cada parte, começando pelos trabalhadores e seus representantes;',
     'Escreva o que cada uma precisa e espera;',
     'Marque o que a empresa assume como requisito a cumprir;',
     'Faça o upload.'
   ]::text[], true, true),

  (3, 3, 'Escopo do sistema de gestão', 'atividade', '4.3',
   'O escopo diz onde o sistema vale: quais unidades, quais atividades, quais '
   || 'pessoas. E aqui há uma regra que pega muita empresa de surpresa: em SSO '
   || 'não se exclui trabalhador do escopo. Terceirizado que trabalha dentro da '
   || 'sua área está dentro, goste a empresa ou não.'
   || E'\n\n' ||
   'Escopo mal escrito é a primeira coisa que o auditor ataca, porque tudo '
   || 'depois dele fica torto.',
   array[
     'Baixe o modelo de escopo;',
     'Escreva as unidades e as atividades cobertas;',
     'Declare expressamente que terceirizados e visitantes nas suas instalações estão cobertos;',
     'Evite exclusões — se achar que precisa de uma, converse com o consultor antes;',
     'Faça o upload do escopo aprovado pela direção.'
   ]::text[], true, true),

  (3, 4, 'Liderança e cultura de segurança', 'leitura', '5.1',
   'O 5.1 é o requisito que não se resolve com documento. Ele cobra que a '
   || 'direção assuma a responsabilidade pela prevenção, garanta os recursos, '
   || 'proteja quem reporta problema de represália e desenvolva uma cultura que '
   || 'apoie o sistema.'
   || E'\n\n' ||
   'Na prática, o auditor mede isso perguntando ao operador — não ao gerente — '
   || 'se ele já parou uma tarefa por achar insegura, e o que aconteceu com ele '
   || 'depois. Se a resposta for "a gente não para", nenhum documento salva.'
   || E'\n\n' ||
   'Leia isto com a direção presente. É a conversa mais importante da trilha.',
   array[
     'Leia o texto acima junto com a direção;',
     'Discuta: alguém já parou uma tarefa aqui? O que aconteceu?',
     'Marque como concluída.'
   ]::text[], false, false),

  (3, 5, 'Política de SSO', 'atividade', '5.2',
   'A política é o compromisso público da direção. A norma pede que ela inclua '
   || 'compromissos específicos, e eles não são decorativos: proporcionar '
   || 'condições de trabalho seguras e saudáveis, eliminar perigos e reduzir '
   || 'riscos, melhorar continuamente o sistema, cumprir os requisitos legais e '
   || 'a consulta e participação dos trabalhadores.'
   || E'\n\n' ||
   'Falta de um desses compromissos é não conformidade na leitura do documento, '
   || 'antes mesmo de o auditor sair da sala. Use o modelo: ele já traz os '
   || 'compromissos obrigatórios, e o que você escreve é a parte que fala da '
   || 'sua empresa.',
   array[
     'Baixe o modelo de política de SSO;',
     'Escreva a parte específica da sua empresa, em linguagem que o operador entenda;',
     'Confira que os cinco compromissos obrigatórios estão lá;',
     'Faça a direção assinar e datar;',
     'Divulgue a todos — quadro, integração, portal — e guarde a evidência da divulgação;',
     'Faça o upload da política assinada.'
   ]::text[], true, true),

  (3, 6, 'Papéis, responsabilidades e autoridades', 'atividade', '5.3',
   'Quem responde por quê. A matriz traz cada papel do sistema com nome e '
   || 'cargo: quem aprova documento, quem conduz investigação de acidente, quem '
   || 'autoriza trabalho de risco, quem pode parar uma operação.'
   || E'\n\n' ||
   'Essa última linha é a que mais importa: a autoridade de parar precisa estar '
   || 'escrita e precisa chegar ao operador. Autoridade que só o gerente tem é '
   || 'autoridade que não existe às três da manhã.',
   array[
     'Baixe a matriz de responsabilidades;',
     'Preencha cada papel com nome e cargo;',
     'Escreva quem tem autoridade para interromper uma atividade insegura — e inclua o próprio trabalhador;',
     'Comunique a matriz às pessoas nomeadas;',
     'Faça o upload.'
   ]::text[], true, true),

  (3, 7, 'Objetivos de SSO e planos de ação', 'atividade', '6.2',
   'Objetivo de SSO não é "reduzir acidentes". É um número, com prazo, com '
   || 'responsável e com um plano do que será feito para chegar lá.'
   || E'\n\n' ||
   'Uma armadilha conhecida: medir só acidente. Acidente é indicador que chega '
   || 'tarde e que a equipe aprende a não reportar quando vira meta. Misture '
   || 'indicadores que antecipam — quase-acidente reportado, inspeção feita, '
   || 'desvio tratado no prazo — com os que contam o que já aconteceu.',
   array[
     'Baixe o modelo de objetivos;',
     'Defina de três a cinco objetivos ligados à política e aos riscos levantados;',
     'Misture indicadores de antecipação com indicadores de resultado;',
     'Para cada um: o que será feito, por quem, até quando e com que recurso;',
     'Defina como o resultado será medido e com que frequência;',
     'Faça o upload aprovado pela direção.'
   ]::text[], true, true),

  (3, 8, 'Análise crítica pela direção', 'atividade', '9.3',
   'A reunião em que a direção olha o sistema inteiro e decide. A norma lista '
   || 'as entradas que precisam estar na mesa e as saídas que precisam sair de '
   || 'lá — e a ata é a prova de que aconteceu.'
   || E'\n\n' ||
   'Nesta etapa você ainda não tem resultado para analisar. Agende a primeira '
   || 'reunião, deixe a pauta montada e volte aqui quando houver dado. Quem '
   || 'deixa para marcar depois faz a análise crítica às pressas na véspera da '
   || 'auditoria, e isso se percebe na ata.',
   array[
     'Baixe o modelo de ata de análise crítica;',
     'Agende a primeira reunião com a direção, com data no calendário;',
     'Monte a pauta com as entradas que a norma pede;',
     'Faça o upload da ata quando a reunião acontecer — pode ser mais adiante na trilha.'
   ]::text[], true, true),

  (3, 9, 'Feedback da etapa', 'feedback', null,
   'Esta foi a etapa mais pesada até aqui, e a que mais depende da direção. '
   || 'Conte como foi: conseguiu reunir? O que travou?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ========== 4. Consulta e Participação dos Trabalhadores ============
  (4, 1, 'Por que este requisito existe', 'leitura', '5.4',
   'O 5.4 é o requisito que separa a 45001 das normas de gestão que vieram '
   || 'antes. Ele obriga a empresa a consultar os trabalhadores — e, em '
   || 'assuntos específicos, a fazê-los participar da decisão.'
   || E'\n\n' ||
   'A lógica é simples e dura: quem opera a máquina sabe onde ela machuca. O '
   || 'engenheiro que desenhou o posto não sabe, o técnico de segurança que '
   || 'passa uma vez por semana não sabe. Sistema de SSO escrito sem o operador '
   || 'descreve uma empresa que não existe.'
   || E'\n\n' ||
   'A norma cobra ainda que a empresa remova os obstáculos à participação. '
   || 'Obstáculo aqui tem nome: medo de represália, reunião em horário que o '
   || 'turno da noite não alcança, formulário em linguagem que ninguém entende, '
   || 'e a resposta que nunca volta.',
   array[
     'Leia o texto acima;',
     'Pergunte-se com honestidade: nesta empresa, alguém de fora da gerência já mudou uma decisão de segurança?',
     'Marque como concluída.'
   ]::text[], false, false),

  (4, 2, 'Mapear os canais que já existem', 'atividade', '5.4',
   'Antes de criar canal novo, aproveite o que existe. A maioria das empresas '
   || 'brasileiras já tem CIPA, reunião de turno, DDS e caixa de sugestão. O '
   || 'problema raramente é falta de canal: é que nada do que entra por eles '
   || 'volta como resposta.'
   || E'\n\n' ||
   'Mapeie o que há, quem alcança, com que frequência acontece e o que é feito '
   || 'com o que é dito. A coluna que vai doer é a última.',
   array[
     'Baixe o mapa de canais de consulta;',
     'Liste os canais existentes: CIPA, DDS, reunião de turno, caixa de sugestão, outros;',
     'Para cada um: quem alcança, com que frequência e quem recebe o que sai de lá;',
     'Escreva o que hoje é feito com o que o trabalhador fala — mesmo que a resposta seja "nada";',
     'Faça o upload.'
   ]::text[], true, true),

  (4, 3, 'Procedimento de consulta e participação', 'atividade', '5.4',
   'Agora o documento que organiza isso. Ele precisa separar duas coisas que a '
   || 'norma trata de modo diferente: CONSULTA é ouvir antes de decidir; '
   || 'PARTICIPAÇÃO é o trabalhador tomando parte na decisão.'
   || E'\n\n' ||
   'A norma reserva assuntos específicos para a participação dos trabalhadores '
   || 'não-gerenciais, entre eles a identificação de perigos e a avaliação de '
   || 'riscos, a determinação de controles, e a investigação de incidentes. '
   || 'Nesses, "eu avisei a equipe depois" não cumpre o requisito.'
   || E'\n\n' ||
   'E o procedimento precisa dizer como a resposta volta. Consulta sem retorno '
   || 'ensina o trabalhador a não falar mais.',
   array[
     'Baixe o modelo de procedimento de consulta e participação;',
     'Escreva quais assuntos são de consulta e quais são de participação;',
     'Defina como o trabalhador do turno da noite e o terceirizado são alcançados;',
     'Defina o prazo e a forma do retorno — quem responde, em quantos dias, por onde;',
     'Liste os obstáculos que existem hoje na sua empresa e o que será feito com cada um;',
     'Faça o upload do procedimento aprovado.'
   ]::text[], true, true),

  (4, 4, 'Colocar o canal para funcionar', 'atividade', '5.4',
   'Documento aprovado não é canal funcionando. Esta atividade é a prova de que '
   || 'o procedimento saiu do papel: rode uma rodada de consulta de verdade, '
   || 'sobre um assunto real, e registre o que voltou.'
   || E'\n\n' ||
   'Não precisa ser grande. Uma pergunta sobre um posto de trabalho, feita a '
   || 'quem trabalha nele, com a resposta registrada e devolvida, vale mais em '
   || 'auditoria do que dez páginas de procedimento.',
   array[
     'Escolha um assunto real de segurança que esteja em aberto;',
     'Consulte os trabalhadores envolvidos, pelo canal que você definiu;',
     'Registre o que foi dito, com data e quem participou;',
     'Devolva a resposta: o que será feito, o que não será e por quê;',
     'Suba o registro da rodada aqui.'
   ]::text[], true, true),

  (4, 5, 'Feedback da etapa', 'feedback', null,
   'Esta etapa não tem equivalente na 9001 e costuma ser a que mais incomoda. '
   || 'Conte como foi na sua empresa — inclusive se houve resistência.',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
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
 where m.nome = 'Implantação — ISO 45001:2024'
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
       count(a.id)             as atividades,
       count(a.modelo_arquivo) as com_modelo
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
  left join public.implantacao_atividades a on a.etapa_id = e.id
 where m.nome = 'Implantação — ISO 45001:2024'
 group by e.ordem, e.nome
 order by e.ordem;
