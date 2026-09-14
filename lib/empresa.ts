import { supabase } from '@/lib/supabase'
import { obterMarca, type Marca } from '@/lib/marca'

export async function obterMarcaDaEmpresa(): Promise<Marca | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: perfil, error: perfilError } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil?.empresa_id) {
    console.error(
      'Não foi possível identificar a empresa do usuário:',
      perfilError
    )

    return null
  }

  const { data: empresa, error: empresaError } = await supabase
    .from('empresas')
    .select('marca')
    .eq('id', perfil.empresa_id)
    .single()

  if (empresaError || !empresa) {
    console.error(
      'Não foi possível identificar a marca da empresa:',
      empresaError
    )

    return null
  }

  return obterMarca(empresa.marca)
}
