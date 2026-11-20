-- =====================================================================
-- Modelo de checklist: Espaço confinado (NR-33).
--
-- ANTES:  os seis modelos da casa cobriam o canteiro, a altura, as
--         máquinas e a rotina. Faltava o espaço confinado.
-- DEPOIS: sétimo modelo da casa, no formato da permissão de entrada e
--         trabalho.
-- MOTIVO: pedido dele em 20/11/2026. E é onde o erro custa mais caro:
--         entrada em espaço confinado é das poucas atividades em que a
--         falha não dá segunda chance, e em que o socorro improvisado
--         costuma matar mais que o acidente inicial.
--
-- POR QUE AS PERGUNTAS SEGUEM A ORDEM DA ENTRADA. Primeiro o que
-- autoriza, depois o que isola, depois a atmosfera, depois quem está
-- lá — é a ordem em que as coisas têm de acontecer. Checklist fora de
-- ordem vira conferência de papel depois que a pessoa já desceu.
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

  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Espaço confinado';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Espaço confinado', 'NR-33',
            'Antes de entrar: autorização, bloqueio, atmosfera, vigia e plano de resgate.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta) values
      (v_modelo,  1, 'Autorização', 'Existe Permissão de Entrada e Trabalho emitida e assinada para este espaço e esta data?'),
      (v_modelo,  2, 'Autorização', 'O supervisor de entrada designado liberou o serviço?'),
      (v_modelo,  3, 'Autorização', 'A análise de risco foi feita para esta entrada e para as tarefas previstas?'),
      (v_modelo,  4, 'Identificação', 'O espaço está identificado e sinalizado contra entrada não autorizada?'),
      (v_modelo,  5, 'Isolamento', 'As energias e os acionamentos que chegam ao espaço estão bloqueados e etiquetados?'),
      (v_modelo,  6, 'Isolamento', 'As linhas de líquido, gás e vapor foram isoladas, drenadas ou raquetadas?'),
      (v_modelo,  7, 'Atmosfera',  'A atmosfera foi medida antes da entrada, com equipamento calibrado e dentro da validade?'),
      (v_modelo,  8, 'Atmosfera',  'Oxigênio, gases inflamáveis e tóxicos estão dentro dos limites aceitáveis para entrar?'),
      (v_modelo,  9, 'Atmosfera',  'A medição continua sendo feita durante todo o trabalho?'),
      (v_modelo, 10, 'Atmosfera',  'A ventilação está funcionando e permanece ligada enquanto houver gente dentro?'),
      (v_modelo, 11, 'Pessoas',    'Os trabalhadores autorizados têm capacitação de espaço confinado dentro da validade?'),
      (v_modelo, 12, 'Pessoas',    'Há vigia permanente do lado de fora, sem nenhuma outra tarefa?'),
      (v_modelo, 13, 'Pessoas',    'Existe comunicação contínua entre o vigia e quem está dentro?'),
      (v_modelo, 14, 'Pessoas',    'O controle de entrada e saída das pessoas está sendo preenchido?'),
      (v_modelo, 15, 'Equipamento','Cinto, talabarte, tripé e sistema de içamento estão no local e em condição de uso?'),
      (v_modelo, 16, 'Equipamento','A proteção respiratória adequada está disponível, com o CA válido?'),
      (v_modelo, 17, 'Equipamento','Os equipamentos elétricos e de iluminação usados dentro são apropriados para o ambiente?'),
      (v_modelo, 18, 'Emergência', 'Existe plano de resgate escrito para este espaço, e a equipe sabe executá-lo?'),
      (v_modelo, 19, 'Emergência', 'Os equipamentos de resgate estão montados ANTES de alguém entrar?'),
      (v_modelo, 20, 'Emergência', 'Está claro para o vigia que ele não entra para socorrer?');
  end if;
end
$$;


-- ---------- Conferência -------------------------------------------------
select m.nome, m.norma, count(i.id) as perguntas
  from public.inspecao_modelos m
  left join public.inspecao_modelo_itens i on i.modelo_id = m.id
 where m.empresa_id is null
 group by m.nome, m.norma
 order by m.nome;
