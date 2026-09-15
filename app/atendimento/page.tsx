'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  nome_fantasia: string
  marca: string | null
}

type Chamado = {
  id: string
  numero: number | null
  empresa_id: string
  categoria: string
  assunto: string
  prioridade: string
  status: string
  created_at: string
  updated_at: string
  prazo_sla: string | null
  empresa: Empresa | null
}

type FiltroStatus =
  | 'todos'
  | 'aberto'
  | 'em_atendimento'
  | 'aguardando_cliente'
  | 'resolvido'
  | 'encerrado'

type FiltroPrioridade =
  | 'todas'
  | 'urgente'
  | 'alta'
  | 'normal'
  | 'baixa'

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

function normalizarValor(valor: string | null | undefined) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(data))
}

function corStatus(status: string) {
  switch (normalizarValor(status)) {
    case 'aberto':
      return {
        background: '#dbeafe',
        color: '#1d4ed8',
      }

    case 'em_atendimento':
      return {
        background: '#fef3c7',
        color: '#b45309',
      }

    case 'aguardando_cliente':
      return {
        background: '#f3e8ff',
        color: '#7e22ce',
      }

    case 'resolvido':
      return {
        background: '#dcfce7',
        color: '#15803d',
      }

    case 'encerrado':
      return {
        background: '#e5e7eb',
        color: '#374151',
      }

    default:
      return {
        background: '#f1f5f9',
        color: '#475569',
      }
  }
}

function corPrioridade(prioridade: string) {
  switch (normalizarValor(prioridade)) {
    case 'urgente':
      return {
        background: '#fee2e2',
        color: '#b91c1c',
      }

    case 'alta':
      return {
        background: '#ffedd5',
        color: '#c2410c',
      }

    case 'normal':
      return {
        background: '#fef3c7',
        color: '#a16207',
      }

    case 'baixa':
      return {
        background: '#dcfce7',
        color: '#15803d',
      }

    default:
      return {
        background: '#f1f5f9',
        color: '#475569',
      }
  }
}

function chamadoEstaAtrasado(chamado: Chamado) {
  if (!chamado.prazo_sla) {
    return false
  }

  const status = normalizarValor(chamado.status)

  if (
    status === 'resolvido' ||
    status === 'encerrado'
  ) {
    return false
  }

  return (
    new Date(chamado.prazo_sla).getTime() <
    Date.now()
  )
}

function chamadoEstaProximoDoVencimento(
  chamado: Chamado
) {
  if (!chamado.prazo_sla) {
    return false
  }

  const status = normalizarValor(chamado.status)

  if (
    status === 'resolvido' ||
    status === 'encerrado'
  ) {
    return false
  }

  const agora = Date.now()
  const prazo = new Date(
    chamado.prazo_sla
  ).getTime()

  const duasHoras =
    2 * 60 * 60 * 1000

  return (
    prazo > agora &&
    prazo - agora <= duasHoras
  )
}

function formatarPrazoSla(
  prazo: string | null
) {
  if (!prazo) {
    return 'Sem SLA'
  }

  return formatarData(prazo)
}

