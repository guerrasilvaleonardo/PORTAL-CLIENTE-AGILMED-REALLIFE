import { ehFeriado } from '@/lib/prazo'

/*
 * Revisão dos chamados suspensos (supabase/chamados-arquivo-e-revisao-suspensos.sql).
 *
 * Todo chamado suspenso tem uma "próxima atualização" (data, sem hora).
 * Na data, o atendente reativa o chamado ou reprograma com nova data e
 * motivo. Esta parte é só cálculo (sem banco), para servir à tela e ao
 * cron.
 *
 * - futura: a data ainda não chegou;
 * - hoje: a data é hoje (pisca em amarelo no quadro);
 * - vencida: a data passou e ninguém agiu (pisca em vermelho; depois de
 *   1 dia útil vencida, o gestor recebe aviso).
 *
 * Revisão vencida NÃO afeta as estrelas: aparece só no dashboard da
 * equipe (decisão do Leonardo, 06/11/2026).
 */

export type SituacaoRevisao = 'futura' | 'hoje' | 'vencida'

/* Dias úteis vencida a partir dos quais o gestor é avisado. */
export const DIAS_UTEIS_ESCALONAR_GESTOR = 1

/* Hoje no horário de Porto Velho (UTC-4, sem horário de verão), AAAA-MM-DD. */
export function hojeEmPortoVelho(agora: Date = new Date()) {
  return new Date(agora.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function somarDias(data: string, dias: number) {
  const d = new Date(data.slice(0, 10) + 'T12:00:00Z')

  d.setUTCDate(d.getUTCDate() + dias)

  return d.toISOString().slice(0, 10)
}

function diaUtil(data: string) {
  const dia = new Date(data + 'T12:00:00Z').getUTCDay()

  return dia >= 1 && dia <= 5 && !ehFeriado(data)
}

/*
 * Dias úteis depois de "de" até "ate" (inclusive "ate"). Ex.: revisão na
 * sexta, hoje é segunda -> 1. Usa o calendário de feriados do SLA (chame
 * carregarFeriados antes).
 */
export function diasUteisDepois(de: string, ate: string) {
  let conta = 0
  let atual = somarDias(de, 1)
  const fim = ate.slice(0, 10)

  for (let voltas = 0; atual <= fim && voltas < 800; voltas++) {
    if (diaUtil(atual)) conta++
    atual = somarDias(atual, 1)
  }

  return conta
}

/* Dias úteis de hoje (exclusive) até a data (inclusive). */
export function diasUteisAte(data: string, hoje: string) {
  return diasUteisDepois(hoje, data)
}

export function situacaoRevisao(
  proxima: string | null | undefined,
  hoje: string = hojeEmPortoVelho()
): SituacaoRevisao | null {
  if (!proxima) return null

  const d = proxima.slice(0, 10)

  if (d < hoje) return 'vencida'
  if (d === hoje) return 'hoje'

  return 'futura'
}

/* Texto curto para o cartão do quadro. */
export function textoRevisao(proxima: string | null | undefined, hoje: string = hojeEmPortoVelho()) {
  const s = situacaoRevisao(proxima, hoje)

  if (!s || !proxima) return ''

  const [, m, d] = proxima.slice(0, 10).split('-')
  const curta = d + '/' + m

  if (s === 'hoje') return 'Revisão hoje · ' + curta

  if (s === 'vencida') {
    const dias = diasUteisDepois(proxima, hoje)

    return (
      'Revisão era ' +
      curta +
      ' · vencida' +
      (dias > 0 ? ' há ' + dias + (dias === 1 ? ' dia útil' : ' dias úteis') : ' (sem dia útil ainda)')
    )
  }

  const faltam = diasUteisAte(proxima, hoje)

  return (
    'Revisão em ' +
    curta +
    ' · ' +
    (faltam === 1 ? 'falta 1 dia útil' : 'faltam ' + faltam + ' dias úteis')
  )
}

/* Quando o gestor deve ser avisado (revisão vencida há N dias úteis ou mais). */
export function precisaEscalonar(proxima: string | null | undefined, hoje: string = hojeEmPortoVelho()) {
  if (situacaoRevisao(proxima, hoje) !== 'vencida' || !proxima) return false

  return diasUteisDepois(proxima, hoje) >= DIAS_UTEIS_ESCALONAR_GESTOR
}

/*
 * Arquivamento visual do quadro: Encerrado e Cancelado saem do quadro
 * 72 horas CORRIDAS depois de entrarem nessa situação e ficam no
 * Histórico. Nada muda no banco.
 */
export const HORAS_ARQUIVAR = 72

export function arquivadoNoQuadro(
  status: string,
  saidaEm: string | null | undefined,
  agora: Date = new Date()
) {
  if (status !== 'encerrado' && status !== 'cancelado') return false
  /* Sem data de saída não dá para contar as 72 h: continua no quadro. */
  if (!saidaEm) return false

  return agora.getTime() - new Date(saidaEm).getTime() >= HORAS_ARQUIVAR * 60 * 60 * 1000
}
