-- =====================================================================
-- Gestão de desempenho — etapa 3: o colaborador vê o próprio relatório
-- e registra ciência.
--
-- ANTES:  o relatório mensal só era visto pela direção (Leonardo e
--         Priscila). A pessoa avaliada não tinha como ver a própria
--         ficha nem registrar que tomou conhecimento.
-- DEPOIS: a direção revisa a ficha de cada pessoa e clica em "Liberar
--         para a pessoa". O portal guarda uma CÓPIA CONGELADA do que
--         foi liberado (os números da ficha e, se a direção escolher,
--         a síntese, os pontos fortes e de atenção e o plano de ação).
--         O roteiro da conversa e as anotações de gestão NUNCA vão.
--         A pessoa vê só o que foi liberado para ela, em "Meu
--         desempenho"; registra ciência e pode escrever a sua
--         manifestação. Tudo com data e hora.
--         - Só a direção libera e revoga (decisão do Leonardo em
--           30/10/2026). Revogar só antes da ciência.
--         - Depois da ciência, o que foi liberado não muda mais: para
--           corrigir, gere nova versão do relatório e libere de novo.
--         - Nada é apagado.
-- MOTIVO: transparência e registro formal da devolutiva individual
--         (plano do módulo de desempenho, etapa 3).
--
-- Pode rodar mais de uma vez. Depende de supabase/relatorio-desempenho.sql.
-- =====================================================================

do $$
begin
  if to_regclass('public.relatorios_desempenho') is null
     or to_regprocedure('public.pode_ver_relatorio_gestao()') is null then
    raise exception 'Rode antes supabase/relatorio-desempenho.sql.';
  end if;
end
$$;

create table if not exists public.desempenho_publicacoes (
  id                    bigserial primary key,
  relatorio_id          bigint not null references public.relatorios_desempenho (id),
  pessoa_id             uuid not null references public.profiles (id),
  mes                   date not null,
  conteudo              jsonb not null,
  mensagem              text check (mensagem is null or char_length(mensagem) <= 2000),
  liberado_em           timestamptz not null default now(),
  liberado_por          uuid references public.profiles (id) on delete set null,
  revogado_em           timestamptz,
  revogado_por          uuid references public.profiles (id) on delete set null,
  primeira_abertura_em  timestamptz,
  aberturas             integer not null default 0,
  ciente_em             timestamptz,
  manifestacao          text check (manifestacao is null or char_length(manifestacao) <= 3000),
  manifestacao_em       timestamptz,
  unique (relatorio_id, pessoa_id)
);

create index if not exists desempenho_publicacoes_pessoa
  on public.desempenho_publicacoes (pessoa_id, mes desc);

alter table public.desempenho_publicacoes enable row level security;

-- Direção vê tudo; a pessoa vê só o que foi liberado para ela.
drop policy if exists desempenho_publicacoes_leitura on public.desempenho_publicacoes;
create policy desempenho_publicacoes_leitura on public.desempenho_publicacoes
  for select to authenticated
  using (
    public.pode_ver_relatorio_gestao()
    or (pessoa_id = auth.uid() and revogado_em is null)
  );

-- Ninguém grava direto: só pelas funções abaixo.
revoke all on public.desempenho_publicacoes from anon;
revoke all on public.desempenho_publicacoes from authenticated;
grant select on public.desempenho_publicacoes to authenticated;

-- Nada é apagado.
create or replace function public.desempenho_publicacoes_sem_apagar()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'Registro de devolutiva de desempenho não pode ser apagado.';
end;
$fn$;

drop trigger if exists desempenho_publicacoes_sem_apagar on public.desempenho_publicacoes;
create trigger desempenho_publicacoes_sem_apagar
  before delete on public.desempenho_publicacoes
  for each row execute function public.desempenho_publicacoes_sem_apagar();