export default function AtendimentoPage() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [filtroStatus, setFiltroStatus] =
    useState<FiltroStatus>('todos')

  const [filtroPrioridade, setFiltroPrioridade] =
    useState<FiltroPrioridade>('todas')

  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregarChamados()

    const intervalo = window.setInterval(() => {
      carregarChamados()
    }, 60 * 1000)

    return () => {
      window.clearInterval(intervalo)
    }
  }, [])

  async function carregarChamados() {
    try {
      setCarregando(true)
      setErro('')

      const {
        data: { user },
        error: usuarioError,
      } = await supabase.auth.getUser()

      if (usuarioError) {
        throw usuarioError
      }

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data, error } = await supabase
        .from('chamados')
        .select(`
          id,
          numero,
          empresa_id,
          categoria,
          assunto,
          prioridade,
          status,
          created_at,
          updated_at,
          prazo_sla,
          empresas (
            nome_fantasia,
            marca
          )
        `)
        .order('created_at', {
          ascending: false,
        })

      if (error) {
        console.error(
          'Erro Supabase ao carregar chamados:',
          error
        )

        throw error
      }

      const chamadosFormatados: Chamado[] =
        (data || []).map((item: any) => {
          const empresaRelacionada =
            Array.isArray(item.empresas)
              ? item.empresas[0] || null
              : item.empresas || null

          return {
            id: item.id,
            numero: item.numero,
            empresa_id: item.empresa_id,
            categoria: item.categoria,
            assunto: item.assunto,
            prioridade: item.prioridade,
            status: item.status,
            created_at: item.created_at,
            updated_at: item.updated_at,
            prazo_sla: item.prazo_sla || null,
            empresa: empresaRelacionada
              ? {
                  nome_fantasia:
                    empresaRelacionada.nome_fantasia ||
                    'Empresa não identificada',
                  marca:
                    empresaRelacionada.marca || null,
                }
              : null,
          }
        })

      setChamados(chamadosFormatados)
    } catch (error: any) {
      console.error(
        'Erro ao carregar chamados:',
        error
      )

      setErro(
        error?.message ||
          'Não foi possível carregar os chamados.'
      )

      setChamados([])
    } finally {
      setCarregando(false)
    }
  }

  const indicadores = useMemo(() => {
    const abertos = chamados.filter(
      (item) =>
        normalizarValor(item.status) === 'aberto'
    ).length

    const emAtendimento = chamados.filter(
      (item) =>
        normalizarValor(item.status) ===
        'em_atendimento'
    ).length

    const aguardandoCliente = chamados.filter(
      (item) =>
        normalizarValor(item.status) ===
        'aguardando_cliente'
    ).length

    const resolvidos = chamados.filter(
      (item) =>
        normalizarValor(item.status) ===
        'resolvido'
    ).length

    const encerrados = chamados.filter(
      (item) =>
        normalizarValor(item.status) ===
        'encerrado'
    ).length

    const urgentes = chamados.filter(
      (item) =>
        normalizarValor(item.prioridade) ===
        'urgente'
    ).length

    const altos = chamados.filter(
      (item) =>
        normalizarValor(item.prioridade) ===
        'alta'
    ).length

    const slaAtrasado = chamados.filter(
      (item) => chamadoEstaAtrasado(item)
    ).length

    const slaProximoVencimento =
      chamados.filter(
        (item) =>
          chamadoEstaProximoDoVencimento(item)
      ).length

    const slaNoPrazo = chamados.filter(
      (item) =>
        Boolean(item.prazo_sla) &&
        !chamadoEstaAtrasado(item) &&
        !chamadoEstaProximoDoVencimento(item) &&
        normalizarValor(item.status) !==
          'resolvido' &&
        normalizarValor(item.status) !==
          'encerrado'
    ).length

    const semSla = chamados.filter(
      (item) => !item.prazo_sla
    ).length

    return {
      total: chamados.length,
      abertos,
      emAtendimento,
      aguardandoCliente,
      resolvidos,
      encerrados,
      urgentes,
      altos,
      slaAtrasado,
      slaProximoVencimento,
      slaNoPrazo,
      semSla,
    }
  }, [chamados])

  const chamadosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return chamados.filter((chamado) => {
      const statusNormalizado =
        normalizarValor(chamado.status)

      const prioridadeNormalizada =
        normalizarValor(chamado.prioridade)

      const correspondeStatus =
        filtroStatus === 'todos' ||
        statusNormalizado === filtroStatus

      const correspondePrioridade =
        filtroPrioridade === 'todas' ||
        prioridadeNormalizada ===
          filtroPrioridade

      if (
        !correspondeStatus ||
        !correspondePrioridade
      ) {
        return false
      }

      if (!termo) {
        return true
      }

      const textoPesquisa = [
        chamado.numero?.toString() || '',
        chamado.assunto || '',
        chamado.categoria || '',
        chamado.empresa?.nome_fantasia || '',
        chamado.empresa?.marca || '',
        statusNormalizado,
        prioridadeNormalizada,
      ]
        .join(' ')
        .toLowerCase()

      return textoPesquisa.includes(termo)
    })
  }, [
    chamados,
    filtroStatus,
    filtroPrioridade,
    busca,
  ])

  const cards = [
    {
      titulo: 'Total',
      valor: indicadores.total,
      filtro: 'todos' as FiltroStatus,
      fundo: '#ffffff',
      borda: '#e2e8f0',
      cor: '#0f172a',
    },
    {
      titulo: 'Abertos',
      valor: indicadores.abertos,
      filtro: 'aberto' as FiltroStatus,
      fundo: '#eff6ff',
      borda: '#bfdbfe',
      cor: '#1d4ed8',
    },
    {
      titulo: 'Em atendimento',
      valor: indicadores.emAtendimento,
      filtro:
        'em_atendimento' as FiltroStatus,
      fundo: '#fffbeb',
      borda: '#fde68a',
      cor: '#b45309',
    },
    {
      titulo: 'Aguardando cliente',
      valor: indicadores.aguardandoCliente,
      filtro:
        'aguardando_cliente' as FiltroStatus,
      fundo: '#faf5ff',
      borda: '#e9d5ff',
      cor: '#7e22ce',
    },
    {
      titulo: 'Resolvidos',
      valor: indicadores.resolvidos,
      filtro: 'resolvido' as FiltroStatus,
      fundo: '#f0fdf4',
      borda: '#bbf7d0',
      cor: '#15803d',
    },
    {
      titulo: 'Urgentes',
      valor: indicadores.urgentes,
      filtro: null,
      fundo: '#fef2f2',
      borda: '#fecaca',
      cor: '#b91c1c',
    },
  ]

  return (
    <main
      style={{
        minHeight: 'calc(100vh - 70px)',
        background: '#f8fafc',
        padding: '32px 24px 60px',
      }}
    >
      <div
        style={{
          maxWidth: '1250px',
          margin: '0 auto',
        }}
      >
        {/* CABEÇALHO */}

        <div
          style={{
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              color: '#0f766e',
              fontSize: '13px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '8px',
            }}
          >
            Atendimento interno
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  color: '#0f172a',
                  fontSize: '32px',
                  lineHeight: 1.2,
                }}
              >
                Central de Atendimento
              </h1>

              <p
                style={{
                  marginTop: '10px',
                  marginBottom: 0,
                  color: '#64748b',
                  fontSize: '15px',
                }}
              >
                Acompanhe e gerencie as solicitações
                dos clientes ÁgilMed e Real Life.
              </p>
            </div>

            <button
              type="button"
              onClick={carregarChamados}
              disabled={carregando}
              style={{
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                borderRadius: '10px',
                padding: '11px 16px',
                cursor: carregando
                  ? 'not-allowed'
                  : 'pointer',
                fontWeight: 700,
              }}
            >
              {carregando
                ? 'Atualizando...'
                : '↻ Atualizar'}
            </button>
          </div>
        </div>

        {/* INDICADORES */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(165px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {cards.map((card) => (
            <button
              key={card.titulo}
              type="button"
              onClick={() => {
                if (card.filtro) {
                  setFiltroStatus(card.filtro)
                  setFiltroPrioridade('todas')
                }
              }}
              style={{
                textAlign: 'left',
                border: `1px solid ${card.borda}`,
                background: card.fundo,
                borderRadius: '14px',
                padding: '18px',
                cursor: card.filtro
                  ? 'pointer'
                  : 'default',
              }}
            >
              <div
                style={{
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '7px',
                }}
              >
                {card.titulo}
              </div>

              <div
                style={{
                  color: card.cor,
                  fontSize: '28px',
                  lineHeight: 1,
                  fontWeight: 800,
                }}
              >
                {card.valor}
              </div>
            </button>
          ))}
        </div>

        {/* SLA */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          {/* SLA ATRASADO */}

          <div
            style={{
              background:
                indicadores.slaAtrasado > 0
                  ? '#fef2f2'
                  : '#f0fdf4',
              border:
                indicadores.slaAtrasado > 0
                  ? '1px solid #fecaca'
                  : '1px solid #bbf7d0',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
            <div
              style={{
                color:
                  indicadores.slaAtrasado > 0
                    ? '#b91c1c'
                    : '#15803d',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              SLA atrasado
            </div>

            <div
              style={{
                marginTop: '7px',
                color:
                  indicadores.slaAtrasado > 0
                    ? '#b91c1c'
                    : '#15803d',
                fontSize: '30px',
                fontWeight: 800,
              }}
            >
              {indicadores.slaAtrasado}
            </div>

            <div
              style={{
                marginTop: '5px',
                color: '#64748b',
                fontSize: '12px',
              }}
            >
              Chamados fora do prazo
            </div>
          </div>

          {/* SLA PRÓXIMO */}

          <div
            style={{
              background:
                indicadores.slaProximoVencimento > 0
                  ? '#fff7ed'
                  : '#ffffff',
              border:
                indicadores.slaProximoVencimento > 0
                  ? '1px solid #fed7aa'
                  : '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
            <div
              style={{
                color:
                  indicadores.slaProximoVencimento > 0
                    ? '#c2410c'
                    : '#64748b',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Próximo do vencimento
            </div>

            <div
              style={{
                marginTop: '7px',
                color:
                  indicadores.slaProximoVencimento > 0
                    ? '#c2410c'
                    : '#0f172a',
                fontSize: '30px',
                fontWeight: 800,
              }}
            >
              {indicadores.slaProximoVencimento}
            </div>

            <div
              style={{
                marginTop: '5px',
                color: '#64748b',
                fontSize: '12px',
              }}
            >
              Até 2 horas para vencer
            </div>
          </div>

          {/* SLA NO PRAZO */}

          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
            <div
              style={{
                color: '#1d4ed8',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              SLA no prazo
            </div>

            <div
              style={{
                marginTop: '7px',
                color: '#1d4ed8',
                fontSize: '30px',
                fontWeight: 800,
              }}
            >
              {indicadores.slaNoPrazo}
            </div>

            <div
              style={{
                marginTop: '5px',
                color: '#64748b',
                fontSize: '12px',
              }}
            >
              Chamados dentro do prazo
            </div>
          </div>

          {/* SEM SLA */}

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Sem SLA
            </div>

            <div
              style={{
                marginTop: '7px',
                color: '#0f172a',
                fontSize: '30px',
                fontWeight: 800,
              }}
            >
              {indicadores.semSla}
            </div>

            <div
              style={{
                marginTop: '5px',
                color: '#64748b',
                fontSize: '12px',
              }}
            >
              Chamados sem prazo definido
            </div>
          </div>
        </div>

        {/* ALERTA SLA */}

        {indicadores.slaAtrasado > 0 && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            ⚠ Existem {indicadores.slaAtrasado}{' '}
            chamado(s) fora do prazo de atendimento.
          </div>
        )}

        {indicadores.slaProximoVencimento > 0 && (
          <div
            style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#c2410c',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '20px',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            🟠 Atenção: existem{' '}
            {indicadores.slaProximoVencimento}{' '}
            chamado(s) com SLA próximo do vencimento.
          </div>
        )}

        {/* FILTROS */}

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(280px, 1fr) 190px 190px',
              gap: '12px',
            }}
          >
            <input
              type="search"
              value={busca}
              onChange={(event) =>
                setBusca(event.target.value)
              }
              placeholder="Pesquisar por número, assunto, categoria ou empresa..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '14px',
                outline: 'none',
              }}
            />

            <select
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(
                  event.target.value as FiltroStatus
                )
              }
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '12px',
                background: '#ffffff',
                color: '#334155',
                fontSize: '14px',
              }}
            >
              <option value="todos">
                Todos os status
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

            <select
              value={filtroPrioridade}
              onChange={(event) =>
                setFiltroPrioridade(
                  event.target.value as FiltroPrioridade
                )
              }
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '12px',
                background: '#ffffff',
                color: '#334155',
                fontSize: '14px',
              }}
            >
              <option value="todas">
                Todas as prioridades
              </option>

              <option value="urgente">
                Urgentes
              </option>

              <option value="alta">
                Altas
              </option>

              <option value="normal">
                Normais
              </option>

              <option value="baixa">
                Baixas
              </option>
            </select>
          </div>

          {(busca ||
            filtroStatus !== 'todos' ||
            filtroPrioridade !== 'todas') && (
            <div
              style={{
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Filtros ativos —{' '}
                {chamadosFiltrados.length}{' '}
                resultado(s)
              </span>

              <button
                type="button"
                onClick={() => {
                  setBusca('')
                  setFiltroStatus('todos')
                  setFiltroPrioridade('todas')
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#0f766e',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* ERRO */}

        {erro && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              borderRadius: '12px',
              padding: '15px',
              marginBottom: '20px',
            }}
          >
            <strong>
              Não foi possível carregar os chamados.
            </strong>

            <div
              style={{
                marginTop: '5px',
                fontSize: '13px',
              }}
            >
              {erro}
            </div>
          </div>
        )}

        {/* LISTAGEM */}

        {carregando ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '50px',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            Carregando chamados...
          </div>
        ) : chamadosFiltrados.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '55px 30px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '38px',
                marginBottom: '12px',
              }}
            >
              ✓
            </div>

            <h2
              style={{
                margin: 0,
                color: '#0f172a',
                fontSize: '20px',
              }}
            >
              Nenhum chamado encontrado
            </h2>

            <p
              style={{
                marginTop: '8px',
                marginBottom: 0,
                color: '#64748b',
              }}
            >
              Não existem chamados correspondentes
              aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 20px',
                borderBottom:
                  '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong
                  style={{
                    color: '#0f172a',
                    fontSize: '16px',
                  }}
                >
                  Chamados
                </strong>

                <div
                  style={{
                    color: '#64748b',
                    fontSize: '13px',
                    marginTop: '3px',
                  }}
                >
                  {chamadosFiltrados.length}{' '}
                  chamado(s) encontrado(s)
                </div>
              </div>

              <span
                style={{
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Total carregado: {chamados.length}
              </span>
            </div>

            <div
              style={{
                overflowX: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '1050px',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: '#f8fafc',
                    }}
                  >
                    {[
                      'Chamado',
                      'Empresa',
                      'Assunto',
                      'Categoria',
                      'Prioridade',
                      'Status',
                      'SLA',
                      'Abertura',
                      '',
                    ].map((titulo, index) => (
                      <th
                        key={`${titulo}-${index}`}
                        style={{
                          textAlign: 'left',
                          padding: '13px 14px',
                          borderBottom:
                            '1px solid #e2e8f0',
                          color: '#64748b',
                          fontSize: '12px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {chamadosFiltrados.map(
                    (chamado) => {
                      const statusStyle =
                        corStatus(chamado.status)

                      const prioridadeStyle =
                        corPrioridade(
                          chamado.prioridade
                        )

                      const atrasado =
                        chamadoEstaAtrasado(
                          chamado
                        )

                      const proximoDoVencimento =
                        chamadoEstaProximoDoVencimento(
                          chamado
                        )

                      return (
                        <tr
                          key={chamado.id}
                          style={{
                            borderBottom:
                              '1px solid #f1f5f9',
                          }}
                        >
                          <td
                            style={{
                              padding: '15px 14px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <strong
                              style={{
                                color: '#0f172a',
                              }}
                            >
                              #
                              {chamado.numero ||
                                chamado.id.slice(
                                  0,
                                  8
                                )}
                            </strong>
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                color: '#0f172a',
                              }}
                            >
                              {chamado.empresa
                                ?.nome_fantasia ||
                                'Empresa não identificada'}
                            </div>

                            {chamado.empresa?.marca && (
                              <div
                                style={{
                                  marginTop: '3px',
                                  color: '#64748b',
                                  fontSize: '12px',
                                }}
                              >
                                {chamado.empresa.marca}
                              </div>
                            )}
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                              maxWidth: '300px',
                            }}
                          >
                            <div
                              style={{
                                color: '#0f172a',
                                fontWeight: 600,
                              }}
                            >
                              {chamado.assunto}
                            </div>
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                              color: '#475569',
                              fontSize: '13px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {chamado.categoria}
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'inline-block',
                                padding: '5px 9px',
                                borderRadius: '999px',
                                background:
                                  prioridadeStyle.background,
                                color:
                                  prioridadeStyle.color,
                                fontSize: '12px',
                                fontWeight: 700,
                              }}
                            >
                              {prioridadeLabels[
                                normalizarValor(
                                  chamado.prioridade
                                )
                              ] ||
                                chamado.prioridade}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'inline-block',
                                padding: '5px 9px',
                                borderRadius: '999px',
                                background:
                                  statusStyle.background,
                                color:
                                  statusStyle.color,
                                fontSize: '12px',
                                fontWeight: 700,
                                whiteSpace:
                                  'nowrap',
                              }}
                            >
                              {statusLabels[
                                normalizarValor(
                                  chamado.status
                                )
                              ] ||
                                chamado.status}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                            }}
                          >
                            {chamado.prazo_sla ? (
                              <div>
                                <span
                                  style={{
                                    display:
                                      'inline-block',
                                    padding:
                                      '5px 9px',
                                    borderRadius:
                                      '999px',
                                    background:
                                      atrasado
                                        ? '#fee2e2'
                                        : proximoDoVencimento
                                          ? '#ffedd5'
                                          : '#dcfce7',
                                    color:
                                      atrasado
                                        ? '#b91c1c'
                                        : proximoDoVencimento
                                          ? '#c2410c'
                                          : '#15803d',
                                    fontSize:
                                      '12px',
                                    fontWeight: 700,
                                    whiteSpace:
                                      'nowrap',
                                  }}
                                >
                                  {atrasado
                                    ? '🔴 Atrasado'
                                    : proximoDoVencimento
                                      ? '🟠 Próximo do vencimento'
                                      : '🟢 No prazo'}
                                </span>

                                <div
                                  style={{
                                    marginTop:
                                      '5px',
                                    color:
                                      '#64748b',
                                    fontSize:
                                      '11px',
                                    whiteSpace:
                                      'nowrap',
                                  }}
                                >
                                  {formatarPrazoSla(
                                    chamado.prazo_sla
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  color: '#94a3b8',
                                  fontSize: '12px',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                Sem SLA
                              </span>
                            )}
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                              color: '#64748b',
                              fontSize: '13px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatarData(
                              chamado.created_at
                            )}
                          </td>

                          <td
                            style={{
                              padding: '15px 14px',
                              textAlign: 'right',
                            }}
                          >
                            <Link
                              href={`/atendimento/${chamado.id}`}
                              style={{
                                display:
                                  'inline-block',
                                textDecoration:
                                  'none',
                                background:
                                  '#0f766e',
                                color: '#ffffff',
                                padding:
                                  '8px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 700,
                                whiteSpace:
                                  'nowrap',
                              }}
                            >
                              Abrir
                            </Link>
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
