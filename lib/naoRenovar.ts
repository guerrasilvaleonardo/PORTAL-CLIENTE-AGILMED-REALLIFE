import type { SupabaseClient } from '@supabase/supabase-js'
import { lerTudo } from '@/lib/lerTudo'

/*
 * Certificados marcados "O treinamento não será realizado novamente"
 * (supabase/certificados-nao-renovar.sql). Ficam no cadastro, mas não são
 * vencidos nem a vencer: saem dos cartões, do painel e dos e-mails de
 * vencimento.
 *
 * Falha aberta: sem as colunas (SQL não rodou), devolve um conjunto vazio e
 * nada muda.
 */
export async function idsNaoRenovar(cliente: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await lerTudo<{ id: string }>(() =>
    cliente.from('certificados').select('id').eq('nao_renovar', true).order('id')
  )

  if (error || !data) return new Set()

  return new Set(data.map((c) => c.id))
}
