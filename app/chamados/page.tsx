'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { AjudaSituacoes } from '@/lib/situacoes'

type Chamado = {
  id: string
  numero: number
  categoria: string
  assunto: string
  descricao: string | null
  status: string
  prioridade: string
  created_at: string
  updated_at: string | null
  empresas?: {
    nome_fantasia: string | null
    razao_social: string | null
  } | null
}

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const ROTULO_STATUS: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

const PILL_STATUS: Record<string, string> = {
  aberto: 'pill warn',
  em_atendimento: 'pill',
  aguardando_cliente: 'pill flat',
  resolvido: 'pill good',
  encerrado: 'pill flat',
}

const ROTULO_PRIORIDADE: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

const COR_PRIORIDADE: Record<string, string> = {
  urgente: 'var(--danger)',
  alta: 'var(--amber)',
  normal: 'var(--ink-muted)',
  baixa: 'var(--ink-faint)',
}

const EM_ABERTO = ['aberto', 'em_atendimento', 'aguardando_cliente']

const GRADE = '72px minmax(240px, 1fr) 150px 110px 110px'

function formatarData(iso: string) {
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export default function ChamadosPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [interno, setInterno] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setCarregando(true)
        setErro('')

        const {
          data: { user },
          error: usuarioErro,
        } = await supabase.auth.getUser()

        if (usuarioErro) throw usuarioErro

        if (!user) {
          window.location.href = '/login'
          return
        }

        const { data: perfil, error: perfilErro } = await supabase
          .from('profiles')
          .select('empresa_id, perfil')
          .eq('id', user.id)
          .single()

        if (perfilErro) throw perfilErro

        /*
         * A equipe interna não tem empresa e precisa enxergar os
         * chamados de todos os clientes. O cliente só vê os da
         * própria empresa.
         */
        const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')

        if (!ehInterno && !perfil?.empresa_id) {
          throw new Error(
            'Seu usuário ainda não está vinculado a uma empresa. Peça ao administrador para fazer o vínculo.'
          )
        }

        /* Mantém a marca em dia para o cabeçalho do portal. */
        await obterMarcaDaEmpresa()

        let consulta = supabase
          .from('chamados')
          .select(
            'id, numero, categoria, assunto, descricao, status, prioridade, created_at, updated_at, empresas(nome_fantasia, razao_social)'
          )

        if (!ehInterno) {
          consulta = consulta.eq('empresa_id', perfil.empresa_id)
        }

        const { data, error } = await consulta.order('created_at', {
          ascending: false,
        })

        if (error) throw error

        if (!ativo) return

        setInterno(ehInterno)

        setChamados(
          ((data || []) as any[]).map((item) => ({
            ...item,
            empresas: Array.isArray(item.empresas)
              ? item.empresas[0]
              : item.empresas,
          })) as Chamado[]
        )
      } catch (e: any) {
        console.error('Erro ao carregar chamados:', e)

        if (ativo) {
          setErro(e?.message || 'Não foi possível carregar os chamados.')
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  const resumo = useMemo(() => {
    const emAberto = chamados.filter((c) => EM_ABERTO.includes(c.status))

    return {
      total: chamados.length,
      abertos: emAberto.length,
      urgentes: emAberto.filter((c) => c.prioridade === 'urgente').length,
      resolvidos: chamados.filter((c) =>
        ['resolvido', 'encerrado'].includes(c.status)
      ).length,
    }
  }, [chamados])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return chamados.filter((c) => {
      if (filtro === 'abertos' && !EM_ABERTO.includes(c.status)) return false
      if (filtro !== 'todos' && filtro !== 'abertos' && c.status !== filtro) {
        return false
      }

      if (!termo) return true

      const alvo = (
        c.assunto +
        ' ' +
        c.categoria +
        ' ' +
        String(c.numero) +
        ' ' +
        (c.empresas?.nome_fantasia || c.empresas?.razao_social || '')
      ).toLowerCase()

      return alvo.includes(termo)
    })
  }, [chamados, filtro, busca])

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">
            {interno ? 'Todos os clientes' : 'Sua empresa'}
          </div>

          <h1 style={{ fontSize: 30, marginTop: 6 }}>Chamados</h1>

          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--ink-muted)',
              fontSize: 14,
            }}
          >
            {interno
              ? 'Todos os chamados abertos no portal, das duas marcas.'
              : 'Acompanhe as solicitações da sua empresa e abra novas quando precisar.'}
          </p>
        </div>

        <div className="topbar-spacer" />

        <Link href="/chamados/novo" className="btn btn-primary">
          {interno ? 'Abrir chamado para um cliente' : 'Novo chamado'}
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : resumo.total}</div>
          <div className="lbl">Total</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : resumo.abertos}</div>
          <div className="lbl">Em aberto</div>
        </div>

        <div className={'stat' + (resumo.urgentes > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : resumo.urgentes}</div>
          <div className="lbl">Urgentes</div>
        </div>

        <div className="stat good">
          <div className="num">{carregando ? '—' : resumo.resolvidos}</div>
          <div className="lbl">Resolvidos</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Lista de chamados</div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <AjudaSituacoes publico={interno ? 'equipe' : 'cliente'} />

            <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
              {filtrados.length} de {chamados.length}
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div className="filters">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar assunto, número ou categoria"
            />

            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="abertos">Só os em aberto</option>
              <option value="aberto">Aberto</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="aguardando_cliente">Aguardando cliente</option>
              <option value="resolvido">Resolvido</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>

          <div className="table-wrap">
            <div className="table-scroll">
              <div
                className="trow thead"
                style={{ gridTemplateColumns: GRADE }}
              >
                <span>Nº</span>
                <span>Assunto</span>
                <span>Situação</span>
                <span>Prioridade</span>
                <span>Aberto em</span>
              </div>

              {carregando ? (
                <div className="empty-state">Carregando chamados...</div>
              ) : filtrados.length === 0 ? (
                <div className="empty-state">
                  {chamados.length === 0
                    ? 'Nenhum chamado ainda. Abra o primeiro quando precisar de algo.'
                    : 'Nenhum chamado com esses filtros.'}
                </div>
              ) : (
                filtrados.map((c) => (
                  <Link
                    key={c.id}
                    href={'/chamados/' + c.id}
                    className="trow"
                    style={{
                      gridTemplateColumns: GRADE,
                      color: 'inherit',
                    }}
                  >
                    <span className="tcode">#{c.numero}</span>

                    <span style={{ minWidth: 0 }}>
                      <span
                        className="tname"
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.assunto}
                      </span>

                      <span
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: 'var(--ink-muted)',
                          marginTop: 2,
                        }}
                      >
                        {c.categoria}
                        {interno &&
                          (c.empresas?.nome_fantasia ||
                            c.empresas?.razao_social) &&
                          ' · ' +
                            (c.empresas?.nome_fantasia ||
                              c.empresas?.razao_social)}
                      </span>
                    </span>

                    <span>
                      <span
                        className={PILL_STATUS[c.status] || 'pill flat'}
                      >
                        {ROTULO_STATUS[c.status] || c.status}
                      </span>
                    </span>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color:
                          COR_PRIORIDADE[c.prioridade] ||
                          'var(--ink-muted)',
                      }}
                    >
                      {ROTULO_PRIORIDADE[c.prioridade] || c.prioridade}
                    </span>

                    <span className="tmuted" style={{ fontSize: 12.5 }}>
                      {formatarData(c.created_at)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
