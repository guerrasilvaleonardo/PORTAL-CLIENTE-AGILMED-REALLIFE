-- =====================================================================
-- Chamados: só GESTOR e ADMIN podem mudar a prioridade.
-- Rode no Supabase ("projeto ticket") -> SQL Editor. Pode rodar mais
-- de uma vez. Não apaga nem altera dados: só cria 1 função e 1 gatilho.
--
-- Por quê: trocar a prioridade refaz o prazo de SLA e mexe nas
-- estrelas do atendente. Por isso a decisão fica com gestor/admin.
--
-- ANTES:  qualquer usuário com permissão de atualizar o chamado podia
--         mudar a prioridade (atendente e, pela regra de RLS atual,
--         até o cliente da própria empresa, chamando a API direto).
-- DEPOIS: só gestor ou admin ativos. Atendente e cliente continuam
--         atualizando o resto do chamado normalmente.
--         Rotinas do servidor (service role / pg_cron, sem login)
--         não são afetadas.
-- Abertura do chamado (INSERT) não muda: quem abre escolhe a prioridade.
-- =====================================================================

create or replace function public.chamado_prioridade_guarda()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.prioridade is distinct from old.prioridade
     and auth.uid() is not null
     and not exists (
       select 1
         from public.profiles p
        where p.id = auth.uid()
          and p.perfil in ('gestor', 'admin')
          and coalesce(p.ativo, true)
     ) then
    raise exception 'Somente gestor ou administrador pode alterar a prioridade do chamado.';
  end if;

  return new;
end;
$fn$;

-- Nome com "a_" para rodar ANTES dos outros gatilhos BEFORE UPDATE
-- (prazo, pausa, estrelas): se for barrado, nada mais é calculado.
drop trigger if exists a_chamado_prioridade_guarda on public.chamados;
create trigger a_chamado_prioridade_guarda
  before update of prioridade on public.chamados
  for each row execute function public.chamado_prioridade_guarda();

-- Conferência: deve listar o gatilho.
-- select tgname from pg_trigger
--  where tgrelid = 'public.chamados'::regclass and tgname = 'a_chamado_prioridade_guarda';
