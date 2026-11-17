import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { TERMO_ENTREGA_EPI } from '@/lib/epiTermo'

export const dynamic = 'force-dynamic'

/*
 * ASSINATURA DA ENTREGA DE EPI (supabase/epi-entregas.sql)
 *
 * O trabalhador não tem conta no portal: ele abre o QR que aparece na
 * tela de quem entregou, ou o link que chega por e-mail. Por isso esta
 * rota é aberta — e, como a de abertura de chamado pelo site, ela:
 *   - aceita só um token de 32 hex, o que a entrega gerou;
 *   - exige o CPF da pessoa para assinar, então o link sozinho não basta;
 *   - devolve só o que a pessoa precisa ver para decidir se assina;
 *   - limita as tentativas de CPF por token, contra quem fique chutando;
 *   - nunca aceita assinar duas vezes nem entrega cancelada.
 *
 * A gravação passa pela chave de serviço porque não existe política para
 * anônimo nas tabelas do módulo — o banco continua fechado.
 */

const TOKEN = /^[0-9a-f]{32}$/
const MAX_TENTATIVAS = 5
const JANELA_MS = 15 * 60 * 1000

/* Tentativas de CPF por token, na memória da instância. */
const tentativas = new Map<string, { n: number; ate: number }>()

function erradoDemais(token: string): boolean {
  const agora = Date.now()
  const r = tentativas.get(token)
  if (!r || r.ate < agora) return false
  return r.n >= MAX_TENTATIVAS
}

function marcarErro(token: string) {
  const agora = Date.now()
  const r = tentativas.get(token)
  if (!r || r.ate < agora) tentativas.set(token, { n: 1, ate: agora + JANELA_MS })
  else r.n += 1
}

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

/* Primeiro nome e inicial do sobrenome: confirma sem expor a pessoa toda. */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[partes.length - 1][0]}.`
}

async function buscar(token: string) {
  const { data, error } = await supabaseAdmin
    .from('epi_entregas')
    .select(
      'id, token, entregue_em, assinado_em, cancelada_em, entregue_por_nome, ' +
        'colaboradores(nome, cpf, funcao, empresa_id), ' +
        'empresas(razao_social, nome_fantasia), ' +
        'epi_entregas_itens(nome, ca, complemento, quantidade, troca_em, motivo)'
    )
    .eq('token', token)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
  return {
    ...(data as any),
    colaboradores: um((data as any).colaboradores),
    empresas: um((data as any).empresas),
  }
}

/* GET /api/publico/assinatura-epi?token=... — o que o trabalhador vê. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') || ''
  if (!TOKEN.test(token)) {
    return NextResponse.json({ erro: 'Link inválido.' }, { status: 400 })
  }

  try {
    const e = await buscar(token)
    if (!e) return NextResponse.json({ erro: 'Este link não existe mais.' }, { status: 404 })

    const empresa = e.empresas?.nome_fantasia || e.empresas?.razao_social || ''

    return NextResponse.json({
      empresa,
      trabalhador: nomeCurto(e.colaboradores?.nome || ''),
      funcao: e.colaboradores?.funcao || '',
      entregue_em: e.entregue_em,
      entregue_por: e.entregue_por_nome || '',
      itens: (e.epi_entregas_itens || []).map((i: any) => ({
        nome: i.nome,
        ca: i.ca,
        complemento: i.complemento,
        quantidade: i.quantidade,
        troca_em: i.troca_em,
      })),
      termo: TERMO_ENTREGA_EPI,
      assinado: !!e.assinado_em,
      cancelada: !!e.cancelada_em,
      /* Para a pessoa saber qual CPF digitar sem que o link o revele. */
      cpf_dica: e.colaboradores?.cpf ? `•••.•••.${String(e.colaboradores.cpf).slice(6, 9)}-••` : null,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ erro: 'Não foi possível abrir o recebimento.' }, { status: 500 })
  }
}

/* POST — assina, conferindo o CPF da pessoa. */
export async function POST(req: Request) {
  let corpo: any
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 })
  }

  const token = String(corpo?.token || '')
  const cpf = soDigitos(corpo?.cpf)

  if (!TOKEN.test(token)) {
    return NextResponse.json({ erro: 'Link inválido.' }, { status: 400 })
  }
  if (erradoDemais(token)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas. Espere uns minutos e tente de novo.' },
      { status: 429 }
    )
  }

  try {
    const e = await buscar(token)
    if (!e) return NextResponse.json({ erro: 'Este link não existe mais.' }, { status: 404 })
    if (e.cancelada_em) {
      return NextResponse.json({ erro: 'Esta entrega foi cancelada.' }, { status: 409 })
    }
    if (e.assinado_em) {
      return NextResponse.json({ ok: true, ja: true })
    }

    const cpfCadastro = soDigitos(e.colaboradores?.cpf)
    if (!cpfCadastro) {
      return NextResponse.json(
        { erro: 'Seu cadastro está sem CPF. Peça para a empresa completar antes de assinar.' },
        { status: 409 }
      )
    }
    if (cpf !== cpfCadastro) {
      marcarErro(token)
      return NextResponse.json({ erro: 'CPF não confere com o do recebimento.' }, { status: 403 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null

    const { error } = await supabaseAdmin
      .from('epi_entregas')
      .update({
        assinado_em: new Date().toISOString(),
        assinatura_ip: ip,
        assinatura_agente: req.headers.get('user-agent')?.slice(0, 300) || null,
      })
      .eq('token', token)
      .is('assinado_em', null)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ erro: 'Não foi possível registrar a assinatura.' }, { status: 500 })
  }
}
