-- =====================================================================
-- ISO 45001: o checklist passa a cobrir a norma inteira.
--
-- ANTES:  30 perguntas. Faltavam requisitos auditáveis, e um deles é
--         dos que mais pesam numa certificação: o 6.1.4, plano de ação.
-- DEPOIS: 35 perguntas, uma por requisito auditável de 4 a 10.
-- MOTIVO: mesma revisão feita na 9001, a pedido dele em 20/11/2026.
--
-- CONFERIDO CONTRA O SUMÁRIO da ABNT NBR ISO 45001:2024, 1ª edição,
-- 21.11.2024, aberta no catálogo da ABNT via CONFEA. Não foi de
-- memória.
--
-- O QUE FALTAVA:
--   4.4   Sistema de gestão de SSO — os processos e suas interações
--   6.1.1 Generalidades do planejamento
--   6.1.4 Plano de ação — onde o risco levantado vira ação integrada
--         ao processo, com avaliação de eficácia
--   6.2.2 Planejamento para alcançar os objetivos
--   10.1  Generalidades da melhoria
--
-- E DUAS PERGUNTAS ESTAVAM COM O NÚMERO ERRADO:
--   a de auditorias realizadas apontava para 9.2.2 (que é o programa);
--   é 9.2.1. E a de objetivos apontava para 6.2 genérico; é 6.2.1.
--
-- A HIERARQUIA DE CONTROLES mudou de capítulo na tela: estava sob
-- "6 Planejamento" com o número 8.1.2. O número estava certo, a seção
-- não — e numa auditoria conduzida seção a seção isso faz a pergunta
-- aparecer na hora errada.
--
-- DIFERENÇA PARA A 9001 QUE VALE REGISTRAR: a 45001:2024 mantém o
-- 10.3 Melhoria contínua. A 9001:2026 não tem 10.3. Os dois checklists
-- estão certos, cada um na sua numeração.
--
-- O TEXTO CONTINUA SENDO NOSSO. O número é referência.
--
-- AUDITORIA JÁ ABERTA NÃO MUDA: as perguntas são copiadas na abertura.
--
-- Depende de supabase/inspecoes-auditoria.sql e
-- supabase/auditoria-numero-do-requisito.sql.
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

  update public.inspecao_modelo_itens
     set ordem = ordem + 1000
   where modelo_id = v_modelo;

  update public.inspecao_modelo_itens i
     set ordem     = m.nova,
         requisito = coalesce(m.req, i.requisito),
         categoria = coalesce(m.cat, i.categoria)
    from (values
      (1001,  1, null,    null),
      (1002,  2, null,    null),
      (1003,  3, null,    null),
      (1004,  5, null,    null),
      (1005,  6, null,    null),
      (1006,  7, null,    null),
      (1007,  8, null,    null),
      (1008, 10, null,    null),
      (1009, 11, null,    null),
      -- A hierarquia de controles é 8.1.2 e pertence a Operação.
      (1010, 22, null,    '8 Operação'),
      (1011, 12, null,    null),
      (1012, 14, '6.2.1', null),
      (1013, 16, null,    null),
      (1014, 17, null,    null),
      (1015, 18, null,    null),
      (1016, 19, null,    null),
      (1017, 20, null,    null),
      (1018, 21, null,    null),
      (1019, 23, null,    null),
      (1020, 24, null,    null),
      (1021, 25, null,    null),
      (1022, 26, null,    null),
      (1023, 27, null,    null),
      (1024, 29, null,    null),
      -- Auditorias realizadas é 9.2.1; 9.2.2 é o programa.
      (1025, 28, '9.2.1', null),
      (1026, 30, null,    null),
      (1027, 32, null,    null),
      (1028, 33, null,    null),
      (1029, 34, null,    null),
      (1030, 35, null,    null)
    ) as m(antiga, nova, req, cat)
   where i.modelo_id = v_modelo and i.ordem = m.antiga;

  insert into public.inspecao_modelo_itens
    (modelo_id, ordem, categoria, requisito, pergunta, orientacao)
  select v_modelo, x.ordem, x.categoria, x.requisito, x.pergunta, x.orientacao
    from (values
      (4, '4 Contexto', '4.4',
       'Os processos do sistema de SSO estão estabelecidos, com as interações entre eles e os critérios de funcionamento?',
       'Peça o mapa dos processos e siga um do início ao fim. Sistema que só existe em pasta não tem processo definido.'),

      (9, '6 Planejamento', '6.1.1',
       'Ao planejar o sistema, a empresa considerou o contexto, as partes interessadas e o escopo para determinar o que precisa ser tratado?',
       'O planejamento tem de ser rastreável até o contexto levantado no 4.1 e 4.2. Pergunte de onde saiu cada risco planejado.'),

      (13, '6 Planejamento', '6.1.4',
       'Existe plano de ação para os riscos, os requisitos legais e as emergências, integrado aos processos e com avaliação da eficácia?',
       'É o item que o auditor externo mais cobra e o que mais falta. Risco levantado no papel e sem plano é levantamento, não planejamento. Peça o plano e veja se a ação está dentro do processo de quem executa, não numa planilha à parte.'),

      (15, '6 Planejamento', '6.2.2',
       'Para cada objetivo de SSO está definido o que será feito, com que recursos, por quem, quando e como o resultado será avaliado?',
       'Objetivo sem plano é intenção. Compare a lista de objetivos com o plano de cada um.'),

      (31, '10 Melhoria', '10.1',
       'A empresa determina oportunidades de melhoria e as implementa, e não apenas corrige o que deu errado?',
       'Melhoria não é só tratar não conformidade. Peça uma melhoria que não nasceu de um problema.')
    ) as x(ordem, categoria, requisito, pergunta, orientacao)
   where not exists (
     select 1 from public.inspecao_modelo_itens i
      where i.modelo_id = v_modelo and i.requisito = x.requisito
   );
end
$$;


-- ---------- Conferência -------------------------------------------------
with exigidos(requisito) as (values
  ('4.1'),('4.2'),('4.3'),('4.4'),
  ('5.1'),('5.2'),('5.3'),('5.4'),
  ('6.1.1'),('6.1.2'),('6.1.3'),('6.1.4'),('6.2.1'),('6.2.2'),
  ('7.1'),('7.2'),('7.3'),('7.4'),('7.5'),
  ('8.1.1'),('8.1.2'),('8.1.3'),('8.1.4'),('8.2'),
  ('9.1.1'),('9.1.2'),('9.2.1'),('9.2.2'),('9.3'),
  ('10.1'),('10.2'),('10.3')
)
select (select count(*) from public.inspecao_modelo_itens i
         join public.inspecao_modelos m on m.id = i.modelo_id
        where m.nome = 'Auditoria interna — ISO 45001')                   as perguntas,
       (select count(*) from exigidos e
         where not exists (
           select 1 from public.inspecao_modelo_itens i
             join public.inspecao_modelos m on m.id = i.modelo_id
            where m.nome = 'Auditoria interna — ISO 45001'
              and i.requisito = e.requisito))                             as faltando;
