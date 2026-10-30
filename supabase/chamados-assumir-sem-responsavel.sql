-- =====================================================================
-- Chamados: atendente pode ASSUMIR chamado sem responsável.
--
-- ANTES:  desde 28/10/2026 (supabase/chamados-transferir-autorizados.sql)
--         só Leonardo e Priscila (pode_transferir_chamado) alteravam o
--         responsável. Como "assumir" também é alterar o responsável, os
--         atendentes não conseguiam pegar chamados abertos na fila.
-- DEPOIS: qualquer pessoa ativa da equipe (atendimento, gestor, admin)
--         pode assumir PARA SI um chamado que está SEM responsável
--         (botão "Assumir este chamado").
--         Trocar o responsável de um chamado que já tem dono, tirar o
--         responsável ou passar para outra pessoa continua só com os
--         autorizados.
-- MOTIVO: pedido do Leonardo em 30/10/2026 (atendentes sem conseguir
--         assumir chamados abertos).
--
-- Só troca a função do gatilho; não mexe em dados. Pode rodar mais de
-- uma vez. A trava de horário continua valendo à parte.
-- =====================================================================

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
     )
     -- Exceção: assumir para si um chamado sem responsável.
     and not (
       old.responsavel_id is null
       and new.responsavel_id = auth.uid()
       and exists (
         select 1
           from public.profiles p
          where p.id = auth.uid()
            and p.perfil in ('atendimento', 'gestor', 'admin')
            and coalesce(p.ativo, true)
       )
     ) then
    raise exception 'Somente Leonardo ou Priscila (autorizados) podem alterar o responsável do chamado. Chamado sem responsável você pode assumir para si.';
  end if;

  return new;
end;
$fn$;


-- ---------- Conferência -------------------------------------------------
-- Deve mostrar 1 linha: o gatilho ativo com a nova regra (assume = true).
select t.tgname as gatilho,
       position('old.responsavel_id is null' in pg_get_functiondef(p.oid)) > 0 as assume
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where t.tgrelid = 'public.chamados'::regclass
   and t.tgname = 'a_chamado_responsavel_guarda';
