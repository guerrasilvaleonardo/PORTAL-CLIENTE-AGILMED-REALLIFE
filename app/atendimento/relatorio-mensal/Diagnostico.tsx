'use client'

import { Fragment } from 'react'
import { horas, AMOSTRA_MINIMA } from '@/lib/relatorioDesempenho'
import type { Diagnostico, Distribuicao } from '@/lib/metricas/diagnostico'
import { DICIONARIO } from '@/lib/metricas/dicionario'

/*
 * Diagnóstico detalhado do mês (camada abaixo dos indicadores principais)
 * e o dicionário de indicadores. Os números vêm prontos do relatório
 * congelado (lib/metricas/diagnostico.ts); aqui só se desenha.
 */

const dias = (x: number | null) =>
  x === null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + (x === 1 ? ' dia' : ' dias')

function distTexto(d: Distribuicao, fmt: (x: number | null) => string) {
  if (!d.amostra) return 'sem dados'
  const base = `${fmt(d.mediana)} · P90 ${fmt(d.p90)}`
  return base
}

function baseTexto(d: Distribuicao) {
  if (!d.amostra) return '—'
  return `${d.amostra} chamado(s)${d.amostra < AMOSTRA_MINIMA ? ' · amostra pequena' : ''}`
}

type Linha = { k: string; a: string; ant: string; base: string }

