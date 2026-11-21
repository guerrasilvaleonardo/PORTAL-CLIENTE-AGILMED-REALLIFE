'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { useModulos, type Modulo } from '@/lib/modulos'
import SeletorEmpresa from '@/components/SeletorEmpresa'
import AvisoForaHorario from '@/components/AvisoForaHorario'
import AvisoRelatorioDesempenho from '@/components/AvisoRelatorioDesempenho'
import { marcas, type Marca } from '@/lib/marca'
import CelebracaoEstrelas from '@/components/CelebracaoEstrelas'
import ManualAjuda from '@/components/manual/ManualAjuda'
import { comLimiteDeTempo, irParaLoginSessaoExpirada, TempoEsgotadoError } from '@/lib/sessao'
import { marcaDoDominio } from '@/lib/marca'
import './portal-header.css'
import Icone from '@/components/Icone'
import { useChamadosNaoLidos } from '@/lib/chamadosNaoLidos'

/*
 * Mensagens privadas de Conversas ainda não lidas por quem está logado
 * (chat_equipe: destinatario_id = eu e lido_em vazio). A sala aberta
 * "Equipe toda" não tem controle de leitura e não entra na conta.
 * Atualiza a cada 20 s, ao voltar para a aba e quando a tela de
 * Conversas avisa que marcou mensagens como lidas.
 */
function useConversasNaoLidas(ativo: boolean) {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!ativo) return

    let vivo = true

    async function contar() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { count, error } = await supabase
          .from('chat_equipe')
          .select('id', { count: 'exact', head: true })
          .eq('destinatario_id', user.id)
          .is('lido_em', null)

        if (!error && vivo) setTotal(count || 0)
      } catch (erro) {
        console.error('Erro ao contar mensagens não lidas:', erro)
      }
    }

    contar()

    const relogio = setInterval(contar, 20000)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') contar()
    }

    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('conversas-lidas', contar)

    return () => {
      vivo = false
      clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('conversas-lidas', contar)
    }
  }, [ativo])

  return total
}

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

/*
 * Seções de dentro de cada módulo. Ficam aninhadas na barra lateral, no
 * módulo aberto, como no OnSafety: uma coluna só, em vez de duas.
 *
 * Tela nova de um módulo entra aqui e não monta navegação própria.
 */
