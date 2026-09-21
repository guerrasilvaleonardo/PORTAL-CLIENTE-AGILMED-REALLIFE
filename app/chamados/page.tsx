'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { marcas, type Marca } from '@/lib/marca'
import { obterMarcaDaEmpresa } from '@/lib/empresa'

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

const statusLabels: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

const prioridadeLabels: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
  },

  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 24px 60px',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '20px',
    marginBottom: '28px',
    flexWrap: 'wrap' as const,
  },

  title: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.2,
    fontWeight: 700,
    color: '#172033',
  },

  subtitle: {
    margin: '8px 0 0',
    fontSize: '16px',
    color: '#64748b',
    lineHeight: 1.5,
  },

  newButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 18px',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  },

  section: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    overflow: 'hidden',
    boxShadow: '0 5px 15px rgba(15, 23, 42, 0.05)',
  },

  sectionHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },

  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#172033',
  },

  count: {
    fontSize: '13px',
    color: '#64748b',
  },

  ticketRow: {
    display: 'grid',
    gridTemplateColumns:
      '100px minmax(260px, 1fr) 160px 150px 130px',
    gap: '18px',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #eef0f3',
    textDecoration: 'none',
    transition: 'background 0.15s ease',
  },

  ticketNumber: {
    fontSize: '14px',
    fontWeight: 700,
  },

  subject: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#172033',
    lineHeight: 1.4,
  },

  category: {
    margin: '5px 0 0',
    fontSize: '13px',
    color: '#64748b',
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },

  priority: {
    fontSize: '13px',
    fontWeight: 600,
  },

  date: {
    fontSize: '13px',
    color: '#64748b',
    lineHeight: 1.4,
  },

  empty: {
    padding: '60px 24px',
    textAlign: 'center' as const,
  },

  emptyTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#172033',
  },

  emptyText: {
    margin: '8px 0 20px',
    fontSize: '14px',
    color: '#64748b',
  },

  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fa',
    color: '#64748b',
    fontSize: '16px',
  },

  error: {
    padding: '18px 20px',
    borderRadius: '12px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    marginBottom: '20px',
    fontSize: '14px',
  },

  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },

  filterLabel: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 600,
  },

  select: {
    border: '1px solid #dbe1e8',
    borderRadius: '9px',
    padding: '9px 12px',
    background: '#ffffff',
    color: '#334155',
    fontSize: '13px',
    outline: 'none',
  },
}

