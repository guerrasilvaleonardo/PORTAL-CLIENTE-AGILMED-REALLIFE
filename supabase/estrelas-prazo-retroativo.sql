-- =====================================================================
-- Extensão de prazo retroativa: o gestor passa a poder autorizar.
--
-- ANTES:  estrelas_decidir_prazo recusava autorizar qualquer extensão
--         cujo prazo anterior já estivesse vencido na hora da alteração.
--         A recusa era absoluta — e como só gestor chega nessa função,
--         na prática ninguém conseguia autorizar, nem com motivo.
-- DEPOIS: a trava continua sendo a resposta padrão, mas o gestor pode
--         passar por cima dela de propósito, num segundo passo, e isso
--         fica gravado como "forçado" no histórico da estrela.
-- MOTIVO: existe caso legítimo. O chamado aparece vencido enquanto o
--         documento que ele acompanha está em dia: o prazo nasceu
--         errado, e recusar a correção pune o atendente por um defeito
--         do cálculo. Quem conhece o caso é o gestor.
--
-- POR QUE NÃO SIMPLESMENTE APAGAR A TRAVA. Ela existe para impedir a
-- manobra de esticar um prazo já estourado e salvar a pontuação depois
-- do fato. Apagá-la tiraria a proteção de todo mundo para resolver um
-- caso. Mantida como padrão, ela continua sendo o atrito que faz a
-- pessoa parar e pensar; o que muda é existir uma saída, com nome e
-- justificativa de quem usou.
--
-- A assinatura da função muda (ganha p_forcar). A antiga é apagada
-- antes, senão as duas versões conviveriam e a chamada de três
-- argumentos ficaria ambígua.
--
-- Depende de supabase/programa-estrelas.sql.
-- Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regprocedure('public.estrelas_exigir_gestor()') is null then
    raise exception 'Rode antes supabase/programa-estrelas.sql.';
  end if;
end
$$;


-- ---------- 1. A versão antiga sai de cena ------------------------------
drop function if exists public.estrelas_decidir_prazo(bigint, boolean, text);


-- ---------- 2. A nova, com a saída do gestor ----------------------------
create or replace function public.estrelas_decidir_prazo(
  p_alteracao bigint,
  p_autorizar boolean,
  p_justificativa text,
  p_forcar boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a public.estrelas_prazo_alteracoes%rowtype;
  v_motivo text;
  v_retroativa boolean;
begin
  perform public.estrelas_exigir_gestor();
  v_motivo := public.estrelas_exigir_motivo(p_justificativa);
  select * into a from public.estrelas_prazo_alteracoes where id = p_alteracao for update;
  if not found then raise exception 'Alteração de prazo não encontrada.'; end if;
  if a.autorizado is not null then raise exception 'Esta alteração já foi decidida.'; end if;

  v_retroativa := p_autorizar
                  and a.prazo_novo > a.prazo_anterior
                  and a.prazo_anterior < a.alterado_em;

  -- O texto da recusa não muda: a tela reconhece esta mensagem para
  -- oferecer o segundo passo ao gestor.
  if v_retroativa and not coalesce(p_forcar, false) then
    raise exception 'Não é possível autorizar: o prazo anterior já estava vencido quando foi alterado (alteração retroativa).';
  end if;

  update public.estrelas_prazo_alteracoes
     set autorizado = p_autorizar, decidido_por = auth.uid(), decidido_em = now(),
         justificativa = v_motivo
   where id = p_alteracao;

  insert into public.estrelas_eventos (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id)
  values (a.chamado_id,
          (select l.atendente_id from public.estrelas_lancamentos l where l.chamado_id = a.chamado_id),
          'prazo_decidido',
          jsonb_build_object('prazo_anterior', a.prazo_anterior, 'prazo_novo', a.prazo_novo),
          jsonb_build_object('autorizado', p_autorizar, 'retroativa_forcada', v_retroativa),
          v_motivo, auth.uid());

  perform public.estrelas_recalcular(a.chamado_id, auth.uid());
end;
$fn$;

revoke all on function public.estrelas_decidir_prazo(bigint, boolean, text, boolean)
  from public, anon;
grant execute on function public.estrelas_decidir_prazo(bigint, boolean, text, boolean)
  to authenticated;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'estrelas_decidir_prazo')     as versoes_da_funcao,
       (select pg_get_function_identity_arguments(p.oid) from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'estrelas_decidir_prazo')     as argumentos,
       (select count(*) from public.estrelas_prazo_alteracoes
         where autorizado is null)                                               as aguardando_gestor;
