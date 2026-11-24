import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enderecoDoPortal, enviarEmail, montarEmail } from '@/lib/email'
import { nomeDoPeriodo } from '@/lib/reconhecimentoEstrelas'

export const dynamic = 'force-dynamic'

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true
  return request.headers.get('authorization') === 'Bearer ' + segredo
}

const pad = (n: number) => String(n).padStart(2, '0')

function hojePortoVelho() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Porto_Velho',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function somarDias(iso: string, dias: number) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/*
 * Dias úteis seg–sex do mês corrente, de 1º até hoje, fora os feriados
 * do calendário do SLA (tabela feriados).
 */
async function diasUteisAteHoje(hoje: string) {
  const inicio = hoje.slice(0, 8) + '01'
  const { data } = await supabaseAdmin.from('feriados').select('data').gte('data', inicio).lte('data', hoje)
  const feriados = new Set((data || []).map((f: any) => String(f.data).slice(0, 10)))

  let conta = 0
  for (let dia = inicio; dia <= hoje; dia = somarDias(dia, 1)) {
    const semana = new Date(dia + 'T12:00:00Z').getUTCDay()
    if (semana >= 1 && semana <= 5 && !feriados.has(dia)) conta++
  }
  return conta
}

/*
 * Dias úteis pela manhã: no 3º dia útil do mês (ou no primeiro dia útil
 * depois do fim do prazo de avaliação, o que vier por último), congela o
 * ranking do mês anterior e avisa gestores e admins que os rascunhos dos
 * e-mails de reconhecimento estão prontos. Nada é enviado aos atendentes
 * sem aprovação na tela.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })

  const hoje = hojePortoVelho()
  const [ano, mes] = hoje.split('-').map(Number)
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
  const periodo = anterior.ano + '-' + pad(anterior.mes) + '-01'
  const fimAnterior = somarDias(hoje.slice(0, 8) + '01', -1)

  const { data: existente, error } = await supabaseAdmin
    .from('estrelas_reconhecimentos')
    .select('id')
    .eq('periodo', periodo)
    .limit(1)

  if (error) {
    return NextResponse.json(
      { erro: 'Tabela de reconhecimento indisponível (rode supabase/estrelas-reconhecimento-mensal.sql): ' + error.message },
      { status: 500 }
    )
  }
  if (existente && existente.length) return NextResponse.json({ ok: true, periodo, situacao: 'já congelado' })

  const { data: cfg } = await supabaseAdmin
    .from('estrelas_config')
    .select('ativo, prazo_avaliacao_dias')
    .maybeSingle()

  if (!cfg?.ativo) return NextResponse.json({ ok: true, periodo, situacao: 'programa desativado' })

  const uteis = await diasUteisAteHoje(hoje)
  if (uteis < 3) return NextResponse.json({ ok: true, periodo, situacao: 'aguardando o 3º dia útil', dias_uteis: uteis })

  const prazoAvaliacao = Number(cfg.prazo_avaliacao_dias || 0)
  const fimAvaliacoes = somarDias(fimAnterior, prazoAvaliacao)
  if (prazoAvaliacao && hoje <= fimAvaliacoes) {
    return NextResponse.json({ ok: true, periodo, situacao: 'aguardando o fim do prazo de avaliação', ate: fimAvaliacoes })
  }

  const { data: qtd, error: erroCongelar } = await supabaseAdmin.rpc('estrelas_congelar_mes', { p_mes: periodo })
  if (erroCongelar) {
    console.error('cron estrelas-reconhecimento', erroCongelar)
    return NextResponse.json({ erro: erroCongelar.message }, { status: 500 })
  }

  if (!qtd) return NextResponse.json({ ok: true, periodo, situacao: 'sem chamados resolvidos no mês' })

  const { data: gestores } = await supabaseAdmin
    .from('profiles')
    .select('email, perfil, ativo')
    .in('perfil', ['gestor', 'admin'])

  const para = (gestores || []).filter((g: any) => g.ativo !== false && g.email).map((g: any) => g.email)
  const { mesAno } = nomeDoPeriodo(periodo)
  const portal = enderecoDoPortal('reallife')

  await enviarEmail({
    para,
    marca: 'reallife',
    assunto: 'Programa de Estrelas: rascunhos de ' + mesAno + ' prontos para revisão',
    html: montarEmail(
      'reallife',
      'Reconhecimento de ' + mesAno + ' pronto para revisão',
      [
        'O ranking de ' + mesAno + ' foi congelado e os rascunhos dos e-mails de reconhecimento estão prontos (' +
          qtd + (qtd === 1 ? ' pessoa' : ' pessoas') + ').',
        'Escreva o destaque do mês de quem ficou no pódio, revise os demais e confirme o envio. Nenhum e-mail sai para a equipe sem a sua aprovação.',
      ],
      { rotulo: 'Revisar e enviar', url: portal + '/estrelas?aba=reconhecimento' }
    ),
  })

  return NextResponse.json({ ok: true, periodo, situacao: 'congelado', pessoas: qtd })
}
