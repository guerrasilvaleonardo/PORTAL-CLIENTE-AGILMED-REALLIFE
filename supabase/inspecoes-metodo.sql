-- =====================================================================
-- Método dentro da não conformidade: matriz de risco e cinco porquês.
--
-- ANTES:  a gravidade era escolhida num select ("alta" porque pareceu
--         alta) e a causa era um campo de texto livre — que na prática
--         vira "falta de atenção do colaborador".
-- DEPOIS: a gravidade sai de uma matriz de probabilidade x severidade,
--         e a causa tem um roteiro de cinco porquês antes dela.
-- MOTIVO: a ISO 45001 e a ISO 9001 mandam, no 10.2, AVALIAR A CAUSA —
--         não anotar a primeira explicação. Campo em branco não produz
--         análise; roteiro produz.
--
-- POR QUE A MATRIZ. "Alta" escolhida no olho não se defende numa
-- auditoria nem se compara entre dois técnicos. Probabilidade x
-- severidade dá um número, e o número ordena a fila de quem trata o
-- quê primeiro. É a mesma lógica do inventário de riscos do PGR, que a
-- equipe já escreve todo dia.
--
-- POR QUE CINCO PORQUÊS, E NÃO UM CAMPO MAIOR. "Falta de atenção" é
-- onde a análise para quando ninguém a empurra. O roteiro empurra: a
-- cada porquê a resposta tem de explicar a anterior, e a quinta
-- costuma cair em processo, não em pessoa — que é onde a ação
-- corretiva funciona.
--
-- OS PORQUÊS NÃO SÃO OBRIGATÓRIOS. Nem todo achado precisa de cinco:
-- extintor desobstruído na hora não tem causa raiz. Obrigar viraria
-- gente escrevendo "porque sim" cinco vezes.
--
-- Depende de supabase/inspecoes.sql e supabase/inspecoes-incidentes.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.nao_conformidades') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;
end
$$;


-- ---------- 1. Matriz de risco -----------------------------------------
alter table public.nao_conformidades
  add column if not exists probabilidade smallint,
  add column if not exists severidade    smallint,
  add column if not exists porque_1 text,
  add column if not exists porque_2 text,
  add column if not exists porque_3 text,
  add column if not exists porque_4 text,
  add column if not exists porque_5 text;

alter table public.nao_conformidades drop constraint if exists nao_conformidades_probabilidade;
alter table public.nao_conformidades
  add constraint nao_conformidades_probabilidade
  check (probabilidade is null or probabilidade between 1 and 5);

alter table public.nao_conformidades drop constraint if exists nao_conformidades_severidade;
alter table public.nao_conformidades
  add constraint nao_conformidades_severidade
  check (severidade is null or severidade between 1 and 5);

-- O risco é o produto, calculado pelo banco: ninguém digita errado e
-- ninguém discute a conta.
alter table public.nao_conformidades drop column if exists risco;
alter table public.nao_conformidades
  add column risco smallint generated always as (probabilidade * severidade) stored;

create index if not exists nao_conformidades_risco on public.nao_conformidades (empresa_id, risco desc);


-- ---------- 2. A gravidade passa a sair da matriz -----------------------
-- Faixas: 1-4 baixa, 5-9 média, 10-14 alta, 15-25 crítica.
create or replace function public.nc_gravidade_do_risco(p_risco integer)
returns text
language sql
immutable
as $fn$
  select case
           when p_risco is null then null
           when p_risco <= 4  then 'baixa'
           when p_risco <= 9  then 'media'
           when p_risco <= 14 then 'alta'
           else 'critica'
         end;
$fn$;

revoke all on function public.nc_gravidade_do_risco(integer) from public, anon;
grant execute on function public.nc_gravidade_do_risco(integer) to authenticated;


