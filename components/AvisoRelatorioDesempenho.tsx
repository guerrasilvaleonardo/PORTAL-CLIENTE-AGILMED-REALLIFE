'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/*
 * Relatório de desempenho liberado pela direção e ainda sem ciência
 * (supabase/desempenho-ciencia.sql). Aparece só para a própria pessoa.
 * Sem o SQL instalado, a consulta falha e o aviso simplesmente não aparece.
 */
export default function AvisoRelatorioDesempenho() {
  const [pendentes, setPendentes] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) return
      const { count, error } = await supabase
        .from('desempenho_publicacoes')
        .select('id', { count: 'exact', head: true })
        .eq('pessoa_id', uid)
        .is('revogado_em', null)
        .is('ciente_em', null)
      if (vivo) setPendentes(!error && count ? count : 0)
    })()
    return () => {
      vivo = false
    }
  }, [pathname])

  if (!pendentes || pathname?.startsWith('/meu-desempenho')) return null

  return (
    <div
      role="status"
      className="nao-imprimir"
      style={{
        background: '#e0f2fe',
        color: '#075985',
        borderBottom: '1px solid #7dd3fc',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
        padding: '7px 14px',
      }}
    >
      📄 {pendentes === 1 ? 'Seu relatório de desempenho foi liberado' : `${pendentes} relatórios de desempenho foram liberados`} pela
      direção.{' '}
      <Link href="/meu-desempenho" style={{ color: 'inherit', textDecoration: 'underline' }}>
        Ler e registrar ciência
      </Link>
    </div>
  )
}
