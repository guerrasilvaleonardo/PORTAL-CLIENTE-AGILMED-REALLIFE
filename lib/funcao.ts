/*
 * A chave da função, igual à do banco (public.epi_funcao_chave, em
 * supabase/epi-por-funcao.sql).
 *
 * A função do trabalhador é texto livre: "Pedreiro", "PEDREIRO " e
 * "pedreiro" são a mesma coisa para quem trabalha e três coisas para o
 * banco. A chave tira acento, espaço sobrando e maiúscula/minúscula,
 * só para casar o trabalhador com a lista de EPI da função dele.
 *
 * O que foi digitado continua intacto: é o que sai na ficha.
 *
 * As duas versões — esta e a do SQL — precisam concordar. Se mexer numa,
 * mexa na outra.
 */

const SEM_ACENTO: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}

export function chaveDaFuncao(texto: string | null | undefined): string {
  const limpo = (texto || '').trim().replace(/\s+/g, ' ')
  if (!limpo) return ''
  return limpo
    .split('')
    .map((c) => SEM_ACENTO[c.toLowerCase()] ?? c)
    .join('')
    .toUpperCase()
}
