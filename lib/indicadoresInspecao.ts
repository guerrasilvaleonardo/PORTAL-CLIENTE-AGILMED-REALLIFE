/*
 * Os indicadores das inspeções, num lugar só.
 *
 * POR QUE SAIU DA TELA DO PAINEL. Agora existem dois lugares que
 * mostram os mesmos números: o painel, para olhar, e o relatório
 * consolidado, para entregar. Duas cópias da conta divergem no
 * primeiro ajuste — e um relatório que diz 92% enquanto a tela diz 94%
 * destrói a confiança no portal inteiro, mesmo que os dois estejam
 * "quase certos".
 *
 * As fórmulas vieram do painel sem alteração. O que mudou foi só o
 * lugar: funções puras, sem React, recebendo o que já foi filtrado.
 *
 * O FILTRO DE PERÍODO E DE EMPRESA FICA FORA. Quem chama decide o
 * recorte; aqui só se calcula sobre o que chegou. Misturar filtro com
 * cálculo foi o que fez a conta morar na tela.
 */

export type InspecaoIndicador = {
  id: string
  empresa_id: string
  modelo_nome: string
  local_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  itens_total: number
  conformes: number
  nao_conformes: number
  nao_aplicaveis: number
  percentual: number | null
}

export type RespostaIndicador = {
  id: string
  inspecao_id: string
  pergunta: string
  resposta: string | null
}

export type NcIndicador = {
  id: string
  empresa_id: string
  origem: string
  classificacao?: string | null
  /* Curto e reaproveitado: é por ele que o mesmo problema é
     reconhecido entre visitas. Só o apontamento de campo preenche. */
  titulo?: string | null
  gravidade: string
  resposta_id: string | null
  local_nome: string | null
  risco: number | null
  situacao: string
  prazo: string | null
  ocorrido_em: string | null
  tipo_incidente: string | null
  afastamento_dias: number | null
  created_at: string
  encerrada_em: string | null
}

export const hoje = () => new Date().toISOString().slice(0, 10)
export const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

/* Uma casa decimal, como o painel sempre mostrou. */
const pct = (parte: number, todo: number) =>
  todo > 0 ? Math.round((1000 * parte) / todo) / 10 : null

/* ---------- Conformidade por local ---------- */
export function porLocal(concluidas: InspecaoIndicador[]) {
  const mapa = new Map<string, { aplicadas: number; itens: number; conf: number; nc: number }>()
  for (const i of concluidas) {
    const chave = i.local_nome || 'Sem local'
    const atual = mapa.get(chave) || { aplicadas: 0, itens: 0, conf: 0, nc: 0 }
    atual.aplicadas += 1
    atual.itens += i.itens_total
    atual.conf += i.conformes
    atual.nc += i.nao_conformes
    mapa.set(chave, atual)
  }
  return [...mapa.entries()]
    .map(([local, v]) => ({ local, ...v, percentual: pct(v.conf, v.conf + v.nc) }))
    .sort((a, b) => (a.percentual ?? 101) - (b.percentual ?? 101))
}

/*
 * Reincidência: a mesma pergunta falhando de novo.
 *
 * Uma inspeção com 95% de conformidade parece ótima até se ver que o
 * mesmo item reprova todo mês: isso não é um achado, é um controle que
 * não existe. O percentual sozinho esconde exatamente o que precisa de
 * ação.
 */
export function reincidencia(
  concluidas: InspecaoIndicador[],
  respostas: RespostaIndicador[],
  limite = 15
) {
  const ids = new Set(concluidas.map((i) => i.id))
  const mapa = new Map<string, { avaliada: number; reprovada: number }>()
  for (const r of respostas) {
    if (!ids.has(r.inspecao_id) || !r.resposta || r.resposta === 'nao_aplicavel') continue
    const atual = mapa.get(r.pergunta) || { avaliada: 0, reprovada: 0 }
    atual.avaliada += 1
    if (r.resposta === 'nao_conforme') atual.reprovada += 1
    mapa.set(r.pergunta, atual)
  }
  return [...mapa.entries()]
    .map(([pergunta, v]) => ({ pergunta, ...v, taxa: pct(v.reprovada, v.avaliada) as number }))
    .filter((r) => r.reprovada > 0)
    .sort((a, b) => b.reprovada - a.reprovada || b.taxa - a.taxa)
    .slice(0, limite)
}

