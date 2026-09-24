'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { marcas, type Marca } from '@/lib/marca'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

export default function PortalHeader() {
  const pathname = usePathname()

  const [marca, setMarca] = useState<Marca | null>(null)
  const [interno, setInterno] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setCarregando(true)

        const {
          data: { user },
        } = await supabase.auth.getUser()

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

        const { data: perfil } = await supabase
          .from('profiles')
          .select('perfil')
          .eq('id', user.id)
          .single()

        const marcaEmpresa = await obterMarcaDaEmpresa()

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

        if (ativo) {
          setMarca(null)
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
        { href: '/chamados', rotulo: 'Chamados' },
        { href: '/certificados', rotulo: 'Certificados' },
        { href: '/equipe', rotulo: 'Chat da equipe' },
      ]
    : [
        { href: '/', rotulo: 'Início' },
        { href: '/chamados', rotulo: 'Chamados' },
        { href: '/certificados', rotulo: 'Certificados' },
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

        <div className="topbar-spacer" />

        <nav className="modtabs">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={ativo(item.href) ? 'active' : ''}
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="btn btn-ghost btn-sm"
        >
          {saindo ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </header>
  )
}
