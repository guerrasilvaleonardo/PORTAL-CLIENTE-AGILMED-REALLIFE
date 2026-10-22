-- =====================================================================
-- Um usuário do cliente em VÁRIAS empresas (CNPJs), com "empresa ativa".
--
-- ANTES:  cada usuário pertencia a uma única empresa (profiles.empresa_id).
--         Quem cuida de vários CNPJs do mesmo grupo precisava de outro
--         e-mail, e o cadastro recusava ("e-mail já registrado").
-- DEPOIS: nova tabela usuario_empresas com as empresas que a pessoa pode
--         atender. profiles.empresa_id passa a ser a EMPRESA ATIVA: o
--         cliente troca no topo do portal (ou ao abrir um chamado) entre
--         as empresas dele. Todas as regras de acesso atuais continuam
--         valendo para a empresa ativa (nada mais é liberado).
--         Só gestor e admin ligam uma pessoa a outras empresas (pela tela
--         de Usuários, que grava com a chave de serviço).
--         Participante e solicitante de chamado aceitam qualquer empresa
--         da pessoa; e-mails do portal chegam de todas as empresas dela.
-- MOTIVO: grupos com vários CNPJs e um responsável em comum.
--
-- Cada usuário atual entra na tabela com a empresa que já tem. Não apaga
-- nem altera usuários, chamados ou empresas. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.usuario_empresas (
  usuario_id     uuid not null references public.profiles (id) on delete cascade,
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  adicionado_por uuid references public.profiles (id) on delete set null,
  adicionado_em  timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);

create index if not exists usuario_empresas_empresa on public.usuario_empresas (empresa_id);

alter table public.usuario_empresas enable row level security;

drop policy if exists usuario_empresas_leitura on public.usuario_empresas;
create policy usuario_empresas_leitura on public.usuario_empresas
  for select to authenticated
  using (usuario_id = auth.uid() or public.e_equipe_interna());

grant select on public.usuario_empresas to authenticated;
revoke insert, update, delete on public.usuario_empresas from anon, authenticated;

-- Quem já existe: a empresa atual vira a primeira da lista.
insert into public.usuario_empresas (usuario_id, empresa_id)
select p.id, p.empresa_id from public.profiles p
 where p.empresa_id is not null
on conflict do nothing;


-- ---------- Pertence à empresa? ----------------------------------------
create or replace function public.usuario_pertence_empresa(p_usuario uuid, p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.usuario_empresas ue
                  where ue.usuario_id = p_usuario and ue.empresa_id = p_empresa)
      or exists (select 1 from public.profiles p
                  where p.id = p_usuario and p.empresa_id = p_empresa);
$fn$;

revoke all on function public.usuario_pertence_empresa(uuid, uuid) from public, anon;
grant execute on function public.usuario_pertence_empresa(uuid, uuid) to authenticated;


-- ---------- Empresa ativa sempre está na lista --------------------------
-- Cadastro e edição pela tela de Usuários gravam profiles.empresa_id; o
-- gatilho garante a linha correspondente em usuario_empresas.
create or replace function public.usuario_empresas_sincronizar()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.empresa_id is not null then
    insert into public.usuario_empresas (usuario_id, empresa_id, adicionado_por)
    values (new.id, new.empresa_id, auth.uid())
    on conflict do nothing;
  end if;
  return null;
end;
$fn$;

drop trigger if exists usuario_empresas_sincronizar on public.profiles;
create trigger usuario_empresas_sincronizar
  after insert or update of empresa_id on public.profiles
  for each row execute function public.usuario_empresas_sincronizar();


-- ---------- Troca da empresa ativa (pelo próprio usuário) ---------------
-- O gatilho proteger_campos_sensiveis_profile impede o usuário de mudar a
-- própria empresa. A troca passa por aqui: a função marca a troca pedida
-- e o gatilho abaixo (que roda DEPOIS do protetor) aplica, só se a
-- empresa estiver na lista da pessoa.
create or replace function public.profiles_aplicar_troca_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_pedido text := current_setting('app.troca_empresa', true);
  v_emp    uuid;
