-- =====================================================================
-- Estrelas: a avaliação do cliente vale o número de estrelas que ele dá
-- Rode no Supabase ("projeto ticket") -> SQL Editor. Pode rodar mais de
-- uma vez (os passos 4 e 5 só agem onde ainda há diferença).
--
-- Decisão (19/10/2026, Leonardo): contabilizar as estrelas que o cliente
-- marca. Caso que motivou: #196, cliente deu Excelente (3 estrelas na
-- tela) e o atendente recebeu +2.
--
-- ANTES -> DEPOIS
--   Avaliação: Ruim +0, Bom +1, Excelente +2  ->  Ruim +1, Bom +2, Excelente +3
--   Máximo por chamado: 3 (1 prazo + 2)        ->  4 (1 prazo + 3)
--   Regras: nova versão (regra_versao + 1), registrada no histórico.
--   Lançamentos já existentes (não estornados): passam para a regra nova
--     e são recalculados — inclui o #196 (2 -> 3 pela avaliação). Cada
--     mudança fica no histórico de estrelas (evento de avaliação/
--     recálculo). Estornados não são tocados.
--   Limites do banco: bônus por avaliação aceita até 3 (antes até 2).
--   Gestor pode ajustar Ruim/Bom/Excelente depois na tela de Estrelas.
--
--   Chamado #177 (interno, aberto e atendido pela Daiane):
--     ANTES : estrelas com a Priscila. Ela virou responsável 3 s antes da
--             1ª resolução (16/10 21:13) e continuava responsável na
--             2ª resolução (19/10 12:37:29); a Daiane voltou a ser a
--             responsável 6 s depois. A Priscila, como solicitante,
--             avaliou Excelente o chamado cujas estrelas eram dela.
--     DEPOIS: estrelas (prazo + avaliação) passam para a Daiane, com
--             registro no histórico.
--   Regra nova: quem recebeu as estrelas do chamado não pode avaliá-lo
--     (antes só o responsável atual era barrado).
-- Não apaga nada.
-- =====================================================================


-- ---------- 1. Limites e coluna do bônus "Ruim" -------------------------
alter table public.estrelas_config
  add column if not exists bonus_ruim smallint not null default 0;

do $$
declare
  r record;
begin
  -- Recria as regras de limite dos bônus (0 a 3).
  for r in
    select conname from pg_constraint
     where conrelid = 'public.estrelas_config'::regclass and contype = 'c'
       and (pg_get_constraintdef(oid) like '%bonus_bom%'
            or pg_get_constraintdef(oid) like '%bonus_excelente%'
            or pg_get_constraintdef(oid) like '%bonus_ruim%')
  loop
    execute format('alter table public.estrelas_config drop constraint %I', r.conname);
  end loop;
  alter table public.estrelas_config add constraint estrelas_config_bonus_ruim_check check (bonus_ruim between 0 and 3);
  alter table public.estrelas_config add constraint estrelas_config_bonus_bom_check check (bonus_bom between 0 and 3);
  alter table public.estrelas_config add constraint estrelas_config_bonus_excelente_check check (bonus_excelente between 0 and 3);

  for r in
    select conname from pg_constraint
     where conrelid = 'public.estrelas_lancamentos'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%estrelas_avaliacao%'
  loop
    execute format('alter table public.estrelas_lancamentos drop constraint %I', r.conname);
  end loop;
  alter table public.estrelas_lancamentos
    add constraint estrelas_lancamentos_estrelas_avaliacao_check check (estrelas_avaliacao between 0 and 3);
end $$;


