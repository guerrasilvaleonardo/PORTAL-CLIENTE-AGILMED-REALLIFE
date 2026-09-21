import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  diasAte,
  enderecoDoPortal,
  enviarEmail,
  escapar,
  formatarData,
  marcaDaEmpresa,
  montarEmail,
} from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JANELAS = [90, 30, 7]

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET

  if (!segredo) {
    return true
  }

  return request.headers.get('authorization') === 'Bearer ' + segredo
}

function faixa(dias: number | null) {
  if (dias === null) return null
  if (dias < 0) return 'vencido'
  if (dias <= 7) return '7'
  if (dias <= 30) return '30'
  if (dias <= 90) return '90'
  return null
}

/*
 * Boletim de Antecedência. Roda uma vez por semana e avisa cada
 * empresa dos certificados que vencem nos próximos 90, 30 e 7 dias,
 * além dos que já venceram. A equipe interna recebe o consolidado.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const limite = new Date()
  limite.setDate(limite.getDate() + Math.max(...JANELAS))

  const { data: certificados, error } = await supabaseAdmin
    .from('certificados')
    .select(
      'id, numero, colaborador, funcao, tipo, validade, empresa_id, empresas(nome_fantasia, razao_social, marca)'
    )
    .not('validade', 'is', null)
    .lte('validade', limite.toISOString().slice(0, 10))
    .order('validade')

  if (error) {
    return NextResponse.json(
      { erro: 'Falha ao ler os certificados.', detalhe: error.message },
      { status: 500 }
    )
  }

  const relevantes = (certificados || [])
    .map((c: any) => ({
      ...c,
      empresas: Array.isArray(c.empresas) ? c.empresas[0] : c.empresas,
      dias: diasAte(c.validade),
    }))
    .filter((c) => faixa(c.dias) !== null)

  if (!relevantes.length) {
    return NextResponse.json({ sucesso: true, certificados: 0, envios: 0 })
  }

  const porEmpresa = new Map<string, any[]>()

  for (const c of relevantes) {
    const lista = porEmpresa.get(c.empresa_id) || []
    lista.push(c)
    porEmpresa.set(c.empresa_id, lista)
  }

  function linhas(itens: any[]) {
    return (
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 4px;">' +
      itens
        .map((c) => {
          const dias = c.dias as number
          const cor = dias < 0 ? '#b91c1c' : dias <= 30 ? '#b45309' : '#0f172a'

          const situacao =
            dias < 0
              ? 'venceu há ' + Math.abs(dias) + ' dia(s)'
              : 'vence em ' + dias + ' dia(s)'

          return (
            '<tr><td style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">' +
            '<strong>' +
            escapar(c.colaborador) +
            '</strong> — ' +
            escapar(c.tipo) +
            '<br><span style="color:' +
            cor +
            ';font-size:13px;">' +
            formatarData(c.validade) +
            ' · ' +
            situacao +
            '</span></td></tr>'
          )
        })
        .join('') +
      '</table>'
    )
  }

  let envios = 0

  for (const [empresaId, itens] of porEmpresa) {
    const empresa = itens[0].empresas
    const marca = marcaDaEmpresa(empresa?.marca)
    const portal = enderecoDoPortal(marca)

    const { data: pessoas } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)

    const para = (pessoas || []).map((p) => p.email || '')

    const vencidos = itens.filter((c) => (c.dias as number) < 0).length

    const assunto =
      'Boletim de Antecedência — ' +
      itens.length +
      ' certificado(s) a vencer' +
      (vencidos ? ' e ' + vencidos + ' vencido(s)' : '')

    const html = montarEmail(
      marca,
      'Certificados a vencer',
      [
        'Este é o boletim de antecedência de <strong>' +
          escapar(empresa?.nome_fantasia || empresa?.razao_social || 'sua empresa') +
          '</strong>.',
        linhas(itens),
      ],
      { rotulo: 'Ver os certificados', url: portal + '/certificados' },
      'Boletim semanal automático.'
    )

    const r = await enviarEmail({ para, assunto, html, marca })

    if (r.enviado) envios++
  }

  const { data: internos } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .in('perfil', ['atendimento', 'gestor', 'admin'])
    .eq('ativo', true)

  const paraInterno = (internos || []).map((p) => p.email || '')

  if (paraInterno.length) {
    const resumo = [...porEmpresa.entries()].map(([, itens]) => {
      const e = itens[0].empresas
      return (
        '<li style="margin-bottom:6px;">' +
        escapar(e?.nome_fantasia || e?.razao_social || 'Empresa') +
        ': <strong>' +
        itens.length +
        '</strong> certificado(s)</li>'
      )
    })

    const html = montarEmail(
      'reallife',
      'Boletim de Antecedência — consolidado',
      [
        'Resumo dos certificados a vencer nos próximos 90 dias:',
        '<ul style="margin:0;padding-left:18px;color:#334155;font-size:15px;line-height:1.6;">' +
          resumo.join('') +
          '</ul>',
      ],
      {
        rotulo: 'Abrir o painel',
        url: enderecoDoPortal('reallife') + '/certificados',
      },
      'Boletim semanal automático.'
    )

    const r = await enviarEmail({
      para: paraInterno,
      assunto: 'Boletim de Antecedência — consolidado',
      html,
      marca: 'reallife',
    })

    if (r.enviado) envios++
  }

  return NextResponse.json({
    sucesso: true,
    certificados: relevantes.length,
    empresas: porEmpresa.size,
    envios,
  })
}
