import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enviarEmail } from '@/lib/email'
import { pessoasDaEmpresa } from '@/lib/pessoasDaEmpresa'
import { carregarFeriados } from '@/lib/feriados'
import { ehDiaUtil, emailDoAviso, hojePortoVelho, montarAvisos, registrarEstado } from '@/lib/avisoTreinamentos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * AVISO DIÁRIO DO ANDAMENTO DOS TREINAMENTOS (supabase/treinamentos-aviso-diario.sql)
 *
 * Seg a sex, 7h30 de Porto Velho (depois da leitura do EAD das 5h): cada
 * empresa com a ferramenta Treinamentos recebe os treinamentos em aberto
 * de cada colaborador. Sem pendência, não recebe.
 *
 * Quem dispara:
 *   - agendador da Vercel (CRON_SECRET; sem CRON_SECRET, só o agendador
 *     da Vercel pelo user-agent)                     -> envia
 *   - equipe interna logada com ?previa=1            -> só mostra o que seria
 *     enviado (nada é enviado nem gravado)
 * Cada empresa recebe no máximo um aviso por dia.
 */

async function equipeInterna(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer /i, '').trim()
  if (!token) return false
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return false
  const { data: p } = await supabaseAdmin.from('profiles').select('perfil, ativo').eq('id', data.user.id).maybeSingle()
  return !!p && p.ativo === true && ['atendimento', 'gestor', 'admin'].includes((p as any).perfil)
}

function agendador(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (segredo) return request.headers.get('authorization') === 'Bearer ' + segredo
  return (request.headers.get('user-agent') || '').toLowerCase().startsWith('vercel-cron')
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const previa = url.searchParams.get('previa') === '1'

  if (previa) {
    if (!(await equipeInterna(request))) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  } else if (!agendador(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    await carregarFeriados(supabaseAdmin, true)

    if (!previa && !(await ehDiaUtil(supabaseAdmin))) {
      return NextResponse.json({ sucesso: true, enviado: false, motivo: 'Não é dia útil.' })
    }

    const { avisos, atualizacoes } = await montarAvisos(supabaseAdmin)

    if (previa) {
      return NextResponse.json({
        sucesso: true,
        previa: true,
        empresas: avisos.map((a) => ({
          empresa: a.empresa,
          pendentes: a.pendentes.length,
          colaboradores: new Set(a.pendentes.map((i) => i.colaborador)).size,
          concluidos_novos: a.concluidos.length,
          aguardando_emissao: a.aguardandoEmissao,
          assunto: emailDoAviso(a).assunto,
        })),
      })
    }

    /* No máximo um aviso por empresa por dia. */
    const hoje = hojePortoVelho()
    const { data: jaEnviados } = await supabaseAdmin
      .from('treinamentos_aviso_envios')
      .select('empresa_id')
      .eq('sucesso', true)
      .gte('enviado_em', hoje + 'T04:00:00Z')
    const enviadosHoje = new Set(((jaEnviados || []) as any[]).map((e) => e.empresa_id))

    const enviadas = new Set<string>()
    let envios = 0

    for (const a of avisos) {
      if (enviadosHoje.has(a.empresaId)) {
        enviadas.add(a.empresaId)
        continue
      }

      const pessoas = await pessoasDaEmpresa(a.empresaId)
      const para = pessoas.map((p) => p.email || '').filter(Boolean)
      const { assunto, html } = emailDoAviso(a)
      const r = await enviarEmail({ para, assunto, html, marca: a.marca })

      await supabaseAdmin.from('treinamentos_aviso_envios').insert({
        empresa_id: a.empresaId,
        pendentes: a.pendentes.length,
        concluidos: a.concluidos.length,
        destinatarios: para.length,
        sucesso: !!r.enviado,
        detalhe: r.enviado ? null : String((r as any).motivo || 'falha').slice(0, 500),
      })

      if (r.enviado) {
        enviadas.add(a.empresaId)
        envios++
      }
    }

    await registrarEstado(supabaseAdmin, atualizacoes, enviadas)

    return NextResponse.json({ sucesso: true, empresas: avisos.length, envios })
  } catch (e: any) {
    console.error('treinamentos-andamento', e)
    return NextResponse.json({ sucesso: false, erro: e?.message || 'erro' }, { status: 500 })
  }
}
