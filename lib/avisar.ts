import { supabase } from '@/lib/supabase'

/*
 * Atalho do lado do navegador para pedir um disparo de e-mail. O envio
 * em si acontece no servidor; aqui só avisamos que algo aconteceu. Se
 * falhar, não atrapalha: o chamado já foi salvo.
 */
export async function avisar(
  evento: string,
  chamadoId: string,
  extra?: Record<string, unknown>
) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return
    }

    await fetch('/api/notificacoes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.access_token,
      },
      body: JSON.stringify({
        evento,
        chamado_id: chamadoId,
        ...(extra || {}),
      }),
    })
  } catch (erro) {
    console.error('Não foi possível disparar o aviso por e-mail:', erro)
  }
}
