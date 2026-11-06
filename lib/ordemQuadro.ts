/*
 * Ordem dos cartões em cada coluna do Quadro de chamados.
 *
 * Aberto e Em andamento seguem a MESMA regra da fila de prioridades
 * (view v_chamados_fila em supabase/chamados-fila-prioridades.sql, usada
 * na tela Prioridades e na posição que o cliente vê):
 *   urgentes sempre no topo → prazo_sla mais próximo primeiro (atrasados
 *   vêm antes, do maior atraso para o menor) → prioridade → abertura.
 * Se a regra da view mudar, mude aqui também, para o quadro e a tela
 * Prioridades continuarem dizendo a mesma coisa.
 *
 * As outras colunas (decisão do Leonardo, 06/11/2026):
 *   Aguardando cliente .. quem espera há mais tempo primeiro
 *   Suspenso ............ próxima revisão mais cedo primeiro
 *   Resolvido ........... resolvido há mais tempo primeiro (próximo a encerrar)
 *   Encerrado/Cancelado . mais recente primeiro
 */

export type ChamadoOrdenavel = {
  prioridade: string
  status: string
  prazo_sla: string | null
  created_at: string
  sla_pausado_em?: string | null
  suspensao_proxima?: string | null
  resolvido_em?: string | null
  encerrado_em?: string | null
  cancelado_em?: string | null
}

const PESO_PRIORIDADE: Record<string, number> = { urgente: 1, alta: 2, normal: 3, baixa: 4 }

/* Texto curto que aparece no topo da coluna, explicando a ordem. */
export const NOTA_ORDEM: Record<string, string> = {
  aberto: 'Ordenado por prazo',
  em_atendimento: 'Ordenado por prazo',
  aguardando_cliente: 'Ordenado pela espera',
  suspenso: 'Ordenado pela próxima revisão',
  resolvido: 'Próximos a encerrar',
}

/* Compara textos de data ISO; vazio vai para o fim nas duas direções. */
function porData(a: string | null | undefined, b: string | null | undefined, desc = false) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1

  const r = new Date(a).getTime() - new Date(b).getTime()

  return desc ? -r : r
}

/* Fila de prioridades (Aberto e Em andamento). */
export function ordemFila(a: ChamadoOrdenavel, b: ChamadoOrdenavel) {
  const urgA = a.prioridade === 'urgente' ? 0 : 1
  const urgB = b.prioridade === 'urgente' ? 0 : 1

  return (
    urgA - urgB ||
    porData(a.prazo_sla, b.prazo_sla) ||
    (PESO_PRIORIDADE[a.prioridade] ?? 3) - (PESO_PRIORIDADE[b.prioridade] ?? 3) ||
    porData(a.created_at, b.created_at)
  )
}

/* Comparador da coluna; sem regra própria, mantém a ordem recebida. */
export function ordemDaColuna(coluna: string) {
  switch (coluna) {
    case 'aberto':
    case 'em_atendimento':
      return ordemFila
    case 'aguardando_cliente':
      return (a: ChamadoOrdenavel, b: ChamadoOrdenavel) =>
        porData(a.sla_pausado_em, b.sla_pausado_em) || ordemFila(a, b)
    case 'suspenso':
      /* Datas sem hora (AAAA-MM-DD): comparar o texto basta. */
      return (a: ChamadoOrdenavel, b: ChamadoOrdenavel) => {
        const da = a.suspensao_proxima || '9999-12-31'
        const db = b.suspensao_proxima || '9999-12-31'

        return (da < db ? -1 : da > db ? 1 : 0) || ordemFila(a, b)
      }
    case 'resolvido':
      return (a: ChamadoOrdenavel, b: ChamadoOrdenavel) =>
        porData(a.resolvido_em, b.resolvido_em) || porData(a.created_at, b.created_at)
    case 'encerrado':
      return (a: ChamadoOrdenavel, b: ChamadoOrdenavel) =>
        porData(a.encerrado_em, b.encerrado_em, true) || porData(a.created_at, b.created_at, true)
    case 'cancelado':
      return (a: ChamadoOrdenavel, b: ChamadoOrdenavel) =>
        porData(a.cancelado_em, b.cancelado_em, true) || porData(a.created_at, b.created_at, true)
    default:
      return () => 0
  }
}
