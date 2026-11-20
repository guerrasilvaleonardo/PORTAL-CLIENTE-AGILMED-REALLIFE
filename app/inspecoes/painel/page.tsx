'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'

/*
 * Painel das inspeções.
 *
 * Os dois relatórios que o Checklist Fácil tem e que fazem falta aqui:
 * INDICADORES, que é o resultado por local, e REINCIDÊNCIA, que é a
 * pergunta que falha de novo. Mais o que a 45001 cobra e eles não
 * mostram: a fila de não conformidades e os incidentes do período.
 *
 * POR QUE A REINCIDÊNCIA É O NÚMERO QUE IMPORTA. Uma inspeção com 95%
 * de conformidade parece ótima até se ver que o mesmo item reprova
 * todo mês: isso não é um achado, é um controle que não existe. O
 * percentual sozinho esconde exatamente o que precisa de ação.
 *
 * O período filtra a data da inspeção e a do incidente. Vazio = tudo.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const TIPO_INCIDENTE: Record<string, string> = {
  acidente_com_afastamento: 'Acidente com afastamento',
  acidente_sem_afastamento: 'Acidente sem afastamento',
  quase_acidente: 'Quase-acidente',
  doenca_ocupacional: 'Doença ocupacional',
  primeiros_socorros: 'Primeiros socorros',
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Inspecao = {
  id: string
  empresa_id: string
  modelo_nome: string
  local_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  itens_total: number
  conformes: number
  nao_conformes: number
  nao_aplicaveis: number
  percentual: number | null
}

type Resposta = { inspecao_id: string; pergunta: string; resposta: string | null }

type NC = {
  id: string
  empresa_id: string
  origem: string
  gravidade: string
  situacao: string
  prazo: string | null
  ocorrido_em: string | null
  tipo_incidente: string | null
  afastamento_dias: number | null
  created_at: string
  encerrada_em: string | null
}

const hoje = () => new Date().toISOString().slice(0, 10)
const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

function PainelInspecoesConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [inspecoes, setInspecoes] = useState<Inspecao[]>([])
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [ncs, setNcs] = useState<NC[]>([])

  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const { data: insp, error } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, modelo_nome, local_nome, iniciada_em, concluida_em, situacao, ' +
            'itens_total, conformes, nao_conformes, nao_aplicaveis, percentual'
        )
        .order('iniciada_em', { ascending: false })
        .limit(1000)

      if (error) {
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setInspecoes((insp || []) as unknown as Inspecao[])

      const [{ data: rs }, { data: ns }] = await Promise.all([
        supabase.from('inspecao_respostas').select('inspecao_id, pergunta, resposta').limit(20000),
        supabase
          .from('nao_conformidades')
          .select(
            'id, empresa_id, origem, gravidade, situacao, prazo, ocorrido_em, ' +
              'tipo_incidente, afastamento_dias, created_at, encerrada_em'
          )
          .limit(2000),
      ])

      setRespostas((rs || []) as unknown as Resposta[])
      setNcs((ns || []) as unknown as NC[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível montar o painel.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const noPeriodo = (data: string | null) => {
    const d = dia(data)
    if (!d) return false
    if (de && d < de) return false
    if (ate && d > ate) return false
    return true
  }

  /* Só inspeção concluída entra na conta: rascunho não é resultado. */
  const concluidas = useMemo(
    () =>
      inspecoes
        .filter((i) => !empresaAtual || i.empresa_id === empresaAtual)
        .filter((i) => i.situacao === 'concluida')
        .filter((i) => noPeriodo(i.concluida_em || i.iniciada_em)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inspecoes, empresaAtual, de, ate]
  )

  const ncsVisiveis = useMemo(
    () =>
      ncs
        .filter((n) => !empresaAtual || n.empresa_id === empresaAtual)
        .filter((n) => noPeriodo(n.ocorrido_em || n.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ncs, empresaAtual, de, ate]
  )

  /* ---------- Indicadores por local ---------- */
  const porLocal = useMemo(() => {
    const mapa = new Map<string, { aplicadas: number; itens: number; conf: number; nc: number }>()
    for (const i of concluidas) {
      const chave = i.local_nome || 'Sem local'
      const atual = mapa.get(chave) || { aplicadas: 0, itens: 0, conf: 0, nc: 0 }
      atual.aplicadas += 1
      atual.itens += i.itens_total
      atual.conf += i.conformes
      atual.nc += i.nao_conformes
      mapa.set(chave, atual)
    }
    return [...mapa.entries()]
      .map(([local, v]) => ({
        local,
        ...v,
        percentual: v.conf + v.nc > 0 ? Math.round((1000 * v.conf) / (v.conf + v.nc)) / 10 : null,
      }))
      .sort((a, b) => (a.percentual ?? 101) - (b.percentual ?? 101))
  }, [concluidas])

  /* ---------- Reincidência: a mesma pergunta falhando de novo ---------- */
  const reincidencia = useMemo(() => {
    const ids = new Set(concluidas.map((i) => i.id))
    const mapa = new Map<string, { avaliada: number; reprovada: number }>()
    for (const r of respostas) {
      if (!ids.has(r.inspecao_id) || !r.resposta || r.resposta === 'nao_aplicavel') continue
      const atual = mapa.get(r.pergunta) || { avaliada: 0, reprovada: 0 }
      atual.avaliada += 1
      if (r.resposta === 'nao_conforme') atual.reprovada += 1
      mapa.set(r.pergunta, atual)
    }
    return [...mapa.entries()]
      .map(([pergunta, v]) => ({
        pergunta,
        ...v,
        taxa: Math.round((1000 * v.reprovada) / v.avaliada) / 10,
      }))
      .filter((r) => r.reprovada > 0)
      .sort((a, b) => b.reprovada - a.reprovada || b.taxa - a.taxa)
      .slice(0, 15)
  }, [concluidas, respostas])

  /* ---------- Números do topo ---------- */
  const totais = useMemo(() => {
    const abertas = ncsVisiveis.filter((n) => !['encerrada', 'cancelada'].includes(n.situacao))
    const vencidas = abertas.filter((n) => n.prazo && n.prazo < hoje())
    const encerradas = ncsVisiveis.filter((n) => n.situacao === 'encerrada' && n.encerrada_em)

    const dias = encerradas.map((n) => {
      const a = Date.parse(dia(n.created_at) + 'T00:00:00Z')
      const b = Date.parse(dia(n.encerrada_em) + 'T00:00:00Z')
      return Math.max(0, Math.round((b - a) / 86400000))
    })

    const conf = concluidas.reduce((s, i) => s + i.conformes, 0)
    const nc = concluidas.reduce((s, i) => s + i.nao_conformes, 0)

    return {
      aplicadas: concluidas.length,
      conformidade: conf + nc > 0 ? Math.round((1000 * conf) / (conf + nc)) / 10 : null,
      abertas: abertas.length,
      vencidas: vencidas.length,
      mediaDias: dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null,
    }
  }, [concluidas, ncsVisiveis])

  /* ---------- Incidentes ---------- */
  const incidentes = useMemo(() => {
    const sos = ncsVisiveis.filter((n) => n.origem === 'incidente')
    const mapa = new Map<string, number>()
    for (const i of sos) {
      const k = i.tipo_incidente || 'sem tipo'
      mapa.set(k, (mapa.get(k) || 0) + 1)
    }
    return {
      total: sos.length,
      afastamento: sos.reduce((s, i) => s + (i.afastamento_dias || 0), 0),
      porTipo: [...mapa.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [ncsVisiveis])

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          As inspeções ainda não foram criadas no banco. Rode <code>supabase/inspecoes.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">Painel</h1>
        <p className="subtitulo-tela">
          O resultado por local, a pergunta que falha de novo e o que ainda falta tratar. Só
          inspeção concluída entra na conta — rascunho não é resultado.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <label className="caixa-marcar">
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="caixa-marcar">
          até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
      </div>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="num">{totais.aplicadas}</div>
              <div className="lbl">Inspeções concluídas</div>
            </div>
            <div className="stat">
              <div className="num">{totais.conformidade === null ? '—' : totais.conformidade + '%'}</div>
              <div className="lbl">Conformidade</div>
            </div>
            <div className={'stat' + (totais.abertas ? ' warn' : '')}>
              <div className="num">{totais.abertas}</div>
              <div className="lbl">Não conformidades abertas</div>
            </div>
            <div className={'stat' + (totais.vencidas ? ' bad' : '')}>
              <div className="num">{totais.vencidas}</div>
              <div className="lbl">Com prazo vencido</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Reincidência — a pergunta que falha de novo</div>
            </div>
            <div className="panel-body">
              {reincidencia.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhum item reprovado no período.
                </p>
              ) : (
                <table className="tabela-colab">
                  <thead>
                    <tr>
                      <th>Pergunta</th>
                      <th>Avaliada</th>
                      <th>Reprovada</th>
                      <th>Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reincidencia.map((r) => (
                      <tr key={r.pergunta}>
                        <td className="nome">{r.pergunta}</td>
                        <td>{r.avaliada}</td>
                        <td>{r.reprovada}</td>
                        <td>
                          {r.reprovada > 1 ? (
                            <span className="pill warn">{r.taxa}%</span>
                          ) : (
                            r.taxa + '%'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>
                Item que reprova mais de uma vez não é achado: é controle que não existe. O
                percentual de conformidade sozinho esconde justamente isso.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Resultado por local</div>
            </div>
            <div className="panel-body">
              {porLocal.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhuma inspeção concluída no período.
                </p>
              ) : (
                <table className="tabela-colab">
                  <thead>
                    <tr>
                      <th>Local</th>
                      <th>Inspeções</th>
                      <th>Itens</th>
                      <th>Não conformes</th>
                      <th>Conformidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porLocal.map((l) => (
                      <tr key={l.local}>
                        <td className="nome">{l.local}</td>
                        <td>{l.aplicadas}</td>
                        <td>{l.itens}</td>
                        <td>{l.nc}</td>
                        <td>
                          {l.percentual === null ? (
                            '—'
                          ) : l.percentual < 80 ? (
                            <span className="pill warn">{l.percentual}%</span>
                          ) : (
                            l.percentual + '%'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Incidentes no período</div>
            </div>
            <div className="panel-body">
              {incidentes.total === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhum incidente lançado no período.
                </p>
              ) : (
                <>
                  <div className="stats">
                    <div className="stat">
                      <div className="num">{incidentes.total}</div>
                      <div className="lbl">Incidentes</div>
                    </div>
                    <div className={'stat' + (incidentes.afastamento ? ' bad' : '')}>
                      <div className="num">{incidentes.afastamento}</div>
                      <div className="lbl">Dias de afastamento</div>
                    </div>
                    <div className="stat">
                      <div className="num">{totais.mediaDias === null ? '—' : totais.mediaDias}</div>
                      <div className="lbl">Dias médios até encerrar</div>
                    </div>
                  </div>
                  <table className="tabela-colab" style={{ marginTop: 10 }}>
                    <tbody>
                      {incidentes.porTipo.map(([tipo, n]) => (
                        <tr key={tipo}>
                          <td className="nome">{TIPO_INCIDENTE[tipo] || tipo}</td>
                          <td>{n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>
                O quase-acidente conta junto de propósito: é o aviso que chega antes do acidente, e
                empresa que não registra nenhum normalmente não está sem risco, está sem registro.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function PainelInspecoes() {
  return (
    <ComModulo modulo="inspecoes">
      <PainelInspecoesConteudo />
    </ComModulo>
  )
}
