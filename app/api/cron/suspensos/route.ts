import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ehFeriado } from '@/lib/prazo'
import { carregarFeriados } from '@/lib/feriados'
import { enderecoDoPortal, enviarEmail, escapar, marcaDaEmpresa, montarEmail } from '@/lib/email'
import {
  DIAS_UTEIS_ESCALONAR_GESTOR,
  diasUteisDepois,
  hojeEmPortoVelho,
  precisaEscalonar,
  situacaoRevisao,
} from '@/lib/revisaoSuspensao'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * Revisão dos chamados suspensos (supabase/chamados-arquivo-e-revisao-suspensos.sql).
 *
 * Roda às 6h de Porto Velho, em dia útil:
 *  - o responsável recebe um e-mail com os seus suspensos cuja próxima
 *    atualização é hoje ou já passou (reativar ou reprogramar);
 *  - gestor e admin recebem um e-mail com os suspensos com a revisão
 *    vencida há 1 dia útil ou mais.
 * Só e-mail interno: o cliente não recebe nada daqui. Não mexe em
 * estrelas nem em prazo. ?forcar=1 ignora fim de semana e feriado.
 */

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true
  return request.headers.get('authorization') === 'Bearer ' + segredo
}

function dataBR(valor: string) {
  const [a, m, d] = valor.slice(0, 10).split('-')
  return d + '/' + m + '/' + a
}

type Suspenso = {
  id: string
  numero: number
  assunto: string
  responsavel_id: string | null
  suspensao_proxima: string
  suspensao_motivo: string | null
  empresa: string
}

