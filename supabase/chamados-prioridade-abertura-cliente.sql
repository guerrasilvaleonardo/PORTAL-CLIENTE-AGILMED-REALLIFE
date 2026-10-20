-- =====================================================================
-- Abertura de chamado pelo CLIENTE: prioridade máxima = Alta.
-- Rode no Supabase ("projeto ticket") -> SQL Editor -> Run.
-- Pode rodar de novo sem problema. Não altera chamados existentes.
--
-- ANTES:  o cliente escolhia qualquer prioridade (84% dos chamados de
--         clientes vinham como Urgente ou Alta).
-- DEPOIS: o cliente escolhe Baixa, Normal ou Alta. Urgente é definida
--         pela gestão (gestor/admin), que já é quem pode trocar a
--         prioridade (gatilho a_chamado_prioridade_guarda).
--         Se um cliente tentar abrir como Urgente (tela antiga em
--         cache, chamada direta à API), o chamado entra como Alta e o
--         prazo é refeito para 8 horas úteis.
--         Equipe interna continua podendo abrir com qualquer prioridade.
-- =====================================================================

create or replace function public.chamado_prioridade_abertura()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.prioridade = 'urgente'
     and exists (select 1 from public.profiles p
                  where p.id = coalesce(auth.uid(), new.criado_por)
                    and p.perfil = 'cliente') then
    new.prioridade := 'alta';
    new.prazo_sla  := public.somar_horas_uteis(coalesce(new.created_at, now()), 8);
  end if;

  return new;
end;
$fn$;

drop trigger if exists a_chamado_prioridade_abertura on public.chamados;
create trigger a_chamado_prioridade_abertura
  before insert on public.chamados
  for each row execute function public.chamado_prioridade_abertura();

-- Conferência: deve listar o gatilho.
-- select tgname from pg_trigger where tgrelid = 'public.chamados'::regclass
--    and tgname = 'a_chamado_prioridade_abertura';
