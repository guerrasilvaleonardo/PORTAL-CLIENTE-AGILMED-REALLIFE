-- =====================================================================
-- As prescrições da ISO 45001 — o requisito ensinado a quem vai atender.
--
-- Cada texto responde, na ordem: o que é, o que fazer, como fazer, por
-- que a norma pede isso, e o que precisa estar na mão no dia da
-- auditoria. É aula, não resumo.
--
-- O TEXTO É NOSSO. Nada aqui transcreve a norma — a ABNT vende o texto.
-- O número é referência, como citar artigo de lei.
--
-- ESCRITO PARA QUEM NÃO SABE POR ONDE COMEÇAR. Sem jargão que não seja
-- explicado na própria frase, e sempre dizendo o tamanho da coisa: a
-- empresa pequena precisa saber que uma tabela de uma página resolve o
-- que o consultor caro entrega em quarenta.
--
-- Depende de supabase/auditoria-prescricao.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

do $$
declare
  v_modelo uuid;
begin
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Auditoria interna — ISO 45001';

  if v_modelo is null then
    raise exception 'Rode antes supabase/inspecoes-auditoria.sql.';
  end if;

  update public.inspecao_modelo_itens i
     set prescricao = p.texto
    from (values

('4.1', 'contexto',
'O QUE É. Contexto é tudo que, de dentro ou de fora da empresa, muda a chance de alguém se machucar ou a capacidade de a empresa evitar isso.

O QUE FAZER. Montar uma lista das questões internas e externas que afetam a segurança e a saúde no trabalho, dizendo o efeito de cada uma. Uma tabela de uma página resolve.

COMO FAZER. Junte duas ou três pessoas que conhecem a operação — não só o pessoal do escritório. Para cada questão levantada, responda: isso aumenta ou diminui o risco? Onde? O que já fazemos a respeito? Exemplos reais: rotatividade alta (gente nova entra antes da integração), turno da noite sem técnico, cliente que exige certificação, fiscalização mais ativa na região, máquina antiga sem peça de reposição.

POR QUE A NORMA PEDE. Porque sistema de gestão copiado de modelo não protege ninguém. O contexto é o que faz o seu sistema ser seu: ele explica por que você prioriza a prensa e não o escritório.

O QUE VOCÊ PRECISA TER. O documento com as questões, o efeito de cada uma e a data da última revisão. Reveja pelo menos uma vez por ano, ou quando algo grande mudar — obra nova, máquina nova, cliente novo.'),

('4.1', 'clima',
'O QUE É. A ISO passou a exigir, em todas as normas de sistema de gestão, que a empresa diga se mudança climática é uma questão pertinente para ela. Na 45001 isso chegou pela Emenda 1:2025.

O QUE FAZER. Analisar e registrar a conclusão. Atenção: vale tanto concluir que é pertinente quanto concluir que não é. O que não vale é não ter analisado.

COMO FAZER. Pergunte: o calor afeta quem trabalha exposto? Chuva forte ou vento mudam o risco na obra? Estiagem, enchente ou fumaça de queimada já pararam a operação ou mandaram alguém para o ambulatório? Se sim, isso entra no levantamento de perigos e pode virar objetivo. Se não — por exemplo, operação inteiramente em ambiente controlado —, escreva isso e explique por quê.

POR QUE A NORMA PEDE. Porque risco ligado ao clima vinha sendo tratado como imprevisto, quando na maioria dos lugares já é rotina previsível.

O QUE VOCÊ PRECISA TER. Um parágrafo dentro da análise de contexto, com a conclusão e a data. Se for pertinente, o perigo correspondente precisa aparecer no levantamento de riscos — senão a conclusão fica solta.'),

('4.2', null,
'O QUE É. Parte interessada é quem afeta ou é afetado pela sua segurança do trabalho: trabalhadores, clientes, sindicato, órgão fiscalizador, vizinhança, contratadas.

O QUE FAZER. Listar quem são, o que cada um exige, e quais dessas exigências a empresa assume como requisito do sistema. Os requisitos legais entram aqui.

COMO FAZER. Uma tabela com quatro colunas: parte interessada, o que exige, é exigência legal?, como atendemos. Comece pelos trabalhadores e pela lei, que é o que nunca pode faltar. Depois clientes com exigência contratual e o sindicato. Não invente parte interessada para encher: cinco linhas verdadeiras valem mais que vinte genéricas.

POR QUE A NORMA PEDE. Porque exigência que ninguém mapeou é exigência que vai ser descoberta no pior momento — na fiscalização, no acidente ou na perda do contrato.

O QUE VOCÊ PRECISA TER. A tabela, revista junto com o contexto, e a evidência de como você atende pelo menos os itens legais.'),

('4.3', null,
'O QUE É. Escopo é a fronteira do sistema: quais atividades, quais unidades e quais pessoas estão dentro dele.

O QUE FAZER. Escrever o escopo e deixá-lo disponível para quem quiser ver.

COMO FAZER. Diga as atividades, os endereços e quem está coberto — inclusive terceiros e contratados que trabalham na sua operação. Se algo ficar de fora, escreva o que e por quê. Cuidado com a tentação de excluir a parte difícil: na 45001, trabalhador sob seu controle não pode ficar fora.

POR QUE A NORMA PEDE. Porque sem fronteira declarada ninguém sabe se o sistema cobre a obra nova, o almoxarifado alugado ou o pessoal da terceirizada. E é exatamente aí que o acidente acontece.

O QUE VOCÊ PRECISA TER. O escopo por escrito, com a data, publicado em lugar que o trabalhador alcance — quadro, portal ou intranet.'),

('4.4', null,
'O QUE É. É o sistema em si: os processos que fazem a segurança acontecer e como eles se encaixam.

O QUE FAZER. Mapear os processos do sistema e mostrar como um alimenta o outro.

COMO FAZER. Não precisa de software. Uma folha com as caixas principais já serve: levantar perigo → definir controle → treinar → executar com controle → inspecionar → tratar o que falhou → analisar criticamente. Para cada caixa, diga quem é o dono e qual registro ela gera. O teste é simples: pegue um acidente real e siga o caminho dele pelo mapa. Se o caminho sumir no meio, falta processo ali.

POR QUE A NORMA PEDE. Porque documento solto não é sistema. O que torna o conjunto um sistema é um processo entregar algo ao próximo.

O QUE VOCÊ PRECISA TER. O mapa, os donos e os registros que cada processo gera.'),

('5.1', null,
'O QUE É. Liderança aqui não é discurso: é a direção aparecer nas decisões, nos recursos e nos registros.

O QUE FAZER. Garantir que a direção participe de forma demonstrável — e que isso deixe rastro.

COMO FAZER. Três coisas resolvem a maior parte: a direção aprova a política e os objetivos por escrito; participa da análise crítica pelo menos uma vez por ano, com ata; e libera recurso para o que o sistema aponta, com o pedido e a aprovação registrados. Um quarto, que vale muito: a direção parar a operação quando o risco aparece, e isso ficar anotado.

POR QUE A NORMA PEDE. Porque sistema sem liderança vira tarefa do técnico de segurança, e técnico de segurança não aprova orçamento nem muda prioridade de produção.

O QUE VOCÊ PRECISA TER. Atas assinadas, aprovações de recurso e decisões datadas. O auditor vai pedir para ver a direção, não só ouvir falar dela.'),

('5.2', null,
'O QUE É. A política é o compromisso público da empresa com a segurança, assinado por quem manda.

O QUE FAZER. Escrever uma política curta, aprovada pela direção, comunicada a todos e disponível para quem precisar.

COMO FAZER. Meia página basta. Escreva compromissos que você possa provar: eliminar perigos e reduzir riscos, atender a legislação aplicável, consultar os trabalhadores, melhorar o sistema continuamente. Evite frase bonita sem evidência — para cada compromisso, pergunte "como eu provo isso?". Se não souber responder, tire a frase. Comunique em DDS ou reunião, com lista de presença, e afixe onde as pessoas passam.

POR QUE A NORMA PEDE. Porque a política é a régua: tudo o que o sistema faz depois é medido contra o que ela prometeu.

O QUE VOCÊ PRECISA TER. A política assinada e datada, a evidência da comunicação e o lugar onde ela está afixada.'),

('5.3', null,
'O QUE É. É dizer quem responde pelo quê dentro do sistema.

O QUE FAZER. Atribuir papéis e autoridades por escrito, e garantir que cada um saiba o que lhe cabe.

COMO FAZER. Uma tabela: função, o que ela responde no sistema, a quem reporta. Cubra pelo menos direção, responsável pelo sistema, encarregados e CIPA. Importante: autoridade sem poder é enfeite — se o encarregado pode parar a tarefa insegura, escreva isso.

POR QUE A NORMA PEDE. Porque responsabilidade difusa é responsabilidade de ninguém, e na hora do acidente aparece o clássico "achei que era o outro".

O QUE VOCÊ PRECISA TER. A tabela assinada ou comunicada. O auditor costuma conferir perguntando a duas pessoas o que cabe a elas — se não souberem, o papel não está atribuído de verdade.'),

('5.4', null,
'O QUE É. Consulta é ouvir antes de decidir; participação é o trabalhador tomar parte na decisão. Na 45001 isso é requisito, não gentileza.

O QUE FAZER. Criar e usar mecanismos para consultar e fazer participar quem executa o trabalho, com registro.

COMO FAZER. CIPA onde é obrigatória, mais reuniões curtas de área por turno. Consulte sobre o que realmente afeta o trabalhador: escolha de EPI, análise de risco da tarefa, investigação de acidente, mudança de procedimento. Registre o assunto, quem participou, o que foi levantado e — o mais importante — o que a empresa fez com aquilo. Consulta sem encaminhamento vira teatro, e o pessoal percebe na segunda vez.

POR QUE A NORMA PEDE. Porque quem faz a tarefa conhece o perigo que não aparece no papel.

O QUE VOCÊ PRECISA TER. Atas e registros com data, nomes e encaminhamento. Atenção aos trabalhadores não gerenciais: é deles que a norma fala.'),

('6.1.1', null,
'O QUE É. É o planejamento em si: olhar o contexto, as partes interessadas e o escopo, e decidir o que precisa ser tratado.

O QUE FAZER. Determinar os riscos e as oportunidades que o sistema precisa endereçar, com rastro até o que você levantou no 4.1 e 4.2.

COMO FAZER. Pegue a análise de contexto e pergunte, item por item: isso gera risco para a segurança? Gera oportunidade de melhorar? Em seguida inclua os perigos levantados e os requisitos legais. O resultado é uma lista do que o sistema vai tratar neste ciclo.

POR QUE A NORMA PEDE. Para o planejamento não ser uma lista solta inventada em reunião, e sim consequência do que a empresa descobriu sobre si mesma.

O QUE VOCÊ PRECISA TER. A ligação visível: cada item planejado tem origem declarada — veio do contexto, de uma parte interessada, de um perigo ou da lei.'),

('6.1.2', 'perigos',
'O QUE É. Perigo é a fonte do dano — a prensa, a altura, o produto químico. Risco é a combinação da chance com a gravidade.

O QUE FAZER. Identificar os perigos de forma contínua e proativa, com participação de quem faz o trabalho.

COMO FAZER. Percorra por atividade, não por setor: cada tarefa tem seus perigos. Inclua o que normalmente escapa — rotina de manutenção, trabalho fora do horário, emergência, terceiros, mudança de layout, fatores humanos e organizacionais como jornada e pressão por prazo. Leve o operador junto: a diferença entre a análise feita na mesa e a feita no posto costuma ser o perigo real.

POR QUE A NORMA PEDE. Porque não dá para controlar o que não foi visto. E perigo encontrado tarde é acidente.

O QUE VOCÊ PRECISA TER. O levantamento por atividade, com a lista de quem participou, assinada. Auditor experiente confere isso primeiro.'),

('6.1.2', 'riscos',
'O QUE É. Avaliar risco é dizer o tamanho dele por um critério, não por impressão.

O QUE FAZER. Avaliar os riscos de SSO com um critério escrito, e também as oportunidades de melhorar a segurança.

COMO FAZER. Use uma matriz simples: probabilidade de 1 a 5, severidade de 1 a 5, risco é o produto. Escreva o que cada número significa — severidade 5 é fatalidade, 3 é afastamento. E defina a régua de ação: a partir de que valor exige plano, e a partir de qual a tarefa não começa. Sem essa régua, dois técnicos avaliam o mesmo perigo de dois jeitos e a priorização perde sentido.

POR QUE A NORMA PEDE. Porque priorizar sem critério é priorizar pelo que incomoda mais, não pelo que mata.

O QUE VOCÊ PRECISA TER. O critério por escrito e a avaliação aplicada. O auditor vai pegar dois riscos parecidos e conferir se receberam nota coerente.'),

('6.1.3', null,
'O QUE É. São as obrigações que vêm de fora: NRs, leis, licenças, acordos coletivos e requisitos de cliente que você assumiu.

O QUE FAZER. Determinar quais se aplicam de fato e manter a lista atualizada.

COMO FAZER. Liste o requisito, o que ele obriga na prática, onde se aplica e quem responde. Fuja da lista genérica com todas as NRs: o auditor pergunta como a NR-33 se aplica se a empresa não tem espaço confinado, e a lista perde credibilidade inteira. Defina também como você fica sabendo de mudanças — boletim, assessoria, consulta periódica.

POR QUE A NORMA PEDE. Porque atender à lei é o piso, e porque a empresa precisa saber o que deve antes de ser cobrada.

O QUE VOCÊ PRECISA TER. A lista com data de atualização, e o responsável por cada item.'),

('6.1.4', null,
'O QUE É. É onde o risco levantado vira ação real, dentro do processo de quem executa.

O QUE FAZER. Planejar ações para os riscos significativos, os requisitos legais e as emergências; integrar essas ações aos processos; e avaliar depois se funcionaram.

COMO FAZER. Para cada item que passou da régua, defina a ação, o responsável, o prazo e o recurso. O ponto que separa quem leva o certificado de quem não leva é a integração: a ação tem de aparecer no procedimento, na ordem de serviço, no checklist de quem faz — não só numa planilha do setor de segurança. Depois do prazo, volte e verifique se o risco caiu de verdade.

POR QUE A NORMA PEDE. Porque levantamento sem plano é diagnóstico sem tratamento. Este é dos itens que o auditor externo mais cobra e dos que mais faltam.

O QUE VOCÊ PRECISA TER. O plano com responsável e prazo, a evidência de que ele entrou na rotina, e a avaliação de eficácia.'),

('6.2.1', null,
'O QUE É. Objetivo é onde a empresa quer chegar em segurança, em número.

O QUE FAZER. Estabelecer objetivos mensuráveis, coerentes com a política e com os riscos levantados.

COMO FAZER. Poucos e verdadeiros. Três objetivos que a empresa persegue valem mais que dez na parede. Cada um precisa de número e prazo: "reduzir acidentes com afastamento de 4 para 1 até dezembro", "adequar as 9 máquinas críticas à NR-12 até dezembro". Evite objetivo que não depende de você e objetivo impossível de medir, como "melhorar a cultura".

POR QUE A NORMA PEDE. Porque sem alvo não há como saber se o sistema está funcionando ou só girando.

O QUE VOCÊ PRECISA TER. A lista de objetivos com meta, indicador, responsável e prazo, aprovada pela direção.'),

('6.2.2', null,
'O QUE É. É o plano para alcançar cada objetivo — a parte que quase sempre falta.

O QUE FAZER. Para cada objetivo, definir o que será feito, com que recursos, por quem, até quando e como o resultado será avaliado.

COMO FAZER. Abaixo de cada objetivo, escreva as ações concretas. "Reduzir acidentes na dobra" não é ação; "instalar cortina de luz nas 3 prensas até junho, R$ 85 mil, manutenção" é. Diga como vai avaliar: qual número você olha e com que frequência.

POR QUE A NORMA PEDE. Porque objetivo sem plano é intenção, e intenção não muda resultado.

O QUE VOCÊ PRECISA TER. O plano por objetivo e o acompanhamento periódico — mensal na reunião de gestão resolve, com o registro do que foi analisado.'),

('7.1', null,
'O QUE É. Recurso é tudo que o sistema precisa para funcionar: gente, tempo, dinheiro, equipamento e informação.

O QUE FAZER. Determinar e prover o que é necessário.

COMO FAZER. Liste o que o sistema exige e confronte com o que existe. Falta de recurso aparece sempre do mesmo jeito: ação atrasada por falta de verba, inspeção não feita por falta de gente, treinamento adiado por falta de hora. Quando faltar, registre o pedido — pedido negado e registrado é evidência de que o sistema funcionou e a decisão foi da direção.

POR QUE A NORMA PEDE. Porque exigir resultado sem dar meio é o jeito mais comum de um sistema morrer no papel.

O QUE VOCÊ PRECISA TER. Orçamento aprovado, quadro de pessoal e os pedidos de recurso com a resposta da direção.'),

('7.2', null,
'O QUE É. Competência é a pessoa conseguir fazer a tarefa com segurança — não é ter certificado.

O QUE FAZER. Definir a competência exigida por função e garantir, com evidência, que quem ocupa a função a tem.

COMO FAZER. Primeiro a matriz: função, competência exigida, como se comprova, validade. Depois a situação de cada pessoa, com a evidência e o vencimento. Para tarefa crítica, certificado não basta: inclua avaliação prática, feita por alguém que saiba julgar. Controle os vencimentos num lugar só, com aviso antes de vencer.

POR QUE A NORMA PEDE. Porque a maior parte dos acidentes graves envolve alguém fazendo tarefa para a qual não estava preparado — às vezes com o certificado na pasta.

O QUE VOCÊ PRECISA TER. A matriz, os registros por pessoa e o controle de validade. O auditor escolhe um nome e segue o rastro.'),

('7.3', null,
'O QUE É. Conscientização é o trabalhador saber o que o afeta: os riscos dele, a política, o que fazer em emergência e qual a consequência de não seguir o sistema.

O QUE FAZER. Garantir que as pessoas estejam conscientes — e conseguir demonstrar isso.

COMO FAZER. Integração na admissão, DDS com tema ligado ao risco real da área, e reforço quando algo muda. O detalhe que separa o sistema vivo do sistema de papel: o trabalhador precisa saber que pode se retirar de situação de perigo grave e iminente sem sofrer represália — e precisa acreditar nisso.

POR QUE A NORMA PEDE. Porque controle que depende do comportamento só funciona se a pessoa entende o porquê.

O QUE VOCÊ PRECISA TER. Registros de integração e DDS, com lista de presença. Mas saiba: isso se audita perguntando ao trabalhador, não olhando a lista. Converse com o seu pessoal antes de o auditor conversar.'),

('7.4', null,
'O QUE É. É definir quem fala o quê, para quem e quando — dentro e fora da empresa.

O QUE FAZER. Estabelecer os processos de comunicação interna e externa do sistema.

COMO FAZER. Uma tabela resolve: o que comunicar, para quem, quando, por qual meio, quem é o responsável. Interna: resultado de inspeção para a área, acidente para todos, mudança de procedimento para quem executa. Externa: o que vai para cliente, órgão e comunidade. Inclua como o trabalhador comunica risco para cima — e garanta que isso chegue a alguém que decide.

POR QUE A NORMA PEDE. Porque informação de segurança parada é informação inútil, e quase todo acidente investigado tem um ponto onde alguém sabia e não contou a quem podia agir.

O QUE VOCÊ PRECISA TER. O quadro de comunicação e evidência de que ele acontece — e-mails, atas, murais, registros do canal de relato.'),

('7.5', null,
'O QUE É. Informação documentada é o conjunto de documentos e registros que o sistema precisa — e o controle sobre eles.

O QUE FAZER. Criar, atualizar e controlar: versão vigente identificada, aprovação registrada, acesso garantido e guarda definida.

COMO FAZER. Monte uma lista mestra: documento, versão, quem aprovou, data, onde fica, por quanto tempo guarda. Defina quem aprova e como a versão antiga sai de circulação — recolher a cópia física e carimbar "obsoleto" é simples e funciona. Documento de origem externa, como NR, também entra na lista com a data da versão que você usa.

POR QUE A NORMA PEDE. Porque trabalhar com a versão errada é tão perigoso quanto não ter procedimento, com o agravante de todo mundo achar que está certo.

O QUE VOCÊ PRECISA TER. A lista mestra e a prova do controle. O teste do auditor é cruel e simples: ele pega o procedimento no posto de trabalho e confere se é a versão vigente.'),

('8.1.1', null,
'O QUE É. É o controle do trabalho no dia a dia — onde o planejamento encontra a operação.

O QUE FAZER. Planejar, implementar e controlar os processos necessários para atender ao sistema, com critérios definidos.

COMO FAZER. Para cada atividade de risco, diga como ela deve ser feita, quem pode fazer, o que precisa estar liberado antes e o que é verificado durante. Procedimento, permissão de trabalho, checklist de pré-uso. Regra prática: se a tarefa exige decisão de segurança no meio, essa decisão tem de estar escrita e com dono — senão cada turno decide diferente.

POR QUE A NORMA PEDE. Porque o controle que importa é o que acontece no posto, não o que está na pasta.

O QUE VOCÊ PRECISA TER. Os procedimentos vigentes e os registros de aplicação. O auditor vai ao campo conferir se bate.'),

('8.1.2', null,
'O QUE É. A hierarquia de controles é a ordem obrigatória para tratar risco: eliminar, substituir, controle de engenharia, sinalização e administrativo, e só então EPI.

O QUE FAZER. Aplicar essa ordem ao definir os controles, e justificar quando parar antes do topo.

COMO FAZER. Para cada risco significativo, pergunte na ordem: dá para eliminar o perigo? Dá para trocar por algo menos perigoso? Dá para isolar com proteção física? Só depois vêm procedimento, treinamento e, por último, EPI. Quando a empresa for direto ao EPI, escreva por que as etapas anteriores não eram viáveis — e saiba que "é mais barato" não é justificativa técnica.

POR QUE A NORMA PEDE. Porque EPI protege uma pessoa e depende de ela usar certo o tempo todo; proteção coletiva protege todas e não depende de ninguém lembrar.

O QUE VOCÊ PRECISA TER. O registro da análise mostrando a ordem considerada. Risco alto controlado só por EPI é constatação quase certa.'),

('8.1.3', null,
'O QUE É. Gestão de mudança é analisar o risco antes de mudar, não depois.

O QUE FAZER. Estabelecer um processo para mudanças temporárias e permanentes que afetem a segurança.

COMO FAZER. Defina o gatilho: máquina nova, produto novo, layout alterado, procedimento revisado, pessoa nova em tarefa crítica, obra em área operando. Antes de executar, alguém analisa o risco da mudança, define controle e aprova. Não precisa ser pesado — meia página e uma assinatura resolvem na maioria das empresas. O que não pode é a mudança acontecer e a análise vir depois.

POR QUE A NORMA PEDE. Porque boa parte dos acidentes graves acontece logo após uma mudança que ninguém analisou.

O QUE VOCÊ PRECISA TER. O procedimento e os registros de mudanças recentes, com a aprovação anterior à execução. O auditor confere justamente essa data.'),

('8.1.4', null,
'O QUE É. É o controle sobre quem trabalha para você sem ser seu empregado: fornecedores, contratados e terceirizados.

O QUE FAZER. Garantir que os requisitos de segurança se apliquem a eles e que a empresa verifique isso.

COMO FAZER. Coloque a exigência no contrato, cheque a documentação antes de o pessoal entrar — treinamento, ASO, EPI —, faça integração específica e inclua a contratada nas suas inspeções. Trate incidente de terceiro como incidente seu, porque na prática ele é.

POR QUE A NORMA PEDE. Porque o risco não sabe de quem é o contrato, e a responsabilidade pelo local de trabalho é de quem o controla.

O QUE VOCÊ PRECISA TER. Cláusula contratual, documentação conferida com data, integração registrada e inspeções que incluam os terceiros.'),

('8.2', null,
'O QUE É. É estar preparado para o que pode dar muito errado, e ter testado essa preparação.

O QUE FAZER. Identificar as emergências possíveis, planejar a resposta, treinar as pessoas e testar periodicamente.

COMO FAZER. Liste os cenários reais da sua operação — incêndio, acidente grave, vazamento, soterramento, resgate em altura ou em espaço confinado. Para cada um: o que fazer, quem faz, que recurso é necessário, como aciona o socorro externo. Depois faça o simulado e, principalmente, registre o que falhou. Simulado em que nada falha costuma ser simulado mal feito.

POR QUE A NORMA PEDE. Porque na emergência não dá tempo de aprender. E porque plano não testado quase sempre tem um erro que só aparece no uso — a saída obstruída, o rádio sem bateria, o portão trancado.

O QUE VOCÊ PRECISA TER. O plano, a evidência do treinamento e o registro dos simulados com as correções feitas.'),

('9.1.1', null,
'O QUE É. É medir o desempenho da segurança com método, não com sensação.

O QUE FAZER. Definir o que monitorar, com que método, quando medir e quando analisar — e guardar os resultados.

COMO FAZER. Escolha poucos indicadores e equilibre os dois tipos: reativos, que contam o que já deu errado (acidentes, dias perdidos), e proativos, que mostram se o sistema está agindo antes (inspeções feitas, ações no prazo, treinamentos em dia, desvios tratados). Empresa que só mede acidente só sabe se está bem depois que alguém se machuca.

POR QUE A NORMA PEDE. Porque sem medida a empresa discute opinião, e opinião não melhora segurança.

O QUE VOCÊ PRECISA TER. A lista do que é medido com método e frequência, e o histórico dos resultados.'),

('9.1.2', null,
'O QUE É. É verificar, de tempos em tempos, se a empresa realmente cumpre o que a lei exige.

O QUE FAZER. Avaliar o atendimento aos requisitos legais, com registro, e agir onde não atende.

COMO FAZER. Pegue a lista de requisitos legais e percorra item a item: atende? Qual evidência eu vi? Se não atende, o que será feito e até quando. Faça por amostragem onde for grande — doze fichas de EPI conferidas valem mais que um "sim" genérico. Semestral costuma ser suficiente.

POR QUE A NORMA PEDE. Porque ter a lista não é cumprir a lista, e a diferença entre as duas coisas é o que a fiscalização encontra.

O QUE VOCÊ PRECISA TER. O registro da avaliação com data, quem avaliou, a evidência vista e o plano para o que não atende.'),

('9.2.1', null,
'O QUE É. Auditoria interna é a empresa se olhar no espelho antes de o auditor externo olhar.

O QUE FAZER. Realizar as auditorias nos intervalos planejados e levar os resultados à direção.

COMO FAZER. Siga o programa do ano. O auditor não pode auditar o próprio trabalho — se a empresa tem uma pessoa só de segurança, contrate alguém de fora para auditar a área dela. Audite contra a norma e contra os seus próprios procedimentos. Constatação boa é a que aponta fato com evidência, não opinião.

POR QUE A NORMA PEDE. Porque é mais barato encontrar o problema você mesmo. Auditoria interna que nunca acha nada não é elogio — é sinal de que foi mal feita.

O QUE VOCÊ PRECISA TER. Os relatórios das auditorias realizadas, as constatações tratadas e a evidência de que o resultado chegou à direção.'),

('9.2.2', null,
'O QUE É. Programa de auditoria é o plano do ano: o que auditar, quando, por quem e com que critério.

O QUE FAZER. Estabelecer, implementar e manter o programa, considerando a importância dos processos e os resultados anteriores.

COMO FAZER. Monte o cronograma em janeiro, com datas acordadas com a produção — auditoria sem data reservada é auditoria adiada. Audite mais vezes o que é mais crítico ou o que foi mal na vez anterior. Registre os riscos do próprio programa: auditor único, acesso às áreas, independência. E deixe claro quem pode auditar o quê.

POR QUE A NORMA PEDE. Porque auditoria avulsa não cobre o sistema inteiro, e a norma quer cobertura ao longo do ciclo.

O QUE VOCÊ PRECISA TER. O programa do ano aprovado, com cronograma, critérios, auditores e o registro do que já foi cumprido.'),

('9.3', null,
'O QUE É. É a direção parar para olhar o sistema inteiro e decidir.

O QUE FAZER. Analisar criticamente o sistema em intervalos planejados, com as entradas que a norma pede, e registrar as decisões.

COMO FAZER. Uma reunião anual bem feita resolve em empresa pequena; semestral é melhor. Leve dados, não impressões: desempenho dos indicadores, atendimento legal, resultado das auditorias, acidentes e tratamento, consulta aos trabalhadores, situação dos objetivos, recursos necessários. Saia com decisões: o que muda, quem faz, até quando, com que recurso.

POR QUE A NORMA PEDE. Porque sem esse momento o sistema vira rotina do setor de segurança e nunca é corrigido de cima.

O QUE VOCÊ PRECISA TER. A ata com as entradas analisadas, os dados apresentados e as decisões com responsável e prazo. Reunião sem decisão registrada não conta como análise crítica.'),

('10.1', null,
'O QUE É. É melhorar o sistema por iniciativa própria, não só porque algo deu errado.

O QUE FAZER. Determinar oportunidades de melhoria e implementá-las.

COMO FAZER. Procure melhoria onde ninguém se machucou ainda: sugestão de trabalhador, resultado de inspeção que apontou tendência, tecnologia que elimina um perigo, procedimento que dá para simplificar. Registre a origem, o que foi feito e o resultado.

POR QUE A NORMA PEDE. Porque sistema que só reage ao acidente está sempre atrás do problema.

O QUE VOCÊ PRECISA TER. Pelo menos uma melhoria do período que não nasceu de uma não conformidade — e é exatamente essa que falta em quase toda empresa.'),

('10.2', 'registro',
'O QUE É. Aqui entram incidente, quase-acidente e não conformidade do sistema. Os três são tratados pelo mesmo caminho.

O QUE FAZER. Reagir, conter, investigar e registrar — inclusive os quase-acidentes.

COMO FAZER. Tenha um caminho único e simples de relato, sem punição para quem relata. Registre o fato, não a opinião: o que foi visto, onde, quando, por quem. Tome a ação imediata para conter e anote quem fez e quando. Puna o relato e você perde a informação: o quase-acidente deixa de ser contado e você perde o aviso de graça.

POR QUE A NORMA PEDE. Porque quase-acidente é acidente que não aconteceu por sorte, e a sorte acaba.

O QUE VOCÊ PRECISA TER. O registro com data, local, descrição factual e a ação imediata tomada.'),

('10.2', 'causa',
'O QUE É. É descobrir por que aconteceu — de verdade.

O QUE FAZER. Investigar a causa, avaliar se o mesmo pode ocorrer em outro lugar, e definir ação corretiva que ataque a causa.

COMO FAZER. Pergunte por que até a resposta deixar de ser sobre a pessoa e passar a ser sobre o processo. Exemplo real: por que prendeu o bimanual com fita? Para segurar a peça. Por que precisava segurar? A peça escorrega. Por que escorrega? O molde não tem batente para peça curta. Por que não tem? Mudou o produto e ninguém reviu o dispositivo. A causa não é o operador: é mudança sem análise de risco. Ação que termina em "orientar o colaborador" quase sempre parou cedo demais.

POR QUE A NORMA PEDE. Porque tratar sintoma faz o problema voltar com outro nome, e às vezes com outra vítima.

O QUE VOCÊ PRECISA TER. A investigação registrada, a causa identificada e a ação ligada a ela. Veja também se o mesmo perigo existe em outra máquina ou outro turno.'),

('10.2', 'eficacia',
'O QUE É. É voltar depois para ver se a ação resolveu.

O QUE FAZER. Verificar a eficácia da ação corretiva e, se necessário, atualizar os riscos e o sistema.

COMO FAZER. Marque a verificação para algumas semanas depois do prazo. Vá ao local sem avisar, olhe se o controle está lá e funcionando, converse com quem opera. Se a ação exigiu mudança de procedimento, confira se os registros recentes refletem isso. Se não foi eficaz, não feche: defina nova ação.

POR QUE A NORMA PEDE. Porque fechar sem verificar é arquivar o problema, e a reincidência é o que o auditor externo cruza com os seus registros.

O QUE VOCÊ PRECISA TER. O registro da verificação, com data, como foi verificada e a conclusão. E a atualização do levantamento de risco, quando a causa mostrou um perigo que não estava lá.'),

('10.3', null,
'O QUE É. É a melhoria contínua do sistema como um todo, ao longo do tempo.

O QUE FAZER. Melhorar continuamente a adequação e a eficácia do sistema, promovendo a cultura de segurança e a participação.

COMO FAZER. Olhe o ano inteiro e pergunte: o que mudou no sistema, e não apenas nos problemas? Indicadores que melhoraram de forma sustentada, procedimentos simplificados, participação que cresceu, perigo que foi eliminado em vez de controlado. Escolha uma ou duas coisas por ano e leve até o fim — melhoria contínua não é fazer tudo, é não parar.

POR QUE A NORMA PEDE. Porque sistema parado se deteriora: muda a operação, entra gente nova, e o que funcionava deixa de funcionar.

O QUE VOCÊ PRECISA TER. Evidência de evolução ao longo do tempo, não só de correções pontuais. Um gráfico de dois anos com a explicação do que foi feito conta essa história melhor do que qualquer texto.')

    ) as p(req, marca, texto)
   where i.modelo_id = v_modelo
     and i.requisito = p.req
     and (
       p.marca is null
       or (p.marca = 'clima'    and i.pergunta ilike '%climátic%')
       or (p.marca = 'contexto' and i.requisito = '4.1' and i.pergunta not ilike '%climátic%')
       or (p.marca = 'perigos'  and i.pergunta ilike '%perigos foram identificados%')
       or (p.marca = 'riscos'   and i.pergunta ilike '%riscos foram avaliados%')
       or (p.marca = 'registro' and i.pergunta ilike '%registrados, investigados%')
       or (p.marca = 'causa'    and i.pergunta ilike '%causa é investigada%')
       or (p.marca = 'eficacia' and i.pergunta ilike '%eficácia das ações%')
     );
end
$$;


-- ---------- Conferência -------------------------------------------------
select count(*)                                   as itens,
       count(i.prescricao)                        as com_prescricao,
       count(*) - count(i.prescricao)             as sem_prescricao
  from public.inspecao_modelo_itens i
  join public.inspecao_modelos m on m.id = i.modelo_id
 where m.nome = 'Auditoria interna — ISO 45001';
