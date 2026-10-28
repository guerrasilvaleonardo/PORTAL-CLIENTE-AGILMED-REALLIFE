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

    /*
     * Falha passageira na sessão não pode sumir com o menu: usa a
     * marca do domínio. Sem sessão de verdade, o cabeçalho manda
     * para o login (user vazio, logo abaixo).
     */
    return marcaDoDominio()
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

    /*
     * Perfil ausente ou ilegível (RLS, cadastro incompleto): antes o
     * cabeçalho inteiro sumia e o cliente ficava sem o menu. Agora o
     * menu aparece com a marca do domínio; o erro fica no console.
     */
    return marcaDoDominio()
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

    /* Empresa ativa que a pessoa não consegue ler: menu com a marca do domínio. */
    return marcaDoDominio()
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
