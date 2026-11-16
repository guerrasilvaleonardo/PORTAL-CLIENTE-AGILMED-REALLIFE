/*
 * Nome do certificado para mostrar e enviar.
 *
 * "Outro" é o tipo escolhido quando o curso não está na lista fixa (ex.:
 * NR-26). Gravado continua "Outro", para não mexer no histórico nem nos
 * filtros, mas na tela, na planilha e no e-mail aparece o nome do curso
 * ("NR 26 | SINALIZAÇÃO DE SEGURANÇA"), que é o que está no certificado.
 */
export function nomeDoTipo(c: { tipo?: string | null; curso?: string | null }) {
  const tipo = (c.tipo || '').trim()
  const curso = (c.curso || '').trim()

  return tipo === 'Outro' && curso ? curso : tipo
}
