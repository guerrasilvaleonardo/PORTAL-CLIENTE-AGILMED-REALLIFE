import { marcaDoDominio, obterMarca, type Marca } from '@/lib/marca'
import { empresaAtual, perfilAtual, usuarioAtual } from '@/lib/sessaoAtual'

/*
 * A marca da empresa de quem está logado.
 *
 * ANTES esta função fazia tudo sozinha: pedia o usuário, pedia o
 * perfil, pedia a empresa. Como vários componentes a chamam na mesma
 * tela, essas três viagens ao servidor saíam repetidas a cada carga de
 * página, junto com as do cabeçalho.
 *
 * Agora pergunta ao lib/sessaoAtual, que faz cada uma dessas perguntas
 * UMA VEZ por carga e empresta a resposta para quem chegar depois. O
 * comportamento é o mesmo, inclusive as quedas para a marca do
 * domínio quando algo não vem.
 */
export async function obterMarcaDaEmpresa(): Promise<Marca | null> {
  const usuario = await usuarioAtual()

  if (!usuario) {
    return null
  }

  const perfil = await perfilAtual()

  /*
   * Perfil ausente ou ilegível (RLS, cadastro incompleto), ou sem
   * empresa vinculada (equipe interna): a marca vem do domínio. Antes
   * disto o cabeçalho inteiro sumia e o cliente ficava sem o menu.
   */
  if (!perfil?.empresa_id) {
    return marcaDoDominio()
  }

  const empresa = await empresaAtual()

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
