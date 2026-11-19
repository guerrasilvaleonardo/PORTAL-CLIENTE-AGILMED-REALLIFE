-- =====================================================================
-- EPI por função.
--
-- ANTES:  quem ia entregar escolhia os equipamentos na mão, um por um,
--         lembrando de cabeça o que o pedreiro usa e o que o eletricista
--         usa. Em dia de contratação, com cinco pessoas na fila, é onde
--         se esquece o protetor auricular.
-- DEPOIS: a empresa define uma vez o que cada função recebe. Na entrega,
--         ao escolher a pessoa, o portal já marca os equipamentos da
--         função dela — e quem entrega desmarca o que não for o caso.
-- MOTIVO: é a tela "Entrega de EPI por Ocupação/Função" do OnSafety, e
--         é o que faz a entrega parar de depender da memória de quem
--         está no almoxarifado.
--
-- A FUNÇÃO PASSA A FICAR GRAVADA NA ENTREGA. Hoje a ficha imprime a
-- função que está no cadastro do trabalhador agora. Se ele muda de
-- pedreiro para encarregado, a ficha do ano passado passa a dizer
-- "encarregado" — reescreve o passado num documento que a fiscalização
-- lê. O OnSafety guarda a função do dia da entrega, e a ficha mostra a
-- antiga nas entregas antigas e a nova nas novas. Passamos a fazer
-- igual: epi_entregas.funcao é congelado na hora, como já é o nome e o
-- CA do equipamento.
--
-- AS ENTREGAS QUE JÁ EXISTEM recebem a função que o trabalhador tem
-- hoje. É o melhor palpite disponível: a função daquele dia não foi
-- guardada em lugar nenhum, e não vou inventar outra.
--
-- POR QUE "CHAVE" DA FUNÇÃO. O cadastro é texto livre: "Pedreiro",
-- "PEDREIRO " e "pedreiro" são a mesma função para quem trabalha e três
-- para o banco. A chave normaliza maiúsculas, espaços e acentos para
-- casar o trabalhador com a lista certa, sem mexer no que foi digitado.
--
-- Depende de supabase/epis.sql e supabase/epi-entregas.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.epis') is null then
    raise exception 'Rode antes supabase/epis.sql.';
  end if;
  if to_regclass('public.epi_entregas') is null then
    raise exception 'Rode antes supabase/epi-entregas.sql.';
  end if;
  if to_regprocedure('public.pode_gerir_epis(uuid)') is null then
    raise exception 'Falta a função pode_gerir_epis — rode supabase/epis.sql.';
  end if;
end
$$;


