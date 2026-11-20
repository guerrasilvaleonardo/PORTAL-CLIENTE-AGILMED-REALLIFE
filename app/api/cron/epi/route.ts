import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { pessoasDaEmpresa } from '@/lib/pessoasDaEmpresa'
import { carregarDesligados, estaDesligado } from '@/lib/colaboradoresDesligados'
import { enviarEmail } from '@/lib/email'
import { montarAvisoEpi, type ItemAvisoEpi } from '@/lib/avisoEpi'
import { diasAteData, hojePortoVelho } from '@/lib/documentosSst'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * AVISO SEMANAL DE EPI A VENCER
 *
 * Segunda-feira de manhã, um e-mail por empresa com os EPIs entregues
 * cuja troca cai nesta semana — e os que já passaram da data e ninguém
 * trocou. É o que o OnSafety faz: "todo começo de semana o sistema
 * manda um e-mail te lembrando se algum EPI vai vencer naquela semana".
 *
 * POR QUE OS ATRASADOS ENTRAM JUNTO. Avisar só o que vence nos próximos
 * dias deixa de fora justamente o que já passou do prazo — que é o caso
 * que dá problema numa fiscalização. Na tela eles já aparecem em
 * vermelho; aqui vêm no topo da lista.
 *
 * NÃO GUARDA O QUE JÁ AVISOU, de propósito. O aviso é semanal e repete
 * enquanto o EPI não for trocado ou devolvido: é um lembrete, não uma
 * notificação de evento. Trocou, sai da lista sozinho.
 *
 * QUEM RECEBE: as pessoas da empresa (lib/pessoasDaEmpresa). A equipe da
 * Real Life não entra — a entrega de EPI é feita pelo próprio cliente.
 *
 * Empresa que não contratou o módulo (empresas.modulo_epi = false) não
 * recebe. Pessoa desligada não entra na conta.
 *
 * Não precisa de SQL: lê o que epi-entregas.sql e epi-devolucao.sql já
 * gravam. Protegida por CRON_SECRET, como as outras rotinas.
 */

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true
  return request.headers.get('authorization') === 'Bearer ' + segredo
}

/* Domingo desta semana, em ISO. Segunda + 6 dias; domingo é o próprio dia. */
function fimDaSemana(hoje: string) {
  const d = new Date(hoje + 'T12:00:00Z')
  const faltam = (7 - d.getUTCDay()) % 7
  d.setUTCDate(d.getUTCDate() + faltam)
  return d.toISOString().slice(0, 10)
}

type Item = ItemAvisoEpi & { empresa_id: string; empresa: any }

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const hoje = hojePortoVelho()
  const limite = fimDaSemana(hoje)

  /* Itens entregues, não devolvidos, com troca até o fim desta semana. */
  const { data: linhas, error } = await supabaseAdmin
    .from('epi_entregas_itens')
    .select(
      'id, nome, ca, quantidade, troca_em, devolvido_em, ' +
        'epi_entregas!entrega_id(empresa_id, cancelada_em, ' +
        'empresas(nome_fantasia, razao_social, marca), ' +
        'colaboradores!colaborador_id(nome, funcao))'
    )
    .is('devolvido_em', null)
    .lte('troca_em', limite)
    .order('troca_em')
    .limit(5000)

  if (error) {
    return NextResponse.json({ sucesso: true, pulado: 'SQL de EPI ainda não aplicado', detalhe: error.message })
  }

  const { mapa: desligados } = await carregarDesligados(supabaseAdmin)

  const itens: Item[] = []

  for (const l of (linhas || []) as any[]) {
    const entrega = Array.isArray(l.epi_entregas) ? l.epi_entregas[0] : l.epi_entregas
    if (!entrega || entrega.cancelada_em) continue

    const colaborador = Array.isArray(entrega.colaboradores) ? entrega.colaboradores[0] : entrega.colaboradores
    const nomePessoa = colaborador?.nome || 'Sem nome'
    if (estaDesligado(desligados, { empresa_id: entrega.empresa_id, colaborador: nomePessoa })) continue

    const dias = diasAteData(l.troca_em, hoje)
    if (dias === null) continue

    itens.push({
      nome: l.nome,
      ca: l.ca,
      quantidade: l.quantidade || 1,
      troca_em: l.troca_em,
      dias,
      colaborador: nomePessoa,
      funcao: colaborador?.funcao || null,
      empresa_id: entrega.empresa_id,
      empresa: Array.isArray(entrega.empresas) ? entrega.empresas[0] : entrega.empresas,
    })
  }

  if (!itens.length) {
    return NextResponse.json({ sucesso: true, data: hoje, ate: limite, avisos: 0, envios: 0 })
  }

  /* Empresa que não contratou o módulo não recebe o aviso dele. */
  const semModulo = new Set<string>()
  const { data: empresas, error: erroModulo } = await supabaseAdmin.from('empresas').select('id, modulo_epi')
  if (!erroModulo) {
    for (const e of (empresas || []) as any[]) if (e.modulo_epi === false) semModulo.add(e.id)
  }

  const porEmpresa = new Map<string, Item[]>()
  for (const i of itens) porEmpresa.set(i.empresa_id, [...(porEmpresa.get(i.empresa_id) || []), i])

  let envios = 0
  let avisados = 0

  for (const [empresaId, lista] of porEmpresa) {
    if (semModulo.has(empresaId)) continue

    const para = (await pessoasDaEmpresa(empresaId)).map((p) => p.email || '').filter(Boolean)
    if (!para.length) continue

    const { assunto, html, marca } = montarAvisoEpi({
      empresa: lista[0].empresa || {},
      itens: lista,
      limite,
    })

    const r = await enviarEmail({ para, assunto, html, marca })

    if (r.enviado) {
      envios++
      avisados += lista.length
    }
  }

  return NextResponse.json({
    sucesso: true,
    data: hoje,
    ate: limite,
    empresas: porEmpresa.size,
    avisos: itens.length,
    avisados,
    envios,
  })
}
