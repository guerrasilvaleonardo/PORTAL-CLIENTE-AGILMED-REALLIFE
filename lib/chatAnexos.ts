'use client'

import { supabase } from '@/lib/supabase'

/*
 * Anexos do chat (supabase/conversas-audio-imagem.sql e
 * supabase/conversas-arquivos.sql): áudio gravado no navegador (até 2
 * minutos), imagem e arquivo (PDF, Word, Excel, PowerPoint, CSV, TXT),
 * até 10 MB. Ficam no armazenamento privado "chat-anexos", na pasta de
 * quem enviou; só os envolvidos na conversa abrem ou baixam, por link
 * temporário.
 */

export const BUCKET_CHAT = 'chat-anexos'
export const AUDIO_MAX_SEGUNDOS = 120
export const IMAGEM_MAX_BYTES = 10 * 1024 * 1024
export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']

/* Arquivos aceitos (mesmo limite de 10 MB). Executáveis e compactados ficam de fora. */
export const ARQUIVO_MAX_BYTES = 10 * 1024 * 1024
export const TIPOS_ARQUIVO: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
}
export const ACEITA_ARQUIVO = Object.keys(TIPOS_ARQUIVO).map((e) => '.' + e).join(',')

/* Extensão do nome do arquivo, em minúsculas ("" se não tiver). */
export function extensaoDoNome(nome: string) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(nome || '')
  return m ? m[1].toLowerCase() : ''
}

/* Valida o arquivo escolhido; devolve a mensagem de erro ou null. */
export function problemaDoArquivo(arquivo: File) {
  const ext = extensaoDoNome(arquivo.name)
  if (!TIPOS_ARQUIVO[ext]) return 'Tipo de arquivo não aceito. Envie PDF, Word, Excel, PowerPoint, CSV ou TXT.'
  if (arquivo.size > ARQUIVO_MAX_BYTES) return 'O arquivo passa de 10 MB.'
  if (arquivo.size === 0) return 'O arquivo está vazio.'
  return null
}

export function tamanhoTexto(bytes: number | null | undefined) {
  const b = Math.max(0, bytes || 0)
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB'
  return (b / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB'
}

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
  /* Arquivo com nome (PDF, Word…): tipo e extensão saem do nome. */
  const nome = arquivo instanceof File ? arquivo.name : ''
  const extNome = extensaoDoNome(nome)
  const doNome = extNome && TIPOS_ARQUIVO[extNome]
  const tipo = doNome || (arquivo.type || '').split(';')[0] || 'application/octet-stream'
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  const caminho = usuarioId + '/' + id + '.' + (doNome ? extNome : extensao(tipo))

  const { error } = await supabase.storage.from(BUCKET_CHAT).upload(caminho, arquivo, {
    contentType: tipo,
    upsert: false,
  })

  if (error) {
    if (/bucket|not found/i.test(error.message || '')) {
      throw new Error('Envio de anexos ainda não ativado (rodar supabase/conversas-audio-imagem.sql).')
    }
    if (/mime|type.*not supported|invalid.*type/i.test(error.message || '')) {
      throw new Error('Tipo de arquivo ainda não liberado no armazenamento (rodar supabase/conversas-arquivos.sql).')
    }
    throw new Error(error.message || 'Não foi possível enviar o arquivo.')
  }

  return caminho
}

/* Links temporários (1 hora), guardados para não pedir de novo a cada 8 s. */
const cache = new Map<string, { url: string; ate: number }>()

/*
 * Link temporário do anexo. Com `baixarComo`, o link força o download com
 * esse nome de arquivo (em vez de abrir no navegador).
 */
export async function linkDoAnexo(caminho: string, baixarComo?: string) {
  const chave = caminho + '|' + (baixarComo || '')
  const agora = Date.now()
  const c = cache.get(chave)
  if (c && c.ate > agora + 60_000) return c.url

  const { data, error } = await supabase.storage
    .from(BUCKET_CHAT)
    .createSignedUrl(caminho, 3600, baixarComo ? { download: baixarComo } : undefined)
  if (error || !data?.signedUrl) return null

  cache.set(chave, { url: data.signedUrl, ate: agora + 3600_000 })
  return data.signedUrl
}

export function duracaoTexto(segundos: number | null | undefined) {
  const s = Math.max(0, Math.round(segundos || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}
