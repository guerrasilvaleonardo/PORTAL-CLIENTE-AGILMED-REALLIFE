import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { pessoasDaEmpresa } from '@/lib/pessoasDaEmpresa'
import { carregarDesligados, estaDesligado } from '@/lib/colaboradoresDesligados'
import { enderecoDoPortal, enviarEmail, escapar, marcaDaEmpresa, montarEmail } from '@/lib/email'
import { dataBr, diasAteData, hojePortoVelho } from '@/lib/documentosSst'

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

type Item = {
  nome: string
  ca: string | null
  quantidade: number
  troca_em: string
  dias: number
  colaborador: string
  funcao: string | null
  empresa_id: string
  empresa: any
}

function descricao(i: Item) {
  if (i.dias < 0) {
    const n = Math.abs(i.dias)
    return { texto: 'venceu há ' + n + (n === 1 ? ' dia' : ' dias'), cor: '#b91c1c' }
  }
  if (i.dias === 0) return { texto: 'vence hoje', cor: '#b45309' }
  return { texto: 'vence em ' + i.dias + (i.dias === 1 ? ' dia' : ' dias'), cor: '#b45309' }
}

/* Uma linha por pessoa, com os EPIs dela embaixo: é como a ficha é lida. */
function blocoPessoas(itens: Item[]) {
  const porPessoa = new Map<string, Item[]>()
  for (const i of itens) porPessoa.set(i.colaborador, [...(porPessoa.get(i.colaborador) || []), i])

  const pessoas = [...porPessoa.entries()].sort(
    (a, b) => Math.min(...a[1].map((i) => i.dias)) - Math.min(...b[1].map((i) => i.dias))
  )

  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 4px;">' +
    pessoas
      .map(([pessoa, lista]) => {
        const funcao = lista[0].funcao
        return (
          '<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">' +
          '<strong style="color:#0f172a;">' +
          escapar(pessoa) +
          '</strong>' +
          (funcao ? ' <span style="color:#64748b;font-size:12.5px;">· ' + escapar(funcao) + '</span>' : '') +
          lista
            .sort((a, b) => a.dias - b.dias)
            .map((i) => {
              const d = descricao(i)
              return (
                '<br><span style="font-size:13px;">' +
                escapar(i.nome) +
                (i.ca ? ' <span style="color:#64748b;">· CA ' + escapar(i.ca) + '</span>' : '') +
                (i.quantidade > 1 ? ' <span style="color:#64748b;">· ' + i.quantidade + ' un.</span>' : '') +
                ' — <span style="color:' +
                d.cor +
                ';">' +
                dataBr(i.troca_em) +
                ' · ' +
                d.texto +
                '</span></span>'
              )
            })
            .join('') +
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

    const empresa = lista[0].empresa
    const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'sua empresa'
    const marca = marcaDaEmpresa(empresa?.marca)

    const para = (await pessoasDaEmpresa(empresaId)).map((p) => p.email || '').filter(Boolean)
    if (!para.length) continue

    const vencidos = lista.filter((i) => i.dias < 0).length
    const pessoas = new Set(lista.map((i) => i.colaborador)).size

    const r = await enviarEmail({
      para,
      assunto:
        'EPI — ' +
        lista.length +
        (lista.length === 1 ? ' troca' : ' trocas') +
        ' nesta semana' +
        (vencidos ? ', ' + vencidos + ' já vencida' + (vencidos === 1 ? '' : 's') : '') +
        ' — ' +
        nomeEmpresa,
      html: montarEmail(
        marca,
        'EPIs para trocar nesta semana',
        [
          'Estes EPIs entregues em <strong>' +
            escapar(nomeEmpresa) +
            '</strong> têm a troca prevista até ' +
            dataBr(limite) +
            (vencidos ? ', e ' + vencidos + ' já passou da data' : '') +
            ' — ' +
            pessoas +
            (pessoas === 1 ? ' trabalhador' : ' trabalhadores') +
            ':',
          blocoPessoas(lista),
          'Depois de entregar o equipamento novo, lance a entrega no portal: a ficha do trabalhador é o documento que comprova a entrega na fiscalização.',
        ],
        { rotulo: 'Ver as entregas', url: enderecoDoPortal(marca) + '/epi' },
        'Aviso automático do Portal do Cliente. Sai toda segunda-feira enquanto houver EPI a vencer.'
      ),
      marca,
    })

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
