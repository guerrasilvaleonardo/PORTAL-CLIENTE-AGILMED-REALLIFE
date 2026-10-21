/*
 * Prazo em HORAS ÚTEIS.
 *
 * A jornada é de 8 horas por dia, de segunda a sexta: das 08h às 12h
 * e das 13h às 17h, no horário de Porto Velho (RO). Fim de semana, madrugada
 * e horário de almoço não entram na conta — um chamado aberto na
 * sexta às 16h com prazo de 4 horas úteis vence na segunda às 11h,
 * e não no sábado de madrugada.
 *
 * Feriados cadastrados (tabela public.feriados) também não contam.
 * As telas chamam carregarFeriados() (lib/feriados.ts) antes de
 * calcular; sem isso a conta segue só com fim de semana.
 */

/*
 * Fuso fixo do expediente: Porto Velho (UTC-4 o ano todo, sem horário
 * de verão). Deve ser o mesmo das funções horas_uteis_entre e
 * somar_horas_uteis do banco (America/Porto_Velho).
 */
const FUSO_MINUTOS = -240 // America/Porto_Velho (UTC-4)

const MANHA_INICIO = 8 * 60
const MANHA_FIM = 12 * 60
const TARDE_INICIO = 13 * 60
const TARDE_FIM = 17 * 60

export const HORAS_UTEIS_POR_DIA = 8

/* Horas úteis de cada prioridade. */
export const HORAS_SLA: Record<string, number> = {
  baixa: 48,
  normal: 24,
  alta: 8,
  urgente: 4,
}

/* Rótulo para exibir junto de cada prioridade. */
export function rotuloPrazo(prioridade: string) {
  const horas = HORAS_SLA[prioridade] ?? HORAS_SLA.normal
  const dias = horas / HORAS_UTEIS_POR_DIA

  if (dias >= 1) {
    return (
      'Prazo de ' +
      horas +
      ' horas úteis (' +
      dias +
      (dias === 1 ? ' dia útil)' : ' dias úteis)')
    )
  }

  return 'Prazo de ' + horas + ' horas úteis'
}

/* Converte um instante real para o relógio do expediente e de volta. */
function paraLocal(data: Date) {
  return new Date(data.getTime() + FUSO_MINUTOS * 60000)
}

function paraReal(local: Date) {
  return new Date(local.getTime() - FUSO_MINUTOS * 60000)
}

function minutosDoDia(local: Date) {
  return local.getUTCHours() * 60 + local.getUTCMinutes()
}

/* Datas (AAAA-MM-DD, no relógio do expediente) que não contam hora útil. */
let feriados = new Set<string>()

export function definirFeriados(datas: string[]) {
  feriados = new Set(datas.map((d) => String(d).slice(0, 10)))
}

export function ehFeriado(data: string) {
  return feriados.has(String(data).slice(0, 10))
}

function ehDiaUtil(local: Date) {
  const d = local.getUTCDay()

  if (d < 1 || d > 5) return false

  return !feriados.has(local.toISOString().slice(0, 10))
}

function comMinutos(local: Date, minutos: number) {
  const novo = new Date(local.getTime())

  novo.setUTCHours(0, 0, 0, 0)

  return new Date(novo.getTime() + minutos * 60000)
}

function proximoDia(local: Date) {
  const novo = comMinutos(local, MANHA_INICIO)

  return new Date(novo.getTime() + 86400000)
}

/*
 * Move o relógio para o próximo instante dentro do expediente.
 * Se já estiver dentro, devolve como está.
 */
function dentroDoExpediente(local: Date) {
  let atual = local

  for (let voltas = 0; voltas < 400; voltas++) {
    if (!ehDiaUtil(atual)) {
      atual = proximoDia(atual)
      continue
    }

    const m = minutosDoDia(atual)

    if (m < MANHA_INICIO) return comMinutos(atual, MANHA_INICIO)
    if (m < MANHA_FIM) return atual
    if (m < TARDE_INICIO) return comMinutos(atual, TARDE_INICIO)
    if (m < TARDE_FIM) return atual

    atual = proximoDia(atual)
  }

  return atual
}

function fimDoBloco(local: Date) {
  return minutosDoDia(local) < MANHA_FIM ? MANHA_FIM : TARDE_FIM
}

/*
 * Data em que o prazo vence, somando apenas horas úteis a partir de
 * um instante qualquer.
 */
