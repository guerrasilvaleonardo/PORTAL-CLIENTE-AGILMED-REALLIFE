/*
 * Relatório mensal de desempenho — coleta dos dados (só no servidor,
 * com a chave de serviço) e gravação no banco.
 *
 * Os números saem das mesmas regras da tela "Desempenho da equipe"
 * (lib/desempenho.ts). Cada fonte extra (avaliações, estrelas, prazos,
 * cancelamentos, mensagens) é tolerante: se a tabela não existir, o
 * relatório sai sem ela e registra a limitação.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  STATUS_EM_ABERTO,
  calcularIndicadores,
  dataConclusao,
  foiReaberto,
  type ChamadoBase,
  type EventoStatus,
} from '@/lib/desempenho'
import { carregarFeriados } from '@/lib/feriados'
import { situacaoSla } from '@/lib/prazo'
import {
  VERSAO_REGRAS,
  achadosDaPessoa,
  medianaDe,
  pct,
  type DadosRelatorio,
  type Evidencia,
  type FichaPessoa,
  type IndicadoresMes,
  type LinhaCategoria,
  type Medianas,
} from '@/lib/relatorioDesempenho'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const LOTE = 100
const PAGINA = 1000
const FUSO = -4 * 3600000 // Porto Velho, UTC-4 o ano todo

function partes<T>(lista: T[], n: number) {
  const r: T[][] = []
  for (let i = 0; i < lista.length; i += n) r.push(lista.slice(i, i + n))
  return r
}

async function buscarTudo<T>(montar: () => any): Promise<T[]> {
  const tudo: T[] = []
  for (let de = 0; de < 200000; de += PAGINA) {
    const { data, error } = await montar().range(de, de + PAGINA - 1)
    if (error) throw error
    tudo.push(...((data || []) as T[]))
    if (!data || data.length < PAGINA) break
  }
  return tudo
}

/* Limites de um mês no calendário de Porto Velho. `fim` é exclusivo. */
export function limitesDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const ini = new Date(Date.UTC(a, m - 1, 1) - FUSO)
  const fim = new Date(Date.UTC(a, m, 1) - FUSO)
  const iniAnt = new Date(Date.UTC(a, m - 2, 1) - FUSO)
  return { ini, fim, iniAnt, fimAnt: ini }
}

/* 'AAAA-MM' do mês anterior ao de hoje (Porto Velho). */
export function mesAnteriorAoAtual(agora = new Date()) {
  const local = new Date(agora.getTime() + FUSO)
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1))
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
}

export function mesAtual(agora = new Date()) {
  const local = new Date(agora.getTime() + FUSO)
  return local.getUTCFullYear() + '-' + String(local.getUTCMonth() + 1).padStart(2, '0')
}

export function mesValido(mes: unknown): mes is string {
  return typeof mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && mes >= '2024-01' && mes <= mesAtual()
}

function dentro(data: string | null | undefined, ini: Date, fim: Date) {
  if (!data) return false
  const t = new Date(data).getTime()
  return t >= ini.getTime() && t < fim.getTime()
}

type Extras = {
  notas: { chamado_id: string; nota: number; created_at: string }[] | null
  estrelas: { atendente_id: string; resolvido_em: string; estrelas_prazo: number; estrelas_avaliacao: number; situacao: string }[] | null
  prazos: { chamado_id: string; alterado_por: string | null; alterado_em: string; autorizado: boolean | null }[] | null
  cancel: { chamado_id: string; motivo: string; cancelado_em: string; revertido_em: string | null }[] | null
}

