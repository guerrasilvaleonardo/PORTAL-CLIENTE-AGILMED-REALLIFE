-- =====================================================================
-- Chamados: só Leonardo altera a prioridade.
-- Rode no Supabase ("projeto ticket") -> SQL Editor -> Run.
--
-- ANTES:  qualquer gestor ou administrador ativo trocava a prioridade
--         (supabase/chamados-prioridade-so-gestor.sql). Como toda a
--         equipe está com perfil Administrador, na prática qualquer
--         atendente trocava.
-- DEPOIS: só quem tem "pode_alterar_prioridade" marcado no cadastro.
--         Fica marcado apenas Leonardo Guerra.
--         A marcação NÃO pode ser mudada pelo portal (nem por
--         administrador): só por SQL, aqui no Supabase.
--         A trava vale no banco (gatilho), não só na tela.
--         Não afetados: abertura do chamado (INSERT, com a regra do
--         cliente até Normal), rotinas do servidor e do pg_cron (sem
--         login) e ajustes feitos por outros gatilhos.
--         Perfis de acesso (atendimento/gestor/admin) não mudam.
-- MOTIVO: pedido do Leonardo em 26/11/2026, após troca de prioridade
--         por atendente no fechamento de chamado (#142). Trocar a
--         prioridade refaz o prazo de SLA e mexe nas estrelas.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- Ordem: rodar este SQL ANTES ou junto do merge do PR. Enquanto o SQL
-- não rodar, a tela continua com a regra antiga (gestor/admin).
-- =====================================================================

alter table public.profiles
  add column if not exists pode_alterar_prioridade boolean not null default false;

comment on column public.profiles.pode_alterar_prioridade is
  'Pode alterar a prioridade de chamados. Só muda por SQL (nunca pelo portal).';

-- Ninguém muda essa marcação pelo portal (só SQL / chave de serviço).
create or replace function public.profiles_proteger_prioridade()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is not null
     and new.pode_alterar_prioridade is distinct from old.pode_alterar_prioridade then
    new.pode_alterar_prioridade := old.pode_alterar_prioridade;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_proteger_prioridade on public.profiles;
create trigger profiles_proteger_prioridade
  before update on public.profiles
  for each row execute function public.profiles_proteger_prioridade();

-- Marca somente o Leonardo (conta da equipe interna).
update public.profiles p
   set pode_alterar_prioridade = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'leonardo@reallifessma.com.br'
   and p.perfil in ('atendimento', 'gestor', 'admin')
   and p.pode_alterar_prioridade is distinct from true;

-- Trava no chamado: troca de prioridade só por quem está autorizado.
-- Mesmo gatilho de antes (a_chamado_prioridade_guarda); só muda a regra.
create or replace function public.chamado_prioridade_guarda()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.prioridade is distinct from old.prioridade
     and auth.uid() is not null
     and pg_trigger_depth() <= 1
     and not exists (
       select 1
         from public.profiles p
        where p.id = auth.uid()
          and p.pode_alterar_prioridade = true
          and coalesce(p.ativo, true)
     ) then
    raise exception 'Somente o Leonardo (autorizado) pode alterar a prioridade do chamado.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists a_chamado_prioridade_guarda on public.chamados;
create trigger a_chamado_prioridade_guarda
  before update of prioridade on public.chamados
  for each row execute function public.chamado_prioridade_guarda();


-- ---------- Conferência -------------------------------------------------
-- Deve listar só o Leonardo.
select p.nome, u.email, p.perfil
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.pode_alterar_prioridade
 order by p.nome;
