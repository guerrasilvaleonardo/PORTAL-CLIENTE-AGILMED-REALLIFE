import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/*
 * Trocar a empresa de um chamado nao e a mesma coisa que trocar a
 * prioridade: muda quem enxerga o chamado, muda a marca dos e-mails e
 * pode tirar o chamado da vista de quem o abriu. Por isso a operacao
 * mora no servidor, onde da para conferir o perfil de verdade e
 * registrar a mudanca no historico sem depender das politicas de
 * escrita da tabela de eventos.
 */
const PODEM_TROCAR = ['gestor', 'admin']

async function usuarioDoPedido(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.replace('Bearer ', '').trim()

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  return error || !user ? null : user
}

function nomeDaEmpresa(e: any) {
  return e?.nome_fantasia || e?.razao_social || 'Empresa'
}

export async function POST(request: Request) {
  const user = await usuarioDoPedido(request)

  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  const { data: perfil } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, perfil, ativo')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !perfil ||
    perfil.ativo !== true ||
    !PODEM_TROCAR.includes(perfil.perfil || '')
  ) {
    return NextResponse.json(
      { erro: 'Só gestores e administradores podem trocar a empresa de um chamado.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()

    const chamadoId = String(body.chamado_id ?? '').trim()
    const empresaId = String(body.empresa_id ?? '').trim()

    if (!chamadoId || !empresaId) {
      return NextResponse.json(
        { erro: 'Chamado ou empresa não informados.' },
        { status: 400 }
      )
    }

    const { data: chamado } = await supabaseAdmin
      .from('chamados')
      .select('id, numero, empresa_id')
      .eq('id', chamadoId)
      .maybeSingle()

    if (!chamado) {
      return NextResponse.json(
        { erro: 'Chamado não encontrado.' },
        { status: 404 }
      )
    }

    if (chamado.empresa_id === empresaId) {
      return NextResponse.json({ sucesso: true, semMudanca: true })
    }

    const { data: empresas } = await supabaseAdmin
      .from('empresas')
      .select('id, nome_fantasia, razao_social')
      .in('id', [chamado.empresa_id, empresaId])

    const destino = (empresas || []).find((e) => e.id === empresaId)
    const origem = (empresas || []).find((e) => e.id === chamado.empresa_id)

    if (!destino) {
      return NextResponse.json(
        { erro: 'A empresa escolhida não existe.' },
        { status: 400 }
      )
    }

    const { error: erroUpdate } = await supabaseAdmin
      .from('chamados')
      .update({ empresa_id: empresaId })
      .eq('id', chamadoId)

    if (erroUpdate) {
      console.error('Erro ao trocar a empresa do chamado:', erroUpdate)

      return NextResponse.json(
        { erro: 'Não foi possível trocar a empresa.' },
        { status: 500 }
      )
    }

    /*
     * O historico guarda os nomes, nao os ids: quem le a linha meses
     * depois precisa entender sem consultar outra tabela.
     */
    const { error: erroEvento } = await supabaseAdmin
      .from('chamado_eventos')
      .insert({
        chamado_id: chamadoId,
        tipo: 'empresa',
        de: nomeDaEmpresa(origem),
        para: nomeDaEmpresa(destino),
        autor_id: perfil.id,
      })

    if (erroEvento) {
      /* A troca ja aconteceu; o historico falhar nao desfaz nada. */
      console.error('Erro ao registrar o evento de empresa:', erroEvento)
    }

    return NextResponse.json({
      sucesso: true,
      de: nomeDaEmpresa(origem),
      para: nomeDaEmpresa(destino),
      evento_registrado: !erroEvento,
    })
  } catch (erro) {
    console.error('Erro inesperado ao trocar a empresa:', erro)

    return NextResponse.json(
      { erro: 'Erro inesperado ao trocar a empresa.' },
      { status: 500 }
    )
  }
}
