-- =====================================================================
-- Leitura do andamento do EAD (treinamentos_progresso) pelo cliente.
--
-- ANTES:  o cliente (ex.: Thermoset) via os certificados dos seus
--         colaboradores, mas o andamento do EAD vinha vazio: todos
--         apareciam como "Sem matrícula". A equipe interna via normal.
--         A regra de leitura da tabela não reconhecia o cliente como
--         dono daquelas matrículas (empresa ativa diferente, várias
--         empresas, ou e-mail com maiúsculas/espaços).
-- DEPOIS: regra única e explícita de leitura:
--         - equipe interna ativa (atendimento, gestor, admin): tudo;
--         - cliente ativo: as matrículas cujo e-mail é de um colaborador
--           com certificado em QUALQUER empresa dele
--           (usuario_pertence_empresa), comparando e-mail sem
--           maiúsculas e sem espaços.
-- MOTIVO: o cliente voltar a ver o andamento dos treinamentos dos seus
--         colaboradores, sem enxergar os de outras empresas.
--
-- Só cria/atualiza a regra de LEITURA. Não altera nem apaga dados e não
-- mexe nas regras de gravação (quem grava é o servidor, com a chave de
-- serviço). Depende de supabase/usuarios-varias-empresas.sql.
-- Pode rodar mais de uma vez.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.usuario_pertence_empresa(uuid, uuid)') is null then
    raise exception 'Rode antes supabase/usuarios-varias-empresas.sql (falta a função usuario_pertence_empresa).';
  end if;
end
$$;

-- Busca rápida do certificado pelo e-mail normalizado.
create index if not exists certificados_email_normalizado
  on public.certificados (lower(btrim(email_colaborador)))
  where email_colaborador is not null;

create or replace function public.pode_ver_progresso_ead(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and coalesce(p.ativo, true)
       and (
         p.perfil in ('atendimento', 'gestor', 'admin')
         or (
           p.perfil = 'cliente'
           and exists (
             select 1
               from public.certificados c
              where c.email_colaborador is not null
                and lower(btrim(c.email_colaborador)) = lower(btrim(p_email))
                and public.usuario_pertence_empresa(p.id, c.empresa_id)
           )
         )
       )
  );
$fn$;

revoke all on function public.pode_ver_progresso_ead(text) from public, anon;
grant execute on function public.pode_ver_progresso_ead(text) to authenticated;

alter table public.treinamentos_progresso enable row level security;

drop policy if exists treinamentos_progresso_leitura_portal on public.treinamentos_progresso;
create policy treinamentos_progresso_leitura_portal
  on public.treinamentos_progresso for select to authenticated
  using (public.pode_ver_progresso_ead(email));

grant select on public.treinamentos_progresso to authenticated;


-- ---------- Conferência -------------------------------------------------
-- Regras de leitura da tabela (a nova é treinamentos_progresso_leitura_portal).
select policyname, cmd, roles
  from pg_policies
 where schemaname = 'public' and tablename = 'treinamentos_progresso'
 order by policyname;

-- Quantas matrículas cada cliente da Thermoset passa a enxergar
-- (deve ser maior que zero).
select u.email,
       (select count(*)
          from public.treinamentos_progresso t
         where exists (
           select 1 from public.certificados c
            where lower(btrim(c.email_colaborador)) = lower(btrim(t.email))
              and public.usuario_pertence_empresa(p.id, c.empresa_id)
         )) as matriculas_visiveis
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.empresas e on e.id = p.empresa_id
 where p.perfil = 'cliente'
   and coalesce(e.nome_fantasia, e.razao_social) ilike 'thermoset%';
