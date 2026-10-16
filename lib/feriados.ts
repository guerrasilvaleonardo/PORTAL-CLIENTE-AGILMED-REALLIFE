/*
 * Calendário de feriados do SLA (tabela public.feriados).
 *
 * Carrega uma vez por sessão do navegador e entrega para lib/prazo.ts,
 * que deixa de contar hora útil nesses dias. Se a tabela ainda não
 * existir ou a leitura falhar, a conta segue sem feriados (como antes).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { definirFeriados } from '@/lib/prazo'

export type Feriado = {
  data: string
  descricao: string
  abrangencia: string
}

let carga: Promise<Feriado[]> | null = null

export function carregarFeriados(cliente: SupabaseClient, recarregar = false) {
  if (carga && !recarregar) return carga

  carga = (async () => {
    try {
      const { data, error } = await cliente
        .from('feriados')
        .select('data, descricao, abrangencia')
        .order('data')

      if (error) throw error

      const lista = (data || []) as Feriado[]

      definirFeriados(lista.map((f) => f.data))

      /* Lista vazia (ex.: sessão ainda sem login): tenta de novo depois. */
      if (!lista.length) carga = null

      return lista
    } catch (erro) {
      console.warn('Feriados não carregados; SLA sem feriados.', erro)
      carga = null
      return []
    }
  })()

  return carga
}
