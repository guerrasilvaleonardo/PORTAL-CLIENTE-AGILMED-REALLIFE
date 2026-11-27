-- =====================================================================
-- Gestão de desempenho — a pessoa responde, item a item, antes da
-- conversa.
--
-- ANTES:  o roteiro da conversa era anotação de gestão, em terceira
--         pessoa ("perguntar como Daiane avalia o próprio mês"), e
--         nunca ia na cópia liberada. A pessoa recebia a ficha, lia e
--         tinha um único campo livre de manifestação. Tudo o que ela
--         pensava sobre o mês só existia se fosse dito em voz alta na
--         conversa — e aí já era tarde para a gestão se preparar.
-- DEPOIS: junto com a ficha vão PERGUNTAS dirigidas a ela, uma por
--         ponto do roteiro. Ela responde no portal antes da conversa, e
--         a direção lê as respostas antes de sentar. A manifestação
--         continua existindo, no fim, para o que não coube em pergunta
--         nenhuma.
-- MOTIVO: pedido dele em 27/11/2026, olhando o roteiro da conversa
--         individual: "melhore o relatório individual para que eles
--         mesmo respondam cada item".
--
-- AS PERGUNTAS FICAM CONGELADAS NA LIBERAÇÃO, junto com a ficha. Pelo
-- mesmo motivo que os números: a pessoa respondeu ao que foi
-- perguntado naquele dia, e uma pergunta reescrita depois faria a
-- resposta dela parecer outra coisa.
--
-- RESPONDER TUDO É CONDIÇÃO PARA A CIÊNCIA — decisão dele em
-- 27/11/2026. Fica registrado aqui que isso tem um custo: ciência é o
-- registro de que a pessoa LEU, e quem se recusar a responder fica, no
-- papel, como quem não tomou ciência. A trava só vale para as
-- liberações que têm perguntas; as antigas continuam como eram.
--
-- Depende de supabase/desempenho-ciencia.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

do $$
begin
  if to_regclass('public.desempenho_publicacoes') is null then
    raise exception 'Rode antes supabase/desempenho-ciencia.sql.';
  end if;
end
$$;


-- ---------- 1. Onde ficam as perguntas e as respostas -------------------
alter table public.desempenho_publicacoes
  -- ["Como você avalia o seu mês?", ...] — congeladas na liberação.
  add column if not exists perguntas jsonb,
  -- {"0": "texto da resposta", "1": "..."} — a chave é o índice da
  -- pergunta. Guardado assim, e não como lista, para uma resposta
  -- gravada no meio não depender do tamanho da lista.
  add column if not exists respostas jsonb,
  add column if not exists respostas_em timestamptz;


-- ---------- 2. Quantas foram respondidas --------------------------------
/*
 * Usada pela trava da ciência e pela tela da direção ("respondeu 4 de
 * 6"). Conta só resposta com texto: campo em branco não é resposta.
 */
create or replace function public.desempenho_respondidas(p_perguntas jsonb, p_respostas jsonb)
returns integer
language sql
immutable
as $fn$
  select coalesce(count(*) filter (
           where nullif(btrim(coalesce(p_respostas ->> (i - 1)::text, '')), '') is not null
         ), 0)::integer
    from generate_series(1, coalesce(jsonb_array_length(p_perguntas), 0)) i;
$fn$;


-- ---------- 3. Liberar: agora leva as perguntas -------------------------
/*
 * Mesma função de antes, com duas diferenças: copia as perguntas da
 * análise para a publicação e tira `perguntas_pessoa` do bloco de
 * análise (elas vão no campo próprio, não repetidas no meio do texto).
 *
 * Relatório gerado antes desta mudança não tem perguntas: a liberação
 * acontece igual, sem elas, e a ciência não trava.
 */
