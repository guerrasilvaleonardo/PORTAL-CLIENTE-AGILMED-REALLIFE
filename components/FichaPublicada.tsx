'use client'

import { rotuloMes, type Achado, type AnalisePessoa, type DadosRelatorio, type FichaPessoa } from '@/lib/relatorioDesempenho'
import type { Diagnostico } from '@/lib/metricas/diagnostico'
import { linhasIndicadores, ROTULO_EVIDENCIA } from '@/lib/relatorioFichaLinhas'
import { DiagnosticoDetalhado } from '@/app/atendimento/relatorio-mensal/Diagnostico'

/*
 * Cópia do relatório individual liberada pela direção para a pessoa
 * (supabase/desempenho-ciencia.sql). O conteúdo vem congelado no banco:
 * números da ficha e, se a direção escolheu, a síntese, os pontos fortes,
 * os pontos de atenção e o plano de ação. O roteiro da conversa e as
 * anotações de gestão não fazem parte da cópia.
 */

export type ConteudoPublicado = {
  mes: string
  versao: number
  parcial: boolean
  periodo: { ini: string; fim: string }
  anterior: { ini: string; fim: string }
  versaoRegras: number
  ficha: FichaPessoa
  medianas: DadosRelatorio['equipe']['medianas']
  diagnostico: { atual: Diagnostico; anterior: Diagnostico } | null
  analise: Omit<AnalisePessoa, 'roteiro_conversa'> | null
  analiseOrigem: string | null
  fontes: string[]
  limitacoes: string[]
}

function dataCurta(v: string) {
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Porto_Velho' })
}

function fimInclusivo(v: string) {
  return dataCurta(new Date(new Date(v).getTime() - 1).toISOString())
}

function Pill({ a }: { a: Achado }) {
  const cls = a.tipo === 'forte' ? 'good' : a.tipo === 'atencao' ? 'warn' : 'flat'
  const txt = a.tipo === 'forte' ? 'Forte' : a.tipo === 'atencao' ? 'Atenção' : 'Contexto'
  return <span className={'pill ' + cls}>{txt}</span>
}

export default function FichaPublicada({ c, mensagem }: { c: ConteudoPublicado; mensagem?: string | null }) {
  const p = c.ficha
  const an = c.analise
  const linhas = linhasIndicadores(p.atual, p.anterior, c.medianas)

  return (
    <section className="panel rel-ficha-publicada">
      <div className="panel-head">
        <div>
          <div className="section-title">
            Relatório individual de desempenho · {rotuloMes(c.mes)}
            {c.parcial ? ' (parcial)' : ''}
          </div>
          <h2 className="rel-ficha-nome">{p.nome}</h2>
          <p className="rel-sub">
            Período: {dataCurta(c.periodo.ini)} a {fimInclusivo(c.periodo.fim)} · comparado com {dataCurta(c.anterior.ini)} a{' '}
            {fimInclusivo(c.anterior.fim)}
            {p.amostraPequena && ' · amostra pequena: leia os números com cuidado'}
          </p>
        </div>
      </div>
      <div className="panel-body">
        {mensagem && (
          <div className="rel-aviso" style={{ background: 'var(--surface-2, #f2f4f3)' }}>
            <strong>Mensagem da direção:</strong> {mensagem}
          </div>
        )}

        {an?.sintese && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{an.sintese}</p>}

        <div className="table-scroll">
          <table className="rel-tab">
            <thead>
              <tr>
                <th>Indicador</th>
                <th className="n">Este mês</th>
                <th className="n">Mês anterior</th>
                <th className="n">Mediana da equipe</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.k}>
                  <td>{l.k}</td>
                  <td className="n">{l.a}</td>
                  <td className="n">{l.ant}</td>
                  <td className="n">{l.m || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {p.porCategoria.length > 0 && (
          <div className="table-scroll">
            <table className="rel-tab">
              <thead>
                <tr>
                  <th>Área</th>
                  <th className="n">Concluídos</th>
                  <th className="n">Prazo cumprido</th>
                </tr>
              </thead>
              <tbody>
                {p.porCategoria.map((x) => (
                  <tr key={x.categoria}>
                    <td>{x.categoria}</td>
                    <td className="n">{x.concluidos}</td>
                    <td className="n">{x.slaAvaliados ? Math.round((100 * x.slaCumpridos) / x.slaAvaliados) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {c.diagnostico && <DiagnosticoDetalhado atual={c.diagnostico.atual} anterior={c.diagnostico.anterior} />}

        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>O que os dados mostram</div>
          {p.achados.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {p.achados.map((x, i) => (
                <div key={i} className="rel-achado">
                  <Pill a={x} />
                  <span>{x.texto}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rel-sub">Nenhum ponto fora do padrão da equipe neste mês.</p>
          )}
        </div>

        {an && (
          <>
            <div className="rel-grid2">
              <div>
                <div className="section-title" style={{ marginBottom: 8 }}>Pontos fortes</div>
                {an.pontos_fortes?.length ? <ul className="rel-lista">{an.pontos_fortes.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="rel-sub">—</p>}
              </div>
              <div>
                <div className="section-title" style={{ marginBottom: 8 }}>Pontos de atenção</div>
                {an.pontos_atencao?.length ? <ul className="rel-lista">{an.pontos_atencao.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="rel-sub">—</p>}
              </div>
            </div>

            {an.plano_acao?.length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 8 }}>Plano de ação</div>
                <div className="table-scroll">
                  <table className="rel-tab">
                    <thead>
                      <tr>
                        <th>Ação</th>
                        <th>Indicador</th>
                        <th>Meta</th>
                        <th>Prazo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {an.plano_acao.map((x, i) => (
                        <tr key={i}>
                          <td>{x.acao}</td>
                          <td>{x.indicador}</td>
                          <td>{x.meta}</td>
                          <td>{x.prazo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {p.evidencias.length > 0 && (
          <details>
            <summary className="section-title" style={{ cursor: 'pointer' }}>
              Chamados citados ({p.evidencias.length})
            </summary>
            <div className="table-scroll" style={{ marginTop: 8 }}>
              <table className="rel-tab">
                <thead>
                  <tr>
                    <th>Chamado</th>
                    <th>Área</th>
                    <th>Ocorrência</th>
                  </tr>
                </thead>
                <tbody>
                  {p.evidencias.map((e, i) => (
                    <tr key={i}>
                      <td className="n" style={{ textAlign: 'left' }}>{e.numero ? '#' + e.numero : '—'}</td>
                      <td>{e.categoria}</td>
                      <td>
                        {ROTULO_EVIDENCIA[e.tipo] || e.tipo}
                        {e.detalhe ? ' — ' + e.detalhe : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {c.limitacoes?.length > 0 && (
          <details>
            <summary className="section-title" style={{ cursor: 'pointer' }}>
              Limitações dos dados
            </summary>
            <ul className="rel-lista" style={{ marginTop: 8 }}>
              {c.limitacoes.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </details>
        )}

        <p className="rel-sigilo">
          Os indicadores medem resultados registrados no portal; não avaliam perfil, saúde ou motivação.
          {c.analiseOrigem === 'ia' && ' O texto da análise foi escrito com apoio de IA a partir dos números e revisado pela direção antes de ser liberado.'}{' '}
          Relatório versão {c.versao}, regras versão {c.versaoRegras}.
        </p>
      </div>
    </section>
  )
}
