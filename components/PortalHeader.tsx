'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { useModulos, type Modulo } from '@/lib/modulos'
import SeletorEmpresa from '@/components/SeletorEmpresa'
import AvisoForaHorario from '@/components/AvisoForaHorario'
import { marcas, type Marca } from '@/lib/marca'
import CelebracaoEstrelas from '@/components/CelebracaoEstrelas'
import ManualAjuda from '@/components/manual/ManualAjuda'
import { comLimiteDeTempo, irParaLoginSessaoExpirada, TempoEsgotadoError } from '@/lib/sessao'
import { marcaDoDominio } from '@/lib/marca'
import './portal-header.css'
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

export default function PortalHeader() {
  const pathname = usePathname()

  const [marca, setMarca] = useState<Marca | null>(null)
  const [interno, setInterno] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [saindo, setSaindo] = useState(false)
  const naoLidas = useConversasNaoLidas(!carregando && !!marca)
  const chamadosNovos = Object.keys(useChamadosNaoLidos(!carregando && !!marca)).length
  /* Ferramentas cobradas à parte: cadeado no menu do cliente sem contratação. */
  const modulos = useModulos()
  const MODULO_DA_ROTA: Record<string, Modulo> = { '/certificados': 'certificados', '/treinamentos': 'treinamentos', '/documentos': 'documentos' }

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

  if (pathname === '/login') {
    return null
  }

  if (carregando || !marca) {
    return null
  }

  const tema = marcas[marca]

  const itens = interno
    ? [
        { href: '/painel', rotulo: 'Painel' },
        { href: '/atendimento', rotulo: 'Atendimento' },
        { href: '/estrelas', rotulo: 'Estrelas' },
        { href: '/chamados', rotulo: 'Chamados' },
        { href: '/certificados', rotulo: 'Certificados' },
        { href: '/documentos', rotulo: 'Documentos SST' },
        { href: '/treinamentos', rotulo: 'Treinamentos' },
        { href: '/equipe', rotulo: 'Conversas' },
      ]
    : [
        { href: '/', rotulo: 'Início' },
        { href: '/chamados', rotulo: 'Chamados' },
        { href: '/certificados', rotulo: 'Certificados' },
        { href: '/documentos', rotulo: 'Documentos SST' },
        { href: '/treinamentos', rotulo: 'Treinamentos' },
        { href: '/equipe', rotulo: 'Conversas' },
      ]

  const ativo = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
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
          <div className="brand-mark">{marca === 'agilmed' ? 'AM' : 'RL'}</div>

          <div className="brand-text">
            <h1>{tema.nome}</h1>
            <span>Portal do Cliente</span>
          </div>
        </Link>

        {!carregando && !interno && <SeletorEmpresa />}

        <div className="topbar-spacer" />

        <nav className="modtabs">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={ativo(item.href) ? 'active' : ''}
              title={
                !interno && MODULO_DA_ROTA[item.href] && !modulos.carregando && !modulos.liberado(MODULO_DA_ROTA[item.href])
                  ? 'Ferramenta não contratada: clique para conhecer e solicitar'
                  : undefined
              }
            >
              {!interno && MODULO_DA_ROTA[item.href] && !modulos.carregando && !modulos.liberado(MODULO_DA_ROTA[item.href]) && (
                <span aria-label="não contratada">🔒</span>
              )}
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
          ))}
        </nav>

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
      {interno && <CelebracaoEstrelas />}
    </header>
  )
}