function formatarData(data: string) {
  const valor = new Date(data)

  if (Number.isNaN(valor.getTime())) {
    return '-'
  }

  return valor.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function obterEstiloStatus(status: string) {
  switch (status) {
    case 'aberto':
      return {
        background: '#eff6ff',
        color: '#1d4ed8',
      }

    case 'em_atendimento':
      return {
        background: '#fff7ed',
        color: '#c2410c',
      }

    case 'aguardando_cliente':
      return {
        background: '#fefce8',
        color: '#a16207',
      }

    case 'resolvido':
      return {
        background: '#f0fdf4',
        color: '#15803d',
      }

    case 'encerrado':
      return {
        background: '#f1f5f9',
        color: '#475569',
      }

    default:
      return {
        background: '#f1f5f9',
        color: '#475569',
      }
  }
}

function obterCorPrioridade(prioridade: string) {
  switch (prioridade) {
    case 'urgente':
      return '#dc2626'

    case 'alta':
      return '#ea580c'

    case 'normal':
      return '#64748b'

    case 'baixa':
      return '#64748b'

    default:
      return '#64748b'
  }
}

export default function ChamadosPage() {
  const [loading, setLoading] = useState(true)
  const [marca, setMarca] = useState<Marca | null>(null)
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [error, setError] = useState<string | null>(null)
  const [interno, setInterno] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregarDados() {
      try {
        setLoading(true)
        setError(null)

        const {
          data: { user },
          error: usuarioError,
        } = await supabase.auth.getUser()

        if (usuarioError) {
          throw usuarioError
        }

        if (!user) {
          throw new Error(
            'Usuário não autenticado.'
          )
        }

        const { data: perfil, error: perfilError } =
          await supabase
            .from('profiles')
            .select('empresa_id, perfil')
            .eq('id', user.id)
            .single()

        if (perfilError) {
          throw perfilError
        }

        /*
         * A equipe interna não tem empresa e precisa enxergar os
         * chamados de todos os clientes. Antes esta tela filtrava
         * sempre pela empresa do usuário, então para administrador
         * ela vinha vazia.
         */
        const ehInterno = PERFIS_INTERNOS.includes(
          perfil?.perfil || ''
        )

        if (!ehInterno && !perfil?.empresa_id) {
          throw new Error(
            'Seu usuário ainda não está vinculado a uma empresa. Peça ao administrador para fazer o vínculo.'
          )
        }

        const marcaEmpresa =
          await obterMarcaDaEmpresa()

        if (!marcaEmpresa) {
          throw new Error(
            'Não foi possível identificar a marca do portal.'
          )
        }

        let consulta = supabase
          .from('chamados')
          .select(
            'id, numero, categoria, assunto, descricao, status, prioridade, created_at, updated_at, empresas(nome_fantasia, razao_social)'
          )

        if (!ehInterno) {
          consulta = consulta.eq(
            'empresa_id',
            perfil.empresa_id
          )
        }

        const {
          data: chamadosData,
          error: chamadosError,
        } = await consulta.order('created_at', {
          ascending: false,
        })

        if (chamadosError) {
          throw chamadosError
        }

        if (!ativo) {
          return
        }

        setInterno(ehInterno)
        setMarca(marcaEmpresa)
        setChamados(
          ((chamadosData || []) as any[]).map((item) => ({
            ...item,
            empresas: Array.isArray(item.empresas)
              ? item.empresas[0]
              : item.empresas,
          })) as Chamado[]
        )
      } catch (err) {
        console.error(
          'Erro ao carregar chamados:',
          err
        )

        if (ativo) {
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Não foi possível carregar os chamados.'
          )
        }
      } finally {
        if (ativo) {
          setLoading(false)
        }
      }
    }

    carregarDados()

    return () => {
      ativo = false
    }
  }, [])

  if (loading || !marca) {
    return (
      <div style={styles.loading}>
        {error || 'Carregando chamados...'}
      </div>
    )
  }

  const tema = marcas[marca]

  const chamadosFiltrados =
    statusFiltro === 'todos'
      ? chamados
      : chamados.filter(
          (chamado) =>
            chamado.status === statusFiltro
        )

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              {interno ? 'Todos os chamados' : 'Meus chamados'}
            </h1>

            <p style={styles.subtitle}>
              {interno
                ? 'Chamados de todas as empresas atendidas.'
                : 'Acompanhe as solicitações de atendimento da sua empresa.'}
            </p>
          </div>

          {!interno && (
            <Link
              href="/chamados/novo"
              style={{
                ...styles.newButton,
                background: tema.principal,
              }}
            >
              + Novo chamado
            </Link>
          )}
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Solicitações
              </h2>

              <span style={styles.count}>
                {chamadosFiltrados.length}{' '}
                {chamadosFiltrados.length === 1
                  ? 'chamado'
                  : 'chamados'}
              </span>
            </div>

            <div style={styles.filters}>
              <span style={styles.filterLabel}>
                Status:
              </span>

              <select
                value={statusFiltro}
                onChange={(event) =>
                  setStatusFiltro(
                    event.target.value
                  )
                }
                style={styles.select}
              >
                <option value="todos">
                  Todos
                </option>

                <option value="aberto">
                  Abertos
                </option>

                <option value="em_atendimento">
                  Em atendimento
                </option>

                <option value="aguardando_cliente">
                  Aguardando cliente
                </option>

                <option value="resolvido">
                  Resolvidos
                </option>

                <option value="encerrado">
                  Encerrados
                </option>
              </select>
            </div>
          </div>

          {chamadosFiltrados.length === 0 ? (
            <div style={styles.empty}>
              <h3 style={styles.emptyTitle}>
                {chamados.length === 0
                  ? 'Nenhum chamado registrado'
                  : 'Nenhum chamado encontrado'}
              </h3>

              <p style={styles.emptyText}>
                {chamados.length === 0
                  ? interno
                    ? 'Ainda não há chamados registrados no portal.'
                    : 'Sua empresa ainda não possui chamados registrados no portal.'
                  : 'Não existem chamados com o filtro selecionado.'}
              </p>

              {chamados.length === 0 && !interno && (
                <Link
                  href="/chamados/novo"
                  style={{
                    ...styles.newButton,
                    background:
                      tema.principal,
                  }}
                >
                  Abrir primeiro chamado
                </Link>
              )}
            </div>
          ) : (
            <div>
              {chamadosFiltrados.map(
                (chamado) => {
                  const estiloStatus =
                    obterEstiloStatus(
                      chamado.status
                    )

                  return (
                    <Link
                      key={chamado.id}
                      href={`/chamados/${chamado.id}`}
                      style={{
                        ...styles.ticketRow,
                        borderBottom:
                          '1px solid #eef0f3',
                      }}
                    >
                      <div
                        style={{
                          ...styles.ticketNumber,
                          color:
                            tema.principal,
                        }}
                      >
                        #{chamado.numero}
                      </div>

                      <div>
                        <p
                          style={
                            styles.subject
                          }
                        >
                          {chamado.assunto}
                        </p>

                        <p
                          style={
                            styles.category
                          }
                        >
                          {interno
                            ? (chamado.empresas
                                ?.nome_fantasia ||
                                chamado.empresas
                                  ?.razao_social ||
                                'Empresa') +
                              ' · ' +
                              chamado.categoria
                            : chamado.categoria}
                        </p>
                      </div>

                      <div>
                        <span
                          style={{
                            ...styles.badge,
                            background:
                              estiloStatus.background,
                            color:
                              estiloStatus.color,
                          }}
                        >
                          {statusLabels[
                            chamado.status
                          ] ||
                            chamado.status}
                        </span>
                      </div>

                      <div
                        style={{
                          ...styles.priority,
                          color:
                            obterCorPrioridade(
                              chamado.prioridade
                            ),
                        }}
                      >
                        {prioridadeLabels[
                          chamado.prioridade
                        ] ||
                          chamado.prioridade}
                      </div>

                      <div
                        style={styles.date}
                      >
                        {formatarData(
                          chamado.created_at
                        )}
                      </div>
                    </Link>
                  )
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