/*
 * OPORTUNIDADE DE MELHORIA NÃO É NÃO CONFORMIDADE.
 *
 * Nada está errado: dá para ser melhor. Contar as duas juntas faz a
 * empresa tratar sugestão como defeito — abre ação corretiva do que
 * não falhou, e infla o número que a direção lê como problema. Quem
 * descobre isso passa a não registrar mais oportunidade, e a empresa
 * perde a melhor fonte de melhoria que tem.
 *
 * Por isso toda conta de "não conformidade" neste arquivo passa por
 * aqui primeiro.
 */
/*
 * Nem tudo que a tabela guarda é problema. Ela já carregava observação
 * e oportunidade; agora carrega também o apontamento CONFORME, que a
 * inspetora registra para mostrar o que está certo. Nenhum dos dois
 * entra em fila, prazo ou eficácia.
 */
const NAO_SAO_PROBLEMA = ['oportunidade', 'conforme']

/*
 * "Atende em parte" (insuficiente) CONTA como problema. Tem prazo,
 * dono e aviso, e entra nas mesmas filas da não conformidade — do
 * contrário viraria o esconderijo confortável de tudo que ninguém quer
 * tratar. O que muda é só como o relatório conta a história: o cliente
 * lê "três não atendem e dois atendem em parte" muito diferente de
 * "cinco não atendem", e a segunda frase faz ele parar de ler.
 */
export const ehNaoConformidade = (n: NcIndicador) =>
  !NAO_SAO_PROBLEMA.includes(n.classificacao || '')

export const parciais = (ncsVisiveis: NcIndicador[]) =>
  ncsVisiveis.filter((n) => n.classificacao === 'insuficiente')

/*
 * O que se repete entre os apontamentos de campo.
 *
 * A reincidência do checklist agrupa por pergunta, que é um texto
 * fixo. O apontamento de campo não tem pergunta — tem título, curto e
 * escolhido de uma lista do que já existe naquele local. Mesmo título
 * no mesmo local, em datas diferentes, é o mesmo problema voltando.
 *
 * Só conta a partir da segunda vez: o que aconteceu uma vez é um
 * achado, não um padrão.
 */
export function repeticoesPorTitulo(ncsVisiveis: NcIndicador[]) {
  const mapa = new Map<
    string,
    { titulo: string; local: string; vezes: number; primeira: string; ultima: string; aberto: number }
  >()

  for (const n of ncsVisiveis) {
    if (!n.titulo) continue
    const local = n.local_nome || 'Sem local'
    const chave = n.titulo + ' :: ' + local
    const quando = dia(n.ocorrido_em || n.created_at)
    const atual = mapa.get(chave) || {
      titulo: n.titulo,
      local,
      vezes: 0,
      primeira: quando,
      ultima: quando,
      aberto: 0,
    }
    atual.vezes += 1
    if (quando < atual.primeira) atual.primeira = quando
    if (quando > atual.ultima) atual.ultima = quando
    if (!['encerrada', 'cancelada'].includes(n.situacao)) atual.aberto += 1
    mapa.set(chave, atual)
  }

  return [...mapa.values()]
    .filter((r) => r.vezes > 1)
    .sort((a, b) => b.vezes - a.vezes || b.aberto - a.aberto)
}

export const oportunidades = (ncsVisiveis: NcIndicador[]) =>
  ncsVisiveis.filter((n) => n.classificacao === 'oportunidade')

/*
 * O que foi olhado e estava certo.
 *
 * Serve de denominador: visita que aponta duas não conformidades não
 * diz se foram olhados dois itens ou duzentos. Sem o conforme, o
 * relatório de campo não tem amostra.
 */
export const conformidades = (ncsVisiveis: NcIndicador[]) =>
  ncsVisiveis.filter((n) => n.classificacao === 'conforme')

