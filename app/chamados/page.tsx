'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import type { Marca } from '@/lib/marca'

type Chamado = {
  id: string
  numero: number
  categoria: string
  assunto: string
  descricao: string
  prioridade: string
  status: string
  prazo_sla: string | null
  created_at: string
  updated_at: string
}

const statusLabels: Record<string, string> = {
  todos: 'Todos',
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

const identidade = {
  agilmed: {
    nome: 'ÁgilMed Ocupacional',
    curto: 'ÁgilMed',
    inicial: 'A',
    principal: '#2563eb',
    principalEscura: '#1d4ed8',
    fundo: '#eff6ff',
    borda: '#dbeafe',
    textoSuave: '#64748b',
  },

  reallife: {
    nome: 'Real Life SSMA',
    curto: 'Real Life',
    inicial: 'R',
    principal: '#0f766e',
    principalEscura: '#115e59',
    fundo: '#f0fdfa',
    borda: '#ccfbf1',
    textoSuave: '#64748b',
  },
} as const

function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(data))
}

function statusStyle(status: string) {
  const estilos: Record<string, React.CSSProperties> = {
    aberto: {
      background: '#eff6ff',
      color: '#1d4ed8',
    },

    em_atendimento: {
      background: '#fff7ed',
      color: '#c2410c',
    },

    aguardando_cliente: {
      background: '#fefce8',
      color: '#a16207',
    },

    resolvido: {
      background: '#f0fdf4',
      color: '#15803d',
    },

    encerrado: {
      background: '#f1f5f9',
      color: '#475569',
    },
  }

  return estilos[status] || estilos.aberto
}

function prioridadeStyle(prioridade: string) {
  const estilos: Record<string, React.CSSProperties> = {
    baixa: {
      color: '#64748b',
      background: '#f8fafc',
    },

    normal: {
      color: '#2563eb',
      background: '#eff6ff',
    },

    alta: {
      color: '#c2410c',
      background: '#fff7ed',
    },

    urgente: {
      color: '#dc2626',
      background: '#fef2f2',
    },
  }

  return estilos[prioridade] || estilos.normal
}

