'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { textoPrazoUtil } from '@/lib/prazo'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const EM_ABERTO = ['aberto', 'em_atendimento', 'aguardando_cliente']

type ChamadoAberto = {
  id: string
  numero: number | null
  assunto: string
  status: string
  prioridade: string
  prazo_sla: string | null
  responsavel_id: string | null
  empresas?: {
    nome_fantasia: string | null
    razao_social: string | null
  } | null
}

type CargaAtendente = {
  id: string
  nome: string
  abertos: number
  atrasados: number
  urgentes: number
}

const rotuloSituacao: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/)

  return (
    (p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')
  ).toUpperCase()
}

function estaAtrasado(prazo: string | null) {
  return Boolean(prazo) && new Date(prazo as string).getTime() < Date.now()
}

/* O prazo conta apenas horas úteis: 8 por dia, de segunda a sexta. */
function textoPrazo(prazo: string | null) {
  return textoPrazoUtil(prazo).texto
}

type Indicadores = {
  chamadosAbertos: number
  chamadosUrgentes: number
  certVencidos: number
  certVencendo: number
  empresas: number
  usuarios: number
}

const zerado: Indicadores = {
  chamadosAbertos: 0,
  chamadosUrgentes: 0,
  certVencidos: 0,
  certVencendo: 0,
  empresas: 0,
  usuarios: 0,
}

function emDias(dias: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)

  return d.toISOString().slice(0, 10)
}

