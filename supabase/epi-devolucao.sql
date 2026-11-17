-- =====================================================================
-- Devolução do EPI e edição da entrega.
--
-- ANTES:  a entrega era imutável. Nasceu, foi assinada, acabou. Errou?
--         cancela e faz de novo. E o EPI que o trabalhador devolve — no
--         fim do contrato, na troca, quando estraga — não tinha onde ser
--         registrado: a ficha mostrava o equipamento como se ele ainda
--         estivesse com a pessoa, para sempre.
-- DEPOIS: cada item da entrega pode receber baixa (devolvido em tal dia,
--         por tal motivo) e ter a baixa revertida. A entrega pode ser
--         alterada na data, na observação e nos prazos dos itens, e
--         TODA alteração fica gravada em epi_entregas_alteracoes, com
--         quem fez e quando.
-- MOTIVO: é o que falta para a ficha dizer a verdade. A ficha da NR-06 é
--         o controle do que está com o trabalhador hoje; sem a devolução
--         ela vira uma lista de tudo que ele já pegou na vida. O OnSafety
--         tem "Dar Baixa" e "Reverter Baixa" por isso.
--
-- POR QUE O HISTÓRICO É OBRIGATÓRIO AQUI. A ficha é documento. Deixar
-- editar um documento assinado sem deixar rastro é pior que não deixar
-- editar. Então a edição é permitida, mas nada se altera em silêncio: o
-- valor antigo, o novo, o autor e a hora ficam gravados, e a ficha avisa
-- quando houve mudança depois da assinatura.
--
-- O QUE CONTINUA SEM PODER MUDAR: a empresa, o trabalhador, a foto, o
-- token e a assinatura. Isso é o ato em si — se está errado, cancela.
--
-- Depende de supabase/epi-entregas.sql.
-- Não altera nem apaga nada do que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.epi_entregas') is null then
    raise exception 'Rode antes supabase/epi-entregas.sql (falta a tabela epi_entregas).';
  end if;
  if to_regprocedure('public.pode_gerir_epis(uuid)') is null then
    raise exception 'Rode antes supabase/epis.sql (falta pode_gerir_epis).';
  end if;
end
$$;


-- ---------- 1. Campos novos no item ------------------------------------
-- previsao_devolucao é diferente de troca_em: troca_em é quando a vida
-- útil acaba; previsao_devolucao é quando a empresa espera o equipamento
-- de volta (fim da obra, fim do contrato, empréstimo). Pode ficar vazia.
alter table public.epi_entregas_itens
  add column if not exists previsao_devolucao date,
  add column if not exists devolvido_em        timestamptz,
  add column if not exists devolucao_motivo    text,
  add column if not exists devolucao_obs       text,
  add column if not exists devolvido_por       uuid references public.profiles (id) on delete set null,
  add column if not exists devolvido_por_nome  text,
  add column if not exists observacao          text;

alter table public.epi_entregas_itens drop constraint if exists epi_entregas_itens_devolucao_motivo;
alter table public.epi_entregas_itens
  add constraint epi_entregas_itens_devolucao_motivo
  check (
    devolucao_motivo is null
    or devolucao_motivo in ('devolucao', 'troca', 'dano', 'perda', 'fim_vida_util', 'desligamento')
  );

-- Baixa sem motivo não diz nada na ficha.
alter table public.epi_entregas_itens drop constraint if exists epi_entregas_itens_baixa_completa;
alter table public.epi_entregas_itens
  add constraint epi_entregas_itens_baixa_completa
  check ((devolvido_em is null) = (devolucao_motivo is null));

create index if not exists epi_entregas_itens_em_uso
  on public.epi_entregas_itens (entrega_id) where devolvido_em is null;


