'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import type { Marca } from '@/lib/marca'

type Perfil = {
  nome: string | null
  email: string | null
  empresa_id: string | null
}

type Empresa = {
  razao_social: string
  nome_fantasia: string | null
}

type ChamadoResumo = {
  id: string
  numero: number
  assunto: string
  status: string
  prioridade: string
  created_at: string
}

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
    },
    normal: {
      color: '#2563eb',
    },
    alta: {
      color: '#ea580c',
    },
    urgente: {
      color: '#dc2626',
    },
  }

  return estilos[prioridade] || estilos.normal
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

export default function HomePage() {
  const router = useRouter()

  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [chamados, setChamados] = useState<ChamadoResumo[]>([])
  const [marca, setMarca] = useState<Marca>('agilmed')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregarDados() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: perfilData } = await supabase
        .from('profiles')
        .select('nome, email, empresa_id')
        .eq('id', user.id)
        .single()

      if (!perfilData) {
        setLoading(false)
        return
      }

      setPerfil(perfilData)

      const marcaEmpresa = await obterMarcaDaEmpresa()
      setMarca(marcaEmpresa)

      if (perfilData.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('razao_social, nome_fantasia')
          .eq('id', perfilData.empresa_id)
          .single()

        setEmpresa(empresaData)

        const { data: chamadosData } = await supabase
          .from('chamados')
          .select(
            'id, numero, assunto, status, prioridade, created_at'
          )
          .eq('empresa_id', perfilData.empresa_id)
          .order('created_at', { ascending: false })
          .limit(5)

        setChamados(chamadosData || [])
      }

      setLoading(false)
    }

    carregarDados()
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tema = identidade[marca]

  const nomeUsuario =
    perfil?.nome?.split(' ')[0] || 'Cliente'

  const chamadosAbertos = chamados.filter(
    (chamado) =>
      chamado.status !== 'resolvido' &&
      chamado.status !== 'encerrado'
  ).length

  const chamadosResolvidos = chamados.filter(
    (chamado) =>
      chamado.status === 'resolvido' ||
      chamado.status === 'encerrado'
  ).length

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          Carregando seu portal...
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        ...styles.page,
        '--marca-principal': tema.principal,
        '--marca-fundo': tema.fundo,
        '--marca-borda': tema.borda,
      } as React.CSSProperties}
    >
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
            <Link
              href="/"
              style={{
                ...styles.navLinkActive,
                color: tema.principal,
              }}
            >
              Início
            </Link>

            <Link href="/chamados" style={styles.navLink}>
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

            <button
              type="button"
              onClick={sair}
              style={styles.logoutButton}
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <div style={styles.container}>
        <section style={styles.hero}>
          <div>
            <div
              style={{
                ...styles.eyebrow,
                color: tema.principal,
              }}
            >
              PORTAL DO CLIENTE
            </div>

            <h1 style={styles.heroTitle}>
              Olá, {nomeUsuario}.
              <br />
              Como podemos ajudar?
            </h1>

            <p style={styles.heroText}>
              Abra chamados, acompanhe atendimentos e converse
              diretamente com nossa equipe em um só lugar.
            </p>

            <div style={styles.heroActions}>
              <Link
                href="/chamados/novo"
                style={{
                  ...styles.primaryButton,
                  background: tema.principal,
                  borderColor: tema.principal,
                }}
              >
                + Abrir novo chamado
              </Link>

              <Link
                href="/chamados"
                style={{
                  ...styles.secondaryButton,
                  color: tema.principal,
                  borderColor: tema.borda,
                }}
              >
                Ver meus chamados
              </Link>
            </div>
          </div>

          <div
            style={{
              ...styles.heroCard,
              background: tema.fundo,
              borderColor: tema.borda,
            }}
          >
            <div
              style={{
                ...styles.heroCardLabel,
                color: tema.principal,
              }}
            >
              SUA EMPRESA
            </div>

            <div style={styles.heroCardTitle}>
              {empresa?.nome_fantasia ||
                empresa?.razao_social ||
                'Empresa cliente'}
            </div>

            <div style={styles.heroCardText}>
              Estamos prontos para atender suas solicitações.
            </div>
          </div>
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
              📋
            </div>

            <div>
              <div style={styles.statNumber}>
                {chamados.length}
              </div>

              <div style={styles.statLabel}>
                Chamados recentes
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
              ⏳
            </div>

            <div>
              <div style={styles.statNumber}>
                {chamadosAbertos}
              </div>

              <div style={styles.statLabel}>
                Em atendimento
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
              ✓
            </div>

            <div>
              <div style={styles.statNumber}>
                {chamadosResolvidos}
              </div>

              <div style={styles.statLabel}>
                Resolvidos
              </div>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div
                style={{
                  ...styles.sectionEyebrow,
                  color: tema.principal,
                }}
              >
                ATENDIMENTO
              </div>

              <h2 style={styles.sectionTitle}>
                Acesso rápido
              </h2>
            </div>
          </div>

          <div style={styles.quickGrid}>
            <Link
              href="/chamados/novo"
              style={styles.quickCard}
            >
              <div
                style={{
                  ...styles.quickIcon,
                  background: tema.fundo,
                  color: tema.principal,
                }}
              >
                +
              </div>

              <div>
                <h3 style={styles.quickTitle}>
                  Novo chamado
                </h3>

                <p style={styles.quickText}>
                  Precisa de ajuda? Registre uma nova
                  solicitação para nossa equipe.
                </p>
              </div>

              <span
                style={{
                  ...styles.arrow,
                  color: tema.principal,
                }}
              >
                →
              </span>
            </Link>

            <Link
              href="/chamados"
              style={styles.quickCard}
            >
              <div
                style={{
                  ...styles.quickIcon,
                  background: tema.fundo,
                  color: tema.principal,
                }}
              >
                ☰
              </div>

              <div>
                <h3 style={styles.quickTitle}>
                  Meus chamados
                </h3>

                <p style={styles.quickText}>
                  Consulte chamados, status, mensagens e
                  histórico de atendimentos.
                </p>
              </div>

              <span
                style={{
                  ...styles.arrow,
                  color: tema.principal,
                }}
              >
                →
              </span>
            </Link>

            <div style={styles.quickCardDisabled}>
              <div style={styles.quickIconDisabled}>
                ▣
              </div>

              <div>
                <h3 style={styles.quickTitle}>
                  Documentos
                </h3>

                <p style={styles.quickText}>
                  Acesse documentos e arquivos
                  disponibilizados pela equipe.
                </p>
              </div>

              <span style={styles.comingSoon}>
                Em breve
              </span>
            </div>

            <div style={styles.quickCardDisabled}>
              <div style={styles.quickIconDisabled}>
                ◔
              </div>

              <div>
                <h3 style={styles.quickTitle}>
                  Indicadores
                </h3>

                <p style={styles.quickText}>
                  Acompanhe indicadores e resultados dos
                  seus atendimentos.
                </p>
              </div>

              <span style={styles.comingSoon}>
                Em breve
              </span>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div
                style={{
                  ...styles.sectionEyebrow,
                  color: tema.principal,
                }}
              >
                HISTÓRICO
              </div>

              <h2 style={styles.sectionTitle}>
                Chamados recentes
              </h2>
            </div>

            <Link
              href="/chamados"
              style={{
                ...styles.viewAll,
                color: tema.principal,
              }}
            >
              Ver todos →
            </Link>
          </div>

          {chamados.length === 0 ? (
            <div style={styles.emptyCard}>
              <div style={styles.emptyIcon}>📋</div>

              <h3 style={styles.emptyTitle}>
                Nenhum chamado ainda
              </h3>

              <p style={styles.emptyText}>
                Quando você abrir uma solicitação, ela
                aparecerá aqui.
              </p>

              <Link
                href="/chamados/novo"
                style={{
                  ...styles.primaryButton,
                  background: tema.principal,
                  borderColor: tema.principal,
                }}
              >
                Abrir primeiro chamado
              </Link>
            </div>
          ) : (
            <div style={styles.tableCard}>
              {chamados.map((chamado, index) => (
                <Link
                  key={chamado.id}
                  href={`/chamados/${chamado.id}`}
                  style={{
                    ...styles.ticketRow,
                    ...(index === chamados.length - 1
                      ? styles.lastRow
                      : {}),
                  }}
                >
                  <div
                    style={{
                      ...styles.ticketNumber,
                      color: tema.principal,
                    }}
                  >
                    #{chamado.numero}
                  </div>

                  <div style={styles.ticketMain}>
                    <div style={styles.ticketSubject}>
                      {chamado.assunto}
                    </div>

                    <div style={styles.ticketDate}>
                      Aberto em{' '}
                      {formatarData(chamado.created_at)}
                    </div>
                  </div>

                  <div style={styles.ticketPriority}>
                    <span
                      style={prioridadeStyle(
                        chamado.prioridade
                      )}
                    >
                      {prioridadeLabels[
                        chamado.prioridade
                      ] || chamado.prioridade}
                    </span>
                  </div>

                  <div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...statusStyle(chamado.status),
                      }}
                    >
                      {statusLabels[chamado.status] ||
                        chamado.status}
                    </span>
                  </div>

                  <div style={styles.ticketArrow}>→</div>
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
          <div>
            <div style={styles.helpEyebrow}>
              PRECISA DE AJUDA?
            </div>

            <h2 style={styles.helpTitle}>
              Nossa equipe está pronta para atender você.
            </h2>

            <p style={styles.helpText}>
              Abra um chamado pelo portal e acompanhe todo
              o atendimento de forma simples e transparente.
            </p>
          </div>

          <Link
            href="/chamados/novo"
            style={styles.helpButton}
          >
            Abrir chamado
          </Link>
        </section>

        <footer style={styles.footer}>
          <div>
            <strong>{tema.nome}</strong>
            <span> · Portal do Cliente</span>
          </div>

          <div>{perfil?.email || ''}</div>
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
    fontWeight: 700,
  },

  navDisabled: {
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: 600,
  },

  logoutButton: {
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#64748b',
    borderRadius: '9px',
    padding: '8px 13px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },

  container: {
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '42px 24px 60px',
  },

  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 360px',
    gap: '32px',
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '22px',
    padding: '42px',
    boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
  },

  eyebrow: {
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.12em',
    marginBottom: '12px',
  },

  heroTitle: {
    margin: 0,
    fontSize: '38px',
    lineHeight: 1.12,
    letterSpacing: '-0.03em',
  },

  heroText: {
    maxWidth: '680px',
    color: '#64748b',
    fontSize: '16px',
    lineHeight: 1.7,
    margin: '18px 0 0',
  },

  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '26px',
  },

  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '12px 17px',
    fontSize: '13px',
    fontWeight: 800,
    textDecoration: 'none',
    border: '1px solid',
  },

  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    borderRadius: '10px',
    padding: '12px 17px',
    fontSize: '13px',
    fontWeight: 800,
    textDecoration: 'none',
    border: '1px solid',
  },

  heroCard: {
    borderRadius: '18px',
    padding: '25px',
    border: '1px solid',
  },

  heroCardLabel: {
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.1em',
    marginBottom: '10px',
  },

  heroCardTitle: {
    color: '#172033',
    fontSize: '20px',
    fontWeight: 800,
    lineHeight: 1.3,
  },

  heroCardText: {
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.6,
    marginTop: '10px',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '18px',
    marginTop: '22px',
  },

  statCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '21px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },

  statIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '19px',
    fontWeight: 800,
  },

  statNumber: {
    fontSize: '24px',
    fontWeight: 900,
    lineHeight: 1,
  },

  statLabel: {
    color: '#64748b',
    fontSize: '12px',
    marginTop: '5px',
  },

  section: {
    marginTop: '42px',
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '20px',
    marginBottom: '18px',
  },

  sectionEyebrow: {
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.1em',
    marginBottom: '6px',
  },

  sectionTitle: {
    margin: 0,
    fontSize: '24px',
    letterSpacing: '-0.02em',
  },

  viewAll: {
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 700,
  },

  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '18px',
  },

  quickCard: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '23px',
    textDecoration: 'none',
    color: '#172033',
  },

  quickCardDisabled: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '23px',
    opacity: 0.72,
  },

  quickIcon: {
    width: '43px',
    height: '43px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '21px',
    fontWeight: 800,
    flexShrink: 0,
  },

  quickIconDisabled: {
    width: '43px',
    height: '43px',
    borderRadius: '12px',
    background: '#f1f5f9',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 800,
    flexShrink: 0,
  },

  quickTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
  },

  quickText: {
    margin: '7px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.55,
  },

  arrow: {
    position: 'absolute',
    right: '20px',
    bottom: '18px',
    fontSize: '18px',
    fontWeight: 800,
  },

  comingSoon: {
    position: 'absolute',
    right: '17px',
    top: '17px',
    background: '#f1f5f9',
    color: '#64748b',
    borderRadius: '999px',
    padding: '5px 8px',
    fontSize: '9px',
    fontWeight: 800,
  },

  tableCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    overflow: 'hidden',
  },

  ticketRow: {
    display: 'grid',
    gridTemplateColumns: '80px minmax(0, 1fr) 100px 150px 25px',
    alignItems: 'center',
    gap: '16px',
    padding: '18px 21px',
    borderBottom: '1px solid #eef0f3',
    textDecoration: 'none',
    color: '#172033',
  },

  lastRow: {
    borderBottom: 0,
  },

  ticketNumber: {
    fontSize: '12px',
    fontWeight: 800,
  },

  ticketMain: {
    minWidth: 0,
  },

  ticketSubject: {
    fontSize: '14px',
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  ticketDate: {
    color: '#94a3b8',
    fontSize: '11px',
    marginTop: '5px',
  },

  ticketPriority: {
    fontSize: '12px',
    fontWeight: 700,
  },

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  ticketArrow: {
    color: '#94a3b8',
    fontSize: '17px',
  },

  emptyCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '45px 25px',
    textAlign: 'center',
  },

  emptyIcon: {
    fontSize: '32px',
    marginBottom: '10px',
  },

  emptyTitle: {
    margin: 0,
    fontSize: '18px',
  },

  emptyText: {
    color: '#64748b',
    fontSize: '13px',
    margin: '8px auto 20px',
    maxWidth: '440px',
  },

  helpCard: {
    marginTop: '42px',
    color: '#ffffff',
    borderRadius: '20px',
    padding: '30px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '25px',
  },

  helpEyebrow: {
    color: '#ccfbf1',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.1em',
    marginBottom: '7px',
  },

  helpTitle: {
    margin: 0,
    fontSize: '21px',
  },

  helpText: {
    margin: '8px 0 0',
    color: '#dbeafe',
    fontSize: '13px',
    lineHeight: 1.6,
    maxWidth: '680px',
  },

  helpButton: {
    flexShrink: 0,
    background: '#ffffff',
    color: '#172033',
    textDecoration: 'none',
    borderRadius: '10px',
    padding: '12px 17px',
    fontSize: '13px',
    fontWeight: 800,
  },

  footer: {
    marginTop: '35px',
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    color: '#94a3b8',
    fontSize: '11px',
  },

  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
}