const SECOES: Record<string, { href: string; rotulo: string }[]> = {
  /*
   * As telas do Atendimento existiam desde sempre sem entrada em menu
   * nenhum: só se chegava nelas por link direto ou digitando o
   * endereço. Chamados entra aqui (e sai do menu principal) porque é
   * a mesma conversa com o cliente que o quadro despacha.
   */
  '/atendimento': [
    { href: '/atendimento', rotulo: 'Quadro' },
    { href: '/chamados', rotulo: 'Chamados' },
    { href: '/atendimento/agenda', rotulo: 'Agenda' },
    { href: '/atendimento/prioridades', rotulo: 'Prioridades e SLA' },
    { href: '/atendimento/feriados', rotulo: 'Feriados' },
    { href: '/atendimento/historico', rotulo: 'Histórico' },
    { href: '/atendimento/desempenho', rotulo: 'Desempenho' },
    { href: '/atendimento/relatorio-mensal', rotulo: 'Relatório mensal' },
  ],
  '/auditorias': [
    /* Dentro do módulo o rótulo volta a ser curto: aqui já se sabe que
       se está auditando. O nome longo serve no menu principal, onde ele
       precisa se distinguir de "Implantar o sistema". */
    { href: '/auditorias', rotulo: 'Auditorias' },
    { href: '/auditorias/programa', rotulo: 'Programa do ano' },
    { href: '/auditorias/nc', rotulo: 'Constatações' },
    /* Bancada da equipe: o cliente que entrar vê um aviso, não um erro. */
    { href: '/auditorias/checklists', rotulo: 'Checklists da norma' },
    { href: '/auditorias/modelos', rotulo: 'Modelos e explicações' },
  ],
  '/implantacao': [
    /* Primeiro da lista de propósito: ter onde guardar vem antes de
     * produzir o primeiro documento. Esta tela já esteve em Auditorias,
     * e estava no módulo errado: quem precisa montar a estrutura é quem
     * ainda não tem nada — quem audita já tem os documentos em algum
     * lugar. A trilha chamava por ela na etapa 1 obrigando o cliente a
     * trocar de módulo na terceira atividade. */
    { href: '/implantacao/preparar', rotulo: 'Antes de começar' },
    { href: '/implantacao', rotulo: 'Minha trilha' },
    /* Bancada da equipe: o cliente que entrar vê um aviso, não um erro. */
    { href: '/implantacao/modelos', rotulo: 'Modelos de documento' },
  ],
  /*
   * A ordem segue o dia de quem usa, não a ordem em que as telas
   * foram feitas: ONDE ESTOU → O QUE FAÇO → O QUE SAIU DISSO → O QUE
   * ENTREGO → O QUE PREPARO ANTES. É a mesma lógica do menu de EPI, e
   * manter as duas iguais faz o cliente aprender uma vez só.
   *
   * O que estava errado antes: os relatórios vinham antes das telas
   * que os produzem, e quem abria o módulo encontrava primeiro o
   * documento de um trabalho que ainda não tinha feito.
   */
  '/inspecoes': [
    { href: '/inspecoes/painel', rotulo: 'Visão geral' },

    /* O que faço. Campo primeiro: é a tela diária, aberta de pé no
       cliente, e a que mais vezes se procura. */
    { href: '/inspecoes/campo', rotulo: 'Apontamento de campo' },
    { href: '/inspecoes', rotulo: 'Inspeções' },

    /* O que saiu disso, e precisa de alguém. */
    { href: '/inspecoes/nc', rotulo: 'Não conformidades' },

    /* O que entrego. O arquivo vem antes do consolidado porque é o
       que a auditoria pede ver — e é nele que a sequência dos códigos
       mostra se faltou mês. */
    { href: '/inspecoes/relatorios', rotulo: 'Relatórios emitidos' },
    { href: '/inspecoes/relatorio', rotulo: 'Relatório do período' },

    /* O que preparo antes, e quase nunca mexo depois. */
    { href: '/inspecoes/locais', rotulo: 'Locais e etiquetas' },
    { href: '/inspecoes/modelos', rotulo: 'Modelos de checklist' },
  ],
  '/epi': [
    { href: '/epi/painel', rotulo: 'Visão geral' },
    { href: '/epi', rotulo: 'Entregas' },
    { href: '/epi/ficha', rotulo: 'Fichas de EPI' },
    { href: '/epi/funcoes', rotulo: 'EPI por função' },
    { href: '/epi/equipamentos', rotulo: 'Cadastro de EPIs' },
  ],
  '/colaboradores': [
    { href: '/colaboradores', rotulo: 'Pessoas' },
    { href: '/colaboradores/locais', rotulo: 'Locais de trabalho' },
  ],
}

