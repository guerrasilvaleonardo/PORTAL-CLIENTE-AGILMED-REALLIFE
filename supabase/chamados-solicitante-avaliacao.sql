-- =====================================================================
-- Chamados: SOLICITANTE do cliente e QUEM AVALIA o atendimento
-- Rode no Supabase ("projeto ticket") -> SQL Editor, DEPOIS de
-- programa-estrelas.sql e chamados-participantes-e-mensagens-automaticas.sql.
-- Pode rodar mais de uma vez. Não apaga dados. Não altera chamados
-- existentes (a coluna nova nasce vazia).
--
-- PROBLEMA
--   Só quem ABRIU o chamado podia avaliar. Quando a equipe abre o
--   chamado pelo cliente (telefone, WhatsApp, e-mail), ninguém do
--   cliente consegue avaliar: sem aviso, sem convite, sem estrelas
--   de avaliação. Em 19/10/2026: 34 chamados de clientes nessa situação
--   (ex.: LOCMOVEL, 13 de 20).
--
-- ANTES -> DEPOIS
--   Quem avalia:
--     ANTES : quem abriu o chamado (perfil cliente).
--     DEPOIS: 1) o SOLICITANTE, se a equipe indicou um (coluna nova);
--             2) senão, quem abriu, se for cliente (como antes);
--             3) senão (aberto pela equipe, sem solicitante): qualquer
--                usuário cliente ativo da empresa que veja o chamado.
--     Continua: uma única avaliação por chamado, dentro do prazo,
--     só com o chamado Resolvido ou Encerrado.
--   Solicitante: usuário cliente ativo da MESMA empresa; ao ser
--     indicado, entra como participante (passa a ver o chamado
--     restrito).
--   Leitura da avaliação: além da equipe e de quem abriu, o
--     solicitante e quem pode avaliar também veem a avaliação.
--
-- FUNÇÕES ALTERADAS: avaliar_chamado, avaliacao_situacao (mesmos
--   parâmetros e retorno). NOVAS: avaliacao_eh_avaliador,
--   avaliacoes_pendentes, chamado_solicitante_valida.
-- =====================================================================


-- ---------- 1. Coluna solicitante -------------------------------------
alter table public.chamados
  add column if not exists solicitante_id uuid
  references public.profiles (id) on delete set null;

create index if not exists chamados_solicitante
  on public.chamados (solicitante_id) where solicitante_id is not null;


-- ---------- 2. Solicitante válido + vira participante ------------------
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
     where p.id = new.solicitante_id
       and p.perfil = 'cliente'
       and coalesce(p.ativo, true)
       and p.empresa_id = new.empresa_id
  ) then
    raise exception 'O solicitante precisa ser um usuário ativo do cliente deste chamado.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists a_chamado_solicitante_valida on public.chamados;
create trigger a_chamado_solicitante_valida
  before insert or update of solicitante_id, empresa_id on public.chamados
  for each row execute function public.chamado_solicitante_valida();

create or replace function public.chamado_solicitante_participa()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.solicitante_id is not null
     and (tg_op = 'INSERT' or new.solicitante_id is distinct from old.solicitante_id) then
    insert into public.chamado_participantes (chamado_id, usuario_id)
    values (new.id, new.solicitante_id)
    on conflict do nothing;
  end if;

  return new;
end;
$fn$;

drop trigger if exists z_chamado_solicitante_participa on public.chamados;
create trigger z_chamado_solicitante_participa
  after insert or update of solicitante_id on public.chamados
  for each row execute function public.chamado_solicitante_participa();


-- ---------- 3. Quem pode avaliar (regra única) ------------------------
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
      join public.profiles u on u.id = p_usuario
      left join public.profiles cr on cr.id = c.criado_por
     where c.id = p_chamado
       and u.perfil = 'cliente'
       and coalesce(u.ativo, true)
       and (
             c.solicitante_id = p_usuario
          or (c.solicitante_id is null and c.criado_por = p_usuario)
          or (c.solicitante_id is null
              and coalesce(cr.perfil, '') <> 'cliente'
              and u.empresa_id = c.empresa_id
              and (c.visibilidade = 'empresa'
                   or exists (select 1 from public.chamado_participantes cp
                               where cp.chamado_id = c.id
                                 and cp.usuario_id = p_usuario)))
           )
  );
$fn$;

revoke all on function public.avaliacao_eh_avaliador(uuid, uuid) from public, anon;
grant execute on function public.avaliacao_eh_avaliador(uuid, uuid) to authenticated;