function extrasDoMes(
  chamados: ChamadoBase[],
  porId: Map<string, ChamadoBase>,
  base: ReturnType<typeof calcularIndicadores>,
  ex: Extras,
  ini: Date,
  fim: Date,
  pessoaId: string | null,
  mensagens: number | null
): IndicadoresMes {
  const ids = new Set(chamados.map((c) => c.id))
  const notas = { ruim: 0, bom: 0, excelente: 0 }
  for (const n of ex.notas || []) {
    if (!ids.has(n.chamado_id) || !dentro(n.created_at, ini, fim)) continue
    if (n.nota === 1) notas.ruim++
    else if (n.nota === 2) notas.bom++
    else if (n.nota === 3) notas.excelente++
  }

  const estrelas = { total: 0, prazo: 0, avaliacao: 0, suspensas: 0, estornadas: 0 }
  for (const l of ex.estrelas || []) {
    if (pessoaId && l.atendente_id !== pessoaId) continue
    if (!dentro(l.resolvido_em, ini, fim)) continue
    if (l.situacao === 'valida') {
      estrelas.prazo += l.estrelas_prazo || 0
      estrelas.avaliacao += l.estrelas_avaliacao || 0
    } else if (l.situacao === 'suspensa') estrelas.suspensas++
    else if (l.situacao === 'estornada') estrelas.estornadas++
  }
  estrelas.total = estrelas.prazo + estrelas.avaliacao

  const prazoAlteracoes = { total: 0, negadas: 0, pendentes: 0 }
  for (const p of ex.prazos || []) {
    if (!dentro(p.alterado_em, ini, fim)) continue
    if (pessoaId ? p.alterado_por !== pessoaId : !porId.has(p.chamado_id)) continue
    prazoAlteracoes.total++
    if (p.autorizado === false) prazoAlteracoes.negadas++
    if (p.autorizado === null) prazoAlteracoes.pendentes++
  }

  let cancelados = 0
  for (const c of ex.cancel || []) {
    if (c.revertido_em || !ids.has(c.chamado_id) || !dentro(c.cancelado_em, ini, fim)) continue
    cancelados++
  }

  return {
    ...base,
    slaPct: pct(base.slaCumpridos, base.slaAvaliados),
    reaberturaPct: pct(base.reabertos, base.concluidos),
    notas,
    estrelas,
    cancelados,
    prazoAlteracoes,
    mensagens,
  }
}

function porCategoria(chamados: ChamadoBase[], ini: Date, fim: Date): LinhaCategoria[] {
  const m = new Map<string, LinhaCategoria>()
  for (const c of chamados) {
    const d = dataConclusao(c)
    if (!d || !dentro(d, ini, fim)) continue
    const k = c.categoria || 'Sem área'
    const l = m.get(k) || { categoria: k, concluidos: 0, slaAvaliados: 0, slaCumpridos: 0 }
    l.concluidos++
    if (c.prazo_sla) {
      const s = situacaoSla(c).chave
      if (s === 'cumprido' || s === 'descumprido') {
        l.slaAvaliados++
        if (s === 'cumprido') l.slaCumpridos++
      }
    }
    m.set(k, l)
  }
  return [...m.values()].sort((a, b) => b.concluidos - a.concluidos)
}

/*
 * Monta os dados congelados do relatório de um mês.
 */
