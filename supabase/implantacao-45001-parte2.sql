-- =====================================================================
-- Trilha de implantação da ISO 45001:2024 — parte 2 de 4.
--
-- Atividades das etapas 5 a 8: Perigos e Riscos, Requisitos Legais,
-- Gestão Operacional e Compras/Contratadas.
--
-- ESTA É A PARTE QUE SUSTENTA A CERTIFICAÇÃO. Da etapa 5 sai o
-- inventário de riscos; dele saem os controles da etapa 7, o
-- treinamento da etapa 9, o plano de emergência da etapa 11 e os
-- indicadores da etapa 12. Inventário malfeito contamina tudo que vem
-- depois, e é por isso que a etapa 5 tem a atividade mais demorada da
-- trilha inteira — o levantamento em campo.
--
-- POR QUE O INVENTÁRIO DE RISCOS APARECE LIGADO À NR-01. No Brasil a
-- empresa já é obrigada a ter o PGR com inventário de riscos. É o mesmo
-- trabalho. Fazer duas vezes produz duas planilhas que se contradizem,
-- e o auditor acha a contradição em cinco minutos. A trilha trata como
-- um documento só, e diz isso ao cliente em voz alta.
--
-- Depende de supabase/implantacao-45001-parte1.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

  -- ======================== 5. Perigos e Riscos ========================
  (5, 1, 'Perigo e risco não são a mesma coisa'::text, 'leitura'::text, '6.1.1'::text,
   'Perigo é a fonte com potencial de causar lesão ou doença: a serra, o '
   || 'produto químico, o piso molhado, a jornada que vira a noite. Risco é a '
   || 'combinação da chance de aquilo acontecer com a gravidade do que acontece.'
   || E'\n\n' ||
   'A diferença não é preciosismo de norma. Ela define o que a empresa faz: '
   || 'contra o perigo age-se eliminando; contra o risco age-se reduzindo. Quem '
   || 'confunde os dois compra EPI para um perigo que dava para tirar da frente.'
   || E'\n\n' ||
   'Dois lembretes que mudam o resultado do levantamento. Primeiro: perigo não '
   || 'é só o que corta e queima — a norma trata também o que adoece com o '
   || 'tempo, e isso inclui organização do trabalho, ritmo, assédio e jornada. '
   || 'Segundo: conta o que acontece em situação de emergência e em atividade '
   || 'de rotina e de não-rotina. A parada de manutenção do fim de semana é '
   || 'onde se machuca muita gente, justamente porque ninguém a mapeou.'::text,
   array[
     'Leia o texto acima;',
     'Assista ao vídeo da etapa, se houver;',
     'Marque como concluída.'
   ]::text[], false, false),

  (5, 2, 'Levantamento de perigos em campo', 'atividade', '6.1.2.1',
   'Esta é a atividade mais longa da trilha, e a que não dá para fazer sentado. '
   || 'O levantamento acontece no posto de trabalho, com quem trabalha nele.'
   || E'\n\n' ||
   'A norma pede participação dos trabalhadores não-gerenciais na identificação '
   || 'de perigos — não é opcional, é o 5.4 valendo aqui. Na prática: você '
   || 'caminha a operação com o operador, pergunta o que já quase aconteceu, e '
   || 'escuta. O que ele chama de "manha da máquina" é um perigo que ninguém '
   || 'documentou.'
   || E'\n\n' ||
   'Cubra também o que não é rotina: manutenção, parada, partida, limpeza, '
   || 'emergência, trabalho de terceiro, visita.',
   array[
     'Baixe o roteiro de levantamento de perigos;',
     'Percorra área por área, com o trabalhador da área junto;',
     'Pergunte o que já quase aconteceu ali — o quase-acidente é a melhor fonte que existe;',
     'Registre perigo de rotina, de não-rotina e de emergência;',
     'Inclua os perigos que adoecem com o tempo: ruído, postura, químico, ritmo, jornada;',
     'Anote quem participou de cada área, com data — isso é a evidência do 5.4;',
     'Faça o upload do levantamento.'
   ]::text[], true, true),

  (5, 3, 'Metodologia de avaliação de riscos', 'atividade', '6.1.2.2',
   'Antes de classificar risco é preciso escrever a régua. A norma não impõe '
   || 'método, mas exige que ele seja definido e aplicado de forma consistente.'
   || E'\n\n' ||
   'O método mais usado cruza probabilidade com severidade numa matriz. Serve '
   || 'bem, desde que a empresa escreva o que significa cada nível — "provável" '
   || 'sem definição vira opinião, e duas pessoas classificam o mesmo risco de '
   || 'formas diferentes.'
   || E'\n\n' ||
   'Defina também o critério de quando o risco é inaceitável e a atividade não '
   || 'pode continuar como está. Essa linha é a que dá dente ao sistema.',
   array[
     'Baixe o modelo de metodologia de avaliação de riscos;',
     'Defina os níveis de probabilidade e de severidade, com descrição de cada um;',
     'Monte a matriz e defina as faixas de classificação;',
     'Escreva o critério de risco inaceitável e o que acontece quando um aparece;',
     'Faça o upload da metodologia aprovada.'
   ]::text[], true, true),

  (5, 4, 'Inventário de riscos', 'atividade', '6.1.2.2',
   'Agora o documento central do sistema: cada perigo levantado, com o risco '
   || 'avaliado pela sua metodologia e o controle que já existe.'
   || E'\n\n' ||
   'ATENÇÃO AO QUE SEGUE, porque economiza meses de retrabalho: este é o mesmo '
   || 'inventário de riscos que a NR-01 já obriga a sua empresa a ter dentro do '
   || 'PGR. É um documento só. Se a sua empresa já tem o PGR feito, comece dele '
   || 'e complete o que faltar para a norma; se não tem, o que sai daqui atende '
   || 'os dois. Manter duas planilhas separadas é garantir que elas se '
   || 'contradigam na frente do auditor.',
   array[
     'Baixe o modelo de inventário de riscos;',
     'Se já existe PGR, traga o inventário dele para cá antes de começar do zero;',
     'Lance cada perigo do levantamento, com a avaliação pela sua metodologia;',
     'Registre o controle que já existe hoje, mesmo que seja frágil;',
     'Classifique e ordene: o risco inaceitável vai para o topo;',
     'Faça o upload do inventário.'
   ]::text[], true, true),

  (5, 5, 'Planejamento das ações', 'atividade', '6.1.4',
   'O inventário aponta; esta atividade decide. Para cada risco que a sua '
   || 'régua classificou como inaceitável ou alto, o que será feito, por quem e '
   || 'até quando.'
   || E'\n\n' ||
   'A ordem das opções não é livre — a norma manda seguir a hierarquia de '
   || 'controles, e ela é estudada em detalhe na etapa 7. Por enquanto guarde a '
   || 'regra de ouro: EPI é a última linha, não a primeira. Plano de ação que '
   || 'só distribui EPI é plano que o auditor devolve.'
   || E'\n\n' ||
   'Este é também o momento de voltar ao plano de investimento da etapa 1 e '
   || 'trocar a estimativa provisória de adequação física pelo número real.',
   array[
     'Baixe o plano de ação de riscos;',
     'Para cada risco alto ou inaceitável, defina a ação, o responsável e o prazo;',
     'Verifique se a ação ataca o perigo ou só protege a pessoa — e prefira a primeira;',
     'Some o custo das adequações e atualize o plano de investimento da etapa 1;',
     'Leve à direção para aprovar prazo e recurso;',
     'Faça o upload do plano aprovado.'
   ]::text[], true, true),

  (5, 6, 'Oportunidades de SSO', 'atividade', '6.1.2.3',
   'A norma pede que a empresa avalie também as oportunidades: o que pode '
   || 'melhorar a segurança e a saúde além de corrigir o que está errado.'
   || E'\n\n' ||
   'Costuma ser a atividade mais rápida e a mais ignorada. Vale um pouco de '
   || 'atenção porque é onde cabem as ideias boas que aparecem no levantamento '
   || 'de campo e não têm onde ser registradas: adaptar um posto, mudar um '
   || 'horário, trocar um produto por outro menos agressivo.',
   array[
     'Baixe a planilha de oportunidades;',
     'Registre as melhorias possíveis que apareceram no levantamento de campo;',
     'Inclua oportunidades de adaptação do trabalho às pessoas;',
     'Priorize as viáveis e leve as escolhidas para o plano de ação;',
     'Faça o upload.'
   ]::text[], true, false),

  (5, 7, 'Feedback da etapa', 'feedback', null,
   'A etapa mais pesada da trilha. Conte quanto tempo o levantamento em campo '
   || 'levou de verdade e o que você faria diferente.',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ============== 6. Requisitos Legais e Outros Requisitos =============
  (6, 1, 'O que conta como requisito legal e outro requisito', 'leitura', '6.1.3',
   'Requisito legal é a lei que obriga: as Normas Regulamentadoras do '
   || 'Ministério do Trabalho, a legislação previdenciária, a ambiental quando '
   || 'toca a saúde de quem trabalha, a norma municipal do corpo de bombeiros.'
   || E'\n\n' ||
   '"Outros requisitos" é o que a empresa assumiu sem ser obrigada: a cláusula '
   || 'de segurança do contrato com o cliente, o acordo coletivo com o '
   || 'sindicato, a política do grupo controlador, a norma técnica que ela '
   || 'escolheu seguir.'
   || E'\n\n' ||
   'Os dois valem igual para a auditoria. Cláusula contratual descumprida é não '
   || 'conformidade do mesmo tamanho que NR descumprida — e muita empresa '
   || 'descobre isso tarde.',
   array[
     'Leia o texto acima;',
     'Levante com o jurídico e o comercial quais contratos têm cláusula de SSO;',
     'Marque como concluída.'
   ]::text[], false, false),

  (6, 2, 'Levantamento das NRs aplicáveis', 'atividade', '6.1.3',
   'Nem toda NR se aplica a toda empresa. A que tem caldeira precisa da NR-13; '
   || 'a que não tem, não. O que o auditor cobra é que a empresa saiba dizer '
   || 'quais se aplicam e por quê — e que tenha olhado todas antes de descartar.'
   || E'\n\n' ||
   'Use o inventário de riscos da etapa 5 como guia: cada perigo levantado '
   || 'aponta para a NR que o trata. Trabalho em altura puxa a NR-35, espaço '
   || 'confinado a NR-33, eletricidade a NR-10.',
   array[
     'Baixe a matriz de requisitos legais;',
     'Percorra a lista de NRs e marque, para cada uma, se aplica e por quê;',
     'Para as que aplicam, registre o que a empresa precisa ter e o que já tem;',
     'Use o inventário de riscos como conferência — perigo mapeado sem NR correspondente merece uma segunda olhada;',
     'Faça o upload da matriz.'
   ]::text[], true, true),

  (6, 3, 'Licenças, laudos e documentos com prazo', 'atividade', '6.1.3',
   'Esta atividade existe por uma razão prática: documento de SSO vence, e '
   || 'vencido ele não vale nada na auditoria. PCMSO, PGR, laudos, licença de '
   || 'operação, auto de vistoria do corpo de bombeiros, calibração de '
   || 'instrumento, inspeção de equipamento.'
   || E'\n\n' ||
   'A empresa que gerencia isso por memória sempre tem um vencido. Levante '
   || 'tudo agora, com a data de validade de cada um, e coloque o aviso para '
   || 'tocar antes.',
   array[
     'Baixe o controle de documentos com validade;',
     'Levante cada documento legal da empresa, com emissão e validade;',
     'Separe os que já estão vencidos e trate como ação prioritária;',
     'Defina quem é responsável por renovar cada um;',
     'Cadastre os vencimentos em Documentos de SST, aqui no portal, para receber o aviso antes;',
     'Faça o upload do controle.'
   ]::text[], true, true),

  (6, 4, 'Como manter a matriz em dia', 'atividade', '6.1.3',
   'Lei muda. NR é revisada, acordo coletivo é renegociado todo ano, contrato '
   || 'novo traz cláusula nova. A norma pede que a empresa mantenha a '
   || 'informação atualizada, não que a levante uma vez.'
   || E'\n\n' ||
   'O que o auditor procura é a rotina: quem olha, com que frequência, onde '
   || 'olha e o que faz quando encontra mudança. Sem isso, a matriz feita hoje '
   || 'está errada em um ano.',
   array[
     'Escreva no procedimento quem acompanha a mudança legal e com que frequência;',
     'Defina as fontes que serão consultadas;',
     'Defina o que acontece quando uma mudança afeta a empresa: quem avalia e quem decide a ação;',
     'Inclua a renegociação do acordo coletivo como gatilho de revisão;',
     'Faça o upload do procedimento.'
   ]::text[], true, true),

  (6, 5, 'Programar a avaliação do atendimento', 'atividade', '9.1.2',
   'Ter a matriz não prova cumprimento. A norma pede, no 9.1.2, uma avaliação '
   || 'periódica em que a empresa verifica item por item se está cumprindo, e '
   || 'registra o resultado.'
   || E'\n\n' ||
   'É uma atividade de etapa adiante — ela vive na etapa 12 — mas a frequência '
   || 'se define aqui, junto com a matriz, enquanto o assunto está fresco.',
   array[
     'Defina com que frequência a avaliação de atendimento legal será feita;',
     'Defina quem a conduz e quem recebe o resultado;',
     'Agende a primeira no calendário;',
     'Registre a decisão no procedimento e marque como concluída.'
   ]::text[], false, false),

  (6, 6, 'Feedback da etapa', 'feedback', null,
   'Conte como foi levantar a legislação: achou documento vencido? Apareceu '
   || 'cláusula de contrato que ninguém sabia que existia?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ======================= 7. Gestão Operacional =======================
  (7, 1, 'A hierarquia de controles', 'leitura', '8.1.2',
   'Este é o conceito que o auditor mais usa para avaliar se a empresa entendeu '
   || 'a norma ou só montou papel. A ordem é: eliminar o perigo; substituir por '
   || 'algo menos perigoso; aplicar controle de engenharia e reorganizar o '
   || 'trabalho; aplicar controle administrativo, incluindo treinamento; e, por '
   || 'último, EPI.'
   || E'\n\n' ||
   'A ordem é obrigatória, e a razão é simples: os controles do topo funcionam '
   || 'sozinhos, os de baixo dependem da pessoa acertar todo dia. Guarda-corpo '
   || 'protege quem esqueceu; cinto só protege quem lembrou de prender.'
   || E'\n\n' ||
   'Na prática brasileira, a inversão é a regra: compra-se EPI porque é barato '
   || 'e rápido. O auditor pergunta por que não foi eliminado, e "não dava" '
   || 'precisa estar justificado por escrito, não dito na hora.',
   array[
     'Leia o texto acima;',
     'Volte ao plano de ação da etapa 5 e confira: quantas ações são EPI?',
     'Marque como concluída.'
   ]::text[], false, false),

  (7, 2, 'Revisar o plano de ação pela hierarquia', 'atividade', '8.1.2',
   'Agora a aplicação do que você acabou de ler, no seu próprio plano. Pegue as '
   || 'ações definidas na etapa 5 e pergunte, uma a uma: dava para eliminar? '
   || 'Dava para substituir? Dava para resolver com engenharia?'
   || E'\n\n' ||
   'Onde a resposta for não, escreva por quê. Essa justificativa é o que '
   || 'separa a empresa que pensou da empresa que comprou EPI por reflexo.',
   array[
     'Reabra o plano de ação da etapa 5;',
     'Para cada ação, registre em que nível da hierarquia ela está;',
     'Onde o controle escolhido for administrativo ou EPI, escreva por que os níveis acima não eram viáveis;',
     'Troque o que der para trocar por um controle de nível mais alto;',
     'Faça o upload do plano revisado.'
   ]::text[], true, true),

  (7, 3, 'Instruções de trabalho das atividades de risco', 'atividade', '8.1.1',
   'Para as atividades que o inventário apontou como de risco alto, a norma '
   || 'pede controle operacional: a atividade precisa ser feita de um jeito '
   || 'definido, e esse jeito precisa estar escrito e conhecido.'
   || E'\n\n' ||
   'Instrução de trabalho boa é curta, tem foto, e está onde a tarefa acontece '
   || '— não na gaveta da qualidade. Instrução de oito páginas em linguagem de '
   || 'engenheiro não é lida por ninguém, e o auditor percebe isso perguntando '
   || 'ao operador o que está escrito nela.',
   array[
     'Baixe o modelo de instrução de trabalho;',
     'Escreva uma para cada atividade de risco alto do inventário;',
     'Escreva com quem faz a tarefa, não sobre ele — e use foto sempre que possível;',
     'Inclua o que fazer quando algo sai do previsto, e quem pode parar;',
     'Deixe a instrução disponível no local da tarefa;',
     'Faça o upload das instruções.'
   ]::text[], true, true),

  (7, 4, 'Permissão de trabalho para atividades críticas', 'atividade', '8.1.1',
   'Trabalho em altura, espaço confinado, serviço a quente, intervenção '
   || 'elétrica: são atividades em que o erro mata, e por isso não começam sem '
   || 'uma liberação formal feita na hora, no local.'
   || E'\n\n' ||
   'A permissão de trabalho não é burocracia duplicada da instrução. Ela checa '
   || 'as condições daquele dia: a pessoa está treinada e apta, o equipamento '
   || 'está inspecionado, a área foi isolada, o resgate está disponível.',
   array[
     'Baixe o modelo de permissão de trabalho;',
     'Defina quais atividades da sua empresa exigem permissão;',
     'Ajuste a lista de verificação ao que cada uma exige;',
     'Defina quem pode emitir e quem pode aprovar — e que não é a mesma pessoa que executa;',
     'Treine os emissores;',
     'Faça o upload do modelo e do registro do treinamento.'
   ]::text[], true, true),

  (7, 5, 'Gestão de mudanças', 'atividade', '8.1.3',
   'Máquina nova, layout novo, produto químico diferente, turno a mais, '
   || 'processo terceirizado: toda mudança cria perigo que ninguém mapeou, '
   || 'porque o inventário descreve a empresa de antes.'
   || E'\n\n' ||
   'O 8.1.3 pede que a empresa avalie o risco antes de a mudança acontecer, e '
   || 'não depois do primeiro acidente com o equipamento novo. É um dos '
   || 'requisitos mais simples de escrever e dos mais difíceis de fazer virar '
   || 'hábito — porque mudança tem pressa, e segurança parece atraso.',
   array[
     'Baixe o formulário de gestão de mudanças;',
     'Defina o que conta como mudança que exige avaliação;',
     'Defina quem avalia e quem autoriza a mudança seguir;',
     'Defina o gatilho: nenhuma compra de máquina ou troca de químico passa sem passar por aqui;',
     'Combine a atualização do inventário de riscos depois de cada mudança;',
     'Faça o upload do procedimento.'
   ]::text[], true, true),

  (7, 6, 'Feedback da etapa', 'feedback', null,
   'Conte como foi aplicar a hierarquia de controles ao seu plano: quantas '
   || 'ações mudaram de nível?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ============ 8. Compras, Contratadas e Terceirizados ===============
  (8, 1, 'O risco que entra pelo portão', 'leitura', '8.1.4.1',
   'A norma é direta nisto: a empresa responde pela segurança de quem trabalha '
   || 'sob o seu controle, e isso inclui contratada e terceirizado dentro das '
   || 'suas instalações. Acidente com funcionário de empreiteira na sua obra é '
   || 'acidente do seu sistema de gestão.'
   || E'\n\n' ||
   'Isso incomoda, e é a intenção. Terceirizar a atividade perigosa sem '
   || 'terceirizar o risco é prática comum, e a 45001 fecha essa porta.'
   || E'\n\n' ||
   'A aquisição entra no mesmo requisito por um motivo parecido: máquina '
   || 'comprada sem proteção e produto químico comprado sem ficha de segurança '
   || 'trazem perigo para dentro antes de alguém perceber.',
   array[
     'Leia o texto acima;',
     'Levante quantas pessoas de terceiros trabalham hoje nas suas instalações;',
     'Marque como concluída.'
   ]::text[], false, false),

  (8, 2, 'Critérios de SSO na compra', 'atividade', '8.1.4.1',
   'O momento mais barato de resolver um perigo é antes de ele entrar. Máquina '
   || 'sem proteção custa caro de adequar depois; produto químico sem '
   || 'alternativa menos agressiva vira EPI para sempre.'
   || E'\n\n' ||
   'Esta atividade coloca segurança dentro do processo de compra — não como '
   || 'opinião do técnico, e sim como critério escrito que o comprador precisa '
   || 'verificar antes de fechar.',
   array[
     'Baixe o procedimento de aquisição com critérios de SSO;',
     'Defina o que será exigido na compra de máquina e equipamento: proteção, manual, conformidade com a NR aplicável;',
     'Defina o que será exigido na compra de produto químico: ficha com dados de segurança e avaliação de alternativa menos agressiva;',
     'Defina quem aprova tecnicamente antes de a compra ser fechada;',
     'Combine com Compras e registre o acordo;',
     'Faça o upload do procedimento.'
   ]::text[], true, true),

  (8, 3, 'Qualificação e controle de contratadas', 'atividade', '8.1.4.2',
   'Contratada que entra sem documento é passivo que entra junto. O 8.1.4.2 '
   || 'pede que a empresa verifique que os requisitos de SSO são atendidos pelas '
   || 'contratadas e pelos seus trabalhadores.'
   || E'\n\n' ||
   'Na prática são três momentos: antes de contratar, verifica-se a capacidade; '
   || 'na entrada, conferem-se os documentos das pessoas; durante o serviço, '
   || 'fiscaliza-se o que está sendo feito. A maioria das empresas faz o '
   || 'segundo e esquece o terceiro — e é no terceiro que o acidente acontece.',
   array[
     'Baixe o procedimento de contratadas;',
     'Defina os critérios de SSO para qualificar uma contratada antes de contratar;',
     'Liste os documentos exigidos na entrada: treinamento, exame médico, ficha de EPI, ordem de serviço;',
     'Defina como a execução será fiscalizada durante o serviço, e por quem;',
     'Defina o que acontece quando a contratada descumpre — e escreva a consequência;',
     'Faça o upload do procedimento.'
   ]::text[], true, true),

  (8, 4, 'Integração de terceirizados e visitantes', 'atividade', '8.1.4.3',
   'Quem chega não conhece o risco da sua casa. A integração é a conversa de '
   || 'entrada que apresenta os perigos da área, as regras, o que fazer no '
   || 'alarme e para quem avisar.'
   || E'\n\n' ||
   'Precisa ser curta e precisa ser registrada. Integração de duas horas que '
   || 'ninguém escuta cumpre o papel na pasta e falha no pátio; quinze minutos '
   || 'bem feitos, com o mapa da área na mão, funcionam.',
   array[
     'Baixe o roteiro de integração;',
     'Monte o conteúdo a partir dos riscos reais do seu inventário;',
     'Inclua rota de fuga, ponto de encontro e sinal de alarme;',
     'Defina quem aplica e onde o registro de presença fica guardado;',
     'Aplique a primeira e suba o registro aqui.'
   ]::text[], true, true),

  (8, 5, 'Feedback da etapa', 'feedback', null,
   'Conte como foi: a sua empresa já controlava contratada? O que faltava?',
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
select e.ordem, e.nome, count(a.id) as atividades
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
  left join public.implantacao_atividades a on a.etapa_id = e.id
 where m.nome = 'Implantação — ISO 45001:2024'
 group by e.ordem, e.nome
 order by e.ordem;
