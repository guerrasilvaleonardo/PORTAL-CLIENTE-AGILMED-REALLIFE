-- =====================================================================
-- Estrelas: quem recebeu as estrelas do chamado não pode avaliá-lo
-- Rode no Supabase ("projeto ticket") -> SQL Editor, DEPOIS de
-- chamados-internos-avaliacao.sql. Pode rodar mais de uma vez.
--
-- Caso que motivou: #177 (interno). A Priscila virou responsável 3 s
-- antes da resolução, recebeu as estrelas e, como solicitante, avaliou
-- Excelente o próprio crédito. O banco só barrava o responsável ATUAL.
--
-- ANTES : avalia quem é solicitante/quem abriu, exceto o responsável atual.
-- DEPOIS: o mesmo, e também não avalia quem recebeu as estrelas do chamado.
--
-- Regras de pontuação NÃO mudam (decisão de 20/10/2026): prazo 1,
-- Bom +1, Excelente +2, Ruim 0, máximo 3 por chamado.
-- O #177 foi tratado com estorno pelo gestor (tela do chamado), não aqui.
-- Não altera nem apaga dados.
-- =====================================================================

create or replace function public.avaliacao_eh_avaliador(p_chamado uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.chamados c
      join public.empresas e on e.id = c.empresa_id
      join public.profiles u on u.id = p_usuario
      left join public.profiles cr on cr.id = c.criado_por
     where c.id = p_chamado
       and coalesce(u.ativo, true)
       and c.responsavel_id is distinct from p_usuario
       -- Quem recebeu as estrelas do chamado também não avalia (#177).
       and not exists (select 1 from public.estrelas_lancamentos l
                        where l.chamado_id = c.id and l.atendente_id = p_usuario)
       and (
             -- Chamado de cliente (regra anterior)
             (not e.interna and u.perfil = 'cliente' and (
                   c.solicitante_id = p_usuario
                or (c.solicitante_id is null and c.criado_por = p_usuario)
                or (c.solicitante_id is null
                    and coalesce(cr.perfil, '') <> 'cliente'
                    and u.empresa_id = c.empresa_id
                    and (c.visibilidade = 'empresa'
                         or exists (select 1 from public.chamado_participantes cp
                                     where cp.chamado_id = c.id
                                       and cp.usuario_id = p_usuario)))))
             -- Chamado interno: solicitante; sem ele, quem abriu
          or (e.interna and u.perfil in ('atendimento', 'gestor', 'admin') and (
                   c.solicitante_id = p_usuario
                or (c.solicitante_id is null and c.criado_por = p_usuario)))
           )
  );
$fn$;


revoke all on function public.avaliacao_eh_avaliador(uuid, uuid) from public, anon;
grant execute on function public.avaliacao_eh_avaliador(uuid, uuid) to authenticated;
