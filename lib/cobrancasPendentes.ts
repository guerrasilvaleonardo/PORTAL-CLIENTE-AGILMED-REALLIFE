'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Chamados parados em "Aguardando cliente" além do prazo de cobrança da
 * empresa (supabase/chamados-cobranca-e-suspensao.sql:
 * cobrancas_pendentes). O banco só devolve chamados que quem está
 * logado já enxerga. Se o SQL ainda não rodou, devolve vazio.
 */

export type CobrancaPendente = {
  id: string
  numero: number
  assunto: string
  aguardandoDesde: string
  dias: number
  limiteDias: number
}

export function useCobrancasPendentes(ativo: boolean) {
  const [cobrancas, setCobrancas] = useState<CobrancaPendente[]>([])

  useEffect(() => {
    if (!ativo) return

    let vivo = true

    async function carregar() {
      try {
        const { data, error } = await supabase.rpc('cobrancas_pendentes')

        if (error || !vivo) return

        setCobrancas(
          ((data || []) as any[]).map((c) => ({
            id: c.id,
            numero: c.numero,
            assunto: c.assunto,
            aguardandoDesde: c.aguardando_desde,
            dias: c.dias,
            limiteDias: c.limite_dias,
          }))
        )
      } catch (erro) {
        /* Aviso é um lembrete: se falhar, a tela segue normal. */
        console.error('Erro ao carregar cobranças pendentes:', erro)
      }
    }

    carregar()

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') carregar()
    }

    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [ativo])

  return cobrancas
}
