'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  created_at: string
  updated_at: string
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

export default function ChamadosPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregarChamados() {
      setLoading(true)
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
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
            created_at,
            updated_at
          `,
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao carregar chamados:', error)
        setErro('Não foi possível carregar seus chamados.')
        setLoading(false)
        return
      }

      setChamados(data || [])
      setLoading(false)
    }

    carregarChamados()
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const chamadosFiltrados =
    filtroStatus === 'todos'
      ? chamados
      : chamados.filter((chamado) => chamado.status === filtroStatus)

  const totalAbertos = chamados.filter(
    (chamado) =>
      chamado.status === 'aberto' ||
      chamado.status === 'em_atendimento',
  ).length

  const totalAguardando = chamados.filter(
    (chamado) => chamado.status === 'aguardando_cliente',
  ).length

  const totalResolvidos = chamados.filter(
    (chamado) =>
      chamado.status === 'resolvido' ||
      chamado.status === 'encerrado',
  ).length

  if (loading) {
    return (
      <main className="loading-page">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Carregando chamados...</h2>
          <p>Aguarde enquanto buscamos suas solicitações.</p>
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
            <Link href="/" className="back-link">
              ← Início
            </Link>

            <button type="button" onClick={sair} className="logout">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="top-area">
          <div>
            <span className="eyebrow">ATENDIMENTO</span>

            <h1>Meus chamados</h1>

            <p>
              Acompanhe suas solicitações e converse com nossa equipe.
            </p>
          </div>

          <Link href="/chamados/novo" className="new-button">
            + Novo chamado
          </Link>
        </div>

        <section className="summary-grid">
          <div className="summary-card">
            <span className="summary-icon">🎫</span>

            <div>
              <span>Total</span>
              <strong>{chamados.length}</strong>
            </div>
          </div>

          <div className="summary-card">
            <span className="summary-icon open">●</span>

            <div>
              <span>Em atendimento</span>
              <strong>{totalAbertos}</strong>
            </div>
          </div>

          <div className="summary-card">
            <span className="summary-icon waiting">◷</span>

            <div>
              <span>Aguardando você</span>
              <strong>{totalAguardando}</strong>
            </div>
          </div>

          <div className="summary-card">
            <span className="summary-icon done">✓</span>

            <div>
              <span>Resolvidos</span>
              <strong>{totalResolvidos}</strong>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="card-header">
            <div>
              <span className="eyebrow">SOLICITAÇÕES</span>
              <h2>Histórico de chamados</h2>
            </div>

            <select
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value)}
              className="filter"
            >
              <option value="todos">Todos os chamados</option>
              <option value="aberto">Abertos</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="aguardando_cliente">
                Aguardando cliente
              </option>
              <option value="resolvido">Resolvidos</option>
              <option value="encerrado">Encerrados</option>
            </select>
          </div>

          {erro && <div className="error">{erro}</div>}

          {!erro && chamadosFiltrados.length === 0 && (
            <div className="empty">
              <div className="empty-icon">🎫</div>

              <h3>Nenhum chamado encontrado</h3>

              <p>
                Você ainda não possui chamados nessa categoria.
              </p>

              <Link href="/chamados/novo" className="empty-button">
                Abrir meu primeiro chamado
              </Link>
            </div>
          )}

          {!erro && chamadosFiltrados.length > 0 && (
            <div className="tickets">
              {chamadosFiltrados.map((chamado) => (
                <Link
                  href={`/chamados/${chamado.id}`}
                  key={chamado.id}
                  className="ticket"
                >
                  <div className="ticket-number">
                    <span>CHAMADO</span>
                    <strong>#{String(chamado.numero).padStart(5, '0')}</strong>
                  </div>

                  <div className="ticket-main">
                    <div className="ticket-title-row">
                      <h3>{chamado.assunto}</h3>

                      <span
                        className={`status status-${chamado.status}`}
                      >
                        {statusLabel[chamado.status]}
                      </span>
                    </div>

                    <p>
                      {chamado.categoria} · Aberto em{' '}
                      {formatarData(chamado.created_at)}
                    </p>
                  </div>

                  <div className="ticket-priority">
                    <span>Prioridade</span>

                    <strong
                      className={`priority priority-${chamado.prioridade}`}
                    >
                      {prioridadeLabel[chamado.prioridade]}
                    </strong>
                  </div>

                  <div className="ticket-arrow">→</div>
                </Link>
              ))}
            </div>
          )}
        </section>
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
          gap: 12px;
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
          padding: 40px 24px 60px;
        }

        .top-area {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #0f766e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.7px;
        }

        .top-area p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .new-button {
          background: #0f766e;
          color: #ffffff;
          border-radius: 10px;
          padding: 12px 18px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 26px;
        }

        .summary-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 17px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .summary-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #eef2f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .summary-icon.open {
          color: #0f766e;
          background: #e9f5f3;
        }

        .summary-icon.waiting {
          color: #b45309;
          background: #fff7ed;
        }

        .summary-icon.done {
          color: #15803d;
          background: #eaf8ef;
        }

        .summary-card span:not(.summary-icon) {
          display: block;
          color: #64748b;
          font-size: 11px;
        }

        .summary-card strong {
          display: block;
          margin-top: 2px;
          font-size: 20px;
        }

        .content-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          overflow: hidden;
        }

        .card-header {
          padding: 22px 22px 18px;
          border-bottom: 1px solid #eef2f7;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .card-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .filter {
          border: 1px solid #d7dde5;
          border-radius: 9px;
          background: #ffffff;
          color: #475569;
          padding: 9px 12px;
          font-size: 12px;
        }

        .tickets {
          display: flex;
          flex-direction: column;
        }

        .ticket {
          display: grid;
          grid-template-columns: 100px minmax(0, 1fr) 120px 30px;
          align-items: center;
          gap: 18px;
          padding: 19px 22px;
          border-bottom: 1px solid #eef2f7;
          transition: background 0.2s ease;
        }

        .ticket:hover {
          background: #f8fafc;
        }

        .ticket:last-child {
          border-bottom: 0;
        }

        .ticket-number span,
        .ticket-priority span {
          display: block;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.8px;
          margin-bottom: 4px;
        }

        .ticket-number strong {
          color: #0f766e;
          font-size: 13px;
        }

        .ticket-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ticket-main h3 {
          margin: 0;
          font-size: 14px;
          color: #172033;
        }

        .ticket-main p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 11px;
        }

        .status {
          padding: 5px 8px;
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

        .priority {
          font-size: 11px;
        }

        .priority-baixa {
          color: #15803d;
        }

        .priority-normal {
          color: #475569;
        }

        .priority-alta {
          color: #c2410c;
        }

        .priority-urgente {
          color: #b91c1c;
        }

        .ticket-arrow {
          color: #94a3b8;
          font-size: 20px;
        }

        .empty {
          text-align: center;
          padding: 70px 20px;
        }

        .empty-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 16px;
          border-radius: 16px;
          background: #e9f5f3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .empty h3 {
          margin: 0;
          font-size: 17px;
        }

        .empty p {
          margin: 7px 0 20px;
          color: #64748b;
          font-size: 13px;
        }

        .empty-button {
          display: inline-block;
          background: #0f766e;
          color: #ffffff;
          border-radius: 9px;
          padding: 10px 15px;
          font-size: 12px;
          font-weight: 800;
        }

        .error {
          margin: 20px;
          padding: 14px;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
        }

        @media (max-width: 850px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .ticket {
            grid-template-columns: 80px minmax(0, 1fr) 25px;
          }

          .ticket-priority {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .container {
            padding: 28px 16px 40px;
          }

          .top-area {
            align-items: flex-start;
            flex-direction: column;
          }

          h1 {
            font-size: 25px;
          }

          .summary-grid {
            grid-template-columns: 1fr 1fr;
          }

          .card-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .filter {
            width: 100%;
          }

          .ticket {
            grid-template-columns: 1fr 25px;
            gap: 8px;
          }

          .ticket-number {
            display: none;
          }

          .ticket-title-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }
        }
      `}</style>
    </div>
  )
}
