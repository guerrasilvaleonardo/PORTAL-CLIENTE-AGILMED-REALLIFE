'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Chamados com mensagens novas para quem está logado
 * (supabase/chamados-leitura.sql: chamados_nao_lidos).
 *
 * Cliente: todos os chamados que ele vê. Equipe: os chamados em que é
 * responsável, abriu ou é solicitante. Atualiza a cada 20 s, ao voltar
 * para a aba e quando um chamado é aberto (evento 'chamados-lidos').
 * Se o SQL ainda não rodou, devolve vazio e nada aparece.
 */

export function useChamadosNaoLidos(ativo: boolean) {
  const [novas, setNovas] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!ativo) return

    let vivo = true

    async function contar() {
      try {
        const { data, error } = await supabase.rpc('chamados_nao_lidos')

        if (error || !vivo) return

        const mapa: Record<string, number> = {}

        for (const linha of (data || []) as { chamado_id: string; novas: number }[]) {
          mapa[linha.chamado_id] = linha.novas
        }

        setNovas(mapa)
      } catch (erro) {
        console.error('Erro ao contar chamados com mensagens novas:', erro)
      }
    }

    contar()

    const relogio = setInterval(contar, 20000)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') contar()
    }

    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('chamados-lidos', contar)

    return () => {
      vivo = false
      clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('chamados-lidos', contar)
    }
  }, [ativo])

  return novas
}

/* Marca o chamado como lido por quem está logado e avisa o cabeçalho. */
export async function marcarChamadoLido(chamadoId: string) {
  try {
    const { error } = await supabase.rpc('marcar_chamado_lido', { p_chamado: chamadoId })

    if (!error) window.dispatchEvent(new Event('chamados-lidos'))
  } catch {
    /* Recurso opcional: sem o SQL, segue sem marcar. */
  }
}
