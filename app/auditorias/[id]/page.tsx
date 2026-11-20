/*
 * A tela de aplicar é a mesma da inspeção: a auditoria é uma linha de
 * inspecoes com tipo = 'auditoria', e aquela tela já muda sozinha —
 * quatro respostas, explicação do requisito, modelo para baixar e
 * evidência para enviar.
 *
 * Reaproveitar evita duas telas que precisam ser corrigidas duas vezes.
 * O que muda é o endereço, para o módulo ser um lugar só.
 */
export { default } from '../../inspecoes/[id]/page'