/* ---------- Números do topo ---------- */
export function totais(concluidas: InspecaoIndicador[], todasNcs: NcIndicador[]) {
  const ncsVisiveis = todasNcs.filter(ehNaoConformidade)
  const abertas = ncsVisiveis.filter((n) => !['encerrada', 'cancelada'].includes(n.situacao))
  const vencidas = abertas.filter((n) => n.prazo && n.prazo < hoje())
  const encerradas = ncsVisiveis.filter((n) => n.situacao === 'encerrada' && n.encerrada_em)

  const dias = encerradas.map((n) => {
    const a = Date.parse(dia(n.created_at) + 'T00:00:00Z')
    const b = Date.parse(dia(n.encerrada_em) + 'T00:00:00Z')
    return Math.max(0, Math.round((b - a) / 86400000))
  })

  const conf = concluidas.reduce((s, i) => s + i.conformes, 0)
  const nc = concluidas.reduce((s, i) => s + i.nao_conformes, 0)

  return {
    aplicadas: concluidas.length,
    conformidade: pct(conf, conf + nc),
    abertas: abertas.length,
    vencidas: vencidas.length,
    encerradas: encerradas.length,
    /* Contados à parte, para aparecerem sem entrar na fila de
       problemas. */
    oportunidades: oportunidades(todasNcs).length,
    conformes: conformidades(todasNcs).length,
    /* Dentro de `abertas`, mas contado para o relatório poder separar. */
    parciais: parciais(todasNcs).filter(
      (n) => !['encerrada', 'cancelada'].includes(n.situacao)
    ).length,
    mediaDias: dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null,
  }
}

/*
 * EFICÁCIA — o indicador que quase ninguém mede.
 *
 * Encerrar uma não conformidade não prova nada: prova é ela não
 * voltar. Para cada NC encerrada, a mesma pergunta é procurada nas
 * inspeções concluídas no MESMO local nos 90 dias seguintes. Se
 * reprovou de novo, a ação não funcionou.
 *
 * É o que a ISO 45001 e a 9001 pedem no 10.2 ao falar em verificar a
 * eficácia da ação corretiva — a diferença é que aqui sai um número,
 * não um campo de texto.
 */
export function eficacia(
  todasNcs: NcIndicador[],
  respostas: RespostaIndicador[],
  inspecoes: InspecaoIndicador[]
) {
  const perguntaDaResposta = new Map(respostas.map((r) => [r.id, r.pergunta]))
  const inspecaoDe = new Map(inspecoes.map((i) => [i.id, i]))

  /* Oportunidade fora: eficácia é sobre o que falhou e foi corrigido. */
  const encerradas = todasNcs
    .filter(ehNaoConformidade)
    .filter((n) => n.situacao === 'encerrada' && n.encerrada_em && n.resposta_id)

  let reincidiu = 0
  for (const n of encerradas) {
    const pergunta = perguntaDaResposta.get(n.resposta_id as string)
    if (!pergunta) continue

    const fim = Date.parse(dia(n.encerrada_em) + 'T00:00:00Z')
    const limite = fim + 90 * 86400000

    const voltou = respostas.some((r) => {
      if (r.pergunta !== pergunta || r.resposta !== 'nao_conforme') return false
      const i = inspecaoDe.get(r.inspecao_id)
      if (!i || i.situacao !== 'concluida' || !i.concluida_em) return false
      if ((i.local_nome || '') !== (n.local_nome || '')) return false
      const quando = Date.parse(dia(i.concluida_em) + 'T00:00:00Z')
      return quando > fim && quando <= limite
    })

    if (voltou) reincidiu += 1
  }

  return {
    encerradas: encerradas.length,
    reincidiu,
    taxa: pct(encerradas.length - reincidiu, encerradas.length),
  }
}

/* ---------- Incidentes ---------- */
export function incidentes(ncsVisiveis: NcIndicador[]) {
  const sos = ncsVisiveis.filter((n) => n.origem === 'incidente')
  const mapa = new Map<string, number>()
  for (const i of sos) {
    const k = i.tipo_incidente || 'sem tipo'
    mapa.set(k, (mapa.get(k) || 0) + 1)
  }
  return {
    total: sos.length,
    afastamento: sos.reduce((s, i) => s + (i.afastamento_dias || 0), 0),
    porTipo: [...mapa.entries()].sort((a, b) => b[1] - a[1]),
  }
}

export const TIPO_INCIDENTE: Record<string, string> = {
  acidente_com_afastamento: 'Acidente com afastamento',
  acidente_sem_afastamento: 'Acidente sem afastamento',
  quase_acidente: 'Quase-acidente',
  doenca_ocupacional: 'Doença ocupacional',
  primeiros_socorros: 'Primeiros socorros',
}
