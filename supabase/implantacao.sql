-- =====================================================================
-- Módulo de Implantação: construir o sistema de gestão, não auditá-lo.
--
-- ANTES:  o portal sabia auditar. Auditoria só serve a quem já tem
--         sistema — e o cliente que mais precisa da Real Life é
--         justamente o que não tem nada montado.
-- DEPOIS: uma trilha de implantação com cronograma por área da empresa,
--         onde cada item é uma atividade com passos: baixe o modelo,
--         preencha, suba o arquivo, espere a aprovação do consultor.
-- MOTIVO: pedido dele em 20/11/2026, com o cronograma do concorrente
--         (Blwinner) na mão. "temos que fazer no nosso da 9001/2026".
--
-- POR QUE TABELAS NOVAS E NÃO REUSAR `inspecoes`. São dois verbos
-- diferentes. A auditoria PERGUNTA ("atende?") e o resultado é um
-- parecer. A implantação MANDA FAZER ("baixe, preencha, suba") e o
-- resultado é um documento aprovado. Forçar as duas na mesma tabela
-- faria colunas que só valem para metade das linhas — e, pior, faria
-- a tela de auditoria quebrar toda vez que a implantação mudasse.
--
-- POR QUE A ETAPA TRAVA A SEGUINTE. No concorrente, a etapa seguinte
-- aparece com cadeado até a anterior fechar. Isso não é enfeite: quem
-- implanta sem ordem escreve a política da qualidade antes de saber o
-- escopo, e refaz tudo depois. A trava é a consultoria embutida.
--
-- POR QUE O PROGRESSO É UMA LINHA POR ATIVIDADE. Guardar "etapa 3
-- concluída" perderia quem entregou o quê e quando — que é exatamente
-- o que a certificadora pede para ver no ano seguinte.
--
-- Depende de supabase/inspecoes.sql (pode_gerir_inspecoes, eh_equipe)
-- e de supabase/modulo-auditoria.sql (empresa_tem_modulo).
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 1. O módulo vendido separadamente ---------------------------
alter table public.empresas
  add column if not exists modulo_implantacao boolean not null default false;

create or replace function public.empresa_tem_modulo(p_empresa uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_modulo
             when 'certificados' then e.modulo_certificados
             when 'treinamentos' then e.modulo_treinamentos
             when 'documentos'   then e.modulo_documentos
             when 'epi'          then e.modulo_epi
             when 'inspecoes'    then e.modulo_inspecoes
             when 'auditoria'    then e.modulo_auditoria
             when 'implantacao'  then e.modulo_implantacao
           end
    from public.empresas e
    where e.id = p_empresa
  ), false);
$$;


-- ---------- 2. A trilha-modelo ------------------------------------------
-- Uma por norma. A da 9001:2026 é a primeira; a da 45001 vem depois,
-- reusando a mesma estrutura.
create table if not exists public.implantacao_modelos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  norma       text,
  descricao   text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists implantacao_modelos_nome
  on public.implantacao_modelos (nome);


-- ---------- 3. As etapas do cronograma ----------------------------------
-- São as áreas da empresa, não os capítulos da norma. "Recursos
-- Humanos" e "Compras" é como o cliente pensa; "7.2 Competência" é
-- como a norma escreve. A coluna `requisitos` guarda a ponte entre os
-- dois, para o relatório conseguir provar a cobertura.
create table if not exists public.implantacao_etapas (
  id          uuid primary key default gen_random_uuid(),
  modelo_id   uuid not null references public.implantacao_modelos (id) on delete cascade,
  ordem       integer not null,
  nome        text not null,
  resumo      text,
  requisitos  text,
  -- Etapa que não trava a seguinte (ex.: a de abertura do projeto).
  livre       boolean not null default false
);

create unique index if not exists implantacao_etapas_ordem
  on public.implantacao_etapas (modelo_id, ordem);


