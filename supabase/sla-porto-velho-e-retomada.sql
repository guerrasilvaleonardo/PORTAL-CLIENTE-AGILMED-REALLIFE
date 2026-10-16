-- ========================================================================
-- SLA no horário de Porto Velho + retomada automática da pausa
--
-- 1) EXPEDIENTE EM PORTO VELHO
--    ANTES:  horas úteis contadas de 8h-12h e 13h-17h no horário de
--            BRASÍLIA (em Porto Velho, isso dava 7h-11h e 12h-16h).
--    DEPOIS: 8h-12h e 13h-17h no horário de PORTO VELHO
--            (America/Porto_Velho, UTC-4, sem horário de verão).
--    Como: toda função do schema public que usa 'America/Sao_Paulo'
--    é recriada igual, trocando só o fuso. Isso cobre o SLA
--    (horas_uteis_entre, somar_horas_uteis) e o programa de estrelas
--    (data inicial, limites de mês/ano do ranking, fechamento).
--    Prazos JÁ GRAVADOS não são recalculados. A regra nova vale para
--    prazos calculados a partir de agora (novos chamados, retomadas
--    de pausa, reaberturas e trocas de prioridade).
--
-- 2) RETOMADA AUTOMÁTICA
--    ANTES:  mensagem do cliente só reabria chamado "Resolvido". Em
--            "Aguardando cliente", o SLA continuava pausado até o
--            atendente mudar o status manualmente.
--    DEPOIS: mensagem do cliente em chamado "Aguardando cliente" volta
--            o chamado para "Em atendimento". O gatilho já existente
--            registrar_mudanca_chamado retoma o SLA e estende o prazo
--            pelas horas úteis da espera, como sempre.
--
-- Rode no Supabase: SQL Editor -> cole tudo -> Run. Pode rodar de novo
-- sem problema (idempotente).
-- =====================================================================

-- ---------- 1. Fuso do expediente ------------------------------------
do $$
declare
  f record;
  n int := 0;
begin
  for f in
    select p.oid, p.proname
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.prokind = 'f'
       and p.prosrc like '%America/Sao_Paulo%'
  loop
    execute replace(pg_get_functiondef(f.oid), 'America/Sao_Paulo', 'America/Porto_Velho');
    n := n + 1;
    raise notice 'Fuso ajustado para Porto Velho: %', f.proname;
  end loop;
  raise notice 'Funções ajustadas: %', n;
end;
$$;

-- Aviso (sem alterar nada) se alguma VIEW ainda usar o fuso de Brasília.
do $$
declare
  v record;
begin
  for v in
    select viewname from pg_views
     where schemaname = 'public' and definition like '%America/Sao_Paulo%'
  loop
    raise warning 'A view % ainda usa America/Sao_Paulo. Revise manualmente.', v.viewname;
  end loop;
end;
$$;

-- ---------- 2. Mensagem do cliente retoma o atendimento ---------------
create or replace function public.reabrir_chamado_por_mensagem_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if exists (
       select 1 from public.profiles p
       where p.id = new.autor_id
         and p.perfil = 'cliente'
     ) then
    -- "Resolvido": reabre (como antes).
    -- "Aguardando cliente": o cliente respondeu, o relógio volta a contar.
    update public.chamados
       set status = 'em_atendimento'
     where id = new.chamado_id
       and status in ('resolvido', 'aguardando_cliente');
  end if;

  return null;
end;
$fn$;

drop trigger if exists reabrir_chamado_por_mensagem_cliente on public.chamado_mensagens;
create trigger reabrir_chamado_por_mensagem_cliente
  after insert on public.chamado_mensagens
  for each row execute function public.reabrir_chamado_por_mensagem_cliente();

-- ---------- 3. Conferência --------------------------------------------
-- Deve retornar 0 (nenhuma função ainda no fuso de Brasília):
select count(*) as funcoes_ainda_em_brasilia
  from pg_proc p
  join pg_namespace s on s.oid = p.pronamespace
 where s.nspname = 'public'
   and p.prosrc like '%America/Sao_Paulo%';
