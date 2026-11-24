-- =====================================================================
-- Programa de Estrelas: e-mails mensais de reconhecimento.
--
-- ANTES:  o ranking mensal só existia "ao vivo" (estrelas_ranking). Não
--         havia registro do que cada pessoa tinha no fechamento do mês,
--         e os e-mails de reconhecimento eram escritos à mão.
-- DEPOIS: no 3º dia útil do mês seguinte (ou depois do fim do prazo de
--         avaliação, o que vier por último) o portal CONGELA a
--         classificação do mês em estrelas_reconhecimentos: uma linha
--         por atendente, com posição (empate = mesma posição), números
--         e o rascunho do e-mail. O gestor escreve o destaque, revisa e
--         envia pela aba "Reconhecimento do mês" (só gestor e admin).
--         Quem teve avaliação Ruim ou mais chamados fora do prazo do que
--         no prazo já vem marcado para "Conversa pessoal" (sem e-mail);
--         o gestor pode mudar.
-- MOTIVO: o e-mail precisa refletir um resultado fechado (avaliações e
--         encerramentos chegam depois do fim do mês) e ficar registrado
--         para responder "por que fiquei em 4º?".
--
-- Não altera estrelas, lançamentos, avaliações nem o ranking. Não apaga
-- dados. Congelar de novo um mês já congelado não muda as linhas que já
-- existem. Pode rodar mais de uma vez.
-- =====================================================================


-- ---------- 1. Tabela ----------------------------------------------------
create table if not exists public.estrelas_reconhecimentos (
  id                  bigserial primary key,
  periodo             date not null check (extract(day from periodo) = 1),  -- 1º dia do mês
  atendente_id        uuid not null references public.profiles(id),
  nome                text not null,
  email               text,
  posicao             integer not null,
  empatado            boolean not null default false,
  total               integer not null default 0,
  estrelas_prazo      integer not null default 0,
  estrelas_avaliacao  integer not null default 0,
  resolvidos          integer not null default 0,
  dentro_prazo        integer not null default 0,
  fora_prazo          integer not null default 0,
  avaliados           integer not null default 0,
  ruins               integer not null default 0,
  media_nota          numeric,
  acao                text not null default 'email'
                      check (acao in ('email', 'conversa', 'nao_enviar')),
  motivo_conversa     text,
  destaque            text check (destaque is null or char_length(destaque) <= 2000),
  complemento         text check (complemento is null or char_length(complemento) <= 1000),
  situacao            text not null default 'rascunho'
                      check (situacao in ('rascunho', 'enviado')),
  assunto_enviado     text,
  texto_enviado       text,
  enviado_em          timestamptz,
  enviado_por         uuid references public.profiles(id) on delete set null,
  erro_envio          text,
  congelado_em        timestamptz not null default now(),
  congelado_por       uuid references public.profiles(id) on delete set null,
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references public.profiles(id) on delete set null,
  unique (periodo, atendente_id)
);

create index if not exists estrelas_reconhecimentos_periodo_idx
  on public.estrelas_reconhecimentos (periodo, posicao);


-- ---------- 2. Segurança: só gestor e admin -------------------------------
alter table public.estrelas_reconhecimentos enable row level security;

drop policy if exists "Gestor le reconhecimentos" on public.estrelas_reconhecimentos;
create policy "Gestor le reconhecimentos" on public.estrelas_reconhecimentos
  for select to authenticated using (public.estrelas_eh_gestor());

grant select on public.estrelas_reconhecimentos to authenticated;
revoke insert, update, delete on public.estrelas_reconhecimentos from anon, authenticated;

-- Gestor/admin logado, ou o servidor do portal (agendamento da Vercel).
create or replace function public.estrelas_reconhecimento_pode()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.estrelas_eh_gestor()
      or coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
      or coalesce(current_setting('role', true), '') = 'service_role';
$fn$;