export default function ChamadosPage() {
  const router = useRouter()

  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  // IMPORTANTE:
  // Não inicia mais como ÁgilMed.
  // A página aguarda descobrir a marca real da empresa.
  const [marca, setMarca] = useState<Marca | null>(null)

  useEffect(() => {
    async function carregarChamados() {
      setLoading(true)
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const marcaEmpresa = await obterMarcaDaEmpresa()

      setMarca(marcaEmpresa)

      const { data, error } = await supabase
        .from('chamados')
        .select(
          'id, numero, categoria, assunto, descricao, prioridade, status, prazo_sla, created_at, updated_at'
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setErro('Não foi possível carregar seus chamados.')
        setLoading(false)
        return
      }

      setChamados(data || [])
      setLoading(false)
    }

    carregarChamados()
  }, [router])

  // O useMemo fica antes do retorno condicional.
  // Isso evita quebra da ordem dos Hooks do React.
  const chamadosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return chamados.filter((chamado) => {
      const correspondeStatus =
        filtroStatus === 'todos' ||
        chamado.status === filtroStatus

      const correspondeBusca =
        !termo ||
        String(chamado.numero).includes(termo) ||
        chamado.assunto.toLowerCase().includes(termo) ||
        chamado.categoria.toLowerCase().includes(termo) ||
        chamado.descricao.toLowerCase().includes(termo)

      return correspondeStatus && correspondeBusca
    })
  }, [chamados, busca, filtroStatus])

  const total = chamados.length

  const abertos = chamados.filter(
    (chamado) => chamado.status === 'aberto'
  ).length

  const emAtendimento = chamados.filter(
    (chamado) =>
      chamado.status === 'em_atendimento' ||
      chamado.status === 'aguardando_cliente'
  ).length

  const resolvidos = chamados.filter(
    (chamado) =>
      chamado.status === 'resolvido' ||
      chamado.status === 'encerrado'
  ).length

  // Enquanto a empresa ainda não foi identificada,
  // não renderiza nenhuma cor da ÁgilMed.
  if (!marca) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.loadingSpinner} />
          <span>Carregando seus chamados...</span>
        </div>
      </main>
    )
  }

  const tema = identidade[marca]

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          <div
            style={{
              ...styles.loadingSpinner,
              borderColor: tema.borda,
              borderTopColor: tema.principal,
            }}
          />

          <span>Carregando seus chamados...</span>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link href="/" style={styles.logoArea}>
            <div
              style={{
                ...styles.logoMark,
                background: tema.principal,
              }}
            >
              {tema.inicial}
            </div>

            <div>
              <div style={styles.logoTitle}>
                {tema.nome}
              </div>

              <div style={styles.logoSubtitle}>
                Portal do Cliente
              </div>
            </div>
          </Link>

          <nav style={styles.nav}>
            <Link href="/" style={styles.navLink}>
              Início
            </Link>

            <Link
              href="/chamados"
              style={{
                ...styles.navLinkActive,
                color: tema.principal,
              }}
            >
              Chamados
            </Link>

            <span style={styles.navDisabled}>
              Documentos
            </span>

            <span style={styles.navDisabled}>
              Indicadores
            </span>

            <span style={styles.navDisabled}>
              Minha empresa
            </span>
          </nav>
        </div>
      </header>

      <div style={styles.container}>
        <div style={styles.breadcrumb}>
          <Link href="/" style={styles.breadcrumbLink}>
            Início
          </Link>

          <span> / </span>

          <span>Meus chamados</span>
        </div>

        <section style={styles.pageHeader}>
          <div>
            <div
              style={{
                ...styles.eyebrow,
                color: tema.principal,
              }}
            >
              ATENDIMENTO
            </div>

            <h1 style={styles.title}>
              Meus chamados
            </h1>

            <p style={styles.subtitle}>
              Acompanhe suas solicitações e converse com nossa
              equipe.
            </p>
          </div>

          <Link
            href="/chamados/novo"
            style={{
              ...styles.primaryButton,
              background: tema.principal,
              borderColor: tema.principal,
            }}
          >
            <span style={styles.buttonPlus}>+</span>
            Novo chamado
          </Link>
        </section>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                background: tema.fundo,
                color: tema.principal,
              }}
            >
              ▤
            </div>

            <div>
              <div style={styles.statNumber}>
                {total}
              </div>

              <div style={styles.statLabel}>
                Total de chamados
              </div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                background: tema.fundo,
                color: tema.principal,
              }}
            >
              ◷
            </div>

            <div>
              <div style={styles.statNumber}>
                {abertos}
              </div>

              <div style={styles.statLabel}>
                Aguardando atendimento
              </div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                background: '#fff7ed',
                color: '#ea580c',
              }}
            >
              ↻
            </div>

            <div>
              <div style={styles.statNumber}>
                {emAtendimento}
              </div>

              <div style={styles.statLabel}>
                Em andamento
              </div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                background: '#f0fdf4',
                color: '#15803d',
              }}
            >
              ✓
            </div>

            <div>
              <div style={styles.statNumber}>
                {resolvidos}
              </div>

              <div style={styles.statLabel}>
                Resolvidos
              </div>
            </div>
          </div>
        </section>

        {erro && (
          <div style={styles.errorBox}>
            <strong>
              Não foi possível carregar os chamados.
            </strong>

            <span>{erro}</span>
          </div>
        )}

        <section style={styles.listSection}>
          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <span style={styles.searchIcon}>⌕</span>

              <input
                type="text"
                value={busca}
                onChange={(event) =>
                  setBusca(event.target.value)
                }
                placeholder="Buscar por número, assunto ou categoria..."
                style={styles.searchInput}
              />

              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  style={styles.clearButton}
                >
                  ×
                </button>
              )}
            </div>

            <div style={styles.filterArea}>
              <span style={styles.filterLabel}>
                Status:
              </span>

              <select
                value={filtroStatus}
                onChange={(event) =>
                  setFiltroStatus(event.target.value)
                }
                style={styles.select}
              >
                <option value="todos">Todos</option>

                <option value="aberto">
                  Aberto
                </option>

                <option value="em_atendimento">
                  Em atendimento
                </option>

                <option value="aguardando_cliente">
                  Aguardando cliente
                </option>

                <option value="resolvido">
                  Resolvido
                </option>

                <option value="encerrado">
                  Encerrado
                </option>
              </select>
            </div>
          </div>

          <div style={styles.resultInfo}>
            <span>
              {chamadosFiltrados.length}{' '}
              {chamadosFiltrados.length === 1
                ? 'chamado encontrado'
                : 'chamados encontrados'}
            </span>

            {(busca || filtroStatus !== 'todos') && (
              <button
                type="button"
                onClick={() => {
                  setBusca('')
                  setFiltroStatus('todos')
                }}
                style={{
                  ...styles.clearFilters,
                  color: tema.principal,
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          {chamadosFiltrados.length === 0 ? (
            <div style={styles.emptyCard}>
              <div
                style={{
                  ...styles.emptyIcon,
                  background: tema.fundo,
                  color: tema.principal,
                }}
              >
                □
              </div>

              <h2 style={styles.emptyTitle}>
                {chamados.length === 0
                  ? 'Você ainda não possui chamados'
                  : 'Nenhum chamado encontrado'}
              </h2>

              <p style={styles.emptyText}>
                {chamados.length === 0
                  ? 'Quando você abrir uma solicitação, ela aparecerá nesta área para acompanhamento.'
                  : 'Tente alterar os filtros ou realizar uma nova busca.'}
              </p>

              {chamados.length === 0 && (
                <Link
                  href="/chamados/novo"
                  style={{
                    ...styles.primaryButton,
                    background: tema.principal,
                    borderColor: tema.principal,
                  }}
                >
                  Abrir novo chamado
                </Link>
              )}
            </div>
          ) : (
            <div style={styles.ticketList}>
              {chamadosFiltrados.map((chamado) => (
                <Link
                  key={chamado.id}
                  href={`/chamados/${chamado.id}`}
                  style={styles.ticketCard}
                >
                  <div style={styles.ticketTop}>
                    <div style={styles.ticketIdentification}>
                      <span
                        style={{
                          ...styles.ticketNumber,
                          color: tema.principal,
                        }}
                      >
                        #{chamado.numero}
                      </span>

                      <span style={styles.ticketCategory}>
                        {chamado.categoria}
                      </span>
                    </div>

                    <span
                      style={{
                        ...styles.statusBadge,
                        ...statusStyle(chamado.status),
                      }}
                    >
                      <span style={styles.statusDot} />

                      {statusLabels[chamado.status] ||
                        chamado.status}
                    </span>
                  </div>

                  <div style={styles.ticketBody}>
                    <div style={styles.ticketContent}>
                      <h2 style={styles.ticketTitle}>
                        {chamado.assunto}
                      </h2>

                      <p style={styles.ticketDescription}>
                        {chamado.descricao}
                      </p>
                    </div>

                    <div
                      style={{
                        ...styles.ticketArrow,
                        color: tema.principal,
                      }}
                    >
                      →
                    </div>
                  </div>

                  <div style={styles.ticketFooter}>
                    <div style={styles.ticketMeta}>
                      <span>
                        Abertura:{' '}
                        <strong>
                          {formatarData(
                            chamado.created_at
                          )}
                        </strong>
                      </span>

                      <span style={styles.metaSeparator}>
                        •
                      </span>

                      <span>
                        Atualizado:{' '}
                        <strong>
                          {formatarData(
                            chamado.updated_at
                          )}
                        </strong>
                      </span>

                      {chamado.prazo_sla && (
                        <>
                          <span
                            style={styles.metaSeparator}
                          >
                            •
                          </span>

                          <span>
                            SLA:{' '}
                            <strong>
                              {formatarData(
                                chamado.prazo_sla
                              )}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>

                    <span
                      style={{
                        ...styles.priorityBadge,
                        ...prioridadeStyle(
                          chamado.prioridade
                        ),
                      }}
                    >
                      {prioridadeLabels[
                        chamado.prioridade
                      ] || chamado.prioridade}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            ...styles.helpCard,
            background: tema.principalEscura,
          }}
        >
          <div
            style={{
              ...styles.helpIcon,
              background: tema.principal,
            }}
          >
            ?
          </div>

          <div style={styles.helpContent}>
            <h2 style={styles.helpTitle}>
              Precisa abrir uma nova solicitação?
            </h2>

            <p style={styles.helpText}>
              Nossa equipe está pronta para ajudar. Registre
              um novo chamado e acompanhe o atendimento por
              este portal.
            </p>
          </div>

          <Link
            href="/chamados/novo"
            style={styles.helpButton}
          >
            + Novo chamado
          </Link>
        </section>

        <footer style={styles.footer}>
          <strong>{tema.nome}</strong>

          <span>Portal do Cliente</span>
        </footer>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
    color: '#172033',
  },

  header: {
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },

  headerInner: {
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
  },

  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textDecoration: 'none',
    color: '#172033',
  },

  logoMark: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '21px',
    fontWeight: 900,
  },

  logoTitle: {
    fontSize: '16px',
    fontWeight: 800,
    lineHeight: 1.2,
  },

  logoSubtitle: {
    color: '#64748b',
    fontSize: '11px',
    marginTop: '3px',
  },

  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '22px',
  },

  navLink: {
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 600,
  },

  navLinkActive: {
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 800,
  },

  navDisabled: {
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: 600,
  },

  container: {
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '30px 24px 60px',
  },

  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    color: '#94a3b8',
    fontSize: '12px',
    marginBottom: '25px',
  },

  breadcrumbLink: {
    color: '#64748b',
    textDecoration: 'none',
    fontWeight: 600,
  },

  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '25px',
    marginBottom: '26px',
  },

  eyebrow: {
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.12em',
    marginBottom: '8px',
  },

  title: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
  },

  subtitle: {
    margin: '9px 0 0',
    color: '#64748b',
    fontSize: '14px',
  },

  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '12px 17px',
    fontSize: '13px',
    fontWeight: 800,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },

  buttonPlus: {
    fontSize: '18px',
    lineHeight: 1,
    fontWeight: 400,
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '15px',
    marginBottom: '32px',
  },

  statCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '15px',
    padding: '19px',
    display: 'flex',
    alignItems: 'center',
    gap: '13px',
  },

  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '17px',
    fontWeight: 800,
    flexShrink: 0,
  },

  statNumber: {
    fontSize: '23px',
    fontWeight: 900,
    lineHeight: 1,
  },

  statLabel: {
    color: '#64748b',
    fontSize: '11px',
    marginTop: '5px',
  },

  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '22px',
    fontSize: '13px',
  },

  listSection: {
    marginTop: '5px',
  },

  toolbar: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '15px',
    padding: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '15px',
  },

  searchBox: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    maxWidth: '650px',
    minWidth: 0,
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    padding: '0 12px',
  },

  searchIcon: {
    color: '#94a3b8',
    fontSize: '20px',
    lineHeight: 1,
    marginRight: '7px',
  },

  searchInput: {
    width: '100%',
    border: 0,
    outline: 0,
    background: 'transparent',
    padding: '11px 0',
    color: '#172033',
    fontSize: '13px',
  },

  clearButton: {
    border: 0,
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '19px',
    cursor: 'pointer',
    padding: '0 2px',
  },

  filterArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  filterLabel: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 700,
  },

  select: {
    border: '1px solid #e2e8f0',
    borderRadius: '9px',
    background: '#ffffff',
    color: '#334155',
    padding: '10px 30px 10px 11px',
    fontSize: '12px',
    fontWeight: 600,
    outline: 0,
  },

  resultInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '15px',
    margin: '17px 2px 12px',
    color: '#64748b',
    fontSize: '12px',
  },

  clearFilters: {
    border: 0,
    background: 'transparent',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  ticketList: {
    display: 'grid',
    gap: '12px',
  },

  ticketCard: {
    display: 'block',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '15px',
    padding: '20px',
    textDecoration: 'none',
    color: '#172033',
    boxShadow: '0 3px 10px rgba(15, 23, 42, 0.025)',
  },

  ticketTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '15px',
  },

  ticketIdentification: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },

  ticketNumber: {
    fontSize: '12px',
    fontWeight: 900,
  },

  ticketCategory: {
    background: '#f1f5f9',
    color: '#64748b',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '10px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '10px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'currentColor',
  },

  ticketBody: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    marginTop: '15px',
  },

  ticketContent: {
    minWidth: 0,
  },

  ticketTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
    lineHeight: 1.35,
  },

  ticketDescription: {
    margin: '7px 0 0',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },

  ticketArrow: {
    fontSize: '24px',
    fontWeight: 500,
    flexShrink: 0,
  },

  ticketFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '15px',
    borderTop: '1px solid #f1f5f9',
    marginTop: '17px',
    paddingTop: '14px',
  },

  ticketMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    color: '#94a3b8',
    fontSize: '10px',
  },

  metaSeparator: {
    color: '#cbd5e1',
  },

  priorityBadge: {
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '9px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  emptyCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '55px 25px',
    textAlign: 'center',
  },

  emptyIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 15px',
    fontSize: '25px',
    fontWeight: 800,
  },

  emptyTitle: {
    margin: 0,
    fontSize: '19px',
  },

  emptyText: {
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.6,
    maxWidth: '500px',
    margin: '9px auto 22px',
  },

  helpCard: {
    marginTop: '30px',
    color: '#ffffff',
    borderRadius: '17px',
    padding: '23px 25px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },

  helpIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: '18px',
    flexShrink: 0,
  },

  helpContent: {
    flex: 1,
  },

  helpTitle: {
    margin: 0,
    fontSize: '15px',
  },

  helpText: {
    margin: '5px 0 0',
    color: '#cbd5e1',
    fontSize: '11px',
    lineHeight: 1.5,
  },

  helpButton: {
    flexShrink: 0,
    background: '#ffffff',
    color: '#172033',
    textDecoration: 'none',
    borderRadius: '9px',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 800,
  },

  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '30px',
    paddingTop: '18px',
    borderTop: '1px solid #e2e8f0',
    color: '#94a3b8',
    fontSize: '10px',
  },

  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    color: '#64748b',
    fontSize: '13px',
  },

  loadingSpinner: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #dbeafe',
  },
}
