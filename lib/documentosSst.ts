/*
 * Documentos SST (supabase/documentos-sst.sql): regras de prazo usadas
 * pela página /documentos e pelo alerta automático. Prazo e assinatura
 * são controles separados: um documento pode estar no prazo e ainda
 * sem a versão assinada.
 */

export type DocumentoSst = {
  id: string
  empresa_id: string
  unidade: string | null
  tipo_id: string
  titulo: string | null
  emissao: string | null
  vencimento: string | null
  sem_vencimento: boolean
  proxima_revisao: string | null
  revisao_pendente: boolean
  motivo_revisao: string | null
  responsavel_id: string | null
  responsavel_tecnico: string | null
  link_assinado: string | null
  versao: string | null
  observacoes: string | null
  alertas: number[] | null
  situacao: 'vigente' | 'substituido'
  substitui_id: string | null
  created_at: string
  updated_at?: string
}

export type TipoDocumento = {
  id: string
  nome: string
  sigla: string | null
  ordem: number
  ativo: boolean
}

export const ALERTAS_PADRAO = [90, 60, 30, 15, 7]

/* Data de hoje em Porto Velho, AAAA-MM-DD. */
export function hojePortoVelho() {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/* Dias corridos de hoje (Porto Velho) até a data. Negativo = passou. */
export function diasAteData(data: string | null | undefined, hoje = hojePortoVelho()) {
  if (!data) return null
  const a = Date.parse(hoje + 'T00:00:00Z')
  const b = Date.parse(data.slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

/* "2026-11-20" -> "20/11/2026", sem conversão de fuso. */
export function dataBr(data: string | null | undefined) {
  if (!data) return ''
  const [a, m, d] = data.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : ''
}

export function nomeDoTipo(t: Pick<TipoDocumento, 'nome' | 'sigla'> | null | undefined) {
  if (!t) return 'Documento'
  return t.sigla ? t.sigla : t.nome
}

/*
 * Faixa do VENCIMENTO. Cada documento vigente cai em uma só:
 * vencido, até 30, 31 a 60, 61 a 90, em dia (mais de 90),
 * sem vencimento fixo, ou vencimento não informado.
 */
export type FaixaVencimento = 'vencido' | 'ate30' | 'ate60' | 'ate90' | 'emdia' | 'sem_venc' | 'sem_data'

export function faixaVencimento(d: DocumentoSst, hoje?: string): FaixaVencimento {
  if (d.vencimento) {
    const dias = diasAteData(d.vencimento, hoje) as number
    if (dias < 0) return 'vencido'
    if (dias <= 30) return 'ate30'
    if (dias <= 60) return 'ate60'
    if (dias <= 90) return 'ate90'
    return 'emdia'
  }
  return d.sem_vencimento ? 'sem_venc' : 'sem_data'
}

/*
 * Revisão pendente: marcada à mão (ex.: mudou o processo, a função, o
 * layout) ou com a data da próxima revisão já passada.
 */
export function revisaoPendente(d: DocumentoSst, hoje?: string) {
  if (d.revisao_pendente) return true
  const dias = diasAteData(d.proxima_revisao, hoje)
  return dias !== null && dias < 0
}

/* O prazo mais próximo entre vencimento e revisão programada. */
export function proximoPrazo(d: DocumentoSst): { data: string; tipo: 'vencimento' | 'revisao' } | null {
  const v = d.vencimento
  const r = d.proxima_revisao
  if (v && (!r || v <= r)) return { data: v, tipo: 'vencimento' }
  if (r) return { data: r, tipo: 'revisao' }
  return null
}

/*
 * Marco de alerta em que o prazo está hoje: o menor marco configurado
 * que já foi alcançado (ex.: faltam 25 dias com marcos 90/60/30/15/7 ->
 * 30). -1 = vencido. null = ainda longe do primeiro marco.
 */
export function marcoAtual(dias: number | null, alertas: number[] | null | undefined) {
  if (dias === null) return null
  if (dias < 0) return -1
  /* Sem configuração usa o padrão; lista vazia = só avisa quando vencer. */
  const marcos = (alertas ?? ALERTAS_PADRAO).filter((m) => m >= 0)
  const alcancados = marcos.filter((m) => dias <= m)
  return alcancados.length ? Math.min(...alcancados) : null
}
