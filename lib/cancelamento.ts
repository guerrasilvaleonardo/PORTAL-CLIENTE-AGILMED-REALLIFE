'use client'

import { supabase } from '@/lib/supabase'

/*
 * Chamado cancelado (supabase/chamados-cancelamento.sql).
 *
 * O único caminho para 'cancelado' é a função cancelar_chamado, que só
 * gestor/admin executa, com motivo da lista e observação interna. O
 * cliente vê o motivo; a observação fica com a equipe. Cancelado fica
 * fora do SLA e das estrelas. Desfazer = gestor volta a situação para
 * Aberto ou Em atendimento (o registro do cancelamento fica guardado).
 */

export const MOTIVO_OUTRO = 'Outro'

/* Mesma lista da regra do banco (chamado_cancelamentos.motivo). */
export const MOTIVOS_CANCELAMENTO = [
  'Chamado duplicado',
  'Aberto por engano',
  'Cliente desistiu da solicitação',
  'Fora do escopo contratado',
  'Sem retorno do cliente',
  'Substituído por outro chamado',
] as const

export type RegistroCancelamento = {
  id: number
  motivo: string
  detalhe: string | null
  observacao: string
  status_anterior: string
  cancelado_em: string
  cancelado_por: string | null
  revertido_em: string | null
  autor?: { nome: string | null } | null
}

/* Motivo como o cliente vê ("Outro" mostra o texto descrito). */
export function motivoExibido(r: Pick<RegistroCancelamento, 'motivo' | 'detalhe'>) {
  return r.motivo === MOTIVO_OUTRO ? r.detalhe || 'Outro' : r.motivo
}

export async function cancelarChamado(
  chamadoId: string,
  motivo: string,
  detalhe: string,
  observacao: string
) {
  const { error } = await supabase.rpc('cancelar_chamado', {
    p_chamado: chamadoId,
    p_motivo: motivo,
    p_detalhe: detalhe || null,
    p_observacao: observacao,
  })

  if (error) {
    const msg = error.message || ''

    if (/cancelar_chamado|function .* does not exist|schema cache/i.test(msg)) {
      throw new Error('O cancelamento ainda não foi ativado no banco (rodar supabase/chamados-cancelamento.sql).')
    }

    throw new Error(msg || 'Não foi possível cancelar o chamado.')
  }
}

/* Cancelamentos do chamado, do mais recente (só a equipe enxerga). */
export async function carregarCancelamentos(chamadoId: string) {
  try {
    const { data, error } = await supabase
      .from('chamado_cancelamentos')
      .select(
        'id, motivo, detalhe, observacao, status_anterior, cancelado_em, cancelado_por, revertido_em, autor:profiles!chamado_cancelamentos_cancelado_por_fkey(nome)'
      )
      .eq('chamado_id', chamadoId)
      .order('cancelado_em', { ascending: false })

    if (error) return [] as RegistroCancelamento[]

    return (data || []) as unknown as RegistroCancelamento[]
  } catch {
    return [] as RegistroCancelamento[]
  }
}

/* Motivo do cancelamento vigente, como o cliente vê (consulta tolerante). */
export async function motivoDoCancelamento(chamadoId: string) {
  try {
    const { data, error } = await supabase
      .from('chamados')
      .select('cancelamento_motivo, cancelado_em')
      .eq('id', chamadoId)
      .maybeSingle()

    if (error || !data) return null

    return data as { cancelamento_motivo: string | null; cancelado_em: string | null }
  } catch {
    return null
  }
}
