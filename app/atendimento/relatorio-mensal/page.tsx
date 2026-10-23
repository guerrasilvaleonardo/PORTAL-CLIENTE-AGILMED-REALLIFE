'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  horas,
  rotuloMes,
  type Achado,
  type Analise,
  type DadosRelatorio,
  type FichaPessoa,
  type IndicadoresMes,
} from '@/lib/relatorioDesempenho'
import './relatorio.css'

/*
 * Relatório mensal de desempenho — governança (supabase/relatorio-desempenho.sql).
 * Só Leonardo Guerra e Priscila Vanzini (marcação no banco). O banco
 * recusa a leitura para qualquer outra pessoa; esta tela só desenha.
 */

type Resumo = {
  id: number
  mes: string
  versao: number
  parcial: boolean
  gerado_em: string
  gerado_por: string | null
  analise_origem: string | null
}

type Completo = Resumo & {
  dados: DadosRelatorio
  analise: Analise | null
  analise_modelo: string | null
  analise_erro: string | null
  analise_em: string | null
  analises_anteriores: any[]
}

type Acesso = { usuario_id: string; acao: string; em: string }

const ACAO: Record<string, string> = { abriu: 'abriu', pdf: 'baixou o PDF', gerou: 'gerou', reanalisou: 'refez a análise' }

function mesAnterior() {
  const agora = new Date(Date.now() - 4 * 3600000)
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1))
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
}

function mesAtual() {
  const agora = new Date(Date.now() - 4 * 3600000)
  return agora.getUTCFullYear() + '-' + String(agora.getUTCMonth() + 1).padStart(2, '0')
}

function dataHora(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Porto_Velho', dateStyle: 'short', timeStyle: 'short' })
}

function dataCurta(v: string) {
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Porto_Velho' })
}

function v(x: number | null | undefined, sufixo = '') {
  return x === null || x === undefined ? '—' : x.toLocaleString('pt-BR') + sufixo
}

function Delta({ atual, anterior, melhorMenor = false, sufixo = '' }: { atual: number | null; anterior: number | null; melhorMenor?: boolean; sufixo?: string }) {
  if (atual === null || anterior === null) return null
  const d = Math.round((atual - anterior) * 10) / 10
  if (d === 0) return <span className="rel-delta">=</span>
  const bom = melhorMenor ? d < 0 : d > 0
  return (
    <span className={'rel-delta ' + (bom ? 'up' : 'down')}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d).toLocaleString('pt-BR')}
      {sufixo}
    </span>
  )
}

function Indicador({ titulo, valor, extra, classe }: { titulo: string; valor: string; extra?: ReactNode; classe?: string }) {
  return (
    <div className={'stat ' + (classe || '')}>
      <div className="num" style={{ fontSize: 22 }}>
        {valor}
        {extra}
      </div>
      <div className="lbl">{titulo}</div>
    </div>
  )
}

