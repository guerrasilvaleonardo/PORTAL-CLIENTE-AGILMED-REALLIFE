/*
 * Relatório mensal de desempenho (governança) — tipos e regras.
 *
 * Este arquivo não acessa o banco: é usado pelo gerador (servidor) e
 * pela tela. Os números vêm de lib/desempenho.ts (mesmas regras da tela
 * "Desempenho da equipe"); aqui ficam os ACHADOS (o que chama atenção,
 * sempre com o dado e os chamados que comprovam) e a análise por regras,
 * usada quando a IA não está configurada ou falha.
 *
 * Princípios (combinados com a gestão):
 * - Só conclui o que o dado mostra. Nada de diagnóstico de perfil,
 *   motivação ou personalidade.
 * - Compara a pessoa com ela mesma (mês anterior) e com a mediana da
 *   equipe, nunca com um número absoluto inventado.
 * - Amostra pequena é dita com todas as letras.
 * - É apoio à decisão da gestão, não decisão automática.
 */

import type { Indicadores } from '@/lib/desempenho'
import type { Diagnostico } from '@/lib/metricas/diagnostico'

export const VERSAO_REGRAS = 2

/* Abaixo disso o indicador é mostrado, mas não gera achado. */
export const AMOSTRA_MINIMA = 5

export type IndicadoresMes = Indicadores & {
  slaPct: number | null
  reaberturaPct: number | null
  notas: { ruim: number; bom: number; excelente: number }
  estrelas: { total: number; prazo: number; avaliacao: number; suspensas: number; estornadas: number }
  cancelados: number
  prazoAlteracoes: { total: number; negadas: number; pendentes: number }
  mensagens: number | null
}

export type TipoEvidencia =
  | 'sla_descumprido'
  | 'sla_cumprido'
  | 'reaberto'
  | 'nota_ruim'
  | 'nota_excelente'
  | 'atrasado_aberto'
  | 'prazo_negado'
  | 'cancelado'

export type Evidencia = {
  numero: number | null
  categoria: string
  tipo: TipoEvidencia
  detalhe?: string
}

export type ChaveIndicador =
  | 'sla'
  | 'primeira_resposta'
  | 'resolucao'
  | 'reabertura'
  | 'avaliacao'
  | 'atrasados'
  | 'prazo'
  | 'volume'
  | 'amostra'

export type Achado = {
  tipo: 'forte' | 'atencao' | 'info'
  indicador: ChaveIndicador
  texto: string
  /* Números dos chamados que sustentam o achado. */
  chamados: number[]
}

export type LinhaCategoria = { categoria: string; concluidos: number; slaAvaliados: number; slaCumpridos: number }

export type FichaPessoa = {
  id: string
  nome: string
  perfil: string
  ativo: boolean
  atual: IndicadoresMes
  anterior: IndicadoresMes
  porCategoria: LinhaCategoria[]
  evidencias: Evidencia[]
  achados: Achado[]
  amostraPequena: boolean
}

export type Medianas = {
  slaPct: number | null
  primeiraResposta: number | null
  resolucao: number | null
  concluidos: number | null
  reaberturaPct: number | null
}

export type DadosRelatorio = {
  versaoRegras: number
  mes: string // 'AAAA-MM'
  periodo: { ini: string; fim: string }
  anterior: { ini: string; fim: string }
  parcial: boolean
  equipe: {
    atual: IndicadoresMes
    anterior: IndicadoresMes
    medianas: Medianas
    porCategoria: LinhaCategoria[]
    cancelamentosPorMotivo: { motivo: string; total: number }[]
    pessoasAvaliadas: number
  }
  pessoas: FichaPessoa[]
  fontes: string[]
  limitacoes: string[]
  /* Diagnóstico detalhado (versão 2 das regras). Relatórios antigos não têm. */
  diagnostico?: {
    versaoMetricas: number
    equipe: { atual: Diagnostico; anterior: Diagnostico }
    pessoas: Record<string, { atual: Diagnostico; anterior: Diagnostico }>
  }
}

export type AcaoPlano = { acao: string; indicador: string; meta: string; prazo: string }