-- ---------- 3. Congelar o mês ---------------------------------------------
-- Mesma conta do estrelas_ranking (lançamentos válidos, mês da resolução,
-- horário de Porto Velho). Só insere quem ainda não está congelado.
create or replace function public.estrelas_congelar_mes(p_mes date)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_fim    date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_qtd    integer;
begin
  if not public.estrelas_reconhecimento_pode() then
    raise exception 'Só gestor ou admin podem congelar o reconhecimento do mês.';
  end if;

  if v_fim >= (now() at time zone 'America/Porto_Velho')::date then
    raise exception 'O mês ainda não terminou.';
  end if;

  with base as (
    select l.atendente_id,
           sum(l.estrelas_prazo)::int                              as ep,
           sum(l.estrelas_avaliacao)::int                          as ea,
           count(*)::int                                           as resolvidos,
           count(*) filter (where l.dentro_prazo)::int             as dentro,
           count(*) filter (where l.dentro_prazo = false)::int     as fora,
           count(l.nota)::int                                      as avaliados,
           count(*) filter (where l.nota = 1)::int                 as ruins,
           round(avg(l.nota)::numeric, 2)                          as media
      from public.estrelas_lancamentos l
     where l.situacao = 'valida'
       and (l.resolvido_em at time zone 'America/Porto_Velho')::date between v_inicio and v_fim
     group by l.atendente_id
  ), classif as (
    select b.*,
           rank() over (order by (b.ep + b.ea) desc)::int                 as pos,
           (count(*) over (partition by (b.ep + b.ea)) > 1)               as empate
      from base b
  )
  insert into public.estrelas_reconhecimentos (
    periodo, atendente_id, nome, email, posicao, empatado, total,
    estrelas_prazo, estrelas_avaliacao, resolvidos, dentro_prazo, fora_prazo,
    avaliados, ruins, media_nota, acao, motivo_conversa, congelado_por
  )
  select v_inicio, c.atendente_id,
         coalesce(nullif(btrim(p.nome), ''), p.email, 'Atendente'),
         p.email, c.pos, c.empate, c.ep + c.ea,
         c.ep, c.ea, c.resolvidos, c.dentro, c.fora,
         c.avaliados, c.ruins, c.media,
         case when c.ruins > 0 or c.fora > c.dentro then 'conversa' else 'email' end,
         case
           when c.ruins > 0 and c.fora > c.dentro then 'Avaliação Ruim e mais chamados fora do prazo do que no prazo'
           when c.ruins > 0 then 'Recebeu avaliação Ruim no mês'
           when c.fora > c.dentro then 'Mais chamados fora do prazo do que no prazo'
         end,
         auth.uid()
    from classif c
    left join public.profiles p on p.id = c.atendente_id
  on conflict (periodo, atendente_id) do nothing;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$fn$;

revoke all on function public.estrelas_congelar_mes(date) from public, anon;
grant execute on function public.estrelas_congelar_mes(date) to authenticated, service_role;


-- ---------- 4. Salvar o rascunho (destaque, frase extra, ação) ----------
create or replace function public.estrelas_reconhecimento_salvar(
  p_id           bigint,
  p_destaque     text,
  p_complemento  text,
  p_acao         text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sit text;
begin
  if not public.estrelas_eh_gestor() then
    raise exception 'Só gestor ou admin podem editar o reconhecimento.';
  end if;

  if p_acao not in ('email', 'conversa', 'nao_enviar') then
    raise exception 'Ação inválida.';
  end if;

  select situacao into v_sit from public.estrelas_reconhecimentos where id = p_id;
  if v_sit is null then
    raise exception 'Rascunho não encontrado.';
  end if;
  if v_sit = 'enviado' then
    raise exception 'Este e-mail já foi enviado e não pode mais ser alterado.';
  end if;

  update public.estrelas_reconhecimentos
     set destaque       = nullif(btrim(left(coalesce(p_destaque, ''), 2000)), ''),
         complemento    = nullif(btrim(left(coalesce(p_complemento, ''), 1000)), ''),
         acao           = p_acao,
         atualizado_em  = now(),
         atualizado_por = auth.uid()
   where id = p_id;
end;
$fn$;

revoke all on function public.estrelas_reconhecimento_salvar(bigint, text, text, text) from public, anon;
grant execute on function public.estrelas_reconhecimento_salvar(bigint, text, text, text) to authenticated;


-- ---------- Conferência -------------------------------------------------
-- Deve mostrar a tabela vazia (ou os meses já congelados) e as 3 funções.
select periodo, count(*) as pessoas,
       count(*) filter (where situacao = 'enviado') as enviados,
       count(*) filter (where acao = 'conversa')    as conversas
  from public.estrelas_reconhecimentos
 group by periodo
 order by periodo desc;

select proname
  from pg_proc
 where proname in ('estrelas_reconhecimento_pode', 'estrelas_congelar_mes', 'estrelas_reconhecimento_salvar')
 order by proname;
