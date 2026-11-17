-- =====================================================================
-- Assinatura manuscrita e os dados do CA na ficha.
--
-- ANTES:  a entrega guardava só o instante em que o trabalhador apertou
--         o botão. Na ficha saía "Assinado" e a data. O item guardava
--         nome, CA e vida útil, mas não a validade do CA nem a
--         descrição oficial do equipamento.
-- DEPOIS: o trabalhador desenha a assinatura com o dedo, e o desenho
--         fica guardado no balde privado das fotos. A ficha imprime o
--         traço dele, o hash do registro e a data e hora — como a ficha
--         do OnSafety. O item congela também a validade do CA e a
--         descrição do equipamento.
-- MOTIVO: a ficha é o documento que a empresa apresenta. Um "assinado"
--         escrito por nós prova menos que o traço da pessoa; e a
--         descrição do equipamento é o que liga o que foi entregue ao
--         CA que o aprova.
--
-- POR QUE A VALIDADE E A DESCRIÇÃO SÃO COPIADAS, E NÃO LIDAS DO EPI.
-- Pelo mesmo motivo do nome e do CA: o cadastro muda, o CA é renovado,
-- a descrição é corrigida. A ficha precisa dizer o que valia no dia da
-- entrega, não o que o cadastro diz hoje.
--
-- O HASH é do registro, não do arquivo: identifica a assinatura daquela
-- entrega e muda se alguém mexer no que foi assinado. Não confundir com
-- assinatura digital ICP-Brasil, que é outra coisa e depende de
-- certificado da empresa.
--
-- Depende de supabase/epi-entregas.sql e supabase/epi-devolucao.sql.
-- Não altera nem apaga nada do que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.epi_entregas') is null then
    raise exception 'Rode antes supabase/epi-entregas.sql.';
  end if;
  if to_regprocedure('public.epi_registrar_alteracao(uuid, uuid, text, text, text)') is null then
    raise exception 'Rode antes supabase/epi-devolucao.sql.';
  end if;
end
$$;


-- ---------- 1. Campos novos ---------------------------------------------
alter table public.epi_entregas
  -- Caminho do PNG no balde epi-fotos, ao lado da foto da entrega.
  add column if not exists assinatura_imagem text,
  add column if not exists assinatura_hash   text;

alter table public.epi_entregas_itens
  add column if not exists validade_ca date,
  add column if not exists descricao   text;


-- ---------- 2. O gatilho congela os campos novos -------------------------
-- Reescreve o gatilho dos itens de epi-devolucao.sql acrescentando duas
-- linhas: validade do CA e descrição entram na lista do que não muda
-- depois de gravado.
create or replace function public.epi_entregas_itens_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nome text;
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.observacao    := nullif(btrim(coalesce(new.observacao, '')), '');
    new.devolucao_obs := nullif(btrim(coalesce(new.devolucao_obs, '')), '');
    new.descricao     := nullif(btrim(coalesce(new.descricao, '')), '');
    new.devolvido_em       := null;
    new.devolucao_motivo   := null;
    new.devolvido_por      := null;
    new.devolvido_por_nome := null;
    return new;
  end if;

  -- O que foi entregue não muda: é o que está escrito na ficha assinada.
  new.id         := old.id;
  new.entrega_id := old.entrega_id;
  new.epi_id     := old.epi_id;
  new.nome       := old.nome;
  new.ca         := old.ca;
  new.validade_ca    := old.validade_ca;
  new.descricao      := old.descricao;
  new.vida_util_dias := old.vida_util_dias;
  new.quantidade := old.quantidade;
  new.created_at := old.created_at;

  new.observacao    := nullif(btrim(coalesce(new.observacao, '')), '');
  new.devolucao_obs := nullif(btrim(coalesce(new.devolucao_obs, '')), '');

  if new.devolvido_em is not null and old.devolvido_em is null then
    select coalesce(p.nome, p.email) into v_nome
      from public.profiles p where p.id = auth.uid();
    new.devolvido_por      := coalesce(auth.uid(), new.devolvido_por);
    new.devolvido_por_nome := coalesce(new.devolvido_por_nome, v_nome);
    perform public.epi_registrar_alteracao(
      old.entrega_id, old.id, 'devolucao',
      null,
      to_char(new.devolvido_em, 'DD/MM/YYYY HH24:MI') || ' · ' || coalesce(new.devolucao_motivo, '')
    );
  elsif new.devolvido_em is null and old.devolvido_em is not null then
    perform public.epi_registrar_alteracao(
      old.entrega_id, old.id, 'devolucao',
      to_char(old.devolvido_em, 'DD/MM/YYYY HH24:MI') || ' · ' || coalesce(old.devolucao_motivo, ''),
      'revertida'
    );
    new.devolucao_motivo   := null;
    new.devolucao_obs      := null;
    new.devolvido_por      := null;
    new.devolvido_por_nome := null;
  end if;

  perform public.epi_registrar_alteracao(old.entrega_id, old.id, 'trocar_ate',
    to_char(old.troca_em, 'DD/MM/YYYY'), to_char(new.troca_em, 'DD/MM/YYYY'));
  perform public.epi_registrar_alteracao(old.entrega_id, old.id, 'previsao_devolucao',
    to_char(old.previsao_devolucao, 'DD/MM/YYYY'), to_char(new.previsao_devolucao, 'DD/MM/YYYY'));
  perform public.epi_registrar_alteracao(old.entrega_id, old.id, 'motivo',
    old.motivo, new.motivo);
  perform public.epi_registrar_alteracao(old.entrega_id, old.id, 'complemento',
    old.complemento, new.complemento);
  perform public.epi_registrar_alteracao(old.entrega_id, old.id, 'observacao',
    old.observacao, new.observacao);

  return new;
