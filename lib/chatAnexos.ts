'use client'

import { supabase } from '@/lib/supabase'

/*
 * Anexos do chat (supabase/conversas-audio-imagem.sql): áudio gravado no
 * navegador (até 2 minutos) e imagem (até 10 MB). Ficam no armazenamento
 * privado "chat-anexos", na pasta de quem enviou; só os envolvidos na
 * conversa abrem, por link temporário.
 */

export const BUCKET_CHAT = 'chat-anexos'
export const AUDIO_MAX_SEGUNDOS = 120
export const IMAGEM_MAX_BYTES = 10 * 1024 * 1024
export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']

/* Formato de gravação que o navegador suporta (Chrome/Firefox: webm; Safari: mp4). */
export function formatoAudio() {
  const opcoes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  if (typeof MediaRecorder === 'undefined') return null
  return opcoes.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

function extensao(tipo: string) {
  if (tipo.includes('webm')) return 'webm'
  if (tipo.includes('mp4')) return 'm4a'
  if (tipo.includes('ogg')) return 'ogg'
  if (tipo.includes('jpeg')) return 'jpg'
  if (tipo.includes('png')) return 'png'
  if (tipo.includes('webp')) return 'webp'
  return 'bin'
}

export async function enviarAnexoChat(usuarioId: string, arquivo: Blob) {
  const tipo = (arquivo.type || '').split(';')[0] || 'application/octet-stream'
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  const caminho = usuarioId + '/' + id + '.' + extensao(tipo)

  const { error } = await supabase.storage.from(BUCKET_CHAT).upload(caminho, arquivo, {
    contentType: tipo,
    upsert: false,
  })

  if (error) {
    if (/bucket|not found/i.test(error.message || '')) {
      throw new Error('Envio de áudio e imagem ainda não ativado (rodar supabase/conversas-audio-imagem.sql).')
    }
    throw new Error(error.message || 'Não foi possível enviar o arquivo.')
  }

  return caminho
}

/* Links temporários (1 hora), guardados para não pedir de novo a cada 8 s. */
const cache = new Map<string, { url: string; ate: number }>()

export async function linkDoAnexo(caminho: string) {
  const agora = Date.now()
  const c = cache.get(caminho)
  if (c && c.ate > agora + 60_000) return c.url

  const { data, error } = await supabase.storage.from(BUCKET_CHAT).createSignedUrl(caminho, 3600)
  if (error || !data?.signedUrl) return null

  cache.set(caminho, { url: data.signedUrl, ate: agora + 3600_000 })
  return data.signedUrl
}

export function duracaoTexto(segundos: number | null | undefined) {
  const s = Math.max(0, Math.round(segundos || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}
