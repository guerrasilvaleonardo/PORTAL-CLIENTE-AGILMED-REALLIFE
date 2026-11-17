-- =====================================================================
-- Quem entrega o EPI.
--
-- ANTES:  a entrega gravava o nome de quem estava logado no portal. Só
--         que quem entrega EPI quase nunca é quem tem login: é o
--         almoxarife, o encarregado da obra, o líder da frente. O nome
--         que saía na ficha era o de quem digitou, não o de quem
--         entregou.
-- DEPOIS: colaboradores.entrega_epi marca quem pode aparecer como
--         responsável pela entrega, e epi_entregas.entregue_por_colaborador_id
--         guarda qual deles foi. Quem digitou continua em entregue_por.
-- MOTIVO: no OnSafety isso é o papel "Encarregado", separado de
--         "Trabalhador", e o painel tem um gráfico de entregas por
--         responsável. Sem separar os dois, não dá para cobrar de
--         ninguém nem saber quem entregou o quê.
--
-- entregue_por_nome continua sendo o nome congelado de quem entregou —
-- agora o do encarregado escolhido, e não mais o de quem estava logado.
-- Isso não reescreve o que já está gravado: entrega antiga continua com
-- o nome que tinha.
--
-- Depende de supabase/colaboradores.sql e supabase/epi-entregas.sql.
-- Não altera nem apaga nada do que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.colaboradores') is null then
    raise exception 'Rode antes supabase/colaboradores.sql (falta a tabela colaboradores).';
  end if;
  if to_regclass('public.epi_entregas') is null then
    raise exception 'Rode antes supabase/epi-entregas.sql (falta a tabela epi_entregas).';
  end if;
  if to_regclass('public.locais_trabalho') is null then
    raise exception 'Rode antes supabase/locais-trabalho.sql (falta a tabela locais_trabalho).';
  end if;
end
$$;


-- ---------- 1. Quem pode entregar --------------------------------------
-- É uma marca no cadastro, não uma tabela à parte: o encarregado é um
-- colaborador da empresa como qualquer outro, e também recebe EPI.
alter table public.colaboradores
  add column if not exists entrega_epi boolean not null default false;

create index if not exists colaboradores_entrega_epi
  on public.colaboradores (empresa_id) where entrega_epi;


-- ---------- 2. Quem entregou, na entrega --------------------------------
-- on delete set null: o encarregado pode sair da empresa, e a ficha
-- continua dizendo o nome dele, que está congelado em entregue_por_nome.
alter table public.epi_entregas
  add column if not exists entregue_por_colaborador_id uuid
    references public.colaboradores (id) on delete set null;

create index if not exists epi_entregas_entregue_por_colaborador
  on public.epi_entregas (entregue_por_colaborador_id);


-- ---------- 3. O gatilho congela também o responsável -------------------
-- Só acrescenta a linha nova ao gatilho que epi-devolucao.sql deixou:
-- quem entregou faz parte do ato e não muda depois.
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
    new.created_at := now();
    new.assinado_em := null;
    new.cancelada_em := null;
    return new;
  end if;

  -- O ato em si não muda.
  new.id := old.id;
  new.empresa_id := old.empresa_id;
  new.colaborador_id := old.colaborador_id;
  new.entregue_por := old.entregue_por;
  new.entregue_por_nome := old.entregue_por_nome;
  new.entregue_por_colaborador_id := old.entregue_por_colaborador_id;
  new.foto_path := old.foto_path;
  new.token := old.token;
  new.local_nome := old.local_nome;
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
select (select count(*) from public.colaboradores)                             as colaboradores,
       (select count(*) from public.colaboradores where entrega_epi)            as entregam_epi,
       (select count(*) from public.locais_trabalho)                            as locais,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'epi_entregas'
           and column_name in ('entregue_por_colaborador_id', 'local_nome'))    as campos_entrega,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'colaboradores'
           and column_name in ('entrega_epi', 'local_id'))                      as campos_colaborador;
