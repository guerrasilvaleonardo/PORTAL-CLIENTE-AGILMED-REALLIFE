-- =====================================================================
-- EPI entra nas ferramentas contratadas.
--
-- ANTES:  o cadastro da empresa tinha três marcações — Certificados,
--         Treinamentos e Documentos SST. EPI nasceu hoje e ficou de
--         fora: aparecia para todo cliente, contratado ou não.
-- DEPOIS: quarta marcação, modulo_epi, com o mesmo comportamento das
--         outras: sem ela o cliente vê a ferramenta com cadeado, pede a
--         contratação por chamado e o banco não entrega os dados dela.
--         A equipe interna continua vendo tudo.
-- MOTIVO: EPI é ferramenta cobrada à parte, como as outras três.
--
-- ATENÇÃO — O PADRÃO AQUI É false, AO CONTRÁRIO DAS OUTRAS TRÊS. Elas
-- nasceram com default true porque já estavam em uso e desligá-las
-- quebraria o que o cliente via. EPI é novo: ninguém contratou ainda, e
-- marcar 150 empresas como contratantes seria dizer uma coisa que não
-- aconteceu. Marque empresa por empresa, no cadastro, conforme vender.
--
-- Depende de supabase/modulos-cliente.sql, supabase/epis.sql e
-- supabase/epi-entregas.sql.
-- Não apaga nem altera dados. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regprocedure('public.empresa_tem_modulo(uuid, text)') is null then
    raise exception 'Rode antes supabase/modulos-cliente.sql.';
  end if;
  if to_regclass('public.epi_entregas') is null then
    raise exception 'Rode antes supabase/epi-entregas.sql.';
  end if;
end
$$;


-- ---------- 1. A marcação ----------------------------------------------
alter table public.empresas
  add column if not exists modulo_epi boolean not null default false;


-- ---------- 2. A função passa a conhecer a quarta ferramenta -----------
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
           end
    from public.empresas e
    where e.id = p_empresa
  ), false);
$$;


-- ---------- 3. Políticas restritivas ------------------------------------
-- Somam-se às que já existem, não as substituem. Valem só para a leitura
-- pelo cliente: a equipe interna passa sempre.
--
-- Colaboradores e locais de trabalho ficam DE FORA de propósito: eles
-- não são do módulo de EPI, são cadastros da empresa que outras telas
-- também usam.
drop policy if exists epis_modulo_contratado on public.epis;
create policy epis_modulo_contratado
  on public.epis
  as restrictive
  for select to authenticated
  using (public.eh_equipe() or public.empresa_tem_modulo(epis.empresa_id, 'epi'));

drop policy if exists epi_entregas_modulo_contratado on public.epi_entregas;
create policy epi_entregas_modulo_contratado
  on public.epi_entregas
  as restrictive
  for select to authenticated
  using (public.eh_equipe() or public.empresa_tem_modulo(epi_entregas.empresa_id, 'epi'));

-- O item não tem empresa própria: segue a entrega dele.
drop policy if exists epi_entregas_itens_modulo_contratado on public.epi_entregas_itens;
create policy epi_entregas_itens_modulo_contratado
  on public.epi_entregas_itens
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or exists (
      select 1 from public.epi_entregas e
       where e.id = epi_entregas_itens.entrega_id
         and public.empresa_tem_modulo(e.empresa_id, 'epi')
    )
  );


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.empresas)                                   as empresas,
       (select count(*) from public.empresas where modulo_epi)                  as com_epi,
       (select public.empresa_tem_modulo(
                 (select id from public.empresas order by razao_social limit 1), 'epi'))
                                                                                as teste_funcao,
       (select count(*) from pg_policies
         where schemaname = 'public'
           and policyname like '%_modulo_contratado')                           as politicas_de_modulo;