export type AnalisePessoa = {
  sintese: string
  pontos_fortes: string[]
  pontos_atencao: string[]
  plano_acao: AcaoPlano[]
  roteiro_conversa: string[]
}

export type Analise = {
  equipe: {
    sintese: string
    destaques: string[]
    riscos: string[]
    recomendacoes: string[]
  }
  pessoas: Record<string, AnalisePessoa>
}

/* ---------- Utilidades ---------- */

export function pct(parte: number, todo: number) {
  return todo > 0 ? Math.round((100 * parte) / todo) : null
}

export function horas(h: number | null) {
  if (h === null || h === undefined) return '—'
  if (h >= 8) return (h / 8).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' dia(s) úteis'
  return h.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'h úteis'
}

export function rotuloMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return (nomes[m - 1] || mes) + ' de ' + a
}

function listaChamados(ns: (number | null)[], max = 6) {
  const v = ns.filter((n): n is number => typeof n === 'number')
  if (!v.length) return ''
  const mostra = v.slice(0, max).map((n) => '#' + n).join(', ')
  return v.length > max ? mostra + ` e mais ${v.length - max}` : mostra
}

function numeros(evs: Evidencia[], tipo: TipoEvidencia) {
  return evs.filter((e) => e.tipo === tipo).map((e) => e.numero).filter((n): n is number => typeof n === 'number')
}

export function medianaDe(valores: (number | null)[]) {
  const v = valores.filter((x): x is number => typeof x === 'number').sort((a, b) => a - b)
  if (!v.length) return null
  const meio = Math.floor(v.length / 2)
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
}

/* ---------- Achados (regras) ---------- */

