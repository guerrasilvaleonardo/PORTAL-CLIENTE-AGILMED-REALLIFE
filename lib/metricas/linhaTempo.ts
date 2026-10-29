/*
 * Linha do tempo de um chamado, reconstruída do histórico gravado
 * (chamado_eventos: mudanças de situação e de responsável) e das
 * suspensões (chamado_suspensoes: motivo, início e fim).
 *
 * Cada trecho tem uma situação e o responsável naquele momento:
 *   fila               aberto/em atendimento SEM responsável
 *   atendimento        aberto/em atendimento COM responsável
 *   aguardando_cliente pausa por espera do solicitante
 *   suspenso           pausa por dependência (sistema, software,
 *                      fornecedor, terceiros...), com o motivo
 *   resolvido / encerrado / cancelado
 *
 * Importante: "atendimento" é o tempo em que o chamado esteve com um
 * responsável e sem pausa. NÃO é tempo de trabalho efetivo — o portal
 * não tem apontamento de horas. O relatório deixa isso explícito.
 *
 * Os eventos de responsável guardam o NOME (de/para), não o id. Por isso
 * o responsável dos trechos é o nome; quem chama compara pelo nome.
 */

import { horasUteisEntre } from '@/lib/prazo'

export type EventoLinha = {
  tipo: string // 'status' | 'responsavel' (outros são ignorados)
  de: string | null
  para: string | null
  created_at: string
}

export type SuspensaoLinha = { inicio: string; fim: string | null; motivo: string }

export type Situacao =
  | 'fila'
  | 'atendimento'
  | 'aguardando_cliente'
  | 'suspenso'
  | 'resolvido'
  | 'encerrado'
  | 'cancelado'

export type Trecho = {
  inicio: string
  fim: string
  situacao: Situacao
  responsavel: string | null
  motivo?: string
  horasUteis: number
  horasCorridas: number
}

export type TemposChamado = {
  /* Da abertura até a última conclusão (ou até o fim da análise). */
  corridoH: number
  utilH: number
  fila: number
  atendimento: number
  aguardandoCliente: number
  suspenso: number
  suspensoPorMotivo: Record<string, number>
}

export type LinhaDoTempo = {
  trechos: Trecho[]
  tempos: TemposChamado
  transferencias: number
  reaberturas: number
  /* Responsável no momento da (última) conclusão. */
  responsavelNaConclusao: string | null
  concluidoEm: string | null
}

const SEM_RESPONSAVEL = ['sem responsavel', 'sem responsável', '']

export function nomeOuNulo(v: string | null | undefined) {
  const t = (v || '').trim()
  return SEM_RESPONSAVEL.includes(t.toLowerCase()) ? null : t
}

function situacaoDe(status: string, responsavel: string | null): Situacao {
  switch (status) {
    case 'aguardando_cliente':
      return 'aguardando_cliente'
    case 'suspenso':
      return 'suspenso'
    case 'resolvido':
      return 'resolvido'
    case 'encerrado':
      return 'encerrado'
    case 'cancelado':
      return 'cancelado'
    default:
      return responsavel ? 'atendimento' : 'fila'
  }
}

export const SITUACOES_CONCLUIDAS: Situacao[] = ['resolvido', 'encerrado', 'cancelado']

/*
 * `responsavelAtual`: nome do responsável hoje (usado quando não há
 * nenhum evento de responsável: o chamado nasceu e ficou com ele).
 * `ate`: fim da análise (agora ou fim do período), para chamados abertos.
 */
