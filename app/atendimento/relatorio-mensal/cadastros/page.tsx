'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { horas, rotuloMes, type DadosRelatorio } from '@/lib/relatorioDesempenho'
import '../relatorio.css'

/*
 * Gestão de desempenho — etapa 2: cadastros de contexto e metas
 * (supabase/desempenho-cadastros.sql). Só a direção.
 *
 * - Perfil de trabalho: função, equipe, gestor, início na função, jornada.
 * - Ausências: férias, afastamentos, folgas, treinamentos (só tipo e datas;
 *   motivo de saúde NÃO se registra).
 * - Metas: o portal mostra a LINHA DE BASE (últimos meses fechados, dos
 *   relatórios já gerados) e PROPÕE uma meta por regra explícita; a direção
 *   aprova ou ajusta. Meta aprovada não muda: encerra-se e cria-se outra.
 */

type Pessoa = { id: string; nome: string; perfil: string; ativo: boolean }
type Perfil = {
  pessoa_id: string
  funcao: string | null
  equipe: string | null
  gestor_id: string | null
  inicio_funcao: string | null
  jornada_horas_semana: number | null
  observacao: string | null
  atualizado_em?: string
}
type Ausencia = { id: number; pessoa_id: string; tipo: string; inicio: string; fim: string; observacao: string | null }
type Meta = {
  id: number
  indicador: string
  pessoa_id: string | null
  valor: number
  unidade: string
  direcao: 'maior' | 'menor'
  linha_base: number | null
  base_texto: string | null
  vigencia_inicio: string
  vigencia_fim: string | null
  situacao: 'proposta' | 'aprovada' | 'encerrada'
  justificativa: string | null
  aprovada_em: string | null
}

const TIPOS_AUSENCIA: Record<string, string> = {
  ferias: 'Férias',
  afastamento: 'Afastamento',
  folga: 'Folga / compensação',
  treinamento: 'Treinamento',
  outro: 'Outro',
}

/* Indicadores com meta possível hoje (dados existentes nos relatórios). */
const INDICADORES_META: {
  id: string
  nome: string
  unidade: '%' | 'horas úteis'
  direcao: 'maior' | 'menor'
  ler: (d: DadosRelatorio) => number | null
}[] = [
  { id: 'sla_resolucao', nome: 'Prazo de resolução cumprido', unidade: '%', direcao: 'maior', ler: (d) => d.equipe.atual.slaPct },
  { id: 'primeira_resposta', nome: '1ª resposta (mediana)', unidade: 'horas úteis', direcao: 'menor', ler: (d) => d.equipe.atual.primeiraRespostaMediana },
  { id: 'resolucao', nome: 'Resolução (mediana)', unidade: 'horas úteis', direcao: 'menor', ler: (d) => d.equipe.atual.resolucaoMediana },
  { id: 'reabertura', nome: 'Reabertura', unidade: '%', direcao: 'menor', ler: (d) => d.equipe.atual.reaberturaPct },
  {
    id: 'satisfacao',
    nome: 'Participação na avaliação',
    unidade: '%',
    direcao: 'maior',
    /* Só existe nos relatórios com diagnóstico detalhado (etapa 1). */
    ler: (d) => d.diagnostico?.equipe.atual.avaliacao.participacaoPct ?? null,
  },
]

const MESES_BASE = 3

