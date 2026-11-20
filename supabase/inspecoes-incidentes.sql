-- =====================================================================
-- Incidente entra na não conformidade.
--
-- ANTES:  nao_conformidades só nascia de item reprovado em inspeção.
-- DEPOIS: a mesma linha também registra incidente — acidente com e sem
--         afastamento, quase-acidente, doença ocupacional e
--         atendimento de primeiros socorros — com o mesmo ciclo de
--         causa, ação corretiva e verificação da eficácia.
-- MOTIVO: o item 10.2 da ABNT NBR ISO 45001:2024 não se chama "não
--         conformidade e ação corretiva": chama-se "INCIDENTE, não
--         conformidade e ação corretiva". Incidente está no mesmo item
--         e exige o mesmo tratamento. Sem isto o módulo não dá conta do
--         que mais pesa numa auditoria de SSO.
--
-- POR QUE NA MESMA TABELA, E NÃO NUMA NOVA. O que se faz depois é
-- idêntico: achar a causa, agir sobre ela, verificar se funcionou. Duas
-- tabelas seriam duas telas, dois relatórios e duas chances de tratar
-- um pior que o outro. O que muda é só a origem e o que descreve o
-- evento.
--
-- A ISO 9001:2026 não fala de incidente — o 10.2 dela é só não
-- conformidade. Por isso nada aqui é obrigatório: a empresa que só
-- tem 9001 continua usando o módulo como estava.
--
-- Depende de supabase/inspecoes.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito ------------------------------------------
do $$
begin
  if to_regclass('public.nao_conformidades') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;
end
$$;


-- ---------- 1. Campos novos -------------------------------------------
alter table public.nao_conformidades
  add column if not exists origem         text not null default 'inspecao',
  add column if not exists ocorrido_em    timestamptz,
  add column if not exists tipo_incidente text,
  -- Quem se envolveu. O vínculo é opcional: às vezes é terceiro ou
  -- visitante, que não está no cadastro de colaboradores.
  add column if not exists envolvido_id   uuid references public.colaboradores (id) on delete set null,
  add column if not exists envolvido_nome text,
  add column if not exists afastamento_dias integer,
  add column if not exists local_do_evento  text,
  add column if not exists testemunhas      text;

alter table public.nao_conformidades drop constraint if exists nao_conformidades_origem;
alter table public.nao_conformidades
  add constraint nao_conformidades_origem
  check (origem in ('inspecao', 'incidente', 'avulsa'));

alter table public.nao_conformidades drop constraint if exists nao_conformidades_tipo_incidente;
alter table public.nao_conformidades
  add constraint nao_conformidades_tipo_incidente
  check (tipo_incidente is null or tipo_incidente in (
    'acidente_com_afastamento',
    'acidente_sem_afastamento',
    'quase_acidente',
    'doenca_ocupacional',
    'primeiros_socorros'
  ));

alter table public.nao_conformidades drop constraint if exists nao_conformidades_afastamento;
alter table public.nao_conformidades
  add constraint nao_conformidades_afastamento
  check (afastamento_dias is null or afastamento_dias between 0 and 3650);

create index if not exists nao_conformidades_origem_idx
  on public.nao_conformidades (empresa_id, origem, ocorrido_em desc);

-- O que já existe segue a regra: veio de inspeção ou foi anotado solto.
update public.nao_conformidades
   set origem = case when inspecao_id is not null then 'inspecao' else 'avulsa' end
 where origem is null or origem not in ('inspecao', 'incidente', 'avulsa');


-- ---------- 2. Ajustes na gravação -------------------------------------
-- Recriada inteira, por convenção deste projeto: é a versão de
-- supabase/inspecoes.sql mais as regras do incidente.
create or replace function public.nao_conformidades_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.descricao := btrim(coalesce(new.descricao, ''));
  if new.descricao = '' then
    raise exception 'Informe o que foi encontrado.';
  end if;

  new.acao_imediata   := nullif(btrim(coalesce(new.acao_imediata, '')), '');
  new.causa           := nullif(btrim(coalesce(new.causa, '')), '');
  new.acao_corretiva  := nullif(btrim(coalesce(new.acao_corretiva, '')), '');
  new.verificacao_obs := nullif(btrim(coalesce(new.verificacao_obs, '')), '');
  new.envolvido_nome  := nullif(btrim(coalesce(new.envolvido_nome, '')), '');
  new.local_do_evento := nullif(btrim(coalesce(new.local_do_evento, '')), '');
  new.testemunhas     := nullif(btrim(coalesce(new.testemunhas, '')), '');

  if tg_op = 'INSERT' then
    -- Quem nasce de inspeção é de inspeção; o resto, quem grava diz.
    if new.inspecao_id is not null then
      new.origem := 'inspecao';
    end if;
    new.aberta_por := coalesce(new.aberta_por, auth.uid());
    new.created_at := now();
  else
    new.empresa_id  := old.empresa_id;
    new.inspecao_id := old.inspecao_id;
    new.resposta_id := old.resposta_id;
    new.aberta_por  := old.aberta_por;
    new.created_at  := old.created_at;
    -- A origem não muda depois: incidente não vira achado de inspeção.
    new.origem      := old.origem;
  end if;

  if new.origem = 'incidente' then
    if new.ocorrido_em is null then
      raise exception 'Informe quando o incidente aconteceu.';
    end if;
    if new.ocorrido_em > now() + interval '1 hour' then
      raise exception 'A data do incidente está no futuro.';
    end if;
    if new.tipo_incidente is null then
      raise exception 'Informe o tipo do incidente.';
    end if;
  else
    -- Campos de evento só fazem sentido no incidente.
    new.ocorrido_em      := null;
    new.tipo_incidente   := null;
    new.afastamento_dias := null;
  end if;

  -- Afastamento é o que distingue os dois tipos de acidente: deixar em
  -- branco no "com afastamento" é perder justamente o número que a
  -- fiscalização e a taxa de gravidade usam.
  if new.tipo_incidente = 'acidente_com_afastamento'
     and coalesce(new.afastamento_dias, 0) < 1 then
    raise exception 'Acidente com afastamento precisa dos dias de afastamento.';
  end if;

  if new.tipo_incidente = 'acidente_sem_afastamento' then
    new.afastamento_dias := 0;
  end if;

  -- Encerrar sem dizer a causa e a ação é fechar o papel sem tratar o
  -- problema — é exatamente o que o 10.2 das duas normas não aceita.
  if new.situacao = 'encerrada' and coalesce(old.situacao, '') <> 'encerrada' then
    if new.causa is null or new.acao_corretiva is null then
      raise exception 'Para encerrar, informe a causa e a ação corretiva.';
    end if;
    if new.verificada_em is null then
      new.verificada_em  := now();
      new.verificada_por := coalesce(new.verificada_por, auth.uid());
    end if;
    new.encerrada_em := coalesce(new.encerrada_em, now());
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists nao_conformidades_ajustes on public.nao_conformidades;
create trigger nao_conformidades_ajustes
  before insert or update on public.nao_conformidades
  for each row execute function public.nao_conformidades_ajustes();


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.nao_conformidades)                          as total,
       (select count(*) from public.nao_conformidades where origem = 'incidente') as incidentes,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'nao_conformidades'
           and column_name in ('origem', 'ocorrido_em', 'tipo_incidente',
                               'envolvido_id', 'afastamento_dias'))             as campos_novos;
