-- =====================================================================
-- Trilha de implantação da ISO 9001:2026 — parte 2 de 4.
--
-- Atividades das etapas 5 a 8: Requisitos Legais, Tecnologia da
-- Informação, Gestão da Informação e Infraestrutura, e Recursos
-- Humanos.
--
-- POR QUE A TI VEM ANTES DA INFRAESTRUTURA. No cronograma do
-- concorrente é assim, e faz sentido: a esta altura a empresa já
-- produziu quatro ou cinco documentos e precisa saber onde eles vivem
-- antes de produzir mais trinta. Deixar isso para depois é descobrir
-- no mês seis que metade do SGQ está no computador de alguém que saiu.
--
-- POR QUE RH É A MAIOR DESTA LEVA. Competência, conscientização e
-- comunicação são três requisitos distintos que a empresa costuma
-- tratar como um só ("a gente treina o pessoal"). São oito atividades
-- porque é onde mais se perde constatação na certificação: o auditor
-- conversa com quem está no chão, e a resposta dessa pessoa vale mais
-- que qualquer certificado na pasta.
--
-- SEM LGPD, por decisão dele: a etapa 5 é só a legislação aplicável ao
-- produto e ao serviço.
--
-- Depende de supabase/implantacao-9001-parte1.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(etapa, ordem, titulo, tipo, requisito, aula, passos, upload, aprova) as (
  values

-- ===================== 5. Requisitos Legais =========================
  (5, 1, 'Levantamento da legislação aplicável'::text, 'atividade'::text, '4.2'::text,
   'A norma não lista leis. Ela pede que a empresa determine os requisitos das partes '
   || 'interessadas — e o órgão fiscalizador é uma delas, com exigências que não são '
   || 'negociáveis.'
   || E'\n\n' ||
   'Na prática: que licenças o negócio precisa ter, que normas técnicas se aplicam ao '
   || 'produto, que registros profissionais a equipe precisa manter. Vale o que se aplica ao '
   || 'que a empresa VENDE — não a legislação brasileira inteira.'
   || E'\n\n' ||
   'Lista longa demais não se mantém, e lista que não se mantém vira constatação na '
   || 'primeira auditoria de manutenção.'::text,
   array[
     'Baixe a planilha de requisitos legais;',
     'Comece pelas exigências que você já marcou como legais no levantamento de partes interessadas;',
     'Acrescente licenças, alvarás, normas técnicas do produto e registros profissionais;',
     'Para cada uma, anote o número, a validade e onde o documento está guardado;',
     'Deixe de fora o que não se aplica ao que a empresa vende;',
     'Faça o upload da planilha.'
   ]::text[], true, true),

  (5, 2, 'Como a lista é mantida em dia', 'atividade', '4.2',
   'Legislação muda. Licença vence. A diferença entre uma empresa certificada e uma que '
   || 'perde o certificado na manutenção costuma ser esta: alguém olha a lista de tempos em '
   || 'tempos, ou ninguém olha.'
   || E'\n\n' ||
   'O documento aqui é de três linhas. O que importa é a combinação: quem verifica, com que '
   || 'frequência, e onde registra que verificou.',
   array[
     'Defina quem é responsável por revisar a lista;',
     'Defina de quanto em quanto tempo (o usual é semestral, e sempre que houver mudança conhecida);',
     'Combine onde fica o registro da verificação — pode ser a própria planilha, com data e assinatura;',
     'Anote no comentário o que foi combinado, com nome e periodicidade;',
     'Envie.'
   ]::text[], false, true),

  (5, 3, 'Verificação de atendimento', 'atividade', '8.2.2',
   'Ter a lista não basta: é preciso dizer, item por item, se a empresa atende hoje. Onde '
   || 'não atende, entra prazo e responsável.'
   || E'\n\n' ||
   'Esta é a atividade que costuma travar a trilha por algumas semanas — e é bom que trave. '
   || 'Descobrir uma licença vencida agora é incômodo; descobrir na auditoria de certificação '
   || 'é não conformidade maior, e maior trava o certificado.',
   array[
     'Na mesma planilha, preencha a coluna "atende hoje?" para cada requisito;',
     'Onde a resposta for não, escreva o que falta, quem resolve e até quando;',
     'Leve os casos sem solução à vista para a direção — alguns custam dinheiro;',
     'Faça o upload da planilha preenchida.'
   ]::text[], true, true),

  (5, 4, 'Feedback da etapa', 'feedback', null,
   'Esta etapa costuma revelar surpresas. Conte o que apareceu.',
   array[
     'Diga o que você descobriu que não sabia;',
     'Conte se algum item ficou sem resposta por falta de informação;',
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

-- ================= 6. Tecnologia da Informação ======================
  (6, 1, 'Onde a informação do SGQ vive', 'atividade', '7.1.3',
   'Você criou a estrutura de pastas na etapa 1 e o procedimento de informação documentada '
   || 'na etapa 2. Agora a pergunta é de infraestrutura: essa pasta está em que máquina, em '
   || 'que serviço, e quem garante que ela continua existindo amanhã?'
   || E'\n\n' ||
   'Pasta em computador pessoal de um funcionário é o arranjo mais comum e o mais frágil. '
   || 'Quando a pessoa sai, sai o sistema de gestão junto.',
   array[
     'Baixe o formulário de infraestrutura da informação;',
     'Responda onde a pasta do SGQ está hospedada hoje;',
     'Diga quem tem acesso físico a essa máquina ou conta;',
     'Se estiver em computador de uma pessoa só, registre isso como risco e combine a mudança;',
     'Faça o upload do formulário.'
   ]::text[], true, true),

  (6, 2, 'Quem lê e quem altera', 'atividade', '7.5.3',
   'O 7.5.3 pede que a informação documentada esteja protegida contra perda de integridade '
   || 'e uso indevido. Traduzindo: nem todo mundo precisa poder apagar o procedimento.'
   || E'\n\n' ||
   'A regra prática que funciona em empresa pequena: todos leem, poucos escrevem, um aprova. '
   || 'Mais níveis que isso ninguém cumpre.',
   array[
     'Liste quem pode ler, quem pode alterar e quem aprova, por tipo de documento;',
     'Aplique isso de fato nas permissões da pasta ou do serviço de nuvem;',
     'Registre a configuração no mesmo formulário da atividade anterior;',
     'Faça o upload do formulário atualizado.'
   ]::text[], true, true),

  (6, 3, 'Backup e teste de restauração', 'atividade', '7.5.3',
   'Backup que nunca foi restaurado não é backup: é esperança. A empresa descobre que o '
   || 'arquivo estava corrompido justamente no dia em que precisa dele.'
   || E'\n\n' ||
   'O auditor costuma perguntar duas coisas: com que frequência o backup é feito, e quando '
   || 'foi a última vez que alguém testou restaurar. A segunda pergunta derruba mais gente '
   || 'que a primeira.',
   array[
     'Registre como o backup é feito e com que frequência;',
     'Escolha um arquivo qualquer do SGQ e restaure-o de verdade, numa pasta separada;',
     'Anote a data do teste e o resultado;',
     'Combine de repetir o teste pelo menos uma vez por ano;',
     'Faça o upload do registro do teste.'
   ]::text[], true, true),

  (6, 4, 'Feedback da etapa', 'feedback', null,
   'Como está a casa da informação na sua empresa?',
   array[
     'Conte o que precisou mudar;',
     'Diga se encontrou algo que te preocupou;',
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

-- ========= 7. Gestão da Informação e Infraestrutura =================
  (7, 1, 'Levantamento da infraestrutura', 'atividade', '7.1.3',
   'O 7.1.3 cobre o que é preciso para o processo rodar: prédio, máquina, equipamento, '
   || 'transporte, software.'
   || E'\n\n' ||
   'Não é inventário patrimonial. É a lista do que, se parar, para a entrega — e por isso ela '
   || 'costuma ser bem menor do que a empresa imagina.',
   array[
     'Baixe a planilha de infraestrutura;',
     'Liste o que é essencial para entregar o produto ou o serviço;',
     'Para cada item, diga quem é o responsável e onde fica;',
     'Marque o que, se parar hoje, para a produção;',
     'Faça o upload da planilha.'
   ]::text[], true, true),

  (7, 2, 'Plano e registro de manutenção', 'atividade', '7.1.3',
   'Para o que foi marcado como essencial: existe manutenção programada, ou só se conserta '
   || 'quando quebra?'
   || E'\n\n' ||
   'A norma não obriga a ter manutenção preventiva de tudo. Obriga a manter a infraestrutura '
   || 'adequada para a conformidade do produto — e manutenção só corretiva, numa máquina '
   || 'crítica, é difícil de defender diante de um auditor.',
   array[
     'Para cada item essencial, defina se terá manutenção preventiva, e com que frequência;',
     'Registre na mesma planilha, com a data da última e da próxima;',
     'Combine onde ficam guardadas as ordens de serviço e notas de manutenção;',
     'Faça o upload da planilha atualizada.'
   ]::text[], true, true),

  (7, 3, 'Ambiente de trabalho', 'atividade', '7.1.4',
   'O 7.1.4 fala do ambiente necessário para a operação dos processos: fatores físicos '
   || '(temperatura, ruído, iluminação, limpeza) e também sociais e psicológicos.'
   || E'\n\n' ||
   'A parte social é a que mais se esquece e a que o auditor mais percebe: equipe sob pressão '
   || 'constante erra mais, e isso aparece no indicador de retrabalho antes de aparecer em '
   || 'qualquer pesquisa.',
   array[
     'Baixe o formulário de ambiente de trabalho;',
     'Registre os fatores físicos que afetam a qualidade do que vocês entregam;',
     'Registre o que é feito quanto ao ambiente social — o PGR e o PCMSO costumam ter parte disso;',
     'Se já houver laudo de ruído, calor ou iluminação, aponte onde está em vez de refazer;',
     'Faça o upload do formulário.'
   ]::text[], true, true),

  (7, 4, 'Instrumentos de medição e calibração', 'atividade', '7.1.5',
   'Se a empresa mede alguma coisa para dizer que o produto está bom — paquímetro, balança, '
   || 'termômetro, manômetro — esse instrumento precisa ser rastreável e verificado.'
   || E'\n\n' ||
   'É o requisito com custo mais concreto da norma: calibração se paga por instrumento. Por '
   || 'isso entra aqui, e não no fim: dá tempo de orçar e incluir no plano de investimento.'
   || E'\n\n' ||
   'Empresa de serviço, que não mede nada para aceitar o próprio trabalho, declara que não se '
   || 'aplica — com justificativa escrita.',
   array[
     'Liste todo instrumento usado para aceitar ou rejeitar produto;',
     'Para cada um, registre o número de identificação e a situação da calibração;',
     'Peça orçamento de calibração para os que estão vencidos;',
     'Defina a frequência de calibração de cada um;',
     'Combine o que fazer quando um instrumento é encontrado fora de calibração — a norma pede que se avalie o que foi medido com ele;',
     'Faça o upload da planilha.'
   ]::text[], true, true),

  (7, 5, 'Feedback da etapa', 'feedback', null,
   'Infraestrutura costuma ser a etapa que revela custo. Conte como foi.',
   array[
     'Diga o que apareceu de custo não previsto;',
     'Conte se precisou envolver a direção;',
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

-- ==================== 8. Recursos Humanos ===========================
  (8, 1, 'Matriz de competência por função', 'atividade', '7.2',
   'Para cada função que afeta a qualidade: o que a pessoa precisa saber, e como a empresa '
   || 'comprova que ela sabe.'
   || E'\n\n' ||
   'Competência não é diploma. É formação, treinamento OU experiência — e a norma aceita as '
   || 'três. Soldador com vinte anos de casa e sem curso formal é competente; o que falta é '
   || 'a empresa registrar que avaliou isso.',
   array[
     'Baixe a matriz de competência;',
     'Liste as funções que afetam a qualidade do produto ou serviço;',
     'Para cada uma, escreva o que é necessário saber;',
     'Diga como se comprova: certificado, avaliação prática, tempo de experiência registrado;',
     'Preencha a situação de cada pessoa hoje;',
     'Faça o upload da matriz.'
   ]::text[], true, true),

  (8, 2, 'Levantamento e plano de treinamento', 'atividade', '7.2',
   'Onde a matriz mostrou lacuna, entra ação: treinar, contratar, remanejar ou terceirizar. '
   || 'A norma pede a ação e a avaliação da eficácia dela.'
   || E'\n\n' ||
   'Plano com trinta treinamentos no primeiro ano não se cumpre. Dois ou três, que fecham as '
   || 'lacunas que mais doem, valem mais na auditoria e na prática.',
   array[
     'Compare o necessário com o atual na matriz;',
     'Liste as lacunas, da mais crítica para a menos;',
     'Para cada uma, defina a ação, o responsável, o prazo e o custo;',
     'Leve os custos para o plano de investimento da etapa 1;',
     'Faça o upload do plano de treinamento.'
   ]::text[], true, true),

  (8, 3, 'Avaliação da eficácia do treinamento', 'atividade', '7.2',
   'A norma pede que se avalie se a ação funcionou. Lista de presença prova que a pessoa '
   || 'esteve na sala; não prova que ela aprendeu.'
   || E'\n\n' ||
   'A avaliação pode ser simples: prova, demonstração prática, ou acompanhamento do supervisor '
   || 'por um período. O que não pode é não existir.',
   array[
     'Defina, para cada treinamento do plano, como a eficácia será avaliada;',
     'Combine o prazo entre o treinamento e a avaliação (trinta a noventa dias é o usual);',
     'Baixe o formulário de avaliação de eficácia;',
     'Faça o upload do formulário com as regras preenchidas.'
   ]::text[], true, true),

  (8, 4, 'Conscientização', 'atividade', '7.3',
   'Competência é saber fazer. Conscientização é saber POR QUE — e é um requisito separado, '
   || 'o 7.3.'
   || E'\n\n' ||
   'A norma quer que as pessoas conheçam a política da qualidade, os objetivos que as afetam, '
   || 'a contribuição delas para a eficácia do sistema e o que acontece se os requisitos não '
   || 'forem atendidos.'
   || E'\n\n' ||
   'É aqui que a certificação se ganha ou se perde: o auditor vai perguntar a alguém do chão '
   || 'o que é a política da qualidade. Se a resposta for "é aquele quadro ali", é constatação.',
   array[
     'Defina como a política e os objetivos serão apresentados às equipes;',
     'Inclua o tema na integração de quem for admitido;',
     'Faça pelo menos uma conversa com cada turno ou equipe, e registre presença e assunto;',
     'Dias depois, pergunte a duas ou três pessoas o que elas entenderam — e ajuste se a resposta for vaga;',
     'Anote no comentário quando e como foi feito;',
     'Envie.'
   ]::text[], false, true),

  (8, 5, 'Plano de comunicação', 'atividade', '7.4',
   'O 7.4 pede que a empresa determine as comunicações internas e externas pertinentes ao '
   || 'sistema: o que comunicar, quando, a quem, como, e quem comunica.'
   || E'\n\n' ||
   'Uma tabela de meia página resolve. O erro comum é escrever um plano que descreve uma '
   || 'empresa que não existe — reunião semanal que nunca acontece, mural que ninguém lê.',
   array[
     'Baixe o plano de comunicação;',
     'Registre o que já acontece de fato hoje, antes de inventar o que deveria acontecer;',
     'Acrescente só o que a empresa consegue manter;',
     'Inclua a comunicação externa: cliente, fornecedor, órgão fiscalizador;',
     'Faça o upload do plano.'
   ]::text[], true, true),

  (8, 6, 'Conhecimento organizacional', 'atividade', '7.1.6',
   'O que a empresa sabe e que não está escrito em lugar nenhum: o jeito de ajustar aquela '
   || 'máquina, o cliente que exige embalagem diferente, o fornecedor que atrasa em dezembro.'
   || E'\n\n' ||
   'O 7.1.6 pede que esse conhecimento seja determinado, mantido e disponibilizado. É o '
   || 'requisito que protege a empresa da aposentadoria do mestre de obras.',
   array[
     'Liste o conhecimento que hoje está só na cabeça de alguém;',
     'Para cada item, decida como registrar: instrução de trabalho, vídeo curto, foto do ajuste;',
     'Priorize o que sairia da empresa junto com uma pessoa só;',
     'Comece por um — registrar um bem feito vale mais que listar dez;',
     'Faça o upload da lista e do primeiro registro feito.'
   ]::text[], true, true),

  (8, 7, 'Pessoas: temos gente suficiente?', 'atividade', '7.1.2',
   'O 7.1.2 é curto e direto: a empresa precisa determinar e prover as pessoas necessárias '
   || 'para o sistema funcionar.'
   || E'\n\n' ||
   'Na prática é uma conversa com a direção. Se a resposta honesta for "não temos", isso '
   || 'precisa estar registrado — limitação declarada é tratável; limitação escondida vira '
   || 'constatação quando o auditor encontra o registro atrasado por falta de gente.',
   array[
     'Avalie se as funções da matriz de competência estão cobertas;',
     'Registre onde falta gente e o impacto disso;',
     'Leve à direção e anote o que foi decidido;',
     'Envie no comentário o que foi decidido, com data.'
   ]::text[], false, true),

  (8, 8, 'Revisão das atividades', 'revisao', null,
   'Conferida geral antes de entrar na parte comercial e operacional da empresa.',
   array[
     'Confira que toda lacuna de competência tem ação com prazo;',
     'Confira que a política da qualidade foi efetivamente apresentada às equipes;',
     'Confira que os instrumentos de medição críticos têm calibração encaminhada;',
     'Confira que o backup foi testado;',
     'Anote no comentário o que ficou pendente e por quê;',
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
       count(a.id)             as atividades,
       count(a.modelo_arquivo) as com_modelo
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
  left join public.implantacao_atividades a on a.etapa_id = e.id
 where m.nome = 'Implantação — ISO 9001:2026'
 group by e.ordem, e.nome
 order by e.ordem;
