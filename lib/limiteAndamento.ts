import { supabase } from '@/lib/supabase'

/*
 * Limite de chamados "Em andamento" por atendente
 * (supabase/limite-chamados-em-andamento.sql). FASE 1: só aviso.
 *
 * - Um limite único para toda a equipe, definido por gestor/admin.
 * - Conta só 'em_atendimento' com a pessoa como responsável.
 * - Urgente nunca recebe o alerta.
 * - null = aviso desligado (o contador continua aparecendo).
 */

export type ConfigLimite = {
  /* false: SQL ainda não aplicado; a tela esconde o recurso. */
  disponivel: boolean
  limite: number | null
}

export async function carregarLimiteEmAndamento(): Promise<ConfigLimite> {
  try {
    const { data, error } = await supabase
      .from('atendimento_config')
      .select('limite_em_andamento')
      .eq('id', 1)
      .maybeSingle()

    if (error) return { disponivel: false, limite: null }

    const n = (data as any)?.limite_em_andamento

    return { disponivel: true, limite: typeof n === 'number' && n > 0 ? n : null }
  } catch {
    return { disponivel: false, limite: null }
  }
}

export async function definirLimiteEmAndamento(limite: number | null) {
  const { error } = await supabase.rpc('definir_limite_em_andamento', { p_limite: limite })

  if (error) {
    const msg = error.message || ''

    if (/definir_limite_em_andamento|function .* does not exist|schema cache/i.test(msg)) {
      throw new Error('O limite ainda não foi ativado no banco (rodar o SQL limite-chamados-em-andamento.sql).')
    }

    throw new Error(msg || 'Não foi possível salvar o limite.')
  }
}

/* Quantos chamados a pessoa tem em "Em andamento" agora. */
export async function contarEmAndamento(pessoaId: string, ignorarChamadoId?: string) {
  let consulta = supabase
    .from('chamados')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'em_atendimento')
    .eq('responsavel_id', pessoaId)

  if (ignorarChamadoId) consulta = consulta.neq('id', ignorarChamadoId)

  const { count, error } = await consulta

  if (error) return null

  return count ?? 0
}

/*
 * Pergunta antes de passar do limite. Devolve true para seguir.
 * `atual` = quantos a pessoa já tem SEM contar o chamado que está entrando.
 * Urgente, limite desligado ou contagem indisponível: segue sem perguntar.
 */
export function confirmarAcimaDoLimite(opcoes: {
  limite: number | null
  atual: number | null
  prioridade: string
  numero: number | string
  quem: string
}) {
  const { limite, atual, prioridade, numero, quem } = opcoes

  if (!limite || atual === null || prioridade === 'urgente') return true
  if (atual + 1 <= limite) return true

  return window.confirm(
    quem +
      ' já está com ' +
      atual +
      ' de ' +
      limite +
      ' chamados em andamento. Colocar o chamado #' +
      numero +
      ' em andamento vai passar do limite combinado.\n\n' +
      'Isto é só um aviso (o gestor acompanha no Desempenho). Continuar mesmo assim?'
  )
}