export function montarLinhaDoTempo(
  c: { created_at: string; status: string; responsavelAtual: string | null },
  eventos: EventoLinha[],
  suspensoes: SuspensaoLinha[],
  ate: Date
): LinhaDoTempo {
  const evs = eventos
    .filter((e) => e.tipo === 'status' || e.tipo === 'responsavel')
    .filter((e) => new Date(e.created_at).getTime() <= ate.getTime())
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const primeiroResp = evs.find((e) => e.tipo === 'responsavel')
  let responsavel = primeiroResp ? nomeOuNulo(primeiroResp.de) : nomeOuNulo(c.responsavelAtual)

  const primeiroStatus = evs.find((e) => e.tipo === 'status')
  let status = primeiroStatus?.de || 'aberto'

  let desde = new Date(c.created_at)
  const trechos: Trecho[] = []
  let transferencias = 0
  let reaberturas = 0

  const motivoEm = (quando: Date) => {
    const s = suspensoes.find((x) => {
      const i = new Date(x.inicio).getTime()
      const f = x.fim ? new Date(x.fim).getTime() : Infinity
      return quando.getTime() >= i - 60000 && quando.getTime() < f
    })
    return s?.motivo || 'Motivo não registrado'
  }

  const fechar = (ateQuando: Date) => {
    if (ateQuando.getTime() <= desde.getTime()) return
    const situacao = situacaoDe(status, responsavel)
    trechos.push({
      inicio: desde.toISOString(),
      fim: ateQuando.toISOString(),
      situacao,
      responsavel,
      ...(situacao === 'suspenso' ? { motivo: motivoEm(desde) } : {}),
      horasUteis: Math.max(0, horasUteisEntre(desde, ateQuando)),
      horasCorridas: (ateQuando.getTime() - desde.getTime()) / 3600000,
    })
  }

  for (const e of evs) {
    const quando = new Date(e.created_at)
    fechar(quando)
    if (e.tipo === 'status') {
      if ((status === 'resolvido' || status === 'encerrado') && e.para && !SITUACOES_CONCLUIDAS.includes(e.para as Situacao)) {
        reaberturas++
      }
      status = e.para || status
    } else {
      const novo = nomeOuNulo(e.para)
      if (responsavel && novo && novo !== responsavel) transferencias++
      responsavel = novo
    }
    if (quando.getTime() > desde.getTime()) desde = quando
  }

  const concluidoAgora = SITUACOES_CONCLUIDAS.includes(status as Situacao)
  if (!concluidoAgora) fechar(ate)

  /* Última conclusão: início do último trecho resolvido/encerrado/cancelado
     sem trecho em aberto depois dele. */
  let concluidoEm: string | null = null
  let responsavelNaConclusao: string | null = null
  if (concluidoAgora) {
    const ultimoEventoConclusao = [...evs].reverse().find((e) => e.tipo === 'status' && SITUACOES_CONCLUIDAS.includes((e.para || '') as Situacao) && !SITUACOES_CONCLUIDAS.includes((e.de || '') as Situacao))
    concluidoEm = ultimoEventoConclusao?.created_at || desde.toISOString()
    responsavelNaConclusao = responsavel
  }

  const tempos: TemposChamado = {
    corridoH: 0,
    utilH: 0,
    fila: 0,
    atendimento: 0,
    aguardandoCliente: 0,
    suspenso: 0,
    suspensoPorMotivo: {},
  }

  for (const t of trechos) {
    if (SITUACOES_CONCLUIDAS.includes(t.situacao)) continue
    tempos.corridoH += t.horasCorridas
    tempos.utilH += t.horasUteis
    if (t.situacao === 'fila') tempos.fila += t.horasUteis
    else if (t.situacao === 'atendimento') tempos.atendimento += t.horasUteis
    else if (t.situacao === 'aguardando_cliente') tempos.aguardandoCliente += t.horasUteis
    else if (t.situacao === 'suspenso') {
      tempos.suspenso += t.horasUteis
      const m = t.motivo || 'Motivo não registrado'
      tempos.suspensoPorMotivo[m] = (tempos.suspensoPorMotivo[m] || 0) + t.horasUteis
    }
  }

  return { trechos, tempos, transferencias, reaberturas, responsavelNaConclusao, concluidoEm }
}

/* Situação e responsável num instante (ex.: início ou fim do mês). */
export function retratoEm(linha: LinhaDoTempo, quando: Date): { situacao: Situacao | null; responsavel: string | null } {
  const t = quando.getTime()
  for (const tr of linha.trechos) {
    if (new Date(tr.inicio).getTime() <= t && t < new Date(tr.fim).getTime()) {
      return { situacao: tr.situacao, responsavel: tr.responsavel }
    }
  }
  /* Depois do último trecho fechado: concluído. Antes do primeiro: não existia. */
  const ultimo = linha.trechos[linha.trechos.length - 1]
  if (ultimo && t >= new Date(ultimo.fim).getTime() && linha.concluidoEm) {
    return { situacao: 'resolvido', responsavel: linha.responsavelNaConclusao }
  }
  return { situacao: null, responsavel: null }
}

/* Percentil (0–100), interpolação linear. null se não houver valores. */
export function percentil(valores: number[], p: number) {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const pos = ((v.length - 1) * p) / 100
  const i = Math.floor(pos)
  const f = pos - i
  return i + 1 < v.length ? v[i] + (v[i + 1] - v[i]) * f : v[i]
}
