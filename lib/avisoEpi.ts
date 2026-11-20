import { enderecoDoPortal, escapar, marcaDaEmpresa, montarEmail } from '@/lib/email'
import { dataBr } from '@/lib/documentosSst'

/*
 * O e-mail do aviso semanal de EPI (app/api/cron/epi/route.ts).
 *
 * Fica aqui, fora da rotina, pelo mesmo motivo de lib/avisoTreinamentos.ts:
 * assim dá para montar o e-mail sem mandá-lo — para conferir o texto e o
 * layout sem gastar a caixa de entrada de ninguém.
 *
 * Ver a prévia: npx tsx scripts/previa-aviso-epi.ts
 */

export type ItemAvisoEpi = {
  nome: string
  ca: string | null
  quantidade: number
  troca_em: string
  /* Dias de hoje até a troca. Negativo = já passou. */
  dias: number
  colaborador: string
  funcao: string | null
}

export type EmpresaDoAviso = {
  nome_fantasia?: string | null
  razao_social?: string | null
  marca?: string | null
}

export function descricaoDoPrazo(dias: number) {
  if (dias < 0) {
    const n = Math.abs(dias)
    return { texto: 'venceu há ' + n + (n === 1 ? ' dia' : ' dias'), cor: '#b91c1c' }
  }
  if (dias === 0) return { texto: 'vence hoje', cor: '#b45309' }
  return { texto: 'vence em ' + dias + (dias === 1 ? ' dia' : ' dias'), cor: '#b45309' }
}

/* Uma linha por pessoa, com os EPIs dela embaixo: é como a ficha é lida. */
function blocoPessoas(itens: ItemAvisoEpi[]) {
  const porPessoa = new Map<string, ItemAvisoEpi[]>()
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
          [...lista]
            .sort((a, b) => a.dias - b.dias)
            .map((i) => {
              const d = descricaoDoPrazo(i.dias)
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

export function montarAvisoEpi(p: { empresa: EmpresaDoAviso; itens: ItemAvisoEpi[]; limite: string }) {
  const nomeEmpresa = p.empresa?.nome_fantasia || p.empresa?.razao_social || 'sua empresa'
  const marca = marcaDaEmpresa(p.empresa?.marca)

  const vencidos = p.itens.filter((i) => i.dias < 0).length
  const pessoas = new Set(p.itens.map((i) => i.colaborador)).size

  const assunto =
    'EPI — ' +
    p.itens.length +
    (p.itens.length === 1 ? ' troca' : ' trocas') +
    ' nesta semana' +
    (vencidos ? ', ' + vencidos + ' já vencida' + (vencidos === 1 ? '' : 's') : '') +
    ' — ' +
    nomeEmpresa

  const html = montarEmail(
    marca,
    'EPIs para trocar nesta semana',
    [
      'Estes EPIs entregues em <strong>' +
        escapar(nomeEmpresa) +
        '</strong> têm a troca prevista até ' +
        dataBr(p.limite) +
        (vencidos ? ', e ' + vencidos + ' já passou da data' : '') +
        ' — ' +
        pessoas +
        (pessoas === 1 ? ' trabalhador' : ' trabalhadores') +
        ':',
      blocoPessoas(p.itens),
      'Depois de entregar o equipamento novo, lance a entrega no portal: a ficha do trabalhador é o documento que comprova a entrega na fiscalização.',
    ],
    { rotulo: 'Ver as entregas', url: enderecoDoPortal(marca) + '/epi' },
    'Aviso automático do Portal do Cliente. Sai toda segunda-feira enquanto houver EPI a vencer.'
  )

  return { assunto, html, marca }
}
