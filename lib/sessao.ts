import { supabase } from '@/lib/supabase'

/*
 * Proteção contra a tela presa em "Carregando portal...".
 *
 * Quando o login salvo no navegador já expirou, o Supabase tenta
 * renová-lo antes de responder. Se essa renovação não tiver resposta
 * (aba que ficou horas parada, rede instável), as chamadas de
 * autenticação ficam esperando para sempre e a página nunca sai do
 * carregamento. Aqui damos um limite de tempo a essas esperas e, se
 * estourar, mandamos a pessoa entrar de novo.
 */

export const LIMITE_SESSAO_MS = 8000

export class TempoEsgotadoError extends Error {
  constructor() {
    super('Tempo esgotado ao verificar a sessão.')
    this.name = 'TempoEsgotadoError'
  }
}

export function comLimiteDeTempo<T>(
  promessa: PromiseLike<T>,
  ms: number = LIMITE_SESSAO_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TempoEsgotadoError()),
      ms
    )

    Promise.resolve(promessa).then(
      (valor) => {
        clearTimeout(timer)
        resolve(valor)
      },
      (erro) => {
        clearTimeout(timer)
        reject(erro)
      }
    )
  })
}

/*
 * Encerra só a sessão deste navegador e leva para o login com o aviso
 * de sessão expirada. Não mexe em nenhum dado do banco.
 */
export async function irParaLoginSessaoExpirada() {
  try {
    await comLimiteDeTempo(
      supabase.auth.signOut({ scope: 'local' }),
      3000
    )
  } catch {
    // Se nem o signOut responder, limpamos o token salvo manualmente.
  }

  try {
    Object.keys(window.localStorage)
      .filter(
        (chave) =>
          chave.startsWith('sb-') && chave.endsWith('-auth-token')
      )
      .forEach((chave) => window.localStorage.removeItem(chave))
  } catch {
    // Armazenamento indisponível: segue para o login mesmo assim.
  }

  window.location.replace('/login?sessao=expirada')
}
