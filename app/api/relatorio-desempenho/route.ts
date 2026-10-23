import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { escreverAnalise, gerarRelatorio } from '@/lib/relatorioDesempenhoGerar'
import { mesValido } from '@/lib/relatorioDesempenhoServidor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * Relatório mensal de desempenho (supabase/relatorio-desempenho.sql).
 * Só quem tem "acesso ao relatório de gestão" (Leonardo e Priscila).
 * A leitura é feita direto pela tela (o banco filtra); aqui só se gera.
 *
 * POST { acao: 'gerar', mes: 'AAAA-MM' }   -> nova versão do mês
 * POST { acao: 'analisar', id }            -> refaz só o texto da análise
 */
async function quemPede(request: Request) {
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
    .select('id, perfil, ativo, acesso_relatorio_gestao')
    .eq('id', user.id)
    .maybeSingle()

  const p = data as any
  if (!p || p.ativo !== true || !['atendimento', 'gestor', 'admin'].includes(p.perfil) || p.acesso_relatorio_gestao !== true) return null

  return p.id as string
}

export async function POST(request: Request) {
  const usuario = await quemPede(request)
  if (!usuario) return NextResponse.json({ erro: 'Acesso restrito.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))

  try {
    if (body.acao === 'gerar') {
      if (!mesValido(body.mes)) return NextResponse.json({ erro: 'Mês inválido.' }, { status: 400 })
      const r = await gerarRelatorio(supabaseAdmin, body.mes, usuario)
      return NextResponse.json({ ok: true, id: r.id, versao: r.versao })
    }

    if (body.acao === 'analisar') {
      const id = Number(body.id)
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ erro: 'Relatório inválido.' }, { status: 400 })

      const { data: rel, error } = await supabaseAdmin.from('relatorios_desempenho').select('id, analise_em').eq('id', id).maybeSingle()
      if (error || !rel) return NextResponse.json({ erro: 'Relatório não encontrado.' }, { status: 404 })

      /* Evita disparos repetidos da IA (custo): 2 minutos entre análises. */
      const ultima = (rel as any).analise_em ? new Date((rel as any).analise_em).getTime() : 0
      if (Date.now() - ultima < 120000) {
        return NextResponse.json({ erro: 'A análise acabou de ser feita. Aguarde 2 minutos para refazer.' }, { status: 429 })
      }

      const r = await escreverAnalise(supabaseAdmin, id)
      await supabaseAdmin.from('relatorios_desempenho_acessos').insert({ relatorio_id: id, usuario_id: usuario, acao: 'reanalisou' })
      return NextResponse.json({ ok: true, origem: r.origem, aviso: r.erro })
    }

    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  } catch (e: any) {
    console.error('relatorio-desempenho', e)
    return NextResponse.json({ erro: 'Não foi possível gerar: ' + (e?.message || 'erro') }, { status: 500 })
  }
}
