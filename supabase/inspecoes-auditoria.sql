-- =====================================================================
-- Checklists de auditoria de sistema de gestão.
--
-- ANTES:  os modelos da casa cobriam o chão de fábrica — canteiro,
--         altura, máquinas, extintores. Nada para auditar o SISTEMA:
--         se a empresa faz o que o próprio sistema dela manda fazer.
-- DEPOIS: dois modelos de auditoria interna, um por norma, com as
--         perguntas na ordem dos requisitos (seções 4 a 10).
-- MOTIVO: pedido dele em 20/11/2026, com as normas abertas no catálogo
--         da ABNT via CONFEA.
--
-- AS NORMAS QUE SUSTENTAM ISTO:
--   ABNT NBR ISO 45001:2024 — requisitos de SSO
--   ABNT NBR ISO 9001:2026  — requisitos de qualidade (4ª edição)
--   ABNT NBR ISO 19011:2018 — como conduzir a auditoria
--   ABNT NBR ISO 45002:2025 — orientação para implantar a 45001
--
-- O TEXTO É NOSSO, A NUMERAÇÃO É REFERÊNCIA. Cada pergunta cita o item
-- ("9.2 — Auditoria interna") para o auditor achar o requisito, mas é
-- escrita na linguagem de quem vai responder. Nada transcreve norma, que
-- é conteúdo vendido pela ABNT.
--
-- COMO AS PERGUNTAS FORAM ESCRITAS. Auditoria se faz com evidência
-- objetiva, não com opinião (ISO 19011, 6.4.7). Por isso toda pergunta
-- aponta para algo que se pede para ver: um registro, uma ata, uma
-- lista, uma assinatura. "A liderança demonstra comprometimento?" não
-- se audita; "a direção analisou criticamente o sistema no último ano,
-- com ata?" se audita.
--
-- A NUMERAÇÃO DA 9001 É A DE 2026, não a de 2015: o capítulo 10 foi
-- enxugado, 10.1 passou a ser "Melhoria contínua" e 10.2 "Não
-- conformidade e ação corretiva". Checklist com a numeração antiga
-- nasce errado.
--
-- Depende de supabase/inspecoes.sql.
-- Não duplica: modelo que já existe é pulado inteiro.
-- =====================================================================

do $$
declare
  v_modelo uuid;
