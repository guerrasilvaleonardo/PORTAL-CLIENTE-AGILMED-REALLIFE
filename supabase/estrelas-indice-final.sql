-- =====================================================================
-- Programa de Estrelas: resultado final do ano pelo ÍNDICE FINAL.
--
-- ANTES:  o fechamento congelava o ranking por estrelas acumuladas, que
--         mede principalmente volume (quem resolve mais chamados ganha,
--         mesmo com mais atrasos).
-- DEPOIS: o vencedor do ano sai do ÍNDICE FINAL, calculado SÓ quando o
--         gestor clica em "Revelar o resultado" (não existe prévia):
--           40% estrelas do ano (volume)   -> estrelas / maior total
--           40% % no prazo                 -> dentro / (dentro + fora)
--           20% nota do cliente ajustada   -> (k·média do time + n·média
--                                             da pessoa) / (k + n), em 0–1
--         Concorre quem resolveu no mínimo 10 chamados no ano.
--         Desempate: % no prazo, depois estrelas.
--         Período: ano civil (1/1 a 31/12). O fechamento só é aceito
--         depois de 31/12 e sem extensões de prazo pendentes de decisão.
--         As estrelas mensais e anuais continuam visíveis o ano todo;
--         só a classificação final fica oculta até o fechamento.
-- MOTIVO: estrela acumulada premia volume; o índice soma volume,
--         pontualidade e satisfação, com a nota protegida contra
--         amostras pequenas (1 avaliação não vale como 5).
--
-- Pesos e mínimo ficam gravados por ano em estrelas_fechamentos (regra
-- anunciada antes do fechamento). Não apaga nem altera estrelas,
-- lançamentos ou avaliações. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.estrelas_fechamentos
  add column if not exists peso_estrelas     numeric not null default 40 check (peso_estrelas >= 0),
  add column if not exists peso_prazo        numeric not null default 40 check (peso_prazo >= 0),
  add column if not exists peso_nota         numeric not null default 20 check (peso_nota >= 0),
  add column if not exists minimo_resolvidos integer not null default 10 check (minimo_resolvidos >= 0),
  add column if not exists ajuste_nota_k     integer not null default 5 check (ajuste_nota_k >= 0),
  add column if not exists criterio          text    not null default 'indice_final';

-- Ano já fechado antes desta regra continua como foi fechado (estrelas).
update public.estrelas_fechamentos
   set criterio = 'estrelas'
 where fechado_em is not null and criterio = 'indice_final'
   and not (coalesce(classificacao, '[]'::jsonb) @> '[{"criterio": "indice_final"}]'::jsonb);


-- ---------- Índice final (interno: só o fechamento chama) ---------------
create or replace function public.estrelas_indice_final(p_ano integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  f public.estrelas_fechamentos%rowtype;
  v jsonb;
begin
  select * into f from public.estrelas_fechamentos where ano = p_ano;
  if not found then raise exception 'Defina antes a data de fechamento de %.', p_ano; end if;

  with r as (
    select * from public.estrelas_ranking(make_date(p_ano, 1, 1), make_date(p_ano, 12, 31))
  ),
  time_todo as (
    select coalesce(sum(r.media_nota * r.avaliados) / nullif(sum(r.avaliados), 0), 2)::numeric as m
      from r where r.avaliados > 0
  ),
  base as (
    select r.*,
           r.resolvidos >= f.minimo_resolvidos as elegivel,
           case when r.dentro_prazo + r.fora_prazo > 0
                then r.dentro_prazo::numeric / (r.dentro_prazo + r.fora_prazo) else 0 end as pct_prazo,
           ((f.ajuste_nota_k * t.m + r.avaliados * coalesce(r.media_nota, t.m))
             / nullif(f.ajuste_nota_k + r.avaliados, 0))::numeric as nota_ajustada
      from r cross join time_todo t
  ),
  maior as (
    select coalesce(max(total), 0) as mx from base where elegivel
  ),
  calc as (
    select b.*,
           case when m.mx > 0 then b.total::numeric / m.mx else 0 end as comp_estrelas,
           greatest(least((coalesce(b.nota_ajustada, 2) - 1) / 2, 1), 0) as comp_nota
      from base b cross join maior m
  ),
  indice as (
    select c.*,
           round(100 * (f.peso_estrelas * c.comp_estrelas
                      + f.peso_prazo    * c.pct_prazo
                      + f.peso_nota     * c.comp_nota)
                 / nullif(f.peso_estrelas + f.peso_prazo + f.peso_nota, 0), 1) as indice
      from calc c
  ),
  pos as (
    select i.*,
           case when i.elegivel then
             (rank() over (partition by i.elegivel
                           order by i.indice desc, round(i.pct_prazo, 4) desc, i.total desc))::int
           end as posicao_final
      from indice i
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'criterio',            'indice_final',
           'atendente_id',        p.atendente_id,
           'nome',                p.nome,
           'posicao',             p.posicao_final,
           'elegivel',            p.elegivel,
           'indice',              p.indice,
           'comp_estrelas',       round(p.comp_estrelas, 4),
           'comp_prazo',          round(p.pct_prazo, 4),
           'comp_nota',           round(p.comp_nota, 4),
           'nota_ajustada',       round(p.nota_ajustada, 2),
           'posicao_estrelas',    p.posicao,
           'estrelas_prazo',      p.estrelas_prazo,
           'estrelas_avaliacao',  p.estrelas_avaliacao,
           'total',               p.total,
           'resolvidos',          p.resolvidos,
           'dentro_prazo',        p.dentro_prazo,
           'fora_prazo',          p.fora_prazo,
           'avaliados',           p.avaliados,
           'media_nota',          p.media_nota,
           'regra', jsonb_build_object('peso_estrelas', f.peso_estrelas, 'peso_prazo', f.peso_prazo,
                                       'peso_nota', f.peso_nota, 'minimo_resolvidos', f.minimo_resolvidos,
                                       'ajuste_nota_k', f.ajuste_nota_k))
         order by p.elegivel desc, p.posicao_final nulls last, p.indice desc, p.nome), '[]'::jsonb)
    into v
    from pos p;

  return v;