-- ---------- 3. Ajustes na gravação -------------------------------------
-- Recriada inteira, por convenção deste projeto: é a versão de
-- supabase/inspecoes-incidentes.sql mais a matriz e os porquês.
create or replace function public.nao_conformidades_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_grav text;
begin
  new.descricao := btrim(coalesce(new.descricao, ''));
  if new.descricao = '' then
    raise exception 'Informe o que foi encontrado.';
  end if;

  new.acao_imediata   := nullif(btrim(coalesce(new.acao_imediata, '')), '');
  new.causa           := nullif(btrim(coalesce(new.causa, '')), '');
  new.acao_corretiva  := nullif(btrim(coalesce(new.acao_corretiva, '')), '');
  new.verificacao_obs := nullif(btrim(coalesce(new.verificacao_obs, '')), '');
  new.envolvido_nome  := nullif(btrim(coalesce(new.envolvido_nome, '')), '');
  new.local_do_evento := nullif(btrim(coalesce(new.local_do_evento, '')), '');
  new.testemunhas     := nullif(btrim(coalesce(new.testemunhas, '')), '');
  new.porque_1 := nullif(btrim(coalesce(new.porque_1, '')), '');
  new.porque_2 := nullif(btrim(coalesce(new.porque_2, '')), '');
  new.porque_3 := nullif(btrim(coalesce(new.porque_3, '')), '');
  new.porque_4 := nullif(btrim(coalesce(new.porque_4, '')), '');
  new.porque_5 := nullif(btrim(coalesce(new.porque_5, '')), '');

  if tg_op = 'INSERT' then
    if new.inspecao_id is not null then
      new.origem := 'inspecao';
    end if;
    new.aberta_por := coalesce(new.aberta_por, auth.uid());
    new.created_at := now();
  else
    new.empresa_id  := old.empresa_id;
    new.inspecao_id := old.inspecao_id;
    new.resposta_id := old.resposta_id;
    new.aberta_por  := old.aberta_por;
    new.created_at  := old.created_at;
    new.origem      := old.origem;
  end if;

  -- Preencheu a matriz: a gravidade vem dela, e não do olho de quem
  -- está preenchendo. Sem matriz, continua valendo o que foi escolhido.
  v_grav := public.nc_gravidade_do_risco(new.probabilidade * new.severidade);
  if v_grav is not null then
    new.gravidade := v_grav;
  end if;

  if new.origem = 'incidente' then
    if new.ocorrido_em is null then
      raise exception 'Informe quando o incidente aconteceu.';
    end if;
    if new.ocorrido_em > now() + interval '1 hour' then
      raise exception 'A data do incidente está no futuro.';
    end if;
    if new.tipo_incidente is null then
      raise exception 'Informe o tipo do incidente.';
    end if;
  else
    new.ocorrido_em      := null;
    new.tipo_incidente   := null;
    new.afastamento_dias := null;
  end if;

  if new.tipo_incidente = 'acidente_com_afastamento'
     and coalesce(new.afastamento_dias, 0) < 1 then
    raise exception 'Acidente com afastamento precisa dos dias de afastamento.';
  end if;

  if new.tipo_incidente = 'acidente_sem_afastamento' then
    new.afastamento_dias := 0;
  end if;

  if new.situacao = 'encerrada' and coalesce(old.situacao, '') <> 'encerrada' then
    if new.causa is null or new.acao_corretiva is null then
      raise exception 'Para encerrar, informe a causa e a ação corretiva.';
    end if;

    -- Risco alto ou crítico sem nenhum porquê é análise que não houve.
    -- Abaixo disso o roteiro não é cobrado: extintor desobstruído na
    -- hora não tem causa raiz.
    if coalesce(new.risco, 0) >= 10
       and new.porque_1 is null and new.porque_2 is null
       and new.porque_3 is null and new.porque_4 is null and new.porque_5 is null then
      raise exception 'Risco alto: preencha ao menos o primeiro porquê antes de encerrar.';
    end if;

    if new.verificada_em is null then
      new.verificada_em  := now();
      new.verificada_por := coalesce(new.verificada_por, auth.uid());
    end if;
    new.encerrada_em := coalesce(new.encerrada_em, now());
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists nao_conformidades_ajustes on public.nao_conformidades;
create trigger nao_conformidades_ajustes
  before insert or update on public.nao_conformidades
  for each row execute function public.nao_conformidades_ajustes();


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.nao_conformidades)                          as ncs,
       (select count(*) from public.nao_conformidades where risco is not null)  as com_matriz,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'nao_conformidades'
           and column_name in ('probabilidade', 'severidade', 'risco',
                               'porque_1', 'porque_5'))                         as campos_novos,
       public.nc_gravidade_do_risco(20)                                         as teste_faixa;
