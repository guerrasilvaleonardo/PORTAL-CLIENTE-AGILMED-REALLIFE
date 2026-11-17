-- =====================================================================
-- Entrega de EPI: registro, foto e assinatura do trabalhador.
--
-- ANTES:  o portal tinha os dois cadastros (colaboradores.sql e
--         epis.sql), mas nada que registrasse a entrega em si. A ficha
--         da NR-06 continuava no papel ou em outro sistema.
-- DEPOIS: duas tabelas. epi_entregas é o ato: quem recebeu, quem
--         entregou, quando, a foto e a assinatura. epi_entregas_itens
--         são os equipamentos daquela entrega, com o CA e o prazo de
--         troca congelados no momento em que saiu do almoxarifado.
--         Mais o balde privado "epi-fotos" para as fotos.
-- MOTIVO: é o documento que a fiscalização pede e o que defende a
--         empresa numa reclamatória. Sem registro de entrega, o EPI
--         comprado não serve de defesa.
--
-- POR QUE O CA E O PRAZO FICAM CONGELADOS NO ITEM. O cadastro do EPI
-- muda: o CA é renovado, a vida útil é ajustada, o item sai de linha. A
-- ficha precisa dizer o que foi entregue naquele dia, não o que o
-- cadastro diz hoje. Então nome, CA e vida útil são copiados para o
-- item, e epi_id fica só como referência.
--
-- COMO O TRABALHADOR ASSINA. Cada entrega nasce com um token aleatório.
-- O portal mostra um QR com esse token; o trabalhador abre no celular
-- dele, confere o próprio CPF e assina. Quem não assina na hora recebe o
-- mesmo link por e-mail. A página de assinatura não exige login — por
-- isso ela passa por uma rota do servidor com a chave de serviço, e não
-- por acesso anônimo ao banco: não há política para anon aqui.
--
-- Depende de supabase/colaboradores.sql e supabase/epis.sql.
-- Não altera nem apaga nada do que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.colaboradores') is null then
    raise exception 'Rode antes supabase/colaboradores.sql (falta a tabela colaboradores).';
  end if;
  if to_regclass('public.epis') is null then
    raise exception 'Rode antes supabase/epis.sql (falta a tabela epis).';
  end if;
end
$$;


-- ---------- 1. Tabelas ------------------------------------------------
create table if not exists public.epi_entregas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas (id) on delete cascade,
  colaborador_id   uuid not null references public.colaboradores (id) on delete restrict,
  entregue_em      timestamptz not null default now(),
  entregue_por     uuid references public.profiles (id) on delete set null,
  -- Nome de quem entregou, congelado: o usuário pode sair da empresa depois.
  entregue_por_nome text,
  foto_path        text not null,
  observacoes      text,
  -- Assinatura
  token            text not null default encode(gen_random_bytes(16), 'hex'),
  assinado_em      timestamptz,
  assinatura_ip    text,
  assinatura_agente text,
  cancelada_em     timestamptz,
  cancelada_por    uuid references public.profiles (id) on delete set null,
  motivo_cancelamento text,
  created_at       timestamptz not null default now()
);

create unique index if not exists epi_entregas_token on public.epi_entregas (token);
create index if not exists epi_entregas_empresa on public.epi_entregas (empresa_id, entregue_em desc);
create index if not exists epi_entregas_colaborador on public.epi_entregas (colaborador_id, entregue_em desc);
create index if not exists epi_entregas_pendentes
  on public.epi_entregas (empresa_id) where assinado_em is null and cancelada_em is null;

create table if not exists public.epi_entregas_itens (
  id             uuid primary key default gen_random_uuid(),
  entrega_id     uuid not null references public.epi_entregas (id) on delete cascade,
  epi_id         uuid references public.epis (id) on delete set null,
  -- Congelados no momento da entrega. Ver o cabeçalho.
  nome           text not null,
  ca             text,
  complemento    text,
  vida_util_dias integer not null,
  quantidade     integer not null default 1,
  motivo         text not null default 'entrega',
  troca_em       date not null,
  created_at     timestamptz not null default now()
);

create index if not exists epi_entregas_itens_entrega on public.epi_entregas_itens (entrega_id);
create index if not exists epi_entregas_itens_troca on public.epi_entregas_itens (troca_em);

alter table public.epi_entregas_itens drop constraint if exists epi_entregas_itens_motivo;
alter table public.epi_entregas_itens
  add constraint epi_entregas_itens_motivo
  check (motivo in ('entrega', 'substituicao', 'perda', 'dano', 'desgaste'));

alter table public.epi_entregas_itens drop constraint if exists epi_entregas_itens_quantidade;
alter table public.epi_entregas_itens
  add constraint epi_entregas_itens_quantidade check (quantidade between 1 and 999);


