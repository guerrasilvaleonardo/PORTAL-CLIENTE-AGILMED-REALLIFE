import { horas, type DadosRelatorio, type IndicadoresMes } from '@/lib/relatorioDesempenho'

/*
 * Linhas da tabela de indicadores da ficha individual. Usada no relatório
 * da direção e na cópia liberada ao colaborador ("Meu desempenho"), para
 * os dois mostrarem exatamente os mesmos números.
 */

export function v(x: number | null | undefined, sufixo = '') {
  return x === null || x === undefined ? '—' : x.toLocaleString('pt-BR') + sufixo
}

export function linhasIndicadores(a: IndicadoresMes, ant: IndicadoresMes, med?: DadosRelatorio['equipe']['medianas']) {
  return [
    { k: 'Recebidos', a: v(a.recebidos), ant: v(ant.recebidos), m: '' },
    { k: 'Concluídos', a: v(a.concluidos), ant: v(ant.concluidos), m: med ? v(med.concluidos) : '' },
    { k: 'Prazo cumprido', a: v(a.slaPct, '%') + ` (${a.slaCumpridos}/${a.slaAvaliados})`, ant: v(ant.slaPct, '%'), m: med ? v(med.slaPct, '%') : '' },
    { k: '1ª resposta (mediana)', a: horas(a.primeiraRespostaMediana), ant: horas(ant.primeiraRespostaMediana), m: med ? horas(med.primeiraResposta) : '' },
    { k: 'Resolução (mediana)', a: horas(a.resolucaoMediana), ant: horas(ant.resolucaoMediana), m: med ? horas(med.resolucao) : '' },
    { k: 'Reabertos', a: v(a.reabertos) + (a.reaberturaPct !== null ? ` (${a.reaberturaPct}%)` : ''), ant: v(ant.reabertos), m: med ? v(med.reaberturaPct, '%') : '' },
    { k: 'Avaliações do cliente', a: `${a.notas.excelente} Excelente · ${a.notas.bom} Bom · ${a.notas.ruim} Ruim`, ant: `${ant.notas.excelente} · ${ant.notas.bom} · ${ant.notas.ruim}`, m: '' },
    { k: 'Estrelas válidas', a: `${a.estrelas.total} (${a.estrelas.prazo} prazo + ${a.estrelas.avaliacao} avaliação)`, ant: v(ant.estrelas.total), m: '' },
    { k: 'Estrelas suspensas / estornadas', a: `${a.estrelas.suspensas} / ${a.estrelas.estornadas}`, ant: `${ant.estrelas.suspensas} / ${ant.estrelas.estornadas}`, m: '' },
    { k: 'Alterações de prazo (não autorizadas)', a: `${a.prazoAlteracoes.total} (${a.prazoAlteracoes.negadas})`, ant: `${ant.prazoAlteracoes.total} (${ant.prazoAlteracoes.negadas})`, m: '' },
    { k: 'Cancelados', a: v(a.cancelados), ant: v(ant.cancelados), m: '' },
    { k: 'Mensagens escritas nos chamados', a: v(a.mensagens), ant: '—', m: '' },
    { k: 'Carteira em aberto / atrasados (na geração)', a: `${a.carteira} / ${a.atrasados}`, ant: '—', m: '' },
  ]
}

export const ROTULO_EVIDENCIA: Record<string, string> = {
  sla_descumprido: 'Concluído fora do prazo',
  sla_cumprido: 'Concluído no prazo',
  reaberto: 'Reaberto após resolvido',
  nota_ruim: 'Avaliação "Ruim"',
  nota_excelente: 'Avaliação "Excelente"',
  atrasado_aberto: 'Em aberto e atrasado',
  prazo_negado: 'Alteração de prazo não autorizada',
  cancelado: 'Cancelado',
}
