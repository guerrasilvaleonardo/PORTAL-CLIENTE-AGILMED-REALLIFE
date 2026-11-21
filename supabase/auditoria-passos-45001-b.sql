-- =====================================================================
-- Os passos da ISO 45001:2024 — capítulos 7 a 10, e fecha a norma.
--
-- O 8.1.2 É O CORAÇÃO DA 45001. A hierarquia de controles diz que
-- eliminar vem antes de substituir, que vem antes de controle de
-- engenharia, que vem antes de administrativo, e EPI é o último
-- recurso. Empresa que resolve tudo com EPI e procedimento inverteu a
-- hierarquia — e isso se vê no local, não no documento.
--
-- O 10.2 TAMBÉM COBRE INCIDENTE, e não só não conformidade. Quase-
-- acidente não investigado é a evidência mais clara de que o sistema
-- só reage a sangue.
--
-- A 45001:2024 MANTÉM O 10.3 (melhoria contínua), que a 9001 na 4ª
-- edição não tem mais.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(req, passos) as (
  values
    ('7.1'::text, array[
      'Pergunte a quem conduz o sistema o que falta para ele funcionar: gente, hora, equipamento, medição;',
      'Procure o registro dessa necessidade levada à direção e o que foi decidido;',
      'Suba o registro.'
    ]::text[]),

    ('7.2', array[
      'Abra a matriz de competência e escolha três funções de risco;',
      'Confira a comprovação de cada pessoa — inclusive treinamentos de NR com validade;',
      'Veja se há alguém executando atividade de risco com treinamento vencido: é constatação imediata;',
      'Confira se a eficácia do treinamento foi avaliada, e não só a presença;',
      'Suba a matriz e os comprovantes.'
    ]::text[]),

    ('7.3', array[
      'Vá ao local e pergunte a duas ou três pessoas quais são os perigos do trabalho delas;',
      'Pergunte o que elas fazem se perceberem uma situação de perigo iminente, e se já pararam algum trabalho por isso;',
      'Confira se elas sabem que podem se afastar de situação de perigo sem punição — a norma exige isso;',
      'Resposta hesitante aqui vale mais que qualquer lista de presença;',
      'Suba o registro das conversas.'
    ]::text[]),

    ('7.4', array[
      'Abra o plano de comunicação de SSO;',
      'Confira se descreve o que de fato acontece: DDS, quadro, reunião de CIPA, alerta de incidente;',
      'Procure a evidência de dois canais no último mês;',
      'Veja se a comunicação chega a contratados e visitantes;',
      'Suba o plano e as evidências.'
    ]::text[]),

    ('7.5', array[
      'Abra a lista mestra dos documentos de SSO;',
      'Escolha três e confira se a versão em uso no local é a mesma da lista;',
      'Confira PGR, PCMSO e laudos: estão vigentes?',
      'Procure procedimento antigo ainda afixado na parede;',
      'Suba a lista e os documentos conferidos.'
    ]::text[]),

    ('8.1.1', array[
      'Escolha a atividade de maior risco e vá ao local;',
      'Confira se o controle definido no documento está instalado e em uso;',
      'Pergunte a quem executa como ele sabe que pode começar o trabalho;',
      'Confira se há critério para interromper a atividade;',
      'Suba o procedimento e fotos do controle instalado.'
    ]::text[]),

    ('8.1.2', array[
      'Para os três maiores riscos, pergunte: foi possível ELIMINAR o perigo? Por que não?',
      'Confira se houve tentativa de substituir por algo menos perigoso;',
      'Veja se existe controle de engenharia — proteção, enclausuramento, exaustão, guarda-corpo;',
      'Só depois disso confira o administrativo e o EPI;',
      'Empresa que resolve tudo com EPI e procedimento inverteu a hierarquia: registre isso;',
      'Suba a análise com fotos do que está instalado.'
    ]::text[]),

    ('8.1.3', array[
      'Pergunte que mudanças houve: máquina nova, layout, produto, turno, terceiro novo;',
      'Para cada uma, procure a análise de risco feita ANTES da mudança;',
      'Confira se os perigos novos entraram no levantamento;',
      'Mudança analisada depois do acidente é o padrão que este requisito existe para quebrar;',
      'Suba as análises.'
    ]::text[]),

    ('8.1.4', array[
      'Peça a lista de contratados e terceiros que trabalham na empresa;',
      'Confira que critérios de SSO foram exigidos na contratação;',
      'Vá ao local e veja se o terceiro segue as mesmas regras do próprio pessoal;',
      'Confira se a empresa verifica a documentação de segurança dele periodicamente;',
      'Suba os critérios e a verificação.'
    ]::text[]),

    ('8.2', array[
      'Abra o plano de emergência e confira se cobre os cenários reais da operação;',
      'Peça o registro do último simulado: quando foi, quem participou, o que falhou;',
      'Pergunte a duas pessoas no local o que elas fazem se houver emergência agora;',
      'Confira extintores, saídas, brigada e primeiros socorros no próprio local;',
      'Simulado que nunca aponta falha costuma ser simulado combinado;',
      'Suba o plano e o registro do simulado.'
    ]::text[]),

    ('9.1.1', array[
      'Peça os indicadores de SSO e confira se há proativos, e não só taxa de acidente;',
      'Veja quem analisa e com que frequência;',
      'Pergunte o que mudou por causa de algum indicador;',
      'Suba a planilha.'
    ]::text[]),

    ('9.1.2', array[
      'Peça a última avaliação de conformidade legal;',
      'Confira se ela percorre a lista de requisitos legais item a item;',
      'Escolha dois itens avaliados como conformes e verifique no local;',
      'Veja se os desvios encontrados viraram ação com prazo;',
      'Suba a avaliação.'
    ]::text[]),

    ('9.2.1', array[
      'Abra o relatório da última auditoria interna de SSO;',
      'Confira se o auditor era independente da área auditada;',
      'Veja se as constatações foram tratadas, e não só listadas;',
      'Confira se o resultado foi comunicado aos trabalhadores, como a norma pede;',
      'Suba o relatório.'
    ]::text[]),

    ('9.2.2', array[
      'Peça o programa de auditoria interna do ano;',
      'Confira se a frequência considera a importância e o risco de cada processo;',
      'Veja se o que foi programado está sendo cumprido;',
      'Suba o programa.'
    ]::text[]),

    ('9.3', array[
      'Peça a ata da última análise crítica pela direção;',
      'Confira se a pauta cobriu incidentes, resultados de participação e consulta, riscos, conformidade legal e desempenho;',
      'Procure decisões com responsável e prazo;',
      'Confira se as decisões da ata anterior foram cumpridas;',
      'Suba a ata.'
    ]::text[]),

    ('10.1', array[
      'Pergunte o que a empresa melhorou em segurança por iniciativa própria, sem ser depois de acidente;',
      'Peça a evidência de duas melhorias;',
      'Confira se alguma veio de sugestão de trabalhador;',
      'Suba os registros.'
    ]::text[]),

    ('10.2', array[
      'Peça os registros de incidentes e não conformidades do último ano;',
      'Confira se quase-acidentes aparecem — só acidente com afastamento registrado é sinal de que o sistema só reage a sangue;',
      'Escolha dois e leia a causa: "falta de atenção" não é causa;',
      'Confira se a ação atacou a causa e se a eficácia foi verificada;',
      'Veja se os trabalhadores participaram da investigação, como a norma exige;',
      'Suba os registros analisados.'
    ]::text[]),

    ('10.3', array[
      'Pergunte como a empresa demonstra que o desempenho de SSO está melhorando ao longo do tempo;',
      'Compare os indicadores dos últimos dois anos;',
      'Confira se a melhoria é atribuída a alguma ação concreta, e não ao acaso;',
      'Suba a comparação.'
    ]::text[])
)
update public.inspecao_modelo_itens i
   set passos = d.passos
  from dados d
  join public.inspecao_modelos m
    on m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 45001'
 where i.modelo_id = m.id
   and i.requisito = d.req;


-- ---------- Conferência -------------------------------------------------
select m.nome, count(*) as itens,
       count(*) filter (where array_length(i.passos, 1) > 0) as com_passos
  from public.inspecao_modelos m
  join public.inspecao_modelo_itens i on i.modelo_id = m.id
 where m.empresa_id is null and m.tipo = 'auditoria'
 group by m.nome
 order by m.nome;
