/*
 * Relatório mensal de desempenho — texto da análise escrito por IA
 * (API da Anthropic), a partir dos dados JÁ CALCULADOS por regras.
 *
 * Proteção de dados (LGPD): a IA não recebe nomes, e-mails, nomes de
 * clientes, assuntos nem textos de mensagens. Cada pessoa vira um código
 * (P1, P2...) e os chamados aparecem só pelo número e pela área. O nome é
 * recolocado aqui, depois da resposta.
 *
 * Caminho da IA (sem chave para criar):
 * - Padrão: AI Gateway da Vercel, autenticado pelo token OIDC que a própria
 *   Vercel entrega a cada função (cabeçalho x-vercel-oidc-token). O custo
 *   sai dos créditos de AI Gateway da conta Vercel.
 * - Se existir ANTHROPIC_API_KEY, usa a API da Anthropic direto.
 * Sem nenhum dos dois (ex.: rodando fora da Vercel) ou se a chamada falhar,
 * quem chama usa a análise por regras (lib/relatorioDesempenho.ts).
 */

import type { AcaoPlano, Analise, AnalisePessoa, DadosRelatorio, FichaPessoa } from '@/lib/relatorioDesempenho'

const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages'
const URL_GATEWAY = 'https://ai-gateway.vercel.sh/v1/messages'
/* Por chamada. A rota tem até 300 s (maxDuration); as chamadas correm em paralelo. */
const TEMPO_LIMITE_MS = 120000

/* Como a IA é acessada nesta execução. `oidc` vem do cabeçalho da requisição. */
export type AcessoIA = { url: string; headers: Record<string, string>; modelo: string; via: 'anthropic' | 'gateway' }

export function acessoIA(oidc?: string | null): AcessoIA | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      url: URL_ANTHROPIC,
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY },
      modelo: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      via: 'anthropic',
    }
  }
  const token = process.env.AI_GATEWAY_API_KEY || oidc || process.env.VERCEL_OIDC_TOKEN
  if (!token) return null
  return {
    url: URL_GATEWAY,
    headers: { authorization: 'Bearer ' + token },
    modelo: process.env.AI_GATEWAY_MODEL || 'anthropic/claude-sonnet-5',
    via: 'gateway',
  }
}

const SISTEMA = `Você atua ao mesmo tempo como conselheiro de governança corporativa e como master coach de desenvolvimento profissional, apoiando a direção de uma empresa de engenharia de SST e saúde ocupacional na gestão da equipe de atendimento de chamados.

Regras obrigatórias:
1. Use SOMENTE os dados fornecidos. Não invente números, causas, fatos nem chamados. Quando citar um número, ele precisa estar nos dados.
2. Fale de comportamentos e resultados observáveis. É PROIBIDO diagnosticar personalidade, motivação, saúde, emoções ou perfil psicológico.
3. Sempre que apontar algo, cite a evidência (indicador e, quando houver, o número do chamado no formato #123).
4. Considere o contexto antes de concluir: amostra pequena, área dos chamados, volume, tempo aguardando o cliente. Se o dado não permite concluir, diga isso.
5. O relatório é apoio à decisão da gestão. Não recomende punição, advertência, desligamento nem qualquer medida disciplinar. Não compare pessoas entre si de forma depreciativa.
6. Plano de ação: no máximo 3 ações por pessoa, cada uma específica, mensurável, com indicador, meta numérica quando possível e prazo. Priorize o que tem mais impacto no cliente e no prazo.
7. Roteiro de conversa: 4 a 6 passos, no estilo de coaching (perguntas abertas, escuta, acordo), para uma conversa individual de 20 a 30 minutos.
8. Português do Brasil, direto, profissional e respeitoso. Frases curtas.
9. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem markdown.
10. Dentro dos textos do JSON, NUNCA use aspas duplas ("). Para citar um termo, use aspas simples ('Aguardando cliente').`

function codigoDe(d: DadosRelatorio) {
  const mapa = new Map<string, string>()
  d.pessoas.forEach((p, i) => mapa.set(p.id, 'P' + (i + 1)))
  return mapa
}