export default function PortalHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()

  const [marca, setMarca] = useState<Marca | null>(null)
  /*
   * O que o usuário abriu ou fechou à mão. Sem entrada aqui, o módulo
   * segue a rota: quem chega numa tela de Inspeções encontra a lista
   * dela aberta, sem precisar clicar. A escolha dele vale enquanto a
   * página viver — guardar no navegador faria o menu lembrar de um
   * módulo fechado semanas depois, e a pessoa acharia que sumiu.
   */
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [interno, setInterno] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [saindo, setSaindo] = useState(false)
  const naoLidas = useConversasNaoLidas(!carregando && !!marca)
  const chamadosNovos = Object.keys(useChamadosNaoLidos(!carregando && !!marca)).length
  /* Ferramentas cobradas à parte: cadeado no menu do cliente sem contratação. */
  const modulos = useModulos()
  const MODULO_DA_ROTA: Record<string, Modulo> = { '/certificados': 'certificados', '/treinamentos': 'treinamentos', '/documentos': 'documentos', '/epi': 'epi', '/inspecoes': 'inspecoes', '/auditorias': 'auditoria', '/implantacao': 'implantacao' }

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setCarregando(true)

        /*
         * Com limite de tempo: sessão expirada que não renova deixava o
         * cabeçalho (e o menu) sumido para sempre. Estourou: login de novo.
         */
        let user = null

        try {
          const resposta = await comLimiteDeTempo(supabase.auth.getUser())

          user = resposta.data.user
        } catch (erro) {
          if (erro instanceof TempoEsgotadoError) {
            await irParaLoginSessaoExpirada()
            return
          }

          throw erro
        }

        if (!user) {
          if (ativo) {
            setMarca(null)
            setCarregando(false)
          }

          /*
           * O cabeçalho é o único componente presente em todas as
           * páginas, então é aqui que a sessão ausente vira redirect.
           */
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }

          return
        }

        /*
         * Perfil e marca também com limite. Se não vierem, o menu aparece
         * mesmo assim (menu do cliente, marca do domínio): a segurança dos
         * dados está no banco (RLS), não no menu.
         */
        const perfilResp = await comLimiteDeTempo(
          supabase.from('profiles').select('perfil').eq('id', user.id).maybeSingle()
        ).catch(() => null)
        const perfil = perfilResp?.data || null

        const marcaEmpresa =
          (await comLimiteDeTempo(obterMarcaDaEmpresa()).catch(() => null)) || marcaDoDominio()

        if (!ativo) {
          return
        }

        setInterno(PERFIS_INTERNOS.includes(perfil?.perfil || ''))
        setMarca(marcaEmpresa)

        /*
         * A marca da empresa passa a tingir a interface inteira:
         * os tokens do sistema visual são reescritos na raiz, então
         * botões, pílulas e destaques seguem a cor certa sem que
         * cada tela precise saber de qual marca se trata.
         */
        if (marcaEmpresa) {
          const tema = marcas[marcaEmpresa]
          const raiz = document.documentElement.style

          raiz.setProperty('--primary', tema.principal)
          raiz.setProperty('--primary-strong', tema.dark)
          raiz.setProperty('--primary-tint', tema.fundo)
          raiz.setProperty('--accent', tema.acento)
          raiz.setProperty('--accent-hover', tema.acentoHover)
          raiz.setProperty('--on-accent', tema.noAcento)
        }
      } catch (erro) {
        console.error('Erro ao carregar o cabeçalho:', erro)

        /* Erro inesperado não esconde o menu: usa a marca do domínio. */
        if (ativo) {
          setMarca(marcaDoDominio())
        }
      } finally {
        if (ativo) {
          setCarregando(false)
        }
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  async function sair() {
    if (saindo) {
      return
    }

    setSaindo(true)

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (erro) {
      console.error('Erro ao encerrar sessão:', erro)
    } finally {
      window.location.href = '/login'
    }
  }

  /*
   * O conteúdo das telas passa por dentro deste componente, porque a
   * barra lateral é irmã dele. Nestes dois casos não há barra nenhuma —
   * mas a tela em si continua aparecendo, como antes.
   */
  if (pathname === '/login') {
    return <>{children}</>
  }

  if (carregando || !marca) {
    return <>{children}</>
  }

  const tema = marcas[marca]

  const itens = interno
    ? [
        { href: '/painel', rotulo: 'Visão geral' },
        /* Chamados saiu daqui e virou seção do Atendimento. */
        { href: '/atendimento', rotulo: 'Atendimento' },
        { href: '/estrelas', rotulo: 'Estrelas' },
        { href: '/colaboradores', rotulo: 'Colaboradores' },
        { href: '/epi', rotulo: 'EPI' },
        { href: '/inspecoes', rotulo: 'Inspeções' },
        { href: '/implantacao', rotulo: 'Implantar o sistema' },
        { href: '/auditorias', rotulo: 'Auditar o sistema' },
        { href: '/certificados', rotulo: 'Certificados' },
        { href: '/documentos', rotulo: 'Documentos de SST' },
        { href: '/treinamentos', rotulo: 'Treinamentos' },
        { href: '/equipe', rotulo: 'Conversas' },
      ]
    : [
        { href: '/', rotulo: 'Início' },
        { href: '/chamados', rotulo: 'Chamados' },
        /* Cadastro de apoio, não cobrado: alimenta certificados e, depois, a entrega de EPI. */
        { href: '/colaboradores', rotulo: 'Colaboradores' },
        { href: '/epi', rotulo: 'EPI' },
        { href: '/inspecoes', rotulo: 'Inspeções' },
        { href: '/implantacao', rotulo: 'Implantar o sistema' },
        { href: '/auditorias', rotulo: 'Auditar o sistema' },
        { href: '/certificados', rotulo: 'Certificados' },
        { href: '/documentos', rotulo: 'Documentos de SST' },
        { href: '/treinamentos', rotulo: 'Treinamentos' },
        { href: '/equipe', rotulo: 'Conversas' },
        /* Vitrine: ferramentas, serviços e pedidos de orçamento (só cliente). */
        { href: '/contratar', rotulo: 'Contratar' },
      ]

  const ativo = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="topbar"
        style={{
          width: '100%',
          maxWidth: 1400,
          margin: '0 auto',
          padding: '12px clamp(14px, 3vw, 32px)',
        }}
      >
        <Link href={interno ? '/painel' : '/'} className="brand">
          {marca === 'reallife' ? (
            <>
              {/* Logo oficial colorido (fundo claro). */}
              <img
                src="/marca/real-life-logo-horizontal-cor.svg"
                alt="Real Life Engenharia de SSMA"
                width={92}
                height={45}
                style={{ display: 'block', width: 92, height: 'auto' }}
              />
              <div className="brand-text">
                <span>Portal do Cliente</span>
              </div>
            </>
          ) : (
            <>
              <div className="brand-mark">AM</div>

              <div className="brand-text">
                <h1>{tema.nome}</h1>
                <span>Portal do Cliente</span>
              </div>
            </>
          )}
        </Link>

        {!carregando && !interno && <SeletorEmpresa />}

        <div className="topbar-spacer" />

        <ManualAjuda interno={interno} />

        <Link
          href="/perfil"
          className={'btn btn-ghost btn-sm' + (pathname === '/perfil' ? ' active' : '')}
          title="Meu perfil: dados e troca de senha"
        >
          Meu perfil
        </Link>

        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="btn btn-ghost btn-sm"
        >
          {saindo ? 'Saindo...' : 'Sair'}
        </button>
      </div>

      {interno && <AvisoForaHorario />}
      {interno && <AvisoRelatorioDesempenho />}
      {interno && <CelebracaoEstrelas />}
    </header>

    <div className="portal-shell">
      <aside className="portal-menu nao-imprimir">
        <nav className="modtabs vertical" aria-label="Seções do portal">
          {itens.map((item) => {
            const bloqueado =
              !interno && !!MODULO_DA_ROTA[item.href] && !modulos.carregando && !modulos.liberado(MODULO_DA_ROTA[item.href])

            const secoes = SECOES[item.href]

            /* Chamados é seção do Atendimento e não começa com
             * /atendimento: sem olhar as seções, abrir um chamado não
             * acenderia nada no menu. */
            const aberto = ativo(item.href) || (secoes || []).some((s) => ativo(s.href))

            /* A seção que repete o endereço do módulo (o "Quadro", as
             * "Entregas") só acende na tela dela; as outras acendem
             * também nas telas de dentro, como a de um chamado. */
            const naSecao = (href: string) =>
              pathname === href || (href !== item.href && pathname.startsWith(href + '/'))

            /*
             * Sanfona: o módulo com seções abre e fecha no clique, em
             * vez de só acender quando a rota cai dentro dele.
             *
             * POR QUE O NOME DO MÓDULO DEIXA DE SER LINK quando há
             * seções. A primeira seção de todo módulo é a tela
             * principal dele ("Visão geral", "Auditorias", "Minha
             * trilha"), então nada fica inalcançável — e um elemento
             * que às vezes navega e às vezes abre uma lista é o tipo
             * de botão que ninguém aprende.
             *
             * Módulo sem seções continua link direto: ali não há o que
             * abrir.
             */
            const temSecoes = !!secoes && secoes.length > 0 && !bloqueado
            const expandido = temSecoes && (abertos[item.href] ?? aberto)

            if (temSecoes) {
              return (
                <div key={item.href} className="modtab-grupo">
                  <button
                    type="button"
                    className={'modtab-botao' + (aberto ? ' active' : '')}
                    aria-expanded={expandido}
                    onClick={() =>
                      setAbertos((a) => ({ ...a, [item.href]: !(a[item.href] ?? aberto) }))
                    }
                  >
                    <span className="modtab-nome">
                      {item.rotulo}
                      {/* O balão mora no módulo, e Atendimento tem
                          seções: sem repeti-lo aqui, o aviso de
                          mensagem nova sumiria para a equipe. */}
                      {item.href === (interno ? '/atendimento' : '/chamados') &&
                        chamadosNovos > 0 && (
                          <span
                            className="balao-nao-lidas"
                            title={
                              chamadosNovos === 1
                                ? '1 chamado com mensagem nova'
                                : chamadosNovos + ' chamados com mensagem nova'
                            }
                            aria-label={chamadosNovos + ' chamados com mensagem nova'}
                          >
                            {chamadosNovos > 9 ? '9+' : chamadosNovos}
                          </span>
                        )}
                    </span>
                    <span className={'modtab-seta' + (expandido ? ' aberta' : '')} aria-hidden="true" />
                  </button>

                  {expandido && (
                    <div className="submenu">
                      {secoes.map((s) => (
                        <Link key={s.href} href={s.href} className={naSecao(s.href) ? 'active' : ''}>
                          {s.rotulo}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div key={item.href} className="modtab-grupo">
                <Link
                  href={item.href}
                  className={(aberto ? 'active' : '') + (bloqueado ? ' bloqueado' : '')}
                  title={bloqueado ? 'Ferramenta não contratada: clique para conhecer e solicitar' : undefined}
                >
                  {bloqueado && <Icone nome="cadeado" tamanho={14} rotulo="não contratada" />}
                  {item.rotulo}
                  {item.href === (interno ? '/atendimento' : '/chamados') &&
                    chamadosNovos > 0 && (
                      <span
                        className="balao-nao-lidas"
                        title={
                          chamadosNovos === 1
                            ? '1 chamado com mensagem nova'
                            : chamadosNovos + ' chamados com mensagem nova'
                        }
                        aria-label={chamadosNovos + ' chamados com mensagem nova'}
                      >
                        {chamadosNovos > 9 ? '9+' : chamadosNovos}
                      </span>
                    )}
                  {item.href === '/equipe' && naoLidas > 0 && (
                    <span
                      className="balao-nao-lidas"
                      title={
                        naoLidas === 1
                          ? '1 mensagem nova em Conversas'
                          : naoLidas + ' mensagens novas em Conversas'
                      }
                      aria-label={naoLidas + ' mensagens não lidas'}
                    >
                      {naoLidas > 9 ? '9+' : naoLidas}
                    </span>
                  )}
                </Link>

              </div>
            )
          })}
        </nav>
      </aside>

      <div className="portal-conteudo">{children}</div>
    </div>
    </>
  )
}
