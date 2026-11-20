-- =====================================================================
-- Foto em cada item da inspeção.
--
-- ANTES:  a inspeção registrava a resposta e a observação. A prova do
--         que foi visto ficava no celular do técnico, ou em lugar
--         nenhum.
-- DEPOIS: cada item aceita fotos, guardadas num balde privado, e a
--         primeira vai junto para a não conformidade que o item abrir.
-- MOTIVO: pedido dele em 20/11/2026. E é o que separa um relatório que
--         se discute de um que não se discute: "material empilhado
--         fora do lugar" é opinião; a foto do material empilhado não é.
--
-- VÁRIAS FOTOS POR ITEM, e não uma. Um mesmo achado costuma precisar do
-- geral e do detalhe — a pilha inteira e a parte que está cedendo.
-- A coluna foto_path continua existindo e guarda a primeira, que é a
-- que a não conformidade leva.
--
-- BALDE PRIVADO, como o do EPI. Foto de obra mostra trabalhador, e o
-- caminho começa pelo id da empresa para a política saber de quem é.
--
-- Depende de supabase/inspecoes.sql.
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


-- ---------- 1. A lista de fotos ----------------------------------------
alter table public.inspecao_respostas
  add column if not exists fotos text[] not null default '{}';

-- Limite por item: três fotos resolvem o geral, o detalhe e a medida.
-- Sem limite, uma inspeção de 40 itens vira um álbum que ninguém abre.
alter table public.inspecao_respostas drop constraint if exists inspecao_respostas_fotos;
alter table public.inspecao_respostas
  add constraint inspecao_respostas_fotos check (array_length(fotos, 1) is null or array_length(fotos, 1) <= 3);


-- ---------- 2. Balde das fotos -----------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspecao-fotos', 'inspecao-fotos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O caminho começa com o id da empresa: inspecao-fotos/<empresa_id>/<arquivo>.
drop policy if exists inspecao_fotos_leitura on storage.objects;
create policy inspecao_fotos_leitura
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inspecao-fotos'
    and public.pode_gerir_inspecoes(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists inspecao_fotos_envio on storage.objects;
create policy inspecao_fotos_envio
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspecao-fotos'
    and public.pode_gerir_inspecoes(nullif(split_part(name, '/', 1), '')::uuid)
  );

-- Apagar a foto que acabou de subir errada: só quem pode a empresa.
drop policy if exists inspecao_fotos_remocao on storage.objects;
create policy inspecao_fotos_remocao
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inspecao-fotos'
    and public.pode_gerir_inspecoes(nullif(split_part(name, '/', 1), '')::uuid)
  );


-- ---------- 3. A primeira foto vai para a não conformidade --------------
-- Recriada inteira, por convenção: é a versão de supabase/inspecoes.sql
-- com a foto saindo da lista nova.
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

    for r in
      select id, pergunta, observacao, foto_path, fotos
        from public.inspecao_respostas
       where inspecao_id = new.id and resposta = 'nao_conforme'
       order by ordem
    loop
      if not exists (select 1 from public.nao_conformidades where resposta_id = r.id) then
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
select (select count(*) from storage.buckets where id = 'inspecao-fotos')       as balde,
       (select count(*) from pg_policies
         where schemaname = 'storage' and policyname like 'inspecao_fotos%')    as politicas,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecao_respostas'
           and column_name = 'fotos')                                           as campo_fotos;
