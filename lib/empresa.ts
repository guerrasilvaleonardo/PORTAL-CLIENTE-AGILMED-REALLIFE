import { supabase } from '@/lib/supabase'
import { marcaDoDominio, obterMarca, type Marca } from '@/lib/marca'

export async function obterMarcaDaEmpresa(): Promise<Marca | null> {
  const {
    data: { user },
    error: usuarioError,
  } = await supabase.auth.getUser()

  if (usuarioError) {
    console.error(
      'Erro ao identificar usuário autenticado:',
      usuarioError
    )

    return null
  }

  if (!user) {
    return null
  }

  const { data: perfil, error: perfilError } =
    await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('id', user.id)
      .single()

  if (perfilError) {
    console.error(
      'Erro ao consultar perfil do usuário:',
      perfilError
    )

    return null
  }

  /*
   * Sem empresa vinculada (equipe interna), a marca vem do domínio.
   */
  if (!perfil?.empresa_id) {
    return marcaDoDominio()
  }

  const { data: empresa, error: empresaError } =
    await supabase
      .from('empresas')
      .select('marca')
      .eq('id', perfil.empresa_id)
      .single()

  if (empresaError) {
    console.error(
      'Erro ao consultar empresa do usuário:',
      empresaError
    )

    return null
  }

  if (!empresa?.marca) {
    return marcaDoDominio()
  }

  const marca = obterMarca(empresa.marca)

  if (!marca) {
    return marcaDoDominio()
  }

  return marca
}

/*
 * Nome de exibição de uma empresa, em um lugar só.
 *
 * Nem toda empresa tem nome fantasia: algumas foram cadastradas só com
 * a razão social. Quando a tela usava apenas nome_fantasia, essas
 * empresas apareciam como uma linha em branco no meio da lista — e a
 * pessoa concluía, com razão, que a empresa não estava lá.
 */
export function nomeDaEmpresa(
  empresa:
    | {
        nome_fantasia?: string | null
        razao_social?: string | null
      }
    | null
    | undefined,
  quandoVazio = 'Sem nome'
) {
  const fantasia = (empresa?.nome_fantasia || '').trim()

  if (fantasia) return fantasia

  const razao = (empresa?.razao_social || '').trim()

  if (razao) return razao

  return quandoVazio
}
