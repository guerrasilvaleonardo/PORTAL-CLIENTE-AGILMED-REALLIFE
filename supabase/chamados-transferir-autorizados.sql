-- =====================================================================
-- Chamados: só pessoas autorizadas alteram o responsável / transferem.
--
-- ANTES:  qualquer pessoa da equipe (atendimento, gestor, admin) podia
--         trocar o responsável do chamado ("Transferir chamado").
-- DEPOIS: só quem tem "pode_transferir_chamado" marcado no cadastro.
--         Já ficam marcados: Leonardo Guerra e Priscila Vanzini.
--         A trava vale no banco (gatilho), não só na tela.
--         Não afetados: rotinas do servidor e do pg_cron (sem login),
--         alterações feitas por outros gatilhos e a abertura do chamado
--         (INSERT).
-- MOTIVO: controle da distribuição dos chamados pela gestão (pedido do
--         Leonardo em 28/10/2026).
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.profiles
  add column if not exists pode_transferir_chamado boolean not null default false;

-- Só administrador muda essa marcação (o próprio usuário não se marca).
create or replace function public.profiles_proteger_transferir()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is not null
     and new.pode_transferir_chamado is distinct from old.pode_transferir_chamado
     and not exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.perfil = 'admin' and coalesce(p.ativo, true)) then
    new.pode_transferir_chamado := old.pode_transferir_chamado;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_proteger_transferir on public.profiles;
create trigger profiles_proteger_transferir
  before update on public.profiles
  for each row execute function public.profiles_proteger_transferir();

-- Marca Leonardo e Priscila (contas da equipe interna).
update public.profiles p
   set pode_transferir_chamado = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) in ('leonardo@reallifessma.com.br', 'priscila@reallifessma.com.br')
   and p.perfil in ('atendimento', 'gestor', 'admin')
   and p.pode_transferir_chamado is distinct from true;

-- Trava no chamado: troca de responsável só por quem está autorizado.
create or replace function public.chamado_responsavel_guarda()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.responsavel_id is distinct from old.responsavel_id
     and auth.uid() is not null
     and pg_trigger_depth() <= 1
     and not exists (
       select 1
         from public.profiles p
        where p.id = auth.uid()
          and p.pode_transferir_chamado = true
          and coalesce(p.ativo, true)
     ) then
    raise exception 'Somente Leonardo ou Priscila (autorizados) podem alterar o responsável do chamado.';
  end if;

  return new;
end;
$fn$;

-- "a_" para rodar antes dos demais gatilhos BEFORE UPDATE do chamado.
drop trigger if exists a_chamado_responsavel_guarda on public.chamados;
create trigger a_chamado_responsavel_guarda
  before update of responsavel_id on public.chamados
  for each row execute function public.chamado_responsavel_guarda();


-- ---------- Conferência -------------------------------------------------
-- Deve listar Leonardo e Priscila.
select u.email, p.nome, p.perfil
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.pode_transferir_chamado = true
 order by u.email;