begin
  if v_pedido is null or v_pedido = '' or split_part(v_pedido, ':', 1) <> new.id::text then
    return new;
  end if;
  v_emp := nullif(split_part(v_pedido, ':', 2), '')::uuid;
  if v_emp is not null and exists (select 1 from public.usuario_empresas ue
                                    where ue.usuario_id = new.id and ue.empresa_id = v_emp) then
    new.empresa_id := v_emp;
  end if;
  return new;
end;
$fn$;

drop trigger if exists zz_profiles_aplicar_troca_empresa on public.profiles;
create trigger zz_profiles_aplicar_troca_empresa
  before update on public.profiles
  for each row execute function public.profiles_aplicar_troca_empresa();

create or replace function public.trocar_empresa_ativa(p_empresa uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_atual uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not exists (select 1 from public.usuario_empresas ue
                  where ue.usuario_id = auth.uid() and ue.empresa_id = p_empresa) then
    raise exception 'Você não tem acesso a esta empresa.';
  end if;

  perform set_config('app.troca_empresa', auth.uid()::text || ':' || p_empresa::text, true);
  update public.profiles set updated_at = now() where id = auth.uid();
  perform set_config('app.troca_empresa', '', true);

  select empresa_id into v_atual from public.profiles where id = auth.uid();
  if v_atual is distinct from p_empresa then
    raise exception 'Não foi possível trocar a empresa ativa.';
  end if;
  return v_atual;
end;
$fn$;

revoke all on function public.trocar_empresa_ativa(uuid) from public, anon;
grant execute on function public.trocar_empresa_ativa(uuid) to authenticated;

-- Link de e-mail para chamado de outra empresa da pessoa: troca para a
-- empresa do chamado (se a pessoa pertence a ela) e a tela recarrega.
create or replace function public.trocar_para_empresa_do_chamado(p_chamado uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_emp uuid;
begin
  select empresa_id into v_emp from public.chamados where id = p_chamado;
  if v_emp is null then raise exception 'Chamado não encontrado.'; end if;
  return public.trocar_empresa_ativa(v_emp);
end;
$fn$;

revoke all on function public.trocar_para_empresa_do_chamado(uuid) from public, anon;
grant execute on function public.trocar_para_empresa_do_chamado(uuid) to authenticated;

-- Empresas da pessoa logada (para o seletor no topo).
create or replace function public.minhas_empresas()
returns table (id uuid, nome text, razao_social text, ativa boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  select e.id,
         coalesce(e.nome_fantasia, e.razao_social)::text,
         e.razao_social::text,
         e.id = (select p.empresa_id from public.profiles p where p.id = auth.uid())
    from public.usuario_empresas ue
    join public.empresas e on e.id = ue.empresa_id
   where ue.usuario_id = auth.uid()
   order by 2;
$fn$;

revoke all on function public.minhas_empresas() from public, anon;
grant execute on function public.minhas_empresas() to authenticated;


-- ---------- Participante e solicitante: qualquer empresa da pessoa ------
create or replace function public.chamado_participantes_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.profiles p
      join public.chamados c on c.id = new.chamado_id
     where p.id = new.usuario_id
       and p.perfil = 'cliente'
       and p.ativo = true
       and public.usuario_pertence_empresa(p.id, c.empresa_id)
  ) then
    raise exception 'Participante precisa ser um usuário ativo da empresa do chamado.';
  end if;
  new.adicionado_por := coalesce(new.adicionado_por, auth.uid());
  return new;
end;
$fn$;

create or replace function public.chamado_solicitante_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  /* Chamado mudou de empresa: o solicitante antigo deixa de valer. */
  if tg_op = 'UPDATE'
     and new.empresa_id is distinct from old.empresa_id
     and new.solicitante_id is not distinct from old.solicitante_id then
    new.solicitante_id := null;
  end if;

  if new.solicitante_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.profiles p
      join public.empresas e on e.id = new.empresa_id
     where p.id = new.solicitante_id
       and coalesce(p.ativo, true)
       and ((p.perfil = 'cliente' and public.usuario_pertence_empresa(p.id, new.empresa_id))
            or (e.interna and p.perfil in ('atendimento', 'gestor', 'admin')))
  ) then
    raise exception 'O solicitante precisa ser um usuário ativo do cliente deste chamado (ou da equipe, em chamado interno).';
  end if;

  return new;
end;
$fn$;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.usuario_empresas) as vinculos,
       (select count(*) from public.profiles where empresa_id is not null) as usuarios_com_empresa;