export function DiagnosticoDetalhado({ atual, anterior, equipe = false }: { atual: Diagnostico; anterior: Diagnostico; equipe?: boolean }) {
  const linhas: { grupo: string; itens: Linha[] }[] = [
    {
      grupo: 'Entregas e demanda',
      itens: [
        { k: 'Pendências no início do mês', a: String(atual.pendentesInicio), ant: String(anterior.pendentesInicio), base: 'retrato no 1º instante do mês' },
        { k: equipe ? 'Chamados atribuídos (novos no mês)' : 'Chamados assumidos', a: String(atual.assumidos), ant: String(anterior.assumidos), base: equipe ? 'abertos no mês que já tiveram responsável' : 'atribuídos, recebidos ou abertos com a pessoa' },
        { k: 'Concluídos (por quem concluiu)', a: String(atual.concluidos), ant: String(anterior.concluidos), base: 'última conclusão no mês' },
        { k: 'Pendências no fim do mês', a: String(atual.pendentesFim), ant: String(anterior.pendentesFim), base: 'retrato no último instante (ou na geração)' },
        equipe
          ? { k: 'Transferências entre pessoas', a: String(atual.transferenciasRecebidas), ant: String(anterior.transferenciasRecebidas), base: 'trocas de responsável no mês' }
          : { k: 'Transferências recebidas / enviadas', a: `${atual.transferenciasRecebidas} / ${atual.transferenciasEnviadas}`, ant: `${anterior.transferenciasRecebidas} / ${anterior.transferenciasEnviadas}`, base: 'transferir pode ser o correto' },
        { k: 'Reaberturas registradas no mês', a: String(atual.reaberturas), ant: String(anterior.reaberturas), base: 'nem toda reabertura é retrabalho' },
      ],
    },
    {
      grupo: 'Prazos e fluidez',
      itens: [
        { k: '1ª resposta (mediana · P90)', a: distTexto(atual.primeiraResposta, horas), ant: distTexto(anterior.primeiraResposta, horas), base: baseTexto(atual.primeiraResposta) },
        { k: 'Resolução sem pausas (mediana · P90)', a: distTexto(atual.resolucao, horas), ant: distTexto(anterior.resolucao, horas), base: baseTexto(atual.resolucao) },
        { k: 'Tempo total para o cliente (mediana · P90)', a: distTexto(atual.experienciaClienteDias, dias), ant: distTexto(anterior.experienciaClienteDias, dias), base: 'dias corridos, com as pausas' },
        { k: 'Na fila sem responsável (mediana · P90)', a: distTexto(atual.filaSemResponsavel, horas), ant: distTexto(anterior.filaSemResponsavel, horas), base: baseTexto(atual.filaSemResponsavel) },
      ],
    },
    {
      grupo: 'Pendências no fim do mês',
      itens: [
        { k: 'Idade (mediana · mais antiga)', a: atual.pendencias.total ? `${dias(atual.pendencias.idadeMedianaDias)} · ${dias(atual.pendencias.idadeMaxDias)}` : '—', ant: anterior.pendencias.total ? `${dias(anterior.pendencias.idadeMedianaDias)} · ${dias(anterior.pendencias.idadeMaxDias)}` : '—', base: `${atual.pendencias.total} pendência(s)` },
        { k: 'Com mais de 30 dias', a: String(atual.pendencias.acima30Dias), ant: String(anterior.pendencias.acima30Dias), base: 'dias corridos desde a abertura' },
        { k: 'Vencidas / vencem em até 1 dia útil', a: `${atual.pendencias.vencidas} / ${atual.pendencias.vencemEm1DiaUtil}`, ant: `${anterior.pendencias.vencidas} / ${anterior.pendencias.vencemEm1DiaUtil}`, base: 'pausadas não contam como vencidas' },
      ],
    },
    {
      grupo: 'Qualidade',
      itens: [
        {
          k: 'Participação na avaliação',
          a: atual.avaliacao.participacaoPct === null ? '—' : `${atual.avaliacao.participacaoPct}% (${atual.avaliacao.respostas}/${atual.avaliacao.elegiveis})`,
          ant: anterior.avaliacao.participacaoPct === null ? '—' : `${anterior.avaliacao.participacaoPct}%`,
          base: 'concluídos de clientes; sem avaliação não é nota zero',
        },
      ],
    },
  ]

  const t = atual.tempos
  const totalSit = t.fila + t.atendimento + t.aguardandoCliente + t.suspenso
  const pctSit = (x: number) => (totalSit > 0 ? Math.round((100 * x) / totalSit) + '%' : '—')

  return (
    <div className="rel-diag">
      <div className="section-title" style={{ marginBottom: 8 }}>Diagnóstico detalhado</div>
      <div className="table-scroll">
        <table className="rel-tab">
          <thead>
            <tr>
              <th>Indicador</th>
              <th className="n">Este mês</th>
              <th className="n">Mês anterior</th>
              <th>Base e observação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((g) => (
              <Fragment key={g.grupo}>
                <tr className="rel-grupo">
                  <td colSpan={4}>{g.grupo}</td>
                </tr>
                {g.itens.map((l) => (
                  <tr key={g.grupo + l.k}>
                    <td>{l.k}</td>
                    <td className="n">{l.a}</td>
                    <td className="n">{l.ant}</td>
                    <td className="rel-obs">{l.base}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rel-grid2" style={{ marginTop: 12 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 6 }}>Para onde foi o tempo (concluídos do mês)</div>
          {t.amostra ? (
            <table className="rel-tab">
              <tbody>
                <tr><td>Na fila sem responsável</td><td className="n">{horas(t.fila)}</td><td className="n">{pctSit(t.fila)}</td></tr>
                <tr><td>Com responsável, sem pausa</td><td className="n">{horas(t.atendimento)}</td><td className="n">{pctSit(t.atendimento)}</td></tr>
                <tr><td>Aguardando o cliente</td><td className="n">{horas(t.aguardandoCliente)}</td><td className="n">{pctSit(t.aguardandoCliente)}</td></tr>
                <tr><td>Suspenso (dependência externa)</td><td className="n">{horas(t.suspenso)}</td><td className="n">{pctSit(t.suspenso)}</td></tr>
                {t.suspensoPorMotivo.map((m) => (
                  <tr key={m.motivo} className="rel-sub-linha"><td>· {m.motivo}</td><td className="n">{horas(m.horas)}</td><td /></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="rel-sub">Sem chamados concluídos no mês.</p>
          )}
          <p className="rel-obs" style={{ marginTop: 6 }}>
            Horas úteis somadas de {t.amostra} chamado(s). &ldquo;Com responsável&rdquo; não é tempo de trabalho efetivo (não há apontamento de horas).
          </p>
        </div>
        <div>
          <div className="section-title" style={{ marginBottom: 6 }}>Por prioridade</div>
          {atual.porPrioridade.length ? (
            <table className="rel-tab">
              <thead><tr><th>Prioridade</th><th className="n">Concluídos</th><th className="n">No prazo</th></tr></thead>
              <tbody>
                {atual.porPrioridade.map((p) => (
                  <tr key={p.prioridade}>
                    <td style={{ textTransform: 'capitalize' }}>{p.prioridade}</td>
                    <td className="n">{p.concluidos}</td>
                    <td className="n">{p.slaAvaliados ? `${Math.round((100 * p.slaCumpridos) / p.slaAvaliados)}% (${p.slaCumpridos}/${p.slaAvaliados})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="rel-sub">—</p>
          )}
          {equipe && atual.porCliente.length > 0 && (
            <>
              <div className="section-title" style={{ margin: '12px 0 6px' }}>Clientes com mais entregas</div>
              <table className="rel-tab">
                <tbody>
                  {atual.porCliente.map((c) => (
                    <tr key={c.cliente}><td>{c.cliente}</td><td className="n">{c.concluidos}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {atual.pausasLongas.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="section-title" style={{ marginBottom: 6 }}>Suspensões longas para verificação</div>
          <p className="rel-obs" style={{ marginBottom: 6 }}>
            Suspensões de 16h úteis ou mais. Servem para a gestão conferir o motivo e se havia ação possível — não indicam falha nem má-fé.
          </p>
          <table className="rel-tab">
            <tbody>
              {atual.pausasLongas.map((p, i) => (
                <tr key={i}><td>{p.numero ? '#' + p.numero : '—'}</td><td>{p.motivo}</td><td className="n">{horas(p.horasUteis)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function DicionarioIndicadores() {
  const grupos = [...new Set(DICIONARIO.map((m) => m.grupo))]
  return (
    <details className="rel-dicionario">
      <summary className="section-title" style={{ cursor: 'pointer' }}>
        Como cada indicador é calculado (dicionário)
      </summary>
      {grupos.map((g) => (
        <div key={g} style={{ marginTop: 12 }}>
          <div className="section-title" style={{ marginBottom: 6 }}>{g}</div>
          <table className="rel-tab">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Indicador</th>
                <th>Definição e fórmula</th>
                <th style={{ width: '28%' }}>Limitações</th>
              </tr>
            </thead>
            <tbody>
              {DICIONARIO.filter((m) => m.grupo === g).map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.nome}</strong>
                    {!m.disponivel && <div className="pill flat" style={{ marginTop: 4 }}>não disponível</div>}
                  </td>
                  <td>
                    {m.disponivel ? (
                      <>
                        {m.definicao} <span className="rel-obs">Fórmula: {m.formula} Fonte: {m.fonte}. Inclusão: {m.inclusao} Sem dado: {m.ausentes}</span>
                      </>
                    ) : (
                      <span className="rel-obs">Precisa passar a ser registrado: {m.precisa}</span>
                    )}
                  </td>
                  <td className="rel-obs">{m.limitacoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </details>
  )
}
