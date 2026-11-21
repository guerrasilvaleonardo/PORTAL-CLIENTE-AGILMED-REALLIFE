-- ===========================================================
--  O vocabulário da não conformidade
--  (depois de supabase/inspecoes.sql e nc-fotos-e-campo.sql)
-- ===========================================================
--
-- POR QUE ISTO EXISTE. Até aqui a NC tinha descrição, causa e ação —
-- tudo texto livre. Texto livre não soma: dez pessoas escrevem a mesma
-- causa de dez jeitos, e no fim do ano ninguém consegue dizer qual é o
-- problema que mais repete. Quem audita pergunta exatamente isso.
--
-- Por isso três campos fechados e um aberto:
--
--   tipologia    — de que assunto é o desvio (EPI, altura, elétrica…).
--                  Serve para agrupar e para escolher as sugestões
--                  certas na espinha de peixe.
--   causa_classe — a causa-raiz em lista fechada. É ela que vira o
--                  Pareto do painel. Sem lista, não há Pareto.
--   potencial_*  — o que PODERIA ter acontecido, separado da gravidade
--                  do que aconteceu. Um quase-acidente de gravidade
--                  baixa pode ter potencial fatal, e é justamente esse
--                  que não pode se perder no meio dos outros.
--   ishikawa     — as espinhas marcadas, como jsonb. Aqui texto livre
--                  é certo: é rascunho de investigação, não indicador.
--
-- AS LISTAS ESTÃO EM DOIS LUGARES, de propósito: aqui como restrição
-- (o banco recusa valor inventado) e em lib/vocabularioNC.ts como
-- rótulo em português. Mexeu numa, mexe na outra — o arquivo do lado
-- avisa isso em comentário.

alter table public.nao_conformidades
  add column if not exists tipologia          text,
  add column if not exists causa_classe       text,
  add column if not exists potencial_fatal    boolean not null default false,
  add column if not exists impacto_legal      boolean not null default false,
  add column if not exists impacto_ambiental  boolean not null default false,
  add column if not exists impacto_financeiro boolean not null default false,
  add column if not exists ishikawa           jsonb;

-- O apontamento de campo já nasce com o assunto escolhido, e a NC que
-- o trigger cria herda a tipologia sem ninguém digitar de novo.
alter table public.inspecao_respostas
  add column if not exists tipologia text;

alter table public.nao_conformidades drop constraint if exists nao_conformidades_tipologia;
alter table public.nao_conformidades
  add constraint nao_conformidades_tipologia
  check (tipologia is null or tipologia in (
    'epi',
    'trabalho_altura',
    'trabalho_quente',
    'espaco_confinado',
    'eletricidade',
    'bloqueio_etiquetagem',
    'maquinas_protecoes',
    'movimentacao_carga',
    'veiculos_transito',
    'produto_quimico',
    'ergonomia',
    'ruido_vibracao',
    'housekeeping',
    'incendio_emergencia',
    'sinalizacao',
    'residuos_efluentes',
    'documentacao_registro',
    'procedimento_processo',
    'outros'
  ));

alter table public.inspecao_respostas drop constraint if exists inspecao_respostas_tipologia;
alter table public.inspecao_respostas
  add constraint inspecao_respostas_tipologia
  check (tipologia is null or tipologia in (
    'epi',
    'trabalho_altura',
    'trabalho_quente',
    'espaco_confinado',
    'eletricidade',
    'bloqueio_etiquetagem',
    'maquinas_protecoes',
    'movimentacao_carga',
    'veiculos_transito',
    'produto_quimico',
    'ergonomia',
    'ruido_vibracao',
    'housekeeping',
    'incendio_emergencia',
    'sinalizacao',
    'residuos_efluentes',
    'documentacao_registro',
    'procedimento_processo',
    'outros'
  ));

alter table public.nao_conformidades drop constraint if exists nao_conformidades_causa_classe;
alter table public.nao_conformidades
  add constraint nao_conformidades_causa_classe
  check (causa_classe is null or causa_classe in (
    'procedimento_inexistente',
    'procedimento_nao_seguido',
    'treinamento_insuficiente',
    'planejamento_da_tarefa',
    'epi_inadequado',
    'equipamento_sem_manutencao',
    'projeto_ou_instalacao',
    'comunicacao_falha',
    'supervisao_insuficiente',
    'condicao_pessoal',
    'outros'
  ));

-- O Pareto do painel lê só as que têm causa classificada.
create index if not exists nao_conformidades_causa
  on public.nao_conformidades (empresa_id, causa_classe)
  where causa_classe is not null;

-- O painel abre mostrando as de potencial fatal ainda em aberto. Essa
-- lista precisa ser rápida mesmo com anos de histórico atrás.
create index if not exists nao_conformidades_potencial_fatal
  on public.nao_conformidades (empresa_id, prazo)
  where potencial_fatal and situacao <> 'encerrada';

create index if not exists nao_conformidades_tipologia_idx
  on public.nao_conformidades (empresa_id, tipologia)
  where tipologia is not null;


-- ---------- A NC nasce com o assunto já escolhido -----------------------
-- Mesma função de sempre (supabase/inspecoes-corrige-apelido-r.sql), com
-- uma linha a mais: a tipologia do item do checklist desce para a NC que
-- ele abre. Sem isto, quem apontou em campo escolheria o assunto e a NC
-- nasceria em branco — e ninguém volta para preencher.