-- ---------- 2. Cálculo: Ruim passa a contar ------------------------------
create or replace function public.estrelas_recalcular(p_chamado uuid, p_autor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg        public.estrelas_config%rowtype;
  c          record;
  l          public.estrelas_lancamentos%rowtype;
  tem_l      boolean;
  v_res      timestamptz;
  v_atend    uuid;
  v_regras   jsonb;
  v_ref      timestamptz;
  v_dentro   boolean;
  v_ep       smallint;
  v_nota     smallint;
  v_ea       smallint;
  v_tipo     text;
  v_comemorar text;
begin
  select * into cfg from public.estrelas_config where id;
  select id, status, prazo_sla, resolvido_em, encerrado_em, responsavel_id
    into c from public.chamados where id = p_chamado;
  if not found then return; end if;

  select * into l from public.estrelas_lancamentos where chamado_id = p_chamado for update;
  tem_l := found;

  -- Estorno só se desfaz por ação explícita do gestor.
  if tem_l and l.situacao = 'estornada' then return; end if;

  v_res := case when c.status in ('resolvido', 'encerrado')
                then coalesce(c.resolvido_em, c.encerrado_em) end;

  -- Chamado reaberto: suspende (preserva valores e histórico).
  if v_res is null then
    if tem_l and l.situacao = 'valida' then
      update public.estrelas_lancamentos
         set situacao = 'suspensa', motivo = 'Chamado reaberto', atualizado_em = now()
       where chamado_id = p_chamado;
      insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id)
      values (p_chamado, l.atendente_id, 'suspensa',
              jsonb_build_object('situacao', 'valida'),
              jsonb_build_object('situacao', 'suspensa'),
              'Chamado reaberto: pontuação suspensa até nova resolução', p_autor);
    end if;
    return;
  end if;

  -- Primeira concessão: só com programa ativo e resolução a partir da data inicial.
  if not tem_l then
    if not cfg.ativo or cfg.data_inicio is null
       or (v_res at time zone 'America/Porto_Velho')::date < cfg.data_inicio then
      return;
    end if;
    if c.responsavel_id is null then return; end if;
  end if;

  -- Atendente: quem era responsável na resolução válida. Uma
  -- transferência depois de resolvido não move as estrelas.
  if tem_l and l.resolvido_em = v_res then
    v_atend := l.atendente_id;
  else
    v_atend := coalesce(c.responsavel_id, l.atendente_id);
  end if;
  if v_atend is null then return; end if;

  -- Regras: as do momento da primeira concessão (mudança de regra vale
  -- só para novas concessões).
  v_regras := coalesce(case when tem_l then l.regras end,
                       jsonb_build_object('versao', cfg.regra_versao,
                                          'prazo', cfg.estrelas_prazo,
                                          'ruim', cfg.bonus_ruim,
                                          'bom', cfg.bonus_bom,
                                          'excelente', cfg.bonus_excelente));

  v_ref    := public.estrelas_prazo_referencia(p_chamado, c.prazo_sla);
  v_dentro := case when v_ref is null then null else v_res <= v_ref end;
  v_ep     := case when v_dentro then (v_regras->>'prazo')::smallint else 0 end;

  select a.nota into v_nota from public.chamado_avaliacoes a where a.chamado_id = p_chamado;
  -- Ruim conta só se a regra do chamado tiver 'ruim' (regras antigas não têm).
  v_ea := case v_nota when 3 then (v_regras->>'excelente')::smallint
                      when 2 then (v_regras->>'bom')::smallint
                      when 1 then coalesce((v_regras->>'ruim')::smallint, 0)
                      else 0 end;

  if not tem_l then
    insert into public.estrelas_lancamentos
           (chamado_id, atendente_id, resolvido_em, prazo_referencia, dentro_prazo,
            estrelas_prazo, nota, estrelas_avaliacao, situacao, regras)
    values (p_chamado, v_atend, v_res, v_ref, v_dentro, v_ep, v_nota, v_ea, 'valida', v_regras);

    v_comemorar := case when v_ep > 0 then 'prazo'
                        when v_ea > 0 then 'avaliacao' end;
    insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, depois, motivo, autor_id, comemorar)
    values (p_chamado, v_atend, 'concessao',
            jsonb_build_object('estrelas_prazo', v_ep, 'estrelas_avaliacao', v_ea,
                               'dentro_prazo', v_dentro, 'resolvido_em', v_res,
                               'prazo_referencia', v_ref, 'nota', v_nota),
            case when v_dentro then 'Resolvido dentro do prazo'
                 when v_dentro is null then 'Chamado sem prazo de SLA'
                 else 'Resolvido fora do prazo' end,
            p_autor, v_comemorar);
    return;
  end if;

  -- Nada mudou: não grava nada (idempotente).
  if l.situacao = 'valida' and l.atendente_id = v_atend and l.resolvido_em = v_res
     and l.prazo_referencia is not distinct from v_ref
     and l.dentro_prazo is not distinct from v_dentro
     and l.estrelas_prazo = v_ep and l.nota is not distinct from v_nota
     and l.estrelas_avaliacao = v_ea then
    return;
  end if;

  update public.estrelas_lancamentos
     set atendente_id = v_atend, resolvido_em = v_res, prazo_referencia = v_ref,
         dentro_prazo = v_dentro, estrelas_prazo = v_ep, nota = v_nota,
         estrelas_avaliacao = v_ea, situacao = 'valida', motivo = null,
         atualizado_em = now()
   where chamado_id = p_chamado;

  v_comemorar := null;
  if l.situacao = 'suspensa' then
    v_tipo := 'restabelecida';
  elsif l.estrelas_avaliacao is distinct from v_ea or l.nota is distinct from v_nota then
    v_tipo := 'avaliacao';
    if v_ea > l.estrelas_avaliacao then v_comemorar := 'avaliacao'; end if;
  else
    v_tipo := 'recalculo';
  end if;

  insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id, comemorar)
  values (p_chamado, v_atend, v_tipo,
          jsonb_build_object('atendente_id', l.atendente_id, 'estrelas_prazo', l.estrelas_prazo,
                             'estrelas_avaliacao', l.estrelas_avaliacao, 'situacao', l.situacao,
                             'resolvido_em', l.resolvido_em, 'nota', l.nota),
          jsonb_build_object('atendente_id', v_atend, 'estrelas_prazo', v_ep,
                             'estrelas_avaliacao', v_ea, 'situacao', 'valida',
                             'resolvido_em', v_res, 'nota', v_nota,
                             'dentro_prazo', v_dentro, 'prazo_referencia', v_ref),
          case v_tipo
            when 'restabelecida' then 'Chamado resolvido novamente: pontuação restabelecida (sem nova concessão)'
            when 'avaliacao' then 'Bônus pela avaliação do cliente'
            else 'Pontuação recalculada' end,
          p_autor, v_comemorar);