end;
$fn$;

-- Ninguém consulta o índice antes do fechamento (sem prévia do vencedor).
revoke all on function public.estrelas_indice_final(integer) from public, anon, authenticated;


-- ---------- Fechamento: índice final, ano civil, sem pendências ---------
create or replace function public.estrelas_fechar_ano(p_ano integer, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  f public.estrelas_fechamentos%rowtype;
  v_class jsonb;
  v_pend  integer;
  v_hoje  date := (now() at time zone 'America/Porto_Velho')::date;
begin
  perform public.estrelas_exigir_gestor();
  select * into f from public.estrelas_fechamentos where ano = p_ano for update;
  if not found then raise exception 'Defina antes a data de fechamento de %.', p_ano; end if;
  if f.fechado_em is not null then raise exception 'O ano % já foi fechado.', p_ano; end if;
  if v_hoje <= make_date(p_ano, 12, 31) then
    raise exception 'O ano % ainda não terminou: o resultado considera de 1/1 a 31/12. Defina a data de fechamento em janeiro de %.',
      p_ano, p_ano + 1;
  end if;
  if v_hoje < f.data_fechamento then
    raise exception 'O resultado de % só pode ser revelado a partir de %.', p_ano, to_char(f.data_fechamento, 'DD/MM/YYYY');
  end if;

  -- Extensões de prazo ainda sem decisão do gestor mudam estrelas e % no prazo.
  select count(*) into v_pend
    from public.estrelas_prazo_alteracoes a
    join public.estrelas_lancamentos l on l.chamado_id = a.chamado_id
   where a.autorizado is null
     and (l.resolvido_em at time zone 'America/Porto_Velho')::date between make_date(p_ano, 1, 1) and make_date(p_ano, 12, 31);
  if v_pend > 0 then
    raise exception 'Há % extensão(ões) de prazo de % aguardando a sua decisão. Decida em Gestão do programa antes de revelar o resultado.',
      v_pend, p_ano;
  end if;

  if f.criterio = 'indice_final' then
    v_class := public.estrelas_indice_final(p_ano);
  else
    select coalesce(jsonb_agg(to_jsonb(r) order by r.posicao, r.nome), '[]'::jsonb)
      into v_class
      from public.estrelas_ranking(make_date(p_ano, 1, 1), make_date(p_ano, 12, 31)) r;
  end if;

  update public.estrelas_fechamentos
     set fechado_em = now(), fechado_por = auth.uid(), classificacao = v_class
   where ano = p_ano;

  insert into public.estrelas_eventos (tipo, depois, motivo, autor_id)
  values ('fechamento', jsonb_build_object('ano', p_ano, 'fechado', true, 'criterio', f.criterio,
                                           'classificacao', v_class),
          coalesce(nullif(btrim(p_motivo), ''), 'Resultado final do ano revelado'), auth.uid());

  return jsonb_build_object('ok', true, 'ano', p_ano, 'classificacao', v_class);
end;
$fn$;

revoke all on function public.estrelas_fechar_ano(integer, text) from public, anon;
grant execute on function public.estrelas_fechar_ano(integer, text) to authenticated;


-- ---------- Conferência -------------------------------------------------
select ano, data_fechamento, fechado_em, criterio, peso_estrelas, peso_prazo, peso_nota,
       minimo_resolvidos, ajuste_nota_k
  from public.estrelas_fechamentos
 order by ano;
