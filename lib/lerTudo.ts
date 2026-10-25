/*
 * Le todas as linhas de uma consulta do Supabase, pagina por pagina.
 *
 * O Supabase (PostgREST) devolve no maximo 1000 linhas por consulta.
 * Sem paginar, a lista para em 1000 registros sem nenhum aviso: foi o
 * que aconteceu em Certificados quando o portal passou de 1000.
 *
 * `montar` deve criar a consulta do zero a cada chamada (com select,
 * filtros e ordenacao). Para a paginacao nao repetir nem pular linhas,
 * a ordenacao precisa terminar num campo unico (ex.: .order('id')).
 *
 * Devolve { data, error } no mesmo formato do Supabase, para o codigo
 * que ja trata erros (inclusive o 42703 de coluna ausente) continuar
 * funcionando igual.
 */
export const PAGINA_SUPABASE = 1000

export async function lerTudo<T = any>(
  montar: () => any,
  limite = 200000
): Promise<{ data: T[] | null; error: any }> {
  const tudo: T[] = []

  for (let de = 0; de < limite; de += PAGINA_SUPABASE) {
    const { data, error } = await montar().range(de, de + PAGINA_SUPABASE - 1)

    if (error) return { data: null, error }

    tudo.push(...((data || []) as T[]))

    if (!data || data.length < PAGINA_SUPABASE) break
  }

  return { data: tudo, error: null }
}
