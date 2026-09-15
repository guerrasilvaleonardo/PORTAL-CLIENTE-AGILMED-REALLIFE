import { supabase } from '@/lib/supabase'
import { obterMarca, type Marca } from '@/lib/marca'

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

  if (!perfil?.empresa_id) {
    console.error(
      'Usuário não possui empresa vinculada.'
    )

    return null
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
    console.error(
      'Empresa não possui marca configurada.'
    )

    return null
  }

  const marca = obterMarca(empresa.marca)

  if (!marca) {
    console.error(
      'Marca da empresa não reconhecida:',
      empresa.marca
    )

    return null
  }

  return marca
}