-- ---------- 4. As atividades --------------------------------------------
-- O item do painel direito: a aula, os passos e o que entregar.
create table if not exists public.implantacao_atividades (
  id            uuid primary key default gen_random_uuid(),
  etapa_id      uuid not null references public.implantacao_etapas (id) on delete cascade,
  ordem         integer not null,
  titulo        text not null,
  tipo          text not null default 'atividade',
  -- O texto que ensina, em linguagem de negócio. Nunca o texto da
  -- norma: transcrever ABNT no produto é problema de direito autoral.
  aula          text,
  -- Os passos numerados, na ordem. Array e não texto para a tela poder
  -- numerar e, depois, marcar passo a passo.
  passos        text[] not null default '{}',
  requisito     text,
  -- Caminho no balde implantacao-modelos. Ex.: procedimento-informacao.docx
  modelo_arquivo text,
  modelo_rotulo  text,
  video_url      text,
  upload_obrigatorio    boolean not null default false,
  aprovacao_obrigatoria boolean not null default false
);

alter table public.implantacao_atividades drop constraint if exists implantacao_atividades_tipo;
alter table public.implantacao_atividades
  add constraint implantacao_atividades_tipo
  check (tipo in ('atividade', 'leitura', 'reuniao', 'feedback', 'revisao'));

create unique index if not exists implantacao_atividades_ordem
  on public.implantacao_atividades (etapa_id, ordem);


-- ---------- 5. A jornada de uma empresa ---------------------------------
create table if not exists public.implantacoes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  modelo_id      uuid not null references public.implantacao_modelos (id),
  modelo_nome    text,
  situacao       text not null default 'em_andamento',
  consultor_nome text,
  interlocutor_nome text,
  iniciada_em    timestamptz not null default now(),
  concluida_em   timestamptz
);

alter table public.implantacoes drop constraint if exists implantacoes_situacao;
alter table public.implantacoes
  add constraint implantacoes_situacao
  check (situacao in ('em_andamento', 'pausada', 'concluida', 'cancelada'));

create index if not exists implantacoes_empresa
  on public.implantacoes (empresa_id, iniciada_em desc);


-- ---------- 6. O progresso, uma linha por atividade ---------------------
create table if not exists public.implantacao_progresso (
  id               uuid primary key default gen_random_uuid(),
  implantacao_id   uuid not null references public.implantacoes (id) on delete cascade,
  atividade_id     uuid not null references public.implantacao_atividades (id) on delete cascade,
  situacao         text not null default 'pendente',
  anexos           text[] not null default '{}',
  comentario       text,
  enviado_em       timestamptz,
  enviado_por      uuid references public.profiles (id) on delete set null,
  enviado_por_nome text,
  aprovado_em      timestamptz,
  aprovado_por     uuid references public.profiles (id) on delete set null,
  aprovado_por_nome text,
  devolvido_motivo text
);

alter table public.implantacao_progresso drop constraint if exists implantacao_progresso_situacao;
alter table public.implantacao_progresso
  add constraint implantacao_progresso_situacao
  check (situacao in ('pendente', 'enviado', 'aprovado', 'devolvido', 'dispensado'));

create unique index if not exists implantacao_progresso_unico
  on public.implantacao_progresso (implantacao_id, atividade_id);


-- ---------- 7. Quem aprova é a equipe -----------------------------------
-- A empresa envia; quem diz que está bom é o consultor. Se o cliente
-- pudesse aprovar a si mesmo, a trilha viraria uma lista de caixinhas
-- marcadas e o documento sairia errado mesmo assim.
create or replace function public.implantacao_progresso_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nome text;
begin
  select p.nome into v_nome from public.profiles p where p.id = auth.uid();

  if new.situacao = 'enviado' and new.enviado_em is null then
    new.enviado_em := now();
    new.enviado_por := auth.uid();
    new.enviado_por_nome := coalesce(new.enviado_por_nome, v_nome);
  end if;

  if new.situacao = 'aprovado' then
    if not public.eh_equipe() then
      raise exception 'Só a equipe da Real Life aprova uma atividade.';
    end if;
    if new.aprovado_em is null then
      new.aprovado_em := now();
      new.aprovado_por := auth.uid();
      new.aprovado_por_nome := coalesce(new.aprovado_por_nome, v_nome);
    end if;
  end if;

  if new.situacao = 'devolvido' and not public.eh_equipe() then
    raise exception 'Só a equipe da Real Life devolve uma atividade.';
  end if;

  -- Voltou para pendente: limpa o carimbo, senão a tela mostra
  -- "aprovado em 12/03" numa atividade que está em aberto.
  if new.situacao in ('pendente', 'devolvido') then
    new.aprovado_em := null;
    new.aprovado_por := null;
    new.aprovado_por_nome := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists aa_implantacao_progresso on public.implantacao_progresso;
