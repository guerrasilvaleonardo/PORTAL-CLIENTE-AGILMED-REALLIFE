-- =====================================================================
-- Documentos SST: desativar documento que a empresa não vai renovar.
--
-- ANTES:  o documento só podia ficar "vigente" (com alertas por e-mail e
--         chamado automático de renovação a 60 dias) ou ser REMOVIDO do
--         portal. Não havia como dizer "a empresa não vai renovar" sem
--         apagar o histórico.
-- DEPOIS: nova situação "desativado":
--   * sai da lista principal e dos indicadores, para de gerar e-mail de
--     alerta e não abre chamado automático (o cron só olha "vigente");
--   * continua guardado, com motivo, data e quem desativou, numa seção
--     "Desativados" da tela (equipe e cliente veem);
--   * a equipe pode reativar (volta a ser vigente);
--   * cada desativação e reativação fica anotada também em Observações.
--   Só a equipe (atendimento, gestor, admin) desativa ou reativa, com
--   motivo obrigatório para desativar.
-- MOTIVO: documento que a empresa não vai renovar não deve continuar
--         gerando alerta nem chamado de renovação.
--
-- Não apaga nem altera dados existentes. Pode rodar mais de uma vez.
-- Depende de supabase/documentos-sst.sql.
-- =====================================================================

-- ---------- 1. Nova situação e campos da desativação --------------------
alter table public.documentos_sst
  drop constraint if exists documentos_sst_situacao_check;

alter table public.documentos_sst
  add constraint documentos_sst_situacao_check
  check (situacao in ('vigente', 'substituido', 'desativado'));

alter table public.documentos_sst
  add column if not exists desativado_em      timestamptz,
  add column if not exists desativado_por     uuid references public.profiles (id) on delete set null,
  add column if not exists motivo_desativacao text;


-- ---------- 2. Desativar -----------------------------------------------
create or replace function public.desativar_documento_sst(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_mot   text := btrim(coalesce(p_motivo, ''));
  v_sit   text;
  v_quem  text;
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.ativo = true
                    and p.perfil in ('atendimento', 'gestor', 'admin')) then
    raise exception 'Somente a equipe pode desativar documentos.';
  end if;
  if char_length(v_mot) < 5 then
    raise exception 'Informe o motivo da desativação (mínimo de 5 caracteres).';
  end if;

  select situacao into v_sit from public.documentos_sst where id = p_id for update;
  if not found then raise exception 'Documento não encontrado.'; end if;
  if v_sit <> 'vigente' then
    raise exception 'Só é possível desativar documento vigente (situação atual: %).', v_sit;
  end if;

  select nome into v_quem from public.profiles where id = auth.uid();

  update public.documentos_sst
     set situacao           = 'desativado',
         desativado_em      = now(),
         desativado_por     = auth.uid(),
         motivo_desativacao = v_mot,
         observacoes        = concat_ws(E'\n', nullif(btrim(coalesce(observacoes, '')), ''),
                                '[' || to_char(now() at time zone 'America/Porto_Velho', 'DD/MM/YYYY') || '] Desativado por '
                                || coalesce(v_quem, 'equipe') || ': ' || v_mot)
   where id = p_id;
end;
$fn$;

revoke all on function public.desativar_documento_sst(uuid, text) from public, anon;
grant execute on function public.desativar_documento_sst(uuid, text) to authenticated;


-- ---------- 3. Reativar ------------------------------------------------
-- Volta a ser vigente (alertas e chamado automático voltam a valer).
-- Os campos da última desativação são limpos; o registro fica nas
-- Observações.
create or replace function public.reativar_documento_sst(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sit  text;
  v_quem text;
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.ativo = true
                    and p.perfil in ('atendimento', 'gestor', 'admin')) then
    raise exception 'Somente a equipe pode reativar documentos.';
  end if;

  select situacao into v_sit from public.documentos_sst where id = p_id for update;
  if not found then raise exception 'Documento não encontrado.'; end if;
  if v_sit <> 'desativado' then
    raise exception 'Só é possível reativar documento desativado (situação atual: %).', v_sit;
  end if;

  select nome into v_quem from public.profiles where id = auth.uid();

  update public.documentos_sst
     set situacao           = 'vigente',
         desativado_em      = null,
         desativado_por     = null,
         motivo_desativacao = null,
         observacoes        = concat_ws(E'\n', nullif(btrim(coalesce(observacoes, '')), ''),
                                '[' || to_char(now() at time zone 'America/Porto_Velho', 'DD/MM/YYYY') || '] Reativado por '
                                || coalesce(v_quem, 'equipe') || '.')
   where id = p_id;
end;
$fn$;

revoke all on function public.reativar_documento_sst(uuid) from public, anon;
grant execute on function public.reativar_documento_sst(uuid) to authenticated;


-- ---------- Conferência -------------------------------------------------
select
  (select count(*) from pg_proc where proname in ('desativar_documento_sst', 'reativar_documento_sst')) as funcoes, -- esperado: 2
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'documentos_sst'
      and column_name in ('desativado_em', 'desativado_por', 'motivo_desativacao'))           as colunas, -- esperado: 3
  (select count(*) from public.documentos_sst where situacao = 'desativado')                  as desativados;
