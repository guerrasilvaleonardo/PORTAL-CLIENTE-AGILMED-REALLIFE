/*
 * Desempenho individual no atendimento de chamados.
 *
 * Todas as contas de tempo usam HORAS ÚTEIS (lib/prazo.ts): 8 horas
 * por dia, de segunda a sexta, no horário de Brasília. Fica aqui,
 * separado da tela, para que a regra de cada indicador esteja escrita
 * num lugar só e possa ser conferida sem abrir o React.
 *
 * Regras de atribuição e de cálculo:
 *
 * - O chamado conta para o RESPONSÁVEL ATUAL (responsavel_id). Se foi
 *   transferido no meio do caminho, o resultado inteiro fica com quem
 *   está com ele hoje.
 * - Recebidos ....... abertos dentro do período.
 * - Concluídos ...... resolvidos (ou encerrados) dentro do período.
 *                     A data é resolvido_em; sem ela, encerrado_em.
 * - SLA cumprido .... dos concluídos com prazo, quantos foram
 *                     resolvidos até o prazo_sla. O banco já estende o
 *                     prazo pelas horas úteis em "Aguardando cliente"
 *                     e em "Resolvido" antes de uma reabertura.
 * - 1ª resposta ..... horas úteis entre a abertura e a primeira
 *                     mensagem escrita por alguém da equipe interna
 *                     (mensagens automáticas não contam). Medida nos
 *                     chamados recebidos no período que já têm resposta.
 * - Resolução ....... horas úteis entre a abertura e a conclusão,
 *                     descontando o tempo em "Aguardando cliente" e em
 *                     "Resolvido" antes de reabrir (o relógio que é
 *                     do cliente, não do atendente).
 * - Reabertura ...... concluídos que, em algum momento, saíram de
 *                     "Resolvido"/"Encerrado" de volta para atendimento.
 * - Carteira ........ retrato de AGORA, não depende do período:
 *                     chamados em aberto, atrasados, urgentes e o % médio
 *                     das etapas.
 *
 * Tempos são mostrados pela MEDIANA: um único chamado parado por
 * semanas não distorce o retrato do mês inteiro.
 */

import { horasUteisEntre, situacaoSla } from '@/lib/prazo'

export const STATUS_EM_ABERTO = ['aberto', 'em_atendimento', 'aguardando_cliente']

/* Estados em que o relógio é do cliente, não do atendente. */
const ESTADOS_PAUSADOS = ['aguardando_cliente', 'resolvido', 'encerrado']

export type ChamadoBase = {
  id: string
  numero: number | null
  assunto: string
  categoria: string | null
  prioridade: string
  status: string
  responsavel_id: string | null
  prazo_sla: string | null
  sla_pausado_em: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  created_at: string
  marca: string | null
  empresa: string
}

export type EventoStatus = {
  chamado_id: string
  de: string | null
  para: string | null
  created_at: string
}

export type Indicadores = {
  recebidos: number
  concluidos: number
  slaAvaliados: number
  slaCumpridos: number
  primeiraRespostaMediana: number | null
  primeiraRespostaAmostra: number
  resolucaoMediana: number | null
  reabertos: number
  carteira: number
  atrasados: number
  urgentes: number
  aguardandoCliente: number
  etapasMedia: number | null
  etapasAmostra: number
}

export function indicadoresVazios(): Indicadores {
  return {
    recebidos: 0,
    concluidos: 0,
    slaAvaliados: 0,
    slaCumpridos: 0,
    primeiraRespostaMediana: null,
    primeiraRespostaAmostra: 0,
    resolucaoMediana: null,
    reabertos: 0,
    carteira: 0,
    atrasados: 0,
    urgentes: 0,
    aguardandoCliente: 0,
    etapasMedia: null,
    etapasAmostra: 0,
  }
}

export function dataConclusao(c: ChamadoBase) {
  if (c.status !== 'resolvido' && c.status !== 'encerrado') return null

  return c.resolvido_em || c.encerrado_em || null
}

function dentro(data: string | null, ini: Date, fim: Date) {
  if (!data) return false

  const t = new Date(data).getTime()

  return t >= ini.getTime() && t < fim.getTime()
}

export function mediana(valores: number[]) {
  if (valores.length === 0) return null

  const v = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(v.length / 2)

  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
}

/*
 * Horas úteis em que o chamado ficou em estado pausado entre a abertura
 * e `ate`, reconstruídas a partir do histórico de status.
 */
