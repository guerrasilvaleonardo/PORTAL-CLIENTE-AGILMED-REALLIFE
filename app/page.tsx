'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { marcas, type Marca } from '@/lib/marca'
import { obterMarcaDaEmpresa } from '@/lib/empresa'

type Perfil = {
  nome: string | null
  email: string | null
  empresa_id: string | null
  perfil: 'cliente' | 'gestor' | 'admin'
}

type Chamado = {
  id: string
  numero: number
  categoria: string
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

  welcome: {
    marginBottom: '28px',
  },

  welcomeTitle: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.2,
    fontWeight: 700,
    color: '#172033',
  },

  welcomeText: {
    margin: '8px 0 0',
    fontSize: '16px',
    color: '#64748b',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '18px',
    marginBottom: '28px',
  },

  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '22px',
    boxShadow: '0 5px 15px rgba(15, 23, 42, 0.05)',
  },

  cardLabel: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b',
  },

  cardValue: {
    margin: '8px 0 0',
    fontSize: '30px',
    fontWeight: 700,
    color: '#172033',
  },

  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '18px',
    marginBottom: '28px',
  },

  actionCard: {
    borderRadius: '18px',
    padding: '24px',
    color: '#ffffff',
    textDecoration: 'none',
    minHeight: '150px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
  },

  actionTitle: {
    margin: 0,
    fontSize: '21px',
    fontWeight: 700,
  },

  actionText: {
    margin: '8px 0 0',
    fontSize: '14px',
    lineHeight: 1.5,
    opacity: 0.92,
  },

  section: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    overflow: 'hidden',
    boxShadow: '0 5px 15px rgba(15, 23, 42, 0.05)',
  },

  sectionHeader: {
    padding: '22px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },

  sectionTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#172033',
  },

  sectionLink: {
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
  },

  ticketRow: {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 150px 120px',
    gap: '18px',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #eef0f3',
    textDecoration: 'none',
  },

  lastRow: {
    borderBottom: 'none',
  },

  ticketNumber: {
    fontSize: '14px',
    fontWeight: 700,
  },

  ticketSubject: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#172033',
  },

  ticketCategory: {
    margin: '4px 0 0',
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
    textAlign: 'right' as const,
  },

  empty: {
    padding: '40px 24px',
    textAlign: 'center' as const,
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
    padding: '20px',
    borderRadius: '12px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    marginBottom: '20px',
  },
}

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [marca, setMarca] = useState<Marca | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function carregarDados() {
      try {
        setLoading(true)
        setError(null)

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (ativo) {
            setError('Usuário não autenticado.')
            setLoading(false)
          }

          return
        }

        const { data: perfilData, error: perfilError } =
          await supabase
            .from('profiles')
            .select('nome, email, empresa_id, perfil')
            .eq('id', user.id)
            .single()

        if (perfilError) {
          throw perfilError
        }

        if (!perfilData?.empresa_id) {
          throw new Error(
            'Empresa do usuário não encontrada.'
          )
        }

        /*
         * A marca da empresa é obtida pela mesma função
         * utilizada pelo cabeçalho do portal.
         */
        const marcaEmpresa = await obterMarcaDaEmpresa()

        if (!marcaEmpresa) {
          throw new Error(
            'Não foi possível identificar a marca da empresa.'
          )
        }

        if (!ativo) {
          return
        }

        setMarca(marcaEmpresa)
        setPerfil(perfilData as Perfil)

        /*
         * Busca somente os chamados da empresa do usuário.
         */
        const {
          data: chamadosData,
          error: chamadosError,
        } = await supabase
          .from('chamados')
          .select(
            'id, numero, categoria, assunto, status, prioridade, created_at'
          )
          .eq('empresa_id', perfilData.empresa_id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (chamadosError) {
          throw chamadosError
        }

        if (!ativo) {
          return
        }

        setChamados(
          (chamadosData || []) as Chamado[]
        )
      } catch (err) {
        console.error(
          'Erro ao carregar portal:',
          err
        )

        if (ativo) {
          setError(
            'Não foi possível carregar os dados do portal.'
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
        {error
          ? error
          : 'Carregando portal...'}
      </div>
    )
  }

  const tema = marcas[marca]

  const totalChamados = chamados.length

  const abertos = chamados.filter(
    (chamado) =>
      chamado.status === 'aberto' ||
      chamado.status === 'em_atendimento' ||
      chamado.status === 'aguardando_cliente'
  ).length

  const resolvidos = chamados.filter(
    (chamado) =>
      chamado.status === 'resolvido' ||
      chamado.status === 'encerrado'
  ).length

  const urgentes = chamados.filter(
    (chamado) =>
      chamado.prioridade === 'urgente'
  ).length

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.welcome}>
          <h1 style={styles.welcomeTitle}>
            Olá, {perfil?.nome || 'Cliente'}!
          </h1>

          <p style={styles.welcomeText}>
            Bem-vindo ao Portal do Cliente{' '}
            {tema.nome}.
          </p>
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <div
          style={{
            ...styles.grid,
            gridTemplateColumns:
              'repeat(4, minmax(0, 1fr))',
          }}
        >
          <div style={styles.card}>
            <p style={styles.cardLabel}>
              Chamados recentes
            </p>

            <p style={styles.cardValue}>
              {totalChamados}
            </p>
          </div>

          <div style={styles.card}>
            <p style={styles.cardLabel}>
              Em andamento
            </p>

            <p style={styles.cardValue}>
              {abertos}
            </p>
          </div>

          <div style={styles.card}>
            <p style={styles.cardLabel}>
              Resolvidos
            </p>

            <p style={styles.cardValue}>
              {resolvidos}
            </p>
          </div>

          <div style={styles.card}>
            <p style={styles.cardLabel}>
              Urgentes
            </p>

            <p style={styles.cardValue}>
              {urgentes}
            </p>
          </div>
        </div>

        <div style={styles.actionsGrid}>
          <Link
            href="/chamados/novo"
            style={{
              ...styles.actionCard,
              background: tema.principal,
            }}
          >
            <div>
              <h2 style={styles.actionTitle}>
                Novo chamado
              </h2>

              <p style={styles.actionText}>
                Solicite atendimento à nossa equipe.
              </p>
            </div>

            <strong>
              + Abrir chamado
            </strong>
          </Link>

          <Link
            href="/chamados"
            style={{
              ...styles.actionCard,
              background: tema.dark,
            }}
          >
            <div>
              <h2 style={styles.actionTitle}>
                Meus chamados
              </h2>

              <p style={styles.actionText}>
                Consulte seus chamados, mensagens e
                andamento.
              </p>
            </div>

            <strong>
              Ver chamados →
            </strong>
          </Link>
        </div>

        {perfil?.perfil === 'gestor' ||
        perfil?.perfil === 'admin' ? (
          <div style={{ marginBottom: '28px' }}>
            <Link
              href="/atendimento"
              style={{
                display: 'block',
                padding: '22px 24px',
                borderRadius: '18px',
                background: tema.fundo,
                border: `1px solid ${tema.borda}`,
                color: tema.dark,
                textDecoration: 'none',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  fontSize: '18px',
                  marginBottom: '6px',
                }}
              >
                Atendimento interno
              </strong>

              <span
                style={{
                  fontSize: '14px',
                  color: '#64748b',
                }}
              >
                Acesse a área de gestão e atendimento
                dos chamados.
              </span>
            </Link>
          </div>
        ) : null}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              Chamados recentes
            </h2>

            <Link
              href="/chamados"
              style={{
                ...styles.sectionLink,
                color: tema.principal,
              }}
            >
              Ver todos
            </Link>
          </div>

          {chamados.length === 0 ? (
            <div style={styles.empty}>
              <p style={{ margin: 0 }}>
                Você ainda não possui chamados.
              </p>

              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: '14px',
                }}
              >
                Clique em “Novo chamado” para
                solicitar atendimento.
              </p>
            </div>
          ) : (
            <div>
              {chamados.map(
                (chamado, index) => (
                  <Link
                    key={chamado.id}
                    href={
                      '/chamados/' +
                      chamado.id
                    }
                    style={{
                      ...styles.ticketRow,
                      ...(index ===
                      chamados.length - 1
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

                    <div>
                      <p
                        style={
                          styles.ticketSubject
                        }
                      >
                        {chamado.assunto}
                      </p>

                      <p
                        style={
                          styles.ticketCategory
                        }
                      >
                        {chamado.categoria}
                      </p>
                    </div>

                    <div>
                      <span
                        style={{
                          ...styles.badge,
                          background:
                            chamado.status ===
                            'aberto'
                              ? '#eff6ff'
                              : chamado.status ===
                                  'em_atendimento'
                                ? '#fff7ed'
                                : chamado.status ===
                                    'aguardando_cliente'
                                  ? '#fefce8'
                                  : '#f0fdf4',
                          color:
                            chamado.status ===
                            'aberto'
                              ? '#1d4ed8'
                              : chamado.status ===
                                  'em_atendimento'
                                ? '#c2410c'
                                : chamado.status ===
                                    'aguardando_cliente'
                                  ? '#a16207'
                                  : '#15803d',
                        }}
                      >
                        {statusLabels[
                          chamado.status
                        ] || chamado.status}
                      </span>
                    </div>

                    <div
                      style={{
                        ...styles.priority,
                        color:
                          chamado.prioridade ===
                          'urgente'
                            ? '#dc2626'
                            : chamado.prioridade ===
                                'alta'
                              ? '#ea580c'
                              : '#64748b',
                      }}
                    >
                      {prioridadeLabels[
                        chamado.prioridade
                      ] || chamado.prioridade}
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
