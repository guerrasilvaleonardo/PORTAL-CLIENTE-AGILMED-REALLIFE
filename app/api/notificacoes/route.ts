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

function semAcento(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/*
 * A equipe já escrevia "@Danielle" nas conversas sem que isso fizesse
 * nada. Agora quem é citado recebe o aviso com o link do chamado.
 */
async function avisarCitados(
  texto: string,
  autorId: string,
  dados: {
    marca: any
    portal: string
    codigo: string
    assunto: string
    nomeAutor: string
    nomeEmpresa: string
    chamadoId: string
  }
) {
  const apelidos = [
    ...texto.matchAll(/@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'-]{1,40})/g),
  ].map((m) => semAcento(m[1]))

  if (!apelidos.length) {
    return 0
  }

  const { data: pessoas } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, perfil')
    .eq('ativo', true)

  const citados = (pessoas || []).filter((p) => {
    if (p.id === autorId || !p.email) {
      return false
    }

    const nome = semAcento(p.nome || '')
    const primeiro = nome.split(' ')[0]

    return apelidos.some((a) => a === primeiro || nome.startsWith(a))
  })

  let enviados = 0

  for (const pessoa of citados) {
    const interno = PERFIS_INTERNOS.includes(pessoa.perfil || '')

    const link =
      dados.portal +
      (interno ? '/atendimento/' : '/chamados/') +
      dados.chamadoId

    const r = await enviarEmail({
      para: [pessoa.email as string],
      assunto:
        dados.nomeAutor + ' citou você no chamado ' + dados.codigo,
      marca: dados.marca,
      html: montarEmail(
        dados.marca,
        'Você foi citado em um chamado',
        [
          escapar(dados.nomeAutor) +
            ' mencionou você no chamado ' +
            dados.codigo +
            ' — ' +
            escapar(dados.assunto) +
            '.',
          '<strong>Cliente:</strong> ' + escapar(dados.nomeEmpresa),
          '<em>' + escapar(texto.slice(0, 400)) + '</em>',
        ],
        { rotulo: 'Abrir o chamado', url: link }
      ),
    })

    if (r.enviado) enviados++
  }

  return enviados
}

/*
 * Quem abriu o chamado precisa ser avisado de qualquer alteracao, e
 * nem sempre ele aparece na lista da empresa: um chamado aberto pela
 * equipe interna em nome do cliente tem como autor uma pessoa de
 * dentro. Por isso buscamos o autor pelo id, e nao pela empresa.
 */
async function autorDoChamado(criadoPor: string | null) {
  if (!criadoPor) {
    return null
  }

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, perfil')
    .eq('id', criadoPor)
    .maybeSingle()

  return data && data.email ? data : null
}

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

/*
 * O "lado do cliente" de um chamado sao duas coisas: o e-mail que ficou
 * gravado no cadastro da empresa, que costuma ser a caixa que a empresa
 * acompanha de verdade, e os usuarios que aquela empresa tem no portal.
 * Os dois recebem, sem repetir quem aparece nas duas listas.
 */
async function ladoDoCliente(empresaId: string, emailDaEmpresa?: string | null) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  const lista = [emailDaEmpresa || '', ...(data || []).map((p) => p.email || '')]

  const vistos = new Set<string>()
  const limpa: string[] = []

  for (const email of lista) {
    const chave = (email || '').trim().toLowerCase()

    if (!chave || vistos.has(chave)) continue

    vistos.add(chave)
    limpa.push(email.trim())
  }

  return limpa
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
      .select('nome_fantasia, razao_social, marca, email')
      .eq('id', chamado.empresa_id)
      .maybeSingle()

    const marca = marcaDaEmpresa(empresa?.marca)
    const portal = enderecoDoPortal(marca)

    const nomeEmpresa =
      empresa?.nome_fantasia || empresa?.razao_social || 'Empresa'

    const { data: autor } = await supabaseAdmin
      .from('profiles')
      .select('nome, perfil, email')
      .eq('id', user.id)
      .maybeSingle()

    const autorEhInterno = PERFIS_INTERNOS.includes(autor?.perfil || '')
    const nomeAutor = autor?.nome || 'Equipe'

    const codigo = '#' + (chamado.numero ?? '')
    const assuntoChamado = escapar(chamado.assunto)

    let para: string[] = []
    let assunto = ''
    let html = ''

    /*
     * Linhas do aviso que vai para quem abriu o chamado. Cada evento
     * preenche do seu jeito, e quem abriu recebe sempre, mesmo quando
     * o aviso principal foi para a equipe.
     */
    let resumoParaAutor: string[] = []
    let tituloParaAutor = 'Seu chamado ' + codigo + ' foi atualizado'

    /*
     * Linhas do aviso que vai para o lado do cliente: o e-mail do
     * cadastro da empresa e os usuarios dela. A empresa acompanha o
     * chamado do inicio ao fim, entao todo evento preenche isto.
     */
    let resumoParaCliente: string[] = []
    let tituloParaCliente = 'Chamado ' + codigo + ' foi atualizado'

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

      tituloParaCliente = 'Recebemos o chamado ' + codigo
      resumoParaCliente = [
        'O chamado <strong>' + assuntoChamado + '</strong> foi aberto e já está na nossa fila.',
        '<strong>Categoria:</strong> ' + escapar(chamado.categoria),
        '<strong>Prioridade:</strong> ' + escapar(chamado.prioridade),
        'Você será avisado a cada movimentação.',
      ]
    } else if (evento === 'mensagem_nova') {
      const trecho = String(body.mensagem ?? '').slice(0, 400)

      if (autorEhInterno) {
        para = await ladoDoCliente(chamado.empresa_id, empresa?.email)

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

        tituloParaAutor = 'Nova resposta no chamado ' + codigo
        resumoParaAutor = [
          'A equipe respondeu o chamado ' + codigo + ' — ' + assuntoChamado + '.',
          trecho ? '<em>' + escapar(trecho) + '</em>' : '',
        ].filter(Boolean)
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

        tituloParaCliente = 'Nova mensagem no chamado ' + codigo
        resumoParaCliente = [
          escapar(nomeAutor) +
            ' escreveu no chamado ' +
            codigo +
            ' — ' +
            assuntoChamado +
            '.',
          trecho ? '<em>' + escapar(trecho) + '</em>' : '',
        ].filter(Boolean)

        tituloParaAutor = 'Nova mensagem no chamado ' + codigo
        resumoParaAutor = [
          escapar(nomeAutor) +
            ' escreveu no chamado ' +
            codigo +
            ' — ' +
            assuntoChamado +
            '.',
          trecho ? '<em>' + escapar(trecho) + '</em>' : '',
        ].filter(Boolean)
      }
    } else if (evento === 'status_alterado') {
      para = await ladoDoCliente(chamado.empresa_id, empresa?.email)

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

      tituloParaAutor = 'Chamado ' + codigo + ': ' + rotulo
      resumoParaAutor = [
        'O chamado <strong>' + assuntoChamado + '</strong> mudou de situação.',
        '<strong>Situação atual:</strong> ' + escapar(rotulo),
        chamado.status === 'aguardando_cliente'
          ? 'Estamos aguardando um retorno seu para continuar.'
          : '',
      ].filter(Boolean)
    } else if (evento === 'prioridade_alterada') {
      /*
       * Mexer na prioridade refaz o prazo, entao quem abriu precisa
       * saber. O aviso principal vai para a equipe; quem abriu recebe
       * a versao em linguagem de cliente logo abaixo.
       */
      const rotulosPrioridade: Record<string, string> = {
        baixa: 'Baixa',
        normal: 'Normal',
        alta: 'Alta',
        urgente: 'Urgente',
      }

      const rotuloPrio =
        rotulosPrioridade[chamado.prioridade] || chamado.prioridade

      const emailDoAutorAcao = (autor?.email || '').toLowerCase()

      para = (await equipeInterna()).filter(
        (email) => email && email.toLowerCase() !== emailDoAutorAcao
      )

      assunto =
        'Chamado ' + codigo + ' agora é prioridade ' + rotuloPrio

      html = montarEmail(
        marca,
        'Prioridade alterada no chamado ' + codigo,
        [
          escapar(nomeAutor) +
            ' mudou a prioridade do chamado ' +
            codigo +
            ' — ' +
            assuntoChamado +
            '.',
          '<strong>Cliente:</strong> ' + escapar(nomeEmpresa),
          '<strong>Prioridade agora:</strong> ' + escapar(rotuloPrio),
        ],
        {
          rotulo: 'Abrir o chamado',
          url: portal + '/atendimento/' + chamado.id,
        }
      )

      tituloParaCliente =
        'Chamado ' + codigo + ': prioridade ' + rotuloPrio

      resumoParaCliente = [
        'A prioridade do chamado <strong>' +
          assuntoChamado +
          '</strong> foi alterada.',
        '<strong>Prioridade agora:</strong> ' + escapar(rotuloPrio),
        'O prazo de atendimento foi recalculado de acordo com a nova prioridade.',
      ]

      tituloParaAutor =
        'Chamado ' + codigo + ': prioridade ' + rotuloPrio

      resumoParaAutor = [
        'A prioridade do chamado <strong>' +
          assuntoChamado +
          '</strong> foi alterada.',
        '<strong>Prioridade agora:</strong> ' + escapar(rotuloPrio),
        'O prazo de atendimento foi recalculado de acordo com a nova prioridade.',
      ]
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

      tituloParaCliente = 'Chamado ' + codigo + ': novo responsável'
      resumoParaCliente = [
        'O chamado <strong>' +
          assuntoChamado +
          '</strong> passou a ser atendido por ' +
          escapar(responsavel?.nome || 'nossa equipe') +
          '.',
      ]

      tituloParaAutor = 'Chamado ' + codigo + ': novo responsável'
      resumoParaAutor = [
        'O chamado <strong>' +
          assuntoChamado +
          '</strong> passou a ser atendido por ' +
          escapar(responsavel?.nome || 'nossa equipe') +
          '.',
      ]
    } else {
      return NextResponse.json({ erro: 'Evento desconhecido.' }, { status: 400 })
    }

    const resultado = await enviarEmail({ para, assunto, html, marca })

    /*
     * Uma pessoa pode caber em mais de uma lista: ser dona da empresa,
     * ter aberto o chamado e ainda estar no cadastro. Este conjunto
     * guarda quem ja recebeu para ninguem levar o mesmo aviso duas
     * vezes. O autor da acao tambem entra: ele acabou de fazer.
     */
    const jaAvisados = new Set<string>(
      para.map((e) => (e || '').trim().toLowerCase()).filter(Boolean)
    )

    if (autor?.email) {
      jaAvisados.add(autor.email.trim().toLowerCase())
    }

    /*
     * Quem abriu o chamado e avisado de qualquer alteracao: resposta,
     * mudanca de situacao, de prioridade, de responsavel e
     * encerramento. So nao recebe quando foi ele proprio quem fez a
     * alteracao, ou quando ja entrou na lista do aviso principal.
     */
    let autorAvisado = false

    if (evento !== 'chamado_criado' && resumoParaAutor.length > 0) {
      const abriu = await autorDoChamado(chamado.criado_por)

      if (
        abriu &&
        abriu.id !== user.id &&
        !jaAvisados.has((abriu.email || '').trim().toLowerCase())
      ) {
        const autorEhDaCasa = PERFIS_INTERNOS.includes(abriu.perfil || '')

        const linkAutor =
          portal +
          (autorEhDaCasa ? '/atendimento/' : '/chamados/') +
          chamado.id

        const avisoAutor = await enviarEmail({
          para: [abriu.email as string],
          assunto: tituloParaAutor,
          marca,
          html: montarEmail(
            marca,
            tituloParaAutor,
            [
              'Houve uma atualização no chamado ' +
                codigo +
                ' — ' +
                assuntoChamado +
                ', que você abriu.',
              ...resumoParaAutor,
            ],
            { rotulo: 'Ver o chamado', url: linkAutor }
          ),
        })

        autorAvisado = !!avisoAutor?.enviado

        jaAvisados.add((abriu.email as string).trim().toLowerCase())
      }
    }

    /*
     * E por fim o lado do cliente: o e-mail do cadastro da empresa e os
     * usuarios dela recebem todo evento, inclusive os que nasceram
     * dentro da equipe, como troca de prioridade ou de responsavel.
     */
    let clienteAvisado = 0

    if (resumoParaCliente.length > 0) {
      const doCliente = (
        await ladoDoCliente(chamado.empresa_id, empresa?.email)
      ).filter((email) => !jaAvisados.has(email.trim().toLowerCase()))

      if (doCliente.length > 0) {
        const aviso = await enviarEmail({
          para: doCliente,
          assunto: tituloParaCliente,
          marca,
          html: montarEmail(marca, tituloParaCliente, resumoParaCliente, {
            rotulo: 'Ver o chamado',
            url: portal + '/chamados/' + chamado.id,
          }),
        })

        clienteAvisado = aviso?.enviado ? doCliente.length : 0

        for (const email of doCliente) {
          jaAvisados.add(email.trim().toLowerCase())
        }
      }
    }

    /*
     * Toda mensagem nova tambem avisa a equipe interna, inclusive
     * quando quem escreveu foi a propria equipe. Assim ninguem
     * descobre a conversa so ao abrir o chamado. O autor nao recebe
     * copia, e quem ja recebeu o aviso principal tambem nao.
     */
    let equipeAvisada = 0

    if (evento === 'mensagem_nova') {
      const equipe = (await equipeInterna()).filter(
        (email) => email && !jaAvisados.has(email.trim().toLowerCase())
      )

      if (equipe.length > 0) {
        const trechoEquipe = String(body.mensagem ?? '').slice(0, 400)

        const copia = await enviarEmail({
          para: equipe,
          assunto: 'Nova mensagem no chamado ' + codigo + ' — ' + nomeEmpresa,
          html: montarEmail(
            marca,
            'Nova mensagem no chamado ' + codigo,
            [
              escapar(nomeAutor) +
                ' escreveu no chamado ' +
                codigo +
                ' — ' +
                assuntoChamado +
                ' (' +
                escapar(nomeEmpresa) +
                ').',
              trechoEquipe ? '<em>' + escapar(trechoEquipe) + '</em>' : '',
            ].filter(Boolean),
            {
              rotulo: 'Abrir o chamado',
              url: portal + '/atendimento/' + chamado.id,
            }
          ),
          marca,
        })

        equipeAvisada = copia?.enviado ? equipe.length : 0
      }
    }

    let citados = 0

    if (evento === 'mensagem_nova') {
      citados = await avisarCitados(String(body.mensagem ?? ''), user.id, {
        marca,
        portal,
        codigo,
        assunto: chamado.assunto,
        nomeAutor: nomeAutor,
        nomeEmpresa,
        chamadoId: chamado.id,
      })
    }

    return NextResponse.json({
      sucesso: true,
      citados,
      equipe_avisada: equipeAvisada,
      autor_avisado: autorAvisado,
      cliente_avisado: clienteAvisado,
      ...resultado,
    })
  } catch (erro) {
    console.error('Erro ao disparar notificação:', erro)

    return NextResponse.json(
      { erro: 'Erro inesperado ao enviar a notificação.' },
      { status: 500 }
    )
  }
}