create trigger aa_implantacao_progresso
  before insert or update on public.implantacao_progresso
  for each row execute function public.implantacao_progresso_ajustes();


-- ---------- 8. O estado de cada etapa, numa consulta só -----------------
-- A tela precisa, para cada etapa: quantas atividades tem, quantas
-- estão aprovadas, e se a etapa está liberada. Calcular isso no
-- navegador daria uma consulta por etapa — dezesseis idas ao banco para
-- desenhar uma barra lateral.
create or replace view public.implantacao_etapas_estado as
with contagem as (
  select i.id                                        as implantacao_id,
         e.id                                        as etapa_id,
         e.ordem                                     as ordem,
         e.nome                                      as nome,
         e.resumo                                    as resumo,
         e.requisitos                                as requisitos,
         e.livre                                     as livre,
         count(a.id)                                 as atividades,
         count(p.id) filter (where p.situacao = 'aprovado')  as aprovadas,
         count(p.id) filter (where p.situacao = 'enviado')   as aguardando,
         count(p.id) filter (where p.situacao = 'devolvido') as devolvidas
    from public.implantacoes i
    join public.implantacao_etapas e      on e.modelo_id = i.modelo_id
    left join public.implantacao_atividades a on a.etapa_id = e.id
    left join public.implantacao_progresso p
           on p.atividade_id = a.id and p.implantacao_id = i.id
   group by i.id, e.id, e.ordem, e.nome, e.resumo, e.requisitos, e.livre
)
select c.*,
       -- Fechada quando toda atividade dela está aprovada.
       (c.atividades > 0 and c.aprovadas = c.atividades) as fechada,
       -- Liberada quando é livre, é a primeira, ou toda etapa anterior
       -- já fechou. `bool_and` sobre conjunto vazio devolve null, daí o
       -- coalesce: a primeira etapa não tem anterior e tem de abrir.
       coalesce(
         c.livre
         or coalesce((
              select bool_and(ant.atividades > 0 and ant.aprovadas = ant.atividades)
                from contagem ant
               where ant.implantacao_id = c.implantacao_id
                 and ant.ordem < c.ordem
                 and not ant.livre
            ), true),
         false) as liberada
  from contagem c;


