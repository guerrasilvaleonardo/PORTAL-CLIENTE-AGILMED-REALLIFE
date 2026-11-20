-- =====================================================================
-- Auditoria vira ferramenta vendida à parte.
--
-- ANTES:  auditoria era um tipo de inspeção, e quem contratava
--         Inspeções levava a auditoria de certificação junto.
-- DEPOIS: modulo_auditoria, separado de modulo_inspecoes. Quem compra
--         auditoria não vê inspeção, e quem compra inspeção não vê
--         auditoria.
-- MOTIVO: decisão dele em 20/11/2026 — é outro serviço, com outro
--         preço, como o EPI.
--
-- AS TABELAS CONTINUAM AS MESMAS. Auditoria e inspeção guardam a mesma
-- coisa: um checklist respondido que vira não conformidade com causa,
-- ação e verificação. Duplicar o banco criaria dois lugares para
-- procurar o mesmo documento e o dobro de manutenção. O que separa é a
-- coluna tipo, que já existe — e agora a política de leitura.
--
-- A SEPARAÇÃO É COMERCIAL E DE TELA, NÃO DE DADOS.
--
-- Depende de supabase/inspecoes-modo-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.inspecoes') is null then
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


-- ---------- 1. A marcação ----------------------------------------------
alter table public.empresas
  add column if not exists modulo_auditoria boolean not null default false;

create or replace function public.empresa_tem_modulo(p_empresa uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_modulo
             when 'certificados' then e.modulo_certificados
             when 'treinamentos' then e.modulo_treinamentos
             when 'documentos'   then e.modulo_documentos
             when 'epi'          then e.modulo_epi
             when 'inspecoes'    then e.modulo_inspecoes
             when 'auditoria'    then e.modulo_auditoria
           end
    from public.empresas e
    where e.id = p_empresa
  ), false);
$$;


-- ---------- 2. A leitura passa a olhar o tipo ---------------------------
-- Equipe interna vê tudo. Cliente vê o que contratou: auditoria pela
-- marcação de auditoria, o resto pela de inspeções.
drop policy if exists inspecoes_modulo_contratado on public.inspecoes;
create policy inspecoes_modulo_contratado
  on public.inspecoes
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or (inspecoes.tipo = 'auditoria'
        and public.empresa_tem_modulo(inspecoes.empresa_id, 'auditoria'))
    or (inspecoes.tipo <> 'auditoria'
        and public.empresa_tem_modulo(inspecoes.empresa_id, 'inspecoes'))
  );

-- A não conformidade segue a inspeção de onde nasceu. A avulsa e a de
-- incidente não vêm de auditoria, então seguem a marcação de inspeções.
drop policy if exists nao_conformidades_modulo_contratado on public.nao_conformidades;
create policy nao_conformidades_modulo_contratado
  on public.nao_conformidades
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or (
      exists (
        select 1 from public.inspecoes i
         where i.id = nao_conformidades.inspecao_id
           and i.tipo = 'auditoria'
      )
      and public.empresa_tem_modulo(nao_conformidades.empresa_id, 'auditoria')
    )
    or (
      not exists (
        select 1 from public.inspecoes i
         where i.id = nao_conformidades.inspecao_id
           and i.tipo = 'auditoria'
      )
      and public.empresa_tem_modulo(nao_conformidades.empresa_id, 'inspecoes')
    )
  );

-- Modelo de checklist: o de auditoria só para quem tem auditoria.
drop policy if exists inspecao_modelos_modulo_contratado on public.inspecao_modelos;
create policy inspecao_modelos_modulo_contratado
  on public.inspecao_modelos
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or inspecao_modelos.empresa_id is null
    or (inspecao_modelos.tipo = 'auditoria'
        and public.empresa_tem_modulo(inspecao_modelos.empresa_id, 'auditoria'))
    or (inspecao_modelos.tipo <> 'auditoria'
        and public.empresa_tem_modulo(inspecao_modelos.empresa_id, 'inspecoes'))
  );

-- O programa de auditoria é do módulo de auditoria.
drop policy if exists auditoria_programas_modulo_contratado on public.auditoria_programas;
create policy auditoria_programas_modulo_contratado
  on public.auditoria_programas
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or public.empresa_tem_modulo(auditoria_programas.empresa_id, 'auditoria')
  );


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.empresas where modulo_auditoria)            as com_auditoria,
       (select count(*) from public.empresas where modulo_inspecoes)            as com_inspecoes,
       (select public.empresa_tem_modulo(
                 (select id from public.empresas order by razao_social limit 1), 'auditoria'))
                                                                                as teste_funcao,
       (select count(*) from pg_policies
         where schemaname = 'public'
           and policyname like '%_modulo_contratado')                           as politicas_de_modulo;
