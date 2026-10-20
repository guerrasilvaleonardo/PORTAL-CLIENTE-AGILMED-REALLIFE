import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { HORAS_SLA, ehFeriado, prazoEmHorasUteis } from '@/lib/prazo'
import { carregarFeriados } from '@/lib/feriados'
import { enderecoDoPortal, enviarEmail, escapar, marcaDaEmpresa, montarEmail } from '@/lib/email'
import {
  DIAS_CHAMADO_AUTOMATICO,
  dataBr,
  diasAteData,
  hojePortoVelho,
  marcoAtual,
  nomeDoTipo,
  proximoPrazo,
  type DocumentoSst,
} from '@/lib/documentosSst'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * Alertas dos Documentos SST (supabase/documentos-sst.sql).
 *
 * Roda em dia útil. Para cada documento vigente, olha o vencimento e a
 * próxima revisão: quando o prazo alcança um dos marcos configurados no
 * documento (padrão 90, 60, 30, 15 e 7 dias) ou passa da data, entra no
 * aviso do dia — uma vez por marco (documentos_sst_alertas). Se o marco
 * cair em fim de semana ou feriado, o aviso sai no próximo dia útil.
 *
 * Cliente: um e-mail por empresa, para os usuários ativos dela.
 * Equipe: o responsável pelo acompanhamento recebe os dele; sem
 * responsável, vai para gestores e administradores.
 *
 * Chamado automático: faltando DIAS_CHAMADO_AUTOMATICO (60) dias ou
 * menos para o próximo prazo e sem nenhum chamado ligado ao documento
 * (chamados.documento_sst_id), o portal abre um chamado de renovação
 * para a empresa, já com o responsável pelo acompanhamento.
 */

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true
  return request.headers.get('authorization') === 'Bearer ' + segredo
}

type Item = {
  doc: DocumentoSst & { empresas: any; documentos_sst_tipos: any }
  prazo: 'vencimento' | 'revisao'
  data: string
  dias: number
  /* -2 = só avisa o chamado aberto hoje (não entra no registro de marcos). */
  marco: number
  chamado?: number
}

function descricao(i: Item) {
  const quando =
    i.dias < 0
      ? (i.prazo === 'vencimento' ? 'venceu há ' : 'revisão atrasada há ') + Math.abs(i.dias) + ' dia(s)'
      : i.dias === 0
        ? (i.prazo === 'vencimento' ? 'vence hoje' : 'revisão programada para hoje')
        : (i.prazo === 'vencimento' ? 'vence em ' : 'revisão em ') + i.dias + ' dia(s)'

  return { quando, cor: i.dias < 0 ? '#b91c1c' : i.dias <= 30 ? '#b45309' : '#0f172a' }
}

