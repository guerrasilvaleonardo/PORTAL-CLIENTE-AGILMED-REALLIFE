import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  enderecoDoPortal,
  enviarEmail,
  escapar,
  marcaDaEmpresa,
  montarEmail,
} from '@/lib/email'
import type { Marca } from '@/lib/marca'

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

  /*
   * Cada motivo de recusa ganha sua própria frase: uma tarja que só
   * diz "acesso restrito" não distingue chave errada de perfil errado,
   * e era isso que travava o diagnóstico.
   */
  let motivo = ''

  if (error) {
    motivo = 'Não foi possível ler seu perfil no banco: ' + error.message
  } else if (!profile) {
    motivo = 'Seu usuário não possui perfil cadastrado no portal.'
  } else if (
    !['admin', 'gestor', 'atendimento'].includes(profile.perfil || '')
  ) {
    motivo =
      'Acesso restrito à equipe interna. Seu perfil atual é "' +
      String(profile.perfil) +
      '".'
  } else if (profile.ativo !== true) {
    motivo = 'Seu usuário está inativo no portal.'
  }

  if (motivo) {
    return {
      autorizado: false,
      resposta: NextResponse.json({ erro: motivo }, { status: 403 }),
    }
  }

  return {
    autorizado: true,
    user,
    /*
     * Quem nao e admin pode cadastrar e editar gente, mas nao pode
     * criar nem mexer em administrador. Sem essa trava, bastaria um
     * atendente criar um usuario admin para si e o controle de acesso
     * do portal deixaria de existir.
     */
    ehAdmin: profile?.perfil === 'admin',
  }
}

