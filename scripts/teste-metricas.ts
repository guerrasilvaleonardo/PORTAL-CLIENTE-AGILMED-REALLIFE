import { definirFeriados } from '@/lib/prazo'
import { montarLinhaDoTempo, retratoEm } from '@/lib/metricas/linhaTempo'
import { diagnosticar } from '@/lib/metricas/diagnostico'
definirFeriados([])
const ok = (c: boolean, m: string) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1 }
const T = (s: string) => s + ':00-04:00'
// Rodar: npx tsx scripts/teste-metricas.ts
// Caso 1: abre seg 3/11 8h sem responsável, assumido 10h por Ana, aguardando cliente 11h-14h, resolvido 16h.
const ev1 = [
  { tipo: 'responsavel', de: 'Sem responsavel', para: 'Ana', created_at: T('2026-11-03T10:00') },
  { tipo: 'status', de: 'aberto', para: 'aguardando_cliente', created_at: T('2026-11-03T11:00') },
  { tipo: 'status', de: 'aguardando_cliente', para: 'em_atendimento', created_at: T('2026-11-03T14:00') },
  { tipo: 'status', de: 'em_atendimento', para: 'resolvido', created_at: T('2026-11-03T16:00') },
]
const L1 = montarLinhaDoTempo({ created_at: T('2026-11-03T08:00'), status: 'resolvido', responsavelAtual: 'Ana' }, ev1, [], new Date(T('2026-11-30T12:00')))
ok(Math.abs(L1.tempos.fila - 2) < 0.01, 'fila 2h (8-10)')
ok(Math.abs(L1.tempos.atendimento - 3) < 0.01, 'atendimento 3h (10-11, 14-16)')
ok(Math.abs(L1.tempos.aguardandoCliente - 2) < 0.01, 'aguardando 2h úteis (11-12, 13-14)')
ok(L1.responsavelNaConclusao === 'Ana' && L1.concluidoEm === T('2026-11-03T16:00').replace(':00-04:00',':00-04:00'), 'concluído por Ana às 16h')
ok(Math.abs(L1.tempos.corridoH - 8) < 0.01, 'tempo corrido total 8h (experiência do cliente)')
// Caso 2: atravessa meses + transferência + suspensão + reabertura
const ev2 = [
  { tipo: 'status', de: 'aberto', para: 'suspenso', created_at: T('2026-10-30T09:00') },
  { tipo: 'status', de: 'suspenso', para: 'em_atendimento', created_at: T('2026-11-03T09:00') },
  { tipo: 'responsavel', de: 'Ana', para: 'Bia', created_at: T('2026-11-03T10:00') },
  { tipo: 'status', de: 'em_atendimento', para: 'resolvido', created_at: T('2026-11-04T09:00') },
  { tipo: 'status', de: 'resolvido', para: 'em_atendimento', created_at: T('2026-11-05T09:00') },
  { tipo: 'status', de: 'em_atendimento', para: 'resolvido', created_at: T('2026-11-05T11:00') },
]
const susp2 = [{ inicio: T('2026-10-30T09:00'), fim: T('2026-11-03T09:00'), motivo: 'Dependência de fornecedor' }]
const L2 = montarLinhaDoTempo({ created_at: T('2026-10-29T08:00'), status: 'resolvido', responsavelAtual: 'Bia' }, ev2, susp2, new Date(T('2026-11-30T12:00')))
ok(L2.transferencias === 1, '1 transferência Ana→Bia')
ok(L2.reaberturas === 1, '1 reabertura')
ok(L2.responsavelNaConclusao === 'Bia', 'conclusão creditada a Bia (quem concluiu)')
ok(Math.abs((L2.tempos.suspensoPorMotivo['Dependência de fornecedor'] || 0) - 16) < 0.01, 'suspenso 16h úteis (30/10 9h → 3/11 9h; 31/10 sex, fim de semana fora)')
const ini = new Date(T('2026-11-01T00:00')), fim = new Date(T('2026-12-01T00:00'))
ok(retratoEm(L2, ini).situacao === 'suspenso' && retratoEm(L2, ini).responsavel === 'Ana', 'pendente no início do mês com Ana (suspenso)')
const base = { numero: 2, categoria: 'SST', prioridade: 'normal', prazo_sla: null, sla_pausado_em: null, resolvido_em: T('2026-11-05T11:00'), encerrado_em: null, empresa: 'X', interno: false }
const ch = [{ ...base, id: 'c2', status: 'resolvido', created_at: T('2026-10-29T08:00'), responsavelNome: 'Bia', linha: L2, eventos: ev2 }]
const dA = diagnosticar({ chamados: ch as any, ini, fim, pessoa: 'Ana', primeiraResposta: {}, notas: [], agora: new Date(T('2026-12-02T00:00')) })
const dB = diagnosticar({ chamados: ch as any, ini, fim, pessoa: 'Bia', primeiraResposta: {}, notas: [], agora: new Date(T('2026-12-02T00:00')) })
ok(dA.pendentesInicio === 1 && dA.concluidos === 0 && dA.transferenciasEnviadas === 1, 'Ana: 1 pendente no início, 0 concluídos, 1 transferência enviada')
ok(dB.concluidos === 1 && dB.transferenciasRecebidas === 1 && dB.assumidos === 1 && dB.reaberturas === 1, 'Bia: 1 concluído, 1 recebida, 1 assumido, 1 reabertura')
ok(dB.avaliacao.elegiveis === 1 && dB.avaliacao.participacaoPct === 0, 'sem avaliação: participação 0%, não vira nota')
// Caso 3: chamado sem eventos (nasceu com responsável), aberto
const L3 = montarLinhaDoTempo({ created_at: T('2026-11-10T08:00'), status: 'aberto', responsavelAtual: 'Ana' }, [], [], new Date(T('2026-11-10T12:00')))
ok(Math.abs(L3.tempos.atendimento - 4) < 0.01 && L3.tempos.fila === 0, 'sem eventos: 4h com responsável, sem fila')
// Caso 4: amostra vazia
const d0 = diagnosticar({ chamados: [], ini, fim, pessoa: 'Zé', primeiraResposta: {}, notas: [], agora: new Date() })
ok(d0.resolucao.mediana === null && d0.avaliacao.participacaoPct === null, 'sem dados: null, não zero')