export function achadosDaPessoa(p: Omit<FichaPessoa, 'achados' | 'amostraPequena'>, med: Medianas): {
  achados: Achado[]
  amostraPequena: boolean
} {
  const a = p.atual
  const ant = p.anterior
  const ev = p.evidencias
  const r: Achado[] = []
  const amostraPequena = a.concluidos < AMOSTRA_MINIMA

  if (amostraPequena) {
    r.push({
      tipo: 'info',
      indicador: 'amostra',
      texto: `Concluiu ${a.concluidos} chamado(s) no mês. Com menos de ${AMOSTRA_MINIMA}, os percentuais oscilam muito e as conclusões abaixo devem ser lidas com cautela.`,
      chamados: [],
    })
  }

  /* Prazo (SLA). */
  if (a.slaAvaliados >= AMOSTRA_MINIMA && a.slaPct !== null) {
    const desc = numeros(ev, 'sla_descumprido')
    const ref = med.slaPct

    if (ref !== null && a.slaPct <= ref - 10) {
      r.push({
        tipo: 'atencao',
        indicador: 'sla',
        texto: `Cumpriu o prazo em ${a.slaPct}% dos chamados concluídos (${a.slaCumpridos} de ${a.slaAvaliados}); a mediana da equipe foi ${ref}%. Fora do prazo: ${listaChamados(desc) || '—'}.`,
        chamados: desc,
      })
    } else if (a.slaPct === 100 || (ref !== null && a.slaPct >= ref + 5)) {
      r.push({
        tipo: 'forte',
        indicador: 'sla',
        texto: `Cumpriu o prazo em ${a.slaPct}% dos chamados concluídos (${a.slaCumpridos} de ${a.slaAvaliados})${ref !== null ? `, acima da mediana da equipe (${ref}%)` : ''}.`,
        chamados: [],
      })
    }

    if (ant.slaPct !== null && ant.slaAvaliados >= AMOSTRA_MINIMA) {
      const dif = a.slaPct - ant.slaPct
      if (dif <= -10) {
        r.push({ tipo: 'atencao', indicador: 'sla', texto: `O prazo cumprido caiu ${-dif} pontos em relação ao mês anterior (${ant.slaPct}% → ${a.slaPct}%).`, chamados: desc })
      } else if (dif >= 10) {
        r.push({ tipo: 'forte', indicador: 'sla', texto: `O prazo cumprido subiu ${dif} pontos em relação ao mês anterior (${ant.slaPct}% → ${a.slaPct}%).`, chamados: [] })
      }
    }
  }

  /* Primeira resposta. */
  if (a.primeiraRespostaAmostra >= AMOSTRA_MINIMA && a.primeiraRespostaMediana !== null && med.primeiraResposta !== null) {
    const v = a.primeiraRespostaMediana
    const ref = med.primeiraResposta
    if (v > ref * 1.5 && v > 2) {
      r.push({
        tipo: 'atencao',
        indicador: 'primeira_resposta',
        texto: `A primeira resposta ao cliente levou, na mediana, ${horas(v)}; a mediana da equipe foi ${horas(ref)}.`,
        chamados: [],
      })
    } else if (v <= ref * 0.7) {
      r.push({
        tipo: 'forte',
        indicador: 'primeira_resposta',
        texto: `Primeira resposta rápida: mediana de ${horas(v)}, contra ${horas(ref)} da equipe.`,
        chamados: [],
      })
    }
  }

  /* Resolução. */
  if (a.concluidos >= AMOSTRA_MINIMA && a.resolucaoMediana !== null && med.resolucao !== null) {
    const v = a.resolucaoMediana
    const ref = med.resolucao
    if (v > ref * 1.5 && v > 4) {
      r.push({
        tipo: 'atencao',
        indicador: 'resolucao',
        texto: `O tempo de resolução (sem contar o tempo aguardando o cliente) foi de ${horas(v)} na mediana; a equipe ficou em ${horas(ref)}. Pode refletir chamados mais complexos — conferir a distribuição por área.`,
        chamados: [],
      })
    } else if (v <= ref * 0.7) {
      r.push({ tipo: 'forte', indicador: 'resolucao', texto: `Resolução ágil: mediana de ${horas(v)}, contra ${horas(ref)} da equipe.`, chamados: [] })
    }
  }

  /* Reabertura. */
  const reab = numeros(ev, 'reaberto')
  if (a.reabertos >= 2 && a.reaberturaPct !== null && a.reaberturaPct >= 15) {
    r.push({
      tipo: 'atencao',
      indicador: 'reabertura',
      texto: `${a.reabertos} chamado(s) voltaram a ser abertos depois de resolvidos (${a.reaberturaPct}% dos concluídos): ${listaChamados(reab)}.`,
      chamados: reab,
    })
  } else if (a.concluidos >= AMOSTRA_MINIMA && a.reabertos === 0) {
    r.push({ tipo: 'forte', indicador: 'reabertura', texto: 'Nenhum chamado concluído no mês precisou ser reaberto.', chamados: [] })
  }

  /* Avaliação do cliente. */
  const ruins = numeros(ev, 'nota_ruim')
  const excel = numeros(ev, 'nota_excelente')
  if (a.notas.ruim > 0) {
    r.push({
      tipo: 'atencao',
      indicador: 'avaliacao',
      texto: `Recebeu ${a.notas.ruim} avaliação(ões) "Ruim" do cliente: ${listaChamados(ruins)}. Vale ler os comentários junto com a pessoa.`,
      chamados: ruins,
    })
  }
  if (a.notas.excelente >= 3 && a.notas.ruim === 0) {
    r.push({
      tipo: 'forte',
      indicador: 'avaliacao',
      texto: `${a.notas.excelente} avaliação(ões) "Excelente" do cliente e nenhuma "Ruim": ${listaChamados(excel)}.`,
      chamados: excel,
    })
  }

  /* Carteira atrasada (retrato na data da geração). */
  const atr = numeros(ev, 'atrasado_aberto')
  if (a.atrasados >= 3 || (a.carteira >= 5 && a.atrasados / a.carteira >= 0.2)) {
    r.push({
      tipo: 'atencao',
      indicador: 'atrasados',
      texto: `Na data do relatório, tinha ${a.atrasados} chamado(s) em aberto já fora do prazo, de ${a.carteira} na carteira: ${listaChamados(atr)}.`,
      chamados: atr,
    })
  }

  /* Alteração de prazo recusada. */
  const neg = numeros(ev, 'prazo_negado')
  if (a.prazoAlteracoes.negadas > 0) {
    r.push({
      tipo: 'atencao',
      indicador: 'prazo',
      texto: `${a.prazoAlteracoes.negadas} alteração(ões) de prazo feitas pela pessoa não foram autorizadas pela gestão: ${listaChamados(neg)}.`,
      chamados: neg,
    })
  }

  /* Volume (só informativo). */
  if (med.concluidos !== null && med.concluidos > 0 && !amostraPequena) {
    const rel = a.concluidos / med.concluidos
    if (rel >= 1.4) {
      r.push({ tipo: 'info', indicador: 'volume', texto: `Volume acima da equipe: ${a.concluidos} concluídos, contra mediana de ${med.concluidos}. Observar sobrecarga.`, chamados: [] })
    } else if (rel <= 0.6) {
      r.push({ tipo: 'info', indicador: 'volume', texto: `Volume abaixo da equipe: ${a.concluidos} concluídos, contra mediana de ${med.concluidos}. Conferir se houve férias, outras atribuições ou chamados mais longos.`, chamados: [] })
    }
  }

  return { achados: r, amostraPequena }
}

