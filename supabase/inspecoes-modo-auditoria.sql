-- =====================================================================
-- Modo auditoria: evidência enviada pelo cliente, avaliada pela equipe.
--
-- ANTES:  o módulo tratava tudo como inspeção — conforme, não conforme
--         ou não se aplica, olhando a coisa em campo.
-- DEPOIS: o modelo diz se é inspeção ou AUDITORIA. Na auditoria o item
--         tem explicação do que pedir, um modelo de documento para o
--         cliente baixar, e o cliente anexa a evidência para a equipe
--         avaliar. A resposta ganha "atende parcialmente".
-- MOTIVO: pedido dele em 20/11/2026, com o desenho aprovado.
--
-- POR QUE "ATENDE PARCIALMENTE" EXISTE. Em auditoria o meio-termo é
-- real: o programa existe mas não cobre todas as áreas. Forçar a
-- escolha entre atende e não atende empurra o auditor para o lado
-- errado — normalmente o generoso — e a constatação perde valor.
--
-- COMO ENTRA NA CONTA. Parcial vale MEIO ponto no percentual e ABRE não
-- conformidade, como o "não atende". Vale meio porque parte do
-- requisito está lá; abre NC porque a parte que falta precisa de dono
-- e prazo, senão fica eternamente "quase".
--
-- A AVALIAÇÃO É DO ITEM, NÃO DO ARQUIVO. O auditor julga o requisito
-- olhando o que foi enviado; marcar arquivo por arquivo dividiria a
-- mesma decisão em duas e deixaria as duas pela metade.
--
-- MODELO DE DOCUMENTO É DA CASA, não da empresa: o balde é de leitura
-- para todo usuário autenticado e só a equipe escreve. Não há dado de
-- cliente ali — é a minuta de ata, o programa em branco.
--
-- Depende de supabase/inspecoes.sql e supabase/inspecoes-reabrir.sql.
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


-- ---------- 1. O modelo diz o que é ------------------------------------
alter table public.inspecao_modelos
  add column if not exists tipo text not null default 'inspecao';

alter table public.inspecao_modelos drop constraint if exists inspecao_modelos_tipo;
alter table public.inspecao_modelos
  add constraint inspecao_modelos_tipo check (tipo in ('inspecao', 'auditoria'));

-- Os dois checklists de auditoria já criados passam a ser auditoria.
update public.inspecao_modelos
   set tipo = 'auditoria'
 where empresa_id is null
   and nome in ('Auditoria interna — ISO 45001', 'Auditoria interna — ISO 9001')
   and tipo <> 'auditoria';

alter table public.inspecoes
  add column if not exists tipo text not null default 'inspecao';

alter table public.inspecoes drop constraint if exists inspecoes_tipo;
alter table public.inspecoes
  add constraint inspecoes_tipo check (tipo in ('inspecao', 'auditoria'));


-- ---------- 2. Explicação e modelo de documento no item -----------------
alter table public.inspecao_modelo_itens
  add column if not exists explicacao      text,
  -- Caminho no balde inspecao-modelos. Ex.: ata-analise-critica.docx
  add column if not exists modelo_arquivo  text,
  add column if not exists modelo_rotulo   text;


-- ---------- 3. A quarta resposta e os anexos ----------------------------
alter table public.inspecao_respostas
  add column if not exists anexos text[] not null default '{}';

alter table public.inspecao_respostas drop constraint if exists inspecao_respostas_anexos;
alter table public.inspecao_respostas
  add constraint inspecao_respostas_anexos
  check (array_length(anexos, 1) is null or array_length(anexos, 1) <= 10);

alter table public.inspecao_respostas drop constraint if exists inspecao_respostas_valor;
alter table public.inspecao_respostas
  add constraint inspecao_respostas_valor
  check (resposta is null or resposta in
         ('conforme', 'nao_conforme', 'nao_aplicavel', 'atende_parcial'));

alter table public.inspecoes
  add column if not exists parciais integer not null default 0;


-- ---------- 4. Não conformidade maior ou menor --------------------------
alter table public.nao_conformidades
  add column if not exists classificacao text;

alter table public.nao_conformidades drop constraint if exists nao_conformidades_classificacao;
alter table public.nao_conformidades
  add constraint nao_conformidades_classificacao
  check (classificacao is null or classificacao in ('maior', 'menor', 'observacao'));


