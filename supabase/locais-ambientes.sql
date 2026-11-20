-- =====================================================================
-- Ambientes dentro do estabelecimento.
--
-- ANTES:  os locais de trabalho eram uma lista plana. "Obra do Jirau" e
--         "Almoxarifado da obra do Jirau" ficavam lado a lado, sem nada
--         dizendo que um está dentro do outro.
-- DEPOIS: um local pode estar dentro de outro, e ganha um código curto.
--         O estabelecimento é o lugar; os ambientes são as partes dele.
-- MOTIVO: é a tela "Ambiente de Trabalho" do OnSafety, onde cada
--         projeto/estabelecimento tem seus ambientes e setores, com
--         nome, código e descrição.
--
-- UM NÍVEL SÓ, DE PROPÓSITO. No OnSafety é estabelecimento e seus
-- ambientes — dois níveis. Árvore sem limite vira "setor dentro de setor
-- dentro de setor" e ninguém mais acha nada. O gatilho recusa o terceiro
-- nível em vez de deixar acontecer e doer depois.
--
-- O QUE NÃO VEM JUNTO. No OnSafety o ambiente também carrega
-- procedimento SST e serve de base para o GHE e o PGR. Isso é outro
-- módulo, que o portal não tem; aqui fica só o cadastro do lugar, que é
-- o que a ficha de EPI e o cadastro de pessoas usam.
--
-- Depende de supabase/locais-trabalho.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.locais_trabalho') is null then
    raise exception 'Rode antes supabase/locais-trabalho.sql.';
  end if;
end
$$;


-- ---------- 1. Campos novos -------------------------------------------
alter table public.locais_trabalho add column if not exists codigo text;

-- on delete set null, e não cascade: apagar o estabelecimento não pode
-- levar junto o histórico de quem trabalhou nos ambientes dele.
alter table public.locais_trabalho
  add column if not exists local_pai_id uuid references public.locais_trabalho (id) on delete set null;

create index if not exists locais_trabalho_pai on public.locais_trabalho (local_pai_id);

-- O código é atalho de digitação: tem de ser único dentro da empresa
-- para servir de atalho.
create unique index if not exists locais_trabalho_codigo
  on public.locais_trabalho (empresa_id, upper(codigo))
  where codigo is not null;


-- ---------- 2. Ajustes e limites --------------------------------------
-- Recriado inteiro, por convenção deste projeto: esta é a versão de
-- supabase/locais-trabalho.sql mais o código e o pai.
create or replace function public.locais_trabalho_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_empresa_pai uuid;
  v_avo uuid;
begin
  new.nome := btrim(coalesce(new.nome, ''));
  if new.nome = '' then
    raise exception 'Informe o nome do local.';
  end if;

  new.endereco    := nullif(btrim(coalesce(new.endereco, '')), '');
  new.cidade_uf   := nullif(btrim(coalesce(new.cidade_uf, '')), '');
  new.cno         := nullif(regexp_replace(coalesce(new.cno, ''), '\D', '', 'g'), '');
  new.responsavel := nullif(btrim(coalesce(new.responsavel, '')), '');
  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');
  new.codigo      := nullif(upper(btrim(coalesce(new.codigo, ''))), '');

  if new.local_pai_id is not null then
    if new.local_pai_id = new.id then
      raise exception 'Um local não pode estar dentro de si mesmo.';
    end if;

    select empresa_id, local_pai_id into v_empresa_pai, v_avo
      from public.locais_trabalho where id = new.local_pai_id;

    if v_empresa_pai is null then
      raise exception 'O local onde este fica não existe.';
    end if;
    if v_empresa_pai <> new.empresa_id then
      raise exception 'O local onde este fica é de outra empresa.';
    end if;
    if v_avo is not null then
      -- Quem já está dentro de alguém é o local ESCOLHIDO, não o que
      -- está sendo salvo. A frase anterior dizia "este local" e deixava
      -- quem lia procurando o erro no lugar errado.
      raise exception 'Só um nível: o local que você escolheu já está dentro de outro.';
    end if;

    -- Quem tem filho não pode virar filho: seria o terceiro nível pelo
    -- outro lado.
    if tg_op = 'UPDATE' and exists (
      select 1 from public.locais_trabalho f where f.local_pai_id = new.id
    ) then
      raise exception 'Este local tem ambientes dentro dele, então não pode ficar dentro de outro.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.created_at := now();
  else
    new.empresa_id := old.empresa_id;
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists locais_trabalho_ajustes on public.locais_trabalho;
create trigger locais_trabalho_ajustes
  before insert or update on public.locais_trabalho
  for each row execute function public.locais_trabalho_ajustes();


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.locais_trabalho)                            as locais,
       (select count(*) from public.locais_trabalho where local_pai_id is not null)
                                                                                as ambientes,
       (select count(*) from public.locais_trabalho where codigo is not null)   as com_codigo,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'locais_trabalho'
           and column_name in ('codigo', 'local_pai_id'))                       as campos_novos;