end;
$fn$;


revoke all on function public.estrelas_recalcular(uuid, uuid) from public, anon, authenticated;


-- ---------- 3. Configuração: aceita o bônus "Ruim" -----------------------
drop function if exists public.estrelas_salvar_config(boolean, date, integer, numeric, smallint, smallint, smallint, text);

create or replace function public.estrelas_salvar_config(
  p_ativo boolean,
  p_data_inicio date,
  p_prazo_avaliacao_dias integer,
  p_alerta_prazo_horas numeric,
  p_estrelas_prazo smallint,
  p_bonus_bom smallint,
  p_bonus_excelente smallint,
  p_motivo text,
  p_bonus_ruim smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  antes   public.estrelas_config%rowtype;
  depois  public.estrelas_config%rowtype;
  v_motivo text;
  v_versao integer;
  n integer := 0;
  r record;
begin
  perform public.estrelas_exigir_gestor();
  v_motivo := public.estrelas_exigir_motivo(p_motivo);

  select * into antes from public.estrelas_config where id for update;

  if p_ativo then
    if p_data_inicio is null then
      raise exception 'Defina a data inicial do programa antes de ativar.';
    end if;
    if p_prazo_avaliacao_dias is null then
      raise exception 'Defina o prazo para receber avaliações antes de ativar.';
    end if;
    if not exists (select 1 from public.estrelas_fechamentos f
                    where f.ano = extract(year from (now() at time zone 'America/Porto_Velho'))::int) then
      raise exception 'Defina a data de fechamento anual do ano corrente antes de ativar.';
    end if;
  end if;

  v_versao := antes.regra_versao;
  if p_estrelas_prazo is distinct from antes.estrelas_prazo
     or p_bonus_bom is distinct from antes.bonus_bom
     or p_bonus_excelente is distinct from antes.bonus_excelente
     or coalesce(p_bonus_ruim, antes.bonus_ruim) is distinct from antes.bonus_ruim then
    v_versao := v_versao + 1;
  end if;

  update public.estrelas_config
     set ativo = p_ativo,
         data_inicio = p_data_inicio,
         prazo_avaliacao_dias = p_prazo_avaliacao_dias,
         alerta_prazo_horas = coalesce(p_alerta_prazo_horas, antes.alerta_prazo_horas),
         estrelas_prazo = p_estrelas_prazo,
         bonus_bom = p_bonus_bom,
         bonus_excelente = p_bonus_excelente,
         bonus_ruim = coalesce(p_bonus_ruim, antes.bonus_ruim),
         regra_versao = v_versao,
         atualizado_em = now(),
         atualizado_por = auth.uid()
   where id
  returning * into depois;

  insert into public.estrelas_eventos (tipo, antes, depois, motivo, autor_id)
  values ('config', to_jsonb(antes), to_jsonb(depois), v_motivo, auth.uid());

  -- Ao ativar: processa os chamados já resolvidos desde a data inicial
  -- (a prévia foi mostrada ao gestor na tela antes da confirmação).
  if depois.ativo then
    for r in
      select ch.id from public.chamados ch
       where ch.status in ('resolvido', 'encerrado')
         and coalesce(ch.resolvido_em, ch.encerrado_em) is not null
         and (coalesce(ch.resolvido_em, ch.encerrado_em) at time zone 'America/Porto_Velho')::date >= depois.data_inicio
         and not exists (select 1 from public.estrelas_lancamentos l where l.chamado_id = ch.id)
    loop
      perform public.estrelas_recalcular(r.id, auth.uid());
      n := n + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'processados', n, 'regra_versao', v_versao);
