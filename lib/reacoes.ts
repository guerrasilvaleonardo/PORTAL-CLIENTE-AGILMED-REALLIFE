/*
 * Reações com emoji (supabase/nomes-e-reacoes.sql): uma por pessoa em cada
 * mensagem. Tabelas: chamado_mensagem_reacoes (chamados) e chat_reacoes
 * (Conversas). Tolerante: sem as tabelas, a tela segue sem reações.
 */
import { supabase } from '@/lib/supabase'

export const EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '✅'] as const

export type Reacao = { mensagem_id: string; usuario_id: string; emoji: string }
export type TabelaReacao = 'chamado_mensagem_reacoes' | 'chat_reacoes'

export async function carregarReacoes(tabela: TabelaReacao, ids: string[]): Promise<Reacao[]> {
  const unicos = [...new Set(ids.filter(Boolean))]
  const todas: Reacao[] = []
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await supabase
      .from(tabela)
      .select('mensagem_id, usuario_id, emoji')
      .in('mensagem_id', unicos.slice(i, i + 100))
    if (error) return []
    todas.push(...((data || []) as Reacao[]))
  }
  return todas
}

/* Mesma reação de novo = retira; outra = troca. */
export async function reagir(tabela: TabelaReacao, mensagemId: string, meuId: string, emoji: string, atual: string | null) {
  if (atual === emoji) {
    const { error } = await supabase.from(tabela).delete().eq('mensagem_id', mensagemId).eq('usuario_id', meuId)
    if (error) throw error
    return null
  }
  const { error } = await supabase
    .from(tabela)
    .upsert({ mensagem_id: mensagemId, usuario_id: meuId, emoji }, { onConflict: 'mensagem_id,usuario_id' })
  if (error) throw error
  return emoji
}

/* Aplica a mudança na lista local, sem esperar recarregar. */
export function aplicarReacao(lista: Reacao[], mensagemId: string, meuId: string, emoji: string | null): Reacao[] {
  const sem = lista.filter((r) => !(r.mensagem_id === mensagemId && r.usuario_id === meuId))
  return emoji ? [...sem, { mensagem_id: mensagemId, usuario_id: meuId, emoji }] : sem
}