export async function coletarDadosRelatorio(db: SupabaseClient, mes: string, agora = new Date()): Promise<DadosRelatorio> {
  const { ini, fim: fimMes, iniAnt, fimAnt } = limitesDoMes(mes)
  const parcial = agora.getTime() < fimMes.getTime()
  const fim = parcial ? agora : fimMes
  const limitacoes: string[] = []
  const fontes: string[] = [
    'Chamados (abertura, conclusão, prazo, prioridade, área e responsável atual)',
    'Histórico de situação dos chamados (pausas e reaberturas)',
    'Mensagens dos chamados (primeira resposta da equipe)',
  ]

  await carregarFeriados(db, true)

  const { data: pessoasData, error: pessoasErro } = await db
    .from('profiles')
    .select('id, nome, perfil, ativo')
    .in('perfil', PERFIS_INTERNOS)
    .order('nome')
  if (pessoasErro) throw pessoasErro

  const pessoas = (pessoasData || []) as { id: string; nome: string | null; perfil: string; ativo: boolean | null }[]
  const idsInternos = new Set(pessoas.map((p) => p.id))

  const desde = iniAnt.toISOString()
  const brutos = await buscarTudo<any>(() =>
    db
      .from('chamados')
      .select(
        'id, numero, assunto, categoria, prioridade, status, responsavel_id, prazo_sla, sla_pausado_em, resolvido_em, encerrado_em, created_at, empresas(marca, nome_fantasia, razao_social, interna)'
      )
      .or(`created_at.gte.${desde},resolvido_em.gte.${desde},encerrado_em.gte.${desde},status.in.(${STATUS_EM_ABERTO.join(',')})`)
      .order('created_at')
  )

  const chamados: ChamadoBase[] = brutos.map((c) => {
    const emp = Array.isArray(c.empresas) ? c.empresas[0] : c.empresas
    return {
      id: c.id,
      numero: c.numero,
      assunto: c.assunto || '',
      categoria: c.categoria,
      prioridade: c.prioridade,
      status: c.status,
      responsavel_id: c.responsavel_id,
      prazo_sla: c.prazo_sla,
      sla_pausado_em: c.sla_pausado_em,
      resolvido_em: c.resolvido_em,
      encerrado_em: c.encerrado_em,
      created_at: c.created_at,
      marca: emp?.marca || null,
      interno: !!emp?.interna,
      empresa: emp?.nome_fantasia || emp?.razao_social || 'Empresa',
    }
  })
  const porId = new Map(chamados.map((c) => [c.id, c]))

  /* Histórico de status dos concluídos nos dois meses. */
  const idsConcluidos = chamados.filter((c) => dentro(dataConclusao(c), iniAnt, fim)).map((c) => c.id)
  const eventos: Record<string, EventoStatus[]> = {}
  for (const lote of partes(idsConcluidos, LOTE)) {
    const evs = await buscarTudo<EventoStatus>(() =>
      db.from('chamado_eventos').select('chamado_id, de, para, created_at').eq('tipo', 'status').in('chamado_id', lote).order('created_at')
    )
    for (const e of evs) (eventos[e.chamado_id] ||= []).push(e)
  }

  /* Primeira mensagem humana da equipe nos recebidos dos dois meses. */
  const idsRecebidos = chamados.filter((c) => dentro(c.created_at, iniAnt, fim)).map((c) => c.id)
  const primeira: Record<string, string> = {}
  for (const lote of partes(idsRecebidos, LOTE)) {
    let msgs: any[]
    try {
      msgs = await buscarTudo<any>(() =>
        db.from('chamado_mensagens').select('chamado_id, autor_id, automatica, created_at').in('chamado_id', lote).order('created_at')
      )
    } catch {
      msgs = await buscarTudo<any>(() =>
        db.from('chamado_mensagens').select('chamado_id, autor_id, created_at').in('chamado_id', lote).order('created_at')
      )
    }
    for (const m of msgs) {
      if (m.automatica || !m.autor_id || !idsInternos.has(m.autor_id)) continue
      if (!primeira[m.chamado_id]) primeira[m.chamado_id] = m.created_at
    }
  }

  /* % de etapas da carteira aberta. */
  const etapas: Record<string, number> = {}
  for (const lote of partes(chamados.filter((c) => STATUS_EM_ABERTO.includes(c.status)).map((c) => c.id), LOTE)) {
    const { data, error } = await db.from('v_chamados_progresso').select('chamado_id, percentual').in('chamado_id', lote)
    if (error) break
    for (const p of (data || []) as any[]) etapas[p.chamado_id] = Number(p.percentual) || 0
  }

  /* Fontes extras, cada uma tolerante. */
  const ex: Extras = { notas: null, estrelas: null, prazos: null, cancel: null }
  try {
    ex.notas = await buscarTudo<any>(() => db.from('chamado_avaliacoes').select('chamado_id, nota, created_at').gte('created_at', desde))
    fontes.push('Avaliações dos clientes (Ruim, Bom, Excelente)')
  } catch {
    limitacoes.push('Avaliações dos clientes indisponíveis neste relatório.')
  }
  try {
    ex.estrelas = await buscarTudo<any>(() =>
      db.from('estrelas_lancamentos').select('atendente_id, resolvido_em, estrelas_prazo, estrelas_avaliacao, situacao').gte('resolvido_em', desde)
    )
    fontes.push('Programa Estrelas (lançamentos do mês)')
  } catch {
    limitacoes.push('Programa Estrelas indisponível neste relatório.')
  }
  try {
    ex.prazos = await buscarTudo<any>(() =>
      db.from('estrelas_prazo_alteracoes').select('chamado_id, alterado_por, alterado_em, autorizado').gte('alterado_em', desde)
    )
    fontes.push('Alterações de prazo e decisões da gestão')
  } catch {
    limitacoes.push('Alterações de prazo indisponíveis neste relatório.')
  }
  try {
    ex.cancel = await buscarTudo<any>(() =>
      db.from('chamado_cancelamentos').select('chamado_id, motivo, cancelado_em, revertido_em').gte('cancelado_em', desde)
    )
    fontes.push('Cancelamentos de chamados e motivos')
  } catch {
    limitacoes.push('Cancelamentos indisponíveis neste relatório.')
  }

  const calc = (lista: ChamadoBase[], i: Date, f: Date) =>
    calcularIndicadores({ chamados: lista, ini: i, fim: f, eventosPorChamado: eventos, primeiraRespostaPorChamado: primeira, etapasPorChamado: etapas })

  /* Mensagens escritas por pessoa no mês (interação com o cliente). */
  const mensagensDe = async (id: string) => {
    const { count, error } = await db
      .from('chamado_mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('autor_id', id)
      .gte('created_at', ini.toISOString())
      .lt('created_at', fim.toISOString())
    return error ? null : count ?? 0
  }

  const porPessoa: Record<string, ChamadoBase[]> = {}
  for (const c of chamados) if (c.responsavel_id) (porPessoa[c.responsavel_id] ||= []).push(c)

  const fichasBase: Omit<FichaPessoa, 'achados' | 'amostraPequena'>[] = []
  for (const p of pessoas) {
    const lista = porPessoa[p.id] || []
    const baseAtual = calc(lista, ini, fim)
    const baseAnt = calc(lista, iniAnt, fimAnt)
    const teveAlgo = baseAtual.recebidos + baseAtual.concluidos + baseAtual.carteira > 0
    if (!teveAlgo && p.ativo === false) continue
    if (!teveAlgo && baseAnt.concluidos === 0) continue

    const msgs = await mensagensDe(p.id)
    const atual = extrasDoMes(lista, porId, baseAtual, ex, ini, fim, p.id, msgs)
    const anterior = extrasDoMes(lista, porId, baseAnt, ex, iniAnt, fimAnt, p.id, null)

    /* Evidências: chamados que sustentam os números do mês. */
    const evidencias: Evidencia[] = []
    const ids = new Set(lista.map((c) => c.id))
    for (const c of lista) {
      const cat = c.categoria || 'Sem área'
      const conc = dataConclusao(c)
      if (conc && dentro(conc, ini, fim)) {
        if (c.prazo_sla) {
          const s = situacaoSla(c).chave
          if (s === 'descumprido') evidencias.push({ numero: c.numero, categoria: cat, tipo: 'sla_descumprido' })
        }
        if (foiReaberto(eventos[c.id] || [])) evidencias.push({ numero: c.numero, categoria: cat, tipo: 'reaberto' })
      }
      if (STATUS_EM_ABERTO.includes(c.status) && situacaoSla(c).chave === 'atrasado') {
        evidencias.push({ numero: c.numero, categoria: cat, tipo: 'atrasado_aberto' })
      }
    }
    for (const n of ex.notas || []) {
      if (!ids.has(n.chamado_id) || !dentro(n.created_at, ini, fim)) continue
      const c = porId.get(n.chamado_id)
      if (n.nota === 1) evidencias.push({ numero: c?.numero ?? null, categoria: c?.categoria || 'Sem área', tipo: 'nota_ruim' })
      if (n.nota === 3) evidencias.push({ numero: c?.numero ?? null, categoria: c?.categoria || 'Sem área', tipo: 'nota_excelente' })
    }
    for (const a of ex.prazos || []) {
      if (a.alterado_por !== p.id || a.autorizado !== false || !dentro(a.alterado_em, ini, fim)) continue
      const c = porId.get(a.chamado_id)
      evidencias.push({ numero: c?.numero ?? null, categoria: c?.categoria || 'Sem área', tipo: 'prazo_negado' })
    }
    for (const k of ex.cancel || []) {
      if (k.revertido_em || !ids.has(k.chamado_id) || !dentro(k.cancelado_em, ini, fim)) continue
      const c = porId.get(k.chamado_id)
      evidencias.push({ numero: c?.numero ?? null, categoria: c?.categoria || 'Sem área', tipo: 'cancelado', detalhe: k.motivo })
    }

    fichasBase.push({
      id: p.id,
      nome: p.nome || 'Sem nome',
      perfil: p.perfil,
      ativo: p.ativo !== false,
      atual,
      anterior,
      porCategoria: porCategoria(lista, ini, fim),
      evidencias,
    })
  }

  /* Medianas da equipe: só quem tem amostra suficiente em cada indicador. */
  const comAmostra = (f: (typeof fichasBase)[number]) => f.atual.concluidos >= 5
  const medianas: Medianas = {
    slaPct: medianaDe(fichasBase.filter((f) => f.atual.slaAvaliados >= 5).map((f) => f.atual.slaPct)),
    primeiraResposta: medianaDe(fichasBase.filter((f) => f.atual.primeiraRespostaAmostra >= 5).map((f) => f.atual.primeiraRespostaMediana)),
    resolucao: medianaDe(fichasBase.filter(comAmostra).map((f) => f.atual.resolucaoMediana)),
    concluidos: medianaDe(fichasBase.filter((f) => f.atual.concluidos > 0).map((f) => f.atual.concluidos)),
    reaberturaPct: medianaDe(fichasBase.filter(comAmostra).map((f) => f.atual.reaberturaPct)),
  }
  if (medianas.slaPct !== null) medianas.slaPct = Math.round(medianas.slaPct)

  const fichas: FichaPessoa[] = fichasBase.map((f) => ({ ...f, ...achadosDaPessoa(f, medianas) }))

  /* Equipe inteira (inclui chamados sem responsável). */
  const eqAtual = extrasDoMes(chamados, porId, calc(chamados, ini, fim), ex, ini, fim, null, null)
  const eqAnt = extrasDoMes(chamados, porId, calc(chamados, iniAnt, fimAnt), ex, iniAnt, fimAnt, null, null)

  const motivos = new Map<string, number>()
  for (const k of ex.cancel || []) {
    if (k.revertido_em || !dentro(k.cancelado_em, ini, fim)) continue
    motivos.set(k.motivo, (motivos.get(k.motivo) || 0) + 1)
  }

  limitacoes.push(
    'O chamado conta para o responsável ATUAL: se foi transferido, o resultado inteiro fica com quem está com ele.',
    'Tempos em horas úteis (seg–sex, 8h–12h e 13h–17h, Porto Velho), sem o tempo aguardando o cliente.',
    'A carteira (em aberto e atrasados) é o retrato do momento em que o relatório foi gerado.',
    'Os indicadores não medem complexidade técnica, qualidade de documentos entregues nem atividades fora do portal.'
  )
  if (parcial) limitacoes.unshift('Mês ainda em andamento: relatório PARCIAL, até o momento da geração.')

  return {
    versaoRegras: VERSAO_REGRAS,
    mes,
    periodo: { ini: ini.toISOString(), fim: fim.toISOString() },
    anterior: { ini: iniAnt.toISOString(), fim: fimAnt.toISOString() },
    parcial,
    equipe: {
      atual: eqAtual,
      anterior: eqAnt,
      medianas,
      porCategoria: porCategoria(chamados, ini, fim),
      cancelamentosPorMotivo: [...motivos.entries()].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total),
      pessoasAvaliadas: fichas.length,
    },
    pessoas: fichas,
    fontes,
    limitacoes,
  }
}
