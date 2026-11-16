-- =====================================================================
-- Abertura de chamado pelo CLIENTE: prioridade máxima = Normal.
-- Rode no Supabase ("projeto ticket") -> SQL Editor -> Run.
-- Pode rodar de novo sem problema. Não altera chamados existentes.
--
-- ANTES:  o cliente abria como Baixa, Normal ou Alta (Urgente já era
--         só da gestão, por chamados-prioridade-abertura-cliente.sql).
-- DEPOIS: o cliente abre como Baixa ou Normal. Alta e Urgente são
--         definidas pela equipe interna depois de analisar o chamado
--         (a troca de prioridade continua com gestor/admin, gatilho
--         a_chamado_prioridade_guarda).
--         Se um cliente tentar abrir como Alta ou Urgente (tela antiga
--         em cache, chamada direta à API), o chamado entra como Normal
--         e o prazo é refeito para 24 horas úteis.
--         A equipe interna continua podendo abrir com qualquer prioridade.
-- MOTIVO: pedido do Leonardo em 16/11/2026: o cliente marca Alta por
--         hábito; quem mede a urgência real é a equipe.
-- =====================================================================

create or replace function public.chamado_prioridade_abertura()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.prioridade in ('alta', 'urgente')
     and exists (select 1 from public.profiles p
                  where p.id = coalesce(auth.uid(), new.criado_por)
                    and p.perfil = 'cliente') then
    new.prioridade := 'normal';
    new.prazo_sla  := public.somar_horas_uteis(coalesce(new.created_at, now()), 24);
  end if;

  return new;
end;
$fn$;

drop trigger if exists a_chamado_prioridade_abertura on public.chamados;
create trigger a_chamado_prioridade_abertura
  before insert on public.chamados
  for each row execute function public.chamado_prioridade_abertura();

-- Conferência: deve aparecer "in ('alta', 'urgente')" e o gatilho.
select tgname from pg_trigger
 where tgrelid = 'public.chamados'::regclass
   and tgname = 'a_chamado_prioridade_abertura';
select position('''alta'', ''urgente''' in pg_get_functiondef('public.chamado_prioridade_abertura'::regproc)) > 0 as regra_nova_ativa;