-- ---------- 2. Ajustes e proteção dos campos ---------------------------
-- A entrega não é editada depois de salva: ela é o registro de um ato que
-- aconteceu. Só a assinatura e o cancelamento mudam de estado.
create or replace function public.epi_entregas_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    new.foto_path := nullif(btrim(coalesce(new.foto_path, '')), '');
    if new.foto_path is null then
      raise exception 'A entrega precisa da foto.';
    end if;
    new.entregue_por := coalesce(auth.uid(), new.entregue_por);
    new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');
    new.created_at := now();
    new.assinado_em := null;
    new.cancelada_em := null;
    return new;
  end if;

  -- O que aconteceu não muda.
  new.id := old.id;
  new.empresa_id := old.empresa_id;
  new.colaborador_id := old.colaborador_id;
  new.entregue_em := old.entregue_em;
  new.entregue_por := old.entregue_por;
  new.entregue_por_nome := old.entregue_por_nome;
  new.foto_path := old.foto_path;
  new.token := old.token;
  new.created_at := old.created_at;

  -- Assinatura só é gravada pela rota do servidor; aqui ela não volta atrás.
  if old.assinado_em is not null then
    new.assinado_em := old.assinado_em;
    new.assinatura_ip := old.assinatura_ip;
    new.assinatura_agente := old.assinatura_agente;
  end if;

  if new.cancelada_em is not null and old.cancelada_em is null then
    new.cancelada_em := now();
    new.cancelada_por := coalesce(auth.uid(), new.cancelada_por);
    new.motivo_cancelamento := nullif(btrim(coalesce(new.motivo_cancelamento, '')), '');
  elsif old.cancelada_em is not null then
    new.cancelada_em := old.cancelada_em;
    new.cancelada_por := old.cancelada_por;
  end if;

  return new;
end;
$fn$;

drop trigger if exists epi_entregas_ajustes on public.epi_entregas;
create trigger epi_entregas_ajustes
  before insert or update on public.epi_entregas
  for each row execute function public.epi_entregas_ajustes();


-- ---------- 3. Regras de acesso (RLS) ----------------------------------
-- Mesma regra dos outros cadastros do módulo. Entrega não se apaga: o que
-- saiu errado é cancelado, e o cancelamento fica registrado.
alter table public.epi_entregas enable row level security;
alter table public.epi_entregas_itens enable row level security;

drop policy if exists epi_entregas_leitura on public.epi_entregas;
create policy epi_entregas_leitura
  on public.epi_entregas for select to authenticated
  using (public.pode_gerir_epis(empresa_id));

drop policy if exists epi_entregas_inclusao on public.epi_entregas;
create policy epi_entregas_inclusao
  on public.epi_entregas for insert to authenticated
  with check (public.pode_gerir_epis(empresa_id));

drop policy if exists epi_entregas_alteracao on public.epi_entregas;
create policy epi_entregas_alteracao
  on public.epi_entregas for update to authenticated
  using (public.pode_gerir_epis(empresa_id))
  with check (public.pode_gerir_epis(empresa_id));

drop policy if exists epi_entregas_itens_leitura on public.epi_entregas_itens;
create policy epi_entregas_itens_leitura
  on public.epi_entregas_itens for select to authenticated
  using (exists (select 1 from public.epi_entregas e
                  where e.id = entrega_id and public.pode_gerir_epis(e.empresa_id)));

drop policy if exists epi_entregas_itens_inclusao on public.epi_entregas_itens;
create policy epi_entregas_itens_inclusao
  on public.epi_entregas_itens for insert to authenticated
  with check (exists (select 1 from public.epi_entregas e
                       where e.id = entrega_id and public.pode_gerir_epis(e.empresa_id)));

grant select, insert, update on public.epi_entregas to authenticated;
grant select, insert on public.epi_entregas_itens to authenticated;
revoke delete, truncate on public.epi_entregas from anon, authenticated;
revoke delete, truncate on public.epi_entregas_itens from anon, authenticated;
revoke all on public.epi_entregas from anon;
revoke all on public.epi_entregas_itens from anon;


-- ---------- 4. Balde das fotos ----------------------------------------
-- Privado: a foto mostra o rosto de um trabalhador. Quem vê é quem pode
-- ver a entrega, e o portal serve a imagem por link assinado de curta
-- duração. 5 MB cobre foto de celular já comprimida pela tela.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('epi-fotos', 'epi-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O caminho começa com o id da empresa: epi-fotos/<empresa_id>/<arquivo>.
drop policy if exists epi_fotos_leitura on storage.objects;
create policy epi_fotos_leitura
  on storage.objects for select to authenticated
  using (
    bucket_id = 'epi-fotos'
    and public.pode_gerir_epis(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists epi_fotos_envio on storage.objects;
create policy epi_fotos_envio
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'epi-fotos'
    and public.pode_gerir_epis(nullif(split_part(name, '/', 1), '')::uuid)
  );


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.epi_entregas)                              as entregas,
       (select count(*) from public.epi_entregas
         where assinado_em is null and cancelada_em is null)                    as sem_assinatura,
       (select count(*) from public.epi_entregas_itens)                        as itens,
       (select count(*) from storage.buckets where id = 'epi-fotos')           as balde_fotos,
       (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('epi_entregas', 'epi_entregas_itens'))             as politicas;