const PERFIS_QUE_SO_ADMIN_MEXE = ['admin']

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
        razao_social,
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

    if (PERFIS_QUE_SO_ADMIN_MEXE.includes(perfil) && !verificacao.ehAdmin) {
      return NextResponse.json(
        { erro: 'Só um administrador pode criar outro administrador.' },
        { status: 403 }
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

    /*
     * O banco tem o gatilho on_auth_user_created, que já cria a linha
     * em profiles assim que o usuário nasce na autenticação. Um insert
     * puro aqui batia em chave duplicada, o perfil não era gravado e a
     * rota desfazia tudo. O upsert completa a linha que o gatilho criou.
     */
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: usuarioId,
          nome,
          email,
          telefone: telefone || null,
          cargo: cargo || null,
          perfil,
          empresa_id: empresaId,
          ativo: true,
        }, { onConflict: 'id' })
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

    /*
     * Boas-vindas: a pessoa recebe o endereço do portal e a senha que
     * o administrador definiu, em vez de ficar esperando um aviso por
     * fora. A falha do e-mail não desfaz o cadastro.
     */
    let marca: Marca = 'reallife'

    if (empresaId) {
      const { data: empresaMarca } = await supabaseAdmin
        .from('empresas')
        .select('marca')
        .eq('id', empresaId)
        .maybeSingle()

      marca = marcaDaEmpresa(empresaMarca?.marca)
    } else {
      const host = request.headers.get('host') || ''
      marca = host.includes('agilmed') ? 'agilmed' : 'reallife'
    }

    const portal = enderecoDoPortal(marca)

    await enviarEmail({
      para: [email],
      assunto: 'Seu acesso ao Portal do Cliente',
      marca,
      html: montarEmail(
        marca,
        'Seu acesso está pronto',
        [
          'Olá, ' + escapar(nome) + '.',
          'Criamos o seu acesso ao Portal do Cliente. Entre com estes dados:',
          '<strong>Endereço:</strong> ' + portal,
          '<strong>E-mail:</strong> ' + escapar(email),
          '<strong>Senha inicial:</strong> ' + escapar(senha),
          'Troque a senha no seu perfil assim que entrar.',
        ],
        { rotulo: 'Entrar no portal', url: portal + '/login' }
      ),
    })

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
        { erro: 'Usuário não informado.' },
        { status: 400 }
      )
    }

    const nome = String(body.nome ?? '').trim()
    const telefone = String(body.telefone ?? '').trim()
    const cargo = String(body.cargo ?? '').trim()
    const perfil = String(body.perfil ?? '').trim()
    const senha = String(body.senha ?? '')
    const empresaId = body.empresa_id || null
    const ativo = body.ativo !== false

    if (!nome) {
      return NextResponse.json(
        { erro: 'O nome é obrigatório.' },
        { status: 400 }
      )
    }

    if (!['admin', 'gestor', 'atendimento', 'cliente'].includes(perfil)) {
      return NextResponse.json(
        { erro: 'Perfil de usuário inválido.' },
        { status: 400 }
      )
    }

    if (!verificacao.ehAdmin) {
      /*
       * Duas portas fechadas para quem nao e admin: promover alguem a
       * admin, e mexer em quem ja e admin (inclusive rebaixar ou
       * trocar a senha).
       */
      if (PERFIS_QUE_SO_ADMIN_MEXE.includes(perfil)) {
        return NextResponse.json(
          { erro: 'Só um administrador pode promover alguém a administrador.' },
          { status: 403 }
        )
      }

      const { data: alvo } = await supabaseAdmin
        .from('profiles')
        .select('perfil')
        .eq('id', id)
        .maybeSingle()

      if (PERFIS_QUE_SO_ADMIN_MEXE.includes(alvo?.perfil || '')) {
        return NextResponse.json(
          { erro: 'Só um administrador pode editar outro administrador.' },
          { status: 403 }
        )
      }
    }

    if (perfil === 'cliente' && !empresaId) {
      return NextResponse.json(
        { erro: 'Usuários clientes precisam estar vinculados a uma empresa.' },
        { status: 400 }
      )
    }

    if (senha && senha.length < 6) {
      return NextResponse.json(
        { erro: 'A nova senha deve possuir pelo menos 6 caracteres.' },
        { status: 400 }
      )
    }

    /*
     * Trava contra o administrador se trancar do lado de fora: ninguém
     * tira o próprio acesso, e o último administrador ativo não pode
     * ser rebaixado nem desativado por outro.
     */
    if (id === verificacao.user?.id && (perfil !== 'admin' || !ativo)) {
      return NextResponse.json(
        {
          erro: 'Você não pode remover o seu próprio acesso de administrador.',
        },
        { status: 400 }
      )
    }

    if (perfil !== 'admin' || !ativo) {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('perfil', 'admin')
        .eq('ativo', true)

      const { data: atual } = await supabaseAdmin
        .from('profiles')
        .select('perfil, ativo')
        .eq('id', id)
        .maybeSingle()

      const eraAdminAtivo = atual?.perfil === 'admin' && atual?.ativo === true

      if (eraAdminAtivo && (count ?? 0) <= 1) {
        return NextResponse.json(
          {
            erro: 'Este é o único administrador ativo. Promova outro antes de alterar este.',
          },
          { status: 400 }
        )
      }
    }

    if (empresaId) {
      const { data: empresa, error: empresaError } = await supabaseAdmin
        .from('empresas')
        .select('id')
        .eq('id', empresaId)
        .maybeSingle()

      if (empresaError || !empresa) {
        return NextResponse.json(
          { erro: 'Empresa não encontrada.' },
          { status: 400 }
        )
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome,
        telefone: telefone || null,
        cargo: cargo || null,
        perfil,
        empresa_id: empresaId,
        ativo,
      })
      .eq('id', id)
      .select('id, nome, email, telefone, cargo, perfil, empresa_id, ativo')
      .single()

    if (profileError) {
      return NextResponse.json(
        {
          erro: 'Não foi possível salvar as alterações.',
          detalhe: profileError.message,
        },
        { status: 500 }
      )
    }

    if (senha) {
      const { error: senhaError } =
        await supabaseAdmin.auth.admin.updateUserById(id, { password: senha })

      if (senhaError) {
        return NextResponse.json(
          {
            erro:
              'Os dados foram salvos, mas a senha não pôde ser alterada: ' +
              senhaError.message,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      sucesso: true,
      usuario: profile,
      senha_alterada: Boolean(senha),
    })
  } catch (error) {
    return NextResponse.json(
      {
        erro: 'Erro inesperado ao salvar o usuário.',
        detalhe:
          error instanceof Error ? error.message : 'Erro desconhecido.',
      },
      { status: 500 }
    )
  }
}
