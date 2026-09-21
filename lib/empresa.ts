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