-- ---------- Liberar (direção) --------------------------------------------
create or replace function public.liberar_relatorio_pessoa(
  p_relatorio bigint,
  p_pessoa uuid,
  p_mensagem text default null,
  p_incluir_analise boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r        public.relatorios_desempenho%rowtype;
  v_ficha  jsonb;
  v_analise jsonb;
  v_cont   jsonb;
  v_id     bigint;
  v_ciente timestamptz;
  v_msg    text := nullif(btrim(coalesce(p_mensagem, '')), '');
begin
  if not public.pode_ver_relatorio_gestao() then
    raise exception 'Só a direção libera o relatório.';
  end if;

  select * into r from public.relatorios_desempenho where id = p_relatorio;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;

  select f into v_ficha
    from jsonb_array_elements(r.dados -> 'pessoas') f
   where f ->> 'id' = p_pessoa::text
   limit 1;
  if v_ficha is null then
    raise exception 'Esta pessoa não tem ficha neste relatório.';
  end if;

  -- Análise escrita: só síntese, pontos e plano. O roteiro da conversa
  -- é anotação de gestão e não vai para a pessoa.
  if p_incluir_analise and r.analise is not null and (r.analise -> 'pessoas') ? p_pessoa::text then
    v_analise := (r.analise -> 'pessoas' -> p_pessoa::text) - 'roteiro_conversa';
  end if;

  v_cont := jsonb_build_object(
    'mes',          r.dados ->> 'mes',
    'versao',       r.versao,
    'parcial',      r.parcial,
    'periodo',      r.dados -> 'periodo',
    'anterior',     r.dados -> 'anterior',
    'versaoRegras', r.dados -> 'versaoRegras',
    'ficha',        v_ficha,
    'medianas',     r.dados -> 'equipe' -> 'medianas',
    'diagnostico',  r.dados -> 'diagnostico' -> 'pessoas' -> p_pessoa::text,
    'analise',      v_analise,
    'analiseOrigem', case when v_analise is null then null else r.analise_origem end,
    'fontes',       r.dados -> 'fontes',
    'limitacoes',   r.dados -> 'limitacoes'
  );

  select id, ciente_em into v_id, v_ciente
    from public.desempenho_publicacoes
   where relatorio_id = p_relatorio and pessoa_id = p_pessoa;

  if v_id is not null and v_ciente is not null then
    raise exception 'A pessoa já deu ciência desta versão. Para mudar, gere nova versão do relatório e libere de novo.';
  end if;

  if v_id is null then
    insert into public.desempenho_publicacoes
      (relatorio_id, pessoa_id, mes, conteudo, mensagem, liberado_em, liberado_por)
    values
      (p_relatorio, p_pessoa, r.mes, v_cont, v_msg, now(), auth.uid())
    returning id into v_id;
  else
    update public.desempenho_publicacoes
       set conteudo = v_cont,
           mensagem = v_msg,
           liberado_em = now(),
           liberado_por = auth.uid(),
           revogado_em = null,
           revogado_por = null
     where id = v_id;
  end if;

  -- Versões anteriores do mesmo mês, ainda sem ciência, saem de cena
  -- (ficam guardadas como revogadas).
  update public.desempenho_publicacoes
     set revogado_em = now(), revogado_por = auth.uid()
   where pessoa_id = p_pessoa
     and mes = r.mes
     and id <> v_id
     and ciente_em is null
     and revogado_em is null;

  return v_id;
end;
$fn$;

revoke all on function public.liberar_relatorio_pessoa(bigint, uuid, text, boolean) from public, anon;
grant execute on function public.liberar_relatorio_pessoa(bigint, uuid, text, boolean) to authenticated;


-- ---------- Revogar (direção, antes da ciência) --------------------------
create or replace function public.revogar_relatorio_pessoa(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.pode_ver_relatorio_gestao() then
    raise exception 'Só a direção revoga a liberação.';
  end if;
  update public.desempenho_publicacoes
     set revogado_em = now(), revogado_por = auth.uid()
   where id = p_id and ciente_em is null and revogado_em is null;
  if not found then
    raise exception 'Não é possível revogar: já tem ciência ou já foi revogado.';
  end if;
end;
$fn$;

revoke all on function public.revogar_relatorio_pessoa(bigint) from public, anon;
grant execute on function public.revogar_relatorio_pessoa(bigint) to authenticated;


-- ---------- Abertura pela pessoa -----------------------------------------
create or replace function public.abrir_relatorio_publicado(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.desempenho_publicacoes
     set aberturas = aberturas + 1,
         primeira_abertura_em = coalesce(primeira_abertura_em, now())
   where id = p_id and pessoa_id = auth.uid() and revogado_em is null;
end;
$fn$;

revoke all on function public.abrir_relatorio_publicado(bigint) from public, anon;
grant execute on function public.abrir_relatorio_publicado(bigint) to authenticated;


-- ---------- Ciência e manifestação pela pessoa ---------------------------
-- A ciência é dada uma vez. A manifestação pode ir junto ou ser
-- acrescentada depois, uma única vez (não se edita o que foi registrado).
create or replace function public.dar_ciencia_relatorio(p_id bigint, p_manifestacao text default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v public.desempenho_publicacoes%rowtype;
  v_txt text := nullif(btrim(coalesce(p_manifestacao, '')), '');
begin
  select * into v from public.desempenho_publicacoes
   where id = p_id and pessoa_id = auth.uid() and revogado_em is null;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;

  if v.ciente_em is null then
    update public.desempenho_publicacoes
       set ciente_em = now(),
           primeira_abertura_em = coalesce(primeira_abertura_em, now()),
           manifestacao = v_txt,
           manifestacao_em = case when v_txt is null then null else now() end
     where id = p_id;
  elsif v_txt is not null and v.manifestacao is null then
    update public.desempenho_publicacoes
       set manifestacao = v_txt, manifestacao_em = now()
     where id = p_id;
  else
    raise exception 'A ciência já foi registrada.';
  end if;
end;
$fn$;

revoke all on function public.dar_ciencia_relatorio(bigint, text) from public, anon;
grant execute on function public.dar_ciencia_relatorio(bigint, text) to authenticated;


-- ---------- Conferência -------------------------------------------------
-- Deve mostrar regra_de_acesso = true e as 4 funções.
select c.relname as tabela, c.relrowsecurity as regra_de_acesso,
       (select count(*) from pg_proc
         where proname in ('liberar_relatorio_pessoa', 'revogar_relatorio_pessoa',
                           'abrir_relatorio_publicado', 'dar_ciencia_relatorio')) as funcoes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'desempenho_publicacoes';
