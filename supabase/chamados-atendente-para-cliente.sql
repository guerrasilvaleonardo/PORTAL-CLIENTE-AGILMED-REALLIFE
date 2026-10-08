-- =====================================================================
-- Chamados: o cliente vê quem é o atendente responsável.
-- Rode no Supabase -> SQL Editor. Pode rodar mais de uma vez.
-- Não altera nem apaga nada que já existe: só cria uma função.
--
-- Por que uma função e não liberar a tabela profiles para o cliente:
-- a função devolve SÓ o nome do responsável e SÓ do chamado que a
-- pessoa já tem direito de ver (mesma regra de posicao_do_chamado).
-- E-mail, telefone, perfil e demais dados da equipe continuam fechados.
-- =====================================================================

create or replace function public.atendente_do_chamado(p_chamado_id uuid)
returns table (
  nome text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(nullif(trim(p.nome), ''), 'Equipe de atendimento')::text
  from public.chamados c
  join public.profiles p on p.id = c.responsavel_id
  where c.id = p_chamado_id
    and (public.e_equipe_interna() or c.empresa_id = public.minha_empresa_id());
$fn$;

revoke all on function public.atendente_do_chamado(uuid) from public;
grant execute on function public.atendente_do_chamado(uuid) to authenticated;

-- Conferência (troque pelo id de um chamado com responsável):
-- select * from public.atendente_do_chamado('00000000-0000-0000-0000-000000000000');