function linhasIndicadores(a: IndicadoresMes, ant: IndicadoresMes, med?: DadosRelatorio['equipe']['medianas']) {
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

function PillAchado({ a }: { a: Achado }) {
  const cls = a.tipo === 'forte' ? 'good' : a.tipo === 'atencao' ? 'warn' : 'flat'
  const txt = a.tipo === 'forte' ? 'Forte' : a.tipo === 'atencao' ? 'Atenção' : 'Contexto'
  return <span className={'pill ' + cls}>{txt}</span>
}

function Ficha({ p, d, an }: { p: FichaPessoa; d: DadosRelatorio; an: Analise | null }) {
  const a = an?.pessoas?.[p.id]
  const linhas = linhasIndicadores(p.atual, p.anterior, d.equipe.medianas)

  return (
    <section className="panel rel-ficha" id={'ficha-' + p.id}>
      <div className="panel-head">
        <div>
          <div className="section-title">Ficha individual · {rotuloMes(d.mes)}</div>
          <h2 className="rel-ficha-nome">{p.nome}</h2>
          <p className="rel-sub">
            {p.perfil === 'atendimento' ? 'Atendimento' : p.perfil === 'gestor' ? 'Gestor' : 'Administrador'}
            {!p.ativo && ' · inativo'}
            {p.amostraPequena && ' · amostra pequena'}
          </p>
        </div>
      </div>
      <div className="panel-body">
        {a?.sintese && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{a.sintese}</p>}

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
                {p.porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td>{c.categoria}</td>
                    <td className="n">{c.concluidos}</td>
                    <td className="n">{c.slaAvaliados ? Math.round((100 * c.slaCumpridos) / c.slaAvaliados) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>O que os dados mostram (regras)</div>
          {p.achados.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {p.achados.map((x, i) => (
                <div key={i} className="rel-achado">
                  <PillAchado a={x} />
                  <span>{x.texto}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rel-sub">Nenhum ponto fora do padrão da equipe neste mês.</p>
          )}
        </div>

        {a && (
          <>
            <div className="rel-grid2">
              <div>
                <div className="section-title" style={{ marginBottom: 8 }}>Pontos fortes</div>
                {a.pontos_fortes.length ? (
                  <ul className="rel-lista">{a.pontos_fortes.map((t, i) => <li key={i}>{t}</li>)}</ul>
                ) : (
                  <p className="rel-sub">—</p>
                )}
              </div>
              <div>
                <div className="section-title" style={{ marginBottom: 8 }}>Pontos de atenção</div>
                {a.pontos_atencao.length ? (
                  <ul className="rel-lista">{a.pontos_atencao.map((t, i) => <li key={i}>{t}</li>)}</ul>
                ) : (
                  <p className="rel-sub">—</p>
                )}
              </div>
            </div>

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
                    {a.plano_acao.map((x, i) => (
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

            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>Roteiro da conversa individual</div>
              <ol className="rel-lista">{a.roteiro_conversa.map((t, i) => <li key={i}>{t}</li>)}</ol>
            </div>
          </>
        )}

        {p.evidencias.length > 0 && (
          <details>
            <summary className="section-title" style={{ cursor: 'pointer' }}>
              Evidências ({p.evidencias.length} chamado(s))
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
                        {{
                          sla_descumprido: 'Concluído fora do prazo',
                          sla_cumprido: 'Concluído no prazo',
                          reaberto: 'Reaberto após resolvido',
                          nota_ruim: 'Avaliação "Ruim"',
                          nota_excelente: 'Avaliação "Excelente"',
                          atrasado_aberto: 'Em aberto e atrasado',
                          prazo_negado: 'Alteração de prazo não autorizada',
                          cancelado: 'Cancelado',
                        }[e.tipo] || e.tipo}
                        {e.detalhe ? ' — ' + e.detalhe : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  )
}

export default function RelatorioMensalPage() {
  const [carregando, setCarregando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [lista, setLista] = useState<Resumo[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [rel, setRel] = useState<Completo | null>(null)
  const [pessoaSel, setPessoaSel] = useState('')
  const [mesGerar, setMesGerar] = useState(mesAnterior())
  const [trabalhando, setTrabalhando] = useState('')
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [acessos, setAcessos] = useState<Acesso[]>([])

  const carregarLista = useCallback(async () => {
    const { data, error } = await supabase
      .from('relatorios_desempenho')
      .select('id, mes, versao, parcial, gerado_em, gerado_por, analise_origem')
      .order('mes', { ascending: false })
      .order('versao', { ascending: false })
    if (error) throw error
    const l = (data || []) as Resumo[]
    setLista(l)
    return l
  }, [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
          return
        }
        const { data: pode, error: e1 } = await supabase.rpc('pode_ver_relatorio_gestao')
        if (e1) {
          if (vivo) {
            setPermitido(false)
            setErro('O relatório ainda não foi instalado no banco (supabase/relatorio-desempenho.sql).')
          }
          return
        }
        if (!vivo) return
        setPermitido(pode === true)
        if (pode !== true) return

        const l = await carregarLista()
        if (vivo && l.length) setSelId(l[0].id)

        const { data: pessoas } = await supabase.from('profiles').select('id, nome').in('perfil', ['atendimento', 'gestor', 'admin'])
        if (vivo) setNomes(Object.fromEntries(((pessoas || []) as any[]).map((p) => [p.id, p.nome || 'Sem nome'])))
      } catch (e: any) {
        if (vivo) setErro(e?.message || 'Não foi possível carregar.')
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [carregarLista])

  useEffect(() => {
    if (!selId) {
      setRel(null)
      return
    }
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.from('relatorios_desempenho').select('*').eq('id', selId).single()
      if (!vivo) return
      if (error) {
        setErro(error.message)
        return
      }
      setRel(data as Completo)
      setPessoaSel('')
      supabase.rpc('registrar_acesso_relatorio', { p_relatorio: selId, p_acao: 'abriu' }).then(() => carregarAcessos(selId))
    })()
    return () => {
      vivo = false
    }
  }, [selId])

  async function carregarAcessos(id: number) {
    const { data } = await supabase
      .from('relatorios_desempenho_acessos')
      .select('usuario_id, acao, em')
      .eq('relatorio_id', id)
      .order('em', { ascending: false })
      .limit(15)
    setAcessos((data || []) as Acesso[])
  }

  async function chamarApi(corpo: any) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const r = await fetch('/api/relatorio-desempenho', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (session?.access_token || '') },
      body: JSON.stringify(corpo),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.erro || 'Falha na operação.')
    return j
  }

  async function gerar() {
    const existe = lista.some((r) => r.mes.slice(0, 7) === mesGerar)
    if (existe && !window.confirm(`Já existe relatório de ${rotuloMes(mesGerar)}. Gerar uma NOVA versão? A versão atual continua guardada.`)) return
    setTrabalhando('gerar')
    setErro('')
    setAviso('')
    try {
      const j = await chamarApi({ acao: 'gerar', mes: mesGerar })
      await carregarLista()
      setSelId(j.id)
      setAviso(`Relatório de ${rotuloMes(mesGerar)} gerado (versão ${j.versao}).`)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setTrabalhando('')
    }
  }

  async function reanalisar() {
    if (!rel) return
    if (!window.confirm('Refazer o texto da análise? Os números não mudam e o texto atual fica guardado no histórico.')) return
    setTrabalhando('analisar')
    setErro('')
    setAviso('')
    try {
      const j = await chamarApi({ acao: 'analisar', id: rel.id })
      const { data } = await supabase.from('relatorios_desempenho').select('*').eq('id', rel.id).single()
      if (data) setRel(data as Completo)
      setAviso(j.aviso || 'Análise refeita.')
      carregarAcessos(rel.id)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setTrabalhando('')
    }
  }

  function imprimir() {
    if (!rel) return
    supabase.rpc('registrar_acesso_relatorio', { p_relatorio: rel.id, p_acao: 'pdf' }).then(() => carregarAcessos(rel.id))
    const titulo = document.title
    const quem = pessoaSel ? ' - ' + (rel.dados.pessoas.find((p) => p.id === pessoaSel)?.nome || '') : ' - equipe'
    document.title = 'Relatorio de desempenho ' + rel.dados.mes + quem
    window.print()
    setTimeout(() => (document.title = titulo), 1000)
  }

  const d = rel?.dados
  const an = rel?.analise || null
  const fichas = useMemo(() => (d ? d.pessoas.filter((p) => !pessoaSel || p.id === pessoaSel) : []), [d, pessoaSel])

  if (carregando) {
    return (
      <div className="app">
        <div className="empty-state">Carregando...</div>
      </div>
    )
  }

  if (!permitido) {
    return (
      <div className="app">
        <div className="panel" style={{ maxWidth: 640, margin: '24px auto' }}>
          <div className="panel-body" style={{ padding: 28 }}>
            <div className="section-title">Governança</div>
            <h1 style={{ fontSize: 24, margin: 0 }}>🔒 Relatório mensal de desempenho</h1>
            <p className="rel-sub">{erro || 'Acesso restrito à direção.'}</p>
            <div>
              <Link href="/atendimento/desempenho" className="btn btn-sm">Voltar ao desempenho da equipe</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const e = d?.equipe

  return (
    <div className="app">
      <div>
        <div className="section-title">Governança · confidencial</div>
        <h1 style={{ fontSize: 30, marginTop: 6 }}>Relatório mensal de desempenho</h1>
        <p className="rel-sub">
          Análise da equipe e fichas individuais com plano de ação. Acesso restrito à direção; cada abertura e cada PDF ficam registrados.
        </p>
      </div>

      <div className="filters nao-imprimir">
        <select value={selId ?? ''} onChange={(ev) => setSelId(Number(ev.target.value) || null)} aria-label="Relatório">
          {!lista.length && <option value="">Nenhum relatório gerado</option>}
          {lista.map((r) => (
            <option key={r.id} value={r.id}>
              {rotuloMes(r.mes.slice(0, 7))} · versão {r.versao}
              {r.parcial ? ' (parcial)' : ''}
            </option>
          ))}
        </select>

        {d && (
          <select value={pessoaSel} onChange={(ev) => setPessoaSel(ev.target.value)} aria-label="Pessoa">
            <option value="">Equipe toda + todas as fichas</option>
            {d.pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                Só a ficha de {p.nome}
              </option>
            ))}
          </select>
        )}

        {rel && (
          <button className="btn btn-sm btn-primary" onClick={imprimir}>
            Baixar PDF
          </button>
        )}
        {rel && (
          <button className="btn btn-sm" onClick={reanalisar} disabled={!!trabalhando}>
            {trabalhando === 'analisar' ? 'Analisando...' : rel.analise ? 'Refazer análise' : 'Gerar análise'}
          </button>
        )}

        <div style={{ flex: 1 }} />

        <input
          type="month"
          value={mesGerar}
          max={mesAtual()}
          min="2024-01"
          onChange={(ev) => setMesGerar(ev.target.value)}
          aria-label="Mês para gerar"
          style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '7px 10px', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)' }}
        />
        <button className="btn btn-sm" onClick={gerar} disabled={!!trabalhando}>
          {trabalhando === 'gerar' ? 'Gerando (até 1 min)...' : 'Gerar relatório do mês'}
        </button>
      </div>

      {erro && <div className="rel-aviso nao-imprimir" style={{ background: 'var(--danger-tint)' }}>{erro}</div>}
      {aviso && <div className="rel-aviso nao-imprimir">{aviso}</div>}

      {!rel && !lista.length && (
        <div className="panel">
          <div className="empty-state">
            Nenhum relatório ainda. O primeiro é gerado automaticamente no dia 1º; se quiser ver agora, escolha o mês e clique em
            &quot;Gerar relatório do mês&quot;.
          </div>
        </div>
      )}

      {rel && d && e && (
        <>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="section-title">Relatório de {rotuloMes(d.mes)} · versão {rel.versao}</div>
                <p className="rel-sub">
                  Período: {dataCurta(d.periodo.ini)} a {dataCurta(new Date(new Date(d.periodo.fim).getTime() - 1).toISOString())}
                  {d.parcial && ' (PARCIAL — mês em andamento)'} · gerado em {dataHora(rel.gerado_em)}{' '}
                  {rel.gerado_por ? 'por ' + (nomes[rel.gerado_por] || 'usuário') : 'automaticamente'}
                </p>
                <p className="rel-sub">
                  Análise:{' '}
                  {rel.analise_origem === 'ia'
                    ? `escrita por IA (${rel.analise_modelo}) a partir dos dados calculados por regras`
                    : rel.analise_origem === 'regras'
                      ? 'por regras automáticas'
                      : 'pendente'}
                  {rel.analise_em && ' · ' + dataHora(rel.analise_em)}
                  {rel.analises_anteriores?.length ? ` · ${rel.analises_anteriores.length} versão(ões) anterior(es) do texto guardada(s)` : ''}
                </p>
              </div>
            </div>
            {rel.analise_erro && (
              <div className="panel-body nao-imprimir">
                <div className="rel-aviso">{rel.analise_erro}</div>
              </div>
            )}
          </div>

          {!pessoaSel && (
            <>
              <div className="stats">
                <Indicador titulo="Chamados recebidos" valor={v(e.atual.recebidos)} extra={<Delta atual={e.atual.recebidos} anterior={e.anterior.recebidos} />} />
                <Indicador titulo="Chamados concluídos" valor={v(e.atual.concluidos)} extra={<Delta atual={e.atual.concluidos} anterior={e.anterior.concluidos} />} />
                <Indicador
                  titulo="Prazo cumprido"
                  valor={v(e.atual.slaPct, '%')}
                  extra={<Delta atual={e.atual.slaPct} anterior={e.anterior.slaPct} sufixo=" p.p." />}
                />
                <Indicador
                  titulo="Reabertura"
                  valor={v(e.atual.reaberturaPct, '%')}
                  extra={<Delta atual={e.atual.reaberturaPct} anterior={e.anterior.reaberturaPct} melhorMenor sufixo=" p.p." />}
                />
                <Indicador titulo="1ª resposta (mediana)" valor={horas(e.atual.primeiraRespostaMediana)} />
                <Indicador titulo="Resolução (mediana)" valor={horas(e.atual.resolucaoMediana)} />
                <Indicador titulo="Atrasados em aberto (na geração)" valor={v(e.atual.atrasados)} classe={e.atual.atrasados ? 'warn' : 'good'} />
                <Indicador
                  titulo="Avaliações: Excelente · Bom · Ruim"
                  valor={`${e.atual.notas.excelente} · ${e.atual.notas.bom} · ${e.atual.notas.ruim}`}
                  classe={e.atual.notas.ruim ? 'warn' : ''}
                />
              </div>

              {an && (
                <div className="panel">
                  <div className="panel-head">
                    <div className="section-title">Análise da equipe (governança)</div>
                  </div>
                  <div className="panel-body">
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{an.equipe.sintese}</p>
                    <div className="rel-grid2">
                      <div>
                        <div className="section-title" style={{ marginBottom: 8 }}>Destaques</div>
                        {an.equipe.destaques.length ? <ul className="rel-lista">{an.equipe.destaques.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="rel-sub">—</p>}
                      </div>
                      <div>
                        <div className="section-title" style={{ marginBottom: 8 }}>Riscos e pontos de atenção</div>
                        {an.equipe.riscos.length ? <ul className="rel-lista">{an.equipe.riscos.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="rel-sub">—</p>}
                      </div>
                    </div>
                    <div>
                      <div className="section-title" style={{ marginBottom: 8 }}>Recomendações para o próximo mês</div>
                      <ol className="rel-lista">{an.equipe.recomendacoes.map((t, i) => <li key={i}>{t}</li>)}</ol>
                    </div>
                  </div>
                </div>
              )}

              <div className="rel-grid2">
                <div className="panel">
                  <div className="panel-head">
                    <div className="section-title">Por área (concluídos no mês)</div>
                  </div>
                  <div className="panel-body">
                    {e.porCategoria.length ? (
                      <table className="rel-tab">
                        <thead>
                          <tr>
                            <th>Área</th>
                            <th className="n">Concluídos</th>
                            <th className="n">Prazo cumprido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.porCategoria.map((c) => (
                            <tr key={c.categoria}>
                              <td>{c.categoria}</td>
                              <td className="n">{c.concluidos}</td>
                              <td className="n">{c.slaAvaliados ? Math.round((100 * c.slaCumpridos) / c.slaAvaliados) + '%' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="rel-sub">Nenhum chamado concluído no período.</p>
                    )}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head">
                    <div className="section-title">Visão por pessoa</div>
                  </div>
                  <div className="panel-body">
                    <table className="rel-tab">
                      <thead>
                        <tr>
                          <th>Pessoa</th>
                          <th className="n">Concl.</th>
                          <th className="n">Prazo</th>
                          <th className="n">Forte / Atenção</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.pessoas.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <a href={'#ficha-' + p.id}>{p.nome}</a>
                            </td>
                            <td className="n">{p.atual.concluidos}</td>
                            <td className="n">{v(p.atual.slaPct, '%')}</td>
                            <td className="n">
                              {p.achados.filter((x) => x.tipo === 'forte').length} / {p.achados.filter((x) => x.tipo === 'atencao').length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {e.cancelamentosPorMotivo.length > 0 && (
                      <p className="rel-sub">
                        Cancelados no mês: {e.cancelamentosPorMotivo.map((c) => `${c.motivo} (${c.total})`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {fichas.map((p) => (
            <Ficha key={p.id} p={p} d={d} an={an} />
          ))}

          <div className="panel rel-ficha-final">
            <div className="panel-head">
              <div className="section-title">O que foi analisado</div>
            </div>
            <div className="panel-body">
              <p className="rel-sub" style={{ color: 'var(--ink)' }}>
                Período de {dataCurta(d.periodo.ini)} a {dataCurta(new Date(new Date(d.periodo.fim).getTime() - 1).toISOString())}, comparado com{' '}
                {dataCurta(d.anterior.ini)} a {dataCurta(new Date(new Date(d.anterior.fim).getTime() - 1).toISOString())}. {e.atual.recebidos} chamado(s)
                recebidos e {e.atual.concluidos} concluídos; {e.pessoasAvaliadas} pessoa(s) avaliadas. Regras versão {d.versaoRegras}.
              </p>
              <div className="rel-grid2">
                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>Fontes de dados</div>
                  <ul className="rel-lista">{d.fontes.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>Limitações</div>
                  <ul className="rel-lista">{d.limitacoes.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              </div>
              <p className="rel-sigilo">
                Documento confidencial de gestão. É apoio à decisão: as conclusões sobre cada pessoa são da direção, depois de ouvir o
                colaborador. Os indicadores medem comportamentos e resultados registrados no portal; não avaliam perfil, saúde ou
                motivação. Para a análise por IA, o portal envia só números e códigos (sem nomes, clientes ou textos de mensagens).
              </p>
            </div>
          </div>

          {acessos.length > 0 && (
            <div className="panel nao-imprimir">
              <div className="panel-head">
                <div className="section-title">Registro de acesso a este relatório</div>
              </div>
              <div className="panel-body">
                <ul className="rel-lista" style={{ fontSize: 13 }}>
                  {acessos.map((x, i) => (
                    <li key={i}>
                      {dataHora(x.em)} — {nomes[x.usuario_id] || 'usuário'} {ACAO[x.acao] || x.acao}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
