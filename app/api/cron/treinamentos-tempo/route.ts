/*
 * Leitura diaria do TEMPO DE ESTUDO no EAD (Maestrus), 40 min depois da
 * leitura do progresso (/api/cron/treinamentos). A rotina e a mesma; ao
 * ser chamada por este endereco, ela so abre os relatorios de desempenho
 * das matriculas ja gravadas e guarda o tempo total e por dia.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export { GET } from '../treinamentos/route'
