-- =====================================================================
-- Chamados INTERNOS (empresa da própria equipe): solicitante interno
-- e avaliação pela equipe.
-- Rode no Supabase ("projeto ticket") -> SQL Editor, DEPOIS de
-- chamados-solicitante-avaliacao.sql. Pode rodar mais de uma vez.
--
-- CONTEXTO
--   A empresa "Real Life SSMA" também recebe chamados internos (a
--   equipe pedindo algo para a própria equipe). Lá não há usuário de
--   cliente, então ninguém conseguia indicar solicitante nem avaliar.
--   Decisão (19/10/2026): na empresa interna, o solicitante pode ser
--   alguém da equipe e é ele quem avalia; ninguém avalia chamado em
--   que é o responsável.
--
-- ANTES -> DEPOIS
--   empresas.interna (nova, padrão false). Marca como interna a
--     empresa "Real Life SSMA" (único dado alterado por este script).
--   Solicitante:
--     ANTES : só usuário cliente ativo da mesma empresa.
--     DEPOIS: em empresa interna, também atendimento/gestor/admin ativo.
--   Quem avalia (avaliacao_eh_avaliador):
--     + em empresa interna: o solicitante; sem ele, quem abriu.
--       Perfil interno ativo.
--     + em qualquer chamado: o responsável atual nunca avalia.
--   Solicitante interno não vira participante (a equipe já vê tudo).
--   avaliacoes_pendentes: também lista chamados internos para a equipe.
-- =====================================================================


-- ---------- 1. Empresa interna -----------------------------------------
alter table public.empresas
  add column if not exists interna boolean not null default false;

update public.empresas
   set interna = true
 where interna = false
   and (nome_fantasia ilike 'Real Life SSMA' or razao_social ilike 'Real Life SSMA%');


-- ---------- 2. Solicitante válido --------------------------------------
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
    select 1
      from public.profiles p
      join public.empresas e on e.id = new.empresa_id
     where p.id = new.solicitante_id
       and coalesce(p.ativo, true)
       and (
             (p.perfil = 'cliente' and p.empresa_id = new.empresa_id)
          or (e.interna and p.perfil in ('atendimento', 'gestor', 'admin'))
           )
  ) then
    raise exception 'O solicitante precisa ser um usuário ativo do cliente deste chamado (ou da equipe, em chamado interno).';
  end if;

  return new;
end;
$fn$;

create or replace function public.chamado_solicitante_participa()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.solicitante_id is not null
     and (tg_op = 'INSERT' or new.solicitante_id is distinct from old.solicitante_id)
     and exists (select 1 from public.profiles p
                  where p.id = new.solicitante_id and p.perfil = 'cliente') then
    insert into public.chamado_participantes (chamado_id, usuario_id)
    values (new.id, new.solicitante_id)
    on conflict do nothing;
  end if;

  return new;
end;
$fn$;


-- ---------- 3. Quem pode avaliar ----------------------------------------
create or replace function public.avaliacao_eh_avaliador(p_chamado uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.chamados c
      join public.empresas e on e.id = c.empresa_id
      join public.profiles u on u.id = p_usuario
      left join public.profiles cr on cr.id = c.criado_por
     where c.id = p_chamado
       and coalesce(u.ativo, true)
       and c.responsavel_id is distinct from p_usuario
       and (
             -- Chamado de cliente (regra anterior)
             (not e.interna and u.perfil = 'cliente' and (
                   c.solicitante_id = p_usuario
                or (c.solicitante_id is null and c.criado_por = p_usuario)
                or (c.solicitante_id is null
                    and coalesce(cr.perfil, '') <> 'cliente'
                    and u.empresa_id = c.empresa_id
                    and (c.visibilidade = 'empresa'
                         or exists (select 1 from public.chamado_participantes cp
                                     where cp.chamado_id = c.id
                                       and cp.usuario_id = p_usuario)))))
             -- Chamado interno: solicitante; sem ele, quem abriu
          or (e.interna and u.perfil in ('atendimento', 'gestor', 'admin') and (
                   c.solicitante_id = p_usuario
                or (c.solicitante_id is null and c.criado_por = p_usuario)))
           )
  );
$fn$;

revoke all on function public.avaliacao_eh_avaliador(uuid, uuid) from public, anon;
grant execute on function public.avaliacao_eh_avaliador(uuid, uuid) to authenticated;


-- ---------- 4. Lista de pendências ---------------------------------------
create or replace function public.avaliacoes_pendentes()
returns table (id uuid, numero integer, assunto text, status text, avaliar_ate timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  cfg   public.estrelas_config%rowtype;
  v_emp uuid;
  v_per text;
begin
  select p.empresa_id, p.perfil into v_emp, v_per
    from public.profiles p
   where p.id = auth.uid() and coalesce(p.ativo, true);
  if v_per is null then return; end if;

  select * into cfg from public.estrelas_config where estrelas_config.id;

  return query
  select x.id, x.numero::integer, x.assunto, x.status, x.ate
    from (
      select c.id, c.numero, c.assunto, c.status,
             case when cfg.prazo_avaliacao_dias is not null
                  then coalesce(
                         (select l.resolvido_em from public.estrelas_lancamentos l where l.chamado_id = c.id),
                         c.resolvido_em, c.encerrado_em)
                       + make_interval(days => cfg.prazo_avaliacao_dias)
             end as ate
        from public.chamados c
        join public.empresas e on e.id = c.empresa_id
       where (case when v_per = 'cliente' then c.empresa_id = v_emp else e.interna end)
         and c.status in ('resolvido', 'encerrado')
         and not exists (select 1 from public.chamado_avaliacoes a where a.chamado_id = c.id)
         and public.avaliacao_eh_avaliador(c.id, auth.uid())
    ) x
   where x.ate is null or now() <= x.ate
   order by x.ate nulls last, x.numero;
end;
$fn$;

revoke all on function public.avaliacoes_pendentes() from public, anon;
grant execute on function public.avaliacoes_pendentes() to authenticated;


-- ---------- Conferência -------------------------------------------------
-- select id, nome_fantasia, interna from public.empresas where interna;
