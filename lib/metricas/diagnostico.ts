/*
 * Diagnóstico detalhado do mês (pessoa ou equipe), calculado a partir da
 * linha do tempo de cada chamado (lib/metricas/linhaTempo.ts).
 *
 * Regras (ver também lib/metricas/dicionario.ts):
 * - Entrega conta para QUEM CONCLUIU (responsável no momento da última
 *   conclusão), decidido pela direção em 29/10/2026.
 * - Pendências no início e no fim: retrato da linha do tempo naquele
 *   instante (situação em aberto + responsável naquele momento).
 * - Tempos em horas úteis (seg–sex 8–12/13–17, Porto Velho, sem feriados).
 *   Resolução = fila + atendimento (sem pausas). Experiência do cliente =
 *   tempo corrido total, com as pausas, para não esconder a espera.
 * - Consolidado sempre por numerador/denominador, nunca média de %.
 * - Amostra pequena: o número aparece, mas é marcado.
 */

import { horasUteisAte, horasUteisEntre, situacaoSla } from '@/lib/prazo'
import { percentil, retratoEm, SITUACOES_CONCLUIDAS, nomeOuNulo, type EventoLinha, type LinhaDoTempo, type Situacao } from '@/lib/metricas/linhaTempo'

export const VERSAO_METRICAS = 1

/* Pausa a partir deste tamanho (horas úteis) é listada para verificação. */
export const PAUSA_LONGA_HORAS = 16

export type ChamadoDiag = {
  id: string
  numero: number | null
  categoria: string | null
  prioridade: string
  status: string
  prazo_sla: string | null
  sla_pausado_em: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  created_at: string
  empresa: string
  interno: boolean
  responsavelNome: string | null
  linha: LinhaDoTempo
  eventos: EventoLinha[]
}

export type Distribuicao = { mediana: number | null; p90: number | null; amostra: number }

export type Diagnostico = {
  pendentesInicio: number
  pendentesFim: number
  assumidos: number
  transferenciasRecebidas: number
  transferenciasEnviadas: number
  concluidos: number
  reaberturas: number
  primeiraResposta: Distribuicao
  resolucao: Distribuicao
  experienciaClienteDias: Distribuicao
  tempos: {
    fila: number
    atendimento: number
    aguardandoCliente: number
    suspenso: number
    suspensoPorMotivo: { motivo: string; horas: number }[]
    amostra: number
  }
  pendencias: {
    total: number
    idadeMedianaDias: number | null
    idadeMaxDias: number | null
    acima30Dias: number
    vencidas: number
    vencemEm1DiaUtil: number
  }
  porPrioridade: { prioridade: string; concluidos: number; slaAvaliados: number; slaCumpridos: number }[]
  porCliente: { cliente: string; concluidos: number }[]
  avaliacao: { respostas: number; elegiveis: number; participacaoPct: number | null }
  pausasLongas: { numero: number | null; motivo: string; horasUteis: number }[]
  filaSemResponsavel: Distribuicao
}

const ABERTAS: Situacao[] = ['fila', 'atendimento', 'aguardando_cliente', 'suspenso']

function dentro(data: string | null | undefined, ini: Date, fim: Date) {
  if (!data) return false
  const t = new Date(data).getTime()
  return t >= ini.getTime() && t < fim.getTime()
}

function dist(valores: number[]): Distribuicao {
  const med = percentil(valores, 50)
  const p90 = percentil(valores, 90)
  const r = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10)
  return { mediana: r(med), p90: r(p90), amostra: valores.length }
}

const arred = (x: number) => Math.round(x * 10) / 10

/*
 * `pessoa`: nome da pessoa (como gravado nos eventos) ou null = equipe.
 * `notas`: avaliações do período (chamado_id + data).
 */