export function prazoEmHorasUteis(horasUteis: number, inicio?: Date) {
  let restante = Math.max(0, horasUteis) * 3600000
  let atual = dentroDoExpediente(paraLocal(inicio || new Date()))

  for (let voltas = 0; voltas < 2000 && restante > 0; voltas++) {
    const fim = comMinutos(atual, fimDoBloco(atual))
    const disponivel = fim.getTime() - atual.getTime()

    if (restante <= disponivel) {
      atual = new Date(atual.getTime() + restante)
      restante = 0
      break
    }

    restante -= disponivel
    atual = dentroDoExpediente(new Date(fim.getTime() + 60000))
  }

  return paraReal(atual)
}

/*
 * Novo prazo ao trocar a prioridade. Mantém as extensões que o prazo
 * já recebeu (pausas em "Aguardando cliente", feriados) e só soma ou
 * tira a diferença entre o SLA da prioridade nova e o da antiga.
 * Sem prazo anterior, conta do zero a partir da abertura.
 */
export function prazoAoTrocarPrioridade(
  abertura: Date,
  prazoAtual: string | null,
  prioridadeAntiga: string,
  prioridadeNova: string
) {
  const novo = HORAS_SLA[prioridadeNova] ?? HORAS_SLA.normal

  if (!prazoAtual) return prazoEmHorasUteis(novo, abertura)

  const antigo = HORAS_SLA[prioridadeAntiga] ?? HORAS_SLA.normal
  const orcamento = horasUteisEntre(abertura, new Date(prazoAtual))

  return prazoEmHorasUteis(Math.max(0, orcamento + novo - antigo), abertura)
}

/*
 * Quantas horas úteis existem entre dois instantes. Negativo quando
 * o segundo é anterior ao primeiro.
 */
export function horasUteisEntre(de: Date, ate: Date) {
  if (ate.getTime() === de.getTime()) return 0

  const invertido = ate.getTime() < de.getTime()
  const inicio = paraLocal(invertido ? ate : de)
  const fim = paraLocal(invertido ? de : ate)

  let atual = dentroDoExpediente(inicio)
  let total = 0

  for (let voltas = 0; voltas < 4000; voltas++) {
    if (atual.getTime() >= fim.getTime()) break

    const limite = comMinutos(atual, fimDoBloco(atual))
    const parada = Math.min(limite.getTime(), fim.getTime())

    total += parada - atual.getTime()

    if (parada >= fim.getTime()) break

    atual = dentroDoExpediente(new Date(limite.getTime() + 60000))
  }

  const horas = total / 3600000

  return invertido ? -horas : horas
}

/* Horas úteis que faltam (ou passaram) até um prazo já gravado. */
export function horasUteisAte(prazo: string | null, agora?: Date) {
  if (!prazo) return null

  return horasUteisEntre(agora || new Date(), new Date(prazo))
}

/* Texto curto do prazo, em horas ou dias úteis. */
export function textoPrazoUtil(prazo: string | null) {
  const h = horasUteisAte(prazo)

  if (h === null) return { texto: 'sem SLA', atrasado: false }

  const arredondado = Math.round(h)

  if (arredondado < 0) {
    const atraso = Math.abs(arredondado)

    return {
      texto:
        atraso >= HORAS_UTEIS_POR_DIA
          ? Math.round(atraso / HORAS_UTEIS_POR_DIA) + 'd úteis em atraso'
          : atraso + 'h úteis em atraso',
      atrasado: true,
    }
  }

  if (arredondado < HORAS_UTEIS_POR_DIA) {
    return { texto: arredondado + 'h úteis restantes', atrasado: false }
  }

  return {
    texto:
      Math.round(arredondado / HORAS_UTEIS_POR_DIA) + 'd úteis restantes',
    atrasado: false,
  }
}

/* Duração em horas úteis como texto curto: "5h úteis", "2d úteis". */
export function duracaoUtil(horas: number) {
  const h = Math.abs(Math.round(horas))

  return h >= HORAS_UTEIS_POR_DIA
    ? Math.round(h / HORAS_UTEIS_POR_DIA) + 'd úteis'
    : h + 'h úteis'
}

export type ChaveSla =
  | 'atrasado'
  | 'vence_em_breve'
  | 'no_prazo'
  | 'pausado'
  | 'sem_sla'
  | 'cumprido'
  | 'descumprido'
  | 'concluido'