-- ---------- 2. Histórico de alterações ---------------------------------
create table if not exists public.epi_entregas_alteracoes (
  id          uuid primary key default gen_random_uuid(),
  entrega_id  uuid not null references public.epi_entregas (id) on delete cascade,
  item_id     uuid references public.epi_entregas_itens (id) on delete set null,
  campo       text not null,
  valor_antes text,
  valor_depois text,
  -- Congelado: quem alterou pode sair da empresa depois.
  autor       uuid references public.profiles (id) on delete set null,
  autor_nome  text,
  -- Verdadeiro quando a mudança veio depois de o trabalhador assinar.
  apos_assinatura boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists epi_entregas_alteracoes_entrega
  on public.epi_entregas_alteracoes (entrega_id, created_at desc);

-- Grava uma linha por campo que mudou. Chamada pelos gatilhos abaixo.
create or replace function public.epi_registrar_alteracao(
  p_entrega uuid,
  p_item    uuid,
  p_campo   text,
  p_antes   text,
  p_depois  text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_assinada boolean;
  v_nome     text;
begin
  if coalesce(p_antes, '') is not distinct from coalesce(p_depois, '') then
    return;
  end if;

  select e.assinado_em is not null into v_assinada
    from public.epi_entregas e where e.id = p_entrega;

  select coalesce(p.nome, p.email) into v_nome
    from public.profiles p where p.id = auth.uid();

  insert into public.epi_entregas_alteracoes
    (entrega_id, item_id, campo, valor_antes, valor_depois, autor, autor_nome, apos_assinatura)
  values
    (p_entrega, p_item, p_campo, p_antes, p_depois, auth.uid(), v_nome, coalesce(v_assinada, false));
end;
$fn$;


-- ---------- 3. Ajustes e proteção do item -------------------------------
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
    -- Item nasce em uso. Baixa é ato à parte, feito depois.
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
  new.vida_util_dias := old.vida_util_dias;
  new.quantidade := old.quantidade;
  new.created_at := old.created_at;

  new.observacao    := nullif(btrim(coalesce(new.observacao, '')), '');
  new.devolucao_obs := nullif(btrim(coalesce(new.devolucao_obs, '')), '');

  -- Dando baixa agora.
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

  -- Revertendo a baixa.
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

drop trigger if exists epi_entregas_itens_ajustes on public.epi_entregas_itens;
create trigger epi_entregas_itens_ajustes
  before insert or update on public.epi_entregas_itens
  for each row execute function public.epi_entregas_itens_ajustes();


-- ---------- 4. A entrega passa a aceitar correção ----------------------
-- Troca o gatilho de epi-entregas.sql: a data e a observação deixam de
-- ser imutáveis e passam a ser alteráveis COM registro. O resto do ato
-- (empresa, trabalhador, foto, token, assinatura) continua congelado.
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
    new.created_at := now();
    new.assinado_em := null;
    new.cancelada_em := null;
    return new;
  end if;

  -- O ato em si não muda.
  new.id := old.id;
  new.empresa_id := old.empresa_id;
  new.colaborador_id := old.colaborador_id;
  new.entregue_por := old.entregue_por;
  new.entregue_por_nome := old.entregue_por_nome;
  new.foto_path := old.foto_path;
  new.token := old.token;
  new.created_at := old.created_at;

  -- Assinatura só é gravada pela rota do servidor; aqui ela não volta atrás.
  if old.assinado_em is not null then
    new.assinado_em := old.assinado_em;
    new.assinatura_ip := old.assinatura_ip;
    new.assinatura_agente := old.assinatura_agente;
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

  -- Data no futuro seria entrega que ainda não aconteceu.
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


-- ---------- 5. Regras de acesso ----------------------------------------
-- O item passa a aceitar UPDATE (a baixa e a correção de prazo). O
-- histórico é só de leitura para quem usa o portal: quem escreve nele é
-- o gatilho, que roda como dono da função.
drop policy if exists epi_entregas_itens_alteracao on public.epi_entregas_itens;
create policy epi_entregas_itens_alteracao
  on public.epi_entregas_itens for update to authenticated
  using (exists (select 1 from public.epi_entregas e
                  where e.id = entrega_id and public.pode_gerir_epis(e.empresa_id)))
  with check (exists (select 1 from public.epi_entregas e
                       where e.id = entrega_id and public.pode_gerir_epis(e.empresa_id)));

alter table public.epi_entregas_alteracoes enable row level security;

drop policy if exists epi_entregas_alteracoes_leitura on public.epi_entregas_alteracoes;
create policy epi_entregas_alteracoes_leitura
  on public.epi_entregas_alteracoes for select to authenticated
  using (exists (select 1 from public.epi_entregas e
                  where e.id = entrega_id and public.pode_gerir_epis(e.empresa_id)));

grant update on public.epi_entregas_itens to authenticated;
grant select on public.epi_entregas_alteracoes to authenticated;
revoke insert, update, delete, truncate on public.epi_entregas_alteracoes from anon, authenticated;
revoke all on public.epi_entregas_alteracoes from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.epi_entregas_itens)                        as itens,
       (select count(*) from public.epi_entregas_itens where devolvido_em is null) as em_uso,
       (select count(*) from public.epi_entregas_itens where devolvido_em is not null) as devolvidos,
       (select count(*) from public.epi_entregas_alteracoes)                   as alteracoes,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'epi_entregas_itens'
           and column_name in ('previsao_devolucao','devolvido_em','devolucao_motivo',
                               'devolucao_obs','devolvido_por','devolvido_por_nome','observacao')) as campos_novos,
       (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('epi_entregas_itens','epi_entregas_alteracoes'))  as politicas;