begin
  if to_regclass('public.inspecao_modelos') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;

  -- ================================================================
  -- Auditoria interna — ISO 45001 (SSO)
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Auditoria interna — ISO 45001';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Auditoria interna — ISO 45001', 'ABNT NBR ISO 45001:2024',
            'Auditoria do sistema de gestão de SSO, na ordem dos requisitos. Peça a evidência de cada item.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta, orientacao) values
      (v_modelo,  1, '4 Contexto', 'A organização tem registrado quais questões internas e externas afetam o sistema de SSO?', 'Peça o documento onde isso está escrito e veja se foi revisto no último ano.'),
      (v_modelo,  2, '4 Contexto', 'As partes interessadas e o que elas exigem estão identificadas, inclusive os requisitos legais?', 'Lista de partes interessadas e de requisitos legais aplicáveis.'),
      (v_modelo,  3, '4 Contexto', 'O escopo do sistema está definido por escrito e disponível?', 'Confirme se o escopo bate com o que a empresa realmente faz.'),
      (v_modelo,  4, '5 Liderança', 'A direção participa do sistema de forma demonstrável, e não só no papel?', 'Atas, decisões tomadas, recursos liberados.'),
      (v_modelo,  5, '5 Liderança', 'Existe política de SSO assinada pela direção e conhecida pelos trabalhadores?', 'Pergunte a dois trabalhadores o que a política diz.'),
      (v_modelo,  6, '5 Liderança', 'Os papéis e responsabilidades de SSO estão atribuídos por escrito?', 'Organograma, descrições de função, designações.'),
      (v_modelo,  7, '5 Liderança', 'Há consulta e participação dos trabalhadores, com registro?', 'CIPA, reuniões, caixa de sugestões, atas.'),
      (v_modelo,  8, '6 Planejamento', 'Os perigos foram identificados com participação de quem faz o trabalho?', 'Veja se o inventário cobre as atividades que estão acontecendo hoje.'),
      (v_modelo,  9, '6 Planejamento', 'Os riscos foram avaliados por um critério escrito, e não no olho?', 'Matriz de risco ou método equivalente, documentado.'),
      (v_modelo, 10, '6 Planejamento', 'Os controles seguem a hierarquia — eliminar antes de proteger, proteger antes de EPI?', 'Procure caso em que se foi direto ao EPI sem tentar o resto.'),
      (v_modelo, 11, '6 Planejamento', 'Os requisitos legais aplicáveis estão listados e atualizados?', 'Pergunte quando foi a última atualização e quem faz.'),
      (v_modelo, 12, '6 Planejamento', 'Existem objetivos de SSO com prazo, responsável e forma de medir?', 'Objetivo sem número e sem dono não é objetivo.'),
      (v_modelo, 13, '7 Apoio', 'Os recursos necessários ao sistema foram providenciados?', 'Pessoas, tempo, orçamento, equipamento.'),
      (v_modelo, 14, '7 Apoio', 'A competência exigida para cada função está definida, e há registro de que foi atingida?', 'Certificados, treinamentos, avaliação prática.'),
      (v_modelo, 15, '7 Apoio', 'Os trabalhadores estão conscientes dos riscos da função e do que fazer em emergência?', 'Pergunte a quem está no posto, não ao gestor.'),
      (v_modelo, 16, '7 Apoio', 'A comunicação de SSO — interna e externa — está definida e acontece?', 'DDS, quadros, e-mails, canal para comunicar perigo.'),
      (v_modelo, 17, '7 Apoio', 'A informação documentada está controlada: versão vigente, acesso e guarda?', 'Procure documento vencido ainda em uso no posto.'),
      (v_modelo, 18, '8 Operação', 'Os controles operacionais estão implementados onde o planejamento previu?', 'Vá ao local e compare com o que está escrito.'),
      (v_modelo, 19, '8 Operação', 'Há processo para gerir mudança antes de ela acontecer?', 'Mudança de máquina, de processo, de pessoal.'),
      (v_modelo, 20, '8 Operação', 'Os contratados e terceiros estão dentro do sistema, com requisitos de SSO contratuais?', 'Contratos, integração, documentação exigida.'),
      (v_modelo, 21, '8 Operação', 'O plano de emergência existe, foi testado e as pessoas sabem o que fazer?', 'Registro do último simulado e o que ele revelou.'),
      (v_modelo, 22, '9 Avaliação', 'O desempenho de SSO é monitorado e medido com indicadores definidos?', 'Quais números, quem acompanha, com que frequência.'),
      (v_modelo, 23, '9 Avaliação', 'A conformidade legal é avaliada periodicamente, com registro?', '9.1.2 — Avaliação do compliance.'),
      (v_modelo, 24, '9 Avaliação', 'Existe programa de auditoria interna, com frequência e critérios definidos?', '9.2.2 — Programa de auditoria interna.'),
      (v_modelo, 25, '9 Avaliação', 'As auditorias internas foram realizadas conforme o programa, e os resultados chegaram à direção?', 'Relatórios das últimas auditorias.'),
      (v_modelo, 26, '9 Avaliação', 'A direção analisou criticamente o sistema no período definido, com ata e decisões?', '9.3 — Análise crítica pela Direção.'),
      (v_modelo, 27, '10 Melhoria', 'Incidentes e não conformidades são registrados, investigados e tratados?', '10.2 — inclui incidente, não só não conformidade.'),
      (v_modelo, 28, '10 Melhoria', 'A causa é investigada além do óbvio, e a ação corretiva ataca a causa?', 'Procure ação corretiva que seja só "orientar o colaborador".'),
      (v_modelo, 29, '10 Melhoria', 'A eficácia das ações corretivas é verificada depois?', 'Veja se alguma não conformidade voltou a acontecer.'),
      (v_modelo, 30, '10 Melhoria', 'Há evidência de melhoria contínua do sistema, e não só de correções pontuais?', '10.3 — o que mudou no sistema no último ano.');
  end if;

  -- ================================================================
  -- Auditoria interna — ISO 9001 (qualidade)
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Auditoria interna — ISO 9001';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Auditoria interna — ISO 9001', 'ABNT NBR ISO 9001:2026',
            'Auditoria do sistema de gestão da qualidade, na ordem dos requisitos da 4ª edição.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta, orientacao) values
      (v_modelo,  1, '4 Contexto', 'As questões internas e externas que afetam a qualidade estão identificadas e revistas?', 'Documento e data da última revisão.'),
      (v_modelo,  2, '4 Contexto', 'As partes interessadas e seus requisitos estão determinados?', 'Clientes, fornecedores, órgãos reguladores.'),
      (v_modelo,  3, '4 Contexto', 'O escopo do sistema está documentado, com as exclusões justificadas?', 'Exclusão sem justificativa é não conformidade.'),
      (v_modelo,  4, '4 Contexto', 'Os processos do sistema estão mapeados, com entradas, saídas e responsáveis?', 'Peça o mapa de processos e siga um do início ao fim.'),
      (v_modelo,  5, '5 Liderança', 'A direção demonstra liderança sobre o sistema, com decisões registradas?', 'Atas, metas definidas, recursos liberados.'),
      (v_modelo,  6, '5 Liderança', 'A política da qualidade está documentada, comunicada e é entendida?', 'Pergunte a quem executa, não a quem escreveu.'),
      (v_modelo,  7, '5 Liderança', 'O foco no cliente se traduz em algo medido?', 'Satisfação, reclamações, prazo de entrega.'),
      (v_modelo,  8, '6 Planejamento', 'Riscos e oportunidades foram determinados, com ações definidas para eles?', 'Ação sem responsável e prazo não conta.'),
      (v_modelo,  9, '6 Planejamento', 'Os objetivos da qualidade são mensuráveis e têm plano para alcançá-los?', 'O que, quem, quando, com que recurso.'),
      (v_modelo, 10, '6 Planejamento', 'As mudanças no sistema são planejadas antes de acontecer?', '6.3 — Planejamento de mudanças.'),
      (v_modelo, 11, '7 Apoio', 'Os recursos, inclusive pessoas e infraestrutura, são suficientes e estão disponíveis?', 'Veja se falta alguma coisa que já causou atraso.'),
      (v_modelo, 12, '7 Apoio', 'Os equipamentos de medição estão calibrados e identificados?', 'Certificado de calibração dentro da validade.'),
      (v_modelo, 13, '7 Apoio', 'A competência das pessoas que afetam a qualidade está definida e evidenciada?', 'Matriz de competência e os registros dela.'),
      (v_modelo, 14, '7 Apoio', 'A informação documentada está sob controle — versão, acesso, guarda e descarte?', 'Procure procedimento vencido em uso.'),
      (v_modelo, 15, '8 Operação', 'Os requisitos do produto ou serviço são analisados criticamente antes de assumir o compromisso?', '8.2.3 — antes de aceitar o pedido.'),
      (v_modelo, 16, '8 Operação', 'As mudanças de requisito são comunicadas a quem precisa saber?', '8.2.4.'),
      (v_modelo, 17, '8 Operação', 'Os fornecedores externos são avaliados por critério definido, com registro?', '8.4 — inclusive processos terceirizados.'),
      (v_modelo, 18, '8 Operação', 'A produção ou a prestação do serviço é controlada conforme o planejado?', 'Instruções no posto, controle em operação.'),
      (v_modelo, 19, '8 Operação', 'Existe identificação e rastreabilidade quando é exigida?', '8.5.2.'),
      (v_modelo, 20, '8 Operação', 'A propriedade do cliente é protegida e, se danificada, ele é avisado?', '8.5.3.'),
      (v_modelo, 21, '8 Operação', 'As saídas não conformes são identificadas e tratadas antes de chegar ao cliente?', '8.7 — e o registro do que foi feito.'),
      (v_modelo, 22, '9 Avaliação', 'O que precisa ser monitorado e medido está definido, e os dados são analisados?', '9.1.1 e 9.1.3.'),
      (v_modelo, 23, '9 Avaliação', 'A satisfação do cliente é acompanhada por algum método definido?', '9.1.2 — pesquisa, reclamação, devolução.'),
      (v_modelo, 24, '9 Avaliação', 'Existe programa de auditoria interna e ele foi cumprido?', '9.2.2.'),
      (v_modelo, 25, '9 Avaliação', 'A análise crítica pela direção aconteceu, com as entradas exigidas e saídas registradas?', '9.3.2 e 9.3.3 — veja a ata.'),
      (v_modelo, 26, '10 Melhoria', 'A empresa busca melhoria contínua de forma demonstrável?', '10.1 — na 4ª edição, 10.1 é melhoria contínua.'),
      (v_modelo, 27, '10 Melhoria', 'As não conformidades são registradas, com correção e avaliação da necessidade de ação corretiva?', '10.2.'),
      (v_modelo, 28, '10 Melhoria', 'A eficácia das ações corretivas é verificada e os registros mantidos?', '10.2 — procure a verificação, não só a ação.');
  end if;
end
$$;


-- ---------- Conferência -------------------------------------------------
select m.nome, m.norma, count(i.id) as perguntas
  from public.inspecao_modelos m
  left join public.inspecao_modelo_itens i on i.modelo_id = m.id and i.ativo
 where m.empresa_id is null
 group by m.nome, m.norma
 order by m.nome;
