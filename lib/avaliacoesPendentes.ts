'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Chamados que o usuário logado ainda pode avaliar.
 *
 * Mesma regra do banco (avaliacao_situacao / avaliar_chamado):
 * só quem ABRIU o chamado, com perfil cliente, chamado Resolvido ou
 * Encerrado, sem avaliação, dentro do prazo configurado no programa.
 * A decisão final é sempre do banco: aqui só pré-filtramos e
 * confirmamos chamado a chamado com avaliacao_situacao.
 */

export type AvaliacaoPendente = {
  id: string
  numero: number
  assunto: string
  status: string
  avaliarAte: string | null
}

/* Limite de leitura: os mais recentes primeiro. Prazo de avaliação é curto. */
const LIMITE = 40

export function useAvaliacoesPendentes(ativo = true) {
  const [pendentes, setPendentes] = useState<AvaliacaoPendente[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    if (!ativo) return

    let vivo = true

    async function carregar() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: chamados, error } = await supabase
          .from('chamados')
          .select('id, numero, assunto, status')
          .eq('criado_por', user.id)
          .in('status', ['resolvido', 'encerrado'])
          .order('updated_at', { ascending: false })
          .limit(LIMITE)

        if (error || !chamados || chamados.length === 0) return

        const ids = chamados.map((c) => c.id)

        const { data: avaliados } = await supabase
          .from('chamado_avaliacoes')
          .select('chamado_id')
          .in('chamado_id', ids)

        const jaAvaliados = new Set((avaliados || []).map((a) => a.chamado_id))
        const candidatos = chamados.filter((c) => !jaAvaliados.has(c.id))

        const situacoes = await Promise.all(
          candidatos.map(async (c) => {
            const { data, error: erroRpc } = await supabase.rpc('avaliacao_situacao', {
              p_chamado: c.id,
            })

            if (erroRpc || !data?.pode_avaliar) return null

            return {
              id: c.id,
              numero: c.numero,
              assunto: c.assunto,
              status: c.status,
              avaliarAte: (data.avaliar_ate as string | null) || null,
            } satisfies AvaliacaoPendente
          })
        )

        if (!vivo) return

        setPendentes(
          situacoes
            .filter((s): s is AvaliacaoPendente => s !== null)
            /* Quem vence primeiro aparece primeiro; sem prazo vai para o fim. */
            .sort((a, b) => {
              if (!a.avaliarAte) return 1
              if (!b.avaliarAte) return -1
              return a.avaliarAte.localeCompare(b.avaliarAte)
            })
        )
      } catch (erro) {
        /* Pendência é um lembrete: se falhar, a tela segue normal. */
        console.error('Erro ao carregar avaliações pendentes:', erro)
      } finally {
        if (vivo) setCarregado(true)
      }
    }

    carregar()

    return () => {
      vivo = false
    }
  }, [ativo])

  return { pendentes, carregado }
}