-- ---------- 5. Baldes ---------------------------------------------------
-- Modelos de documento: sem dado de cliente, todo autenticado lê, só a
-- equipe escreve.
insert into storage.buckets (id, name, public, file_size_limit)
values ('inspecao-modelos', 'inspecao-modelos', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists inspecao_modelos_arquivo_leitura on storage.objects;
create policy inspecao_modelos_arquivo_leitura
  on storage.objects for select to authenticated
  using (bucket_id = 'inspecao-modelos');

drop policy if exists inspecao_modelos_arquivo_escrita on storage.objects;
create policy inspecao_modelos_arquivo_escrita
  on storage.objects for all to authenticated
  using (bucket_id = 'inspecao-modelos' and public.eh_equipe())
  with check (bucket_id = 'inspecao-modelos' and public.eh_equipe());

-- Evidências: documento do cliente, balde privado por empresa.
insert into storage.buckets (id, name, public, file_size_limit)
values ('inspecao-evidencias', 'inspecao-evidencias', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists inspecao_evidencias_leitura on storage.objects;
create policy inspecao_evidencias_leitura
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inspecao-evidencias'
    and public.pode_gerir_inspecoes(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists inspecao_evidencias_envio on storage.objects;
create policy inspecao_evidencias_envio
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspecao-evidencias'
    and public.pode_gerir_inspecoes(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists inspecao_evidencias_remocao on storage.objects;
create policy inspecao_evidencias_remocao
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inspecao-evidencias'
    and public.pode_gerir_inspecoes(nullif(split_part(name, '/', 1), '')::uuid)
  );


-- ---------- 6. A conclusão passa a contar o parcial ---------------------
-- Recriada inteira, por convenção: é a versão de
-- supabase/inspecoes-reabrir.sql mais o "atende parcialmente".
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
  v_par   integer;
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
    new.tipo       := old.tipo;
  end if;

  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

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

    new.concluida_em := null;
  end if;

  new.motivo_reabertura := null;

  if new.situacao = 'concluida' and coalesce(old.situacao, '') <> 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());

    select count(*),
           count(*) filter (where resposta = 'conforme'),
           count(*) filter (where resposta = 'nao_conforme'),
           count(*) filter (where resposta = 'nao_aplicavel'),
           count(*) filter (where resposta = 'atende_parcial')
      into v_total, v_conf, v_nc, v_na, v_par
      from public.inspecao_respostas
     where inspecao_id = new.id;

    new.itens_total    := coalesce(v_total, 0);
    new.conformes      := coalesce(v_conf, 0);
    new.nao_conformes  := coalesce(v_nc, 0);
    new.nao_aplicaveis := coalesce(v_na, 0);
    new.parciais       := coalesce(v_par, 0);

    -- Parcial vale meio ponto: parte do requisito está lá.
    if coalesce(v_conf, 0) + coalesce(v_nc, 0) + coalesce(v_par, 0) > 0 then
      new.percentual := round(
        100.0 * (v_conf + 0.5 * v_par) / (v_conf + v_nc + v_par), 2);
    else
      new.percentual := null;
    end if;

    v_prazo := (new.concluida_em at time zone 'America/Porto_Velho')::date + 30;

    update public.nao_conformidades n
       set situacao = 'cancelada',
           descricao = n.descricao || ' — cancelada: o item deixou de ser não conforme na revisão da inspeção.'
     where n.inspecao_id = new.id
       and n.situacao not in ('encerrada', 'cancelada')
       and exists (
         select 1 from public.inspecao_respostas r
          where r.id = n.resposta_id
            and coalesce(r.resposta, '') not in ('nao_conforme', 'atende_parcial')
       );

    -- Parcial também abre NC: a parte que falta precisa de dono e prazo,
    -- senão fica eternamente "quase".
    for r in
      select id, pergunta, observacao, foto_path, fotos, resposta
        from public.inspecao_respostas
       where inspecao_id = new.id
         and resposta in ('nao_conforme', 'atende_parcial')
       order by ordem
    loop
      if not exists (
        select 1 from public.nao_conformidades
         where resposta_id = r.id and situacao <> 'cancelada'
      ) then
        insert into public.nao_conformidades (
          empresa_id, inspecao_id, resposta_id, local_id, local_nome,
          descricao, foto_path, prazo, aberta_por, classificacao
        ) values (
          new.empresa_id, new.id, r.id, new.local_id, new.local_nome,
          r.pergunta
            || case when r.resposta = 'atende_parcial' then ' — atende parcialmente' else '' end
            || case when nullif(btrim(coalesce(r.observacao, '')), '') is null
                    then '' else ' — ' || btrim(r.observacao) end,
          coalesce(r.foto_path, r.fotos[1]), v_prazo, auth.uid(),
          case when new.tipo = 'auditoria'
               then case when r.resposta = 'atende_parcial' then 'menor' else 'maior' end
          end
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
select (select count(*) from public.inspecao_modelos where tipo = 'auditoria')  as modelos_auditoria,
       (select count(*) from storage.buckets
         where id in ('inspecao-modelos', 'inspecao-evidencias'))               as baldes,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecao_modelo_itens'
           and column_name in ('explicacao', 'modelo_arquivo', 'modelo_rotulo')) as campos_item,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecao_respostas'
           and column_name = 'anexos')                                           as campo_anexos;
