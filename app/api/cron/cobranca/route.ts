import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ehFeriado, horasUteisEntre } from '@/lib/prazo'
import { carregarFeriados } from '@/lib/feriados'
import { enderecoDoPortal, enviarEmail, escapar, marcaDaEmpresa, montarEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * Cobrança do cliente (supabase/chamados-cobranca-e-suspensao.sql).
 *
 * Chamado em "Aguardando cliente" há mais dias corridos que o prazo da
 * empresa (empresas.dias_cobranca, padrão 7) recebe e-mail de cobrança
 * para o solicitante, quem abriu (se cliente) e os participantes do
 * cliente. Repete a cada 3 dias úteis enquanto continuar parado.
 * Empresa interna fica fora. Só roda em dia útil (?forcar=1 ignora).
 */

/* 3 dias úteis = 24 horas úteis; folga de meia hora pela variação do horário do cron. */
const HORAS_ENTRE_COBRANCAS = 23.5

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true
  return request.headers.get('authorization') === 'Bearer ' + segredo
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Porto_Velho' })
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  await carregarFeriados(supabaseAdmin, true)

  const agora = new Date()
  const hojePVH = new Date(agora.getTime() - 4 * 60 * 60 * 1000)
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

  const { data: empresas, error: erroEmpresas } = await supabaseAdmin
    .from('empresas')
    .select('id, nome_fantasia, razao_social, marca, dias_cobranca, interna')
    .eq('interna', false)

  if (erroEmpresas) {
    return NextResponse.json({
      sucesso: true,
      pulado: 'SQL de cobrança ainda não aplicado',
      detalhe: erroEmpresas.message,
    })
  }

  const porEmpresa = new Map((empresas || []).map((e: any) => [e.id, e]))

  if (!porEmpresa.size) {
    return NextResponse.json({ sucesso: true, vencidos: 0, envios: 0 })
  }

  const { data: chamados, error: erroChamados } = await supabaseAdmin
    .from('chamados')
    .select('id, numero, assunto, empresa_id, sla_pausado_em, solicitante_id, criado_por')
    .eq('status', 'aguardando_cliente')
    .not('sla_pausado_em', 'is', null)
    .in('empresa_id', [...porEmpresa.keys()])

  if (erroChamados) {
    return NextResponse.json(
      { erro: 'Falha ao ler os chamados.', detalhe: erroChamados.message },
      { status: 500 }
    )
  }

  const vencidos = (chamados || []).filter((c: any) => {
    const empresa: any = porEmpresa.get(c.empresa_id)
    const limite = Number(empresa?.dias_cobranca ?? 7)
    const parado = agora.getTime() - new Date(c.sla_pausado_em).getTime()
    return parado >= limite * 24 * 60 * 60 * 1000
  })

  if (!vencidos.length) {
    return NextResponse.json({ sucesso: true, vencidos: 0, envios: 0 })
  }

  const ids = vencidos.map((c: any) => c.id)

  const [{ data: anteriores }, { data: participantes }] = await Promise.all([
    supabaseAdmin
      .from('chamado_cobrancas')
      .select('chamado_id, enviada_em')
      .in('chamado_id', ids)
      .order('enviada_em', { ascending: false }),
    supabaseAdmin.from('chamado_participantes').select('chamado_id, usuario_id').in('chamado_id', ids),
  ])

  const ultima = new Map<string, string>()
  for (const a of anteriores || []) {
    if (!ultima.has((a as any).chamado_id)) ultima.set((a as any).chamado_id, (a as any).enviada_em)
  }

  const devidos = vencidos.filter((c: any) => {
    const u = ultima.get(c.id)
    if (!u || new Date(u) < new Date(c.sla_pausado_em)) return true
    return horasUteisEntre(new Date(u), agora) >= HORAS_ENTRE_COBRANCAS
  })

  /* Destinatários: só usuários do cliente, ativos. */
  const pessoasPorChamado = new Map<string, Set<string>>()
  for (const c of devidos as any[]) {
    pessoasPorChamado.set(c.id, new Set([c.solicitante_id, c.criado_por].filter(Boolean)))
  }
  for (const p of participantes || []) {
    pessoasPorChamado.get((p as any).chamado_id)?.add((p as any).usuario_id)
  }

  const todosIds = [...new Set([...pessoasPorChamado.values()].flatMap((s) => [...s]))]
  const { data: perfis } = todosIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, email, perfil, ativo')
        .in('id', todosIds)
    : { data: [] as any[] }

  const emailCliente = new Map<string, string>()
  for (const p of perfis || []) {
    if ((p as any).perfil === 'cliente' && (p as any).ativo !== false && (p as any).email) {
      emailCliente.set((p as any).id, (p as any).email)
    }
  }

  let envios = 0
  const semDestinatario: number[] = []

  for (const c of devidos as any[]) {
    const empresa: any = porEmpresa.get(c.empresa_id)
    const marca = marcaDaEmpresa(empresa?.marca)
    const portal = enderecoDoPortal(marca)
    const para = [...(pessoasPorChamado.get(c.id) || [])]
      .map((id) => emailCliente.get(id) || '')
      .filter(Boolean)

    if (!para.length) {
      semDestinatario.push(c.numero)
      continue
    }

    const dias = Math.floor((agora.getTime() - new Date(c.sla_pausado_em).getTime()) / 86400000)

    const r = await enviarEmail({
      para,
      assunto: 'Chamado #' + c.numero + ' aguarda o seu retorno há ' + dias + ' dias',
      html: montarEmail(
        marca,
        'Precisamos do seu retorno',
        [
          'O chamado <strong>#' +
            escapar(String(c.numero)) +
            ' · ' +
            escapar(c.assunto) +
            '</strong> está aguardando uma resposta sua desde ' +
            dataCurta(c.sla_pausado_em) +
            ' (' +
            dias +
            ' dias).',
          'Sem esse retorno não conseguimos continuar o atendimento. Basta abrir o chamado no portal e responder por lá: ele volta para a nossa equipe na hora.',
        ],
        { rotulo: 'Responder o chamado', url: portal + '/chamados/' + c.id },
        'Lembrete automático, repetido a cada 3 dias úteis enquanto o chamado aguardar o seu retorno.'
      ),
      marca,
    })

    if (!r.enviado) continue

    envios++

    await supabaseAdmin
      .from('chamado_cobrancas')
      .insert({ chamado_id: c.id, destinatarios: para.length })

    /* Histórico do chamado (opcional: se a regra do histórico recusar, segue). */
    await supabaseAdmin.from('chamado_eventos').insert({
      chamado_id: c.id,
      tipo: 'cobranca',
      para: 'enviada',
      observacao: 'Cobrança por e-mail ao cliente (' + para.length + ' destinatário(s)), parado há ' + dias + ' dias',
    })
  }

  return NextResponse.json({
    sucesso: true,
    vencidos: vencidos.length,
    devidos: devidos.length,
    envios,
    semDestinatario,
  })
}
