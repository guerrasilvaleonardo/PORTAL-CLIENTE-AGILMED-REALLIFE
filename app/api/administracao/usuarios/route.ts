import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

async function obterUsuarioAutenticado(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.replace('Bearer ', '').trim()

  const supabase = createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user
}

async function verificarAdministrador(request: Request) {
  const user = await obterUsuarioAutenticado(request)

  if (!user) {
    return {
      autorizado: false,
      resposta: NextResponse.json(
        { erro: 'Não autenticado.' },
        { status: 401 }
      ),
    }
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, perfil, ativo')
    .eq('id', user.id)
    .maybeSingle()

  if (
    error ||
    !profile ||
    profile.perfil !== 'admin' ||
    profile.ativo !== true
  ) {
    return {
      autorizado: false,
      resposta: NextResponse.json(
        { erro: 'Acesso restrito a administradores.' },
        { status: 403 }
      ),
    }
  }

  return {
    autorizado: true,
    user,
  }
}

export async function GET(request: Request) {
  const verificacao = await verificarAdministrador(request)

  if (!verificacao.autorizado) {
    return verificacao.resposta
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      nome,
      email,
      telefone,
      cargo,
      perfil,
      empresa_id,
      ativo,
      created_at,
      updated_at,
      empresas (
        id,
        nome_fantasia,
        marca
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      {
        erro: 'Erro ao carregar usuários.',
        detalhe: error.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    usuarios: data ?? [],
  })
}

export async function POST(request: Request) {
  const verificacao = await verificarAdministrador(request)

  if (!verificacao.autorizado) {
    return verificacao.resposta
  }

  try {
    const body = await request.json()

    const nome = String(body.nome ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const senha = String(body.senha ?? '')
    const telefone = String(body.telefone ?? '').trim()
    const cargo = String(body.cargo ?? '').trim()
    const perfil = String(body.perfil ?? '').trim()
    const empresaId = body.empresa_id || null

    if (!nome || !email || !senha) {
      return NextResponse.json(
        {
          erro: 'Nome, e-mail e senha são obrigatórios.',
        },
        { status: 400 }
      )
    }

    if (senha.length < 6) {
      return NextResponse.json(
        {
          erro: 'A senha deve possuir pelo menos 6 caracteres.',
        },
        { status: 400 }
      )
    }

    if (!['admin', 'gestor', 'atendimento', 'cliente'].includes(perfil)) {
      return NextResponse.json(
        {
          erro: 'Perfil de usuário inválido.',
        },
        { status: 400 }
      )
    }

    if (perfil === 'cliente' && !empresaId) {
      return NextResponse.json(
        {
          erro: 'Usuários clientes precisam estar vinculados a uma empresa.',
        },
        { status: 400 }
      )
    }

    if (empresaId) {
      const { data: empresa, error: empresaError } =
        await supabaseAdmin
          .from('empresas')
          .select('id')
          .eq('id', empresaId)
          .maybeSingle()

      if (empresaError || !empresa) {
        return NextResponse.json(
          {
            erro: 'Empresa não encontrada.',
          },
          { status: 400 }
        )
      }
    }

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          erro:
            authError?.message ||
            'Não foi possível criar o usuário.',
        },
        { status: 400 }
      )
    }

    const usuarioId = authData.user.id

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: usuarioId,
          nome,
          email,
          telefone: telefone || null,
          cargo: cargo || null,
          perfil,
          empresa_id: empresaId,
          ativo: true,
        })
        .select(`
          id,
          nome,
          email,
          telefone,
          cargo,
          perfil,
          empresa_id,
          ativo
        `)
        .single()

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(usuarioId)

      return NextResponse.json(
        {
          erro: 'Usuário criado na autenticação, mas não foi possível criar o perfil.',
          detalhe: profileError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        sucesso: true,
        usuario: profile,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        erro: 'Erro inesperado ao criar usuário.',
        detalhe:
          error instanceof Error
            ? error.message
            : 'Erro desconhecido.',
      },
      { status: 500 }
    )
  }
}