function hoje() {
  const d = new Date(Date.now() - 4 * 3600000)
  return d.toISOString().slice(0, 10)
}
function primeiroDoProximoMes() {
  const d = new Date(Date.now() - 4 * 3600000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
}
function dataBr(v: string | null) {
  if (!v) return '—'
  const [a, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}
function fmt(v: number | null, unidade: string) {
  if (v === null || v === undefined) return '—'
  if (unidade === 'horas úteis') return horas(v)
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + (unidade === '%' ? '%' : ' ' + unidade)
}

export default function CadastrosDesempenhoPage() {
  const [aba, setAba] = useState<'perfil' | 'ausencias' | 'metas'>('perfil')
  const [carregando, setCarregando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [semTabelas, setSemTabelas] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({})
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [historico, setHistorico] = useState<{ mes: string; dados: DadosRelatorio }[]>([])
  const [editando, setEditando] = useState<Perfil | null>(null)
  const [novaAus, setNovaAus] = useState({ pessoa_id: '', tipo: 'ferias', inicio: hoje(), fim: hoje(), observacao: '' })
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setErro('')
    const p = await supabase.from('desempenho_perfil').select('*')
    if (p.error) {
      if (p.error.code === '42P01' || /does not exist|schema cache/i.test(p.error.message)) {
        setSemTabelas(true)
        return
      }
      throw p.error
    }
    setPerfis(Object.fromEntries(((p.data || []) as Perfil[]).map((x) => [x.pessoa_id, x])))
    const a = await supabase.from('desempenho_ausencias').select('*').order('inicio', { ascending: false }).limit(300)
    if (a.error) throw a.error
    setAusencias((a.data || []) as Ausencia[])
    const m = await supabase.from('desempenho_metas').select('*').order('vigencia_inicio', { ascending: false })
    if (m.error) throw m.error
    setMetas((m.data || []) as Meta[])
  }

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
        if (!vivo) return
        if (e1 || pode !== true) {
          setPermitido(false)
          return
        }
        setPermitido(true)

        const { data: ps } = await supabase.from('profiles').select('id, nome, perfil, ativo').in('perfil', ['atendimento', 'gestor', 'admin']).order('nome')
        if (vivo) setPessoas(((ps || []) as any[]).map((x) => ({ id: x.id, nome: x.nome || 'Sem nome', perfil: x.perfil, ativo: x.ativo !== false })))

        /* Últimos relatórios FECHADOS (não parciais): a versão mais nova de cada mês. */
        const { data: rels } = await supabase
          .from('relatorios_desempenho')
          .select('mes, versao, parcial, dados')
          .eq('parcial', false)
          .order('mes', { ascending: false })
          .order('versao', { ascending: false })
          .limit(24)
        const porMes = new Map<string, DadosRelatorio>()
        for (const r of (rels || []) as any[]) {
          const k = String(r.mes).slice(0, 7)
          if (!porMes.has(k)) porMes.set(k, r.dados as DadosRelatorio)
        }
        if (vivo) setHistorico([...porMes.entries()].slice(0, MESES_BASE).map(([mes, dados]) => ({ mes, dados })))

        await carregar()
      } catch (e: any) {
        if (vivo) setErro(e?.message || 'Não foi possível carregar.')
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  const nomeDe = useMemo(() => Object.fromEntries(pessoas.map((p) => [p.id, p.nome])), [pessoas])

  /* Linha de base e proposta de cada indicador (regra explícita). */
  const bases = useMemo(
    () =>
      INDICADORES_META.map((ind) => {
        const valores = historico.map((h) => ({ mes: h.mes, v: ind.ler(h.dados) })).filter((x) => x.v !== null) as { mes: string; v: number }[]
        if (!valores.length) return { ind, valores, base: null as number | null, proposta: null as number | null }
        const base = Math.round((10 * valores.reduce((s, x) => s + x.v, 0)) / valores.length) / 10
        const melhor = ind.direcao === 'maior' ? Math.max(...valores.map((x) => x.v)) : Math.min(...valores.map((x) => x.v))
        return { ind, valores, base, proposta: Math.round(melhor * 10) / 10 }
      }),
    [historico]
  )

  async function salvarPerfil() {
    if (!editando) return
    setSalvando(true)
    setErro('')
    const { error } = await supabase.from('desempenho_perfil').upsert({
      pessoa_id: editando.pessoa_id,
      funcao: editando.funcao?.trim() || null,
      equipe: editando.equipe?.trim() || null,
      gestor_id: editando.gestor_id || null,
      inicio_funcao: editando.inicio_funcao || null,
      jornada_horas_semana: editando.jornada_horas_semana ? Number(editando.jornada_horas_semana) : null,
      observacao: editando.observacao?.trim() || null,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setEditando(null)
    setAviso('Perfil salvo.')
    await carregar()
  }

  async function incluirAusencia() {
    if (!novaAus.pessoa_id) return setErro('Escolha a pessoa.')
    if (novaAus.fim < novaAus.inicio) return setErro('A data final não pode ser antes da inicial.')
    setSalvando(true)
    setErro('')
    const { error } = await supabase.from('desempenho_ausencias').insert({
      pessoa_id: novaAus.pessoa_id,
      tipo: novaAus.tipo,
      inicio: novaAus.inicio,
      fim: novaAus.fim,
      observacao: novaAus.observacao.trim() || null,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setAviso('Ausência registrada.')
    setNovaAus({ ...novaAus, observacao: '' })
    await carregar()
  }

  async function proporMeta(b: (typeof bases)[number], valor: number, aprovar: boolean) {
    setSalvando(true)
    setErro('')
    const { error } = await supabase.from('desempenho_metas').insert({
      indicador: b.ind.id,
      pessoa_id: null,
      valor,
      unidade: b.ind.unidade,
      direcao: b.ind.direcao,
      linha_base: b.base,
      base_texto: b.valores.map((x) => `${rotuloMes(x.mes)}: ${fmt(x.v, b.ind.unidade)}`).join(' · '),
      vigencia_inicio: primeiroDoProximoMes(),
      situacao: aprovar ? 'aprovada' : 'proposta',
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setAviso(aprovar ? 'Meta aprovada. Vale a partir do próximo mês.' : 'Proposta registrada para aprovação.')
    await carregar()
  }

  async function mudarSituacao(m: Meta, situacao: 'aprovada' | 'encerrada') {
    setSalvando(true)
    setErro('')
    const { error } = await supabase
      .from('desempenho_metas')
      .update(situacao === 'encerrada' ? { situacao, vigencia_fim: hoje() } : { situacao })
      .eq('id', m.id)
    setSalvando(false)
    if (error) return setErro(error.message)
    setAviso(situacao === 'aprovada' ? 'Meta aprovada.' : 'Meta encerrada (continua no histórico).')
    await carregar()
  }

  if (carregando) return <div className="app"><p className="rel-sub">Carregando...</p></div>

  if (!permitido) {
    return (
      <div className="app">
        <div className="panel" style={{ maxWidth: 640, margin: '24px auto' }}>
          <div className="panel-body" style={{ padding: 28 }}>
            <h1 style={{ fontSize: 24, margin: 0 }}>🔒 Cadastros do desempenho</h1>
            <p className="rel-sub">Acesso restrito à direção.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <div className="section-title">Governança · confidencial</div>
        <h1 style={{ fontSize: 30, marginTop: 6 }}>Cadastros do desempenho</h1>
        <p className="rel-sub">
          Contexto de cada pessoa e metas aprovadas, usados pelo relatório mensal. Toda alteração guarda quem fez e quando.
        </p>
      </div>

      <div className="filters">
        {(['perfil', 'ausencias', 'metas'] as const).map((k) => (
          <button key={k} className={'btn btn-sm' + (aba === k ? ' btn-primary' : '')} aria-pressed={aba === k} onClick={() => setAba(k)}>
            {k === 'perfil' ? 'Perfil de trabalho' : k === 'ausencias' ? 'Férias e ausências' : 'Metas'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Link href="/atendimento/relatorio-mensal" className="btn btn-sm">Voltar ao relatório</Link>
      </div>

      {erro && <div className="rel-aviso" style={{ background: 'var(--danger-tint)' }}>{erro}</div>}
      {aviso && !erro && <div className="rel-aviso">{aviso}</div>}

      {semTabelas ? (
        <div className="panel">
          <div className="panel-body">
            <p className="rel-sub" style={{ color: 'var(--ink)' }}>
              Os cadastros ainda não foram instalados no banco. Rode <code>supabase/desempenho-cadastros.sql</code> no SQL Editor do Supabase.
            </p>
          </div>
        </div>
      ) : aba === 'perfil' ? (
        <div className="panel">
          <div className="panel-body">
            <div className="table-scroll">
              <table className="rel-tab">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Função</th>
                    <th>Equipe</th>
                    <th>Gestor</th>
                    <th>Na função desde</th>
                    <th className="n">Jornada (h/semana)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((p) => {
                    const pf = perfis[p.id]
                    return (
                      <tr key={p.id}>
                        <td>
                          {p.nome}
                          {!p.ativo && <span className="rel-obs"> · inativo</span>}
                        </td>
                        <td>{pf?.funcao || <span className="rel-obs">não informado</span>}</td>
                        <td>{pf?.equipe || '—'}</td>
                        <td>{pf?.gestor_id ? nomeDe[pf.gestor_id] || '—' : '—'}</td>
                        <td>{dataBr(pf?.inicio_funcao || null)}</td>
                        <td className="n">{pf?.jornada_horas_semana ?? '—'}</td>
                        <td>
                          <button
                            className="btn btn-sm"
                            onClick={() =>
                              setEditando(
                                pf || { pessoa_id: p.id, funcao: '', equipe: '', gestor_id: null, inicio_funcao: null, jornada_horas_semana: 40, observacao: '' }
                              )
                            }
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {editando && (
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="panel-body" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <div style={{ gridColumn: '1 / -1' }} className="section-title">
                    {nomeDe[editando.pessoa_id]}
                  </div>
                  <label>
                    Função
                    <input value={editando.funcao || ''} onChange={(e) => setEditando({ ...editando, funcao: e.target.value })} placeholder="Ex.: Analista de SST" />
                  </label>
                  <label>
                    Equipe
                    <input value={editando.equipe || ''} onChange={(e) => setEditando({ ...editando, equipe: e.target.value })} placeholder="Ex.: Atendimento" />
                  </label>
                  <label>
                    Gestor
                    <select value={editando.gestor_id || ''} onChange={(e) => setEditando({ ...editando, gestor_id: e.target.value || null })}>
                      <option value="">—</option>
                      {pessoas
                        .filter((x) => x.id !== editando.pessoa_id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Na função desde
                    <input type="date" value={editando.inicio_funcao || ''} onChange={(e) => setEditando({ ...editando, inicio_funcao: e.target.value || null })} />
                  </label>
                  <label>
                    Jornada (horas por semana)
                    <input
                      type="number"
                      min={1}
                      max={60}
                      step={0.5}
                      value={editando.jornada_horas_semana ?? ''}
                      onChange={(e) => setEditando({ ...editando, jornada_horas_semana: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </label>
                  <label style={{ gridColumn: '1 / -1' }}>
                    Observação de contexto (opcional; não registre dados de saúde)
                    <input value={editando.observacao || ''} maxLength={500} onChange={(e) => setEditando({ ...editando, observacao: e.target.value })} />
                  </label>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" onClick={salvarPerfil} disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditando(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : aba === 'ausencias' ? (
        <div className="panel">
          <div className="panel-body">
            <p className="rel-obs">
              Ausências descontam a disponibilidade da pessoa no relatório. Registre só o tipo e as datas: o motivo de um afastamento (saúde, por exemplo) não deve ser
              anotado aqui.
            </p>
            <div className="filters" style={{ flexWrap: 'wrap' }}>
              <select value={novaAus.pessoa_id} onChange={(e) => setNovaAus({ ...novaAus, pessoa_id: e.target.value })} aria-label="Pessoa">
                <option value="">Pessoa...</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <select value={novaAus.tipo} onChange={(e) => setNovaAus({ ...novaAus, tipo: e.target.value })} aria-label="Tipo">
                {Object.entries(TIPOS_AUSENCIA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input type="date" value={novaAus.inicio} onChange={(e) => setNovaAus({ ...novaAus, inicio: e.target.value })} aria-label="Início" />
              <input type="date" value={novaAus.fim} onChange={(e) => setNovaAus({ ...novaAus, fim: e.target.value })} aria-label="Fim" />
              <input value={novaAus.observacao} maxLength={300} placeholder="Observação (opcional)" onChange={(e) => setNovaAus({ ...novaAus, observacao: e.target.value })} />
              <button className="btn btn-sm btn-primary" onClick={incluirAusencia} disabled={salvando}>
                Registrar
              </button>
            </div>
            {ausencias.length ? (
              <table className="rel-tab">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Tipo</th>
                    <th>De</th>
                    <th>Até</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {ausencias.map((a) => (
                    <tr key={a.id}>
                      <td>{nomeDe[a.pessoa_id] || '—'}</td>
                      <td>{TIPOS_AUSENCIA[a.tipo] || a.tipo}</td>
                      <td>{dataBr(a.inicio)}</td>
                      <td>{dataBr(a.fim)}</td>
                      <td className="rel-obs">{a.observacao || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rel-sub">Nenhuma ausência registrada.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-body">
            <p className="rel-obs">
              Linha de base = média dos últimos {MESES_BASE} meses fechados com relatório gerado. Proposta = o melhor resultado desses meses (regra fixa, para não
              inventar números). Aprove como está ou ajuste o valor. A meta vale a partir do próximo mês; aprovada, não muda — para mudar, encerre e cadastre outra.
            </p>
            {!historico.length && (
              <p className="rel-sub" style={{ color: 'var(--ink)' }}>
                Ainda não há relatórios de meses fechados. Gere o relatório de um mês já encerrado (ex.: setembro) para formar a linha de base.
              </p>
            )}
            <table className="rel-tab">
              <thead>
                <tr>
                  <th>Indicador (equipe)</th>
                  <th>Linha de base</th>
                  <th className="n">Proposta</th>
                  <th>Meta vigente</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bases.map((b) => {
                  const vigente = metas.find((m) => m.indicador === b.ind.id && !m.pessoa_id && m.situacao === 'aprovada')
                  const pendente = metas.find((m) => m.indicador === b.ind.id && !m.pessoa_id && m.situacao === 'proposta')
                  return (
                    <tr key={b.ind.id}>
                      <td>
                        <strong>{b.ind.nome}</strong>
                        <div className="rel-obs">{b.ind.direcao === 'maior' ? 'quanto maior, melhor' : 'quanto menor, melhor'}</div>
                      </td>
                      <td>
                        {b.base === null ? (
                          <span className="rel-obs">dados insuficientes</span>
                        ) : (
                          <>
                            {fmt(b.base, b.ind.unidade)}
                            <div className="rel-obs">{b.valores.map((x) => `${rotuloMes(x.mes)}: ${fmt(x.v, b.ind.unidade)}`).join(' · ')}</div>
                          </>
                        )}
                      </td>
                      <td className="n">{fmt(b.proposta, b.ind.unidade)}</td>
                      <td>
                        {vigente ? (
                          <>
                            {fmt(vigente.valor, vigente.unidade)} <span className="rel-obs">desde {dataBr(vigente.vigencia_inicio)}</span>
                          </>
                        ) : pendente ? (
                          <span className="pill warn">proposta de {fmt(pendente.valor, pendente.unidade)} aguardando</span>
                        ) : (
                          <span className="rel-obs">sem meta aprovada</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {pendente && (
                          <button className="btn btn-sm btn-primary" disabled={salvando} onClick={() => mudarSituacao(pendente, 'aprovada')}>
                            Aprovar proposta
                          </button>
                        )}
                        {!vigente && !pendente && b.proposta !== null && (
                          <>
                            <button className="btn btn-sm btn-primary" disabled={salvando} onClick={() => proporMeta(b, b.proposta as number, true)}>
                              Aprovar {fmt(b.proposta, b.ind.unidade)}
                            </button>{' '}
                            <button
                              className="btn btn-sm"
                              disabled={salvando}
                              onClick={() => {
                                const t = window.prompt(`Meta para "${b.ind.nome}" (${b.ind.unidade}):`, String(b.proposta))
                                const v = t === null ? NaN : Number(t.replace(',', '.'))
                                if (Number.isFinite(v)) proporMeta(b, v, true)
                              }}
                            >
                              Ajustar
                            </button>
                          </>
                        )}
                        {vigente && (
                          <button className="btn btn-sm" disabled={salvando} onClick={() => mudarSituacao(vigente, 'encerrada')}>
                            Encerrar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {metas.some((m) => m.situacao === 'encerrada') && (
              <details style={{ marginTop: 12 }}>
                <summary className="section-title" style={{ cursor: 'pointer' }}>Histórico de metas encerradas</summary>
                <ul className="rel-lista">
                  {metas
                    .filter((m) => m.situacao === 'encerrada')
                    .map((m) => (
                      <li key={m.id}>
                        {INDICADORES_META.find((i) => i.id === m.indicador)?.nome || m.indicador}: {fmt(m.valor, m.unidade)} ({dataBr(m.vigencia_inicio)} a{' '}
                        {dataBr(m.vigencia_fim)})
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
