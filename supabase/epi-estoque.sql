-- =====================================================================
-- Estoque do EPI.
--
-- ANTES:  o cadastro dizia o que a empresa entrega, não quanto ela tem.
--         Ninguém sabia se ia faltar bota antes de faltar, e a entrega
--         saía mesmo com a prateleira vazia.
-- DEPOIS: cada equipamento tem estoque e estoque mínimo. A entrega
--         desconta, o cancelamento devolve, e a empresa pode escolher
--         bloquear a entrega quando o estoque chega a zero.
-- MOTIVO: é o que a tela de Configuração de EPI's do OnSafety tem e a
--         nossa não tinha — e é o que avisa antes, não depois.
--
-- DEVOLUÇÃO NÃO VOLTA PARA O ESTOQUE, DE PROPÓSITO. A bota que voltou
-- do pé de alguém não vira bota nova na prateleira: ela é descartada,
-- lavada, guardada à parte. Quem quiser recontar ajusta o número na
-- tela, que é onde essa decisão deve estar — não num gatilho.
--
-- ESTOQUE NEGATIVO É PERMITIDO quando o bloqueio está desligado. Quem
-- não controla estoque de verdade não pode ser impedido de registrar
-- uma entrega que aconteceu: o número errado é problema menor do que a
-- ficha faltando.
--
-- Depende de supabase/epis.sql e supabase/epi-entregas.sql.
-- Não altera nem apaga nada do que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.epis') is null then
    raise exception 'Rode antes supabase/epis.sql.';
  end if;
  if to_regclass('public.epi_entregas_itens') is null then
    raise exception 'Rode antes supabase/epi-entregas.sql.';
  end if;
end
$$;


-- ---------- 1. Campos novos ---------------------------------------------
alter table public.epis
  add column if not exists estoque         integer not null default 0,
  add column if not exists estoque_minimo  integer not null default 0,
  -- Foto do equipamento, no balde das fotos de EPI. Serve para quem
  -- entrega conferir se pegou o item certo da prateleira.
  add column if not exists foto_path       text;

alter table public.epis drop constraint if exists epis_estoque_sensato;
alter table public.epis
  add constraint epis_estoque_sensato
  check (estoque between -100000 and 1000000 and estoque_minimo between 0 and 1000000);

-- A empresa decide se a falta de estoque impede a entrega.
alter table public.empresas
  add column if not exists epi_bloquear_sem_estoque boolean not null default false;

create index if not exists epis_estoque_baixo
  on public.epis (empresa_id)
  where ativo and estoque <= estoque_minimo;


-- ---------- 2. A entrega mexe no estoque ---------------------------------
-- Desconta ao entregar e devolve se a entrega for cancelada. O item em
-- si é imutável depois de gravado (epi-devolucao.sql), então só o
-- INSERT desconta; a volta acontece no cancelamento da entrega.
create or replace function public.epi_estoque_na_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bloqueia boolean;
  v_tem integer;
begin
  if new.epi_id is null then
    return new;
  end if;

  select e.epi_bloquear_sem_estoque into v_bloqueia
    from public.epi_entregas en
    join public.empresas e on e.id = en.empresa_id
   where en.id = new.entrega_id;

  select epi.estoque into v_tem from public.epis epi where epi.id = new.epi_id;

  if coalesce(v_bloqueia, false) and coalesce(v_tem, 0) < new.quantidade then
    raise exception 'Sem estoque de "%": há % e a entrega pede %.',
      new.nome, coalesce(v_tem, 0), new.quantidade;
  end if;

  update public.epis
     set estoque = estoque - new.quantidade, atualizado_em = now()
   where id = new.epi_id;

  return new;
end;
$fn$;

drop trigger if exists epi_estoque_na_entrega on public.epi_entregas_itens;
create trigger epi_estoque_na_entrega
  after insert on public.epi_entregas_itens
  for each row execute function public.epi_estoque_na_entrega();


-- Entrega cancelada devolve o que tinha saído: ela não aconteceu.
create or replace function public.epi_estoque_no_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.cancelada_em is not null and old.cancelada_em is null then
    update public.epis epi
       set estoque = epi.estoque + i.quantidade, atualizado_em = now()
      from public.epi_entregas_itens i
     where i.entrega_id = new.id and i.epi_id = epi.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists epi_estoque_no_cancelamento on public.epi_entregas;
create trigger epi_estoque_no_cancelamento
  after update on public.epi_entregas
  for each row execute function public.epi_estoque_no_cancelamento();


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.epis)                                      as equipamentos,
       (select count(*) from public.epis where ativo and estoque <= estoque_minimo)
                                                                               as no_minimo_ou_abaixo,
       (select count(*) from public.empresas where epi_bloquear_sem_estoque)   as empresas_que_bloqueiam,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'epis'
           and column_name in ('estoque', 'estoque_minimo', 'foto_path'))      as campos_novos,
       (select count(*) from pg_trigger
         where tgname in ('epi_estoque_na_entrega', 'epi_estoque_no_cancelamento'))
                                                                               as gatilhos;
