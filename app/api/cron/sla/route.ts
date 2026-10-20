import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ehFeriado, horasUteisEntre } from '@/lib/prazo'
import { carregarFeriados } from '@/lib/feriados'
import {
  enderecoDoPortal,
  enviarEmail,
  escapar,
  marcaDaEmpresa,
  montarEmail,
} from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * "Aguardando cliente" fica fora: o SLA está pausado, então o chamado
 * não está atrasando (o prazo é estendido quando o atendimento volta).
 */
const EM_ABERTO = ['aberto', 'em_atendimento']

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET

  if (!segredo) {
    return true
  }

  return request.headers.get('authorization') === 'Bearer ' + segredo
}

/* Atraso medido em horas úteis: 8 por dia, de segunda a sexta. */
function horasDeAtraso(prazo: string) {
  return Math.round(Math.abs(horasUteisEntre(new Date(), new Date(prazo))))
}

/*
 * Alerta diário de SLA: lista os chamados em aberto cujo prazo já
 * passou e manda para a equipe interna. Quem tem chamado atrasado no
 * próprio nome recebe também um aviso direto.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  /* Feriados do calendário do SLA (lidos de novo a cada execução). */
  await carregarFeriados(supabaseAdmin, true)

  /*
   * Sábado, domingo e feriado não têm expediente: o prazo não anda, então
   * não há alerta novo para mandar. ?forcar=1 roda assim mesmo (teste).
   */
  const hojePVH = new Date(Date.now() - 4 * 60 * 60 * 1000)
  const diaSemana = hojePVH.getUTCDay()
  const dataPVH = hojePVH.toISOString().slice(0, 10)
  const forcar = new URL(request.url).searchParams.get('forcar') === '1'

  if (!forcar && (diaSemana === 0 || diaSemana === 6 || ehFeriado(dataPVH))) {
    return NextResponse.json({
      sucesso: true,
      pulado: diaSemana === 0 || diaSemana === 6 ? 'fim de semana' : 'feriado',
      data: dataPVH,
    })
  }

  const { data, error } = await supabaseAdmin
    .from('chamados')
    .select(
      'id, numero, assunto, prioridade, status, prazo_sla, responsavel_id, empresas(nome_fantasia, razao_social, marca)'
    )
    .in('status', EM_ABERTO)
    .not('prazo_sla', 'is', null)
    .lt('prazo_sla', new Date().toISOString())
    .order('prazo_sla')

  if (error) {
    return NextResponse.json(
      { erro: 'Falha ao ler os chamados.', detalhe: error.message },
      { status: 500 }
    )
  }

  const atrasados = (data || []).map((c: any) => ({
    ...c,
    empresas: Array.isArray(c.empresas) ? c.empresas[0] : c.empresas,
  }))

  if (!atrasados.length) {
    return NextResponse.json({ sucesso: true, atrasados: 0, envios: 0 })
  }

  const marca = marcaDaEmpresa(atrasados[0].empresas?.marca)
  const portal = enderecoDoPortal(marca)

  function linhas(itens: any[]) {
    return (
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 4px;">' +
      itens
        .map((c) => {
          const empresa =
            c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa'

          return (
            '<tr><td style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">' +
            '<strong>#' +
            (c.numero ?? '') +
            ' · ' +
            escapar(c.assunto) +
            '</strong><br><span style="font-size:13px;color:#b91c1c;">' +
            escapar(empresa) +
            ' · ' +
            horasDeAtraso(c.prazo_sla) +
            'h em atraso · prioridade ' +
            escapar(c.prioridade) +
            '</span></td></tr>'
          )
        })
        .join('') +
      '</table>'
    )
  }

  let envios = 0

  const { data: internos } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .in('perfil', ['atendimento', 'gestor', 'admin'])
    .eq('ativo', true)

  const paraEquipe = (internos || []).map((p) => p.email || '')

  const resultadoEquipe = await enviarEmail({
    para: paraEquipe,
    assunto: atrasados.length + ' chamado(s) com SLA atrasado',
    html: montarEmail(
      marca,
      'Chamados com prazo vencido',
      [
        'Estes chamados passaram do prazo e continuam em aberto:',
        linhas(atrasados),
      ],
      { rotulo: 'Abrir o quadro', url: portal + '/atendimento' },
      'Alerta diário automático.'
    ),
    marca,
  })

  if (resultadoEquipe.enviado) envios++

  const porResponsavel = new Map<string, any[]>()

  for (const c of atrasados) {
    if (!c.responsavel_id) continue

    const lista = porResponsavel.get(c.responsavel_id) || []
    lista.push(c)
    porResponsavel.set(c.responsavel_id, lista)
  }

  for (const [responsavelId, itens] of porResponsavel) {
    const { data: pessoa } = await supabaseAdmin
      .from('profiles')
      .select('email, nome')
      .eq('id', responsavelId)
      .eq('ativo', true)
      .maybeSingle()

    if (!pessoa?.email) continue

    const r = await enviarEmail({
      para: [pessoa.email],
      assunto:
        'Você tem ' + itens.length + ' chamado(s) com prazo vencido',
      html: montarEmail(
        marca,
        'Prazo vencido nos seus chamados',
        [
          escapar(pessoa.nome || 'Olá') +
            ', estes chamados estão no seu nome e passaram do prazo:',
          linhas(itens),
        ],
        { rotulo: 'Abrir o quadro', url: portal + '/atendimento' },
        'Alerta diário automático.'
      ),
      marca,
    })

    if (r.enviado) envios++
  }

  return NextResponse.json({
    sucesso: true,
    atrasados: atrasados.length,
    envios,
  })
}
