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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

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

async function equipeInterna() {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .in('perfil', PERFIS_INTERNOS)
    .eq('ativo', true)

  return (data || []).map((p) => p.email || '')
}

async function clientesDaEmpresa(empresaId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  return (data || []).map((p) => p.email || '')
}

/*
 * Os disparos moram aqui, no servidor, porque é aqui que a chave do
 * Resend existe e é aqui que dá para descobrir os destinatários sem
 * depender do que o navegador conseguiria enxergar.
 */
export async function POST(request: Request) {
  const user = await usuarioDoPedido(request)

  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const evento = String(body.evento ?? '').trim()
    const chamadoId = String(body.chamado_id ?? '').trim()

    if (!evento || !chamadoId) {
      return NextResponse.json(
        { erro: 'Evento ou chamado não informado.' },
        { status: 400 }
      )
    }

    const { data: chamado, error: chamadoError } = await supabaseAdmin
      .from('chamados')
      .select(
        'id, numero, assunto, categoria, status, prioridade, empresa_id, criado_por, responsavel_id'
      )
      .eq('id', chamadoId)
      .maybeSingle()

    if (chamadoError || !chamado) {
      return NextResponse.json(
        { erro: 'Chamado não encontrado.' },
        { status: 404 }
      )
    }

    const { data: empresa } = await supabaseAdmin
      .from('empresas')
      .select('nome_fantasia, razao_social, marca')
      .eq('id', chamado.empresa_id)
      .maybeSingle()

    const marca = marcaDaEmpresa(empresa?.marca)
    const portal = enderecoDoPortal(marca)

    const nomeEmpresa =
      empresa?.nome_fantasia || empresa?.razao_social || 'Empresa'

    const { data: autor } = await supabaseAdmin
      .from('profiles')
      .select('nome, perfil')
      .eq('id', user.id)
      .maybeSingle()

    const autorEhInterno = PERFIS_INTERNOS.includes(autor?.perfil || '')
    const nomeAutor = autor?.nome || 'Equipe'

    const codigo = '#' + (chamado.numero ?? '')
    const assuntoChamado = escapar(chamado.assunto)

    let para: string[] = []
    let assunto = ''
    let html = ''

    if (evento === 'chamado_criado') {
      para = await equipeInterna()

      assunto = 'Novo chamado ' + codigo + ' — ' + nomeEmpresa

      html = montarEmail(
        marca,
        'Novo chamado ' + codigo,
        [
          '<strong>' + escapar(nomeEmpresa) + '</strong> abriu um chamado.',
          '<strong>Assunto:</strong> ' + assuntoChamado,
          '<strong>Categoria:</strong> ' + escapar(chamado.categoria),
          '<strong>Prioridade:</strong> ' + escapar(chamado.prioridade),
        ],
        { rotulo: 'Abrir no quadro', url: portal + '/atendimento/' + chamado.id }
      )
    } else if (evento === 'mensagem_nova') {
      const trecho = String(body.mensagem ?? '').slice(0, 400)

      if (autorEhInterno) {
        para = await clientesDaEmpresa(chamado.empresa_id)

        assunto = 'Resposta no chamado ' + codigo

        html = montarEmail(
          marca,
          'Você recebeu uma resposta',
          [
            'A equipe respondeu o chamado ' + codigo + ' — ' + assuntoChamado + '.',
            trecho
              ? '<em>' + escapar(trecho) + '</em>'
              : 'Acesse o portal para ler a mensagem.',
          ],
          { rotulo: 'Ver o chamado', url: portal + '/chamados/' + chamado.id }
        )
      } else {
        const { data: responsavel } = chamado.responsavel_id
          ? await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('id', chamado.responsavel_id)
              .maybeSingle()
          : { data: null }

        para = responsavel?.email
          ? [responsavel.email]
          : await equipeInterna()

        assunto = 'Nova mensagem no chamado ' + codigo + ' — ' + nomeEmpresa

        html = montarEmail(
          marca,
          'Nova mensagem do cliente',
          [
            escapar(nomeAutor) +
              ', de ' +
              escapar(nomeEmpresa) +
              ', escreveu no chamado ' +
              codigo +
              '.',
            trecho ? '<em>' + escapar(trecho) + '</em>' : '',
          ].filter(Boolean),
          { rotulo: 'Responder', url: portal + '/atendimento/' + chamado.id }
        )
      }
    } else if (evento === 'status_alterado') {
      para = await clientesDaEmpresa(chamado.empresa_id)

      const rotulos: Record<string, string> = {
        aberto: 'Aberto',
        em_atendimento: 'Em atendimento',
        aguardando_cliente: 'Aguardando você',
        resolvido: 'Resolvido',
        encerrado: 'Encerrado',
      }

      const rotulo = rotulos[chamado.status] || chamado.status

      assunto = 'Chamado ' + codigo + ' agora está ' + rotulo

      html = montarEmail(
        marca,
        'Chamado ' + codigo + ': ' + rotulo,
        [
          'O chamado <strong>' + assuntoChamado + '</strong> mudou de situação.',
          '<strong>Situação atual:</strong> ' + escapar(rotulo),
          chamado.status === 'aguardando_cliente'
            ? 'Estamos aguardando um retorno seu para continuar.'
            : '',
        ].filter(Boolean),
        { rotulo: 'Ver o chamado', url: portal + '/chamados/' + chamado.id }
      )
    } else if (evento === 'chamado_transferido') {
      if (!chamado.responsavel_id) {
        return NextResponse.json({ sucesso: true, enviado: false })
      }

      const { data: responsavel } = await supabaseAdmin
        .from('profiles')
        .select('email, nome')
        .eq('id', chamado.responsavel_id)
        .maybeSingle()

      para = responsavel?.email ? [responsavel.email] : []

      assunto = 'Chamado ' + codigo + ' está com você'

      html = montarEmail(
        marca,
        'Um chamado foi transferido para você',
        [
          escapar(nomeAutor) + ' passou o chamado ' + codigo + ' para você.',
          '<strong>Cliente:</strong> ' + escapar(nomeEmpresa),
          '<strong>Assunto:</strong> ' + assuntoChamado,
          '<strong>Prioridade:</strong> ' + escapar(chamado.prioridade),
        ],
        { rotulo: 'Assumir o atendimento', url: portal + '/atendimento/' + chamado.id }
      )
    } else {
      return NextResponse.json({ erro: 'Evento desconhecido.' }, { status: 400 })
    }

    const resultado = await enviarEmail({ para, assunto, html, marca })

    return NextResponse.json({ sucesso: true, ...resultado })
  } catch (erro) {
    console.error('Erro ao disparar notificação:', erro)

    return NextResponse.json(
      { erro: 'Erro inesperado ao enviar a notificação.' },
      { status: 500 }
    )
  }
}