export type ChamadoComSla = {
  status: string
  prazo_sla: string | null
  sla_pausado_em?: string | null
  /* Início da suspensão do atendimento (status 'suspenso'). */
  suspenso_em?: string | null
  resolvido_em?: string | null
  encerrado_em?: string | null
}

/* A partir de quantas horas úteis restantes o chamado "vence em breve". */
export const VENCE_EM_BREVE_HORAS = 4

/*
 * Padrão da antecedência do alerta amarelo "Próximo do prazo". O valor
 * em uso é configurado pelo gestor no programa de estrelas
 * (estrelas_config.alerta_prazo_horas).
 */
export const ALERTA_ATRASO_HORAS = 1

/* Chamado em aberto que vence dentro da antecedência do alerta (e ainda não atrasou). */
export function prestesAAtrasar(
  s: { chave: ChaveSla; horas: number | null },
  limiteHoras: number = ALERTA_ATRASO_HORAS
) {
  return (
    (s.chave === 'vence_em_breve' || s.chave === 'no_prazo') &&
    s.horas !== null &&
    s.horas <= limiteHoras
  )
}

/*
 * Situação do SLA levando em conta o status do chamado:
 * - resolvido/encerrado: o relógio para na data de resolução, e o
 *   cartão diz se foi resolvido no prazo ou fora dele;
 * - aguardando cliente: o relógio está pausado, então vale o saldo que
 *   havia no momento da pausa (o banco estende o prazo na retomada);
 * - cancelado: fora do SLA;
 * - demais: horas úteis que faltam ou que passaram até o prazo.
 */
export function situacaoSla(c: ChamadoComSla): {
  chave: ChaveSla
  texto: string
  atrasado: boolean
  horas: number | null
} {
  /* Cancelado: fica fora do SLA (não conta como no prazo nem atrasado). */
  if (c.status === 'cancelado') {
    return { chave: 'sem_sla', texto: 'Cancelado · fora do SLA', atrasado: false, horas: null }
  }

  if (!c.prazo_sla) {
    return { chave: 'sem_sla', texto: 'sem SLA', atrasado: false, horas: null }
  }

  const prazo = new Date(c.prazo_sla)

  if (c.status === 'resolvido' || c.status === 'encerrado') {
    const fim = c.resolvido_em || c.encerrado_em

    if (!fim) {
      return { chave: 'concluido', texto: 'Concluído', atrasado: false, horas: null }
    }

    const h = horasUteisEntre(new Date(fim), prazo)

    return h >= 0
      ? { chave: 'cumprido', texto: 'Resolvido no prazo', atrasado: false, horas: h }
      : {
          chave: 'descumprido',
          texto: 'Resolvido com ' + duracaoUtil(h) + ' de atraso',
          atrasado: false,
          horas: h,
        }
  }

  /* Atendimento suspenso: o prazo também fica pausado (estendido na retomada). */
  if (c.status === 'suspenso') {
    if (!c.suspenso_em) {
      return { chave: 'pausado', texto: 'SLA pausado (suspenso)', atrasado: false, horas: null }
    }

    const h = horasUteisEntre(new Date(c.suspenso_em), prazo)

    return {
      chave: 'pausado',
      texto: 'SLA pausado (suspenso) · ' + duracaoUtil(h) + (h < 0 ? ' em atraso' : ' restantes'),
      atrasado: false,
      horas: h,
    }
  }

  if (c.status === 'aguardando_cliente' && !c.sla_pausado_em) {
    /* Pausado sem registro do início da pausa: não conta horas. */
    return { chave: 'pausado', texto: 'SLA pausado', atrasado: false, horas: null }
  }

  if (c.status === 'aguardando_cliente' && c.sla_pausado_em) {
    const h = horasUteisEntre(new Date(c.sla_pausado_em), prazo)

    return {
      chave: 'pausado',
      texto:
        'SLA pausado · ' +
        duracaoUtil(h) +
        (h < 0 ? ' em atraso' : ' restantes'),
      atrasado: false,
      horas: h,
    }
  }

  const h = horasUteisAte(c.prazo_sla) as number

  if (Math.round(h) < 0) {
    return { chave: 'atrasado', texto: duracaoUtil(h) + ' em atraso', atrasado: true, horas: h }
  }

  return {
    chave: h <= VENCE_EM_BREVE_HORAS ? 'vence_em_breve' : 'no_prazo',
    texto: duracaoUtil(h) + ' restantes',
    atrasado: false,
    horas: h,
  }
}
