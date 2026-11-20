-- =====================================================================
-- Editar uma inspeção já concluída.
--
-- ANTES:  concluiu, acabou. Clique errado numa pergunta ficava errado
--         para sempre, e a única saída era abrir outra inspeção — que
--         deixa duas no histórico contando a mesma visita.
-- DEPOIS: a inspeção pode ser reaberta, corrigida e concluída de novo.
--         Cada reabertura fica registrada com quem, quando e por quê.
-- MOTIVO: pedido dele em 20/11/2026. Inspeção é documento, e documento
--         que não pode ser corrigido vira documento que ninguém
--         confia — a pessoa passa a manter a planilha paralela "de
--         verdade" do lado.
--
-- POR QUE EXIGIR MOTIVO. O que protege o documento não é impedir a
-- correção: é deixar claro o que foi corrigido e por quem. Sem motivo,
-- a reabertura é indistinguível de maquiar resultado.
--
-- O QUE ACONTECE COM AS NÃO CONFORMIDADES. Ao concluir de novo, o item
-- que deixou de ser "não conforme" tem a NC dele CANCELADA, com a
-- razão registrada na descrição. Não apaga: a NC existiu, alguém pode
-- tê-la visto, e sumir com ela é pior que mostrá-la cancelada. NC já
-- encerrada não é tocada — aquilo já foi tratado.
--
-- Depende de supabase/inspecoes.sql e supabase/inspecoes-fotos.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.inspecoes') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;
end
$$;


-- ---------- 1. O histórico das reaberturas ------------------------------
create table if not exists public.inspecoes_alteracoes (
  id          bigint generated always as identity primary key,
  inspecao_id uuid not null references public.inspecoes (id) on delete cascade,
  de          text not null,
  para        text not null,
  motivo      text not null,
  por         uuid references public.profiles (id) on delete set null,
  por_nome    text,
  created_at  timestamptz not null default now()
);

create index if not exists inspecoes_alteracoes_inspecao
  on public.inspecoes_alteracoes (inspecao_id, created_at desc);

alter table public.inspecoes_alteracoes enable row level security;

drop policy if exists inspecoes_alteracoes_leitura on public.inspecoes_alteracoes;
create policy inspecoes_alteracoes_leitura
  on public.inspecoes_alteracoes for select to authenticated
  using (exists (
    select 1 from public.inspecoes i
     where i.id = inspecoes_alteracoes.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

grant select on public.inspecoes_alteracoes to authenticated;
revoke insert, update, delete, truncate on public.inspecoes_alteracoes from anon, authenticated;
revoke all on public.inspecoes_alteracoes from anon;


-- O campo onde a tela escreve o porquê da reabertura. O gatilho lê,
-- grava no histórico e limpa — ele não fica na linha da inspeção.
alter table public.inspecoes
  add column if not exists motivo_reabertura text;


-- ---------- 2. Ajustes na gravação -------------------------------------
-- Recriada inteira, por convenção: é a versão de
-- supabase/inspecoes-fotos.sql mais a reabertura.
create or replace function public.inspecoes_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_total integer;
  v_conf  integer;
  v_nc    integer;
  v_na    integer;
  v_prazo date;
  v_nome  text;
  r       record;
begin
  if tg_op = 'INSERT' then
    new.inspetor_id := coalesce(new.inspetor_id, auth.uid());
    new.created_at  := now();
  else
    new.empresa_id := old.empresa_id;
    new.created_at := old.created_at;
  end if;

  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

  -- ---------- Reabertura ----------
  if tg_op = 'UPDATE'
     and old.situacao = 'concluida'
     and new.situacao = 'em_andamento' then

    if nullif(btrim(coalesce(new.motivo_reabertura, '')), '') is null then
      raise exception 'Para reabrir a inspeção, diga o motivo.';
    end if;

    select coalesce(p.nome, p.email) into v_nome
      from public.profiles p where p.id = auth.uid();

    insert into public.inspecoes_alteracoes (inspecao_id, de, para, motivo, por, por_nome)
    values (new.id, old.situacao, new.situacao, btrim(new.motivo_reabertura), auth.uid(), v_nome);

    -- A conclusão anterior deixa de valer; os números voltam a sair da
    -- próxima conclusão.
    new.concluida_em := null;
  end if;

  -- O motivo não mora na inspeção: ele foi para o histórico.
  new.motivo_reabertura := null;

  -- ---------- Conclusão ----------
  if new.situacao = 'concluida' and coalesce(old.situacao, '') <> 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());

    select count(*),
           count(*) filter (where resposta = 'conforme'),
           count(*) filter (where resposta = 'nao_conforme'),
           count(*) filter (where resposta = 'nao_aplicavel')
      into v_total, v_conf, v_nc, v_na
      from public.inspecao_respostas
     where inspecao_id = new.id;

    new.itens_total    := coalesce(v_total, 0);
    new.conformes      := coalesce(v_conf, 0);
    new.nao_conformes  := coalesce(v_nc, 0);
    new.nao_aplicaveis := coalesce(v_na, 0);

    if coalesce(v_conf, 0) + coalesce(v_nc, 0) > 0 then
      new.percentual := round(100.0 * v_conf / (v_conf + v_nc), 2);
    else
      new.percentual := null;
    end if;

    v_prazo := (new.concluida_em at time zone 'America/Porto_Velho')::date + 30;

    -- Item que deixou de ser "não conforme" na correção: a NC dele é
    -- cancelada, não apagada. Já encerrada não se toca.
    update public.nao_conformidades n
       set situacao = 'cancelada',
           descricao = n.descricao || ' — cancelada: o item deixou de ser não conforme na revisão da inspeção.'
     where n.inspecao_id = new.id
       and n.situacao not in ('encerrada', 'cancelada')
       and exists (
         select 1 from public.inspecao_respostas r
          where r.id = n.resposta_id
            and coalesce(r.resposta, '') <> 'nao_conforme'
       );

    for r in
      select id, pergunta, observacao, foto_path, fotos
        from public.inspecao_respostas
       where inspecao_id = new.id and resposta = 'nao_conforme'
       order by ordem
    loop
      -- Não duplica o que já existe, inclusive numa reconclusão.
      if not exists (
        select 1 from public.nao_conformidades
         where resposta_id = r.id and situacao <> 'cancelada'
      ) then
        insert into public.nao_conformidades (
          empresa_id, inspecao_id, resposta_id, local_id, local_nome,
          descricao, foto_path, prazo, aberta_por
        ) values (
          new.empresa_id, new.id, r.id, new.local_id, new.local_nome,
          r.pergunta || case when nullif(btrim(coalesce(r.observacao, '')), '') is null
                             then '' else ' — ' || btrim(r.observacao) end,
          coalesce(r.foto_path, r.fotos[1]), v_prazo, auth.uid()
        );
      end if;
    end loop;
  end if;

  return new;
end;
$fn$;

drop trigger if exists inspecoes_ajustes on public.inspecoes;
create trigger inspecoes_ajustes
  before insert or update on public.inspecoes
  for each row execute function public.inspecoes_ajustes();


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.inspecoes_alteracoes)                       as reaberturas,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecoes'
           and column_name = 'motivo_reabertura')                               as campo_motivo,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'inspecoes_alteracoes')    as politicas;