-- ---------- 4. Gravar a avaliação --------------------------------------
create or replace function public.avaliar_chamado(p_chamado uuid, p_nota integer, p_comentario text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg   public.estrelas_config%rowtype;
  c     record;
  v_res timestamptz;
  v_com text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  if auth.uid() is null then raise exception 'Faça login para avaliar.'; end if;
  if p_nota not in (1, 2, 3) then raise exception 'Nota inválida.'; end if;
  if v_com is not null and char_length(v_com) > 2000 then
    raise exception 'Comentário muito longo (máximo 2000 caracteres).';
  end if;

  select id, status, criado_por, resolvido_em, encerrado_em
    into c from public.chamados where id = p_chamado for update;
  if not found or not public.avaliacao_eh_avaliador(p_chamado, auth.uid()) then
    raise exception 'Somente quem solicitou o chamado pode avaliar.';
  end if;
  if c.status not in ('resolvido', 'encerrado') then
    raise exception 'A avaliação fica disponível quando o chamado é resolvido.';
  end if;
  if exists (select 1 from public.chamado_avaliacoes where chamado_id = p_chamado) then
    raise exception 'Este chamado já foi avaliado.';
  end if;

  select * into cfg from public.estrelas_config where id;
  v_res := coalesce(
    (select l.resolvido_em from public.estrelas_lancamentos l where l.chamado_id = p_chamado),
    c.resolvido_em, c.encerrado_em);
  if cfg.prazo_avaliacao_dias is not null and v_res is not null
     and now() > v_res + make_interval(days => cfg.prazo_avaliacao_dias) then
    raise exception 'O prazo para avaliar este chamado terminou.';
  end if;

  insert into public.chamado_avaliacoes (chamado_id, nota, comentario, autor_id)
  values (p_chamado, p_nota, v_com, auth.uid());

  perform public.estrelas_recalcular(p_chamado, auth.uid());

  return jsonb_build_object('ok', true, 'nota', p_nota);
end;
$fn$;

revoke all on function public.avaliar_chamado(uuid, integer, text) from public, anon;
grant execute on function public.avaliar_chamado(uuid, integer, text) to authenticated;


-- ---------- 5. Situação da avaliação (cartão do chamado) ---------------
create or replace function public.avaliacao_situacao(p_chamado uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cfg   public.estrelas_config%rowtype;
  c     record;
  a     public.chamado_avaliacoes%rowtype;
  v_res timestamptz;
  v_ate timestamptz;
  pode  boolean;
begin
  select id, status, criado_por, solicitante_id, resolvido_em, encerrado_em
    into c from public.chamados where id = p_chamado;
  if not found then return null; end if;

  pode := public.avaliacao_eh_avaliador(p_chamado, auth.uid());

  if not pode
     and c.criado_por is distinct from auth.uid()
     and c.solicitante_id is distinct from auth.uid()
     and not public.estrelas_eh_equipe() then
    return null;
  end if;

  select * into a from public.chamado_avaliacoes where chamado_id = p_chamado;
  if found then
    return jsonb_build_object('avaliado', true, 'nota', a.nota,
                              'comentario', a.comentario, 'avaliado_em', a.created_at,
                              'pode_avaliar', false);
  end if;

  select * into cfg from public.estrelas_config where id;
  v_res := coalesce(
    (select l.resolvido_em from public.estrelas_lancamentos l where l.chamado_id = p_chamado),
    c.resolvido_em, c.encerrado_em);
  v_ate := case when cfg.prazo_avaliacao_dias is not null and v_res is not null
                then v_res + make_interval(days => cfg.prazo_avaliacao_dias) end;

  return jsonb_build_object(
    'avaliado', false,
    'avaliar_ate', v_ate,
    'pode_avaliar', pode
                    and c.status in ('resolvido', 'encerrado')
                    and (v_ate is null or now() <= v_ate));
end;
$fn$;

revoke all on function public.avaliacao_situacao(uuid) from public, anon;
grant execute on function public.avaliacao_situacao(uuid) to authenticated;


-- ---------- 6. Lista de pendências (aviso piscando do cliente) ---------
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
begin
  select p.empresa_id into v_emp
    from public.profiles p
   where p.id = auth.uid() and p.perfil = 'cliente' and coalesce(p.ativo, true);
  if v_emp is null then return; end if;

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
       where c.empresa_id = v_emp
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


-- ---------- 7. Quem lê a avaliação --------------------------------------
drop policy if exists "Cliente e equipe leem avaliacao" on public.chamado_avaliacoes;
create policy "Cliente e equipe leem avaliacao" on public.chamado_avaliacoes
  for select to authenticated
  using (
    public.estrelas_eh_equipe()
    or exists (select 1 from public.chamados c
                where c.id = chamado_avaliacoes.chamado_id
                  and (c.criado_por = auth.uid() or c.solicitante_id = auth.uid()))
    or public.avaliacao_eh_avaliador(chamado_avaliacoes.chamado_id, auth.uid())
  );


-- ---------- Conferência ------------------------------------------------
-- Chamados resolvidos/encerrados de clientes abertos pela equipe, sem
-- avaliação (passam a poder ser avaliados pelos usuários do cliente):
-- select c.numero, e.nome_fantasia, c.status
--   from public.chamados c
--   join public.profiles cr on cr.id = c.criado_por and cr.perfil <> 'cliente'
--   join public.empresas e on e.id = c.empresa_id
--  where c.status in ('resolvido','encerrado')
--    and not exists (select 1 from public.chamado_avaliacoes a where a.chamado_id = c.id)
--  order by c.numero desc;
