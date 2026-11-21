-- =====================================================================
-- As prescrições da ISO 9001 — o requisito ensinado a quem vai atender.
--
-- Mesmo formato das 36 da 45001: o que é, o que fazer, como fazer, por
-- que a norma pede, e o que precisa estar na mão no dia da auditoria.
--
-- O TEXTO É NOSSO. Nada aqui transcreve a norma. O número é referência.
--
-- CONTEXTO DA 4ª EDIÇÃO: 6.1 desdobrado em 6.1.1, 6.1.2 e 6.1.3; o
-- capítulo 10 sem 10.3; e a determinação sobre mudança climática no
-- 4.1. Conferido no sumário e no texto da norma.
--
-- Depende de supabase/auditoria-prescricao.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

do $$
declare
  v_modelo uuid;
begin
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Auditoria interna — ISO 9001';

  if v_modelo is null then
    raise exception 'Rode antes supabase/inspecoes-auditoria.sql.';
  end if;

  update public.inspecao_modelo_itens i
     set prescricao = p.texto
    from (values

('4.1', 'contexto',
'O QUE É. Contexto é tudo que, de dentro ou de fora, afeta a capacidade da empresa de entregar o que promete ao cliente.

O QUE FAZER. Registrar as questões internas e externas pertinentes e revê-las periodicamente.

COMO FAZER. Uma tabela de uma página: questão, interna ou externa, como afeta a qualidade, o que fazemos. Exemplos que aparecem de verdade: dependência de um único fornecedor, rotatividade na produção, exigência nova de cliente, concorrente com prazo menor, sistema de gestão que ninguém usa. Para cada questão, diga o efeito — questão sem efeito declarado não é questão.

POR QUE A NORMA PEDE. Porque o sistema precisa ser desenhado para a sua realidade. É o contexto que explica por que você controla o fornecedor A com rigor e o B nem tanto.

O QUE VOCÊ PRECISA TER. O documento com as questões, o efeito de cada uma e a data da última revisão. Reveja ao menos uma vez por ano.'),

('4.1', 'clima',
'O QUE É. A 4ª edição traz, como todas as normas de sistema de gestão, a exigência de dizer se mudança climática é questão pertinente para a empresa.

O QUE FAZER. Analisar e registrar a conclusão — sim ou não, com justificativa.

COMO FAZER. Pergunte pelo efeito no que você entrega: evento extremo que para a produção ou a entrega, insumo que fica escasso ou mais caro, cliente que passou a exigir informação ambiental, regra nova que muda o seu processo. Se nada disso afeta, escreva isso e diga por quê. Se afeta, a questão entra no contexto e pode virar risco no 6.1.

POR QUE A NORMA PEDE. Porque passou a ser fator de continuidade do negócio, não assunto de relatório institucional.

O QUE VOCÊ PRECISA TER. Um parágrafo dentro da análise de contexto, com a conclusão e a data. Se for pertinente, o desdobramento tem de aparecer nos riscos — senão a conclusão fica solta.'),

('4.2', null,
'O QUE É. Parte interessada é quem afeta ou é afetado pela sua capacidade de entregar: clientes, fornecedores, órgãos reguladores, funcionários, sócios.

O QUE FAZER. Determinar quem são e quais requisitos deles são pertinentes ao sistema, acompanhando as mudanças.

COMO FAZER. Tabela com parte interessada, o que exige, se é exigência legal, e como atendemos. Cuidado com dois erros comuns: listar parte interessada genérica que não exige nada de concreto, e esquecer exigência contratual de cliente — que costuma ser a mais cobrada.

POR QUE A NORMA PEDE. Porque requisito que ninguém mapeou vira reclamação, devolução ou perda de contrato.

O QUE VOCÊ PRECISA TER. A tabela revista junto com o contexto, e a evidência de como você atende ao menos os requisitos de cliente e os legais.'),

('4.3', null,
'O QUE É. Escopo é a fronteira do sistema: quais produtos, serviços e unidades estão dentro.

O QUE FAZER. Determinar os limites e a aplicabilidade do sistema, documentar e manter disponível.

COMO FAZER. Diga os produtos e serviços, os endereços cobertos e, se houver, o que não se aplica — com justificativa. O caso mais comum é excluir o 8.3, projeto e desenvolvimento, quando a empresa produz conforme desenho do cliente. Isso é legítimo e precisa estar escrito. Exclusão sem justificativa, ou exclusão que afeta a conformidade do produto, é não conformidade.

POR QUE A NORMA PEDE. Porque o certificado vale para o escopo declarado, e cliente confere isso.

O QUE VOCÊ PRECISA TER. O escopo documentado, com as exclusões justificadas, disponível para quem pedir.'),

('4.4', null,
'O QUE É. É o sistema propriamente dito: os processos necessários e como eles se encaixam.

O QUE FAZER. Determinar os processos, suas entradas e saídas, a sequência entre eles, os critérios, os responsáveis e os indicadores.

COMO FAZER. Uma folha com as caixas principais resolve: comercial → análise crítica do pedido → planejamento → compras → produção → inspeção → expedição → pós-venda. Para cada caixa diga quem é o dono, o que entra, o que sai e como se mede. Teste o mapa com um pedido real, do contato à entrega. Se o caminho sumir no meio, falta processo ali.

POR QUE A NORMA PEDE. Porque qualidade não se garante no produto final: se garante no processo que o produz.

O QUE VOCÊ PRECISA TER. O mapa de processos, os donos e os indicadores de cada um.'),

('5.1.1', null,
'O QUE É. Liderança aqui é a direção prestar contas pelo sistema — não delegar e cobrar.

O QUE FAZER. Demonstrar liderança e comprometimento, com evidência.

COMO FAZER. A direção aprova a política e os objetivos; participa da análise crítica com ata; garante que o sistema esteja integrado ao negócio, e não paralelo a ele; libera recursos com registro. O sinal mais claro de sistema paralelo: a reunião de gestão discute faturamento e prazo, e a reunião da qualidade discute documento. Quando as duas viram uma só, o sistema entrou no negócio.

POR QUE A NORMA PEDE. Porque sistema sem dono na direção vira tarefa de uma pessoa, e cai quando essa pessoa sai.

O QUE VOCÊ PRECISA TER. Atas, aprovações e decisões datadas que mostrem a direção dentro do sistema.'),

('5.1.2', null,
'O QUE É. Foco no cliente é garantir que o que ele precisa seja entendido, atendido e medido.

O QUE FAZER. Assegurar que os requisitos do cliente e os legais sejam determinados e atendidos, e que os riscos que afetam a conformidade sejam tratados.

COMO FAZER. Traduza foco no cliente em algo medido: índice de entrega no prazo, taxa de retrabalho, reclamações por período, resultado de pesquisa de satisfação. Um número que a direção olha todo mês vale mais que um cartaz na parede.

POR QUE A NORMA PEDE. Porque é o ponto onde o sistema deixa de ser burocracia e vira resultado comercial.

O QUE VOCÊ PRECISA TER. O indicador escolhido, o histórico e a evidência de que a direção o analisa.'),

('5.2', null,
'O QUE É. A política da qualidade é o compromisso da direção, por escrito.

O QUE FAZER. Estabelecer, documentar, comunicar e manter disponível.

COMO FAZER. Meia página. Compromissos que você consiga provar: atender requisitos do cliente e os aplicáveis, melhorar continuamente o sistema, e o que for próprio do seu negócio. Para cada frase, pergunte "como eu provo isso?" — se não souber, tire. Comunique com lista de presença e deixe acessível a quem precisar.

POR QUE A NORMA PEDE. Porque a política é a régua contra a qual os objetivos e o desempenho são julgados.

O QUE VOCÊ PRECISA TER. A política assinada e datada, a evidência da comunicação e o local onde está disponível.'),

('5.3', null,
'O QUE É. É dizer quem responde por cada parte do sistema.

O QUE FAZER. Atribuir e comunicar papéis, responsabilidades e autoridades.

COMO FAZER. Uma tabela: função, o que responde no sistema, a quem reporta. Cubra ao menos: quem garante que o sistema está conforme, quem reporta o desempenho à direção, quem responde por cada processo do mapa. Autoridade precisa ser real: se alguém pode segurar uma entrega não conforme, escreva isso.

POR QUE A NORMA PEDE. Porque responsabilidade difusa é responsabilidade de ninguém, e o problema aparece quando algo dá errado entre dois setores.

O QUE VOCÊ PRECISA TER. A tabela comunicada. O auditor confere perguntando a duas pessoas o que cabe a elas.'),

('6.1.1', null,
'O QUE É. É determinar o que pode atrapalhar — e o que pode ajudar — antes de planejar.

O QUE FAZER. A partir do contexto e das partes interessadas, determinar os riscos e as oportunidades que o sistema precisa abordar.

COMO FAZER. Percorra a análise de contexto e a tabela de partes interessadas e pergunte, linha a linha: isso é risco para a conformidade do produto ou para a satisfação do cliente? É oportunidade? Liste o que sai dali. Não precisa de metodologia complexa: o que a norma quer é a ligação entre o que você descobriu e o que você vai tratar.

POR QUE A NORMA PEDE. Para o planejamento não ser lista inventada em reunião, e sim consequência do que a empresa sabe sobre si.

O QUE VOCÊ PRECISA TER. A lista com a origem de cada item declarada.'),

('6.1.2', null,
'O QUE É. É o que a empresa vai fazer com cada risco determinado.

O QUE FAZER. Planejar ações proporcionais ao efeito potencial do risco, integrá-las aos processos e avaliar a eficácia.

COMO FAZER. Para cada risco: a ação, o responsável, o prazo. Proporcional é a palavra-chave — risco pequeno com plano enorme desperdiça, risco grande com ação simbólica engana. Integrar significa a ação aparecer no procedimento, no sistema, no checklist de quem executa, e não só numa planilha. Depois do prazo, volte e veja se funcionou.

POR QUE A NORMA PEDE. Porque risco listado e sem ação é diagnóstico sem tratamento.

O QUE VOCÊ PRECISA TER. O plano com responsável e prazo, a evidência de que entrou na rotina, e a avaliação posterior.'),

('6.1.3', null,
'O QUE É. É o lado que quase ninguém faz: agir sobre oportunidade.

O QUE FAZER. Planejar ações para abordar as oportunidades determinadas.

COMO FAZER. Oportunidade em qualidade costuma ser prática: eliminar uma etapa que só gera retrabalho, automatizar uma conferência manual, qualificar um segundo fornecedor, usar a reclamação recorrente para mudar o produto. Escolha duas por ciclo e leve até o fim, com responsável e prazo, como faria com um risco.

POR QUE A NORMA PEDE. Porque a 4ª edição separou isso em item próprio justamente porque a prática virou tratar risco e ignorar oportunidade.

O QUE VOCÊ PRECISA TER. Pelo menos uma oportunidade do período com ação registrada e resultado. É das primeiras coisas que o auditor pede quando quer saber se o sistema é vivo.'),

('6.2', null,
'O QUE É. Objetivos da qualidade são onde a empresa quer chegar, em número, com plano para chegar lá.

O QUE FAZER. Estabelecer objetivos mensuráveis, coerentes com a política, e planejar como alcançá-los.

COMO FAZER. Poucos e verdadeiros. Cada um com meta, indicador, responsável e prazo: "reduzir retrabalho de solda de 8% para 3% até dezembro". Abaixo de cada objetivo, as ações concretas, com recurso e data. Evite objetivo que não depende de você e objetivo impossível de medir.

POR QUE A NORMA PEDE. Porque sem alvo não há como saber se o sistema melhora ou só se mantém.

O QUE VOCÊ PRECISA TER. A lista com meta, indicador, responsável e prazo, o plano de cada um, e o acompanhamento periódico registrado.'),

('6.3', null,
'O QUE É. É planejar a mudança no sistema antes de fazê-la.

O QUE FAZER. Quando a empresa determinar a necessidade de mudança, conduzi-la de forma planejada.

COMO FAZER. Defina o gatilho: troca de ERP, mudança de layout, processo novo, fornecedor crítico novo, saída de pessoa-chave. Antes de executar, responda quatro coisas: o propósito da mudança e suas consequências, o que isso faz com a integridade do sistema, que recursos são necessários, e quem passa a responder pelo quê. Meia página e uma aprovação resolvem.

POR QUE A NORMA PEDE. Porque mudança feita no improviso quebra justamente os controles que já funcionavam.

O QUE VOCÊ PRECISA TER. O registro da mudança planejada, com a aprovação anterior à execução.'),

('7.1.1', null,
'O QUE É. São os meios para o sistema funcionar: pessoas, infraestrutura, ambiente, medição e conhecimento.

O QUE FAZER. Determinar e prover os recursos necessários, considerando o que já existe e o que precisa vir de fora.

COMO FAZER. Liste o que o sistema exige e confronte com o que há. Quando faltar, registre o pedido. Pedido negado e registrado é evidência de que o sistema funcionou e a decisão foi da direção — e protege quem avisou.

POR QUE A NORMA PEDE. Porque cobrar resultado sem dar meio é o jeito mais comum de um sistema morrer no papel.

O QUE VOCÊ PRECISA TER. O levantamento, o orçamento aprovado e os pedidos com a resposta da direção.'),

('7.1.2', null,
'O QUE É. São as pessoas necessárias para operar os processos.

O QUE FAZER. Determinar e prover as pessoas necessárias à operação eficaz do sistema e dos processos.

COMO FAZER. Compare a demanda real com o quadro. Sinais de falta de gente: hora extra permanente, inspeção que deixa de ser feita, processo que só funciona quando uma pessoa específica está presente. Esse último é o mais perigoso, porque parece que está tudo bem — até a pessoa faltar.

POR QUE A NORMA PEDE. Porque processo sem gente suficiente não é processo: é dependência de esforço individual.

O QUE VOCÊ PRECISA TER. O quadro frente à demanda, e o registro das decisões quando faltou.'),

('7.1.3', null,
'O QUE É. Infraestrutura é prédio, equipamento, software, transporte e comunicação.

O QUE FAZER. Determinar, prover e manter a infraestrutura necessária.

COMO FAZER. O que o auditor procura é a manutenção, não a lista. Tenha o plano de manutenção dos equipamentos que afetam o produto, com periodicidade, e o registro da última feita. Inclua software: sistema que trava e faz a pessoa anotar no papel é infraestrutura que não atende.

POR QUE A NORMA PEDE. Porque equipamento mal mantido produz variação, e variação vira produto não conforme.

O QUE VOCÊ PRECISA TER. A lista dos equipamentos críticos, o plano de manutenção e os registros das manutenções realizadas.'),

('7.1.4', null,
'O QUE É. É o ambiente necessário para o processo funcionar — físico e humano.

O QUE FAZER. Determinar, prover e manter o ambiente necessário à operação dos processos.

COMO FAZER. Diga o que o seu processo exige e como você mantém: temperatura e umidade onde isso afeta o produto, limpeza na área de montagem, iluminação para inspeção visual, ruído que impede comunicação. O lado social também conta: ambiente de pressão e medo esconde defeito, e defeito escondido chega ao cliente.

POR QUE A NORMA PEDE. Porque condição de ambiente é causa frequente de defeito que ninguém consegue explicar.

O QUE VOCÊ PRECISA TER. As condições exigidas definidas e a evidência de que são mantidas e verificadas.'),

('7.1.5', null,
'O QUE É. São os recursos de monitoramento e medição: paquímetro, balança, manômetro, instrumento de ensaio.

O QUE FAZER. Garantir que sejam adequados, mantidos, e — quando a rastreabilidade for exigida — calibrados ou verificados contra padrão, identificados e protegidos.

COMO FAZER. Liste os instrumentos que afetam a decisão de aprovar ou reprovar. Para cada um: periodicidade, última calibração, próxima, certificado arquivado, etiqueta no próprio instrumento. E tenha uma regra para o pior caso: quando um instrumento é encontrado fora de calibração, o que fazer com os produtos medidos por ele desde a última boa. Essa pergunta derruba muita gente.

POR QUE A NORMA PEDE. Porque medir errado é pior que não medir: dá confiança falsa.

O QUE VOCÊ PRECISA TER. A lista, os certificados dentro da validade, a identificação nos instrumentos e a regra para o instrumento reprovado.'),

('7.1.6', null,
'O QUE É. Conhecimento organizacional é o que a empresa sabe fazer e que não está escrito em lugar nenhum.

O QUE FAZER. Determinar o conhecimento necessário, mantê-lo disponível e, quando mudar algo, decidir como adquirir o que falta.

COMO FAZER. Pergunte: o que acontece se a pessoa mais antiga do processo sair amanhã? Se a resposta for "a gente se vira", não há controle. Transforme o que está na cabeça em algo acessível — instrução com foto, vídeo curto, registro de lições aprendidas, segunda pessoa treinada. Não precisa documentar tudo: documente o que doeria perder.

POR QUE A NORMA PEDE. Porque conhecimento que mora em uma pessoa só é risco de continuidade.

O QUE VOCÊ PRECISA TER. A identificação do conhecimento crítico e a evidência de como ele é preservado.'),

('7.2', null,
'O QUE É. Competência é a pessoa conseguir fazer a tarefa com a qualidade exigida.

O QUE FAZER. Determinar a competência necessária, garantir que as pessoas a tenham e manter evidência.

COMO FAZER. Matriz: função, competência exigida, como se comprova, validade. Depois, a situação de cada pessoa. Para tarefa que define a qualidade — solda, inspeção, calibração, atendimento técnico —, certificado não basta: inclua avaliação prática. Quando a competência faltar, a norma quer a ação tomada e a avaliação de que funcionou, não só o treinamento realizado.

POR QUE A NORMA PEDE. Porque a maior parte do defeito recorrente vem de alguém fazendo uma tarefa para a qual não foi preparado.

O QUE VOCÊ PRECISA TER. A matriz, os registros por pessoa e o controle de validade.'),

('7.3', null,
'O QUE É. Conscientização é a pessoa saber por que o que ela faz importa.

O QUE FAZER. Garantir que as pessoas tenham consciência da política, dos objetivos que lhes cabem, da contribuição delas e das implicações de não atender ao sistema.

COMO FAZER. Traduza para a linguagem do posto: o que acontece com o cliente se esta peça sair errada; qual número do painel este setor move. Faça em reunião curta, no local, com exemplo real. Conscientização genérica — "qualidade é tarefa de todos" — não sobrevive à primeira pergunta do auditor.

POR QUE A NORMA PEDE. Porque controle que depende de comportamento só funciona quando a pessoa entende o porquê.

O QUE VOCÊ PRECISA TER. Registros das ações, com lista de presença. Mas se audita perguntando ao trabalhador: converse com o seu pessoal antes.'),

('7.4', null,
'O QUE É. É definir quem comunica o quê, para quem e quando.

O QUE FAZER. Determinar as comunicações internas e externas pertinentes ao sistema.

COMO FAZER. Uma tabela: o que, quando, com quem, por qual meio, quem comunica. Interna: resultado de indicador para a área, mudança de requisito para quem produz, não conformidade para quem pode agir. Externa: o que vai para cliente, fornecedor e órgão. Inclua o caminho de volta — como o chão de fábrica avisa que algo está errado, e quem recebe esse aviso.

POR QUE A NORMA PEDE. Porque informação parada é informação inútil, e quase todo problema grande tem um ponto onde alguém sabia e não contou a quem podia agir.

O QUE VOCÊ PRECISA TER. O quadro de comunicação e evidência de que ele acontece.'),

('7.5', null,
'O QUE É. É o conjunto de documentos e registros que o sistema precisa — e o controle sobre eles.

O QUE FAZER. Criar e atualizar com identificação e aprovação adequadas; controlar disponibilidade, proteção, distribuição, versão, retenção e descarte.

COMO FAZER. Lista mestra: documento, versão, quem aprovou, data, onde fica, por quanto tempo guarda. Defina quem aprova e como a versão antiga sai de circulação. Documento de origem externa — norma, desenho de cliente, catálogo de fornecedor — também entra na lista, com a versão que você usa. Não documente o que não precisa: cada documento criado é um documento a manter.

POR QUE A NORMA PEDE. Porque trabalhar com a versão errada é tão ruim quanto não ter procedimento, com o agravante de todos acharem que está certo.

O QUE VOCÊ PRECISA TER. A lista mestra e a prova do controle. O teste do auditor é pegar o documento no posto e conferir se é a versão vigente.'),

('8.1', null,
'O QUE É. É o planejamento do que você faz todo dia para entregar o produto ou serviço.

O QUE FAZER. Planejar, implementar e controlar os processos, determinando requisitos, critérios de aceitação, recursos e os registros necessários.

COMO FAZER. Para um produto ou serviço típico, escreva: o que é feito, em que ordem, com que recurso, qual o critério de aceitação em cada etapa e que registro fica. É aqui que entram ordem de produção, instrução de trabalho e plano de inspeção. Critério de aceitação é o ponto fraco mais comum — "visualmente aceitável" não é critério.

POR QUE A NORMA PEDE. Porque é no processo que a qualidade é construída; no final só é possível conferir.

O QUE VOCÊ PRECISA TER. O planejamento de um processo real e os registros que ele gera.'),

('8.2.1', null,
'O QUE É. É toda a conversa com o cliente: proposta, pedido, alteração, reclamação, devolução.

O QUE FAZER. Determinar como a empresa comunica com o cliente sobre produto, consultas, contratos, alterações, retorno, propriedade do cliente e ações de contingência.

COMO FAZER. Defina o canal e o dono de cada tipo de contato, e o prazo de resposta. O ponto que o auditor costuma puxar é a reclamação: siga um caso real do recebimento ao fechamento e veja se ficou registrado, se o cliente foi respondido e se virou melhoria.

POR QUE A NORMA PEDE. Porque a maior parte dos problemas de qualidade aparece primeiro na comunicação, e não no produto.

O QUE VOCÊ PRECISA TER. O processo definido e o rastro de um caso real do começo ao fim.'),

('8.2.2', null,
'O QUE É. É saber o que o cliente quer — inclusive o que ele não disse.

O QUE FAZER. Determinar os requisitos do produto ou serviço antes de oferecê-lo, incluindo os legais e os que a empresa julgar necessários.

COMO FAZER. Para cada proposta, registre: o que o cliente pediu, o que a lei exige, o que é prática do setor e esperado sem ser dito, e o que a sua empresa acrescenta. O requisito não declarado é o que mais gera reclamação — prazo que o cliente supôs, acabamento que ele esperava, embalagem que ele precisava.

POR QUE A NORMA PEDE. Porque prometer o que não se sabe entregar começa antes da produção.

O QUE VOCÊ PRECISA TER. O registro dos requisitos determinados, por pedido ou por família de produto.'),

('8.2.3', null,
'O QUE É. É conferir, antes de assumir o compromisso, se você consegue entregar.

O QUE FAZER. Analisar criticamente os requisitos antes de se comprometer, e reter a informação documentada dessa análise.

COMO FAZER. Antes de aceitar o pedido, alguém confere: temos capacidade, prazo, material, competência e preço? Em empresa pequena isso pode ser um campo no próprio pedido com o visto do responsável. O que não pode é o compromisso ser assumido só pelo comercial, sem ninguém da produção olhar.

POR QUE A NORMA PEDE. Porque prazo impossível aceitado na assinatura vira atraso, retrabalho e hora extra depois.

O QUE VOCÊ PRECISA TER. A evidência da análise crítica em pedidos reais, com quem analisou e quando.'),

('8.2.4', null,
'O QUE É. É o que acontece quando o cliente muda o pedido no meio do caminho.

O QUE FAZER. Assegurar que a informação documentada seja alterada e que as pessoas pertinentes sejam avisadas da mudança.

COMO FAZER. Defina o caminho: quem recebe a alteração, quem autoriza, quem atualiza o desenho ou a ordem, e quem avisa a produção. O erro clássico é a alteração chegar por telefone ou mensagem e a fábrica continuar produzindo a versão antiga — descoberto só na expedição.

POR QUE A NORMA PEDE. Porque mudança não comunicada é a causa mais barata de prejuízo caro.

O QUE VOCÊ PRECISA TER. O registro de uma alteração real: quando chegou, quem autorizou, o que foi atualizado e quem foi avisado.'),

('8.3.1', null,
'O QUE É. Projeto e desenvolvimento é criar o produto ou serviço — não fabricá-lo conforme desenho de terceiro.

O QUE FAZER. Decidir se o requisito se aplica. Se a empresa projeta, estabelecer um processo de projeto. Se não projeta, declarar a exclusão no escopo com justificativa.

COMO FAZER. A pergunta é simples: quem define as características do produto? Se é o cliente, com desenho e especificação, a exclusão costuma ser legítima. Se a sua empresa desenvolve solução, formulação, software ou serviço sob medida, o requisito se aplica — mesmo que você chame de "engenharia de aplicação".

POR QUE A NORMA PEDE. Porque é onde a conformidade começa, e exclusão indevida derruba a certificação.

O QUE VOCÊ PRECISA TER. A decisão registrada: o processo de projeto, ou a exclusão justificada no escopo.'),

('8.3.3', null,
'O QUE É. Entradas de projeto é tudo que o projeto precisa considerar antes de começar.

O QUE FAZER. Determinar os requisitos essenciais, por escrito, antes de desenvolver.

COMO FAZER. Para cada projeto, registre: requisitos funcionais e de desempenho, requisitos legais, normas aplicáveis, experiência de projetos anteriores e as consequências potenciais de falha. Esse último item é o mais esquecido e o mais útil — pensar no que acontece se falhar muda a decisão de projeto.

POR QUE A NORMA PEDE. Porque projeto que começa sem entrada definida produz saída que ninguém consegue avaliar.

O QUE VOCÊ PRECISA TER. As entradas documentadas do projeto mais recente, com data anterior ao desenvolvimento.'),

('8.3.4', null,
'O QUE É. São os três controles do projeto, que costumam ser confundidos: análise crítica, verificação e validação.

O QUE FAZER. Aplicar os três, com registro de cada um.

COMO FAZER. Entenda a diferença e ela deixa de ser burocracia. Análise crítica é olhar o andamento e decidir se continua. Verificação é conferir se a saída atende à entrada — o desenho atende à especificação? Validação é provar que o produto funciona no uso real — o protótipo aguenta o que o cliente vai fazer com ele? Ensaio, piloto e aprovação do cliente servem como validação.

POR QUE A NORMA PEDE. Porque cada um pega um tipo diferente de erro, e pular a validação é o que leva defeito ao campo.

O QUE VOCÊ PRECISA TER. Registro separado dos três, com quem participou e o que foi decidido.'),

('8.3.5', null,
'O QUE É. Saídas de projeto é o que o projeto entrega para quem vai produzir.

O QUE FAZER. Assegurar que as saídas atendam às entradas, sejam adequadas para a produção, contenham ou referenciem critérios de aceitação e especifiquem o que é essencial para o uso seguro e correto.

COMO FAZER. Pegue a saída — desenho, especificação, receita, roteiro — e confronte item a item com a entrada registrada. Verifique se quem produz consegue trabalhar com aquilo sem perguntar nada ao projetista. Se precisar perguntar, a saída está incompleta.

POR QUE A NORMA PEDE. Porque saída incompleta transfere decisão de projeto para o chão de fábrica, onde ela é tomada no improviso.

O QUE VOCÊ PRECISA TER. A saída aprovada, com os critérios de aceitação, e a comparação com a entrada.'),

('8.3.6', null,
'O QUE É. É a mudança no projeto depois que ele já existe.

O QUE FAZER. Identificar, analisar criticamente e controlar as mudanças, retendo informação sobre elas, os resultados das análises, as autorizações e as ações para evitar efeitos adversos.

COMO FAZER. Toda alteração de desenho ou especificação passa por um registro: o que muda, por quê, o que isso afeta — ferramental, estoque, produto já entregue —, quem aprova e a partir de qual lote vale. Defina o que fazer com o material da versão antiga.

POR QUE A NORMA PEDE. Porque mudança de projeto mal controlada gera mistura de versões, que é dos defeitos mais caros de rastrear.

O QUE VOCÊ PRECISA TER. O registro de uma mudança real, com a aprovação anterior à produção e a definição do lote de início.'),

('8.4.1', null,
'O QUE É. É o controle sobre o que vem de fora: material, componente, serviço terceirizado, processo que você não faz.

O QUE FAZER. Assegurar que o que é provido externamente esteja conforme, e determinar critérios de avaliação, seleção, monitoramento e reavaliação dos provedores.

COMO FAZER. Tenha critério escrito para aprovar fornecedor, uma lista dos aprovados, e um acompanhamento do desempenho — prazo, qualidade, resposta a problema. Reavalie periodicamente. Fornecedor que entrega errado e continua na lista sem registro de tratativa é constatação certa.

POR QUE A NORMA PEDE. Porque a sua qualidade é limitada pela do que entra, e o cliente não distingue defeito seu de defeito do seu fornecedor.

O QUE VOCÊ PRECISA TER. O critério, a lista de aprovados, as avaliações e as reavaliações com data.'),

('8.4.2', null,
'O QUE É. É calibrar o rigor do controle conforme o impacto do fornecedor.

O QUE FAZER. Determinar o tipo e a extensão do controle sobre cada provedor externo e sobre o que ele entrega.

COMO FAZER. Classifique por impacto no produto final. Item crítico pede inspeção de recebimento, certificado de qualidade, às vezes auditoria no fornecedor. Item de baixo impacto pede conferência simples. Processo terceirizado que afeta a conformidade — tratamento térmico, usinagem, calibração — continua sendo sua responsabilidade, e o controle precisa refletir isso.

POR QUE A NORMA PEDE. Porque controlar tudo igual é caro e ineficaz: sobra rigor onde não precisa e falta onde importa.

O QUE VOCÊ PRECISA TER. A classificação dos fornecedores e o controle correspondente aplicado, com registros.'),

('8.4.3', null,
'O QUE É. É o que você informa ao fornecedor antes de ele produzir.

O QUE FAZER. Comunicar os requisitos: o que deve ser fornecido, aprovações necessárias, competência exigida das pessoas, interação com o sistema, controle e monitoramento aplicados, e verificação nas instalações dele quando for o caso.

COMO FAZER. Pegue o pedido de compra de um item crítico e veja se ele diz o suficiente para alguém produzir certo sem adivinhar: especificação, norma aplicável, critério de aceitação, exigência de certificado. Pedido que só traz descrição e preço transfere o risco para você.

POR QUE A NORMA PEDE. Porque fornecedor não erra só por má vontade: erra por não saber o que você espera.

O QUE VOCÊ PRECISA TER. O pedido ou contrato com os requisitos explícitos, em um caso real.'),

('8.5.1', null,
'O QUE É. É o controle da produção ou da prestação do serviço, enquanto acontece.

O QUE FAZER. Implementar a produção sob condições controladas: informação disponível, recursos de medição adequados, atividades de monitoramento nas etapas certas, infraestrutura e pessoas competentes.

COMO FAZER. No posto de trabalho tem de haver o que produzir, como produzir e qual o critério de aceitação — e precisa ser a versão vigente. Defina as etapas de verificação e quem faz. Para processo cujo resultado só aparece no uso, como solda e colagem, há exigência extra de validação do próprio processo.

POR QUE A NORMA PEDE. Porque o controle que importa é o que acontece onde o produto é feito.

O QUE VOCÊ PRECISA TER. O posto com documento vigente, e os registros de verificação das etapas definidas.'),

('8.5.2', null,
'O QUE É. Identificação é saber o que é cada coisa; rastreabilidade é saber de onde veio e para onde foi.

O QUE FAZER. Identificar as saídas quando necessário, identificar a situação em relação ao monitoramento, e controlar a identificação única quando a rastreabilidade for requisito.

COMO FAZER. O ponto que mais falha é a situação de inspeção: olhando a peça na bancada, dá para saber se ela já foi aprovada ou ainda não? Etiqueta, área demarcada ou campo no sistema resolvem. Se rastreabilidade for exigida por cliente ou lei, defina o código, onde ele é registrado e até onde você consegue voltar.

POR QUE A NORMA PEDE. Porque sem identificação o produto bom e o suspeito se misturam, e aí todo o lote vira suspeito.

O QUE VOCÊ PRECISA TER. A identificação visível no processo e, se aplicável, o teste de rastreabilidade feito de ponta a ponta.'),

('8.5.3', null,
'O QUE É. É o cuidado com o que não é seu: material, ferramenta, desenho, dado ou propriedade intelectual do cliente ou do fornecedor.

O QUE FAZER. Identificar, verificar, proteger e salvaguardar. Se algo for perdido, danificado ou considerado inadequado, informar ao proprietário e manter registro.

COMO FAZER. Liste o que está sob sua guarda e onde fica. Confira na chegada e registre. Avise o cliente por escrito quando houver problema — avisar por telefone e não registrar é o erro comum, e deixa você sem defesa depois.

POR QUE A NORMA PEDE. Porque é onde a responsabilidade legal e a comercial se encontram.

O QUE VOCÊ PRECISA TER. O controle do que está sob guarda e o registro de qualquer comunicação ao proprietário.'),

('8.5.4', null,
'O QUE É. Preservação é manter a conformidade do produto até a entrega.

O QUE FAZER. Preservar as saídas durante a produção e a entrega, na extensão necessária.

COMO FAZER. Pense no caminho da peça: identificação que não apaga, manuseio que não amassa, embalagem adequada ao transporte, armazenagem com controle de validade e de condição, e proteção contra contaminação. Olhe o estoque e a expedição — é onde o produto bom se perde depois de pronto.

POR QUE A NORMA PEDE. Porque produto aprovado na inspeção e danificado no transporte chega ao cliente como defeito seu.

O QUE VOCÊ PRECISA TER. As práticas de preservação definidas e aplicadas, e o controle do que tem validade.'),

('8.5.5', null,
'O QUE É. São as obrigações que continuam depois da entrega: garantia, manutenção, suporte, reposição, descarte.

O QUE FAZER. Atender aos requisitos de pós-entrega, considerando requisitos legais, consequências indesejáveis, vida útil, retorno do cliente e exigências contratuais.

COMO FAZER. Liste o que você deve depois de entregar — por contrato e por lei — e defina quem responde, em que prazo e com que registro. Use o retorno do campo: reclamação de garantia é a informação mais valiosa que a empresa recebe, e normalmente a mais desperdiçada.

POR QUE A NORMA PEDE. Porque a percepção do cliente se forma depois da entrega, não na entrega.

O QUE VOCÊ PRECISA TER. As obrigações mapeadas e os registros de atendimento, com prazo.'),

('8.5.6', null,
'O QUE É. É a mudança na produção ou no serviço depois que o processo já roda.

O QUE FAZER. Analisar criticamente e controlar as mudanças na extensão necessária para manter a conformidade, retendo informação sobre a análise, quem autorizou e as ações decorrentes.

COMO FAZER. Defina o gatilho: troca de matéria-prima, de ferramenta, de máquina, de parâmetro, de fornecedor, de pessoa em posto crítico. Antes de executar, alguém avalia o efeito na conformidade e autoriza. Registre a partir de qual lote vale. Mudança de parâmetro feita no turno da noite e comunicada depois é o caso clássico.

POR QUE A NORMA PEDE. Porque boa parte do defeito que "apareceu do nada" veio de uma mudança não analisada.

O QUE VOCÊ PRECISA TER. O registro de uma mudança real, com autorização anterior à execução.'),

('8.6', null,
'O QUE É. É a hora de decidir se o produto pode sair.

O QUE FAZER. Implementar as verificações planejadas e não liberar ao cliente antes de concluí-las satisfatoriamente, salvo aprovação de autoridade pertinente — e, quando aplicável, do cliente. Manter evidência de conformidade e de quem autorizou.

COMO FAZER. Defina as verificações e onde acontecem. O registro de liberação tem de dizer quem autorizou — nome, não setor. Se existir liberação excepcional antes da conclusão, ela precisa de autoridade definida e registro, e de rastreabilidade para recolher se der errado.

POR QUE A NORMA PEDE. Porque é o último ponto em que o erro ainda é barato.

O QUE VOCÊ PRECISA TER. O registro de liberação de uma entrega recente, com a pessoa que autorizou e a evidência dos critérios atendidos.'),

('8.7', null,
'O QUE É. É o que fazer com o que saiu errado, antes que chegue ao cliente.

O QUE FAZER. Identificar e controlar as saídas não conformes para impedir uso ou entrega não pretendidos; tratar por correção, segregação, contenção, devolução, suspensão ou concessão; verificar de novo após a correção; e reter registro.

COMO FAZER. Tenha área ou identificação clara para produto suspeito — e que ela seja respeitada. Defina quem decide o destino. Se houver concessão, ela precisa de autoridade e, quando o requisito é do cliente, da aprovação dele. Reinspeção depois do retrabalho não é opcional.

POR QUE A NORMA PEDE. Porque produto não conforme sem controle volta para a linha por engano — e é assim que ele chega ao cliente.

O QUE VOCÊ PRECISA TER. O registro de casos reais: o que era, quem decidiu, qual o destino, e a reinspeção quando houve retrabalho.'),

('9.1.1', null,
'O QUE É. É medir o que importa, com método.

O QUE FAZER. Determinar o que precisa ser monitorado e medido, os métodos, quando medir e quando analisar e avaliar os resultados.

COMO FAZER. Escolha poucos indicadores ligados aos processos do seu mapa: entrega no prazo, refugo, retrabalho, não conformidades por origem, desempenho de fornecedor, reclamações. Para cada um, defina a fórmula e a frequência. Indicador sem fórmula escrita dá número diferente a cada mês, dependendo de quem calcula.

POR QUE A NORMA PEDE. Porque sem medida a empresa discute opinião, e opinião não melhora processo.

O QUE VOCÊ PRECISA TER. A lista do que é medido com método e frequência, e os resultados ao longo do tempo.'),

('9.1.2', null,
'O QUE É. É saber como o cliente percebe o que você entrega — não como você acha que ele percebe.

O QUE FAZER. Monitorar a percepção do cliente e determinar os métodos para obter, monitorar e analisar essa informação.

COMO FAZER. Não precisa de pesquisa elaborada. Vale pesquisa simples, conversa estruturada na entrega, análise de reclamações e devoluções, índice de recompra, elogio registrado. Combine pelo menos duas fontes: só pesquisa dá uma visão otimista, só reclamação dá uma visão pessimista.

POR QUE A NORMA PEDE. Porque qualidade é o que o cliente percebe, e empresa que não pergunta descobre tarde.

O QUE VOCÊ PRECISA TER. O método definido, os dados coletados e o que foi feito a partir deles.'),

('9.1.3', null,
'O QUE É. É transformar número em decisão.

O QUE FAZER. Analisar e avaliar os dados para verificar conformidade, grau de satisfação, desempenho do sistema e dos processos, eficácia do planejamento e das ações sobre riscos, desempenho de fornecedores e necessidade de melhoria.

COMO FAZER. Olhe tendência, não o mês isolado. Cruze indicadores: refugo subindo junto com fornecedor novo diz mais que os dois separados. E termine toda análise com uma frase do tipo "por isso vamos fazer X" — análise que não gera decisão é relatório.

POR QUE A NORMA PEDE. Porque coletar dado sem analisar é custo sem retorno.

O QUE VOCÊ PRECISA TER. A análise registrada, com as conclusões e as decisões que saíram dela.'),

('9.2', null,
'O QUE É. Auditoria interna é a empresa se olhar no espelho antes do auditor externo.

O QUE FAZER. Realizar auditorias em intervalos planejados, com programa que considere a importância dos processos e os resultados anteriores; definir critérios e escopo; selecionar auditores que garantam imparcialidade; reportar à direção; e corrigir o que for encontrado sem demora.

COMO FAZER. Monte o programa do ano em janeiro, com datas reservadas. Audite mais o que é mais crítico ou o que foi mal da última vez. Auditor não audita o próprio trabalho — se a empresa tem uma pessoa só da qualidade, traga alguém de fora para auditar a área dela.

POR QUE A NORMA PEDE. Porque é mais barato achar o problema você mesmo. Auditoria que nunca acha nada não é elogio.

O QUE VOCÊ PRECISA TER. O programa, os relatórios, as constatações tratadas e a evidência de que o resultado chegou à direção.'),

('9.3', null,
'O QUE É. É a direção parar para olhar o sistema inteiro e decidir.

O QUE FAZER. Analisar criticamente em intervalos planejados, com as entradas exigidas, e registrar as saídas.

COMO FAZER. Leve dados, não impressões: situação das ações anteriores, mudanças no contexto, desempenho dos indicadores e da satisfação do cliente, não conformidades, resultados de auditoria, desempenho de fornecedores, adequação de recursos, eficácia das ações sobre riscos e oportunidades, e oportunidades de melhoria. Saia com decisões: o que muda, quem faz, até quando, com que recurso.

POR QUE A NORMA PEDE. Porque sem esse momento o sistema vira rotina de um setor e nunca é corrigido de cima.

O QUE VOCÊ PRECISA TER. A ata com as entradas analisadas, os dados apresentados e as decisões com responsável e prazo. Reunião sem decisão registrada não conta.'),

('10.1', null,
'O QUE É. É melhorar por iniciativa própria, e não só corrigir o que deu errado.

O QUE FAZER. Determinar e selecionar oportunidades de melhoria e implementar as ações necessárias para atender aos requisitos do cliente e aumentar a satisfação dele.

COMO FAZER. Melhoria aqui é ampla: melhorar o produto para atender necessidade futura, corrigir e prevenir efeito indesejável, e melhorar o desempenho do sistema. Procure onde ninguém reclamou ainda — etapa que só gera retrabalho, conferência manual que dá para automatizar, reclamação recorrente que pede mudança no produto, não só no processo.

POR QUE A NORMA PEDE. Porque sistema que só reage está sempre atrás do problema.

O QUE VOCÊ PRECISA TER. Pelo menos uma melhoria do período que não nasceu de uma não conformidade. É a que falta em quase toda empresa.'),

('10.2', 'registro',
'O QUE É. Não conformidade é tudo que não atendeu: produto, processo, requisito do cliente ou do sistema. Inclui reclamação.

O QUE FAZER. Reagir, controlar e corrigir; lidar com as consequências; e avaliar a necessidade de ação para eliminar a causa, para que não se repita.

COMO FAZER. Registre o fato, não a opinião: o que foi encontrado, onde, quando, por quem, em que quantidade. Tome a correção imediata e anote. Depois vem a parte que a norma cobra e muita empresa pula: avaliar se precisa de ação corretiva. Nem toda não conformidade exige — mas a decisão precisa ser consciente e registrada, não esquecida.

POR QUE A NORMA PEDE. Porque corrigir sem olhar a causa faz o mesmo problema voltar com outro número.

O QUE VOCÊ PRECISA TER. O registro com o fato, a correção, a avaliação da necessidade de ação corretiva e a decisão tomada.'),

('10.2', 'eficacia',
'O QUE É. É voltar depois para ver se a ação resolveu de verdade.

O QUE FAZER. Analisar criticamente a eficácia da ação corretiva, atualizar riscos e oportunidades se necessário, e alterar o sistema se necessário.

COMO FAZER. Marque a verificação para algumas semanas depois do prazo. Olhe o indicador que a não conformidade afetava e veja se o número mudou — não pergunte apenas se a ação foi feita. Se não foi eficaz, não feche: defina nova ação. E se a causa revelou um risco que não estava mapeado, atualize o 6.1.

POR QUE A NORMA PEDE. Porque fechar sem verificar é arquivar o problema, e a reincidência é o que o auditor externo cruza com os seus registros.

O QUE VOCÊ PRECISA TER. O registro da verificação com data, como foi verificada e a conclusão — e a atualização dos riscos quando couber.')

    ) as p(req, marca, texto)
   where i.modelo_id = v_modelo
     and i.requisito = p.req
     and (
       p.marca is null
       or (p.marca = 'clima'    and i.pergunta ilike '%climátic%')
       or (p.marca = 'contexto' and i.requisito = '4.1' and i.pergunta not ilike '%climátic%')
       or (p.marca = 'registro' and i.pergunta ilike '%não conformidades são registradas%')
       or (p.marca = 'eficacia' and i.pergunta ilike '%eficácia das ações corretivas%')
     );
end
$$;


-- ---------- Conferência -------------------------------------------------
select m.nome,
       count(*)                        as itens,
       count(i.prescricao)             as com_prescricao,
       count(*) - count(i.prescricao)  as sem_prescricao
  from public.inspecao_modelos m
  join public.inspecao_modelo_itens i on i.modelo_id = m.id
 where m.empresa_id is null and m.tipo = 'auditoria'
 group by m.nome
 order by m.nome;
