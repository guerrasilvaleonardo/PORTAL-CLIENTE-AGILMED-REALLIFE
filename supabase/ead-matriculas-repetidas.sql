-- ============================================================
-- EAD: matriculas repetidas do mesmo curso
-- ============================================================
-- Problema: treinamentos_progresso aceitava uma unica linha por
-- e-mail + curso. Quando o colaborador recebe o mesmo curso de novo
-- (ex.: NR 33 em 2025 com 95% e nova liberacao em 01/10/2026 com 0%),
-- as duas matriculas viravam uma so.
--
-- O que este script faz:
--   1. Garante a coluna "inicio" (data de inicio da matricula).
--   2. Remove a regra UNICA antiga (email, curso).
--   3. Cria a regra UNICA nova (email, curso, inicio).
--
-- NAO apaga nenhuma linha. Pode rodar mais de uma vez.
-- Depois de rodar: Certificados > "Atualizar agora".
-- ============================================================

alter table public.treinamentos_progresso
  add column if not exists inicio date;

do $$
declare
  r record;
begin
  -- Constraints UNIQUE / PK exatamente em (email, curso)
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.treinamentos_progresso'::regclass
      and c.contype in ('u')
      and (
        select array_agg(a.attname::text order by a.attname)
        from unnest(c.conkey) k
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = k
      ) = array['curso', 'email']
  loop
    execute format(
      'alter table public.treinamentos_progresso drop constraint %I',
      r.conname
    );
  end loop;

  -- Indices UNIQUE soltos exatamente em (email, curso)
  for r in
    select i.indexrelid::regclass::text as nome
    from pg_index i
    where i.indrelid = 'public.treinamentos_progresso'::regclass
      and i.indisunique
      and not i.indisprimary
      and (
        select array_agg(a.attname::text order by a.attname)
        from unnest(i.indkey) k
        join pg_attribute a
          on a.attrelid = i.indrelid and a.attnum = k
      ) = array['curso', 'email']
  loop
    execute format('drop index if exists %s', r.nome);
  end loop;

  -- Regra nova: uma linha por matricula
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.treinamentos_progresso'::regclass
      and conname = 'treinamentos_progresso_matricula_key'
  ) then
    alter table public.treinamentos_progresso
      add constraint treinamentos_progresso_matricula_key
      unique nulls not distinct (email, curso, inicio);
  end if;
end $$;

-- Conferencia: deve listar treinamentos_progresso_matricula_key
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.treinamentos_progresso'::regclass
  and contype in ('u', 'p');
