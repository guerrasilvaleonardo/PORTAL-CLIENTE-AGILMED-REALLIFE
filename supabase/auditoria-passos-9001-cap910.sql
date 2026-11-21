-- =====================================================================
-- Os passos dos capítulos 9 e 10 da ISO 9001:2026 — Avaliação de
-- desempenho e Melhoria. Oito requisitos, e fecha a 9001.
--
-- É aqui que a certificadora descobre se o sistema está vivo ou se foi
-- montado para a auditoria. Indicador sem análise, ação corretiva sem
-- causa e análise crítica sem decisão são as três constatações mais
-- frequentes de uma primeira certificação.
--
-- O 9.2 AUDITA A PRÓPRIA AUDITORIA. Quando o cliente usa este portal,
-- a evidência é a auditoria anterior registrada aqui — por isso o
-- passo manda abrir o relatório emitido em vez de pedir um documento
-- solto.
--
-- Depende de supabase/auditoria-passos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(req, passos) as (
  values
    ('9.1.1'::text, array[
      'Peça a lista do que a empresa mede e com que frequência;',
      'Confira se os indicadores dos processos existem de fato e têm número recente;',
      'Pergunte quem olha esses números e o que já mudou por causa deles;',
      'Indicador atualizado que ninguém usa é tão ruim quanto indicador que não existe;',
      'Suba a planilha de indicadores.'
    ]::text[]),

    ('9.1.2', array[
      'Pergunte como a empresa mede a percepção do cliente;',
      'Peça o resultado da última coleta, qualquer que seja o método — pesquisa, reclamação, devolução, conversa registrada;',
      'Confira se o resultado foi analisado e levado à direção;',
      'Veja se alguma ação nasceu dali;',
      'Suba o método e o último resultado.'
    ]::text[]),

    ('9.1.3', array[
      'Peça a análise dos dados: não os números crus, mas o que a empresa concluiu deles;',
      'Confira se a análise cobre conformidade do produto, satisfação do cliente, desempenho dos processos e dos fornecedores;',
      'Procure tendência, não só o número do mês — três meses piorando sem ninguém notar é a evidência típica de que não há análise;',
      'Veja onde essa análise entra na reunião da direção;',
      'Suba o documento da análise.'
    ]::text[]),

    ('9.2', array[
      'Peça o programa de auditoria interna do ano e confira se ele cobre todos os processos e requisitos;',
      'Abra o relatório da última auditoria interna realizada;',
      'Confira se o auditor era independente da área auditada — ninguém audita o próprio trabalho;',
      'Veja se as constatações daquela auditoria foram tratadas, e não só listadas;',
      'Suba o programa e o último relatório.'
    ]::text[]),

    ('9.3', array[
      'Peça a ata da última análise crítica pela direção;',
      'Confira se a pauta cobriu todos os tópicos que a norma pede — ações anteriores, mudanças no contexto, desempenho, recursos, riscos, melhoria;',
      'Procure DECISÕES com responsável e prazo: ata sem decisão não é análise crítica;',
      'Confira se as decisões da ata anterior foram cumpridas;',
      'Suba a ata.'
    ]::text[]),

    ('10.1', array[
      'Pergunte o que a empresa melhorou no último ano por iniciativa própria, sem ser por problema;',
      'Peça a evidência de duas dessas melhorias;',
      'Confira se há algum canal pelo qual quem trabalha sugere melhoria, e se alguma sugestão virou ação;',
      'Suba os registros das melhorias.'
    ]::text[]),

    ('10.2', array[
      'Peça as não conformidades registradas no último ano;',
      'Escolha duas encerradas e leia a causa: "falha humana" e "falta de atenção" não são causa, são o fim da investigação;',
      'Confira se a ação corretiva ataca a causa, e não o sintoma;',
      'Veja se a eficácia foi verificada depois, com prazo e registro;',
      'Procure não conformidade que se repetiu — é o sinal de que a causa não foi encontrada;',
      'Suba os registros das duas que você analisou.'
    ]::text[])
)
update public.inspecao_modelo_itens i
   set passos = d.passos
  from dados d
  join public.inspecao_modelos m
    on m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 9001'
 where i.modelo_id = m.id
   and i.requisito = d.req;


-- ---------- Conferência -------------------------------------------------
select i.requisito, coalesce(array_length(i.passos, 1), 0) as passos
  from public.inspecao_modelo_itens i
  join public.inspecao_modelos m on m.id = i.modelo_id
 where m.empresa_id is null and m.tipo = 'auditoria'
   and m.nome = 'Auditoria interna — ISO 9001'
   and coalesce(array_length(i.passos, 1), 0) = 0
 order by i.ordem;
