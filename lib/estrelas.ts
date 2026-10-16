import { supabase } from '@/lib/supabase'

/*
 * Programa de reconhecimento por estrelas.
 *
 * Todo cálculo e toda permissão ficam no banco (supabase/programa-estrelas.sql).
 * Aqui só há leitura, formatação e as preferências visuais de quem usa.
 *
 * Duas escalas diferentes, que não se misturam:
 *   - NOTA do cliente: 1 = Ruim, 2 = Bom, 3 = Excelente;
 *   - ESTRELAS do ranking: 1 pelo prazo + 0, 1 ou 2 pela avaliação.
 */

export type ConfigEstrelas = {
  ativo: boolean
  data_inicio: string | null
  prazo_avaliacao_dias: number | null
  alerta_prazo_horas: number
  regra_versao: number
  estrelas_prazo: number
  bonus_bom: number
  bonus_excelente: number
  atualizado_em: string | null
}

export type LinhaRanking = {
  atendente_id: string
  nome: string
  posicao: number
  estrelas_prazo: number
  estrelas_avaliacao: number
  total: number
  resolvidos: number
  dentro_prazo: number
  fora_prazo: number
  avaliados: number
  media_nota: number | null
}

export type Fechamento = {
  ano: number
  data_fechamento: string
  fechado_em: string | null
  classificacao: LinhaRanking[] | null
}

export const ROTULO_NOTA: Record<number, string> = {
  1: 'Ruim',
  2: 'Bom',
  3: 'Excelente',
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const ALERTA_PADRAO_HORAS = 1

/* Data de hoje no horário de Brasília, como { ano, mes (1-12), dia }. */
export function hojeBrasilia() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [ano, mes, dia] = partes.split('-').map(Number)
  return { ano, mes, dia, iso: partes }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function limitesMes(ano: number, mes: number) {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return { inicio: ano + '-' + pad(mes) + '-01', fim: ano + '-' + pad(mes) + '-' + pad(ultimo) }
}

export function limitesAno(ano: number) {
  return { inicio: ano + '-01-01', fim: ano + '-12-31' }
}

export function chavePeriodoMes(ano: number, mes: number) {
  return 'mes:' + ano + '-' + pad(mes)
}

export function chavePeriodoAno(ano: number) {
  return 'ano:' + ano
}

/* "Sem dados" quando não há base para a conta. */
export function percentual(parte: number, total: number) {
  if (!total) return 'Sem dados'
  return Math.round((100 * parte) / total) + '%'
}

export function media(valor: number | null | undefined) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return 'Sem dados'
  return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' / 3'
}

export function medalha(posicao: number) {
  return posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : ''
}

export function rotuloMedalha(posicao: number) {
  return posicao === 1 ? 'Ouro' : posicao === 2 ? 'Prata' : posicao === 3 ? 'Bronze' : ''
}

export function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatarData(valor: string | null | undefined) {
  if (!valor) return '—'
  const [a, m, d] = valor.slice(0, 10).split('-')
  return d + '/' + m + '/' + a
}

export async function carregarConfig(): Promise<ConfigEstrelas | null> {
  const { data, error } = await supabase
    .from('estrelas_config')
    .select('ativo, data_inicio, prazo_avaliacao_dias, alerta_prazo_horas, regra_versao, estrelas_prazo, bonus_bom, bonus_excelente, atualizado_em')
    .maybeSingle()

  if (error || !data) return null
  return { ...(data as any), alerta_prazo_horas: Number((data as any).alerta_prazo_horas) }
}

/* Antecedência do alerta amarelo. Sem o programa instalado, vale 1h. */
export async function carregarAlertaPrazoHoras() {
  try {
    const cfg = await carregarConfig()
    return cfg?.alerta_prazo_horas || ALERTA_PADRAO_HORAS
  } catch {
    return ALERTA_PADRAO_HORAS
  }
}

export async function carregarRanking(inicio: string, fim: string): Promise<LinhaRanking[]> {
  const { data, error } = await supabase.rpc('estrelas_ranking', { p_inicio: inicio, p_fim: fim })
  if (error) throw error
  return ((data || []) as any[]).map((l) => ({
    ...l,
    media_nota: l.media_nota === null ? null : Number(l.media_nota),
  }))
}

/* ---------- Preferência de efeitos (por navegador) ---------- */

const CHAVE_EFEITOS = 'estrelas-efeitos'

export function efeitosLigados() {
  try {
    return window.localStorage.getItem(CHAVE_EFEITOS) !== 'desligados'
  } catch {
    return true
  }
}

export function definirEfeitos(ligados: boolean) {
  try {
    window.localStorage.setItem(CHAVE_EFEITOS, ligados ? 'ligados' : 'desligados')
  } catch {
    /* sem armazenamento: segue com o padrão */
  }
  window.dispatchEvent(new Event('estrelas-efeitos'))
}

export function movimentoReduzido() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/* Avisa as telas abertas para recarregar (concessão, avaliação, estorno). */
export function avisarAtualizacao() {
  window.dispatchEvent(new Event('estrelas-atualizadas'))
}