/* ---------- Análise por regras (sem IA) ---------- */

const PLANO_POR_INDICADOR: Partial<Record<ChaveIndicador, (p: FichaPessoa, m: Medianas) => AcaoPlano>> = {
  sla: (p, m) => ({
    acao: 'No início de cada expediente, ordenar a própria fila por prazo e avisar a gestão, com antecedência, de todo chamado com risco de vencer.',
    indicador: 'Prazo cumprido (%)',
    meta: m.slaPct !== null ? `Chegar a pelo menos ${m.slaPct}% (mediana da equipe neste mês)` : 'Subir o percentual em relação a este mês',
    prazo: 'Próximo mês',
  }),
  primeira_resposta: (p, m) => ({
    acao: 'Enviar a primeira mensagem ao cliente assim que assumir o chamado: confirmar o recebimento e informar o próximo passo.',
    indicador: 'Primeira resposta (mediana)',
    meta: m.primeiraResposta !== null ? `Até ${horas(m.primeiraResposta)} (mediana da equipe)` : 'Reduzir em relação a este mês',
    prazo: 'Próximo mês',
  }),
  resolucao: () => ({
    acao: 'Dividir os chamados longos em etapas no portal e registrar o que depende de terceiros, para a gestão enxergar onde o tempo está indo.',
    indicador: 'Tempo de resolução (mediana)',
    meta: 'Reduzir em relação a este mês, separando o que é complexidade da demanda',
    prazo: 'Próximo mês',
  }),
  reabertura: () => ({
    acao: 'Antes de marcar "Resolvido", confirmar com o cliente se a solução atende e registrar na conversa o que foi entregue.',
    indicador: 'Reabertura (%)',
    meta: 'Reduzir pela metade o percentual deste mês',
    prazo: 'Próximo mês',
  }),
  avaliacao: (p) => ({
    acao: `Ler com a gestão os comentários das avaliações "Ruim" (${listaChamados(numeros(p.evidencias, 'nota_ruim'))}) e combinar o que muda no atendimento.`,
    indicador: 'Avaliações "Ruim"',
    meta: 'Nenhuma avaliação "Ruim" no próximo mês',
    prazo: 'Conversa nesta semana; meta no próximo mês',
  }),
  atrasados: (p) => ({
    acao: `Montar com a gestão um plano para os chamados atrasados (${listaChamados(numeros(p.evidencias, 'atrasado_aberto'))}), com data e responsável para cada um.`,
    indicador: 'Chamados em aberto fora do prazo',
    meta: 'Zerar os atrasados atuais',
    prazo: '15 dias',
  }),
  prazo: () => ({
    acao: 'Alinhar com a gestão quando cabe pedir alteração de prazo e como justificar.',
    indicador: 'Alterações de prazo não autorizadas',
    meta: 'Nenhuma no próximo mês',
    prazo: 'Próximo mês',
  }),
}

