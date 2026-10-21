-- =====================================================================
-- Chamado CANCELADO, com motivo obrigatório.
--
-- ANTES:  o chamado só terminava como Resolvido ou Encerrado. Pedido
--         duplicado, aberto por engano ou desistência virava "Encerrado"
--         e entrava no SLA e nas estrelas como se tivesse sido atendido.
-- DEPOIS: nova situação 'cancelado'.
--   * Só gestor/admin cancela, pela função cancelar_chamado (motivo da
--     lista + observação interna obrigatória).
--   * Só cancela chamado em aberto (aberto, em atendimento, aguardando
--     cliente ou suspenso). Resolvido/encerrado não se cancela.
--   * Fica fora do SLA e das estrelas (estrela só nasce de resolvido/
--     encerrado) e não pede avaliação.
--   * O cliente recebe mensagem automática com o MOTIVO (a observação
--     fica só com a equipe) e o e-mail de mudança de situação.
--   * O gestor pode desfazer: muda a situação de volta para Aberto ou Em
--     atendimento. O registro do cancelamento é mantido no histórico.
-- MOTIVO: separar "não foi atendido porque não precisava" de "foi
--         atendido", sem maquiar os indicadores.
--
-- Não apaga nem altera dados existentes. Pode rodar mais de uma vez.
-- =====================================================================


-- ---------- 1. Situação 'cancelado' -------------------------------------
-- Mesmo método da suspensão: se status for enum, acrescenta o valor; se
-- houver regra (check) listando as situações, recria com 'cancelado'.
do $$
declare
  v_tipo text;
  v_udt  text;
  r      record;
  v_def  text;