-- ---------- 1. A chave da função --------------------------------------
-- Sem extensão: translate dá conta dos acentos que aparecem em nome de
-- função no Brasil, e é imutável, o que permite usá-la em índice.
create or replace function public.epi_funcao_chave(p_texto text)
returns text
language sql
immutable
as $fn$
  select nullif(
    upper(
      regexp_replace(
        translate(
          btrim(coalesce(p_texto, '')),
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
        ),
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$fn$;

revoke all on function public.epi_funcao_chave(text) from public, anon;
grant execute on function public.epi_funcao_chave(text) to authenticated;


-- ---------- 2. A lista de cada função ----------------------------------
create table if not exists public.epi_funcoes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  -- Como foi digitado, para aparecer na tela do jeito que a empresa escreve.
  funcao       text not null,
  -- Normalizado, para casar com o cadastro do trabalhador.
  funcao_chave text not null,
  epi_id       uuid not null references public.epis (id) on delete cascade,
  quantidade   integer not null default 1,
  criado_por   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- O mesmo equipamento não entra duas vezes na mesma função.
create unique index if not exists epi_funcoes_item
  on public.epi_funcoes (empresa_id, funcao_chave, epi_id);
create index if not exists epi_funcoes_empresa
  on public.epi_funcoes (empresa_id, funcao_chave);

alter table public.epi_funcoes drop constraint if exists epi_funcoes_quantidade;
alter table public.epi_funcoes
  add constraint epi_funcoes_quantidade check (quantidade between 1 and 999);

create or replace function public.epi_funcoes_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.funcao := btrim(coalesce(new.funcao, ''));
  if new.funcao = '' then
    raise exception 'Informe a função.';
  end if;
  new.funcao_chave := public.epi_funcao_chave(new.funcao);

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.created_at := now();
  else
    new.empresa_id := old.empresa_id;
    new.epi_id     := old.epi_id;
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$fn$;

drop trigger if exists epi_funcoes_ajustes on public.epi_funcoes;
create trigger epi_funcoes_ajustes
  before insert or update on public.epi_funcoes
  for each row execute function public.epi_funcoes_ajustes();

alter table public.epi_funcoes enable row level security;

drop policy if exists epi_funcoes_leitura on public.epi_funcoes;
create policy epi_funcoes_leitura
  on public.epi_funcoes for select to authenticated
  using (public.pode_gerir_epis(empresa_id));

drop policy if exists epi_funcoes_inclusao on public.epi_funcoes;
create policy epi_funcoes_inclusao
  on public.epi_funcoes for insert to authenticated
  with check (public.pode_gerir_epis(empresa_id));

drop policy if exists epi_funcoes_alteracao on public.epi_funcoes;
create policy epi_funcoes_alteracao
  on public.epi_funcoes for update to authenticated
  using (public.pode_gerir_epis(empresa_id))
  with check (public.pode_gerir_epis(empresa_id));

-- Aqui o DELETE é permitido, ao contrário do cadastro de equipamentos:
-- tirar um item da lista de uma função não apaga história nenhuma, é só
-- dizer que aquele cargo não usa mais aquilo.
drop policy if exists epi_funcoes_exclusao on public.epi_funcoes;
create policy epi_funcoes_exclusao
  on public.epi_funcoes for delete to authenticated
  using (public.pode_gerir_epis(empresa_id));

grant select, insert, update, delete on public.epi_funcoes to authenticated;
revoke all on public.epi_funcoes from anon;


-- ---------- 3. A função congelada na entrega ---------------------------
alter table public.epi_entregas add column if not exists funcao text;

-- As entregas que já existem ficam com a função atual do trabalhador.
-- Ver o cabeçalho: é o melhor palpite, não a verdade daquele dia.
update public.epi_entregas e
   set funcao = c.funcao
  from public.colaboradores c
 where c.id = e.colaborador_id
   and e.funcao is null
   and nullif(btrim(coalesce(c.funcao, '')), '') is not null;

-- O gatilho das entregas é recriado inteiro a cada mudança, por
-- convenção deste projeto. Esta versão é a de
-- supabase/epi-assinatura-manuscrita.sql mais a função.
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
    new.local_nome := nullif(btrim(coalesce(new.local_nome, '')), '');

    -- A função do dia da entrega. Quem grava não precisa mandar: sai do
    -- cadastro do trabalhador no momento em que a entrega acontece.
    new.funcao := nullif(
      btrim(
        coalesce(
          new.funcao,
          (select c.funcao from public.colaboradores c where c.id = new.colaborador_id),
          ''
        )
      ),
      ''
    );

    new.created_at := now();
    new.assinado_em := null;
    new.cancelada_em := null;
    new.assinatura_imagem := null;
    new.assinatura_hash := null;
    return new;
  end if;

  new.id := old.id;
  new.empresa_id := old.empresa_id;
  new.colaborador_id := old.colaborador_id;
  new.entregue_por := old.entregue_por;
  new.entregue_por_nome := old.entregue_por_nome;
  new.entregue_por_colaborador_id := old.entregue_por_colaborador_id;
  new.foto_path := old.foto_path;
  new.token := old.token;
  new.local_nome := old.local_nome;
  -- Congelada igual ao resto: a ficha de ontem não muda porque o
  -- trabalhador foi promovido hoje.
  new.funcao := old.funcao;
  new.created_at := old.created_at;

  if old.assinado_em is not null then
    new.assinado_em := old.assinado_em;
    new.assinatura_ip := old.assinatura_ip;
    new.assinatura_agente := old.assinatura_agente;
    new.assinatura_imagem := old.assinatura_imagem;
    new.assinatura_hash := old.assinatura_hash;
  end if;

  if new.cancelada_em is not null and old.cancelada_em is null then
    new.cancelada_em := now();
    new.cancelada_por := coalesce(auth.uid(), new.cancelada_por);
    new.motivo_cancelamento := nullif(btrim(coalesce(new.motivo_cancelamento, '')), '');
  elsif old.cancelada_em is not null then
    new.cancelada_em := old.cancelada_em;
    new.cancelada_por := old.cancelada_por;
  end if;

  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

  if new.entregue_em > now() + interval '1 day' then
    raise exception 'A data da entrega não pode ser no futuro.';
  end if;

  perform public.epi_registrar_alteracao(old.id, null, 'entregue_em',
    to_char(old.entregue_em, 'DD/MM/YYYY HH24:MI'), to_char(new.entregue_em, 'DD/MM/YYYY HH24:MI'));
  perform public.epi_registrar_alteracao(old.id, null, 'observacoes',
    old.observacoes, new.observacoes);

  return new;
end;
$fn$;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.epi_funcoes)                                as linhas_por_funcao,
       (select count(distinct funcao_chave) from public.epi_funcoes)            as funcoes_configuradas,
       (select count(*) from public.epi_entregas where funcao is not null)      as entregas_com_funcao,
       (select count(*) from public.epi_entregas where funcao is null)          as entregas_sem_funcao,
       (select count(distinct public.epi_funcao_chave(funcao))
          from public.colaboradores
         where nullif(btrim(coalesce(funcao, '')), '') is not null)             as funcoes_no_cadastro,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'epi_funcoes')             as politicas;