-- ---------- 9. Baldes ---------------------------------------------------
-- Modelos de documento: sem dado de cliente, todo autenticado lê, só a
-- equipe escreve.
insert into storage.buckets (id, name, public, file_size_limit)
values ('implantacao-modelos', 'implantacao-modelos', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists implantacao_modelos_leitura on storage.objects;
create policy implantacao_modelos_leitura
  on storage.objects for select to authenticated
  using (bucket_id = 'implantacao-modelos');

drop policy if exists implantacao_modelos_escrita on storage.objects;
create policy implantacao_modelos_escrita
  on storage.objects for all to authenticated
  using (bucket_id = 'implantacao-modelos' and public.eh_equipe())
  with check (bucket_id = 'implantacao-modelos' and public.eh_equipe());

-- Entregas: documento preenchido pelo cliente, balde privado.
insert into storage.buckets (id, name, public, file_size_limit)
values ('implantacao-entregas', 'implantacao-entregas', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists implantacao_entregas_acesso on storage.objects;
create policy implantacao_entregas_acesso
  on storage.objects for all to authenticated
  using (
    bucket_id = 'implantacao-entregas'
    and exists (
      select 1 from public.implantacoes i
       where i.id::text = split_part(name, '/', 1)
         and public.pode_gerir_inspecoes(i.empresa_id)
    )
  )
  with check (
    bucket_id = 'implantacao-entregas'
    and exists (
      select 1 from public.implantacoes i
       where i.id::text = split_part(name, '/', 1)
         and public.pode_gerir_inspecoes(i.empresa_id)
    )
  );


-- ---------- 10. RLS ------------------------------------------------------
alter table public.implantacao_modelos     enable row level security;
alter table public.implantacao_etapas      enable row level security;
alter table public.implantacao_atividades  enable row level security;
alter table public.implantacoes            enable row level security;
alter table public.implantacao_progresso   enable row level security;

-- A trilha-modelo é material nosso: todo autenticado lê, só a equipe mexe.
drop policy if exists implantacao_modelos_todos on public.implantacao_modelos;
create policy implantacao_modelos_todos
  on public.implantacao_modelos for select to authenticated using (true);

drop policy if exists implantacao_modelos_equipe on public.implantacao_modelos;
create policy implantacao_modelos_equipe
  on public.implantacao_modelos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists implantacao_etapas_todos on public.implantacao_etapas;
create policy implantacao_etapas_todos
  on public.implantacao_etapas for select to authenticated using (true);

drop policy if exists implantacao_etapas_equipe on public.implantacao_etapas;
create policy implantacao_etapas_equipe
  on public.implantacao_etapas for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists implantacao_atividades_todos on public.implantacao_atividades;
create policy implantacao_atividades_todos
  on public.implantacao_atividades for select to authenticated using (true);

drop policy if exists implantacao_atividades_equipe on public.implantacao_atividades;
create policy implantacao_atividades_equipe
  on public.implantacao_atividades for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- A jornada e o progresso são da empresa.
drop policy if exists implantacoes_acesso on public.implantacoes;
create policy implantacoes_acesso
  on public.implantacoes for all to authenticated
  using (public.pode_gerir_inspecoes(empresa_id))
  with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists implantacao_progresso_acesso on public.implantacao_progresso;
create policy implantacao_progresso_acesso
  on public.implantacao_progresso for all to authenticated
  using (exists (
    select 1 from public.implantacoes i
     where i.id = implantacao_progresso.implantacao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ))
  with check (exists (
    select 1 from public.implantacoes i
     where i.id = implantacao_progresso.implantacao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

-- Módulo pago: o cliente só vê a própria jornada se contratou.
drop policy if exists implantacoes_modulo_contratado on public.implantacoes;
create policy implantacoes_modulo_contratado
  on public.implantacoes
  as restrictive
  for select to authenticated
  using (public.eh_equipe() or public.empresa_tem_modulo(empresa_id, 'implantacao'));

grant select, insert, update, delete on public.implantacoes          to authenticated;
grant select, insert, update, delete on public.implantacao_progresso to authenticated;
grant select, insert, update, delete on public.implantacao_modelos    to authenticated;
grant select, insert, update, delete on public.implantacao_etapas     to authenticated;
grant select, insert, update, delete on public.implantacao_atividades to authenticated;
grant select on public.implantacao_etapas_estado to authenticated;
revoke all on public.implantacoes            from anon;
revoke all on public.implantacao_progresso   from anon;
revoke all on public.implantacao_modelos     from anon;
revoke all on public.implantacao_etapas      from anon;
revoke all on public.implantacao_atividades  from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name in ('implantacao_modelos', 'implantacao_etapas',
                              'implantacao_atividades', 'implantacoes',
                              'implantacao_progresso'))              as tabelas,
       (select count(*) from information_schema.views
         where table_schema = 'public'
           and table_name = 'implantacao_etapas_estado')             as visao,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'empresas'
           and column_name = 'modulo_implantacao')                   as coluna_do_modulo;
