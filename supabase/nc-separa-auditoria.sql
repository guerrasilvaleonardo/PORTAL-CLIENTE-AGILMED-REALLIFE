-- =====================================================================
-- A constatação de auditoria não se mistura com a de inspeção.
--
-- ANTES:  nao_conformidades não sabia de onde vinha. A tela de
--         constatações mostrava tudo junto — o extintor vencido no
--         canteiro e o requisito 9.3 da ISO 45001 na mesma lista.
-- DEPOIS: a linha carrega `tipo`, herdado da inspeção/auditoria que a
--         abriu. Cada tela filtra o que é dela.
-- MOTIVO: ele em 20/11/2026: "não é para gerar dentro das inspeções os
--         resultados da auditoria, são processos diferentes".
--
-- POR QUE UMA COLUNA, E NÃO UM JOIN NA TELA. Filtrar por join obrigaria
-- cada tela a trazer todas as linhas e jogar fora metade no navegador.
-- Com a coluna, o filtro vai no banco, entra no índice, e o relatório
-- de auditoria soma só o que é auditoria.
--
-- POR QUE UM GATILHO PRÓPRIO. A tabela já tem gatilho — o da matriz de
-- risco e dos cinco porquês. Recriá-lo só para acrescentar uma linha
-- arriscaria perder regra por descuido. Este é separado e só faz isto.
--
-- O TIPO É IMUTÁVEL, como a origem: constatação não troca de processo
-- no meio do caminho. Quem errou cancela e abre de novo.
--
-- INCIDENTE CONTINUA SENDO INSPEÇÃO. Acidente e quase-acidente nascem
-- sem inspecao_id e ficam com 'inspecao': são do mundo de SSMA em
-- campo, não da auditoria do sistema de gestão.
--
-- Depende de supabase/inspecoes.sql e supabase/inspecoes-modo-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.nao_conformidades') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'inspecoes' and column_name = 'tipo'
  ) then
    raise exception 'Rode antes supabase/inspecoes-modo-auditoria.sql.';
  end if;
end
$$;


-- ---------- 1. A coluna -------------------------------------------------
alter table public.nao_conformidades
  add column if not exists tipo text not null default 'inspecao';

alter table public.nao_conformidades drop constraint if exists nao_conformidades_tipo;
alter table public.nao_conformidades
  add constraint nao_conformidades_tipo check (tipo in ('inspecao', 'auditoria'));


-- ---------- 2. Conserta o que já está lá --------------------------------
-- As constatações abertas antes desta migração nasceram sem tipo. Quem
-- veio de auditoria passa a ser auditoria; o resto já está certo no
-- padrão.
update public.nao_conformidades n
   set tipo = i.tipo
  from public.inspecoes i
 where i.id = n.inspecao_id
   and n.tipo <> i.tipo;


-- ---------- 3. Daqui para frente, o banco preenche ----------------------
create or replace function public.nao_conformidades_tipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    if new.inspecao_id is not null then
      select i.tipo into v_tipo from public.inspecoes i where i.id = new.inspecao_id;
    end if;
    new.tipo := coalesce(v_tipo, 'inspecao');
  else
    -- Imutável, como a origem.
    new.tipo := old.tipo;
  end if;

  return new;
end;
$fn$;

drop trigger if exists aa_nao_conformidades_tipo on public.nao_conformidades;
create trigger aa_nao_conformidades_tipo
  before insert or update on public.nao_conformidades
  for each row execute function public.nao_conformidades_tipo();


-- ---------- 4. Índice ---------------------------------------------------
create index if not exists nao_conformidades_tipo_idx
  on public.nao_conformidades (empresa_id, tipo, situacao);


-- ---------- Conferência -------------------------------------------------
-- Nenhuma linha pode discordar da inspeção que a abriu.
select (select count(*) from public.nao_conformidades where tipo = 'auditoria') as de_auditoria,
       (select count(*) from public.nao_conformidades where tipo = 'inspecao')  as de_inspecao,
       (select count(*)
          from public.nao_conformidades n
          join public.inspecoes i on i.id = n.inspecao_id
         where n.tipo <> i.tipo)                                                as discordantes;
