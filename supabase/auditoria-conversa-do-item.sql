-- =====================================================================
-- Conversa por requisito, registrada como chamado.
--
-- ANTES:  o cliente mandava o arquivo e o auditor aceitava ou recusava.
--         A pergunta "por que recusou?" acontecia por WhatsApp, fora do
--         sistema, e sumia.
-- DEPOIS: cada requisito tem uma conversa. O cliente comenta, o auditor
--         responde, tudo fica datado e com autor. Quando o auditor dá
--         por atendido, o requisito é aprovado e a conversa é encerrada.
-- MOTIVO: pedido dele em 20/11/2026 — "igual chamado, depois de
--         aprovado aí sim passa para o próximo item".
--
-- POR QUE ISSO VALE MAIS DO QUE PARECE. Numa auditoria de certificação
-- o auditor externo pergunta como a empresa tratou cada achado. Ter a
-- conversa inteira — o que foi pedido, o que foi enviado, por que foi
-- recusado e o que foi enviado depois — é a diferença entre dizer "a
-- gente resolveu" e mostrar quando e com quem.
--
-- MENSAGEM NÃO SE EDITA NEM SE APAGA. Registro que pode ser reescrito
-- depois não serve como evidência. Quem errou manda outra mensagem
-- corrigindo, e as duas ficam.
--
-- O PAPEL É DECIDIDO PELO BANCO, não pela tela: é ele que sabe se quem
-- escreveu é da equipe ou da empresa. Tela mente, perfil não.
--
-- Depende de supabase/inspecoes.sql e supabase/inspecoes-modo-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.inspecao_respostas') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;
end
$$;


-- ---------- 1. A conversa ----------------------------------------------
create table if not exists public.inspecao_resposta_mensagens (
  id          bigint generated always as identity primary key,
  resposta_id uuid not null references public.inspecao_respostas (id) on delete cascade,
  texto       text not null,
  autor       uuid references public.profiles (id) on delete set null,
  autor_nome  text,
  -- 'equipe' ou 'cliente'. Quem decide é o gatilho.
  autor_papel text not null default 'cliente',
  created_at  timestamptz not null default now()
);

alter table public.inspecao_resposta_mensagens drop constraint if exists irm_papel;
alter table public.inspecao_resposta_mensagens
  add constraint irm_papel check (autor_papel in ('equipe', 'cliente'));

alter table public.inspecao_resposta_mensagens drop constraint if exists irm_texto;
alter table public.inspecao_resposta_mensagens
  add constraint irm_texto check (length(btrim(texto)) >= 2);

create index if not exists irm_resposta
  on public.inspecao_resposta_mensagens (resposta_id, created_at);


-- ---------- 2. Aprovação do requisito -----------------------------------
-- A aprovação é do AUDITOR, e é o que encerra a conversa daquele item.
alter table public.inspecao_respostas
  add column if not exists aprovado_em   timestamptz,
  add column if not exists aprovado_por  uuid references public.profiles (id) on delete set null,
  add column if not exists aprovado_nome text;


-- ---------- 3. Quem escreveu, e em que papel ---------------------------
create or replace function public.inspecao_resposta_mensagens_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nome   text;
  v_perfil text;
begin
  new.texto := btrim(new.texto);
  new.autor := coalesce(auth.uid(), new.autor);
  new.created_at := now();

  select coalesce(p.nome, p.email), p.perfil
    into v_nome, v_perfil
    from public.profiles p
   where p.id = auth.uid();

  new.autor_nome  := coalesce(v_nome, new.autor_nome);
  new.autor_papel := case when v_perfil in ('atendimento', 'gestor', 'admin')
                          then 'equipe' else 'cliente' end;

  return new;
end;
$fn$;

drop trigger if exists inspecao_resposta_mensagens_ajustes on public.inspecao_resposta_mensagens;
create trigger inspecao_resposta_mensagens_ajustes
  before insert on public.inspecao_resposta_mensagens
  for each row execute function public.inspecao_resposta_mensagens_ajustes();


-- ---------- 4. Só a equipe aprova --------------------------------------
-- A tela esconde o botão para o cliente; isto garante. Esconder botão
-- não é controle de acesso.
create or replace function public.inspecao_respostas_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nome text;
begin
  if coalesce(new.aprovado_em, 'epoch'::timestamptz)
     is distinct from coalesce(old.aprovado_em, 'epoch'::timestamptz) then

    if new.aprovado_em is not null then
      if not public.eh_equipe() then
        raise exception 'Só a equipe auditora aprova um requisito.';
      end if;

      select coalesce(p.nome, p.email) into v_nome
        from public.profiles p where p.id = auth.uid();

      new.aprovado_por  := auth.uid();
      new.aprovado_nome := v_nome;
    else
      if not public.eh_equipe() then
        raise exception 'Só a equipe auditora reabre um requisito aprovado.';
      end if;
      new.aprovado_por  := null;
      new.aprovado_nome := null;
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists inspecao_respostas_aprovacao on public.inspecao_respostas;
create trigger inspecao_respostas_aprovacao
  before update on public.inspecao_respostas
  for each row execute function public.inspecao_respostas_aprovacao();


-- ---------- 5. RLS ------------------------------------------------------
alter table public.inspecao_resposta_mensagens enable row level security;

drop policy if exists irm_leitura on public.inspecao_resposta_mensagens;
create policy irm_leitura
  on public.inspecao_resposta_mensagens for select to authenticated
  using (exists (
    select 1
      from public.inspecao_respostas r
      join public.inspecoes i on i.id = r.inspecao_id
     where r.id = inspecao_resposta_mensagens.resposta_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

drop policy if exists irm_inclusao on public.inspecao_resposta_mensagens;
create policy irm_inclusao
  on public.inspecao_resposta_mensagens for insert to authenticated
  with check (exists (
    select 1
      from public.inspecao_respostas r
      join public.inspecoes i on i.id = r.inspecao_id
     where r.id = inspecao_resposta_mensagens.resposta_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

grant select, insert on public.inspecao_resposta_mensagens to authenticated;
revoke update, delete, truncate on public.inspecao_resposta_mensagens from anon, authenticated;
revoke all on public.inspecao_resposta_mensagens from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.inspecao_resposta_mensagens)              as mensagens,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecao_respostas'
           and column_name in ('aprovado_em', 'aprovado_por', 'aprovado_nome')) as campos_aprovacao,
       (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename = 'inspecao_resposta_mensagens')                       as politicas;