function linhas(lista: Suspenso[], portal: string, hoje: string) {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' +
    lista
      .map((c) => {
        const vencida = situacaoRevisao(c.suspensao_proxima, hoje) === 'vencida'
        const dias = vencida ? diasUteisDepois(c.suspensao_proxima, hoje) : 0
        const situacao = vencida
          ? 'vencida desde ' + dataBR(c.suspensao_proxima) + (dias ? ' (' + dias + (dias === 1 ? ' dia útil)' : ' dias úteis)') : '')
          : 'revisar hoje'

        return (
          '<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">' +
          '<a href="' + portal + '/atendimento/' + c.id + '" style="color:#0f172a;font-weight:700;">#' +
          escapar(String(c.numero)) + ' · ' + escapar(c.assunto) + '</a><br>' +
          '<span style="font-size:13px;color:' + (vencida ? '#b91c1c' : '#92400e') + ';">Revisão ' + situacao + '</span>' +
          '<span style="font-size:13px;color:#64748b;"> · ' + escapar(c.empresa) +
          (c.suspensao_motivo ? ' · ' + escapar(c.suspensao_motivo) : '') + '</span></td></tr>'
        )
      })
      .join('') +
    '</table>'
  )
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  await carregarFeriados(supabaseAdmin, true)

  const hoje = hojeEmPortoVelho()
  const diaSemana = new Date(hoje + 'T12:00:00Z').getUTCDay()
  const forcar = new URL(request.url).searchParams.get('forcar') === '1'

  if (!forcar && (diaSemana === 0 || diaSemana === 6 || ehFeriado(hoje))) {
    return NextResponse.json({
      sucesso: true,
      pulado: diaSemana === 0 || diaSemana === 6 ? 'fim de semana' : 'feriado',
      data: hoje,
    })
  }

  const { data, error } = await supabaseAdmin
    .from('chamados')
    .select('id, numero, assunto, responsavel_id, suspensao_proxima, suspensao_motivo, empresas(nome_fantasia, razao_social)')
    .eq('status', 'suspenso')
    .not('suspensao_proxima', 'is', null)
    .lte('suspensao_proxima', hoje)
    .order('suspensao_proxima')

  if (error) {
    return NextResponse.json({
      sucesso: true,
      pulado: 'SQL de suspensão ainda não aplicado',
      detalhe: error.message,
    })
  }

  const pendentes: Suspenso[] = ((data || []) as any[]).map((c) => {
    const emp = Array.isArray(c.empresas) ? c.empresas[0] : c.empresas

    return {
      id: c.id,
      numero: c.numero,
      assunto: c.assunto || '',
      responsavel_id: c.responsavel_id,
      suspensao_proxima: String(c.suspensao_proxima).slice(0, 10),
      suspensao_motivo: c.suspensao_motivo,
      empresa: emp?.nome_fantasia || emp?.razao_social || 'Empresa',
    }
  })

  if (!pendentes.length) {
    return NextResponse.json({ sucesso: true, pendentes: 0, envios: 0 })
  }

  const { data: equipe } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, perfil, ativo')
    .in('perfil', ['atendimento', 'gestor', 'admin'])

  const pessoas = new Map(((equipe || []) as any[]).map((p) => [p.id, p]))

  /* E-mail interno: sai com a identidade da Real Life (portal da equipe). */
  const marca = marcaDaEmpresa(null)
  const portal = enderecoDoPortal(marca)

  let envios = 0
  const semResponsavel: number[] = []

  /* 1. Cada responsável: os seus suspensos de hoje e vencidos. */
  const porResponsavel = new Map<string, Suspenso[]>()

  for (const c of pendentes) {
    if (!c.responsavel_id) {
      semResponsavel.push(c.numero)
      continue
    }
    porResponsavel.set(c.responsavel_id, [...(porResponsavel.get(c.responsavel_id) || []), c])
  }

  for (const [id, lista] of porResponsavel) {
    const p: any = pessoas.get(id)
    if (!p || p.ativo === false || !p.email) continue

    const vencidos = lista.filter((c) => situacaoRevisao(c.suspensao_proxima, hoje) === 'vencida').length

    const r = await enviarEmail({
      para: [p.email],
      assunto:
        lista.length === 1
          ? 'Revisar o chamado suspenso #' + lista[0].numero
          : lista.length + ' chamados suspensos para revisar' + (vencidos ? ' (' + vencidos + ' vencido(s))' : ''),
      html: montarEmail(
        marca,
        'Suspensos para revisar hoje',
        [
          'Bom dia' + (p.nome ? ', ' + escapar(String(p.nome).split(' ')[0]) : '') + '. Estes chamados suspensos chegaram à data da próxima atualização:',
          linhas(lista, portal, hoje),
          'Para cada um: <strong>reative o atendimento</strong> ou <strong>reprograme a revisão</strong> com nova data e motivo. Isso não afeta as estrelas; a revisão vencida aparece no dashboard da equipe.',
        ],
        { rotulo: 'Abrir o quadro', url: portal + '/atendimento' }
      ),
      marca,
    })

    if (r.enviado) envios++
  }

  /* 2. Gestão: vencidos há 1 dia útil ou mais, e os sem responsável. */
  const escalonar = pendentes.filter(
    (c) => precisaEscalonar(c.suspensao_proxima, hoje) || !c.responsavel_id
  )
  let enviosGestao = 0

  if (escalonar.length) {
    const gestores = ((equipe || []) as any[])
      .filter((p) => ['gestor', 'admin'].includes(p.perfil) && p.ativo !== false && p.email)
      .map((p) => p.email as string)

    const comResponsavel = escalonar.map((c) => ({
      ...c,
      assunto: c.assunto + (c.responsavel_id ? ' — ' + ((pessoas.get(c.responsavel_id) as any)?.nome || 'responsável') : ' — sem responsável'),
    }))

    if (gestores.length) {
      const r = await enviarEmail({
        para: gestores,
        assunto: escalonar.length + ' chamado(s) suspenso(s) pedem atenção da gestão',
        html: montarEmail(
          marca,
          'Revisão de suspensos vencida',
          [
            'Estes chamados suspensos passaram da data da próxima atualização há ' +
              DIAS_UTEIS_ESCALONAR_GESTOR +
              ' dia útil ou mais sem reativação nem reprogramação, ou estão sem responsável:',
            linhas(comResponsavel, portal, hoje),
            'O cliente não vê "vencido": no portal dele aparece "atualização em andamento pela equipe".',
          ],
          { rotulo: 'Abrir o quadro', url: portal + '/atendimento' }
        ),
        marca,
      })

      if (r.enviado) enviosGestao++
    }
  }

  return NextResponse.json({
    sucesso: true,
    data: hoje,
    pendentes: pendentes.length,
    responsaveisAvisados: envios,
    escalonados: escalonar.length,
    emailsGestao: enviosGestao,
    semResponsavel,
  })
}
