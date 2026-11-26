import { supabase } from '@/lib/supabase'

/*
 * Quem decide no Programa de Estrelas (estornar, restabelecer, decidir
 * prazo, configurar, fechar o ano, acompanhamento): só quem tem
 * profiles.pode_decidir_estrelas (hoje, só o Leonardo).
 * Ver supabase/estrelas-decisao-so-autorizado.sql.
 *
 * Retorna null quando a coluna ainda não existe (SQL pendente): a tela
 * usa a regra antiga (gestor/admin), que é também a do banco nesse caso.
 */
export async function podeDecidirEstrelas(usuarioId: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('pode_decidir_estrelas')
    .eq('id', usuarioId)
    .maybeSingle()
  if (error) return null
  return (data as { pode_decidir_estrelas?: boolean } | null)?.pode_decidir_estrelas === true
}