end;
$fn$;


revoke all on function public.estrelas_salvar_config(boolean, date, integer, numeric, smallint, smallint, smallint, text, smallint) from public, anon;
grant execute on function public.estrelas_salvar_config(boolean, date, integer, numeric, smallint, smallint, smallint, text, smallint) to authenticated;


-- ---------- 4. Regra nova: Ruim +1, Bom +2, Excelente +3 -----------------
do $$
declare
  antes public.estrelas_config%rowtype;
  depois public.estrelas_config%rowtype;
begin
  select * into antes from public.estrelas_config where id for update;
  if antes.bonus_ruim = 1 and antes.bonus_bom = 2 and antes.bonus_excelente = 3 then
    return;  -- já aplicada
  end if;

  update public.estrelas_config
     set bonus_ruim = 1, bonus_bom = 2, bonus_excelente = 3,
         regra_versao = regra_versao + 1, atualizado_em = now()
   where id
  returning * into depois;

  insert into public.estrelas_eventos (tipo, antes, depois, motivo)
  values ('config', to_jsonb(antes), to_jsonb(depois),
          'Avaliação passa a valer as estrelas que o cliente dá: Ruim +1, Bom +2, Excelente +3 (decisão de 19/10/2026)');
end $$;


-- ---------- 5. Lançamentos existentes passam para a regra nova -----------
do $$
declare
  cfg public.estrelas_config%rowtype;
  r   record;
  n   integer := 0;
