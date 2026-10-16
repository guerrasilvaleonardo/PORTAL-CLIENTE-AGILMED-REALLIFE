-- =====================================================================
-- Agenda dos atendentes: compromissos com dia e horário.
-- Rode no Supabase ("projeto ticket") -> SQL Editor -> Run.
-- Pode rodar de novo sem problema. Não altera dados existentes:
-- só cria 1 tabela nova e as regras de acesso dela.
--
-- A tela /atendimento/agenda junta, por atendente e por semana:
--   * compromissos desta tabela (visita, reunião, atividade);
--   * prazos (SLA) dos chamados sob responsabilidade dele;
--   * etapas pendentes desses chamados;
--   * feriados do calendário do SLA.
--
-- Quem pode o quê:
--   * equipe interna (atendimento, gestor, admin) vê a agenda de todos;
--   * gestor/admin criam, alteram e removem compromissos de qualquer um;
--   * atendente cria, altera e remove só os próprios;
--   * cliente não vê nada desta tabela.
-- =====================================================================

create table if not exists public.agenda_compromissos (
  id              bigint generated always as identity primary key,
  responsavel_id  uuid not null references public.profiles (id) on delete cascade,
  titulo          text not null check (length(btrim(titulo)) between 2 and 160),
  inicio          timestamptz not null,
  fim             timestamptz not null,
  local           text check (local is null or length(local) <= 160),
  observacao      text check (observacao is null or length(observacao) <= 1000),
  chamado_numero  integer,
  criado_por      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (fim > inicio),
  check (fim - inicio <= interval '24 hours')
);

create index if not exists agenda_compromissos_resp_inicio
  on public.agenda_compromissos (responsavel_id, inicio);

alter table public.agenda_compromissos enable row level security;
grant select, insert, update, delete on public.agenda_compromissos to authenticated;

create or replace function public.agenda_perfil()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select p.perfil from public.profiles p
   where p.id = auth.uid() and coalesce(p.ativo, true);
$fn$;

drop policy if exists agenda_equipe_le on public.agenda_compromissos;
create policy agenda_equipe_le
  on public.agenda_compromissos for select to authenticated
  using (public.agenda_perfil() in ('atendimento', 'gestor', 'admin'));

drop policy if exists agenda_cria on public.agenda_compromissos;
create policy agenda_cria
  on public.agenda_compromissos for insert to authenticated
  with check (
    public.agenda_perfil() in ('gestor', 'admin')
    or (public.agenda_perfil() = 'atendimento' and responsavel_id = auth.uid())
  );

drop policy if exists agenda_altera on public.agenda_compromissos;
create policy agenda_altera
  on public.agenda_compromissos for update to authenticated
  using (
    public.agenda_perfil() in ('gestor', 'admin')
    or (public.agenda_perfil() = 'atendimento' and responsavel_id = auth.uid())
  )
  with check (
    public.agenda_perfil() in ('gestor', 'admin')
    or (public.agenda_perfil() = 'atendimento' and responsavel_id = auth.uid())
  );

drop policy if exists agenda_remove on public.agenda_compromissos;
create policy agenda_remove
  on public.agenda_compromissos for delete to authenticated
  using (
    public.agenda_perfil() in ('gestor', 'admin')
    or (public.agenda_perfil() = 'atendimento' and responsavel_id = auth.uid())
  );

create or replace function public.agenda_atualizado_em()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists agenda_atualizado_em on public.agenda_compromissos;
create trigger agenda_atualizado_em
  before update on public.agenda_compromissos
  for each row execute function public.agenda_atualizado_em();

-- Conferência:
-- select count(*) from public.agenda_compromissos;
