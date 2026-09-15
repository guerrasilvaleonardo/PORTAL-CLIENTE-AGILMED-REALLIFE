'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { marcas, type Marca } from '@/lib/marca'

export default function PortalHeader() {
  const pathname = usePathname()

  const [marca, setMarca] = useState<Marca | null>(null)
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregarMarca() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (ativo) {
          setMarca(null)
        }

        return
      }

      const marcaEmpresa = await obterMarcaDaEmpresa()

      if (ativo) {
        setMarca(marcaEmpresa)
      }
    }

    carregarMarca()

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
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) =>
          setTimeout(resolve, 3000)
        ),
      ])
    } catch (erro) {
      console.error(
        'Erro ao encerrar sessão:',
        erro
      )
    } finally {
      window.location.replace('/login')
    }
  }

  if (pathname === '/login') {
    return null
  }

  if (!marca) {
    return null
  }

  const tema = marcas[marca]

  return (
    <header
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <strong
            style={{
              color: tema.dark,
              fontSize: '20px',
              lineHeight: 1.2,
            }}
          >
            {tema.nome}
          </strong>

          <span
            style={{
              color: '#64748b',
              fontSize: '12px',
            }}
          >
            Portal do Cliente
          </span>
        </Link>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Link
            href="/"
            style={{
              padding: '9px 12px',
              borderRadius: '9px',
              color:
                pathname === '/'
                  ? tema.principal
                  : '#475569',
              background:
                pathname === '/'
                  ? tema.fundo
                  : 'transparent',
              fontSize: '14px',
              fontWeight:
                pathname === '/' ? 700 : 500,
              textDecoration: 'none',
            }}
          >
            Início
          </Link>

          <Link
            href="/chamados"
            style={{
              padding: '9px 12px',
              borderRadius: '9px',
              color: pathname.startsWith('/chamados')
                ? tema.principal
                : '#475569',
              background: pathname.startsWith('/chamados')
                ? tema.fundo
                : 'transparent',
              fontSize: '14px',
              fontWeight: pathname.startsWith('/chamados')
                ? 700
                : 500,
              textDecoration: 'none',
            }}
          >
            Chamados
          </Link>

          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            style={{
              border: 'none',
              padding: '9px 12px',
              borderRadius: '9px',
              background: 'transparent',
              color: '#64748f',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saindo ? 'wait' : 'pointer',
            }}
          >
            {saindo ? 'Saindo...' : 'Sair'}
          </button>
        </nav>
      </div>
    </header>
  )
}
