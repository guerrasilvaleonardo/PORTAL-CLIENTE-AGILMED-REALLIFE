'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  empresa?: {
    nome: string
    marca: string | null
  } | null
}

type FiltroStatus =
  | 'todos'
  | 'aberto'
  | 'em_atendimento'
  | 'aguardando_cliente'
  | 'resolvido'
  | 'encerrado'

const statusLabels: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

const prioridadeLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(data))
}

function corStatus(status: string) {
  switch (status) {
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
  switch (prioridade) {
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

    case 'media':
      return {
        background: '#fef3c7',
        color: '#a16207',
      }

    default:
      return {
        background: '#dcfce7',
        color: '#15803d',
      }
  }
}

export default function AtendimentoPage() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] =
    useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregarChamados()
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
          empresas (
            nome,
            marca
          )
        `)
        .order('created_at', {
          ascending: false,
        })

      if (error) {
        console.error(error)
        throw error
      }

      const chamadosFormatados: Chamado[] =
        (data || []).map((item: any) => ({
          ...item,
          empresa: Array.isArray(item.empresas)
            ? item.empresas[0] || null
            : item.empresas || null,
        }))

      setChamados(chamadosFormatados)
    } catch (error) {
      console.error(
        'Erro ao carregar chamados:',
        error
      )

      setErro(
        'Não foi possível carregar os chamados. Verifique as permissões de acesso.'
      )
    } finally {
      setCarregando(false)
    }
  }

  const chamadosFiltrados = chamados.filter(
    (chamado) => {
      const correspondeStatus =
        filtroStatus === 'todos' ||
        chamado.status === filtroStatus

      const termo = busca
        .trim()
        .toLowerCase()

      if (!termo) {
        return correspondeStatus
      }

      const textoPesquisa = [
        chamado.numero?.toString() || '',
        chamado.assunto,
        chamado.categoria,
        chamado.empresa?.nome || '',
      ]
        .join(' ')
        .toLowerCase()

      return (
        correspondeStatus &&
        textoPesquisa.includes(termo)
      )
    }
  )

  const quantidadePorStatus = {
    todos: chamados.length,
    aberto: chamados.filter(
      (item) => item.status === 'aberto'
    ).length,
    em_atendimento: chamados.filter(
      (item) => item.status === 'em_atendimento'
    ).length,
    aguardando_cliente: chamados.filter(
      (item) =>
        item.status === 'aguardando_cliente'
    ).length,
    resolvido: chamados.filter(
      (item) => item.status === 'resolvido'
    ).length,
    encerrado: chamados.filter(
      (item) => item.status === 'encerrado'
    ).length,
  }

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
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              color: '#0f766e',
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            Atendimento interno
          </div>

          <h1
            style={{
              margin: 0,
              color: '#0f172a',
              fontSize: '32px',
              lineHeight: 1.2,
            }}
          >
            Central de Chamados
          </h1>

          <p
            style={{
              marginTop: '10px',
              marginBottom: 0,
              color: '#64748b',
              fontSize: '15px',
            }}
          >
            Acompanhe e gerencie as solicitações dos
            clientes ÁgilMed e Real Life.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {(
            [
              ['todos', 'Todos'],
              ['aberto', 'Abertos'],
              [
                'em_atendimento',
                'Em atendimento',
              ],
              [
                'aguardando_cliente',
                'Aguardando cliente',
              ],
              ['resolvido', 'Resolvidos'],
              ['encerrado', 'Encerrados'],
            ] as [FiltroStatus, string][]
          ).map(([status, label]) => {
            const ativo = filtroStatus === status

            return (
              <button
                key={status}
                type="button"
                onClick={() =>
                  setFiltroStatus(status)
                }
                style={{
                  border: ativo
                    ? '2px solid #0f766e'
                    : '1px solid #e2e8f0',
                  background: ativo
                    ? '#f0fdfa'
                    : '#ffffff',
                  borderRadius: '12px',
                  padding: '15px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '5px',
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    color: ativo
                      ? '#0f766e'
                      : '#0f172a',
                    fontSize: '24px',
                    fontWeight: 800,
                  }}
                >
                  {quantidadePorStatus[status]}
                </div>
              </button>
            )
          })}
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px',
            marginBottom: '20px',
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
        </div>

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
            {erro}
          </div>
        )}

        {carregando ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '40px',
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
              padding: '50px 30px',
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
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: '12px',
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

              <button
                type="button"
                onClick={carregarChamados}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  borderRadius: '9px',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Atualizar
              </button>
            </div>

            <div
              style={{
                overflowX: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse:
                    'collapse',
                  minWidth: '900px',
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
                      'Abertura',
                      '',
                    ].map((titulo) => (
                      <th
                        key={titulo}
                        style={{
                          textAlign: 'left',
                          padding:
                            '13px 14px',
                          borderBottom:
                            '1px solid #e2e8f0',
                          color: '#64748b',
                          fontSize: '12px',
                          fontWeight: 700,
                          whiteSpace:
                            'nowrap',
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
                        corStatus(
                          chamado.status
                        )

                      const prioridadeStyle =
                        corPrioridade(
                          chamado.prioridade
                        )

                      return (
                        <tr
                          key={
                            chamado.id
                          }
                          style={{
                            borderBottom:
                              '1px solid #f1f5f9',
                          }}
                        >
                          <td
                            style={{
                              padding:
                                '15px 14px',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  '#0f172a',
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
                              padding:
                                '15px 14px',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                color:
                                  '#0f172a',
                              }}
                            >
                              {chamado
                                .empresa
                                ?.nome ||
                                'Empresa não identificada'}
                            </div>

                            {chamado
                              .empresa
                              ?.marca && (
                              <div
                                style={{
                                  marginTop:
                                    '3px',
                                  color:
                                    '#64748b',
                                  fontSize:
                                    '12px',
                                }}
                              >
                                {
                                  chamado
                                    .empresa
                                    .marca
                                }
                              </div>
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '15px 14px',
                              maxWidth:
                                '280px',
                            }}
                          >
                            <div
                              style={{
                                color:
                                  '#0f172a',
                                fontWeight: 600,
                              }}
                            >
                              {
                                chamado.assunto
                              }
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                '15px 14px',
                              color:
                                '#475569',
                              fontSize:
                                '13px',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {
                              chamado.categoria
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                '15px 14px',
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'inline-block',
                                padding:
                                  '5px 9px',
                                borderRadius:
                                  '999px',
                                background:
                                  prioridadeStyle.background,
                                color:
                                  prioridadeStyle.color,
                                fontSize:
                                  '12px',
                                fontWeight: 700,
                              }}
                            >
                              {prioridadeLabels[
                                chamado
                                  .prioridade
                              ] ||
                                chamado.prioridade}
                            </span>
                          </td>

                          <td
                            style={{
                              padding:
                                '15px 14px',
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'inline-block',
                                padding:
                                  '5px 9px',
                                borderRadius:
                                  '999px',
                                background:
                                  statusStyle.background,
                                color:
                                  statusStyle.color,
                                fontSize:
                                  '12px',
                                fontWeight: 700,
                                whiteSpace:
                                  'nowrap',
                              }}
                            >
                              {statusLabels[
                                chamado.status
                              ] ||
                                chamado.status}
                            </span>
                          </td>

                          <td
                            style={{
                              padding:
                                '15px 14px',
                              color:
                                '#64748b',
                              fontSize:
                                '13px',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {formatarData(
                              chamado.created_at
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '15px 14px',
                              textAlign:
                                'right',
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
                                color:
                                  '#ffffff',
                                padding:
                                  '8px 12px',
                                borderRadius:
                                  '8px',
                                fontSize:
                                  '13px',
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
