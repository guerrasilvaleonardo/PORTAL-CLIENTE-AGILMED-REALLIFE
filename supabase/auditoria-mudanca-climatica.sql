-- =====================================================================
-- Mudança climática no 4.1 — o requisito que quase todo checklist
-- antigo ignora.
--
-- ANTES:  os dois checklists perguntavam pelas questões internas e
--         externas do 4.1, de forma genérica.
-- DEPOIS: pergunta própria sobre mudança climática, nas duas normas.
-- MOTIVO: a ABNT NBR ISO 45001:2024 Emenda 1:2025 (09.01.2025), que é
--         idêntica à ISO 45001:2018/Amd 1:2024 "Climate action
--         changes". A mesma alteração já nasceu dentro da ABNT NBR ISO
--         9001:2026.
--
-- CONFERIDO NO TEXTO DA 9001:2026, aberta no catálogo da ABNT via
-- CONFEA: o 4.1 traz a determinação sobre mudanças climáticas como
-- requisito, e o 4.2 traz uma NOTA sobre partes interessadas poderem
-- ter requisitos relacionados a ela.
--
-- POR QUE UMA PERGUNTA SÓ, E NÃO DUAS. No 4.1 é requisito — se audita.
-- No 4.2 é nota — nota não é requisito auditável, e abrir constatação
-- contra nota é erro de auditor. A nota entra na orientação, para quem
-- aplica saber olhar.
--
-- POR QUE ISSO IMPORTA AGORA. É alteração recente e a maioria das
-- empresas e dos checklists de mercado ainda não a incorporou. É dos
-- primeiros pontos que o auditor externo vai conferir em 2026 e 2027,
-- justamente porque é novo.
--
-- Depende de supabase/auditoria-9001-completa.sql e
-- supabase/auditoria-45001-completa.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

do $$
declare
  v_modelo uuid;
  v_norma  text;
begin
  foreach v_norma in array array['Auditoria interna — ISO 9001', 'Auditoria interna — ISO 45001']
  loop
    select id into v_modelo from public.inspecao_modelos
     where empresa_id is null and nome = v_norma;

    continue when v_modelo is null;

    -- Já existe? Então não mexe em nada.
    continue when exists (
      select 1 from public.inspecao_modelo_itens
       where modelo_id = v_modelo and requisito = '4.1'
         and pergunta ilike '%climátic%'
    );

    -- Abre espaço logo depois do 4.1, que é onde ela pertence.
    update public.inspecao_modelo_itens
       set ordem = ordem + 1
     where modelo_id = v_modelo and ordem >= 2;

    insert into public.inspecao_modelo_itens
      (modelo_id, ordem, categoria, requisito, pergunta, orientacao)
    values (
      v_modelo, 2, '4 Contexto', '4.1',
      'A organização determinou se a mudança climática é uma questão pertinente para ela — e registrou essa conclusão?',
      case when v_norma like '%9001%'
        then 'Requisito trazido pela 4ª edição. Vale tanto o "sim" quanto o "não": o que não vale é não ter analisado. Peça o registro da análise. Veja também se alguma parte interessada traz exigência ligada ao clima — a norma lembra disso numa nota do 4.2.'
        else 'Requisito trazido pela Emenda 1:2025. Vale tanto o "sim" quanto o "não": o que não vale é não ter analisado. Em SSO costuma aparecer como calor, eventos extremos e qualidade do ar afetando quem trabalha exposto. Veja também a nota do 4.2 sobre partes interessadas.'
      end
    );
  end loop;
end
$$;


-- ---------- Conferência -------------------------------------------------
select m.nome,
       count(*)                                                    as perguntas,
       count(*) filter (where i.pergunta ilike '%climátic%')        as sobre_clima
  from public.inspecao_modelos m
  join public.inspecao_modelo_itens i on i.modelo_id = m.id
 where m.empresa_id is null and m.tipo = 'auditoria'
 group by m.nome
 order by m.nome;
