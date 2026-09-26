-- =====================================================================
-- Certificados: progresso via plataforma (EAD) ou manual (presencial)
-- Rode no Supabase -> SQL Editor ANTES de publicar o código novo.
-- Pode rodar mais de uma vez. Nada aqui apaga ou renomeia colunas.
-- =====================================================================


-- ---------- 1. Colunas novas -----------------------------------------
-- progresso_origem:
--   'ead'    = progresso lido do Maestrus (treinamentos_progresso)
--   'manual' = presencial; a equipe informa etapa e percentual
alter table public.certificados
  add column if not exists progresso_origem text not null default 'ead';

alter table public.certificados
  add column if not exists progresso_etapa text;

alter table public.certificados
  add column if not exists progresso_manual smallint;

alter table public.certificados
  add column if not exists progresso_manual_em timestamptz;

alter table public.certificados
  add column if not exists progresso_manual_por uuid
    references public.profiles (id) on delete set null;

-- Mês de cadastro (usado no painel quando não há data de emissão).
-- Se a coluna já existir, nada muda. Se for criada agora, os
-- certificados antigos ficam sem data (não recebem a data de hoje).
alter table public.certificados
  add column if not exists created_at timestamptz;

alter table public.certificados
  alter column created_at set default now();


-- ---------- 2. Regras de consistência --------------------------------
alter table public.certificados
  drop constraint if exists certificados_progresso_origem_chk;
alter table public.certificados
  add constraint certificados_progresso_origem_chk
  check (progresso_origem in ('ead', 'manual'));

alter table public.certificados
  drop constraint if exists certificados_progresso_etapa_chk;
alter table public.certificados
  add constraint certificados_progresso_etapa_chk
  check (progresso_etapa is null
         or progresso_etapa in ('agendado', 'em_andamento', 'concluido'));

alter table public.certificados
  drop constraint if exists certificados_progresso_manual_chk;
alter table public.certificados
  add constraint certificados_progresso_manual_chk
  check (progresso_manual is null or progresso_manual between 0 and 100);


-- ---------- 3. Histórico do lançamento manual -------------------------
-- Rastreabilidade de treinamento presencial: quem mudou, para quê e
-- quando. A aplicação só lê; não há política de update ou delete.
do $$
declare
  tipo_id text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_id
  from pg_attribute a
  where a.attrelid = 'public.certificados'::regclass
    and a.attname = 'id';

  execute format($f$
    create table if not exists public.certificados_progresso_log (
      id              bigint generated always as identity primary key,
      certificado_id  %s not null
                        references public.certificados (id) on delete cascade,
      origem          text not null,
      etapa           text,
      percentual      smallint,
      alterado_por    uuid references public.profiles (id) on delete set null,
      alterado_em     timestamptz not null default now()
    )$f$, tipo_id);
end
$$;

create index if not exists certificados_progresso_log_cert
  on public.certificados_progresso_log (certificado_id, alterado_em desc);

alter table public.certificados_progresso_log enable row level security;

drop policy if exists certificados_progresso_log_leitura
  on public.certificados_progresso_log;

create policy certificados_progresso_log_leitura
  on public.certificados_progresso_log
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.ativo = true
        and p.perfil in ('atendimento', 'gestor', 'admin')
    )
  );


-- ---------- 4. Carimbo automático + gravação no histórico -------------
create or replace function public.certificados_progresso_manual_stamp()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.progresso_origem = 'manual' then
    if new.progresso_etapa is null then
      new.progresso_etapa := 'agendado';
    end if;

    if new.progresso_etapa = 'concluido' then
      new.progresso_manual := 100;
    end if;

    if tg_op = 'INSERT'
       or new.progresso_origem is distinct from old.progresso_origem
       or new.progresso_etapa  is distinct from old.progresso_etapa
       or new.progresso_manual is distinct from old.progresso_manual then
      new.progresso_manual_por := auth.uid();
      new.progresso_manual_em  := now();
    end if;
  else
    new.progresso_etapa := null;
    new.progresso_manual := null;
  end if;

  return new;
end;
$fn$;

-- O histórico é gravado depois que a linha existe (evita erro de FK).
create or replace function public.certificados_progresso_manual_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' and new.progresso_origem = 'ead' then
    return null;
  end if;

  if tg_op = 'INSERT'
     or new.progresso_origem is distinct from old.progresso_origem
     or new.progresso_etapa  is distinct from old.progresso_etapa
     or new.progresso_manual is distinct from old.progresso_manual then
    insert into public.certificados_progresso_log
      (certificado_id, origem, etapa, percentual, alterado_por)
    values
      (new.id, new.progresso_origem, new.progresso_etapa,
       new.progresso_manual, auth.uid());
  end if;

  return null;
end;
$fn$;

revoke all on function public.certificados_progresso_manual_log() from public;

drop trigger if exists certificados_progresso_manual_stamp on public.certificados;
create trigger certificados_progresso_manual_stamp
  before insert or update on public.certificados
  for each row execute function public.certificados_progresso_manual_stamp();

drop trigger if exists certificados_progresso_manual_log on public.certificados;
create trigger certificados_progresso_manual_log
  after insert or update on public.certificados
  for each row execute function public.certificados_progresso_manual_log();
