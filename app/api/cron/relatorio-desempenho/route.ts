import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarRelatorio } from '@/lib/relatorioDesempenhoGerar'
import { mesAnteriorAoAtual } from '@/lib/relatorioDesempenhoServidor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true
  return request.headers.get('authorization') === 'Bearer ' + segredo
}

/*
 * Todo dia 1º: gera o relatório do mês anterior, se ainda não existir.
 * Não devolve conteúdo (o relatório é restrito); só o resultado.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })

  const mes = mesAnteriorAoAtual()

  const { data: existente, error } = await supabaseAdmin
    .from('relatorios_desempenho')
    .select('id')
    .eq('mes', mes + '-01')
    .limit(1)

  if (error) return NextResponse.json({ erro: 'Tabela do relatório indisponível: ' + error.message }, { status: 500 })
  if (existente && existente.length) return NextResponse.json({ ok: true, mes, situacao: 'já existia' })

  try {
    const r = await gerarRelatorio(supabaseAdmin, mes, null, request.headers.get('x-vercel-oidc-token'))
    return NextResponse.json({ ok: true, mes, situacao: 'gerado', versao: r.versao })
  } catch (e: any) {
    console.error('cron relatorio-desempenho', e)
    return NextResponse.json({ erro: e?.message || 'erro' }, { status: 500 })
  }
}
