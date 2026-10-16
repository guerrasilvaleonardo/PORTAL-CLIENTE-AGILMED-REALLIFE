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

/*
 * Avaliação do atendimento pelo cliente.
 *
 * A gravação acontece na função avaliar_chamado do banco, chamada COM A
 * SESSÃO DO PRÓPRIO CLIENTE (auth.uid()): é lá que se confere se ele
 * abriu o chamado, se o chamado está resolvido, se ainda está no prazo
 * e se já não foi avaliado. Esta rota só acrescenta o aviso reservado
 * ao gestor quando a nota é Ruim.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || ''

  if (!authorization.startsWith('Bearer ') || authorization.length < 20) {
    return NextResponse.json({ erro: 'Faça login para avaliar.' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 })
  }

  const chamadoId = String(body?.chamado_id ?? '').trim()
  const nota = Number(body?.nota)
  const comentario = typeof body?.comentario === 'string' ? body.comentario.slice(0, 2000) : null

  if (!chamadoId || ![1, 2, 3].includes(nota)) {
    return NextResponse.json({ erro: 'Escolha Ruim, Bom ou Excelente.' }, { status: 400 })
  }

  const comoCliente = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  })

  const { error } = await comoCliente.rpc('avaliar_chamado', {
    p_chamado: chamadoId,
    p_nota: nota,
    p_comentario: comentario,
  })

  if (error) {
    return NextResponse.json({ erro: error.message || 'Não foi possível registrar a avaliação.' }, { status: 400 })
  }

  /* Avaliação ruim: aviso reservado aos gestores, para acompanhamento. */
  if (nota === 1) {
    try {
      const { data: chamado } = await supabaseAdmin
        .from('chamados')
        .select('id, numero, assunto, empresa_id, responsavel_id')
        .eq('id', chamadoId)
        .maybeSingle()

      const { data: empresa } = chamado
        ? await supabaseAdmin
            .from('empresas')
            .select('nome_fantasia, razao_social, marca')
            .eq('id', chamado.empresa_id)
            .maybeSingle()
        : { data: null }

      const { data: atendente } = chamado?.responsavel_id
        ? await supabaseAdmin.from('profiles').select('nome').eq('id', chamado.responsavel_id).maybeSingle()
        : { data: null }

      const { data: gestores } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .in('perfil', ['gestor', 'admin'])
        .eq('ativo', true)

      const para = (gestores || []).map((g) => g.email || '').filter(Boolean)
      const marca = marcaDaEmpresa(empresa?.marca)

      if (para.length > 0 && chamado) {
        const codigo = '#' + (chamado.numero ?? '')
        await enviarEmail({
          para,
          marca,
          assunto: 'Avaliação ruim no chamado ' + codigo + ' — acompanhar',
          html: montarEmail(
            marca,
            'Avaliação ruim no chamado ' + codigo,
            [
              'O cliente <strong>' +
                escapar(empresa?.nome_fantasia || empresa?.razao_social || '') +
                '</strong> avaliou como <strong>Ruim</strong> o atendimento do chamado ' +
                codigo + ' — ' + escapar(chamado.assunto) + '.',
              'Atendente responsável: ' + escapar(atendente?.nome || 'não informado') + '.',
              comentario ? 'Comentário do cliente: <em>' + escapar(comentario) + '</em>' : '',
              'Este aviso é reservado à gestão. O comentário não aparece no ranking.',
            ].filter(Boolean),
            { rotulo: 'Acompanhar', url: enderecoDoPortal(marca) + '/estrelas?aba=gestao' }
          ),
        })
      }
    } catch (erro) {
      console.error('Avaliação registrada, mas o aviso ao gestor falhou:', erro)
    }
  }

  return NextResponse.json({ ok: true })
}
