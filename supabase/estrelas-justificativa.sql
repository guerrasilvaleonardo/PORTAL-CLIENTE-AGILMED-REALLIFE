-- =====================================================================
-- A justificativa do gestor passa a precisar dizer alguma coisa.
--
-- ANTES:  bastavam 5 caracteres. Em 20/11/2026 as 35 autorizações
--         forçadas de prazo retroativo saíram todas com a mesma frase:
--         "Autorizado por Leonardo Guerra". Isso é assinatura, não
--         motivo — e quem autorizou já fica gravado no campo ao lado,
--         automaticamente.
-- DEPOIS: o banco recusa a justificativa que, tirando as palavras
--         vazias e o nome de quem está assinando, não sobra nada.
-- MOTIVO: a justificativa existe para a auditoria e para o atendente
--         que contestar a pontuação. "Autorizado por fulano" não
--         responde nem a uma nem a outra.
--
-- POR QUE NÃO SÓ AUMENTAR O MÍNIMO DE CARACTERES. "Autorizado por
-- Leonardo Guerra" tem 29 — passaria por qualquer mínimo razoável. O
-- que falta nela não é tamanho, é conteúdo: ela só repete quem assinou.
--
-- POR QUE A REGRA É FROUXA DE PROPÓSITO. Pede duas palavras com
-- significado e doze caracteres. Não cabe ao banco julgar se o motivo é
-- bom — cabe a ele impedir o caso em que não há motivo nenhum. Regra
-- apertada demais vira gente escrevendo "xxxxx yyyyy" para passar.
--
-- A FUNÇÃO VALE PARA TODAS AS DECISÕES DO PROGRAMA, não só para o prazo
-- retroativo: estorno, restabelecimento e fechamento usam a mesma.
--
-- Depende de supabase/programa-estrelas.sql.
-- Não altera nada do que já foi gravado. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regprocedure('public.estrelas_exigir_motivo(text)') is null then
    raise exception 'Rode antes supabase/programa-estrelas.sql.';
  end if;
end
$$;


-- ---------- 1. A regra -------------------------------------------------
-- Deixa de ser immutable: agora olha quem está assinando, para não
-- aceitar a justificativa que é só o nome dessa pessoa.
create or replace function public.estrelas_exigir_motivo(p_motivo text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_texto   text;
  v_limpo   text;
  v_nome    text;
  v_palavra text;
  v_uteis   integer := 0;
begin
  v_texto := btrim(coalesce(p_motivo, ''));

  if char_length(v_texto) < 12 then
    raise exception 'Escreva o motivo da decisão, com pelo menos 12 caracteres. Ex.: "prazo nasceu errado, documento estava em dia".';
  end if;

  -- Minúsculas e sem acento, para comparar sem depender de digitação.
  v_limpo := lower(translate(v_texto,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'));

  -- O nome de quem assina sai da conta: ele já é gravado à parte.
  select lower(translate(coalesce(p.nome, ''),
           'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
           'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'))
    into v_nome
    from public.profiles p
   where p.id = auth.uid();

  foreach v_palavra in array regexp_split_to_array(v_limpo, '[^a-z0-9]+')
  loop
    continue when v_palavra = '';
    -- Palavras que só dizem "decidi", sem dizer por quê.
    continue when v_palavra in (
      'autorizado', 'autorizada', 'autorizo', 'autorizei', 'autorizacao',
      'aprovado', 'aprovada', 'aprovo', 'liberado', 'liberada', 'libero',
      'recusado', 'recusada', 'recuso', 'negado', 'negada', 'ok', 'okay',
      'sim', 'nao', 'gestor', 'gerente', 'diretor', 'por', 'pelo', 'pela',
      'de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'os', 'as', 'em', 'no',
      'na', 'um', 'uma'
    );
    -- E o nome de quem está assinando.
    continue when v_nome is not null and v_nome <> ''
             and position(v_palavra in v_nome) > 0
             and char_length(v_palavra) > 2;

    v_uteis := v_uteis + 1;
  end loop;

  if v_uteis < 2 then
    raise exception 'A justificativa precisa dizer o motivo, não quem autorizou — isso já fica gravado. Ex.: "prazo nasceu errado, documento estava em dia".';
  end if;

  return v_texto;
end;
$fn$;

revoke all on function public.estrelas_exigir_motivo(text) from public, anon;
grant execute on function public.estrelas_exigir_motivo(text) to authenticated;


-- ---------- Conferência -------------------------------------------------
-- Passa o que diz alguma coisa, recusa o que só assina.
select public.estrelas_exigir_motivo('prazo nasceu errado, documento estava em dia')
         as aceita_um_motivo,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'estrelas_exigir_motivo')
         as versoes_da_funcao;