function tabela(itens: Item[], comEmpresa: boolean) {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 4px;">' +
    itens
      .map((i) => {
        const { quando, cor } = descricao(i)
        const e = i.doc.empresas
        const empresa = comEmpresa ? escapar(e?.nome_fantasia || e?.razao_social || '') + ' · ' : ''
        const titulo =
          nomeDoTipo(i.doc.documentos_sst_tipos) +
          (i.doc.versao ? ' · ' + i.doc.versao : '') +
          (i.doc.unidade ? ' — ' + i.doc.unidade : '')

        return (
          '<tr><td style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">' +
          empresa +
          '<strong>' +
          escapar(titulo) +
          '</strong>' +
          (i.doc.titulo ? '<br><span style="font-size:13px;">' + escapar(i.doc.titulo) + '</span>' : '') +
          '<br><span style="color:' +
          cor +
          ';font-size:13px;">' +
          dataBr(i.data) +
          ' · ' +
          quando +
          (i.doc.link_assinado ? '' : ' · sem versão assinada no portal') +
          '</span>' +
          (i.chamado
            ? '<br><span style="font-size:13px;color:#0f766e;"><strong>Chamado #' + i.chamado + '</strong> de renovação aberto automaticamente.</span>'
            : '') +
          '</td></tr>'
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

  const hoje = hojePortoVelho()
  const diaSemana = new Date(hoje + 'T12:00:00Z').getUTCDay()
  const forcar = new URL(request.url).searchParams.get('forcar') === '1'

  if (!forcar && (diaSemana === 0 || diaSemana === 6 || ehFeriado(hoje))) {
    return NextResponse.json({ sucesso: true, pulado: diaSemana === 0 || diaSemana === 6 ? 'fim de semana' : 'feriado', data: hoje })
  }

  const { data: docs, error } = await supabaseAdmin
    .from('documentos_sst')
    .select('*, empresas(nome_fantasia, razao_social, marca, interna), documentos_sst_tipos(nome, sigla)')
    .eq('situacao', 'vigente')

  if (error) {
    return NextResponse.json({ sucesso: true, pulado: 'SQL de Documentos SST ainda não aplicado', detalhe: error.message })
  }

  const { data: enviados } = await supabaseAdmin
    .from('documentos_sst_alertas')
    .select('documento_id, prazo, data_prazo, marco')

  const jaAvisado = new Set((enviados || []).map((a: any) => [a.documento_id, a.prazo, a.data_prazo, a.marco].join('|')))

  const itens: Item[] = []

  for (const d of (docs || []) as Item['doc'][]) {
    d.empresas = Array.isArray(d.empresas) ? d.empresas[0] : d.empresas
    d.documentos_sst_tipos = Array.isArray(d.documentos_sst_tipos) ? d.documentos_sst_tipos[0] : d.documentos_sst_tipos

    for (const [prazo, data] of [
      ['vencimento', d.vencimento],
      ['revisao', d.proxima_revisao],
    ] as const) {
      if (!data) continue
      const dias = diasAteData(data, hoje)
      const marco = marcoAtual(dias, d.alertas)
      if (marco === null || dias === null) continue
      if (jaAvisado.has([d.id, prazo, data, marco].join('|'))) continue
      itens.push({ doc: d, prazo, data, dias, marco })
    }
  }

  /* ---------- Chamado automático de renovação ---------- */
  const abertos: { documento: string; chamado: number }[] = []
  let erroChamado: string | null = null

  const { data: ligados, error: erroLigados } = await supabaseAdmin
    .from('chamados')
    .select('documento_sst_id')
    .not('documento_sst_id', 'is', null)

  if (erroLigados) {
    erroChamado = 'coluna chamados.documento_sst_id ainda não existe: ' + erroLigados.message
  } else {
    const comChamado = new Set((ligados || []).map((c: any) => c.documento_sst_id))

    const { data: equipe } = await supabaseAdmin
      .from('profiles')
      .select('id, perfil')
      .in('perfil', ['admin', 'gestor'])
      .eq('ativo', true)
      .order('perfil')

    const gestorPadrao = (equipe || []).find((p: any) => p.perfil === 'admin')?.id || (equipe || [])[0]?.id

    for (const d of (docs || []) as Item['doc'][]) {
      if (d.chamado_automatico === false || comChamado.has(d.id) || d.empresas?.interna) continue

      const prazo = proximoPrazo(d)
      const dias = prazo ? diasAteData(prazo.data, hoje) : null
      if (!prazo || dias === null || dias > DIAS_CHAMADO_AUTOMATICO) continue

      const criadoPor = d.responsavel_id || gestorPadrao
      if (!criadoPor) continue

      const nome = nomeDoTipo(d.documentos_sst_tipos) + (d.unidade ? ' — ' + d.unidade : '')
      const quando =
        dias < 0
          ? (prazo.tipo === 'vencimento' ? 'venceu em ' : 'a revisão programada era para ') + dataBr(prazo.data)
          : (prazo.tipo === 'vencimento' ? 'vence em ' : 'tem revisão programada para ') +
            dataBr(prazo.data) +
            ' (' + dias + ' dia' + (dias === 1 ? '' : 's') + ')'

      const { data: novo, error: erroNovo } = await supabaseAdmin
        .from('chamados')
        .insert({
          empresa_id: d.empresa_id,
          criado_por: criadoPor,
          responsavel_id: d.responsavel_id || null,
          categoria: 'Documentos',
          assunto: 'Renovação: ' + nome,
          descricao:
            'Chamado aberto automaticamente pelo portal: o documento ' +
            nome +
            (d.versao ? ' (' + d.versao + ')' : '') +
            (d.titulo ? ' — ' + d.titulo : '') +
            ' ' + quando +
            ' e ainda não havia pedido de renovação.' +
            '\n\nPara a renovação, informe as alterações desde a última versão (processos, funções, ambientes, número de trabalhadores) ou confirme que não houve mudanças.',
          prioridade: 'normal',
          status: 'aberto',
          prazo_sla: prazoEmHorasUteis(HORAS_SLA.normal ?? 24).toISOString(),
          visibilidade: 'empresa',
          documento_sst_id: d.id,
        })
        .select('numero')
        .single()

      if (erroNovo) {
        erroChamado = erroNovo.message
        console.error('Chamado automático do documento ' + d.id + ':', erroNovo)
        continue
      }

      comChamado.add(d.id)
      abertos.push({ documento: d.id, chamado: (novo as any).numero })

      /* Entra no aviso do dia mesmo que hoje não seja dia de marco. */
      const item = itens.find((i) => i.doc.id === d.id)
      if (item) item.chamado = (novo as any).numero
      else itens.push({ doc: d, prazo: prazo.tipo, data: prazo.data, dias, marco: -2, chamado: (novo as any).numero })
    }
  }

  if (!itens.length) {
    return NextResponse.json({ sucesso: true, data: hoje, avisos: 0, envios: 0, chamados: abertos, erroChamado })
  }

  itens.sort((a, b) => a.dias - b.dias)

  const avisados = new Set<Item>()
  let envios = 0

  /* Cliente: um e-mail por empresa. */
  const porEmpresa = new Map<string, Item[]>()
  for (const i of itens) porEmpresa.set(i.doc.empresa_id, [...(porEmpresa.get(i.doc.empresa_id) || []), i])

  for (const [empresaId, lista] of porEmpresa) {
    const empresa = lista[0].doc.empresas
    const marca = marcaDaEmpresa(empresa?.marca)

    const { data: pessoas } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)

    const para = (pessoas || []).map((p: any) => p.email || '').filter(Boolean)
    if (!para.length) continue

    const vencidos = lista.filter((i) => i.dias < 0).length

    const r = await enviarEmail({
      para,
      assunto:
        'Documentos SST — ' +
        lista.length +
        ' prazo(s) próximo(s)' +
        (vencidos ? ', ' + vencidos + ' vencido(s)' : '') +
        ' — ' +
        (empresa?.nome_fantasia || empresa?.razao_social || 'sua empresa'),
      html: montarEmail(
        marca,
        'Prazos dos documentos de SST',
        [
          'Estes documentos de <strong>' +
            escapar(empresa?.nome_fantasia || empresa?.razao_social || 'sua empresa') +
            '</strong> estão com prazo de vencimento ou de revisão próximo:',
          tabela(lista, false),
          'Quando faltam ' + DIAS_CHAMADO_AUTOMATICO + ' dias ou menos e ninguém pediu a renovação, abrimos o chamado automaticamente. Para pedir antes, abra o documento no portal e clique em "Solicitar renovação".',
        ],
        { rotulo: 'Ver os documentos', url: enderecoDoPortal(marca) + '/documentos' },
        'Aviso automático do Portal do Cliente.'
      ),
      marca,
    })

    if (r.enviado) {
      envios++
      lista.forEach((i) => avisados.add(i))
    }
  }

  /* Equipe: por responsável; sem responsável, gestores e admins. */
  const { data: equipe } = await supabaseAdmin
    .from('profiles')
    .select('id, email, perfil')
    .in('perfil', ['atendimento', 'gestor', 'admin'])
    .eq('ativo', true)

  const emailDe = new Map((equipe || []).map((p: any) => [p.id, p.email || '']))
  const gestores = (equipe || []).filter((p: any) => p.perfil !== 'atendimento').map((p: any) => p.email || '').filter(Boolean)

  const porDestino = new Map<string, Item[]>()
  for (const i of itens) {
    const chave = i.doc.responsavel_id && emailDe.get(i.doc.responsavel_id) ? i.doc.responsavel_id : '_gestores'
    porDestino.set(chave, [...(porDestino.get(chave) || []), i])
  }

  for (const [destino, lista] of porDestino) {
    const para = destino === '_gestores' ? gestores : [emailDe.get(destino) as string]
    if (!para.length) continue

    const r = await enviarEmail({
      para,
      assunto: 'Documentos SST — ' + lista.length + ' prazo(s) para acompanhar',
      html: montarEmail(
        'reallife',
        'Documentos SST para acompanhar',
        [
          destino === '_gestores'
            ? 'Documentos sem responsável pelo acompanhamento definido:'
            : 'Documentos sob o seu acompanhamento com prazo próximo:',
          tabela(lista, true),
        ],
        { rotulo: 'Abrir Documentos SST', url: enderecoDoPortal('reallife') + '/documentos' },
        'Aviso automático do Portal do Cliente.'
      ),
      marca: 'reallife',
    })

    if (r.enviado) {
      envios++
      lista.forEach((i) => avisados.add(i))
    }
  }

  const registrar = [...avisados].filter((i) => i.marco !== -2)

  if (registrar.length) {
    await supabaseAdmin.from('documentos_sst_alertas').upsert(
      registrar.map((i) => ({ documento_id: i.doc.id, prazo: i.prazo, data_prazo: i.data, marco: i.marco })),
      { onConflict: 'documento_id,prazo,data_prazo,marco', ignoreDuplicates: true }
    )
  }

  return NextResponse.json({ sucesso: true, data: hoje, avisos: itens.length, registrados: registrar.length, envios, chamados: abertos, erroChamado })
}
