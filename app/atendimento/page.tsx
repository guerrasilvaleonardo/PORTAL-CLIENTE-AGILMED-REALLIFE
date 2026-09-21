'use client'

import { DragEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { avisar } from '@/lib/avisar'
import './quadro.css'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const COLUNAS = [
  { id: 'aberto', rotulo: 'Aberto' },
  { id: 'em_atendimento', rotulo: 'Em andamento' },
  { id: 'aguardando_cliente', rotulo: 'Aguardando cliente' },
  { id: 'resolvido', rotulo: 'Resolvido' },
  { id: 'encerrado', rotulo: 'Encerrado' },
]

const EM_ABERTO = ['aberto', 'em_atendimento', 'aguardando_cliente']

type Chamado = {
  id: string
  numero: number
  empresa_id: string
  categoria: string
  assunto: string
  prioridade: string
  status: string
  created_at: string
  prazo_sla: string | null
  responsavel_id: string | null
  empresas?: { nome_fantasia: string | null; razao_social: string; marca: string | null } | null
  responsavel?: { nome: string | null } | null
}

function iniciais(nome?: string | null) {
  if (!nome) return '--'

  const p = nome.trim().split(/\s+/)

  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

function horasAte(prazo: string | null) {
  if (!prazo) return null

  return Math.round((new Date(prazo).getTime() - Date.now()) / 3600000)
}

function textoPrazo(prazo: string | null) {
  const h = horasAte(prazo)

  if (h === null) return { texto: 'sem SLA', atrasado: false }
  if (h < 0) return { texto: Math.abs(h) + 'h em atraso', atrasado: true }
  if (h < 24) return { texto: h + 'h restantes', atrasado: false }

  return { texto: Math.round(h / 24) + 'd restantes', atrasado: false }
}

export default function AtendimentoPage() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [tv, setTv] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')

  const [meuId, setMeuId] = useState('')
  const [agentes, setAgentes] = useState<{ id: string; nome: string }[]>([])

  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)

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
        .select('perfil')
        .eq('id', user.id)
        .single()

      if (!PERFIS_INTERNOS.includes(perfil?.perfil || '')) {
        window.location.href = '/'
        return
      }

      setMeuId(user.id)

      const { data: equipe } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('perfil', PERFIS_INTERNOS)
        .eq('ativo', true)
        .order('nome')

      setAgentes(
        ((equipe || []) as any[]).map((p) => ({
          id: p.id,
          nome: p.nome || 'Sem nome',
        }))
      )

      const { data, error } = await supabase
        .from('chamados')
        .select(
          'id, numero, empresa_id, categoria, assunto, prioridade, status, created_at, prazo_sla, responsavel_id, empresas(nome_fantasia, razao_social, marca), responsavel:profiles!chamados_responsavel_id_fkey(nome)'
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      setChamados(
        (data || []).map((item: any) => ({
          ...item,
          empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas,
          responsavel: Array.isArray(item.responsavel) ? item.responsavel[0] : item.responsavel,
        }))
      )
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os chamados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    /*
     * O painel manda para cá com ?responsavel=meus ou o id de alguém,
     * então o atalho do dashboard já cai no quadro filtrado.
     */
    const alvo = new URLSearchParams(window.location.search).get(
      'responsavel'
    )

    if (alvo) {
      setFiltroResponsavel(alvo)
    }

    carregar()
  }, [])

  /* Modo TV recarrega sozinho: fica num telão, ninguém vai apertar F5. */
  useEffect(() => {
    if (!tv) return

    const id = window.setInterval(carregar, 60000)

    return () => window.clearInterval(id)
  }, [tv])

  const empresas = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const c of chamados) {
      if (c.empresa_id && !mapa.has(c.empresa_id)) {
        mapa.set(c.empresa_id, c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa')
      }
    }

    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [chamados])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return chamados.filter((c) => {
      if (filtroEmpresa && c.empresa_id !== filtroEmpresa) return false
      if (filtroPrioridade && c.prioridade !== filtroPrioridade) return false

      if (filtroResponsavel === 'meus' && c.responsavel_id !== meuId) return false
      if (filtroResponsavel === 'sem' && c.responsavel_id) return false

      if (
        filtroResponsavel &&
        filtroResponsavel !== 'meus' &&
        filtroResponsavel !== 'sem' &&
        c.responsavel_id !== filtroResponsavel
      ) {
        return false
      }
      if (!termo) return true

      return [c.numero, c.assunto, c.categoria, c.empresas?.nome_fantasia, c.empresas?.razao_social]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
  }, [chamados, busca, filtroEmpresa, filtroPrioridade, filtroResponsavel, meuId])

  const indicadores = useMemo(() => {
    const abertos = chamados.filter((c) => EM_ABERTO.includes(c.status))

    return {
      total: chamados.length,
      abertos: abertos.length,
      atrasados: abertos.filter((c) => {
        const h = horasAte(c.prazo_sla)
        return h !== null && h < 0
      }).length,
      urgentes: abertos.filter((c) => c.prioridade === 'urgente').length,
    }
  }, [chamados])

  async function mover(id: string, novoStatus: string) {
    const atual = chamados.find((c) => c.id === id)

    if (!atual || atual.status === novoStatus) return

    /* Move na tela primeiro; se o banco recusar, volta. */
    setChamados((lista) =>
      lista.map((c) => (c.id === id ? { ...c, status: novoStatus } : c))
    )
    setAviso('')

    const campos: Record<string, any> = { status: novoStatus }

    if (novoStatus === 'resolvido') campos.resolvido_em = new Date().toISOString()
    if (novoStatus === 'encerrado') campos.encerrado_em = new Date().toISOString()

    const { error } = await supabase.from('chamados').update(campos).eq('id', id)

    if (error) {
      console.error(error)
      setChamados((lista) =>
        lista.map((c) => (c.id === id ? { ...c, status: atual.status } : c))
      )
      setErro('Não foi possível mover o chamado.')
      return
    }

    avisar('status_alterado', id)

    setAviso(
      'Chamado #' +
        atual.numero +
        ' movido para ' +
        (COLUNAS.find((k) => k.id === novoStatus)?.rotulo || novoStatus) +
        '.'
    )
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>, coluna: string) {
    e.preventDefault()
    setSobre(null)

    const id = arrastando || e.dataTransfer.getData('text/plain')

    setArrastando(null)

    if (id) mover(id, coluna)
  }

  return (
    <div className={'app' + (tv ? ' tv' : '')}>
      <div className="topbar">
        <div>
          <div className="section-title">Atendimento</div>
          <h1 style={{ fontSize: 26, marginTop: 6 }}>Quadro de chamados</h1>
        </div>

        <div className="topbar-spacer" />

        <button
          type="button"
          className={'btn btn-sm' + (tv ? ' btn-primary' : '')}
          onClick={() => setTv((v) => !v)}
        >
          {tv ? 'Sair do Modo TV' : 'Modo TV'}
        </button>

        <button type="button" className="btn btn-sm" onClick={carregar}>
          Atualizar
        </button>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {aviso && <div className="banner good">{aviso}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : indicadores.abertos}</div>
          <div className="lbl">Em aberto</div>
        </div>

        <div className={'stat' + (indicadores.atrasados > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : indicadores.atrasados}</div>
          <div className="lbl">SLA atrasado</div>
        </div>

        <div className={'stat' + (indicadores.urgentes > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : indicadores.urgentes}</div>
          <div className="lbl">Urgentes</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : indicadores.total}</div>
          <div className="lbl">Total no período</div>
        </div>
      </div>

      <div className="filters">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar assunto, número ou empresa"
        />

        <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>

        <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
          <option value="">Todas as prioridades</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
          <option value="baixa">Baixa</option>
        </select>

        <select
          value={filtroResponsavel}
          onChange={(e) => setFiltroResponsavel(e.target.value)}
        >
          <option value="">Todos os responsáveis</option>
          <option value="meus">Meus atendimentos</option>
          <option value="sem">Sem responsável</option>

          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="board">
        {COLUNAS.map((coluna) => {
          const daColuna = filtrados.filter((c) => c.status === coluna.id)

          return (
            <div
              key={coluna.id}
              className={'col' + (sobre === coluna.id ? ' dragover' : '')}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(coluna.id)
              }}
              onDragLeave={() => setSobre((s) => (s === coluna.id ? null : s))}
              onDrop={(e) => aoSoltar(e, coluna.id)}
            >
              <div className="col-head">
                <h3>{coluna.rotulo}</h3>
                <span className="col-count">{daColuna.length}</span>
              </div>

              <div className="col-cards">
                {daColuna.length === 0 ? (
                  <div className="empty-col">vazio</div>
                ) : (
                  daColuna.map((c) => {
                    const prazo = textoPrazo(c.prazo_sla)
                    const aberto = EM_ABERTO.includes(c.status)
                    const atrasado = aberto && prazo.atrasado

                    return (
                      <Link
                        key={c.id}
                        href={'/atendimento/' + c.id}
                        className={'qcard pri-' + c.prioridade + (atrasado ? ' atrasado' : '')}
                        draggable={!tv}
                        onDragStart={(e) => {
                          setArrastando(c.id)
                          e.dataTransfer.setData('text/plain', c.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setArrastando(null)
                          setSobre(null)
                        }}
                      >
                        <div className="card-top">
                          <span className="card-code">#{c.numero}</span>
                          {atrasado && <span className="badge-atraso">ATRASADO</span>}
                        </div>

                        <div className="card-title">{c.assunto}</div>

                        <div className="card-client">
                          {c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa'}
                          {' · '}
                          {c.categoria}
                        </div>

                        <div className="card-meta">
                          <span className={'due' + (atrasado ? ' bad' : '')}>
                            {prazo.texto}
                          </span>

                          <span className="avatar" title={c.responsavel?.nome || 'Sem responsável'}>
                            {iniciais(c.responsavel?.nome)}
                          </span>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="footnote">
        Arraste o cartão entre as colunas para mudar o status. Clique para abrir o chamado.
      </div>
    </div>
  )
}