begin
  select data_type, udt_name into v_tipo, v_udt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'chamados' and column_name = 'status';

  if v_tipo = 'USER-DEFINED' then
    execute format('alter type public.%I add value if not exists %L', v_udt, 'cancelado');
  end if;

  for r in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.chamados'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%aguardando_cliente%'
       and pg_get_constraintdef(oid) not like '%cancelado%'
  loop
    v_def := replace(r.def, '''aguardando_cliente''::text',
                     '''aguardando_cliente''::text, ''cancelado''::text');
    if v_def = r.def then
      raise exception 'Regra % em chamados tem formato inesperado: %. Ajuste manual necessário.',
        r.conname, r.def;
    end if;
    execute format('alter table public.chamados drop constraint %I', r.conname);
    execute format('alter table public.chamados add constraint %I %s', r.conname, v_def);
    raise notice 'Regra % atualizada: %', r.conname, v_def;
  end loop;
end $$;

alter table public.chamados
  add column if not exists cancelado_em        timestamptz,
  add column if not exists cancelamento_motivo text,
  add column if not exists cancelado_por       uuid references public.profiles (id) on delete set null;


-- ---------- 2. Registro de cada cancelamento ----------------------------
create table if not exists public.chamado_cancelamentos (
  id              bigserial primary key,
  chamado_id      uuid not null references public.chamados (id) on delete cascade,
  motivo          text not null check (motivo in (
                    'Chamado duplicado',
                    'Aberto por engano',
                    'Cliente desistiu da solicitação',
                    'Fora do escopo contratado',
                    'Sem retorno do cliente',
                    'Substituído por outro chamado',
                    'Outro')),
  detalhe         text check (detalhe is null or char_length(btrim(detalhe)) between 3 and 120),
  observacao      text not null check (char_length(btrim(observacao)) between 10 and 2000),
  status_anterior text not null,
  cancelado_em    timestamptz not null default now(),
  cancelado_por   uuid references public.profiles (id) on delete set null,
  revertido_em    timestamptz,
  revertido_por   uuid references public.profiles (id) on delete set null,
  constraint chamado_cancelamentos_outro_detalhe
    check (motivo <> 'Outro' or detalhe is not null)
);

create index if not exists chamado_cancelamentos_chamado
  on public.chamado_cancelamentos (chamado_id, cancelado_em desc);
create unique index if not exists chamado_cancelamentos_um_vigente
  on public.chamado_cancelamentos (chamado_id) where revertido_em is null;

alter table public.chamado_cancelamentos enable row level security;

drop policy if exists "Equipe ve cancelamentos" on public.chamado_cancelamentos;
create policy "Equipe ve cancelamentos" on public.chamado_cancelamentos
  for select to authenticated using (public.estrelas_eh_equipe());

grant select on public.chamado_cancelamentos to authenticated;
revoke insert, update, delete on public.chamado_cancelamentos from anon, authenticated;


-- ---------- 3. Mensagens automáticas ------------------------------------
-- Não sobrescreve textos já existentes/editados.
-- Marcadores: {numero}, {assunto}, {motivo}.
insert into public.chamado_mensagens_modelo (gatilho, texto) values
('cancelado',
 E'O chamado #{numero} foi cancelado.\n\nMotivo: {motivo}\n\nSe ainda precisar de ajuda com este assunto, responda por aqui ou abra um novo chamado.'),
('cancelamento_desfeito',
 E'O cancelamento do chamado #{numero} foi desfeito e ele voltou para atendimento. Seguimos com a sua solicitação por aqui.')
on conflict (gatilho) do nothing;

create or replace function public.mensagem_cancelamento(p_chamado uuid, p_gatilho text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  modelo text;
  c record;
begin
  select texto into modelo from public.chamado_mensagens_modelo
   where gatilho = p_gatilho and ativo;
  if modelo is null then return; end if;

  select numero, assunto into c from public.chamados where id = p_chamado;

  insert into public.chamado_mensagens (chamado_id, autor_id, mensagem, automatica)
  values (p_chamado, null,
          replace(replace(replace(modelo,
            '{numero}', coalesce(c.numero::text, '')),
            '{assunto}', coalesce(c.assunto, '')),
            '{motivo}', coalesce(p_motivo, '')),
          true);
exception when others then
  raise warning 'Mensagem de cancelamento nao enviada (%): %', p_gatilho, sqlerrm;
end;
$fn$;

revoke all on function public.mensagem_cancelamento(uuid, text, text) from public, anon, authenticated;


-- ---------- 4. Cancelar (único caminho para 'cancelado') ----------------
create or replace function public.cancelar_chamado(p_chamado uuid, p_motivo text,
                                                   p_detalhe text, p_observacao text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c         record;
  v_motivo  text := btrim(coalesce(p_motivo, ''));
  v_detalhe text := nullif(btrim(coalesce(p_detalhe, '')), '');
  v_obs     text := btrim(coalesce(p_observacao, ''));
begin
  if not public.estrelas_eh_gestor() then
    raise exception 'Somente gestor ou administrador pode cancelar um chamado.';
  end if;
  if v_motivo = '' then raise exception 'Escolha o motivo do cancelamento.'; end if;
  if v_motivo = 'Outro' and char_length(coalesce(v_detalhe, '')) < 3 then
    raise exception 'Descreva o motivo (mínimo de 3 caracteres).';
  end if;
  if v_motivo <> 'Outro' then v_detalhe := null; end if;
  if char_length(v_obs) < 10 then
    raise exception 'Descreva o que aconteceu (observação com no mínimo 10 caracteres).';
  end if;

  select id, status into c from public.chamados where id = p_chamado for update;
  if not found then raise exception 'Chamado não encontrado.'; end if;
  if c.status not in ('aberto', 'em_atendimento', 'aguardando_cliente', 'suspenso') then
    raise exception 'Só é possível cancelar chamado em aberto (situação atual: %).', c.status;
  end if;

  -- Cancelar um suspenso fecha a suspensão aqui, sem estender o prazo
  -- (não há atendimento a retomar).
  if c.status = 'suspenso' then
    update public.chamado_suspensoes
       set fim = now(), encerrado_por = auth.uid()
     where chamado_id = p_chamado and fim is null;
  end if;

  insert into public.chamado_cancelamentos
         (chamado_id, motivo, detalhe, observacao, status_anterior, cancelado_por)
  values (p_chamado, v_motivo, v_detalhe, v_obs, c.status, auth.uid());

  update public.chamados set status = 'cancelado' where id = p_chamado;

  begin
    insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
    values (p_chamado, 'cancelamento', 'cancelado', auth.uid(),
            'Motivo: ' || case when v_motivo = 'Outro' then v_detalhe else v_motivo end);
  exception when others then null;
  end;
end;
$fn$;

revoke all on function public.cancelar_chamado(uuid, text, text, text) from public, anon;
grant execute on function public.cancelar_chamado(uuid, text, text, text) to authenticated;


-- ---------- 5. Gatilho: entrada e saída de 'cancelado' ------------------
-- "zx_" roda antes de zy_chamado_suspensao e de zz_estrelas_*.
create or replace function public.chamado_cancelamento_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  k public.chamado_cancelamentos%rowtype;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Entrando: exige o registro feito por cancelar_chamado.
  if new.status = 'cancelado' then
    select * into k from public.chamado_cancelamentos
     where chamado_id = new.id and revertido_em is null
     order by cancelado_em desc limit 1;
    if not found then
      raise exception 'Para cancelar, use "Cancelar chamado" (somente gestor/admin) e informe o motivo.';
    end if;
    new.cancelado_em        := k.cancelado_em;
    new.cancelamento_motivo := case when k.motivo = 'Outro' then k.detalhe else k.motivo end;
    new.cancelado_por       := k.cancelado_por;
    return new;
  end if;

  -- Saindo: só gestor/admin, e só de volta para atendimento.
  if old.status = 'cancelado' then
    if not public.estrelas_eh_gestor() then
      raise exception 'Somente gestor ou administrador pode desfazer um cancelamento.';
    end if;
    if new.status not in ('aberto', 'em_atendimento') then
      raise exception 'Para desfazer o cancelamento, volte o chamado para Aberto ou Em atendimento.';
    end if;

    update public.chamado_cancelamentos
       set revertido_em = now(), revertido_por = auth.uid()
     where chamado_id = new.id and revertido_em is null;

    new.cancelado_em        := null;
    new.cancelamento_motivo := null;
    new.cancelado_por       := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists zx_chamado_cancelamento on public.chamados;
create trigger zx_chamado_cancelamento
  before update of status on public.chamados
  for each row execute function public.chamado_cancelamento_antes();

create or replace function public.chamado_cancelamento_depois()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status is distinct from old.status then
    if new.status = 'cancelado' then
      perform public.mensagem_cancelamento(new.id, 'cancelado', new.cancelamento_motivo);
    elsif old.status = 'cancelado' then
      perform public.mensagem_cancelamento(new.id, 'cancelamento_desfeito', null);
      begin
        insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id, observacao)
        values (new.id, 'cancelamento', 'cancelado', new.status, auth.uid(), 'Cancelamento desfeito');
      exception when others then null;
      end;
    end if;
  end if;
  return null;
end;
$fn$;

drop trigger if exists zx_chamado_cancelamento_depois on public.chamados;
create trigger zx_chamado_cancelamento_depois
  after update of status on public.chamados
  for each row execute function public.chamado_cancelamento_depois();


-- ---------- Conferência -------------------------------------------------
select pg_get_constraintdef(oid) as regra_status
  from pg_constraint
 where conrelid = 'public.chamados'::regclass and contype = 'c'
   and pg_get_constraintdef(oid) like '%cancelado%';
