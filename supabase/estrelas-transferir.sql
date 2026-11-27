-- =====================================================================
-- Transferir as estrelas de um chamado para quem de fato o resolveu.
--
-- ANTES:  a estrela vai para quem era responsável no momento da
--         resolução, e o lançamento congela esse nome. É a regra certa
--         — "uma transferência depois de resolvido não move as
--         estrelas" (programa-estrelas.sql) existe para ninguém passar
--         a estrela para si mesmo trocando o responsável depois. Mas
--         ela não tinha exceção nenhuma: chamado resolvido por uma
--         pessoa e registrado no nome de outra ficava errado para
--         sempre. Nem estornar e restabelecer resolviam, porque
--         restabelecer devolve a estrela ao mesmo nome.
-- DEPOIS: gestor e admin transferem o lançamento, com motivo
--         obrigatório e evento registrado. O congelamento continua
--         valendo — o que passa a existir é a correção explícita e
--         assinada, do mesmo jeito que estornar e restabelecer já são.
-- MOTIVO: pedido dele em 27/11/2026, sobre o chamado #495: "quem
--         resolveu o chamado foi leonardo, então todas as estrelas
--         devem ir para ele".
--
-- POR QUE NÃO BASTAVA TROCAR O RESPONSÁVEL DO CHAMADO. O recálculo lê
-- o lançamento antes do chamado justamente para não deixar a estrela
-- andar sozinha. Mexer nessa ordem para atender a este caso abriria a
-- porta que o congelamento fechou.
--
-- POR QUE NÃO MEXE NO RESPONSÁVEL DO CHAMADO. São dois fatos
-- diferentes: quem respondia pelo atendimento e a quem a estrela
-- pertence. Reescrever o primeiro para arrumar o segundo apagaria o
-- histórico de quem conduziu o chamado.
--
-- O QUE ESTA FUNÇÃO NÃO FAZ: não recalcula nada. A quantidade de
-- estrelas, o prazo e a avaliação continuam exatamente como estavam —
-- o que muda é só de quem elas são.
--
-- Depende de supabase/programa-estrelas.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisito -------------------------------------------
do $$
begin
  if to_regclass('public.estrelas_lancamentos') is null then
    raise exception 'Rode antes supabase/programa-estrelas.sql.';
  end if;
end
$$;


-- ---------- 1. A transferência ------------------------------------------
create or replace function public.estrelas_transferir(
  p_chamado uuid,
  p_para    uuid,
  p_motivo  text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  l         public.estrelas_lancamentos%rowtype;
  v_motivo  text;
  v_de      text;
  v_para    text;
begin
  perform public.estrelas_exigir_gestor();
  v_motivo := public.estrelas_exigir_motivo(p_motivo);

  select * into l from public.estrelas_lancamentos
   where chamado_id = p_chamado for update;
  if not found then
    raise exception 'Este chamado não tem estrelas lançadas. Sem lançamento, não há o que transferir: confira se ele foi resolvido e se tinha responsável.';
  end if;

  if l.atendente_id = p_para then
    raise exception 'As estrelas deste chamado já são de quem você escolheu.';
  end if;

  /* Destino tem de ser alguém da equipe e ativo. Estrela em cliente ou
     em conta desativada some do ranking sem avisar ninguém. */
  select nome into v_para
    from public.profiles
   where id = p_para
     and coalesce(ativo, true)
     and perfil in ('atendimento', 'gestor', 'admin');
  if v_para is null then
    raise exception 'As estrelas só vão para alguém da equipe com a conta ativa.';
  end if;

  select nome into v_de from public.profiles where id = l.atendente_id;

  update public.estrelas_lancamentos
     set atendente_id = p_para,
         atualizado_em = now()
   where chamado_id = p_chamado;

  insert into public.estrelas_eventos
    (chamado_id, atendente_id, tipo, antes, depois, motivo, autor_id)
  values
    (p_chamado, p_para, 'transferida',
     jsonb_build_object('atendente_id', l.atendente_id, 'nome', v_de),
     jsonb_build_object('atendente_id', p_para, 'nome', v_para),
     v_motivo, auth.uid());
end;
$fn$;

revoke all on function public.estrelas_transferir(uuid, uuid, text) from public, anon;
grant execute on function public.estrelas_transferir(uuid, uuid, text) to authenticated;


-- ---------- 2. Conferência ----------------------------------------------
-- Esperado: a função existe (t) e nada foi transferido por este script
-- (transferencias = 0 na primeira vez que ele rodar).
select
  to_regproc('public.estrelas_transferir') is not null as funcao_criada,
  (select count(*) from public.estrelas_eventos where tipo = 'transferida') as transferencias;