begin
  select * into cfg from public.estrelas_config where id;

  for r in
    select l.chamado_id
      from public.estrelas_lancamentos l
     where l.situacao <> 'estornada'
       and (l.regras->>'ruim' is distinct from cfg.bonus_ruim::text
            or l.regras->>'bom' is distinct from cfg.bonus_bom::text
            or l.regras->>'excelente' is distinct from cfg.bonus_excelente::text)
  loop
    update public.estrelas_lancamentos
       set regras = regras || jsonb_build_object('versao', cfg.regra_versao,
                                                 'ruim', cfg.bonus_ruim,
                                                 'bom', cfg.bonus_bom,
                                                 'excelente', cfg.bonus_excelente)
     where chamado_id = r.chamado_id;

    perform public.estrelas_recalcular(r.chamado_id, null);
    n := n + 1;
  end loop;

  raise notice 'Lançamentos passados para a regra nova: %', n;
end $$;


-- ---------- 6. Quem recebeu as estrelas não avalia ----------------------
create or replace function public.avaliacao_eh_avaliador(p_chamado uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.chamados c
      join public.empresas e on e.id = c.empresa_id
      join public.profiles u on u.id = p_usuario
      left join public.profiles cr on cr.id = c.criado_por
     where c.id = p_chamado
       and coalesce(u.ativo, true)
       and c.responsavel_id is distinct from p_usuario
       -- Quem recebeu as estrelas do chamado também não avalia (#177).
       and not exists (select 1 from public.estrelas_lancamentos l
                        where l.chamado_id = c.id and l.atendente_id = p_usuario)
       and (
             -- Chamado de cliente (regra anterior)
             (not e.interna and u.perfil = 'cliente' and (
                   c.solicitante_id = p_usuario
                or (c.solicitante_id is null and c.criado_por = p_usuario)
                or (c.solicitante_id is null
                    and coalesce(cr.perfil, '') <> 'cliente'
                    and u.empresa_id = c.empresa_id
                    and (c.visibilidade = 'empresa'
                         or exists (select 1 from public.chamado_participantes cp
                                     where cp.chamado_id = c.id
                                       and cp.usuario_id = p_usuario)))))
             -- Chamado interno: solicitante; sem ele, quem abriu
          or (e.interna and u.perfil in ('atendimento', 'gestor', 'admin') and (
                   c.solicitante_id = p_usuario
                or (c.solicitante_id is null and c.criado_por = p_usuario)))
           )
  );
$fn$;


revoke all on function public.avaliacao_eh_avaliador(uuid, uuid) from public, anon;
grant execute on function public.avaliacao_eh_avaliador(uuid, uuid) to authenticated;


-- ---------- 7. Correção do #177: estrelas para a Daiane ------------------
do $$
declare
  v_ch     uuid;
  v_daiane uuid;
  v_atual  uuid;
begin
  select id into v_ch from public.chamados where numero = 177;
  select id into v_daiane from public.profiles where nome ilike 'Daiane Sansel%' limit 1;
  select atendente_id into v_atual from public.estrelas_lancamentos where chamado_id = v_ch;

  if v_ch is null or v_daiane is null or v_atual is null or v_atual = v_daiane then
    return;  -- nada a corrigir (ou já corrigido)
  end if;

  update public.estrelas_lancamentos
     set atendente_id = v_daiane, atualizado_em = now()
   where chamado_id = v_ch;

  insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo)
  values (v_ch, v_daiane, 'recalculo',
          jsonb_build_object('atendente_id', v_atual),
          jsonb_build_object('atendente_id', v_daiane),
          'Correção 19/10/2026: chamado aberto e atendido pela Daiane; a troca de responsável segundos antes da resolução e a autoavaliação da solicitante levaram as estrelas para a pessoa errada');
end $$;


-- ---------- Conferência --------------------------------------------------
-- #196 e #177 devem mostrar estrelas_avaliacao = 3 (total 4); #177 com a Daiane.
select ch.numero, p.nome as atendente, l.estrelas_prazo, l.nota, l.estrelas_avaliacao,
       l.estrelas_prazo + l.estrelas_avaliacao as total, l.situacao
  from public.estrelas_lancamentos l
  join public.chamados ch on ch.id = l.chamado_id
  left join public.profiles p on p.id = l.atendente_id
 where l.nota is not null
 order by ch.numero;
