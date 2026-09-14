'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Chamado = {
  id: string
  numero: number
  categoria: string
  assunto: string
  descricao: string
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente'
  status:
    | 'aberto'
    | 'em_atendimento'
    | 'aguardando_cliente'
    | 'resolvido'
    | 'encerrado'
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
  autor?: {
    nome: string
    perfil: string
  } | null
}

const statusLabel: Record<Chamado['status'], string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

const prioridadeLabel: Record<Chamado['prioridade'], string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(data))
}

export default function DetalheChamadoPage() {
  const params = useParams()
  const router = useRouter()

  const chamadoId = String(params.id)

  const [loading, setLoading] = useState(true)
  const [chamado, setChamado] = useState<Chamado | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [novaMensagem, setNovaMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregarChamado() {
      setLoading(true)
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: chamadoData, error: chamadoError } =
        await supabase
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
            `,
          )
          .eq('id', chamadoId)
          .single()

      if (chamadoError || !chamadoData) {
        console.error(
          'Erro ao carregar chamado:',
          chamadoError,
        )

        setErro('Chamado não encontrado ou não disponível.')
        setLoading(false)
        return
      }

      setChamado(chamadoData)

      const { data: mensagensData, error: mensagensError } =
        await supabase
          .from('chamado_mensagens')
          .select(
            `
              id,
              chamado_id,
              autor_id,
              mensagem,
              created_at,
              autor:profiles!chamado_mensagens_autor_id_fkey (
                nome,
                perfil
              )
            `,
          )
          .eq('chamado_id', chamadoId)
          .order('created_at', { ascending: true })

      if (mensagensError) {
        console.error(
          'Erro ao carregar mensagens:',
          mensagensError,
        )
      } else {
        setMensagens((mensagensData || []) as Mensagem[])
      }

      setLoading(false)
    }

    carregarChamado()
  }, [chamadoId, router])

  async function enviarMensagem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!novaMensagem.trim()) {
      return
    }

    setEnviando(true)
    setErro('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    const texto = novaMensagem.trim()

    const { data, error } = await supabase
      .from('chamado_mensagens')
      .insert({
        chamado_id: chamadoId,
        autor_id: user.id,
        mensagem: texto,
      })
      .select(
        `
          id,
          chamado_id,
          autor_id,
          mensagem,
          created_at,
          autor:profiles!chamado_mensagens_autor_id_fkey (
            nome,
            perfil
          )
        `,
      )
      .single()

    if (error) {
      console.error('Erro ao enviar mensagem:', error)

      setErro(
        'Não foi possível enviar a mensagem. Tente novamente.',
      )

      setEnviando(false)
      return
    }

    setMensagens((atual) => [
      ...atual,
      data as Mensagem,
    ])

    setNovaMensagem('')
    setEnviando(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="loading-page">
        <div className="loading-card">
          <div className="loading-spinner" />

          <h2>Carregando chamado...</h2>

          <p>Aguarde enquanto buscamos as informações.</p>
        </div>

        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f7fa;
            padding: 24px;
          }

          .loading-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }

          .loading-spinner {
            width: 42px;
            height: 42px;
            margin: 0 auto 20px;
            border: 4px solid #dbe4e8;
            border-top-color: #0f766e;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin: 0 0 8px;
            color: #172033;
          }

          p {
            margin: 0;
            color: #64748b;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    )
  }

  if (!chamado) {
    return (
      <div className="error-page">
        <div className="error-card">
          <div className="error-icon">!</div>

          <h1>Chamado não encontrado</h1>

          <p>
            {erro ||
              'Não foi possível localizar este chamado.'}
          </p>

          <Link href="/chamados" className="back-button">
            Voltar para meus chamados
          </Link>
        </div>

        <style jsx>{`
          .error-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f7fa;
            padding: 24px;
          }

          .error-card {
            width: 100%;
            max-width: 450px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 40px;
            text-align: center;
          }

          .error-icon {
            width: 50px;
            height: 50px;
            margin: 0 auto 16px;
            border-radius: 50%;
            background: #fef2f2;
            color: #b91c1c;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: 800;
          }

          .error-card h1 {
            margin: 0;
            font-size: 21px;
          }

          .error-card p {
            margin: 8px 0 22px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
          }

          .back-button {
            display: inline-block;
            background: #0f766e;
            color: #ffffff;
            border-radius: 9px;
            padding: 11px 16px;
            font-size: 12px;
            font-weight: 800;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <div className="brand-logo">AM</div>

            <div>
              <strong>ÁgilMed & Real Life</strong>
              <span>Portal do Cliente</span>
            </div>
          </Link>

          <div className="header-actions">
            <Link href="/chamados" className="back-link">
              ← Meus chamados
            </Link>

            <button
              type="button"
              onClick={sair}
              className="logout"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="breadcrumb">
          <Link href="/chamados">Meus chamados</Link>

          <span>›</span>

          <strong>
            #{String(chamado.numero).padStart(5, '0')}
          </strong>
        </div>

        <section className="ticket-header">
          <div>
            <span className="eyebrow">CHAMADO</span>

            <div className="title-line">
              <h1>{chamado.assunto}</h1>

              <span
                className={`status status-${chamado.status}`}
              >
                {statusLabel[chamado.status]}
              </span>
            </div>

            <p>
              Chamado #{String(chamado.numero).padStart(5, '0')} ·
              Aberto em {formatarData(chamado.created_at)}
            </p>
          </div>
        </section>

        <div className="layout">
          <div className="main-column">
            <section className="card description-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">SOLICITAÇÃO</span>
                  <h2>Descrição</h2>
                </div>
              </div>

              <div className="description">
                {chamado.descricao}
              </div>

              <div className="meta-grid">
                <div>
                  <span>Categoria</span>
                  <strong>{chamado.categoria}</strong>
                </div>

                <div>
                  <span>Prioridade</span>

                  <strong
                    className={`priority priority-${chamado.prioridade}`}
                  >
                    {prioridadeLabel[chamado.prioridade]}
                  </strong>
                </div>

                <div>
                  <span>Última atualização</span>

                  <strong>
                    {formatarData(chamado.updated_at)}
                  </strong>
                </div>
              </div>
            </section>

            <section className="card conversation-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">ATENDIMENTO</span>
                  <h2>Conversas</h2>
                </div>

                <span className="message-count">
                  {mensagens.length}{' '}
                  {mensagens.length === 1
                    ? 'mensagem'
                    : 'mensagens'}
                </span>
              </div>

              <div className="messages">
                {mensagens.length === 0 && (
                  <div className="no-messages">
                    <div className="no-messages-icon">
                      💬
                    </div>

                    <strong>
                      Nenhuma mensagem ainda
                    </strong>

                    <p>
                      Envie uma mensagem para complementar sua
                      solicitação.
                    </p>
                  </div>
                )}

                {mensagens.map((mensagem) => (
                  <div
                    key={mensagem.id}
                    className="message"
                  >
                    <div className="message-avatar">
                      {mensagem.autor?.nome
                        ?.charAt(0)
                        ?.toUpperCase() || 'U'}
                    </div>

                    <div className="message-body">
                      <div className="message-top">
                        <strong>
                          {mensagem.autor?.nome ||
                            'Usuário'}
                        </strong>

                        <span>
                          {formatarData(
                            mensagem.created_at,
                          )}
                        </span>
                      </div>

                      <div className="message-role">
                        {mensagem.autor?.perfil ===
                        'cliente'
                          ? 'Cliente'
                          : 'Equipe de atendimento'}
                      </div>

                      <p>{mensagem.mensagem}</p>
                    </div>
                  </div>
                ))}
              </div>

              {chamado.status !== 'encerrado' && (
                <form
                  onSubmit={enviarMensagem}
                  className="message-form"
                >
                  <label htmlFor="nova-mensagem">
                    Enviar mensagem
                  </label>

                  <textarea
                    id="nova-mensagem"
                    value={novaMensagem}
                    onChange={(event) =>
                      setNovaMensagem(
                        event.target.value,
                      )
                    }
                    placeholder="Digite sua mensagem..."
                    rows={4}
                    maxLength={2000}
                    disabled={enviando}
                  />

                  {erro && (
                    <div className="message-error">
                      {erro}
                    </div>
                  )}

                  <div className="message-actions">
                    <span>
                      {novaMensagem.length}/2000
                    </span>

                    <button
                      type="submit"
                      disabled={
                        enviando ||
                        !novaMensagem.trim()
                      }
                    >
                      {enviando
                        ? 'Enviando...'
                        : 'Enviar mensagem'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>

          <aside className="side-column">
            <section className="card information-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">INFORMAÇÕES</span>
                  <h2>Detalhes</h2>
                </div>
              </div>

              <div className="information-list">
                <div>
                  <span>Número</span>

                  <strong>
                    #{String(chamado.numero).padStart(
                      5,
                      '0',
                    )}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong>
                    {statusLabel[chamado.status]}
                  </strong>
                </div>

                <div>
                  <span>Prioridade</span>

                  <strong>
                    {prioridadeLabel[chamado.prioridade]}
                  </strong>
                </div>

                <div>
                  <span>Categoria</span>

                  <strong>
                    {chamado.categoria}
                  </strong>
                </div>

                <div>
                  <span>Abertura</span>

                  <strong>
                    {formatarData(
                      chamado.created_at,
                    )}
                  </strong>
                </div>

                {chamado.prazo_sla && (
                  <div>
                    <span>Prazo de atendimento</span>

                    <strong>
                      {formatarData(
                        chamado.prazo_sla,
                      )}
                    </strong>
                  </div>
                )}

                {chamado.resolvido_em && (
                  <div>
                    <span>Resolvido em</span>

                    <strong>
                      {formatarData(
                        chamado.resolvido_em,
                      )}
                    </strong>
                  </div>
                )}

                {chamado.encerrado_em && (
                  <div>
                    <span>Encerrado em</span>

                    <strong>
                      {formatarData(
                        chamado.encerrado_em,
                      )}
                    </strong>
                  </div>
                )}
              </div>
            </section>

            <section className="card timeline-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">ACOMPANHAMENTO</span>
                  <h2>Status</h2>
                </div>
              </div>

              <div className="timeline">
                <div className="timeline-item active">
                  <span className="timeline-dot" />

                  <div>
                    <strong>Chamado aberto</strong>

                    <span>
                      {formatarData(
                        chamado.created_at,
                      )}
                    </span>
                  </div>
                </div>

                <div
                  className={`timeline-item ${
                    [
                      'em_atendimento',
                      'aguardando_cliente',
                      'resolvido',
                      'encerrado',
                    ].includes(chamado.status)
                      ? 'active'
                      : ''
                  }`}
                >
                  <span className="timeline-dot" />

                  <div>
                    <strong>
                      Em atendimento
                    </strong>

                    <span>
                      {[
                        'em_atendimento',
                        'aguardando_cliente',
                        'resolvido',
                        'encerrado',
                      ].includes(chamado.status)
                        ? 'Atendimento iniciado'
                        : 'Aguardando atendimento'}
                    </span>
                  </div>
                </div>

                <div
                  className={`timeline-item ${
                    ['resolvido', 'encerrado'].includes(
                      chamado.status,
                    )
                      ? 'active'
                      : ''
                  }`}
                >
                  <span className="timeline-dot" />

                  <div>
                    <strong>Resolvido</strong>

                    <span>
                      {chamado.resolvido_em
                        ? formatarData(
                            chamado.resolvido_em,
                          )
                        : 'Ainda não resolvido'}
                    </span>
                  </div>
                </div>

                <div
                  className={`timeline-item ${
                    chamado.status === 'encerrado'
                      ? 'active'
                      : ''
                  }`}
                >
                  <span className="timeline-dot" />

                  <div>
                    <strong>Encerrado</strong>

                    <span>
                      {chamado.encerrado_em
                        ? formatarData(
                            chamado.encerrado_em,
                          )
                        : 'Ainda não encerrado'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {chamado.status === 'encerrado' && (
              <section className="card evaluation-card">
                <span className="eyebrow">AVALIAÇÃO</span>

                <h2>Como foi o atendimento?</h2>

                {chamado.avaliacao ? (
                  <>
                    <div className="stars">
                      {Array.from(
                        { length: 5 },
                        (_, index) => (
                          <span
                            key={index}
                            className={
                              index <
                              chamado.avaliacao!
                                ? 'star active'
                                : 'star'
                            }
                          >
                            ★
                          </span>
                        ),
                      )}
                    </div>

                    {chamado.comentario_avaliacao && (
                      <p>
                        “
                        {chamado.comentario_avaliacao}
                        ”
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    Este chamado foi encerrado e ainda não
                    foi avaliado.
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f5f7fa;
          color: #172033;
        }

        .header {
          height: 76px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
        }

        .header-inner {
          max-width: 1200px;
          height: 100%;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: #0f766e;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
        }

        .brand strong {
          display: block;
          font-size: 15px;
        }

        .brand span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .back-link {
          color: #0f766e;
          font-size: 13px;
          font-weight: 700;
        }

        .logout {
          border: 1px solid #d7dde5;
          background: #ffffff;
          color: #475569;
          border-radius: 9px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 24px 60px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 22px;
          color: #94a3b8;
          font-size: 11px;
        }

        .breadcrumb a {
          color: #0f766e;
          font-weight: 700;
        }

        .breadcrumb strong {
          color: #64748b;
        }

        .ticket-header {
          margin-bottom: 26px;
        }

        .eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #0f766e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        .title-line {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ticket-header h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.6px;
        }

        .ticket-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .status {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-aberto {
          background: #eaf4ff;
          color: #2563eb;
        }

        .status-em_atendimento {
          background: #e9f5f3;
          color: #0f766e;
        }

        .status-aguardando_cliente {
          background: #fff7ed;
          color: #b45309;
        }

        .status-resolvido {
          background: #eaf8ef;
          color: #15803d;
        }

        .status-encerrado {
          background: #f1f5f9;
          color: #64748b;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 20px;
          align-items: start;
        }

        .main-column,
        .side-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .card-heading {
          padding: 20px 22px 17px;
          border-bottom: 1px solid #eef2f7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .card-heading .eyebrow {
          margin-bottom: 5px;
        }

        .card-heading h2 {
          margin: 0;
          font-size: 17px;
        }

        .description {
          padding: 21px 22px;
          color: #475569;
          font-size: 13px;
          line-height: 1.75;
          white-space: pre-wrap;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid #eef2f7;
        }

        .meta-grid > div {
          padding: 15px 18px;
          border-right: 1px solid #eef2f7;
        }

        .meta-grid > div:last-child {
          border-right: 0;
        }

        .meta-grid span,
        .information-list span {
          display: block;
          margin-bottom: 5px;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .meta-grid strong,
        .information-list strong {
          display: block;
          color: #334155;
          font-size: 11px;
          line-height: 1.4;
        }

        .priority-baixa {
          color: #15803d !important;
        }

        .priority-normal {
          color: #475569 !important;
        }

        .priority-alta {
          color: #c2410c !important;
        }

        .priority-urgente {
          color: #b91c1c !important;
        }

        .message-count {
          color: #94a3b8;
          font-size: 10px;
        }

        .messages {
          padding: 4px 22px;
        }

        .message {
          display: flex;
          gap: 12px;
          padding: 19px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .message:last-child {
          border-bottom: 0;
        }

        .message-avatar {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          border-radius: 50%;
          background: #e9f5f3;
          color: #0f766e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
        }

        .message-body {
          min-width: 0;
          flex: 1;
        }

        .message-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .message-top strong {
          color: #334155;
          font-size: 12px;
        }

        .message-top span {
          color: #94a3b8;
          font-size: 9px;
          white-space: nowrap;
        }

        .message-role {
          margin-top: 2px;
          color: #0f766e;
          font-size: 9px;
          font-weight: 700;
        }

        .message-body p {
          margin: 9px 0 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .no-messages {
          padding: 35px 20px;
          text-align: center;
        }

        .no-messages-icon {
          width: 45px;
          height: 45px;
          margin: 0 auto 10px;
          border-radius: 12px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .no-messages strong {
          display: block;
          font-size: 12px;
        }

        .no-messages p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 10px;
        }

        .message-form {
          padding: 18px 22px 22px;
          border-top: 1px solid #eef2f7;
          background: #fafbfc;
        }

        .message-form label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
        }

        .message-form textarea {
          width: 100%;
          border: 1px solid #d7dde5;
          border-radius: 9px;
          background: #ffffff;
          padding: 11px 12px;
          resize: vertical;
          color: #172033;
          font-size: 12px;
          line-height: 1.5;
          outline: none;
        }

        .message-form textarea:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
        }

        .message-actions {
          margin-top: 9px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .message-actions span {
          color: #94a3b8;
          font-size: 9px;
        }

        .message-actions button {
          border: 0;
          border-radius: 8px;
          background: #0f766e;
          color: #ffffff;
          padding: 9px 14px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .message-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .message-error {
          margin-top: 8px;
          color: #b91c1c;
          font-size: 10px;
        }

        .information-list {
          padding: 5px 22px;
        }

        .information-list > div {
          padding: 14px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .information-list > div:last-child {
          border-bottom: 0;
        }

        .timeline {
          padding: 18px 22px 22px;
        }

        .timeline-item {
          position: relative;
          display: flex;
          gap: 12px;
          min-height: 62px;
        }

        .timeline-item:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 5px;
          top: 12px;
          width: 1px;
          height: calc(100% - 2px);
          background: #e2e8f0;
        }

        .timeline-item.active:not(:last-child)::before {
          background: #b9ddd8;
        }

        .timeline-dot {
          width: 11px;
          height: 11px;
          flex: 0 0 11px;
          margin-top: 2px;
          border-radius: 50%;
          background: #e2e8f0;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px #cbd5e1;
          z-index: 1;
        }

        .timeline-item.active .timeline-dot {
          background: #0f766e;
          box-shadow: 0 0 0 1px #0f766e;
        }

        .timeline-item strong {
          display: block;
          color: #64748b;
          font-size: 11px;
        }

        .timeline-item.active strong {
          color: #334155;
        }

        .timeline-item div span {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.4;
        }

        .evaluation-card {
          padding: 20px;
        }

        .evaluation-card h2 {
          margin: 0;
          font-size: 15px;
        }

        .stars {
          display: flex;
          gap: 3px;
          margin-top: 13px;
        }

        .star {
          color: #dbe2ea;
          font-size: 20px;
        }

        .star.active {
          color: #f59e0b;
        }

        .evaluation-card p {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        .loading-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f7fa;
          padding: 24px;
        }

        .loading-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 40px;
          text-align: center;
        }

        .loading-card h2 {
          margin: 0 0 8px;
        }

        .loading-card p {
          margin: 0;
          color: #64748b;
        }

        .loading-spinner {
          width: 42px;
          height: 42px;
          margin: 0 auto 20px;
          border: 4px solid #dbe4e8;
          border-top-color: #0f766e;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f7fa;
          padding: 24px;
        }

        .error-card {
          width: 100%;
          max-width: 450px;
          padding: 40px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          text-align: center;
        }

        .error-card h1 {
          margin: 0;
          font-size: 21px;
        }

        .error-card p {
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
        }

        .error-icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 15px;
          border-radius: 50%;
          background: #fef2f2;
          color: #b91c1c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
        }

        .back-button {
          display: inline-block;
          margin-top: 10px;
          padding: 11px 16px;
          border-radius: 9px;
          background: #0f766e;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }

          .evaluation-card {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 650px) {
          .header {
            height: auto;
          }

          .header-inner {
            padding: 14px 18px;
          }

          .header-actions {
            gap: 8px;
          }

          .logout {
            display: none;
          }

          .container {
            padding: 22px 16px 40px;
          }

          .title-line {
            align-items: flex-start;
            flex-direction: column;
          }

          .ticket-header h1 {
            font-size: 23px;
          }

          .side-column {
            display: flex;
          }

          .meta-grid {
            grid-template-columns: 1fr;
          }

          .meta-grid > div {
            border-right: 0;
            border-bottom: 1px solid #eef2f7;
          }

          .meta-grid > div:last-child {
            border-bottom: 0;
          }

          .message-top {
            align-items: flex-start;
            flex-direction: column;
            gap: 3px;
          }
        }
      `}</style>
    </div>
  )
}
