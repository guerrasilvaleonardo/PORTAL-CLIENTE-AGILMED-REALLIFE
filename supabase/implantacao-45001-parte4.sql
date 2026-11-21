-- =====================================================================
-- Trilha de implantação da ISO 45001:2024 — parte 4 de 4.
--
-- Atividades das etapas 13 a 16: Incidentes e Ação Corretiva, Melhoria
-- Contínua, Preparação para Auditoria Externa e Certificação.
--
-- A ETAPA 15 É O ENCONTRO DOS DOIS MÓDULOS. A trilha de implantação
-- constrói; a auditoria verifica. No fim da construção o cliente roda a
-- auditoria interna dele no módulo de Auditorias, com o checklist da
-- 45001 que já está lá, requisito por requisito. É por isso que os dois
-- módulos existem lado a lado em vez de um só: eles se encontram aqui,
-- e nenhum dos dois faz sentido sozinho para quem vai certificar.
--
-- A 45001:2024 MANTÉM O 10.3 (melhoria contínua) como requisito
-- próprio, diferente da 9001:2026, que deixou de ter. Por isso a etapa
-- 14 existe aqui e não tem correspondente exato na outra trilha.
--
-- Depende de supabase/implantacao-45001-parte1.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

  -- ===== 13. Incidentes, Não Conformidades e Ação Corretiva ===========
  (13, 1, 'Incidente, acidente, quase-acidente e não conformidade'::text,
   'leitura'::text, '10.2'::text,
   'Vale alinhar as palavras antes, porque a empresa e a norma costumam usá-las '
   || 'de modo diferente. INCIDENTE é a ocorrência decorrente do trabalho que '
   || 'resultou ou poderia ter resultado em lesão ou doença. Quando houve lesão, '
   || 'a prática brasileira chama de ACIDENTE; quando não houve, de '
   || 'QUASE-ACIDENTE. NÃO CONFORMIDADE é o descumprimento de um requisito — do '
   || 'seu procedimento, da norma ou da lei — tenha ou não gerado incidente.'
   || E'\n\n' ||
   'A distinção importa porque o quase-acidente é informação de graça: a mesma '
   || 'falha, sem a vítima. Empresa que trata quase-acidente com a seriedade do '
   || 'acidente aprende barato. Empresa que só investiga quando alguém se '
   || 'machuca aprende caro, e sempre depois.'
   || E'\n\n' ||
   'O 10.2 pede que a empresa reaja, avalie a necessidade de ação para eliminar '
   || 'a causa-raiz, analise se o mesmo pode acontecer em outro lugar, e '
   || 'verifique a eficácia do que fez. Note a palavra CAUSA-RAIZ: "falta de '
   || 'atenção do colaborador" não é causa-raiz, é o ponto onde a investigação '
   || 'preguiçosa para.',
   array[
     'Leia o texto acima;',
     'Pergunte à equipe quantos quase-acidentes foram reportados no último ano;',
     'Marque como concluída.'
   ]::text[], false, false),

  (13, 2, 'Procedimento de investigação de incidentes', 'atividade', '10.2',
   'O documento que define o caminho: quem comunica, em quanto tempo, quem '
   || 'investiga, como se chega à causa-raiz, quem aprova a ação e quem '
   || 'verifica se funcionou.'
   || E'\n\n' ||
   'Dois pontos que a norma cobra e que mudam o resultado. O primeiro: os '
   || 'trabalhadores participam da investigação — é um dos assuntos reservados '
   || 'ao 5.4, e investigação feita só por técnico atrás da mesa não cumpre o '
   || 'requisito. O segundo: a ação precisa ser avaliada pela hierarquia de '
   || 'controles da etapa 7, e não terminar sempre em "reforçar o treinamento".',
   array[
     'Baixe o procedimento de investigação de incidentes;',
     'Defina o prazo de comunicação e quem é comunicado;',
     'Defina o método de análise de causa-raiz que a empresa vai usar;',
     'Escreva que o trabalhador da área participa da investigação;',
     'Defina a verificação de eficácia: quem confere, quando, e com que evidência;',
     'Faça o upload do procedimento aprovado.'
   ]::text[], true, true),

  (13, 3, 'Canal de reporte de quase-acidente e desvio', 'atividade', '10.2',
   'De nada adianta o procedimento se a ocorrência não chega. O canal precisa '
   || 'ser fácil, rápido e sem punição — e a última parte é a difícil.'
   || E'\n\n' ||
   'Onde reportar dá trabalho ou dá problema, ninguém reporta, e os indicadores '
   || 'ficam ótimos. Por isso o canal entra junto com uma decisão da direção, '
   || 'escrita: quem reporta não é punido pelo que reportou. Sem essa frase, o '
   || 'canal existe e fica vazio.',
   array[
     'Defina como o trabalhador reporta: por onde, em quanto tempo, com que facilidade;',
     'Obtenha da direção, por escrito, o compromisso de não punir quem reporta;',
     'Divulgue o canal em todas as áreas e turnos;',
     'Defina quem recebe, quem triagem e em quanto tempo responde;',
     'Registre os acidentes e quase-acidentes em Inspeções, aqui no portal, onde cada um já puxa causa, ação e verificação de eficácia;',
     'Suba aqui a definição do canal e a comunicação da direção.'
   ]::text[], true, true),

  (13, 4, 'Tratar uma ocorrência de ponta a ponta', 'atividade', '10.2',
   'A prova de que o procedimento funciona. Pegue uma ocorrência real — um '
   || 'quase-acidente, um desvio de inspeção, uma não conformidade — e leve-a '
   || 'até o fim: causa-raiz, ação, implantação, verificação de eficácia.'
   || E'\n\n' ||
   'O auditor vai fazer exatamente isso: escolher um caso e seguir o rastro. Se '
   || 'o rastro parar em "ação concluída" sem ninguém ter verificado se o '
   || 'problema sumiu, o requisito não está atendido.',
   array[
     'Escolha uma ocorrência real;',
     'Investigue com quem trabalha na área, pelo método que você definiu;',
     'Chegue à causa-raiz — e desconfie se ela for "desatenção";',
     'Defina a ação pela hierarquia de controles;',
     'Implante, e depois verifique se funcionou, com evidência;',
     'Suba aqui o registro completo do caso.'
   ]::text[], true, true),

  (13, 5, 'Feedback da etapa', 'feedback', null,
   'Conte como foi: a causa-raiz do caso que você tratou era o que parecia no '
   || 'começo?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ====================== 14. Melhoria Contínua ========================
  (14, 1, 'O que a 45001 cobra de melhoria contínua', 'leitura', '10.1, 10.3',
   'A 45001:2024 mantém a melhoria contínua como requisito próprio, o 10.3, e '
   || 'é mais específica do que parece: pede que a empresa melhore o desempenho '
   || 'de SSO, promova uma cultura que apoie o sistema, promova a participação '
   || 'dos trabalhadores na implementação das ações, e comunique os resultados '
   || 'a eles.'
   || E'\n\n' ||
   'Essa última parte é a que quase ninguém faz. A empresa melhora, mede, leva '
   || 'o número para a reunião de diretoria — e o operador que apontou o '
   || 'problema nunca fica sabendo que mudou alguma coisa. Da próxima vez ele '
   || 'não aponta.',
   array[
     'Leia o texto acima;',
     'Marque como concluída.'
   ]::text[], false, false),

  (14, 2, 'De onde vêm as melhorias', 'atividade', '10.3',
   'Melhoria contínua não é uma reunião: é um conjunto de entradas que já '
   || 'existem no seu sistema e precisam ter para onde ir. O reporte de '
   || 'quase-acidente, o resultado da inspeção, a investigação de incidente, a '
   || 'consulta aos trabalhadores, o simulado, os indicadores, a auditoria.'
   || E'\n\n' ||
   'Esta atividade amarra essas pontas: cada entrada com um destino, um '
   || 'responsável por olhar e uma frequência. E, do outro lado, a devolutiva — '
   || 'como o resultado volta para quem trabalha.',
   array[
     'Baixe o programa de melhoria contínua;',
     'Liste as entradas que alimentam a melhoria e de onde cada uma vem;',
     'Defina quem analisa cada uma e com que frequência;',
     'Defina como o resultado é comunicado aos trabalhadores — e não só à direção;',
     'Defina como os trabalhadores participam da implementação das ações;',
     'Faça o upload do programa.'
   ]::text[], true, true),

  (14, 3, 'Feedback da etapa', 'feedback', null,
   'Conte como foi: a sua empresa já devolvia resultado para quem está na '
   || 'operação?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ============ 15. Preparação para Auditoria Externa =================
  (15, 1, 'O que é a auditoria interna', 'leitura', '9.2',
   'A auditoria interna é a empresa se auditando antes de alguém de fora fazer '
   || 'isso. O 9.2 pede que ela aconteça em intervalos planejados, cubra os '
   || 'requisitos da norma e os da própria empresa, e que os auditores sejam '
   || 'objetivos e imparciais.'
   || E'\n\n' ||
   'Imparcial quer dizer uma coisa simples e que muita empresa ignora: ninguém '
   || 'audita o próprio trabalho. Quem escreveu o procedimento de emergência '
   || 'não audita emergência.'
   || E'\n\n' ||
   'E uma observação sobre o tamanho: auditoria interna que não acha nada não '
   || 'é boa notícia. Significa que ela foi rasa, e que o auditor externo vai '
   || 'achar o que ela deixou passar — só que valendo o certificado.',
   array[
     'Leia o texto acima;',
     'Defina quem pode auditar o quê sem auditar o próprio trabalho;',
     'Marque como concluída.'
   ]::text[], false, false),

  (15, 2, 'Programa e plano de auditoria interna', 'atividade', '9.2',
   'O programa diz o que será auditado ao longo do ano, com que frequência e '
   || 'por quem — levando em conta a importância dos processos e os resultados '
   || 'de auditorias anteriores. O plano é o detalhe de cada auditoria: data, '
   || 'escopo, critérios, agenda e quem participa.'
   || E'\n\n' ||
   'Monte os dois no módulo de Auditorias, aqui no portal: ele já traz o '
   || 'programa anual, o plano, a agenda e a lista de participantes no formato '
   || 'que a ISO 19011 orienta, e o relatório sai pronto no fim.',
   array[
     'Abra Auditar o sistema, aqui no portal;',
     'Monte o programa anual de auditoria interna;',
     'Crie a auditoria da 45001 e preencha o plano: escopo, critérios e agenda;',
     'Defina os auditores, respeitando a imparcialidade;',
     'Comunique os auditados com antecedência;',
     'Suba aqui o programa aprovado.'
   ]::text[], true, true),

  (15, 3, 'Rodar a auditoria interna', 'atividade', '9.2',
   'A hora de usar o outro módulo para valer. O checklist da ISO 45001 já está '
   || 'lá, requisito por requisito, com o que pedir para ver em cada um — e '
   || 'cada item que não atende vira constatação com prazo e dono, sem passar '
   || 'por planilha.'
   || E'\n\n' ||
   'Audite com o inventário de riscos na mão. A pergunta mais produtiva de '
   || 'toda auditoria de SSO é simples: pegue um risco alto do inventário e '
   || 'siga o rastro dele até o controle no chão, o treinamento da pessoa e o '
   || 'registro da inspeção. Onde o rastro quebrar, está a constatação.',
   array[
     'Abra a auditoria criada em Auditar o sistema;',
     'Percorra o checklist da 45001, requisito por requisito;',
     'Escolha dois ou três riscos altos e siga o rastro de cada um até o chão;',
     'Registre cada achado como conformidade, não conformidade maior ou menor, ou oportunidade;',
     'Faça a reunião de encerramento com os auditados;',
     'Gere o relatório no portal e suba aqui.'
   ]::text[], true, true),

  (15, 4, 'Tratar as constatações', 'atividade', '10.2',
   'Cada não conformidade da auditoria interna segue o mesmo caminho da etapa '
   || '13: causa-raiz, ação, implantação, verificação de eficácia.'
   || E'\n\n' ||
   'Este é o momento mais apertado do projeto, porque a data da certificação já '
   || 'está marcada. Resista à tentação de fechar tudo no papel: o auditor '
   || 'externo costuma pedir justamente as constatações da interna e perguntar '
   || 'o que foi feito.',
   array[
     'Liste as constatações da auditoria interna;',
     'Trate cada uma com causa-raiz e ação, pela hierarquia de controles;',
     'Priorize as que tocam risco alto;',
     'Verifique a eficácia antes de fechar — e guarde a evidência;',
     'Suba aqui o quadro de tratamento, com a situação de cada constatação.'
   ]::text[], true, true),

  (15, 5, 'Análise crítica pela direção, agora com dados', 'atividade', '9.3',
   'Na etapa 3 você agendou a reunião e montou a pauta. Agora há o que levar: '
   || 'indicadores, incidentes, resultado das inspeções, avaliação legal, '
   || 'auditoria interna, o que veio da consulta aos trabalhadores.'
   || E'\n\n' ||
   'A direção precisa sair da sala com decisões, não com um "ficou ciente": o '
   || 'que muda no sistema, que recurso é liberado, que objetivo é revisto. É '
   || 'isso que a ata registra, e é isso que o auditor lê.',
   array[
     'Reúna as entradas que a norma pede;',
     'Faça a reunião com a direção;',
     'Registre as decisões, com responsável e prazo;',
     'Faça o upload da ata assinada.'
   ]::text[], true, true),

  (15, 6, 'Feedback da etapa', 'feedback', null,
   'Conte como foi a auditoria interna: quantas constatações saíram? Alguma '
   || 'surpreendeu?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ========================= 16. Certificação ==========================
  (16, 1, 'Escolher o organismo certificador', 'atividade', null,
   'O organismo é quem emite o certificado, e nem todo certificado vale o '
   || 'mesmo. O que dá valor é a acreditação: no Brasil, o organismo acreditado '
   || 'pelo Inmetro. Certificado de organismo sem acreditação costuma ser '
   || 'recusado justamente pelo cliente que exigiu a certificação.'
   || E'\n\n' ||
   'Peça três propostas e compare o preço total do ciclo, não o da primeira '
   || 'auditoria: o ciclo tem três anos, com auditorias de manutenção no '
   || 'caminho, e é aí que as propostas se diferenciam de verdade.',
   array[
     'Levante organismos acreditados pelo Inmetro para a ISO 45001;',
     'Peça pelo menos três propostas, com o escopo e o número de pessoas da empresa;',
     'Compare o custo do ciclo completo de três anos, não só o da certificação;',
     'Confirme se o organismo tem auditor com experiência no seu setor;',
     'Leve à direção, escolha e suba aqui a proposta assinada.'
   ]::text[], true, true),

  (16, 2, 'Auditoria de certificação — fase 1', 'atividade', null,
   'A fase 1 é a leitura do sistema: o auditor confere se a documentação '
   || 'existe, se o escopo faz sentido e se a empresa está pronta para a fase '
   || '2. Em SSO ele olha com atenção o inventário de riscos, a matriz legal e '
   || 'a auditoria interna.'
   || E'\n\n' ||
   'O resultado comum é uma lista de pontos a resolver antes da fase 2. Não é '
   || 'reprovação: é o aviso que você ainda tem tempo de usar.',
   array[
     'Organize a documentação na estrutura de pastas da etapa 1;',
     'Separe o inventário de riscos, a matriz legal e o relatório da auditoria interna — é o que será pedido primeiro;',
     'Receba o auditor e acompanhe a análise;',
     'Anote cada ponto levantado e trate antes da fase 2;',
     'Suba aqui o relatório da fase 1.'
   ]::text[], true, true),

  (16, 3, 'Auditoria de certificação — fase 2', 'atividade', null,
   'A auditoria de verdade, no chão. O auditor conversa com o operador, olha a '
   || 'máquina, pede o registro, confere se o que está escrito acontece.'
   || E'\n\n' ||
   'Oriente a equipe com honestidade: responder o que sabe, mostrar o que tem, '
   || 'e dizer "não sei, vou verificar" quando for o caso. Equipe treinada para '
   || 'decorar resposta é descoberta em cinco minutos, e o estrago é maior do '
   || 'que o da não conformidade que se queria esconder.',
   array[
     'Prepare a equipe: responder com honestidade, sem decorar;',
     'Garanta que as pessoas-chave estarão presentes nas datas;',
     'Acompanhe a auditoria e anote cada constatação;',
     'Participe da reunião de encerramento;',
     'Suba aqui o relatório da fase 2.'
   ]::text[], true, true),

  (16, 4, 'Tratar as constatações e obter o certificado', 'atividade', null,
   'Sair da fase 2 com constatação é normal — quase toda empresa sai. O que '
   || 'define a certificação é o tratamento: plano de ação no prazo que o '
   || 'organismo deu, com causa-raiz e evidência.'
   || E'\n\n' ||
   'Use o mesmo caminho da etapa 13. Não invente processo novo para o auditor '
   || 'externo: o sistema que você montou é exatamente o que serve aqui.',
   array[
     'Monte o plano de ação das constatações, dentro do prazo do organismo;',
     'Trate cada uma com causa-raiz, ação e evidência;',
     'Envie ao organismo e acompanhe a aceitação;',
     'Receba o certificado;',
     'Suba aqui o certificado emitido.'
   ]::text[], true, true),

  (16, 5, 'Encerramento e o que vem depois', 'leitura', '10.3',
   'O certificado é válido por três anos, com auditorias de manutenção no '
   || 'caminho. Ele não encerra o sistema: encerra a implantação.'
   || E'\n\n' ||
   'O que sustenta a certificação daqui para a frente é a rotina que você '
   || 'montou — a inspeção que acontece, o quase-acidente que é reportado, o '
   || 'treinamento que não vence, a análise crítica que ocorre, o inventário de '
   || 'riscos que é revisto quando algo muda.'
   || E'\n\n' ||
   'E a próxima auditoria interna já tem data. Ela acontece no módulo de '
   || 'Auditar o sistema, aqui mesmo, todo ano.',
   array[
     'Leia o texto acima;',
     'Agende a próxima auditoria interna em Auditar o sistema;',
     'Confira que os vencimentos estão cadastrados em Certificados e Documentos de SST;',
     'Marque como concluída.'
   ]::text[], false, false),

  (16, 6, 'Feedback da trilha', 'feedback', null,
   'Chegou ao fim. Conte o que esta trilha deveria ter feito diferente — do '
   || 'começo ao fim, não só desta etapa. É o que vai melhorar a próxima.',
   array[
     'Escreva o que mais ajudou e o que mais atrapalhou na trilha inteira;',
     'Diga quanto tempo o projeto levou, do início à certificação;',
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
