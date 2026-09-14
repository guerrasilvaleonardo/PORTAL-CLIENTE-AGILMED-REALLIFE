import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Chamado = {
  id: string
  numero: number
  categoria: string
  assunto: string
  descricao: string
  prioridade: string
  status: string
  prazo_sla: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  avaliacao: number | null
  comentario_avaliacao: string | null
  created_at: string
  updated_at: string
}

type Mensagem = {
  id: string
  chamado_id: string
  autor_id: string
  mensagem: string
  created_at: string
  autor_nome: string
  autor_perfil: string
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

function formatarData(data: string | null) {
  if (!data) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(data))
}

export default function DetalhesChamadoPage() {
  const params = useParams()
  const router = useRouter()

  const chamadoId = Array.isArray(params.id) ? params.id[0] : params.id

  const [chamado, setChamado] = useState<Chamado | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [novaMensagem, setNovaMensagem] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: chamadoData, error: chamadoError } = await supabase
        .from('chamados')
        .select(
          `
            id,
            numero,
            categoria,
            assunto,
            descricao,
            prioridade,
            status,
            prazo_sla,
            resolvido_em,
            encerrado_em,
            avaliacao,
            comentario_avaliacao,
            created_at,
            updated_at
          `
        )
        .eq('id', chamadoId)
        .single()

      if (chamadoError) {
        console.error(chamadoError)
        setErro('Não foi possível carregar o chamado.')
        setLoading(false)
        return
      }

      setChamado(chamadoData as Chamado)

      const { data: mensagensData, error: mensagensError } =
        await supabase
          .from('chamado_mensagens')
          .select(
            `
              id,
              chamado_id,
              autor_id,
              mensagem,
              created_at
            `
          )
          .eq('chamado_id', chamadoId)
          .order('created_at', { ascending: true })

      if (mensagensError) {
        console.error(mensagensError)
        setErro('O chamado foi carregado, mas não foi possível carregar as mensagens.')
        setMensagens([])
        setLoading(false)
        return
      }

      const mensagensBase = mensagensData ?? []

      if (mensagensBase.length === 0) {
        setMensagens([])
        setLoading(false)
        return
      }

      const autorIds = [
        ...new Set(
          mensagensBase.map((item) => item.autor_id).filter(Boolean)
        ),
      ]

      const { data: perfisData, error: perfisError } = await supabase
        .from('profiles')
        .select('id, nome, perfil')
        .in('id', autorIds)

      if (perfisError) {
        console.error(perfisError)
      }

      const perfis = perfisData ?? []

      const mensagensFormatadas: Mensagem[] = mensagensBase.map((item) => {
        const perfil = perfis.find((p) => p.id === item.autor_id)

        return {
          id: item.id,
          chamado_id: item.chamado_id,
          autor_id: item.autor_id,
          mensagem: item.mensagem,
          created_at: item.created_at,
          autor_nome: perfil?.nome || 'Usuário',
          autor_perfil: perfil?.perfil || 'cliente',
        }
      })

      setMensagens(mensagensFormatadas)
      setLoading(false)
    }

    if (chamadoId) {
      carregar()
    }
  }, [chamadoId, router])

  async function enviarMensagem(event: React.FormEvent) {
    event.preventDefault()

    if (!novaMensagem.trim()) return

    setEnviando(true)
    setErro('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('chamado_mensagens')
      .insert({
        chamado_id: chamadoId,
        autor_id: user.id,
        mensagem: novaMensagem.trim(),
      })
      .select('id, chamado_id, autor_id, mensagem, created_at')
      .single()

    if (error) {
      console.error(error)
      setErro('Não foi possível enviar a mensagem.')
      setEnviando(false)
      return
    }

    const { data: perfil } = await supabase
      .from('profiles')
      .select('nome, perfil')
      .eq('id', user.id)
      .single()

    const mensagemFormatada: Mensagem = {
      id: data.id,
      chamado_id: data.chamado_id,
      autor_id: data.autor_id,
      mensagem: data.mensagem,
      created_at: data.created_at,
      autor_nome: perfil?.nome || 'Você',
      autor_perfil: perfil?.perfil || 'cliente',
    }

    setMensagens((atual) => [...atual, mensagemFormatada])
    setNovaMensagem('')
    setEnviando(false)
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loading}>Carregando chamado...</div>
        </div>
      </main>
    )
  }

  if (!chamado) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.errorCard}>
            <h1 style={styles.errorTitle}>Chamado não encontrado</h1>
            <p style={styles.errorText}>
              {erro || 'Não foi possível localizar este chamado.'}
            </p>

            <Link href="/chamados" style={styles.primaryButton}>
              Voltar para chamados
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div>
            <Link href="/chamados" style={styles.backLink}>
              ← Voltar para chamados
            </Link>

            <div style={styles.eyebrow}>
              CHAMADO #{chamado.numero}
            </div>

            <h1 style={styles.title}>{chamado.assunto}</h1>

            <p style={styles.subtitle}>
              Acompanhe o andamento e converse com nossa equipe.
            </p>
          </div>

          <Link href="/chamados/novo" style={styles.primaryButton}>
            + Novo chamado
          </Link>
        </div>

        {erro && (
          <div style={styles.warning}>
            {erro}
          </div>
        )}

        <section style={styles.grid}>
          <div style={styles.mainColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Detalhes do chamado</h2>

                <span
                  style={{
                    ...styles.statusBadge,
                    ...statusStyle(chamado.status),
                  }}
                >
                  {statusLabels[chamado.status] || chamado.status}
                </span>
              </div>

              <div style={styles.infoGrid}>
                <Info label="Categoria" value={chamado.categoria} />
                <Info
                  label="Prioridade"
                  value={
                    prioridadeLabels[chamado.prioridade] ||
                    chamado.prioridade
                  }
                />
                <Info
                  label="Abertura"
                  value={formatarData(chamado.created_at)}
                />
                <Info
                  label="Atualização"
                  value={formatarData(chamado.updated_at)}
                />
                <Info
                  label="Prazo SLA"
                  value={formatarData(chamado.prazo_sla)}
                />
                <Info
                  label="Encerramento"
                  value={formatarData(chamado.encerrado_em)}
                />
              </div>

              <div style={styles.descriptionBox}>
                <div style={styles.label}>Descrição</div>
                <p style={styles.description}>{chamado.descricao}</p>
              </div>

              {chamado.avaliacao && (
                <div style={styles.evaluationBox}>
                  <div style={styles.label}>Avaliação</div>

                  <div style={styles.stars}>
                    {'★'.repeat(chamado.avaliacao)}
                    {'☆'.repeat(5 - chamado.avaliacao)}
                  </div>

                  {chamado.comentario_avaliacao && (
                    <p style={styles.description}>
                      {chamado.comentario_avaliacao}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Conversas</h2>

                <span style={styles.messageCount}>
                  {mensagens.length}{' '}
                  {mensagens.length === 1 ? 'mensagem' : 'mensagens'}
                </span>
              </div>

              {mensagens.length === 0 ? (
                <div style={styles.emptyMessages}>
                  Ainda não existem mensagens neste chamado.
                </div>
              ) : (
                <div style={styles.messageList}>
                  {mensagens.map((mensagem) => {
                    const isCliente = mensagem.autor_id !== null

                    return (
                      <div key={mensagem.id} style={styles.messageItem}>
                        <div style={styles.messageAvatar}>
                          {mensagem.autor_nome
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div style={styles.messageContent}>
                          <div style={styles.messageMeta}>
                            <strong>{mensagem.autor_nome}</strong>

                            <span style={styles.profileTag}>
                              {mensagem.autor_perfil === 'cliente'
                                ? 'Cliente'
                                : 'Equipe'}
                            </span>

                            <span style={styles.messageDate}>
                              {formatarData(mensagem.created_at)}
                            </span>
                          </div>

                          <div
                            style={{
                              ...styles.messageBubble,
                              ...(isCliente
                                ? styles.clientMessage
                                : styles.teamMessage),
                            }}
                          >
                            {mensagem.mensagem}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <form onSubmit={enviarMensagem} style={styles.messageForm}>
                <textarea
                  value={novaMensagem}
                  onChange={(event) =>
                    setNovaMensagem(event.target.value)
                  }
                  placeholder="Digite sua mensagem..."
                  rows={4}
                  style={styles.textarea}
                />

                <div style={styles.formFooter}>
                  <span style={styles.helper}>
                    Envie uma mensagem para continuar o atendimento.
                  </span>

                  <button
                    type="submit"
                    disabled={enviando || !novaMensagem.trim()}
                    style={{
                      ...styles.primaryButton,
                      ...(enviando || !novaMensagem.trim()
                        ? styles.disabledButton
                        : {}),
                    }}
                  >
                    {enviando ? 'Enviando...' : 'Enviar mensagem'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <aside style={styles.sideColumn}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Andamento</h2>

              <div style={styles.timeline}>
                <TimelineItem
                  title="Chamado aberto"
                  date={formatarData(chamado.created_at)}
                  active
                />

                <TimelineItem
                  title="Em atendimento"
                  active={
                    chamado.status === 'em_atendimento' ||
                    chamado.status === 'aguardando_cliente' ||
                    chamado.status === 'resolvido' ||
                    chamado.status === 'encerrado'
                  }
                />

                <TimelineItem
                  title="Resolvido"
                  date={formatarData(chamado.resolvido_em)}
                  active={
                    chamado.status === 'resolvido' ||
                    chamado.status === 'encerrado'
                  }
                />

                <TimelineItem
                  title="Encerrado"
                  date={formatarData(chamado.encerrado_em)}
                  active={chamado.status === 'encerrado'}
                  last
                />
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Próximos passos</h2>

              <p style={styles.sideText}>
                Nossa equipe acompanhará este chamado e responderá
                diretamente por aqui.
              </p>

              <Link href="/chamados" style={styles.secondaryButton}>
                Ver meus chamados
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div style={styles.label}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  )
}

function TimelineItem({
  title,
  date,
  active,
  last,
}: {
  title: string
  date?: string
  active: boolean
  last?: boolean
}) {
  return (
    <div style={styles.timelineItem}>
      <div style={styles.timelineRail}>
        <div
          style={{
            ...styles.timelineDot,
            ...(active ? styles.timelineDotActive : {}),
          }}
        />
        {!last && <div style={styles.timelineLine} />}
      </div>

      <div style={styles.timelineContent}>
        <strong
          style={{
            color: active ? '#172033' : '#94a3b8',
          }}
        >
          {title}
        </strong>

        {date && <span style={styles.timelineDate}>{date}</span>}
      </div>
    </div>
  )
}

function statusStyle(status: string) {
  const stylesByStatus: Record<string, React.CSSProperties> = {
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

  return stylesByStatus[status] || stylesByStatus.aberto
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
    padding: '32px 20px 60px',
  },

  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '24px',
    marginBottom: '28px',
  },

  backLink: {
    display: 'inline-block',
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '18px',
  },

  eyebrow: {
    color: '#2563eb',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    marginBottom: '8px',
  },

  title: {
    margin: 0,
    color: '#172033',
    fontSize: '32px',
    lineHeight: 1.15,
  },

  subtitle: {
    margin: '10px 0 0',
    color: '#64748b',
    fontSize: '15px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: '24px',
    alignItems: 'start',
  },

  mainColumn: {
    display: 'grid',
    gap: '24px',
  },

  sideColumn: {
    display: 'grid',
    gap: '24px',
  },

  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 5px 15px rgba(15, 23, 42, 0.05)',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '22px',
  },

  cardTitle: {
    margin: 0,
    color: '#172033',
    fontSize: '19px',
  },

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '22px',
    paddingBottom: '22px',
    borderBottom: '1px solid #eef0f3',
  },

  label: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '7px',
  },

  infoValue: {
    color: '#172033',
    fontSize: '14px',
    fontWeight: 600,
  },

  descriptionBox: {
    paddingTop: '22px',
  },

  description: {
    margin: 0,
    color: '#475569',
    fontSize: '15px',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
  },

  evaluationBox: {
    marginTop: '22px',
    paddingTop: '22px',
    borderTop: '1px solid #eef0f3',
  },

  stars: {
    color: '#f59e0b',
    fontSize: '22px',
    letterSpacing: '2px',
    marginBottom: '8px',
  },

  messageCount: {
    color: '#64748b',
    fontSize: '13px',
  },

  emptyMessages: {
    padding: '24px',
    textAlign: 'center',
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    color: '#64748b',
    fontSize: '14px',
  },

  messageList: {
    display: 'grid',
    gap: '18px',
  },

  messageItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },

  messageAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: '#e0ecff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    flexShrink: 0,
  },

  messageContent: {
    minWidth: 0,
    flex: 1,
  },

  messageMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '7px',
    color: '#172033',
    fontSize: '13px',
  },

  profileTag: {
    background: '#f1f5f9',
    color: '#64748b',
    borderRadius: '999px',
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 700,
  },

  messageDate: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 500,
  },

  messageBubble: {
    padding: '13px 15px',
    borderRadius: '12px',
    color: '#334155',
    fontSize: '14px',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },

  clientMessage: {
    background: '#eff6ff',
  },

  teamMessage: {
    background: '#f8fafc',
  },

  messageForm: {
    marginTop: '24px',
    paddingTop: '22px',
    borderTop: '1px solid #eef0f3',
  },

  textarea: {
    width: '100%',
    minHeight: '110px',
    resize: 'vertical',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '13px 14px',
    outline: 'none',
    color: '#172033',
    background: '#ffffff',
  },

  formFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginTop: '12px',
  },

  helper: {
    color: '#94a3b8',
    fontSize: '12px',
  },

  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#2563eb',
    color: '#ffffff',
    border: 0,
    borderRadius: '10px',
    padding: '11px 16px',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '11px 16px',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: '16px',
  },

  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  timeline: {
    marginTop: '22px',
  },

  timelineItem: {
    display: 'flex',
    gap: '12px',
    minHeight: '62px',
  },

  timelineRail: {
    width: '18px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  timelineDot: {
    width: '11px',
    height: '11px',
    borderRadius: '50%',
    background: '#cbd5e1',
    marginTop: '3px',
    flexShrink: 0,
  },

  timelineDotActive: {
    background: '#2563eb',
    boxShadow: '0 0 0 4px #dbeafe',
  },

  timelineLine: {
    width: '2px',
    flex: 1,
    background: '#e2e8f0',
    marginTop: '5px',
  },

  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingBottom: '18px',
    fontSize: '13px',
  },

  timelineDate: {
    color: '#94a3b8',
    fontSize: '11px',
  },

  sideText: {
    margin: '12px 0 0',
    color: '#64748b',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  loading: {
    background: '#ffffff',
    borderRadius: '18px',
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
  },

  errorCard: {
    background: '#ffffff',
    border: '1px solid #fecaca',
    borderRadius: '18px',
    padding: '32px',
    textAlign: 'center',
  },

  errorTitle: {
    margin: '0 0 10px',
    color: '#991b1b',
  },

  errorText: {
    color: '#64748b',
    marginBottom: '24px',
  },

  warning: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '20px',
    fontSize: '13px',
  },
}