export function diagnosticar({
  chamados,
  ini,
  fim,
  pessoa,
  primeiraResposta,
  notas,
  agora,
}: {
  chamados: ChamadoDiag[]
  ini: Date
  fim: Date
  pessoa: string | null
  primeiraResposta: Record<string, string>
  notas: { chamado_id: string; created_at: string }[]
  agora: Date
}): Diagnostico {
  const ehDela = (nome: string | null | undefined) => (pessoa === null ? true : nomeOuNulo(nome) === pessoa)
  const umMs = new Date(fim.getTime() - 1)

  let pendentesInicio = 0
  let pendentesFim = 0
  let assumidos = 0
  let transfRec = 0
  let transfEnv = 0
  let concluidos = 0
  let reaberturas = 0
  const respostas: number[] = []
  const resolucoes: number[] = []
  const experiencia: number[] = []
  const filas: number[] = []
  const tempos = { fila: 0, atendimento: 0, aguardandoCliente: 0, suspenso: 0, amostra: 0 }
  const porMotivo = new Map<string, number>()
  const idades: number[] = []
  let vencidas = 0
  let vencem = 0
  let acima30 = 0
  const prio = new Map<string, { prioridade: string; concluidos: number; slaAvaliados: number; slaCumpridos: number }>()
  const cli = new Map<string, number>()
  const concluidosIds = new Set<string>()
  let elegiveis = 0
  const pausasLongas: Diagnostico['pausasLongas'] = []

  for (const c of chamados) {
    const L = c.linha

    /* Pendências no início e no fim. */
    const rIni = retratoEm(L, ini)
    if (rIni.situacao && ABERTAS.includes(rIni.situacao) && ehDela(rIni.responsavel)) pendentesInicio++
    const rFim = retratoEm(L, umMs)
    if (rFim.situacao && ABERTAS.includes(rFim.situacao) && (pessoa === null || rFim.responsavel === pessoa)) {
      pendentesFim++
      const idadeDias = (Math.min(umMs.getTime(), agora.getTime()) - new Date(c.created_at).getTime()) / 86400000
      idades.push(idadeDias)
      if (idadeDias > 30) acima30++
      if (c.prazo_sla && rFim.situacao !== 'aguardando_cliente' && rFim.situacao !== 'suspenso') {
        const restante = horasUteisAte(c.prazo_sla, umMs.getTime() < agora.getTime() ? umMs : agora)
        if (restante !== null && restante < 0) vencidas++
        else if (restante !== null && restante <= 8) vencem++
      }
    }

    /* Assumidos: trechos que começam no mês com a pessoa como responsável,
       vindos de outro responsável ou da fila (ou o chamado nasceu com ela). */
    if (pessoa !== null) {
      let anterior: string | null | undefined = undefined
      let contou = false
      for (const t of L.trechos) {
        const muda = t.responsavel === pessoa && anterior !== pessoa
        if (muda && dentro(t.inicio, ini, fim) && !contou) {
          assumidos++
          contou = true
        }
        anterior = t.responsavel
      }
    } else if (dentro(c.created_at, ini, fim)) {
      assumidos += L.trechos.some((t) => t.responsavel) ? 1 : 0
    }

    /* Transferências registradas no mês. */
    for (const e of c.eventos) {
      if (e.tipo !== 'responsavel' || !dentro(e.created_at, ini, fim)) continue
      const de = nomeOuNulo(e.de)
      const para = nomeOuNulo(e.para)
      if (!de || !para || de === para) continue
      if (pessoa === null) {
        transfRec++
      } else {
        if (para === pessoa) transfRec++
        if (de === pessoa) transfEnv++
      }
    }
    if (pessoa === null) transfEnv = transfRec

    /* Reaberturas registradas no mês (do chamado da pessoa no momento). */
    for (const e of c.eventos) {
      if (e.tipo !== 'status' || !dentro(e.created_at, ini, fim)) continue
      const voltou = (e.de === 'resolvido' || e.de === 'encerrado') && e.para && !SITUACOES_CONCLUIDAS.includes(e.para as Situacao)
      if (!voltou) continue
      const r = retratoEm(L, new Date(e.created_at))
      if (pessoa === null || r.responsavel === pessoa || L.responsavelNaConclusao === pessoa) reaberturas++
    }

    /* Primeira resposta: recebidos no mês, do responsável atual. */
    if (dentro(c.created_at, ini, fim) && (pessoa === null || nomeOuNulo(c.responsavelNome) === pessoa)) {
      const resp = primeiraResposta[c.id]
      if (resp) {
        respostas.push(Math.max(0, horasUteisEntre(new Date(c.created_at), new Date(resp))))
      }
    }

    /* Concluídos no mês por quem concluiu. */
    if (L.concluidoEm && dentro(L.concluidoEm, ini, fim) && !c.status.startsWith('cancel') && (pessoa === null || L.responsavelNaConclusao === pessoa)) {
      concluidos++
      concluidosIds.add(c.id)
      resolucoes.push(L.tempos.fila + L.tempos.atendimento)
      experiencia.push(L.tempos.corridoH / 24)
      filas.push(L.tempos.fila)
      tempos.fila += L.tempos.fila
      tempos.atendimento += L.tempos.atendimento
      tempos.aguardandoCliente += L.tempos.aguardandoCliente
      tempos.suspenso += L.tempos.suspenso
      tempos.amostra++
      for (const [m, h] of Object.entries(L.tempos.suspensoPorMotivo)) porMotivo.set(m, (porMotivo.get(m) || 0) + h)

      const p = prio.get(c.prioridade) || { prioridade: c.prioridade, concluidos: 0, slaAvaliados: 0, slaCumpridos: 0 }
      p.concluidos++
      if (c.prazo_sla) {
        const s = situacaoSla(c as any).chave
        if (s === 'cumprido' || s === 'descumprido') {
          p.slaAvaliados++
          if (s === 'cumprido') p.slaCumpridos++
        }
      }
      prio.set(c.prioridade, p)
      cli.set(c.empresa, (cli.get(c.empresa) || 0) + 1)
      if (!c.interno) elegiveis++

      for (const t of L.trechos) {
        if (t.situacao === 'suspenso' && t.horasUteis >= PAUSA_LONGA_HORAS) {
          pausasLongas.push({ numero: c.numero, motivo: t.motivo || 'Motivo não registrado', horasUteis: arred(t.horasUteis) })
        }
      }
    }
  }

  const respostasAval = notas.filter((n) => concluidosIds.has(n.chamado_id)).length
  const ordemPrio = ['urgente', 'alta', 'normal', 'baixa']

  return {
    pendentesInicio,
    pendentesFim,
    assumidos,
    transferenciasRecebidas: transfRec,
    transferenciasEnviadas: transfEnv,
    concluidos,
    reaberturas,
    primeiraResposta: dist(respostas),
    resolucao: dist(resolucoes),
    experienciaClienteDias: dist(experiencia),
    filaSemResponsavel: dist(filas),
    tempos: {
      fila: arred(tempos.fila),
      atendimento: arred(tempos.atendimento),
      aguardandoCliente: arred(tempos.aguardandoCliente),
      suspenso: arred(tempos.suspenso),
      suspensoPorMotivo: [...porMotivo.entries()].map(([motivo, h]) => ({ motivo, horas: arred(h) })).sort((a, b) => b.horas - a.horas),
      amostra: tempos.amostra,
    },
    pendencias: {
      total: pendentesFim,
      idadeMedianaDias: dist(idades).mediana,
      idadeMaxDias: idades.length ? arred(Math.max(...idades)) : null,
      acima30Dias: acima30,
      vencidas,
      vencemEm1DiaUtil: vencem,
    },
    porPrioridade: [...prio.values()].sort((a, b) => ordemPrio.indexOf(a.prioridade) - ordemPrio.indexOf(b.prioridade)),
    porCliente: [...cli.entries()].map(([cliente, n]) => ({ cliente, concluidos: n })).sort((a, b) => b.concluidos - a.concluidos).slice(0, 8),
    avaliacao: {
      respostas: respostasAval,
      elegiveis,
      participacaoPct: elegiveis > 0 ? Math.round((100 * respostasAval) / elegiveis) : null,
    },
    pausasLongas: pausasLongas.sort((a, b) => b.horasUteis - a.horasUteis).slice(0, 10),
  }
}