export function horasUteisPausadas(
  criadoEm: string,
  ate: string,
  eventos: EventoStatus[]
) {
  const limite = new Date(ate)
  let estado = 'aberto'
  let desde = new Date(criadoEm)
  let total = 0

  const ordenados = [...eventos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  for (const e of ordenados) {
    const quando = new Date(e.created_at)

    if (quando.getTime() > limite.getTime()) break

    if (ESTADOS_PAUSADOS.includes(estado)) {
      total += Math.max(0, horasUteisEntre(desde, quando))
    }

    estado = e.para || estado
    desde = quando
  }

  /*
   * A conclusão é o próprio momento em que entrou em "Resolvido", então
   * o trecho final, depois do último evento, não é pausa.
   */
  return total
}

export function foiReaberto(eventos: EventoStatus[]) {
  return eventos.some(
    (e) =>
      (e.de === 'resolvido' || e.de === 'encerrado') &&
      STATUS_EM_ABERTO.includes(e.para || '')
  )
}

/*
 * Calcula os indicadores de um conjunto de chamados (de uma pessoa, de
 * uma área ou da equipe inteira).
 */
export function calcularIndicadores({
  chamados,
  ini,
  fim,
  eventosPorChamado,
  primeiraRespostaPorChamado,
  etapasPorChamado,
}: {
  chamados: ChamadoBase[]
  ini: Date
  fim: Date
  eventosPorChamado: Record<string, EventoStatus[]>
  primeiraRespostaPorChamado: Record<string, string>
  etapasPorChamado: Record<string, number>
}): Indicadores {
  const r = indicadoresVazios()
  const respostas: number[] = []
  const resolucoes: number[] = []
  const etapas: number[] = []

  for (const c of chamados) {
    if (dentro(c.created_at, ini, fim)) {
      r.recebidos++

      const resposta = primeiraRespostaPorChamado[c.id]

      if (resposta) {
        respostas.push(Math.max(0, horasUteisEntre(new Date(c.created_at), new Date(resposta))))
      }
    }

    const concluidoEm = dataConclusao(c)

    if (concluidoEm && dentro(concluidoEm, ini, fim)) {
      r.concluidos++

      const eventos = eventosPorChamado[c.id] || []

      if (c.prazo_sla) {
        const sla = situacaoSla(c)

        if (sla.chave === 'cumprido' || sla.chave === 'descumprido') {
          r.slaAvaliados++
          if (sla.chave === 'cumprido') r.slaCumpridos++
        }
      }

      const bruto = horasUteisEntre(new Date(c.created_at), new Date(concluidoEm))
      const pausa = horasUteisPausadas(c.created_at, concluidoEm, eventos)

      resolucoes.push(Math.max(0, bruto - pausa))

      if (foiReaberto(eventos)) r.reabertos++
    }

    if (STATUS_EM_ABERTO.includes(c.status)) {
      r.carteira++

      if (c.prioridade === 'urgente') r.urgentes++
      if (c.status === 'aguardando_cliente') r.aguardandoCliente++
      if (situacaoSla(c).chave === 'atrasado') r.atrasados++

      const pct = etapasPorChamado[c.id]

      if (typeof pct === 'number') etapas.push(pct)
    }
  }

  r.primeiraRespostaMediana = mediana(respostas)
  r.primeiraRespostaAmostra = respostas.length
  r.resolucaoMediana = mediana(resolucoes)
  r.etapasMedia = etapas.length
    ? etapas.reduce((s, v) => s + v, 0) / etapas.length
    : null
  r.etapasAmostra = etapas.length

  return r
}

export function percentual(parte: number, todo: number) {
  return todo > 0 ? Math.round((100 * parte) / todo) : null
}

/* "3,5h úteis" / "2,1d úteis" — com uma casa, para tempos médios. */
export function textoHoras(h: number | null) {
  if (h === null) return '—'

  if (h >= 8) {
    return (h / 8).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'd úteis'
  }

  return h.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'h úteis'
}

/* Períodos do filtro. `fim` é exclusivo. */
export type ChavePeriodo = '7d' | '30d' | '90d' | 'mes' | 'mes_anterior' | 'ano'

export const PERIODOS: { chave: ChavePeriodo; rotulo: string }[] = [
  { chave: 'mes', rotulo: 'Mês atual' },
  { chave: 'mes_anterior', rotulo: 'Mês anterior' },
  { chave: '7d', rotulo: 'Últimos 7 dias' },
  { chave: '30d', rotulo: 'Últimos 30 dias' },
  { chave: '90d', rotulo: 'Últimos 90 dias' },
  { chave: 'ano', rotulo: 'Ano atual' },
]

/*
 * Limites do período no calendário de Brasília (UTC-3 o ano todo),
 * para "mês atual" começar à meia-noite de Brasília e não de UTC.
 */
export function limitesPeriodo(chave: ChavePeriodo, agora = new Date()) {
  const FUSO = -3 * 3600000
  const local = new Date(agora.getTime() + FUSO)
  const ano = local.getUTCFullYear()
  const mes = local.getUTCMonth()
  const dia = local.getUTCDate()

  const meiaNoite = (a: number, m: number, d: number) =>
    new Date(Date.UTC(a, m, d) - FUSO)

  const amanha = meiaNoite(ano, mes, dia + 1)

  switch (chave) {
    case '7d':
      return { ini: meiaNoite(ano, mes, dia - 6), fim: amanha }
    case '30d':
      return { ini: meiaNoite(ano, mes, dia - 29), fim: amanha }
    case '90d':
      return { ini: meiaNoite(ano, mes, dia - 89), fim: amanha }
    case 'mes_anterior':
      return { ini: meiaNoite(ano, mes - 1, 1), fim: meiaNoite(ano, mes, 1) }
    case 'ano':
      return { ini: meiaNoite(ano, 0, 1), fim: amanha }
    case 'mes':
    default:
      return { ini: meiaNoite(ano, mes, 1), fim: amanha }
  }
}