export function analisePorRegras(d: DadosRelatorio): Analise {
  const pessoas: Record<string, AnalisePessoa> = {}

  for (const p of d.pessoas) {
    const fortes = p.achados.filter((a) => a.tipo === 'forte').map((a) => a.texto)
    const atencao = p.achados.filter((a) => a.tipo === 'atencao').map((a) => a.texto)
    const vistos = new Set<ChaveIndicador>()
    const plano: AcaoPlano[] = []

    for (const a of p.achados) {
      if (a.tipo !== 'atencao' || vistos.has(a.indicador)) continue
      const f = PLANO_POR_INDICADOR[a.indicador]
      if (!f) continue
      vistos.add(a.indicador)
      plano.push(f(p, d.equipe.medianas))
      if (plano.length >= 3) break
    }

    if (!plano.length) {
      plano.push({
        acao: fortes.length
          ? 'Manter o padrão e compartilhar com a equipe uma prática que funcionou neste mês.'
          : 'Escolher com a gestão um indicador para evoluir no próximo mês.',
        indicador: fortes.length ? 'Prática compartilhada' : 'A definir na conversa',
        meta: fortes.length ? 'Uma prática apresentada à equipe' : 'Meta combinada na conversa',
        prazo: 'Próximo mês',
      })
    }

    const a = p.atual
    pessoas[p.id] = {
      sintese:
        `${p.nome.split(' ')[0]} recebeu ${a.recebidos} e concluiu ${a.concluidos} chamado(s) no período` +
        (a.slaPct !== null ? `, com ${a.slaPct}% dentro do prazo` : '') +
        `. ${fortes.length} ponto(s) forte(s) e ${atencao.length} ponto(s) de atenção identificados pelos dados.` +
        (p.amostraPequena ? ' Amostra pequena: leitura com cautela.' : ''),
      pontos_fortes: fortes,
      pontos_atencao: atencao,
      plano_acao: plano,
      roteiro_conversa: [
        'Abrir pelo que foi bem, citando os números e chamados.',
        'Perguntar como a pessoa avalia o próprio mês e o que atrapalhou.',
        atencao.length
          ? 'Apresentar no máximo dois pontos de atenção, sempre com o chamado que comprova.'
          : 'Perguntar em que a pessoa quer se desenvolver no próximo mês.',
        'Ouvir as causas antes de concluir: volume, tipo de demanda, dependência do cliente ou de outra área.',
        'Fechar o plano junto (ação, meta e prazo) e marcar a data de retorno.',
      ],
    }
  }

  const e = d.equipe
  const atencaoEquipe: string[] = []
  const destaques: string[] = []

  if (e.atual.slaPct !== null && e.anterior.slaPct !== null) {
    const dif = e.atual.slaPct - e.anterior.slaPct
    const t = `Prazo cumprido da equipe: ${e.atual.slaPct}% (mês anterior: ${e.anterior.slaPct}%).`
    ;(dif < 0 ? atencaoEquipe : destaques).push(t)
  }
  if (e.atual.atrasados > 0) atencaoEquipe.push(`${e.atual.atrasados} chamado(s) em aberto fora do prazo na data do relatório.`)
  if (e.atual.notas.ruim > 0) atencaoEquipe.push(`${e.atual.notas.ruim} avaliação(ões) "Ruim" de clientes no mês.`)
  if (e.atual.notas.excelente > 0) destaques.push(`${e.atual.notas.excelente} avaliação(ões) "Excelente" de clientes no mês.`)
  if (e.atual.reaberturaPct !== null && e.atual.reaberturaPct >= 10) atencaoEquipe.push(`Reabertura da equipe em ${e.atual.reaberturaPct}% dos concluídos.`)

  return {
    equipe: {
      sintese: `A equipe recebeu ${e.atual.recebidos} e concluiu ${e.atual.concluidos} chamado(s) no período (mês anterior: ${e.anterior.recebidos} recebidos e ${e.anterior.concluidos} concluídos).`,
      destaques,
      riscos: atencaoEquipe,
      recomendacoes: [
        'Fazer a conversa individual de cada pessoa até o dia 10, usando a ficha e o roteiro.',
        'Revisar no próximo relatório se as metas combinadas foram atingidas.',
      ],
    },
    pessoas,
  }
}