export default function PainelPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [ehAdmin, setEhAdmin] = useState(false)
  const [ehGestor, setEhGestor] = useState(false)
  const [i, setI] = useState<Indicadores>(zerado)

  /* Os chamados que estão no nome de quem abriu o painel. */
  const [meus, setMeus] = useState<ChamadoAberto[]>([])

  const [carga, setCarga] = useState<CargaAtendente[]>([])

  const [semDono, setSemDono] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setCarregando(true)
        setErro('')

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          window.location.href = '/login'
          return
        }

        const { data: perfil, error: perfilErro } = await supabase
          .from('profiles')
          .select('nome, perfil')
          .eq('id', user.id)
          .single()

        if (perfilErro) throw perfilErro

        if (!PERFIS_INTERNOS.includes(perfil?.perfil || '')) {
          window.location.href = '/'
          return
        }

        if (!ativo) return

        setNome(perfil?.nome || '')
        setEhAdmin(perfil?.perfil === 'admin')
        setEhGestor(
          perfil?.perfil === 'admin' || perfil?.perfil === 'gestor'
        )

        const hoje = emDias(0)
        const daqui30 = emDias(30)

        const contar = (q: any) => q.then((r: any) => r.count ?? 0)

        const [abertos, urgentes, vencidos, vencendo, empresas, usuarios] =
          await Promise.all([
            contar(
              supabase
                .from('chamados')
                .select('id', { count: 'exact', head: true })
                .in('status', ['aberto', 'em_atendimento', 'aguardando_cliente'])
            ),
            contar(
              supabase
                .from('chamados')
                .select('id', { count: 'exact', head: true })
                .eq('prioridade', 'urgente')
                .in('status', ['aberto', 'em_atendimento', 'aguardando_cliente'])
            ),
            contar(
              supabase
                .from('certificados')
                .select('id', { count: 'exact', head: true })
                .lt('validade', hoje)
            ),
            contar(
              supabase
                .from('certificados')
                .select('id', { count: 'exact', head: true })
                .gte('validade', hoje)
                .lte('validade', daqui30)
            ),
            contar(
              supabase
                .from('empresas')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'ativo')
            ),
            contar(
              supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('ativo', true)
            ),
          ])

        if (!ativo) return

        setI({
          chamadosAbertos: abertos,
          chamadosUrgentes: urgentes,
          certVencidos: vencidos,
          certVencendo: vencendo,
          empresas,
          usuarios,
        })

        /*
         * Um pedido direto de quem atende: "onde vejo os meus?".
         * Puxa a fila aberta uma vez e reparte em duas leituras —
         * a minha e a da equipe inteira.
         */
        const { data: filaData } = await supabase
          .from('chamados')
          .select(
            'id, numero, assunto, status, prioridade, prazo_sla, responsavel_id, empresas(nome_fantasia, razao_social)'
          )
          .in('status', EM_ABERTO)
          .order('prazo_sla', { nullsFirst: false })

        const fila = ((filaData || []) as any[]).map((c) => ({
          ...c,
          empresas: Array.isArray(c.empresas) ? c.empresas[0] : c.empresas,
        })) as ChamadoAberto[]

        const { data: equipeData } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('perfil', PERFIS_INTERNOS)
          .eq('ativo', true)
          .order('nome')

        if (!ativo) return

        setMeus(fila.filter((c) => c.responsavel_id === user.id))

        setSemDono(fila.filter((c) => !c.responsavel_id).length)

        setCarga(
          ((equipeData || []) as any[]).map((pessoa) => {
            const dela = fila.filter(
              (c) => c.responsavel_id === pessoa.id
            )

            return {
              id: pessoa.id,
              nome: pessoa.nome || 'Sem nome',
              abertos: dela.length,
              atrasados: dela.filter((c) => estaAtrasado(c.prazo_sla)).length,
              urgentes: dela.filter((c) => c.prioridade === 'urgente').length,
            }
          })
        )
      } catch (e: any) {
        console.error(e)
        if (ativo) setErro(e?.message || 'Não foi possível carregar o painel.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  const meusAtrasados = meus.filter((c) => estaAtrasado(c.prazo_sla)).length

  const maiorCarga = carga.reduce((m, a) => Math.max(m, a.abertos), 0)

  const modulos = [
    {
      href: '/atendimento',
      titulo: 'Atendimento',
      texto: 'Todos os chamados das duas marcas, com SLA, prioridade e responsável.',
      acao: 'Abrir fila',
    },
    {
      href: '/certificados',
      titulo: 'Certificados',
      texto: 'Treinamentos e exames por colaborador, com o que vence primeiro no topo.',
      acao: 'Ver vencimentos',
    },
    {
      href: '/administracao/empresas',
      titulo: 'Empresas',
      texto: 'Cadastro das empresas clientes e a marca que atende cada uma.',
      acao: 'Gerenciar empresas',
      admin: true,
    },
    {
      href: '/administracao/usuarios',
      titulo: 'Usuários',
      texto: 'Acessos da equipe interna e dos clientes, por perfil.',
      acao: 'Gerenciar usuários',
      admin: true,
    },
    {
      href: '/chamados',
      titulo: 'Meus chamados',
      texto: 'Os chamados abertos pela sua própria empresa.',
      acao: 'Ver meus chamados',
    },
    {
      href: '/perfil',
      titulo: 'Meu perfil',
      texto: 'Seus dados de acesso e a empresa vinculada.',
      acao: 'Abrir perfil',
    },
  ]

  return (
    <div className="app">
      <div>
        <div className="section-title">Painel central</div>
        <h1 style={{ fontSize: 30, marginTop: 6 }}>
          {nome ? `Olá, ${nome.split(' ')[0]}.` : 'Painel'}
        </h1>
        <p style={{ margin: '8px 0 0', color: 'var(--ink-muted)', fontSize: 14 }}>
          O que está aberto, o que está vencendo e onde mexer em cada coisa.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : i.chamadosAbertos}</div>
          <div className="lbl">Chamados em aberto</div>
        </div>

        <div className={'stat' + (i.chamadosUrgentes > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : i.chamadosUrgentes}</div>
          <div className="lbl">Urgentes na fila</div>
        </div>

        <div className={'stat' + (i.certVencidos > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : i.certVencidos}</div>
          <div className="lbl">Certificados vencidos</div>
        </div>

        <div className={'stat' + (i.certVencendo > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : i.certVencendo}</div>
          <div className="lbl">Vencem em 30 dias</div>
        </div>

        <div className={'stat' + (meusAtrasados > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : meus.length}</div>
          <div className="lbl">Comigo agora</div>
        </div>
      </div>

      {!carregando && (i.certVencidos > 0 || i.chamadosUrgentes > 0) && (
        <div className="banner bad">
          {i.certVencidos > 0 && `${i.certVencidos} certificado(s) já vencido(s). `}
          {i.chamadosUrgentes > 0 && `${i.chamadosUrgentes} chamado(s) urgente(s) na fila.`}
        </div>
      )}

      <div>
        <div className="section-title" style={{ marginBottom: 10 }}>
          Módulos
        </div>

        <div className="mod-grid">
          {modulos
            .filter((m) => !m.admin || ehAdmin)
            .map((m) => (
              <Link key={m.href} href={m.href} className="mod-card">
                <h3>{m.titulo}</h3>
                <p>{m.texto}</p>
                <span className="mod-go">{m.acao} →</span>
              </Link>
            ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Meus atendimentos</div>

          <Link href="/atendimento?responsavel=meus" className="btn btn-sm">
            Ver no quadro
          </Link>
        </div>

        <div className="panel-body" style={{ gap: 0 }}>
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : meus.length === 0 ? (
            <div className="empty-state">
              Nenhum chamado está no seu nome agora. Quando alguém
              transferir um chamado para você, ele aparece aqui.
            </div>
          ) : (
            meus.map((c, indice) => {
              const atrasado = estaAtrasado(c.prazo_sla)

              return (
                <Link
                  key={c.id}
                  href={'/atendimento/' + c.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '54px 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 2px',
                    borderTop:
                      indice === 0 ? 'none' : '1px solid var(--border)',
                    color: 'inherit',
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--ink-faint)' }}
                  >
                    #{c.numero ?? ''}
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontWeight: 600,
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
                      {c.empresas?.nome_fantasia ||
                        c.empresas?.razao_social ||
                        'Empresa'}
                      {' · '}
                      {rotuloSituacao[c.status] || c.status}
                    </span>
                  </span>

                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.prioridade === 'urgente' && (
                      <span className="pill bad">urgente</span>
                    )}

                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: atrasado
                          ? 'var(--danger)'
                          : 'var(--ink-muted)',
                      }}
                    >
                      {textoPrazo(c.prazo_sla)}
                    </span>
                  </span>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {ehGestor && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Carga por atendente</div>

            {semDono > 0 && (
              <Link href="/atendimento?responsavel=sem" className="pill bad">
                {semDono} sem responsável
              </Link>
            )}
          </div>

          <div className="panel-body" style={{ gap: 0 }}>
            {carregando ? (
              <div className="empty-state">Carregando...</div>
            ) : carga.length === 0 ? (
              <div className="empty-state">Nenhum atendente cadastrado.</div>
            ) : (
              <>
                <div style={cabecalhoCarga}>
                  <span>Atendente</span>
                  <span />
                  <span style={{ textAlign: 'right' }}>Aberto</span>
                  <span style={{ textAlign: 'right' }}>Atraso</span>
                  <span style={{ textAlign: 'right' }}>Urgente</span>
                </div>

                {carga.map((a, indice) => (
                  <Link
                    key={a.id}
                    href={'/atendimento?responsavel=' + a.id}
                    style={{
                      ...linhaCarga,
                      borderTop:
                        indice === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        minWidth: 0,
                      }}
                    >
                      <span style={avatarCarga}>{iniciais(a.nome)}</span>

                      <span
                        style={{
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {a.nome}
                      </span>
                    </span>

                    <span
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: 'var(--surface-sunken)',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width:
                            (maiorCarga
                              ? Math.round((a.abertos / maiorCarga) * 100)
                              : 0) + '%',
                          background: a.atrasados
                            ? 'var(--danger)'
                            : 'var(--primary)',
                        }}
                      />
                    </span>

                    <span style={numeroCarga}>{a.abertos}</span>

                    <span
                      style={{
                        ...numeroCarga,
                        color: a.atrasados
                          ? 'var(--danger)'
                          : 'var(--ink-faint)',
                      }}
                    >
                      {a.atrasados}
                    </span>

                    <span
                      style={{
                        ...numeroCarga,
                        color: a.urgentes
                          ? 'var(--amber)'
                          : 'var(--ink-faint)',
                      }}
                    >
                      {a.urgentes}
                    </span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Resumo do cadastro</div>
        </div>

        <div className="panel-body" style={{ flexDirection: 'row', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="num mono" style={{ fontSize: 24, fontWeight: 600 }}>
              {carregando ? '—' : i.empresas}
            </div>
            <div className="lbl" style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 600 }}>
              Empresas ativas
            </div>
          </div>

          <div>
            <div className="num mono" style={{ fontSize: 24, fontWeight: 600 }}>
              {carregando ? '—' : i.usuarios}
            </div>
            <div className="lbl" style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 600 }}>
              Usuários ativos
            </div>
          </div>
        </div>
      </div>

      <div className="footnote">Portal do Cliente · ÁgilMed & Real Life SSMA</div>
    </div>
  )
}

const gradeCarga = '1fr minmax(60px,120px) 64px 64px 68px'

const cabecalhoCarga = {
  display: 'grid',
  gridTemplateColumns: gradeCarga,
  gap: 12,
  alignItems: 'center',
  padding: '0 2px 8px',
  fontSize: 10.5,
  letterSpacing: '.05em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-faint)',
  fontWeight: 700,
}

const linhaCarga = {
  display: 'grid',
  gridTemplateColumns: gradeCarga,
  gap: 12,
  alignItems: 'center',
  padding: '11px 2px',
  color: 'inherit',
  fontSize: 13.5,
}

const avatarCarga = {
  width: 26,
  height: 26,
  flex: '0 0 26px',
  borderRadius: 999,
  background: 'var(--primary-tint)',
  color: 'var(--primary-strong)',
  fontSize: 10.5,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const numeroCarga = {
  textAlign: 'right' as const,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums' as const,
}