function resumoPessoa(p: FichaPessoa, codigo: string) {
  const a = p.atual
  const ant = p.anterior
  const ind = (x: typeof a) => ({
    recebidos: x.recebidos,
    concluidos: x.concluidos,
    prazo_cumprido_pct: x.slaPct,
    prazo_avaliados: x.slaAvaliados,
    primeira_resposta_mediana_horas_uteis: x.primeiraRespostaMediana,
    resolucao_mediana_horas_uteis: x.resolucaoMediana,
    reabertos: x.reabertos,
    reabertura_pct: x.reaberturaPct,
    avaliacoes_cliente: x.notas,
    estrelas: x.estrelas,
    alteracoes_de_prazo: x.prazoAlteracoes,
    cancelados: x.cancelados,
  })
  return {
    codigo,
    funcao: p.perfil === 'atendimento' ? 'atendente' : p.perfil,
    amostra_pequena: p.amostraPequena,
    mes_atual: { ...ind(a), carteira_em_aberto: a.carteira, atrasados_em_aberto: a.atrasados, mensagens_escritas: a.mensagens },
    mes_anterior: ind(ant),
    por_area: p.porCategoria,
    achados_por_regra: p.achados.map((x) => ({ tipo: x.tipo, indicador: x.indicador, texto: x.texto })),
    evidencias: p.evidencias.map((e) => ({ chamado: e.numero, area: e.categoria, tipo: e.tipo, motivo: e.detalhe })),
  }
}

function contextoEquipe(d: DadosRelatorio) {
  const e = d.equipe
  return {
    mes: d.mes,
    parcial: d.parcial,
    equipe_mes_atual: {
      recebidos: e.atual.recebidos,
      concluidos: e.atual.concluidos,
      prazo_cumprido_pct: e.atual.slaPct,
      reabertura_pct: e.atual.reaberturaPct,
      atrasados_em_aberto: e.atual.atrasados,
      avaliacoes_cliente: e.atual.notas,
      cancelados: e.atual.cancelados,
    },
    equipe_mes_anterior: {
      recebidos: e.anterior.recebidos,
      concluidos: e.anterior.concluidos,
      prazo_cumprido_pct: e.anterior.slaPct,
      reabertura_pct: e.anterior.reaberturaPct,
      avaliacoes_cliente: e.anterior.notas,
    },
    medianas_da_equipe: e.medianas,
    por_area: e.porCategoria,
    cancelamentos_por_motivo: e.cancelamentosPorMotivo,
    limitacoes: d.limitacoes,
  }
}

/*
 * Lê o JSON da resposta. Se vier inválido (ex.: aspas duplas dentro de um
 * texto, ou resposta cortada), pede UMA vez para a IA devolver o mesmo
 * conteúdo como JSON válido.
 */
async function chamar(acesso: AcessoIA, usuario: string, maxTokens: number) {
  const primeira = await pedirTexto(acesso, [{ role: 'user', content: usuario }], maxTokens)

  try {
    return lerJson(primeira.texto, primeira.cortada)
  } catch (e: any) {
    const segunda = await pedirTexto(
      acesso,
      [
        { role: 'user', content: usuario },
        { role: 'assistant', content: primeira.texto || '{}' },
        {
          role: 'user',
          content:
            'A resposta acima não é um JSON válido (' + (e?.message || 'erro de leitura') + '). ' +
            'Devolva o MESMO conteúdo, completo e mais enxuto se precisar, como um único objeto JSON válido. ' +
            'Dentro dos textos use aspas simples, nunca aspas duplas. Sem texto fora do JSON.',
        },
      ],
      maxTokens
    )
    return lerJson(segunda.texto, segunda.cortada)
  }
}

function lerJson(texto: string, cortada: boolean) {
  const ini = texto.indexOf('{')
  const fim = texto.lastIndexOf('}')
  if (ini < 0 || fim <= ini) {
    throw new Error(cortada ? 'A resposta da IA foi cortada (limite de tamanho).' : 'A IA não devolveu JSON.')
  }
  try {
    return JSON.parse(texto.slice(ini, fim + 1))
  } catch (e: any) {
    throw new Error((cortada ? 'Resposta cortada pelo limite de tamanho; ' : '') + (e?.message || 'JSON inválido'))
  }
}

async function pedirTexto(
  acesso: AcessoIA,
  mensagens: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number
): Promise<{ texto: string; cortada: boolean }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS)
  try {
    const r = await fetch(acesso.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...acesso.headers,
      },
      body: JSON.stringify({
        model: acesso.modelo,
        max_tokens: maxTokens,
        temperature: 0.3,
        system: SISTEMA,
        messages: mensagens,
      }),
    })
    const corpo = await r.json().catch(() => null)
    if (!r.ok) {
      throw new Error('API da IA respondeu ' + r.status + ': ' + (corpo?.error?.message || 'erro desconhecido'))
    }
    const texto = (corpo?.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
    return { texto, cortada: corpo?.stop_reason === 'max_tokens' }
  } finally {
    clearTimeout(t)
  }
}

const strs = (v: any, max = 8) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max) : [])