create or replace function public.inspecoes_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_total integer;
  v_conf  integer;
  v_nc    integer;
  v_na    integer;
  v_par   integer;
  v_prazo date;
  v_nome  text;
  r       record;
begin
  if tg_op = 'INSERT' then
    new.inspetor_id := coalesce(new.inspetor_id, auth.uid());
    new.created_at  := now();
  else
    new.empresa_id := old.empresa_id;
    new.created_at := old.created_at;
    new.tipo       := old.tipo;
  end if;

  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

  if tg_op = 'UPDATE'
     and old.situacao = 'concluida'
     and new.situacao = 'em_andamento' then

    if nullif(btrim(coalesce(new.motivo_reabertura, '')), '') is null then
      raise exception 'Para reabrir a inspeção, diga o motivo.';
    end if;

    select coalesce(p.nome, p.email) into v_nome
      from public.profiles p where p.id = auth.uid();

    insert into public.inspecoes_alteracoes (inspecao_id, de, para, motivo, por, por_nome)
    values (new.id, old.situacao, new.situacao, btrim(new.motivo_reabertura), auth.uid(), v_nome);

    new.concluida_em := null;
  end if;

  new.motivo_reabertura := null;

  if new.situacao = 'concluida' and coalesce(old.situacao, '') <> 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());

    select count(*),
           count(*) filter (where resposta = 'conforme'),
           count(*) filter (where resposta = 'nao_conforme'),
           count(*) filter (where resposta = 'nao_aplicavel'),
           count(*) filter (where resposta = 'atende_parcial')
      into v_total, v_conf, v_nc, v_na, v_par
      from public.inspecao_respostas
     where inspecao_id = new.id;

    new.itens_total    := coalesce(v_total, 0);
    new.conformes      := coalesce(v_conf, 0);
    new.nao_conformes  := coalesce(v_nc, 0);
    new.nao_aplicaveis := coalesce(v_na, 0);
    new.parciais       := coalesce(v_par, 0);

    -- Parcial vale meio ponto: parte do requisito está lá.
    if coalesce(v_conf, 0) + coalesce(v_nc, 0) + coalesce(v_par, 0) > 0 then
      new.percentual := round(
        100.0 * (v_conf + 0.5 * v_par) / (v_conf + v_nc + v_par), 2);
    else
      new.percentual := null;
    end if;

    v_prazo := (new.concluida_em at time zone 'America/Porto_Velho')::date + 30;

    update public.nao_conformidades n
       set situacao = 'cancelada',
           descricao = n.descricao || ' — cancelada: o item deixou de ser não conforme na revisão da inspeção.'
     where n.inspecao_id = new.id
       and n.situacao not in ('encerrada', 'cancelada')
       and exists (
         select 1 from public.inspecao_respostas resp
          where resp.id = n.resposta_id
            and coalesce(resp.resposta, '') not in ('nao_conforme', 'atende_parcial')
       );

    -- Parcial também abre NC: a parte que falta precisa de dono e prazo,
    -- senão fica eternamente "quase".
    for r in
      select id, pergunta, observacao, foto_path, fotos, resposta, tipologia
        from public.inspecao_respostas
       where inspecao_id = new.id
         and resposta in ('nao_conforme', 'atende_parcial')
       order by ordem
    loop
      if not exists (
        select 1 from public.nao_conformidades
         where resposta_id = r.id and situacao <> 'cancelada'
      ) then
        insert into public.nao_conformidades (
          empresa_id, inspecao_id, resposta_id, local_id, local_nome,
          descricao, foto_path, prazo, aberta_por, classificacao, tipologia
        ) values (
          new.empresa_id, new.id, r.id, new.local_id, new.local_nome,
          r.pergunta
            || case when r.resposta = 'atende_parcial' then ' — atende parcialmente' else '' end
            || case when nullif(btrim(coalesce(r.observacao, '')), '') is null
                    then '' else ' — ' || btrim(r.observacao) end,
          coalesce(r.foto_path, r.fotos[1]), v_prazo, auth.uid(),
          case when new.tipo = 'auditoria'
               then case when r.resposta = 'atende_parcial' then 'menor' else 'maior' end
          end,
          r.tipologia
        );
      end if;
    end loop;
  end if;

  return new;
end;
$fn$;

drop trigger if exists inspecoes_ajustes on public.inspecoes;
create trigger inspecoes_ajustes
  before insert or update on public.inspecoes
  for each row execute function public.inspecoes_ajustes();


-- ---------- Conferência -------------------------------------------------
-- As quatro primeiras colunas têm de vir `true`, e a quinta `true`
-- também: é a tipologia descendo do item para a NC.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'nao_conformidades'
      and column_name in ('tipologia', 'causa_classe', 'potencial_fatal', 'ishikawa')) = 4
    as colunas_da_nc,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'inspecao_respostas'
      and column_name = 'tipologia') = 1
    as coluna_do_item,
  (select count(*) from pg_constraint
    where conname in ('nao_conformidades_tipologia', 'nao_conformidades_causa_classe',
                      'inspecao_respostas_tipologia')) = 3
    as listas_fechadas,
  (select count(*) from pg_indexes
    where schemaname = 'public'
      and indexname in ('nao_conformidades_causa', 'nao_conformidades_potencial_fatal',
                        'nao_conformidades_tipologia_idx')) = 3
    as indices,
  (select position('r.tipologia' in p.prosrc) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'inspecoes_ajustes')
    as trigger_leva_tipologia;
