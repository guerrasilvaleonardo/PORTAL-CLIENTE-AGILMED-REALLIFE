import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enviarEmail, escapar } from '@/lib/email'
import { marcas } from '@/lib/marca'
import { montarReconhecimento, type Reconhecimento } from '@/lib/reconhecimentoEstrelas'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/*
 * Envio dos e-mails mensais de reconhecimento do Programa de Estrelas
 * (supabase/estrelas-reconhecimento-mensal.sql). Só gestor e admin.
 *
 * POST { ids: number[] } -> envia, um a um, os rascunhos aprovados
 * (ação "Enviar e-mail", ainda não enviados). O remetente aparece com o
 * nome de quem envia e as respostas vão para o e-mail dessa pessoa.
 */
async function gestor(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const {
    data: { user },
  } = await cliente.auth.getUser(auth.slice(7).trim())
  if (!user) return null

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, perfil, ativo')
    .eq('id', user.id)
    .maybeSingle()

  const p = data as any
  if (!p || p.ativo === false || !['gestor', 'admin'].includes(p.perfil)) return null
  return { id: p.id as string, nome: String(p.nome || p.email || 'Equipe Real Life'), email: (p.email || null) as string | null }
}

/* E-mail pessoal: sem faixa de "aviso automático", só o texto e a assinatura. */
function html(paragrafos: string[], numeros: string | null) {
  const cor = marcas.reallife.principal
  const corpo = paragrafos
    .map((p) => {
      if (p === '§NUMEROS') {
        return (
          '<p style="margin:0 0 16px;padding:12px 14px;border-left:3px solid ' + cor +
          ';background:#f8fafc;font-size:14px;line-height:1.6;color:#334155;">' + escapar(numeros) + '</p>'
        )
      }
      return (
        '<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#1e293b;">' +
        escapar(p).replace(/\n/g, '<br>') +
        '</p>'
      )
    })
    .join('')

  return (
    '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:#ffffff;">' +
    '<div style="max-width:580px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">' +
    corpo +
    '<p style="margin:26px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">' +
    'Programa de Estrelas · ' + escapar(marcas.reallife.nome) +
    '</p></div></body></html>'
  )
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(request: Request) {
  const quem = await gestor(request)
  if (!quem) return NextResponse.json({ erro: 'Acesso restrito a gestor e admin.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))].slice(0, 100)
    : []

  if (!ids.length) return NextResponse.json({ erro: 'Nenhum e-mail selecionado.' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('estrelas_reconhecimentos').select('*').in('id', ids)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const resultado: { id: number; nome: string; enviado: boolean; motivo?: string }[] = []

  for (const linha of (data || []) as Reconhecimento[]) {
    if (linha.situacao === 'enviado') {
      resultado.push({ id: linha.id, nome: linha.nome, enviado: false, motivo: 'já enviado' })
      continue
    }
    if (linha.acao !== 'email') {
      resultado.push({ id: linha.id, nome: linha.nome, enviado: false, motivo: 'marcado para não receber e-mail' })
      continue
    }

    const montado = montarReconhecimento(linha, quem.nome)
    if (montado.pendencias.length) {
      resultado.push({ id: linha.id, nome: linha.nome, enviado: false, motivo: montado.pendencias.join(' ') })
      continue
    }

    const envio = await enviarEmail({
      para: [linha.email as string],
      assunto: montado.assunto,
      html: html(montado.paragrafos, montado.numeros),
      marca: 'reallife',
      nomeRemetente: quem.nome,
      responderPara: quem.email || undefined,
    })

    if (envio.enviado) {
      const texto = montado.paragrafos.map((p) => (p === '§NUMEROS' ? montado.numeros : p)).join('\n\n')
      await supabaseAdmin
        .from('estrelas_reconhecimentos')
        .update({
          situacao: 'enviado',
          assunto_enviado: montado.assunto,
          texto_enviado: texto,
          enviado_em: new Date().toISOString(),
          enviado_por: quem.id,
          erro_envio: null,
        })
        .eq('id', linha.id)
        .eq('situacao', 'rascunho')
      resultado.push({ id: linha.id, nome: linha.nome, enviado: true })
    } else {
      const motivo = String((envio as any).motivo || 'falha no envio').slice(0, 500)
      await supabaseAdmin.from('estrelas_reconhecimentos').update({ erro_envio: motivo }).eq('id', linha.id)
      resultado.push({ id: linha.id, nome: linha.nome, enviado: false, motivo })
    }

    /* O Resend aceita poucos envios por segundo. */
    await espera(600)
  }

  return NextResponse.json({
    ok: true,
    enviados: resultado.filter((r) => r.enviado).length,
    resultado,
  })
}