function planoValido(v: any): AcaoPlano[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x) => x && typeof x.acao === 'string')
    .slice(0, 3)
    .map((x) => ({ acao: String(x.acao), indicador: String(x.indicador || ''), meta: String(x.meta || ''), prazo: String(x.prazo || '') }))
}

/* Troca os códigos P1, P2... pelos nomes no texto devolvido. */
function recolocarNomes(texto: string, nomes: Map<string, string>) {
  return texto.replace(/\bP(\d{1,3})\b/g, (m) => nomes.get(m) || m)
}

function limpar<T>(v: T, nomes: Map<string, string>): T {
  if (typeof v === 'string') return recolocarNomes(v, nomes) as any
  if (Array.isArray(v)) return v.map((x) => limpar(x, nomes)) as any
  if (v && typeof v === 'object') {
    const r: any = {}
    for (const [k, x] of Object.entries(v)) r[k] = limpar(x, nomes)
    return r
  }
  return v
}

/*
 * Gera a análise completa. Cada pessoa é uma chamada separada (em
 * paralelo) para caber no tempo da função; quem falhar fica com a
 * análise por regras, e o erro é devolvido para registro.
 */
export async function analisarComIA(acesso: AcessoIA, d: DadosRelatorio, porRegras: Analise): Promise<{ analise: Analise; erros: string[] }> {
  const codigos = codigoDe(d)
  const nomes = new Map<string, string>()
  for (const p of d.pessoas) nomes.set(codigos.get(p.id)!, p.nome.split(' ')[0])

  const erros: string[] = []
  const ctx = contextoEquipe(d)

  const tarefaEquipe = (async () => {
    const pedido =
      'Analise o mês da equipe de atendimento como conselheiro de governança. Dados (JSON):\n' +
      JSON.stringify({ ...ctx, pessoas: d.pessoas.map((p) => resumoPessoa(p, codigos.get(p.id)!)) }) +
      '\n\nResponda neste formato JSON: {"sintese": "3 a 5 frases sobre o mês da equipe", "destaques": ["..."], "riscos": ["riscos para o cliente, para o prazo ou para a operação, com evidência"], "recomendacoes": ["até 5 recomendações de gestão para o próximo mês, cada uma com responsável sugerido (gestão/equipe) e indicador de acompanhamento"]}'
    const r = await chamar(acesso, pedido, 4000)
    return {
      sintese: typeof r.sintese === 'string' ? r.sintese : porRegras.equipe.sintese,
      destaques: strs(r.destaques),
      riscos: strs(r.riscos),
      recomendacoes: strs(r.recomendacoes, 6),
    }
  })()

  const tarefasPessoas = d.pessoas.map(async (p): Promise<[string, AnalisePessoa]> => {
    const codigo = codigos.get(p.id)!
    try {
      const pedido =
        `Prepare a ficha individual de ${codigo} para a conversa mensal de desenvolvimento. Contexto da equipe (JSON):\n` +
        JSON.stringify(ctx) +
        `\n\nDados de ${codigo} (JSON):\n` +
        JSON.stringify(resumoPessoa(p, codigo)) +
        '\n\nResponda neste formato JSON: {"sintese": "2 a 4 frases sobre o mês da pessoa", "pontos_fortes": ["com evidência"], "pontos_atencao": ["com evidência"], "plano_acao": [{"acao": "...", "indicador": "...", "meta": "...", "prazo": "..."}], "roteiro_conversa": ["passo 1", "..."]}'
      const r = await chamar(acesso, pedido, 3500)
      const base = porRegras.pessoas[p.id]
      const plano = planoValido(r.plano_acao)
      return [
        p.id,
        {
          sintese: typeof r.sintese === 'string' ? r.sintese : base.sintese,
          pontos_fortes: strs(r.pontos_fortes),
          pontos_atencao: strs(r.pontos_atencao),
          plano_acao: plano.length ? plano : base.plano_acao,
          roteiro_conversa: strs(r.roteiro_conversa, 8).length ? strs(r.roteiro_conversa, 8) : base.roteiro_conversa,
        },
      ]
    } catch (e: any) {
      erros.push(`${p.nome.split(' ')[0]}: ${e?.message || 'falha na IA'}`)
      return [p.id, porRegras.pessoas[p.id]]
    }
  })

  let equipe = porRegras.equipe
  try {
    equipe = await tarefaEquipe
  } catch (e: any) {
    erros.push('Equipe: ' + (e?.message || 'falha na IA'))
  }

  const pessoas: Record<string, AnalisePessoa> = {}
  for (const [id, a] of await Promise.all(tarefasPessoas)) pessoas[id] = a

  return { analise: limpar({ equipe, pessoas }, nomes), erros }
}
