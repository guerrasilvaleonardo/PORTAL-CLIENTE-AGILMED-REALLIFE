-- =====================================================================
-- Ferramentas contratadas por empresa (Certificados, Treinamentos e
-- Documentos SST).
--
-- ANTES:  todo cliente via Certificados, Treinamentos e Documentos SST.
-- DEPOIS: cada empresa tem três marcações (uma por ferramenta). Sem a
--         marcação, o cliente vê a ferramenta com cadeado e pede a
--         contratação por chamado; o banco também não entrega os dados
--         dela ao cliente. A equipe continua vendo tudo.
-- MOTIVO: as ferramentas passam a ser cobradas à parte.
--
-- As empresas que já existem ficam com TUDO LIBERADO (padrão true), ou
-- seja, nada muda para elas até você desmarcar no cadastro da empresa.
-- Não apaga nem altera dados. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.empresas
  add column if not exists modulo_certificados  boolean not null default true,
  add column if not exists modulo_treinamentos  boolean not null default true,
  add column if not exists modulo_documentos    boolean not null default true;

-- Equipe interna (atendimento, gestor, admin) ativa.
create or replace function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.ativo = true
      and p.perfil in ('atendimento', 'gestor', 'admin')
  );
$$;

-- Empresa com a ferramenta liberada.
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
           end
    from public.empresas e
    where e.id = p_empresa
  ), false);
$$;

-- Políticas RESTRITIVAS: somam-se às que já existem (não as substituem).
-- O cliente só lê certificados/documentos se a empresa contratou.
-- Certificados também alimentam a tela Treinamentos: libera se a
-- empresa tiver Certificados OU Treinamentos.
drop policy if exists certificados_modulo_contratado on public.certificados;
create policy certificados_modulo_contratado
  on public.certificados
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or public.empresa_tem_modulo(certificados.empresa_id, 'certificados')
    or public.empresa_tem_modulo(certificados.empresa_id, 'treinamentos')
  );

drop policy if exists documentos_sst_modulo_contratado on public.documentos_sst;
create policy documentos_sst_modulo_contratado
  on public.documentos_sst
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or public.empresa_tem_modulo(documentos_sst.empresa_id, 'documentos')
  );

-- Conferência: empresas e o que cada uma tem liberado.
select coalesce(nome_fantasia, razao_social) as empresa,
       modulo_certificados, modulo_treinamentos, modulo_documentos
from public.empresas
order by 1;
