import { supabase } from '@/lib/supabase'

/*
 * Vídeo de boas-vindas do Portal do Cliente (o Lif explicando o portal).
 *
 * Regra: até a pessoa assistir o vídeo inteiro UMA vez, ele abre sozinho
 * na tela Início e não deixa pular. Depois, nunca mais abre sozinho (em
 * nenhum navegador ou aparelho); só pelo botão, e aí pode fechar quando
 * quiser.
 *
 * Onde fica a marcação de "já assistiu" (vale a primeira que existir):
 *   1. profiles.video_boas_vindas_em (supabase/video-boas-vindas.sql);
 *   2. metadados da conta no Supabase Auth (user_metadata), que funcionam
 *      mesmo antes do SQL rodar e acompanham a pessoa em qualquer aparelho;
 *   3. navegador (localStorage), como última reserva.
 *
 * Se o vídeo não carregar, ele não volta a abrir sozinho na mesma sessão
 * do navegador (sessionStorage), mas continua obrigatório até ser
 * assistido até o fim.
 */

export const VIDEO_BOAS_VINDAS = {
  src: '/videos/portal-do-cliente.mp4',
  legendas: '/videos/portal-do-cliente.vtt',
  capa: '/videos/portal-do-cliente-capa.jpg',
}

const CAMPO_METADADOS = 'video_boas_vindas_em'
const chaveLocal = (usuarioId: string) => 'video-boas-vindas:' + usuarioId
const chaveSessao = (usuarioId: string) => 'video-boas-vindas-adiado:' + usuarioId

function ler(armazem: 'local' | 'sessao', chave: string) {
  try {
    const s = armazem === 'local' ? window.localStorage : window.sessionStorage
    return s.getItem(chave) === '1'
  } catch {
    return false
  }
}

function gravar(armazem: 'local' | 'sessao', chave: string) {
  try {
    const s = armazem === 'local' ? window.localStorage : window.sessionStorage
    s.setItem(chave, '1')
  } catch {
    /* navegador sem armazenamento: o banco e a conta é que valem */
  }
}

async function marcadoNaConta(usuarioId: string): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    return !!(user && user.id === usuarioId && user.user_metadata?.[CAMPO_METADADOS])
  } catch {
    return false
  }
}

/* true = já assistiu até o fim (ou adiado nesta sessão por falha); não abre sozinho. */
export async function jaAssistiuBoasVindas(usuarioId: string): Promise<boolean> {
  if (ler('sessao', chaveSessao(usuarioId))) return true

  const naConta = await marcadoNaConta(usuarioId)
  const noNavegador = ler('local', chaveLocal(usuarioId))

  const { data, error } = await supabase
    .from('profiles')
    .select('video_boas_vindas_em')
    .eq('id', usuarioId)
    .single()

  const noBanco = !error && !!data?.video_boas_vindas_em

  if (noBanco || naConta || noNavegador) {
    /* Alguma marcação faltando (ex.: viu antes do SQL rodar): completa. */
    if (!noBanco || !naConta || !noNavegador) {
      void marcarBoasVindasAssistido(usuarioId, { banco: !error && !noBanco, conta: !naConta })
    }
    return true
  }

  return false
}

export async function marcarBoasVindasAssistido(
  usuarioId: string,
  onde: { banco?: boolean; conta?: boolean } = { banco: true, conta: true },
) {
  gravar('local', chaveLocal(usuarioId))

  if (onde.banco !== false) {
    const { error } = await supabase.rpc('marcar_video_boas_vindas')
    if (error) console.warn('Vídeo de boas-vindas: marcação no banco falhou.', error.message)
  }

  if (onde.conta !== false) {
    const { error } = await supabase.auth.updateUser({
      data: { [CAMPO_METADADOS]: new Date().toISOString() },
    })
    if (error) console.warn('Vídeo de boas-vindas: marcação na conta falhou.', error.message)
  }
}

/* Vídeo não carregou: não reabre sozinho até fechar o navegador. */
export function adiarBoasVindasNestaSessao(usuarioId: string) {
  gravar('sessao', chaveSessao(usuarioId))
}
