import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  enviarEmail,
  montarEmail,
  marcaDaEmpresa,
  enderecoDoPortal,
  formatarData,
} from '@/lib/email'

/*
 * Avisa por e-mail quem recebeu uma não conformidade.
 *
 * MOTIVO: pedido dele em 21/11/2026, junto com a voz e o QR. A não
 * conformidade já nascia com dono e prazo, e o dono não ficava
 * sabendo: esperava alguém abrir o portal e contar. Prazo que ninguém
 * conhece é prazo que vence.
 *
 * POR QUE NO SERVIDOR. A chave do Resend não pode chegar ao navegador.
 * E o e-mail do responsável também não: a tela manda o id do registro,
 * e é aqui que se descobre para quem mandar.
 *
 * QUEM PODE DISPARAR. Só quem está autenticado e enxerga aquela não
 * conformidade pelas políticas do banco — a leitura é feita com o
 * token de quem pediu, não com a chave de serviço. A chave de serviço
 * entra só para ler o e-mail do destinatário, que a política de
 * profiles não precisa expor à tela.
 *
 * NÃO AVISA OPORTUNIDADE DE MELHORIA. Nada está errado, ninguém tem
 * prazo, e e-mail de cobrança por uma sugestão é o jeito mais rápido
 * de acabar com as sugestões.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const GRAVIDADES: Record<string, string> = {
  baixa: 'baixa',
  media: 'média',
  alta: 'alta',
  critica: 'crítica',
}

function clienteDoPedido(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.replace('Bearer ', '').trim()
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  })
}

export async function POST(request: Request) {
  const supabase = clienteDoPedido(request)
  if (!supabase) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  let corpo: any = {}
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 })
  }

  const id = String(corpo?.id || '')
  if (!id) {
    return NextResponse.json({ erro: 'Informe o registro.' }, { status: 400 })
  }

  /* Lido com o token de quem pediu: quem não enxerga o registro pelas
     políticas do banco também não consegue disparar aviso sobre ele. */
  const { data: nc, error } = await supabase
    .from('nao_conformidades')
    .select(
      'id, empresa_id, descricao, gravidade, prazo, local_nome, classificacao, responsavel_id, responsavel_nome'
    )
    .eq('id', id)
    .single()

  if (error || !nc) {
    return NextResponse.json({ erro: 'Registro não encontrado.' }, { status: 404 })
  }

  if ((nc as any).classificacao === 'oportunidade') {
    return NextResponse.json({ enviado: false, motivo: 'oportunidade nao avisa' })
  }

  const responsavelId = (nc as any).responsavel_id
  if (!responsavelId) {
    return NextResponse.json({ enviado: false, motivo: 'sem responsavel no portal' })
  }

  const { data: pessoa } = await supabaseAdmin
    .from('profiles')
    .select('nome, email')
    .eq('id', responsavelId)
    .maybeSingle()

  const destino = String((pessoa as any)?.email || '').trim()
  if (!destino) {
    return NextResponse.json({ enviado: false, motivo: 'responsavel sem e-mail' })
  }

  const { data: empresa } = await supabaseAdmin
    .from('empresas')
    .select('razao_social, nome_fantasia, marca')
    .eq('id', (nc as any).empresa_id)
    .maybeSingle()

  const marca = marcaDaEmpresa((empresa as any)?.marca)
  const portal = enderecoDoPortal(marca)
  const nomeEmpresa =
    (empresa as any)?.nome_fantasia || (empresa as any)?.razao_social || 'sua empresa'

  const prazo = (nc as any).prazo
  const paragrafos = [
    `Olá, ${(pessoa as any)?.nome || 'tudo bem'}.`,
    `Uma não conformidade foi registrada em <strong>${nomeEmpresa}</strong> e ficou sob a sua responsabilidade.`,
    `<strong>O que foi apontado:</strong> ${(nc as any).descricao}`,
    (nc as any).local_nome ? `<strong>Local:</strong> ${(nc as any).local_nome}` : '',
    `<strong>Gravidade:</strong> ${GRAVIDADES[(nc as any).gravidade] || (nc as any).gravidade}`,
    prazo
      ? `<strong>Prazo para tratar:</strong> ${formatarData(prazo)}`
      : 'Ainda <strong>sem prazo definido</strong> — combine um ao abrir o registro.',
    'No portal você escreve a ação imediata, a causa e a ação corretiva. O registro só fecha depois de alguém verificar que a ação funcionou.',
  ].filter(Boolean)

  const html = montarEmail(
    marca,
    'Uma não conformidade está no seu nome',
    paragrafos,
    { rotulo: 'Abrir no portal', url: portal + '/inspecoes/nc' },
    prazo ? 'Você receberá este aviso uma vez; o acompanhamento é pelo portal.' : undefined
  )

  const resultado = await enviarEmail({
    para: [destino],
    assunto: `Não conformidade no seu nome — ${nomeEmpresa}`,
    html,
    marca,
  })

  return NextResponse.json(resultado)
}
