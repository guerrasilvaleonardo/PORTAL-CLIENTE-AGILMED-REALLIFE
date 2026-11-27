import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { montarPdfDesempenho, nomeDoPdf, type ConteudoDoPdf } from '@/lib/desempenhoPdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * PDF do relatório individual fechado (supabase/desempenho-pdf.sql).
 *
 * POST { id }  -> garante que o PDF existe e devolve um link temporário.
 *
 * QUEM PODE: a própria pessoa e a direção (quem tem acesso ao relatório
 * de gestão). Mais ninguém — vai nome, números e avaliação de pessoa.
 *
 * O BALDE É PRIVADO E NÃO TEM POLÍTICA DE LEITURA. Quem entrega o
 * arquivo é esta rota, com link que expira: assim a conferência de
 * quem está pedindo acontece em UM lugar, e não espalhada numa regra
 * de banco que alguém mexe depois sem perceber o que derrubou.
 *
 * O PDF SÓ É GERADO DEPOIS DA CIÊNCIA. Antes disso a liberação ainda
 * pode ser revogada ou refeita, e guardar folha de versão que vai ser
 * substituída faz a pergunta "qual é o relatório de outubro?" voltar a
 * ter mais de uma resposta.
 *
 * É IDEMPOTENTE: pedir de novo devolve o arquivo que já existe. Só
 * monta quando ainda não há nenhum, para o documento guardado ser o
 * mesmo que a pessoa leu no dia — e não um recalculado de hoje.
 */

const BALDE = 'desempenho-pdf'

async function quemPede(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const cliente = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const {
    data: { user },
  } = await cliente.auth.getUser(auth.slice(7).trim())
  if (!user) return null

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, ativo, acesso_relatorio_gestao')
    .eq('id', user.id)
    .maybeSingle()

  const p = data as any
  if (!p || p.ativo !== true) return null

  return { id: p.id as string, direcao: p.acesso_relatorio_gestao === true }
}

export async function POST(request: Request) {
  const quem = await quemPede(request)
  if (!quem) return NextResponse.json({ erro: 'Acesso restrito.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ erro: 'Relatório inválido.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('desempenho_publicacoes')
    .select(
      'id, pessoa_id, mes, conteudo, mensagem, liberado_em, revogado_em, ciente_em,' +
        ' manifestacao, manifestacao_em, perguntas, respostas, pdf_path, pdf_em'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ erro: 'Relatório não encontrado.' }, { status: 404 })
  }

  const pub = data as any

  /* A pessoa só alcança o próprio; a direção alcança todos. */
  if (!quem.direcao && pub.pessoa_id !== quem.id) {
    return NextResponse.json({ erro: 'Acesso restrito.' }, { status: 403 })
  }
  if (pub.revogado_em) {
    return NextResponse.json({ erro: 'Esta liberação foi revogada.' }, { status: 409 })
  }
  if (!pub.ciente_em) {
    return NextResponse.json(
      { erro: 'O PDF é guardado quando a ciência é registrada: este relatório ainda está aberto.' },
      { status: 409 }
    )
  }

  try {
    let caminho: string = pub.pdf_path || ''

    if (!caminho) {
      const bytes = await montarPdfDesempenho({
        conteudo: pub.conteudo as ConteudoDoPdf,
        mensagem: pub.mensagem,
        liberadoEm: pub.liberado_em,
        cienteEm: pub.ciente_em,
        manifestacao: pub.manifestacao,
        manifestacaoEm: pub.manifestacao_em,
        perguntas: pub.perguntas,
        respostas: pub.respostas,
      })

      caminho = `${pub.pessoa_id}/${pub.id}.pdf`
      const envio = await supabaseAdmin.storage
        .from(BALDE)
        .upload(caminho, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
      if (envio.error) throw envio.error

      const { error: erroMarca } = await supabaseAdmin
        .from('desempenho_publicacoes')
        .update({ pdf_path: caminho, pdf_em: new Date().toISOString() })
        .eq('id', pub.id)
      /* Arquivo no lugar e marca no banco falhando: o próximo pedido
         monta de novo e sobrescreve. Pior seria marcar sem o arquivo. */
      if (erroMarca) throw erroMarca
    }

    const nome = nomeDoPdf(pub.conteudo?.ficha?.nome || 'relatorio', pub.mes?.slice(0, 7) || '')
    const link = await supabaseAdmin.storage
      .from(BALDE)
      .createSignedUrl(caminho, 300, { download: nome })
    if (link.error) throw link.error

    return NextResponse.json({ ok: true, url: link.data.signedUrl, nome, guardado: !!pub.pdf_path })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (/bucket/i.test(msg) && /not found/i.test(msg)) {
      return NextResponse.json(
        { erro: 'O balde do PDF ainda não existe: rode supabase/desempenho-pdf.sql.' },
        { status: 409 }
      )
    }
    if (/pdf_path|pdf_em|column/i.test(msg)) {
      return NextResponse.json(
        { erro: 'O portal ainda não está preparado para guardar o PDF: rode supabase/desempenho-pdf.sql.' },
        { status: 409 }
      )
    }
    console.error('PDF do desempenho:', e)
    return NextResponse.json({ erro: 'Não foi possível gerar o PDF.' }, { status: 500 })
  }
}