create or replace function public.liberar_relatorio_pessoa(
  p_relatorio bigint,
  p_pessoa uuid,
  p_mensagem text default null,
  p_incluir_analise boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r          public.relatorios_desempenho%rowtype;
  v_ficha    jsonb;
  v_analise  jsonb;
  v_perg     jsonb;
  v_cont     jsonb;
  v_id       bigint;
  v_ciente   timestamptz;
  v_msg      text := nullif(btrim(coalesce(p_mensagem, '')), '');
begin
  if not public.pode_ver_relatorio_gestao() then
    raise exception 'Só a direção libera o relatório.';
  end if;

  select * into r from public.relatorios_desempenho where id = p_relatorio;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;

  select f into v_ficha
    from jsonb_array_elements(r.dados -> 'pessoas') f
   where f ->> 'id' = p_pessoa::text
   limit 1;
  if v_ficha is null then
    raise exception 'Esta pessoa não tem ficha neste relatório.';
  end if;

  -- As perguntas vão mesmo que a direção escolha não enviar a análise
  -- escrita: elas são o que se pede à pessoa, não o que se diz dela.
  if r.analise is not null and (r.analise -> 'pessoas') ? p_pessoa::text then
    v_perg := r.analise -> 'pessoas' -> p_pessoa::text -> 'perguntas_pessoa';
    if v_perg is not null and jsonb_typeof(v_perg) <> 'array' then
      v_perg := null;
    end if;
    if v_perg is not null and jsonb_array_length(v_perg) = 0 then
      v_perg := null;
    end if;
  end if;

  -- Análise escrita: só síntese, pontos e plano. O roteiro da conversa
  -- é anotação de gestão e não vai para a pessoa.
  if p_incluir_analise and r.analise is not null and (r.analise -> 'pessoas') ? p_pessoa::text then
    v_analise := (r.analise -> 'pessoas' -> p_pessoa::text) - 'roteiro_conversa' - 'perguntas_pessoa';
  end if;

  v_cont := jsonb_build_object(
    'mes',          r.dados ->> 'mes',
    'versao',       r.versao,
    'parcial',      r.parcial,
    'periodo',      r.dados -> 'periodo',
    'anterior',     r.dados -> 'anterior',
    'versaoRegras', r.dados -> 'versaoRegras',
    'ficha',        v_ficha,
    'medianas',     r.dados -> 'equipe' -> 'medianas',
    'diagnostico',  r.dados -> 'diagnostico' -> 'pessoas' -> p_pessoa::text,
    'analise',      v_analise,
    'analiseOrigem', case when v_analise is null then null else r.analise_origem end,
    'fontes',       r.dados -> 'fontes',
    'limitacoes',   r.dados -> 'limitacoes'
  );

  select id, ciente_em into v_id, v_ciente
    from public.desempenho_publicacoes
   where relatorio_id = p_relatorio and pessoa_id = p_pessoa;

  if v_id is not null and v_ciente is not null then
    raise exception 'A pessoa já deu ciência desta versão. Para mudar, gere nova versão do relatório e libere de novo.';
  end if;

  if v_id is null then
    insert into public.desempenho_publicacoes
      (relatorio_id, pessoa_id, mes, conteudo, perguntas, mensagem, liberado_em, liberado_por)
    values
      (p_relatorio, p_pessoa, r.mes, v_cont, v_perg, v_msg, now(), auth.uid())
    returning id into v_id;
  else
    /* Reliberação antes da ciência: as respostas já escritas somem
       junto com as perguntas antigas. Guardar resposta de uma pergunta
       que não existe mais faria a tela mostrar texto sem enunciado. */
    update public.desempenho_publicacoes
       set conteudo = v_cont,
           perguntas = v_perg,
           respostas = case when perguntas is distinct from v_perg then null else respostas end,
           respostas_em = case when perguntas is distinct from v_perg then null else respostas_em end,
           mensagem = v_msg,
           liberado_em = now(),
           liberado_por = auth.uid(),
           revogado_em = null,
           revogado_por = null
     where id = v_id;
  end if;

  update public.desempenho_publicacoes
     set revogado_em = now(), revogado_por = auth.uid()
   where pessoa_id = p_pessoa
     and mes = r.mes
     and id <> v_id
     and ciente_em is null
     and revogado_em is null;

  return v_id;
end;
$fn$;

revoke all on function public.liberar_relatorio_pessoa(bigint, uuid, text, boolean) from public, anon;
grant execute on function public.liberar_relatorio_pessoa(bigint, uuid, text, boolean) to authenticated;


-- ---------- 4. A pessoa responde ----------------------------------------
/*
 * Grava as respostas e pode ser chamada quantas vezes for preciso até a
 * ciência: ninguém escreve seis respostas de uma sentada, e perder o
 * que já foi escrito por fechar a aba ensina a pessoa a responder "ok"
 * em tudo. Depois da ciência, fecha.
 */
create or replace function public.responder_relatorio_publicado(p_id bigint, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v public.desempenho_publicacoes%rowtype;
begin
  select * into v from public.desempenho_publicacoes
   where id = p_id and pessoa_id = auth.uid() and revogado_em is null;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;
  if v.ciente_em is not null then
    raise exception 'A ciência já foi registrada: as respostas não mudam mais.';
  end if;
  if v.perguntas is null then
    raise exception 'Esta devolutiva não tem perguntas.';
  end if;
  if jsonb_typeof(p_respostas) <> 'object' then
    raise exception 'Respostas em formato inesperado.';
  end if;

  update public.desempenho_publicacoes
     set respostas = p_respostas,
         respostas_em = now(),
         primeira_abertura_em = coalesce(primeira_abertura_em, now())
   where id = p_id;
end;
$fn$;

revoke all on function public.responder_relatorio_publicado(bigint, jsonb) from public, anon;
grant execute on function public.responder_relatorio_publicado(bigint, jsonb) to authenticated;


-- ---------- 5. Ciência: agora exige as respostas ------------------------
/*
 * Decisão dele: responder tudo é condição para dar ciência. Vale só
 * onde há perguntas — devolutiva sem perguntas (as de antes) continua
 * aceitando ciência direto.
 */
create or replace function public.dar_ciencia_relatorio(p_id bigint, p_manifestacao text default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v       public.desempenho_publicacoes%rowtype;
  v_txt   text := nullif(btrim(coalesce(p_manifestacao, '')), '');
  v_total integer;
  v_resp  integer;
begin
  select * into v from public.desempenho_publicacoes
   where id = p_id and pessoa_id = auth.uid() and revogado_em is null;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;

  if v.ciente_em is null then
    v_total := coalesce(jsonb_array_length(v.perguntas), 0);
    if v_total > 0 then
      v_resp := public.desempenho_respondidas(v.perguntas, v.respostas);
      if v_resp < v_total then
        raise exception 'Responda as % pergunta(s) antes de registrar ciência: % respondida(s).',
          v_total, v_resp;
      end if;
    end if;

    update public.desempenho_publicacoes
       set ciente_em = now(),
           primeira_abertura_em = coalesce(primeira_abertura_em, now()),
           manifestacao = v_txt,
           manifestacao_em = case when v_txt is null then null else now() end
     where id = p_id;
  elsif v_txt is not null and v.manifestacao is null then
    update public.desempenho_publicacoes
       set manifestacao = v_txt, manifestacao_em = now()
     where id = p_id;
  else
    raise exception 'A ciência já foi registrada.';
  end if;
end;
$fn$;

revoke all on function public.dar_ciencia_relatorio(bigint, text) from public, anon;
grant execute on function public.dar_ciencia_relatorio(bigint, text) to authenticated;


-- ---------- 6. Conferência ----------------------------------------------
-- Esperado: as três colunas novas (t), as duas funções novas (t) e
-- quantas devolutivas já têm perguntas (0 na primeira vez).
select
  (select count(*) = 3 from information_schema.columns
    where table_schema = 'public' and table_name = 'desempenho_publicacoes'
      and column_name in ('perguntas', 'respostas', 'respostas_em'))  as colunas_criadas,
  to_regproc('public.desempenho_respondidas')          is not null    as fn_contar,
  to_regproc('public.responder_relatorio_publicado')   is not null    as fn_responder,
  (select count(*) from public.desempenho_publicacoes where perguntas is not null) as com_perguntas;
