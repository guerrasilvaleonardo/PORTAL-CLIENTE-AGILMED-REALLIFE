import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const marcasValidas = ['agilmed', 'reallife']
const statusValidos = ['ativo', 'inativo']

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
      autorizado: false as const,
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

  /*
   * Cadastrar empresa faz parte do dia a dia de quem atende: era
   * quem recebia o cliente novo e precisava esperar um admin so para
   * criar a ficha. Atendimento e gestao passam a poder fazer isso.
   */
  const PODEM_CADASTRAR = ['admin', 'gestor', 'atendimento']

  if (
    error ||
    !profile ||
    !PODEM_CADASTRAR.includes(profile.perfil || '') ||
    profile.ativo !== true
  ) {
    return {
      autorizado: false as const,
      resposta: NextResponse.json(
        { erro: 'Acesso restrito à equipe interna.' },
        { status: 403 }
      ),
    }
  }

  return { autorizado: true as const, user }
}

/*
 * Só dígitos. O banco tem UNIQUE em cnpj, então guardar
 * sempre no mesmo formato evita duplicata mascarada por
 * pontuação diferente.
 */
function limparCnpj(valor: string) {
  return valor.replace(/\D/g, '')
}

function validarCampos(body: any, exigirRazaoSocial: boolean) {
  const razaoSocial = String(body.razao_social ?? '').trim()
  const marca = String(body.marca ?? '').trim()
  const status = String(body.status ?? 'ativo').trim()
  const cnpj = limparCnpj(String(body.cnpj ?? ''))

  if (exigirRazaoSocial && !razaoSocial) {
    return { erro: 'A razão social é obrigatória.' }
  }

  if (!marcasValidas.includes(marca)) {
    return {
      erro: 'Selecione a marca que atende a empresa (ÁgilMed ou Real Life).',
    }
  }

  if (!statusValidos.includes(status)) {
    return { erro: 'Situação inválida.' }
  }

  if (cnpj && cnpj.length !== 14) {
    return { erro: 'O CNPJ deve ter 14 dígitos.' }
  }

  return {
    dados: {
      razao_social: razaoSocial,
      nome_fantasia: String(body.nome_fantasia ?? '').trim() || null,
      cnpj: cnpj || null,
      email: String(body.email ?? '').trim().toLowerCase() || null,
      telefone: String(body.telefone ?? '').trim() || null,
      endereco: String(body.endereco ?? '').trim() || null,
      cidade: String(body.cidade ?? '').trim() || null,
      estado: String(body.estado ?? '').trim().toUpperCase() || null,
      cep: String(body.cep ?? '').trim() || null,
      marca,
      status,
    },
  }
}

const colunas = `
  id,
  razao_social,
  nome_fantasia,
  cnpj,
  email,
  telefone,
  endereco,
  cidade,
  estado,
  cep,
  marca,
  status,
  created_at
`

export async function GET(request: Request) {
  const verificacao = await verificarAdministrador(request)

  if (!verificacao.autorizado) {
    return verificacao.resposta
  }

  const { data, error } = await supabaseAdmin
    .from('empresas')
    .select(colunas)
    .order('razao_social')

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao carregar empresas.', detalhe: error.message },
      { status: 500 }
    )
  }

  const ids = (data ?? []).map((empresa: any) => empresa.id)

  /*
   * Contagens por empresa para a listagem. Sem isso o admin
   * não tem como saber se pode desativar uma empresa sem
   * deixar cliente na mão.
   */
  const contagens: Record<string, { usuarios: number; chamados: number }> = {}

  for (const id of ids) {
    contagens[id] = { usuarios: 0, chamados: 0 }
  }

  if (ids.length > 0) {
    const [{ data: perfis }, { data: chamados }] = await Promise.all([
      supabaseAdmin.from('profiles').select('empresa_id').in('empresa_id', ids),
      supabaseAdmin.from('chamados').select('empresa_id').in('empresa_id', ids),
    ])

    for (const linha of perfis ?? []) {
      const id = (linha as any).empresa_id
      if (id && contagens[id]) contagens[id].usuarios += 1
    }

    for (const linha of chamados ?? []) {
      const id = (linha as any).empresa_id
      if (id && contagens[id]) contagens[id].chamados += 1
    }
  }

  return NextResponse.json({
    empresas: (data ?? []).map((empresa: any) => ({
      ...empresa,
      total_usuarios: contagens[empresa.id]?.usuarios ?? 0,
      total_chamados: contagens[empresa.id]?.chamados ?? 0,
    })),
  })
}

export async function POST(request: Request) {
  const verificacao = await verificarAdministrador(request)

  if (!verificacao.autorizado) {
    return verificacao.resposta
  }

  try {
    const body = await request.json()
    const validacao = validarCampos(body, true)

    if (validacao.erro || !validacao.dados) {
      return NextResponse.json(
        { erro: validacao.erro ?? 'Dados inválidos.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('empresas')
      .insert(validacao.dados)
      .select(colunas)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { erro: 'Já existe uma empresa cadastrada com esse CNPJ.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { erro: 'Não foi possível cadastrar a empresa.', detalhe: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ sucesso: true, empresa: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        erro: 'Erro inesperado ao cadastrar a empresa.',
        detalhe: error instanceof Error ? error.message : 'Erro desconhecido.',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const verificacao = await verificarAdministrador(request)

  if (!verificacao.autorizado) {
    return verificacao.resposta
  }

  try {
    const body = await request.json()
    const id = String(body.id ?? '').trim()

    if (!id) {
      return NextResponse.json(
        { erro: 'Informe a empresa a ser alterada.' },
        { status: 400 }
      )
    }

    const validacao = validarCampos(body, true)

    if (validacao.erro || !validacao.dados) {
      return NextResponse.json(
        { erro: validacao.erro ?? 'Dados inválidos.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('empresas')
      .update({ ...validacao.dados, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(colunas)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { erro: 'Já existe uma empresa cadastrada com esse CNPJ.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { erro: 'Não foi possível salvar a empresa.', detalhe: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ sucesso: true, empresa: data })
  } catch (error) {
    return NextResponse.json(
      {
        erro: 'Erro inesperado ao salvar a empresa.',
        detalhe: error instanceof Error ? error.message : 'Erro desconhecido.',
      },
      { status: 500 }
    )
  }
}
