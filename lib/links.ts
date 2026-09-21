export type ChamadoLink = {
  id: string
  chamado_id: string
  criado_por: string | null
  titulo: string | null
  url: string
  created_at: string
}

/*
 * Aceita o que a pessoa digitar e devolve uma URL utilizavel.
 * "portal.exemplo.com.br/doc" vira "https://portal.exemplo.com.br/doc".
 * Devolve string vazia quando o texto nao forma um endereco valido.
 */
export function normalizarUrl(texto: string): string {
  const limpo = (texto || '').trim()

  if (!limpo) return ''

  const comEsquema = /^https?:\/\//i.test(limpo)
    ? limpo
    : 'https://' + limpo

  try {
    const url = new URL(comEsquema)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    if (!url.hostname.includes('.')) return ''

    return url.toString()
  } catch {
    return ''
  }
}

export function rotuloDoLink(link: { titulo: string | null; url: string }) {
  if (link.titulo && link.titulo.trim()) return link.titulo.trim()

  try {
    const url = new URL(link.url)
    const caminho = url.pathname === '/' ? '' : url.pathname

    return url.hostname.replace(/^www\./, '') + caminho
  } catch {
    return link.url
  }
}
