'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { marcas, type Marca } from '@/lib/marca'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { AjudaSituacoes, EXPLICACAO_CLIENTE } from '@/lib/situacoes'
import { useAvaliacoesPendentes } from '@/lib/avaliacoesPendentes'
import PendenciasAvaliacao, { SeloAvaliar } from '@/components/PendenciasAvaliacao'
import CobrancasPendentes, { SeloCobranca } from '@/components/CobrancasPendentes'
import { useCobrancasPendentes } from '@/lib/cobrancasPendentes'
import SeloMensagemNova from '@/components/SeloMensagemNova'
import { useChamadosNaoLidos } from '@/lib/chamadosNaoLidos'
import { MODULOS, useModulos, type Modulo } from '@/lib/modulos'
import Icone, { type NomeIcone } from '@/components/Icone'
import {
  comLimiteDeTempo,
  irParaLoginSessaoExpirada,
  TempoEsgotadoError,
} from '@/lib/sessao'

type Perfil = {
  nome: string | null
  email: string | null
  empresa_id: string | null
  perfil: 'cliente' | 'gestor' | 'atendimento' | 'admin'
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
  suspenso: 'Atendimento suspenso',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
}

const prioridadeLabels: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

/* Cor da pílula de cada situação (classes .pill do globals.css). */
const CLASSE_SITUACAO: Record<string, string> = {
  aberto: 'info',
  em_atendimento: 'warn',
  aguardando_cliente: 'warn',
  suspenso: 'bad',
  resolvido: 'good',
  encerrado: 'good',
  cancelado: 'flat',
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    color: 'var(--ink-muted)',
    fontSize: '16px',
    padding: '24px',
    textAlign: 'center' as const,
  },
}

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [marca, setMarca] = useState<Marca | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [chamados, setChamados] = useState<Chamado[]>([])
  /* Números da empresa inteira (não só dos 5 chamados recentes). */
  const [contagem, setContagem] = useState({ total: 0, andamento: 0, resolvidos: 0, urgentes: 0, aguardando: 0 })
  /* Ferramentas contratadas: decide o cadeado dos cartões. */
  const modulos = useModulos()
  const [error, setError] = useState<string | null>(null)
  const [redirecionando, setRedirecionando] = useState(false)

  /* Só cliente avalia; a busca começa quando o perfil é confirmado. */
  const { pendentes } = useAvaliacoesPendentes(perfil?.perfil === 'cliente')
  const idsParaAvaliar = new Set(pendentes.map((p) => p.id))
  const mensagensNovas = useChamadosNaoLidos(perfil?.perfil === 'cliente')
  /* Chamados esperando resposta do cliente além do prazo da empresa. */
  const cobrancas = useCobrancasPendentes(perfil?.perfil === 'cliente')
  const diasCobranca = new Map(cobrancas.map((c) => [c.id, c.dias]))

  useEffect(() => {
    let ativo = true

    async function carregarDados() {
      try {
        setLoading(true)
        setError(null)

        /*
         * Com limite de tempo: se a renovação do login travar, a
         * pessoa vai para o login em vez de ficar presa aqui.
         */
        const {
          data: { user },
        } = await comLimiteDeTempo(supabase.auth.getUser())

        if (!user) {
          await irParaLoginSessaoExpirada()
          return
        }

        const { data: perfilData, error: perfilError } =
          await comLimiteDeTempo(
            supabase
              .from('profiles')
              .select('nome, email, empresa_id, perfil')
              .eq('id', user.id)
              .single()
          )

        if (perfilError) {
          throw perfilError
        }

        /*
         * Esta é a home do cliente. Quem é da equipe interna não tem
         * empresa e nada aqui faz sentido para essa pessoa: o lugar
         * dela é o painel. Antes disso, a tela quebrava e mostrava
         * apenas 'não foi possível carregar'.
         */
        if (
          ['admin', 'gestor', 'atendimento'].includes(
            perfilData?.perfil || ''
          )
        ) {
          if (ativo) {
            setRedirecionando(true)
          }

          window.location.replace('/painel')
          return
        }

        if (!perfilData?.empresa_id) {
          throw new Error(
            'Seu usuário ainda não está vinculado a uma empresa. Peça ao administrador para fazer o vínculo.'
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

        const EM_ANDAMENTO = ['aberto', 'em_atendimento', 'aguardando_cliente', 'suspenso']
        const contar = (filtro: (q: any) => any) =>
          filtro(
            supabase
              .from('chamados')
              .select('id', { count: 'exact', head: true })
              .eq('empresa_id', perfilData.empresa_id)
          ).then((r: any) => r.count || 0)

        const [total, andamento, resolvidos, urgentes, aguardando] = await Promise.all([
          contar((q) => q),
          contar((q) => q.in('status', EM_ANDAMENTO)),
          contar((q) => q.in('status', ['resolvido', 'encerrado'])),
          contar((q) => q.in('status', EM_ANDAMENTO).eq('prioridade', 'urgente')),
          contar((q) => q.eq('status', 'aguardando_cliente')),
        ])

        if (ativo) setContagem({ total, andamento, resolvidos, urgentes, aguardando })
      } catch (err) {
        console.error(
          'Erro ao carregar portal:',
          err
        )

        if (err instanceof TempoEsgotadoError) {
          await irParaLoginSessaoExpirada()
          return
        }

        if (ativo) {
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Não foi possível carregar os dados do portal.'
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
          : redirecionando
            ? 'Abrindo o painel...'
            : 'Carregando portal...'}
      </div>
    )
  }

  const tema = marcas[marca]

  /*
   * Módulos da tela inicial. Atendimento todo cliente tem; os outros
   * três são cobrados à parte: sem contratação, o cartão aparece com
   * cadeado e leva à apresentação da ferramenta (ModuloBloqueado), onde
   * o cliente pede a contratação por chamado.
   */
  const seloAtendimento =
    contagem.aguardando > 0
      ? { texto: contagem.aguardando === 1 ? '1 aguarda você' : contagem.aguardando + ' aguardam você', cor: 'warn' }
      : contagem.andamento > 0
        ? { texto: contagem.andamento === 1 ? '1 em andamento' : contagem.andamento + ' em andamento', cor: '' }
        : { texto: 'Nenhum em aberto', cor: '' }

  /*
   * OS CARTÕES SAEM DA LISTA DE MÓDULOS, não de uma lista escrita à
   * mão aqui.
   *
   * Eram quatro, fixos. Enquanto isso o portal ganhou EPI, Inspeções,
   * Implantar e Auditar — e o cliente nunca soube que existiam: não
   * apareciam na tela inicial, e a tela inicial é a única que ele
   * abre. Ferramenta que ninguém vê não gera pergunta, e pergunta é o
   * começo de todo orçamento.
   *
   * Agora a fonte é `MODULOS` (lib/modulos.ts). Ferramenta nova entra
   * sozinha na tela inicial no dia em que for criada, contratada ou
   * não — e isso é o ponto: a não contratada é justamente a que
   * precisa aparecer.
   */
  const ORDEM: { modulo: Modulo; icone: NomeIcone }[] = [
    { modulo: 'treinamentos', icone: 'treinamentos' },
    { modulo: 'certificados', icone: 'certificados' },
    { modulo: 'documentos', icone: 'documentos' },
    { modulo: 'epi', icone: 'epi' },
    { modulo: 'inspecoes', icone: 'inspecoes' },
    { modulo: 'implantacao', icone: 'implantacao' },
    { modulo: 'auditoria', icone: 'auditoria' },
  ]

  const liberado = (m: Modulo) => modulos.carregando || modulos.liberado(m)

  /* Atendimento não é módulo cobrado: todo cliente tem, e por isso
     abre a tela, sempre em primeiro. */
  const meus: { href: string; icone: NomeIcone; titulo: string; texto: string; modulo?: Modulo; selo?: { texto: string; cor: string } }[] = [
    { href: '/chamados', icone: 'atendimento', titulo: 'Atendimento', texto: 'Abrir e acompanhar chamados com a nossa equipe.', selo: seloAtendimento },
    ...ORDEM.filter((o) => liberado(o.modulo)).map((o) => ({
      href: MODULOS[o.modulo].href,
      icone: o.icone,
      titulo: MODULOS[o.modulo].rotulo,
      texto: MODULOS[o.modulo].resumo,
      modulo: o.modulo,
    })),
  ]

  /*
   * As que ele ainda não tem, com a CHAMADA no lugar do resumo.
   *
   * "Gestão de inspeções de campo" é o nome da ferramenta; "o que o
   * técnico viu em campo vira ação, não papel na gaveta" é o problema
   * dele. O segundo é o que faz abrir um chamado perguntando quanto
   * custa — e esse texto já estava escrito em lib/modulos.ts, só não
   * aparecia em lugar nenhum que o cliente olhasse.
   */
  const faltam = ORDEM.filter((o) => !liberado(o.modulo)).map((o) => ({
    href: MODULOS[o.modulo].href,
    icone: o.icone,
    titulo: MODULOS[o.modulo].rotulo,
    texto: MODULOS[o.modulo].chamada,
    modulo: o.modulo,
  }))

  return (
    <main className="app">
      <div className="inicio" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="inicio-ola">
          <span className="section-title">{tema.nome}</span>
          <h1>Olá, {perfil?.nome?.split(' ')[0] || 'cliente'}! O que você precisa hoje?</h1>
        </div>

        {error && <div className="banner bad">{error}</div>}

        <CobrancasPendentes cobrancas={cobrancas} />

        <PendenciasAvaliacao pendentes={pendentes} />

        <nav className="inicio-grade" aria-label="Suas ferramentas">
          {meus.map((c) => (
            <Link key={c.href} href={c.href} className="mod-card">
              <div className="mod-topo">
                <span className="mod-icone">
                  <Icone nome={c.icone} tamanho={24} />
                </span>
              </div>
              <h3>{c.titulo}</h3>
              <p>{c.texto}</p>
              {c.selo ? (
                <span className={'mod-selo ' + c.selo.cor}>{c.selo.texto}</span>
              ) : (
                <span className="mod-go">
                  Abrir <Icone nome="seta" tamanho={14} />
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/*
          * O QUE ELE AINDA NÃO TEM, embaixo e com nome próprio.
          *
          * Misturadas no mesmo bloco, as bloqueadas pareciam ferramenta
          * quebrada. Separadas e anunciadas, viram vitrine: a pessoa
          * entende que existe mais portal do que ela contratou, e o
          * cadeado deixa de ser erro para virar convite.
          */}
        {faltam.length > 0 && (
          <section className="inicio-vitrine">
            <div className="inicio-vitrine-topo">
              <h2>Também fazemos isto</h2>
              <p>
                Ferramentas que a sua empresa ainda não usa. Clique para ver o que cada uma
                resolve e pedir um orçamento sem compromisso.
              </p>
            </div>

            <nav className="inicio-grade" aria-label="Ferramentas não contratadas">
              {faltam.map((c) => (
                <Link key={c.href} href={c.href} className="mod-card bloqueado">
                  <div className="mod-topo">
                    <span className="mod-icone">
                      <Icone nome={c.icone} tamanho={24} />
                    </span>
                    <span className="mod-cadeado">
                      <Icone nome="cadeado" tamanho={18} rotulo="Ferramenta não contratada" />
                    </span>
                  </div>
                  <h3>{c.titulo}</h3>
                  <p>{c.texto}</p>
                  <span className="mod-selo acento">Conhecer e pedir orçamento</span>
                </Link>
              ))}
            </nav>
          </section>
        )}

        <div className="inicio-acoes">
          <Link href="/chamados/novo" className="btn btn-primary">
            <Icone nome="mais" tamanho={16} /> Abrir chamado
          </Link>
          <Link href="/chamados" className="btn">
            Ver todos os chamados
          </Link>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2 style={{ fontSize: 18 }}>Chamados recentes</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <AjudaSituacoes />
              <Link href="/chamados" className="btn btn-ghost btn-sm">
                Ver todos
              </Link>
            </div>
          </div>

          {chamados.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: 0 }}>Você ainda não abriu nenhum chamado.</p>
              <p style={{ margin: '8px 0 0' }}>Use “Abrir chamado” para falar com a nossa equipe.</p>
            </div>
          ) : (
            <div>
              {chamados.map((chamado) => (
                <Link key={chamado.id} href={'/chamados/' + chamado.id} className="chamado-linha">
                  <span className="num">#{chamado.numero}</span>
                  <span className="assunto">
                    <strong>{chamado.assunto}</strong>
                    {idsParaAvaliar.has(chamado.id) && <SeloAvaliar />}
                    {diasCobranca.has(chamado.id) && <SeloCobranca dias={diasCobranca.get(chamado.id) || 0} />}
                    <SeloMensagemNova quantidade={mensagensNovas[chamado.id]} />
                    <span>{chamado.categoria}</span>
                  </span>
                  <span className={'pill ' + (CLASSE_SITUACAO[chamado.status] || 'flat')} title={EXPLICACAO_CLIENTE[chamado.status] || ''}>
                    {statusLabels[chamado.status] || chamado.status}
                  </span>
                  <span className={'prio ' + chamado.prioridade}>{prioridadeLabels[chamado.prioridade] || chamado.prioridade}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
