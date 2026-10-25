import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { pessoasDaEmpresa } from '@/lib/pessoasDaEmpresa'
import {
  diasAte,
  enderecoDoPortal,
  enviarEmail,
  escapar,
  formatarData,
  marcaDaEmpresa,
  montarEmail,
} from '@/lib/email'
import { lerTudo } from '@/lib/lerTudo'
import { idsHistorico } from '@/lib/historicoCertificados'
import { carregarDesligados, estaDesligado } from '@/lib/colaboradoresDesligados'

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
/*
 * Empresas que NÃO contrataram a ferramenta (supabase/modulos-cliente.sql)
 * não recebem o e-mail dela; a equipe continua recebendo. Sem a coluna
 * (SQL não rodou), ninguém é bloqueado.
 */
async function empresasSemModulo(coluna: string) {
  const { data, error } = await supabaseAdmin.from('empresas').select('id, ' + coluna)
  if (error) return new Set<string>()
  return new Set((data || []).filter((e: any) => e[coluna] === false).map((e: any) => e.id as string))
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  /*
   * Lê TODOS os certificados (não só os que vencem em até 90 dias):
   * para saber se um certificado vencido já foi renovado, é preciso ver
   * também o certificado novo do mesmo curso, que pode vencer daqui a
   * anos. O recorte de 90/30/7 dias e vencidos é feito logo abaixo,
   * por faixa(), como antes.
   */
  const { data: certificados, error } = await lerTudo<any>(() =>
    supabaseAdmin
      .from('certificados')
      .select(
        'id, numero, colaborador, funcao, tipo, curso, emissao, validade, empresa_id, empresas(nome_fantasia, razao_social, marca)'
      )
      .order('validade', { ascending: true, nullsFirst: false })
      .order('id')
  )

  if (error) {
    return NextResponse.json(
      { erro: 'Falha ao ler os certificados.', detalhe: error.message },
      { status: 500 }
    )
  }

  /*
   * Certificado substituído por um mais novo do mesmo curso e da mesma
   * pessoa é histórico (lib/historicoCertificados.ts): não entra no
   * boletim, nem para o cliente nem no consolidado da equipe.
   */
  const historico = idsHistorico(certificados || [])

  /*
   * Colaborador desligado (lib/colaboradoresDesligados.ts) também não
   * entra. Sem a tabela (SQL não rodou), ninguém é tirado.
   */
  const { mapa: desligados } = await carregarDesligados(supabaseAdmin)

  const relevantes = (certificados || [])
    .filter((c: any) => !historico.has(c.id) && !estaDesligado(desligados, c))
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

  const semContratacao = await empresasSemModulo('modulo_certificados')

  for (const [empresaId, itens] of porEmpresa) {
    if (semContratacao.has(empresaId)) continue

    const empresa = itens[0].empresas
    const marca = marcaDaEmpresa(empresa?.marca)
    const portal = enderecoDoPortal(marca)

    const pessoas = await pessoasDaEmpresa(empresaId)

    const para = pessoas.map((p) => p.email || '')

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