end;
$fn$;


-- ---------- 3. A assinatura também é congelada --------------------------
-- A entrega já protegia assinado_em, o IP e o agente. O desenho e o hash
-- entram na mesma lista: gravados uma vez, pela rota do servidor.
create or replace function public.epi_entregas_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    new.foto_path := nullif(btrim(coalesce(new.foto_path, '')), '');
    if new.foto_path is null then
      raise exception 'A entrega precisa da foto.';
    end if;
    new.entregue_por := coalesce(auth.uid(), new.entregue_por);
    new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');
    new.local_nome := nullif(btrim(coalesce(new.local_nome, '')), '');
    new.created_at := now();
    new.assinado_em := null;
    new.cancelada_em := null;
    new.assinatura_imagem := null;
    new.assinatura_hash := null;
    return new;
  end if;

  new.id := old.id;
  new.empresa_id := old.empresa_id;
  new.colaborador_id := old.colaborador_id;
  new.entregue_por := old.entregue_por;
  new.entregue_por_nome := old.entregue_por_nome;
  new.entregue_por_colaborador_id := old.entregue_por_colaborador_id;
  new.foto_path := old.foto_path;
  new.token := old.token;
  new.local_nome := old.local_nome;
  new.created_at := old.created_at;

  if old.assinado_em is not null then
    new.assinado_em := old.assinado_em;
    new.assinatura_ip := old.assinatura_ip;
    new.assinatura_agente := old.assinatura_agente;
    new.assinatura_imagem := old.assinatura_imagem;
    new.assinatura_hash := old.assinatura_hash;
  end if;

  if new.cancelada_em is not null and old.cancelada_em is null then
    new.cancelada_em := now();
    new.cancelada_por := coalesce(auth.uid(), new.cancelada_por);
    new.motivo_cancelamento := nullif(btrim(coalesce(new.motivo_cancelamento, '')), '');
  elsif old.cancelada_em is not null then
    new.cancelada_em := old.cancelada_em;
    new.cancelada_por := old.cancelada_por;
  end if;

  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

  if new.entregue_em > now() + interval '1 day' then
    raise exception 'A data da entrega não pode ser no futuro.';
  end if;

  perform public.epi_registrar_alteracao(old.id, null, 'entregue_em',
    to_char(old.entregue_em, 'DD/MM/YYYY HH24:MI'), to_char(new.entregue_em, 'DD/MM/YYYY HH24:MI'));
  perform public.epi_registrar_alteracao(old.id, null, 'observacoes',
    old.observacoes, new.observacoes);

  return new;
end;
$fn$;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.epi_entregas)                               as entregas,
       (select count(*) from public.epi_entregas where assinatura_imagem is not null)
                                                                                as com_desenho,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'epi_entregas'
           and column_name in ('assinatura_imagem', 'assinatura_hash'))          as campos_assinatura,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'epi_entregas_itens'
           and column_name in ('validade_ca', 'descricao'))                      as campos_item;
