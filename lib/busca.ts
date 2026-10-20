/*
 * Busca tolerante: ignora acentos, maiúsculas, ordem das palavras e
 * conectivos ("da", "de", "dos"...). "antonio da conceicao lopes"
 * encontra "Antônio Conceição Lopes" e "LOPES, ANTONIO DA CONCEIÇÃO".
 */

const CONECTIVOS = new Set(['a', 'o', 'e', 'da', 'de', 'do', 'das', 'dos', 'em', 'na', 'no'])

export function normalizar(texto: string | number | null | undefined) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/* Palavras que precisam aparecer (sem conectivos). */
export function palavrasDaBusca(termo: string) {
  const palavras = normalizar(termo)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  const uteis = palavras.filter((p) => !CONECTIVOS.has(p))

  /* Se a busca for só conectivos (ex.: "de"), usa o que foi digitado. */
  return uteis.length ? uteis : palavras
}

/* Todas as palavras presentes no texto, em qualquer ordem. */
export function casaBusca(texto: string, palavras: string[]) {
  if (!palavras.length) return true

  const alvo = normalizar(texto)

  return palavras.every((p) => alvo.includes(p))
}

/*
 * Padrão para ilike no banco que aceita acento: troca vogais e "c" por
 * "_" (qualquer caractere). "conceicao" vira "_on_e___o" e encontra
 * "Conceição". O resultado é filtrado de novo com casaBusca.
 */
export function padraoSemAcento(palavra: string) {
  return '%' + normalizar(palavra).replace(/[aeiouc]/g, '_') + '%'
}
