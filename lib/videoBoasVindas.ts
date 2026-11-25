import { supabase } from '@/lib/supabase'

/*
 * Vídeo de boas-vindas do Portal do Cliente (o Lif explicando o portal).
 *
 * Regra: até a pessoa assistir o vídeo inteiro uma vez, ele abre sozinho
 * na tela Início e não deixa pular. Depois, só abre pelo botão, e aí pode
 * fechar quando quiser.
 *
 * Onde fica a marcação: na coluna profiles.video_boas_vindas_em
 * (supabase/video-boas-vindas.sql). Enquanto o SQL não rodar, a coluna
 * não existe (erro 42703) e a marcação fica só no navegador, para a tela
 * continuar funcionando.
 */

export const VIDEO_BOAS_VINDAS = {
  src: '/videos/portal-do-cliente.mp4',
  legendas: '/videos/portal-do-cliente.vtt',
  capa: '/videos/portal-do-cliente-capa.jpg',
}

const chaveLocal = (usuarioId: string) => 'video-boas-vindas:' + usuarioId

function lerLocal(usuarioId: string) {
  try {
    return window.localStorage.getItem(chaveLocal(usuarioId)) === '1'
  } catch {
    return false
  }
}

function gravarLocal(usuarioId: string) {
  try {
    window.localStorage.setItem(chaveLocal(usuarioId), '1')
  } catch {
    /* navegador sem armazenamento: o banco é que vale */
  }
}

/* true = já assistiu até o fim; não precisa abrir sozinho. */
export async function jaAssistiuBoasVindas(usuarioId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('video_boas_vindas_em')
    .eq('id', usuarioId)
    .single()

  if (error) {
    /* Coluna ainda não criada (SQL pendente) ou falha de leitura:
       decide pelo navegador. Na dúvida, não trava o cliente de novo. */
    return lerLocal(usuarioId)
  }

  if (data?.video_boas_vindas_em) return true

  /* Viu antes do SQL rodar: leva a marcação para o banco. */
  if (lerLocal(usuarioId)) {
    await marcarBoasVindasAssistido(usuarioId)
    return true
  }

  return false
}

export async function marcarBoasVindasAssistido(usuarioId: string) {
  gravarLocal(usuarioId)
  const { error } = await supabase.rpc('marcar_video_boas_vindas')
  if (error) {
    console.warn('Vídeo de boas-vindas: marcação ficou só no navegador.', error.message)
  }
}
