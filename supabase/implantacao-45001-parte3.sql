-- =====================================================================
-- Trilha de implantação da ISO 45001:2024 — parte 3 de 4.
--
-- Atividades das etapas 9 a 12: Recursos Humanos, Infraestrutura e
-- Saúde Ocupacional, Emergências e Monitoramento e Medição.
--
-- AQUI A TRILHA ENCOSTA NO RESTO DO PORTAL, DE PROPÓSITO. O cliente que
-- implanta a 45001 precisa de ficha de EPI, de controle de validade de
-- treinamento, de checklist de inspeção e de documento com vencimento —
-- e tudo isso já existe nas outras ferramentas que ele contratou. Mandar
-- ele montar planilha paralela seria vender duas vezes a mesma coisa e
-- deixar o dado em dois lugares que divergem.
--
-- Por isso várias atividades desta parte terminam em "cadastre no
-- portal" em vez de "faça o upload da planilha": a evidência da
-- auditoria passa a sair do próprio sistema, viva, em vez de um anexo
-- que envelhece no dia seguinte.
--
-- Depende de supabase/implantacao-45001-parte1.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

  -- ======================= 9. Recursos Humanos =========================
  (9, 1, 'Matriz de competência'::text, 'atividade'::text, '7.2'::text,
   'O 7.2 pede que a empresa determine a competência necessária de quem faz '
   || 'trabalho que afeta o desempenho de SSO, garanta que a pessoa tenha essa '
   || 'competência e guarde a evidência.'
   || E'\n\n' ||
   'Em SSO a competência tem uma camada a mais do que na qualidade: boa parte '
   || 'dela é exigida por lei, com carga horária e periodicidade definidas em '
   || 'NR. Trabalho em altura, espaço confinado, eletricidade, operação de '
   || 'empilhadeira — cada um tem treinamento obrigatório, e treinamento '
   || 'vencido é o mesmo que treinamento inexistente.',
   array[
     'Baixe a matriz de competência;',
     'Liste as funções e, para cada uma, o que a pessoa precisa saber para trabalhar com segurança;',
     'Marque quais treinamentos são exigidos por NR, com a periodicidade de cada um;',
     'Compare com quem a empresa tem hoje e aponte as lacunas;',
     'Cadastre os treinamentos e as validades em Certificados, aqui no portal — o aviso de vencimento passa a chegar sozinho;',
     'Faça o upload da matriz.'
   ]::text[], true, true),

  (9, 2, 'Conscientização: o que todo trabalhador precisa saber', 'atividade', '7.3',
   'Competência é saber fazer. Conscientização é entender por quê — e o 7.3 '
   || 'lista o que a empresa precisa garantir que cada trabalhador saiba: a '
   || 'política de SSO, os perigos e riscos a que ele está exposto, as ações '
   || 'determinadas para ele, e as consequências de não seguir o combinado.'
   || E'\n\n' ||
   'Há um item nessa lista que quase nenhuma empresa comunica e que o auditor '
   || 'adora perguntar: o trabalhador precisa saber que pode se afastar de uma '
   || 'situação de perigo grave e iminente, e que não será prejudicado por '
   || 'isso. Se o operador não souber disso, o requisito não está atendido — '
   || 'por mais treinamento que a empresa tenha dado.',
   array[
     'Monte o conteúdo de conscientização a partir do inventário de riscos de cada área;',
     'Inclua expressamente o direito de se afastar de perigo grave e iminente, sem prejuízo;',
     'Aplique por área, com registro de quem participou;',
     'Confira depois: pergunte a dois ou três operadores o que eles entenderam;',
     'Faça o upload do conteúdo e da lista de presença.'
   ]::text[], true, true),

  (9, 3, 'Ordem de serviço de segurança', 'atividade', '7.3',
   'A ordem de serviço é exigência da NR-01 e serve direto ao 7.3: é o '
   || 'documento em que a empresa informa ao trabalhador, por escrito, os '
   || 'riscos da função dele, as medidas de controle e as obrigações dele.'
   || E'\n\n' ||
   'Como já existe o inventário de riscos por área, montar a ordem de serviço '
   || 'aqui é quase automático — e a assinatura dela é a evidência mais simples '
   || 'de que a comunicação de risco aconteceu.',
   array[
     'Baixe o modelo de ordem de serviço;',
     'Gere uma por função, puxando os riscos do inventário da etapa 5;',
     'Inclua as medidas de controle e o que se espera do trabalhador;',
     'Colha a assinatura de cada um, com data;',
     'Guarde as assinadas na pasta da pessoa e suba o modelo aqui.'
   ]::text[], true, true),

  (9, 4, 'Comunicação interna e externa', 'atividade', '7.4',
   'O 7.4 pede que a empresa defina o que comunica sobre SSO, quando, a quem e '
   || 'como — e que a comunicação considere quem recebe. Comunicado em '
   || 'português técnico para equipe que não lê bem não comunica nada.'
   || E'\n\n' ||
   'A parte externa costuma ser esquecida: comunicação com a fiscalização, com '
   || 'o cliente que exige indicador, com o sindicato, com a comunidade vizinha '
   || 'quando há risco que atravessa o muro.',
   array[
     'Baixe a matriz de comunicação;',
     'Defina o que é comunicado internamente, para quem, com que frequência e por qual meio;',
     'Defina a comunicação externa: fiscalização, cliente, sindicato, vizinhança;',
     'Considere quem recebe: turno da noite, terceirizado, quem tem dificuldade de leitura;',
     'Defina quem é autorizado a falar pela empresa em assunto de acidente;',
     'Faça o upload da matriz.'
   ]::text[], true, true),

  (9, 5, 'Feedback da etapa', 'feedback', null,
   'Conte como foi: a empresa tinha o controle de validade dos treinamentos? '
   || 'Quantos estavam vencidos?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ========== 10. Infraestrutura e Saúde Ocupacional ==================
  (10, 1, 'Recursos e infraestrutura', 'atividade', '7.1',
   'O 7.1 pede que a empresa determine e forneça os recursos necessários ao '
   || 'sistema. Em SSO isso é concreto: o prédio, a máquina, a instalação '
   || 'elétrica, a iluminação, a ventilação, o banheiro, o refeitório.'
   || E'\n\n' ||
   'Esta atividade é a conferência física do que o inventário apontou. Ela '
   || 'costuma produzir a lista de obras do projeto — e é melhor descobrir '
   || 'agora do que na auditoria de certificação.',
   array[
     'Baixe o levantamento de infraestrutura;',
     'Percorra as instalações e registre a condição de cada item;',
     'Cruze com o inventário de riscos: perigo de instalação precisa aparecer nos dois;',
     'Leve o que exige obra para o plano de ação, com prazo e custo;',
     'Faça o upload do levantamento.'
   ]::text[], true, true),

  (10, 2, 'PCMSO e exames ocupacionais', 'atividade', '7.1',
   'O programa de controle médico é exigência legal e é também o que sustenta '
   || 'a parte "saúde" da norma — que muita empresa trata como se não existisse, '
   || 'cuidando só do acidente.'
   || E'\n\n' ||
   'O ponto que o auditor verifica não é só ter o PCMSO: é se ele conversa com '
   || 'o inventário de riscos. Se o inventário aponta exposição a ruído e o '
   || 'PCMSO não pede audiometria, um dos dois está errado — e os dois são seus.'
   || E'\n\n' ||
   'Lembre do que foi combinado na etapa 1: ASO e resultado de exame são dado '
   || 'médico individual e ficam na pasta restrita, nunca na pasta geral do '
   || 'SGSSO.',
   array[
     'Levante o PCMSO vigente e a data de validade;',
     'Confira se os exames previstos cobrem as exposições do inventário de riscos;',
     'Aponte as divergências e trate com o médico do trabalho;',
     'Cadastre o PCMSO e a validade em Documentos de SST, aqui no portal;',
     'Suba aqui a conferência entre inventário e PCMSO — não suba os ASOs.'
   ]::text[], true, true),

  (10, 3, 'EPI: seleção, entrega e controle', 'atividade', '8.1.2',
   'EPI é o último nível da hierarquia, mas continua sendo necessário onde os '
   || 'controles de cima não dão conta. O que a norma e a NR-06 cobram é a '
   || 'cadeia inteira: o EPI certo para o risco, com CA válido, entregue com '
   || 'registro, treinado quanto ao uso, trocado quando danificado.'
   || E'\n\n' ||
   'Ficha de EPI em papel é onde essa cadeia se rompe: some, molha, não tem '
   || 'assinatura. A ferramenta de EPI do portal faz a entrega com foto e '
   || 'assinatura no celular e gera a ficha da NR-06 pronta — use-a, em vez de '
   || 'montar uma planilha que vai divergir dela.',
   array[
     'Defina o EPI necessário por função, a partir do inventário de riscos;',
     'Confira o CA de cada item e a validade;',
     'Cadastre os EPIs e as fichas em EPI, aqui no portal;',
     'Faça as entregas pelo celular, com assinatura do trabalhador;',
     'Treine o uso, a guarda e a troca, e registre;',
     'Suba aqui a relação de EPI por função.'
   ]::text[], true, true),

  (10, 4, 'Ergonomia e organização do trabalho', 'atividade', '6.1.2.1',
   'A parte da norma que trata do que adoece devagar. Postura, esforço '
   || 'repetitivo, levantamento de peso, iluminação, mobiliário — e também '
   || 'ritmo, jornada, pressão por produtividade e, sim, assédio.'
   || E'\n\n' ||
   'É a área que mais gera afastamento no Brasil e a que menos aparece nos '
   || 'inventários, porque não produz um acidente com data e hora. Se o seu '
   || 'levantamento da etapa 5 não trouxe nenhum perigo desse tipo, ele está '
   || 'incompleto.',
   array[
     'Reveja o inventário de riscos procurando o que adoece com o tempo;',
     'Levante os postos com esforço, repetição, postura ruim ou pressão de ritmo;',
     'Registre o que os próprios trabalhadores apontam — aqui a consulta do 5.4 vale ouro;',
     'Leve as adequações para o plano de ação;',
     'Faça o upload do levantamento.'
   ]::text[], true, true),

  (10, 5, 'Feedback da etapa', 'feedback', null,
   'Conte como foi: o PCMSO conversava com o inventário? Quantos EPIs estavam '
   || 'com CA vencido?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- ========================= 11. Emergências ===========================
  (11, 1, 'O que a norma pede sobre emergência', 'leitura', '8.2',
   'O 8.2 pede que a empresa se prepare para as situações de emergência '
   || 'identificadas: planeje a resposta, treine, teste periodicamente e revise '
   || 'o plano depois de cada teste e de cada ocorrência real.'
   || E'\n\n' ||
   'Duas exigências costumam passar batido. A primeira: a resposta precisa '
   || 'considerar também quem não é empregado — terceirizado, visitante, '
   || 'vizinho. A segunda: o plano precisa ser comunicado às partes '
   || 'interessadas pertinentes, o que inclui, em muitos casos, o corpo de '
   || 'bombeiros e a empresa vizinha.'
   || E'\n\n' ||
   'E a palavra que importa é TESTAR. Plano guardado não é plano: é papel.',
   array[
     'Leia o texto acima;',
     'Levante se a empresa já fez algum simulado e quando;',
     'Marque como concluída.'
   ]::text[], false, false),

  (11, 2, 'Levantar os cenários de emergência', 'atividade', '8.2',
   'Cenário de emergência não se inventa: ele sai do inventário de riscos. '
   || 'Onde há produto inflamável, o cenário é incêndio; onde há químico, '
   || 'vazamento; onde há altura, queda com vítima suspensa; onde há espaço '
   || 'confinado, resgate.'
   || E'\n\n' ||
   'Inclua também o que não nasce da operação: incêndio na vizinhança, falta de '
   || 'energia prolongada, e os eventos climáticos extremos que a análise de '
   || 'contexto da etapa 3 apontou.',
   array[
     'Baixe a planilha de cenários de emergência;',
     'Percorra o inventário de riscos e derive os cenários possíveis;',
     'Acrescente os cenários externos: vizinhança, energia, clima;',
     'Classifique por gravidade e por probabilidade;',
     'Faça o upload.'
   ]::text[], true, true),

  (11, 3, 'Plano de resposta a emergências', 'atividade', '8.2',
   'Para cada cenário: o que fazer, quem faz, quem aciona quem, por onde se '
   || 'sai, onde se encontra depois e quando se pode voltar.'
   || E'\n\n' ||
   'Escreva curto. Plano de emergência de quarenta páginas não é lido no dia '
   || 'do incêndio — o que funciona é uma página por cenário, com telefone, '
   || 'rota e nome de quem decide.',
   array[
     'Baixe o modelo de plano de resposta a emergências;',
     'Escreva uma resposta por cenário, em uma página;',
     'Defina o ponto de encontro, a rota de fuga e o sinal de alarme;',
     'Defina quem aciona os serviços externos e com que telefone;',
     'Inclua como terceirizados e visitantes serão alertados e conduzidos;',
     'Faça o upload do plano aprovado.'
   ]::text[], true, true),

  (11, 4, 'Brigada, recursos e sinalização', 'atividade', '8.2',
   'Plano sem gente treinada e sem equipamento funcionando é intenção. Esta '
   || 'atividade confere a parte física: quem é a brigada, se está treinada e '
   || 'em dia, e se extintor, hidrante, alarme, iluminação de emergência e '
   || 'sinalização estão onde deveriam e funcionando.',
   array[
     'Levante quem compõe a brigada e a validade do treinamento de cada um;',
     'Confira extintores, hidrantes, alarme, iluminação de emergência e saídas;',
     'Confira a sinalização e a desobstrução das rotas de fuga;',
     'Monte um checklist de inspeção desses itens em Inspeções, aqui no portal, com periodicidade;',
     'Leve o que faltar para o plano de ação;',
     'Suba aqui a conferência inicial.'
   ]::text[], true, true),

  (11, 5, 'Simulado', 'atividade', '8.2',
   'O teste do plano, e a atividade que mais ensina em toda a trilha. Faça um '
   || 'simulado de verdade, do cenário mais provável, com a operação rodando.'
   || E'\n\n' ||
   'O resultado esperado não é "deu tudo certo". Simulado que dá tudo certo na '
   || 'primeira vez normalmente foi avisado demais. O que vale é o relatório do '
   || 'que falhou — a porta que estava trancada, o alarme que não se ouve no '
   || 'galpão, o terceirizado que não sabia para onde ir — e as ações que saem '
   || 'dele.',
   array[
     'Escolha o cenário e a data;',
     'Avise só quem precisa saber para a segurança do exercício;',
     'Execute, cronometre e observe;',
     'Reúna os participantes logo depois e colha o que falhou, inclusive dos terceirizados;',
     'Escreva o relatório com as falhas e as ações, com responsável e prazo;',
     'Revise o plano a partir do que aprendeu e suba o relatório aqui.'
   ]::text[], true, true),

  (11, 6, 'Feedback da etapa', 'feedback', null,
   'Conte como foi o simulado: o que falhou? Alguma surpresa?',
   array[
     'Escreva o que funcionou e o que atrapalhou;',
     'Diga quanto tempo a etapa levou;',
     'Envie.'
   ]::text[], false, false),

  -- =================== 12. Monitoramento e Medição =====================
  (12, 1, 'O que medir em SSO', 'leitura', '9.1.1',
   'O 9.1.1 pede que a empresa determine o que precisa ser monitorado e medido, '
   || 'os métodos, os critérios e quando os resultados são analisados.'
   || E'\n\n' ||
   'A armadilha clássica é medir só acidente. Acidente é indicador que chega '
   || 'tarde: quando ele mexe, alguém já se machucou. E, pior, quando vira meta '
   || 'de bônus, a equipe aprende a não reportar — a empresa passa a ter '
   || 'números ótimos e risco igual.'
   || E'\n\n' ||
   'Por isso se mede também o que antecipa: quase-acidente reportado, desvio '
   || 'corrigido no prazo, inspeção feita, treinamento em dia, ação do plano '
   || 'concluída. Um número de quase-acidente subindo costuma ser notícia boa — '
   || 'quer dizer que as pessoas voltaram a falar.',
   array[
     'Leia o texto acima;',
     'Marque como concluída.'
   ]::text[], false, false),

  (12, 2, 'Definir os indicadores', 'atividade', '9.1.1',
   'Agora os números da sua empresa. Misture os dois tipos: os que antecipam e '
   || 'os que contam o que já houve.'
   || E'\n\n' ||
   'Entre os de resultado, os dois clássicos são a taxa de frequência e a taxa '
   || 'de gravidade de acidentes. Defina a fórmula que a empresa vai usar e '
   || 'escreva-a — porque existe mais de uma convenção, e trocar de fórmula no '
   || 'meio do ano destrói a comparação.',
   array[
     'Baixe o painel de indicadores de SSO;',
     'Defina de quatro a oito indicadores, misturando antecipação e resultado;',
     'Escreva a fórmula de cada um, inclusive a da taxa de frequência e da de gravidade;',
     'Defina a meta, a frequência de apuração e quem apura;',
     'Ligue os indicadores aos objetivos da etapa 3 — indicador que não serve a objetivo nenhum sai;',
     'Faça o upload do painel.'
   ]::text[], true, true),

  (12, 3, 'Inspeções planejadas de segurança', 'atividade', '9.1.1',
   'A inspeção é o monitoramento que acontece no chão: alguém percorre a área '
   || 'com um checklist e registra o que está fora do padrão.'
   || E'\n\n' ||
   'O que transforma inspeção em sistema de gestão é o que acontece depois: '
   || 'cada item reprovado precisa virar uma não conformidade com responsável e '
   || 'prazo, e alguém precisa verificar se foi resolvido. Inspeção que termina '
   || 'em planilha arquivada é passeio.'
   || E'\n\n' ||
   'A ferramenta de Inspeções do portal já faz esse caminho inteiro — o item '
   || 'reprovado vira não conformidade sozinho. Monte os checklists lá.',
   array[
     'Defina quais inspeções serão feitas, em que áreas e com que frequência;',
     'Monte os checklists em Inspeções, aqui no portal, a partir do inventário de riscos;',
     'Defina quem aplica cada uma;',
     'Aplique a primeira rodada;',
     'Confira que os itens reprovados viraram não conformidade com prazo e dono;',
     'Suba aqui o programa de inspeções.'
   ]::text[], true, true),

  (12, 4, 'Avaliação do atendimento aos requisitos legais', 'atividade', '9.1.2',
   'A verificação periódica, item por item, de que a empresa cumpre o que a '
   || 'matriz da etapa 6 listou. O 9.1.2 exige que ela aconteça e que o '
   || 'resultado seja mantido como informação documentada.'
   || E'\n\n' ||
   'É aqui que se descobre o documento vencido antes de o auditor descobrir. '
   || 'Faça a primeira agora, mesmo que a matriz seja recente.',
   array[
     'Reabra a matriz de requisitos legais da etapa 6;',
     'Percorra item a item e registre: atende, não atende, ou atende parcialmente;',
     'Para o que não atende, abra ação com responsável e prazo;',
     'Registre a data da avaliação e quem a fez;',
     'Agende a próxima conforme a frequência definida na etapa 6;',
     'Faça o upload da avaliação.'
   ]::text[], true, true),

  (12, 5, 'Feedback da etapa', 'feedback', null,
   'Conte como foi: conseguiu montar indicador de antecipação ou só sobrou '
   || 'acidente?',
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
