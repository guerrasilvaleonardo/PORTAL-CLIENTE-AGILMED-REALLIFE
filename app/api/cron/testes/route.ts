import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enderecoDoPortal, enviarEmail, escapar, marcaDaEmpresa, montarEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * O aviso do teste de 7 dias (supabase/teste-de-7-dias.sql e
 * supabase/teste-avisos.sql).
 *
 * POR QUE EXISTE. O relógio do teste só aparecia dentro do portal.
 * Quem não entrasse no dia 6 descobria no dia 8, com a ferramenta já
 * fechada — e aí não é teste, é armadilha. Dois e-mails, um cada:
 *
 *  - FALTAM 2 DIAS: ainda dá tempo de usar e de decidir.
 *  - TERMINOU: a parte que vende. Diz que a ferramenta fechou E que os
 *    registros continuam lá, e leva ao botão de contratar.
 *
 * Cada um sai UMA VEZ: as colunas avisado_faltam_em e avisado_fim_em
 * marcam o envio. Sem elas o cliente receberia o mesmo e-mail todo dia.
 *
 * Empresa interna não recebe nada — é a nossa, e os testes que fazemos
 * nela não devem virar e-mail de venda para nós mesmos.
 *
 * ?forcar=1 ignora nada aqui: não há regra de dia útil. O teste corre em
 * dias corridos, e o aviso acompanha.
 */

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true
  return request.headers.get('authorization') === 'Bearer ' + segredo
}

/*
 * Os rótulos ficam aqui, repetidos de lib/modulos.ts de propósito:
 * aquele arquivo é 'use client' e arrasta o cliente do Supabase do
 * navegador junto. São duas ferramentas e dois nomes — repetir custa
 * menos que acoplar o cron à camada de tela.
 */
const FERRAMENTAS: Record<string, { rotulo: string; oQueFica: string }> = {
  epi: {
    rotulo: 'EPI',
    oQueFica: 'as fichas da NR-06 que você emitiu e todas as entregas assinadas',
  },
  inspecoes: {
    rotulo: 'Inspeções',
    oQueFica: 'os relatórios das visitas e as não conformidades que você abriu',
  },
}

const DIAS_PARA_AVISAR = 2

type Teste = {
  id: string
  empresa_id: string
  modulo: string
  termina_em: string
  iniciado_por: string | null
  avisado_faltam_em: string | null
  avisado_fim_em: string | null
  empresas: { razao_social: string | null; nome_fantasia: string | null; marca: string | null; interna: boolean | null } | null
}

/* Dias cheios daqui até lá. Negativo = já passou. */
function diasAte(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function dataBr(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Porto_Velho',
  })
}

/*
 * Para quem mandar: quem ligou o teste, se tiver e-mail. Se não, os
 * usuários cliente daquela empresa — alguém precisa saber que o prazo
 * está acabando, mesmo que a pessoa que clicou tenha saído.
 */
async function destinatarios(t: Teste): Promise<string[]> {
  if (t.iniciado_por) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', t.iniciado_por)
      .maybeSingle()

    const email = (data as { email: string | null } | null)?.email
    if (email) return [email]
  }

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('empresa_id', t.empresa_id)
    .eq('perfil', 'cliente')
    .limit(10)

  return ((data as { email: string | null }[] | null) || [])
    .map((p) => p.email)
    .filter((e): e is string => Boolean(e))
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('modulo_testes')
    .select(
      'id, empresa_id, modulo, termina_em, iniciado_por, avisado_faltam_em, avisado_fim_em,' +
        ' empresas(razao_social, nome_fantasia, marca, interna)'
    )
    .is('convertido_em', null)

  /* Tabela ou colunas ainda não criadas: o cron não é erro, só não tem
     o que fazer. Dizer isso em voz alta ajuda a achar o SQL que falta. */
  if (error) {
    const faltaSql = /modulo_testes|avisado_/.test(error.message || '')
    return NextResponse.json(
      {
        ok: faltaSql,
        avisados: 0,
        pendente: faltaSql
          ? 'Rode supabase/teste-de-7-dias.sql e supabase/teste-avisos.sql.'
          : undefined,
        erro: faltaSql ? undefined : error.message,
      },
      { status: faltaSql ? 200 : 500 }
    )
  }

  const testes = ((data as unknown as Teste[]) || []).filter((t) => !t.empresas?.interna)

  const faltam: string[] = []
  const terminaram: string[] = []
  const falhas: string[] = []

  for (const t of testes) {
    const ferramenta = FERRAMENTAS[t.modulo]
    if (!ferramenta) continue

    const dias = diasAte(t.termina_em)
    const acabou = dias <= 0

    const precisaAvisarFaltam = !acabou && dias <= DIAS_PARA_AVISAR && !t.avisado_faltam_em
    const precisaAvisarFim = acabou && !t.avisado_fim_em

    if (!precisaAvisarFaltam && !precisaAvisarFim) continue

    const para = await destinatarios(t)
    if (para.length === 0) {
      falhas.push(t.id + ': ninguém com e-mail para avisar')
      continue
    }

    const marca = marcaDaEmpresa(t.empresas?.marca)
    const portal = enderecoDoPortal(marca)
    const empresa = t.empresas?.nome_fantasia || t.empresas?.razao_social || 'sua empresa'

    if (precisaAvisarFaltam) {
      const quando = dias === 1 ? 'amanhã' : 'em ' + dias + ' dias'

      const html = montarEmail(
        marca,
        'Seu teste do ' + ferramenta.rotulo + ' termina ' + quando,
        [
          'O teste de 7 dias do <strong>' +
            escapar(ferramenta.rotulo) +
            '</strong> em ' +
            escapar(empresa) +
            ' termina ' +
            quando +
            ', em <strong>' +
            escapar(dataBr(t.termina_em)) +
            '</strong>.',
          'Quando terminar, a ferramenta para de aceitar registro novo — mas <strong>nada do que você registrou some</strong>: ' +
            ferramenta.oQueFica +
            ' continuam no portal, para ver e imprimir quando quiser.',
          'Se ainda não experimentou tudo, estes dias são seus.',
        ],
        { rotulo: 'Abrir o ' + ferramenta.rotulo, url: portal },
        'Você recebeu este aviso porque ' + empresa + ' está testando o ' + ferramenta.rotulo + '.'
      )

      const envio = await enviarEmail({
        para,
        assunto: 'Seu teste do ' + ferramenta.rotulo + ' termina ' + quando,
        html,
        marca,
      })

      /* Só marca como avisado se o e-mail saiu mesmo. Marcar antes
         faria o cliente perder o aviso para sempre por uma falha de
         envio passageira. */
      if (!envio.enviado) {
        falhas.push(t.id + ': aviso de prazo não saiu (' + (envio.motivo || 'sem motivo') + ')')
        continue
      }

      await supabaseAdmin
        .from('modulo_testes')
        .update({ avisado_faltam_em: new Date().toISOString() })
        .eq('id', t.id)

      faltam.push(t.id)
      continue
    }

    /* Terminou. É o e-mail que mais importa: diz o que fechou, diz o
       que FICOU, e abre a porta da contratação. */
    const html = montarEmail(
      marca,
      'Seu teste do ' + ferramenta.rotulo + ' terminou',
      [
        'O teste de 7 dias do <strong>' +
          escapar(ferramenta.rotulo) +
          '</strong> em ' +
          escapar(empresa) +
          ' terminou em <strong>' +
          escapar(dataBr(t.termina_em)) +
          '</strong>.',
        '<strong>Nada foi apagado.</strong> ' +
          ferramenta.oQueFica.charAt(0).toUpperCase() +
          ferramenta.oQueFica.slice(1) +
          ' continuam no portal, para ver e imprimir quando quiser. O que parou foi o registro novo.',
        'Para voltar a registrar, abra o portal e peça a contratação: o pedido já vai com o que você registrou no teste escrito dentro, e a proposta chega pelo próprio portal.',
      ],
      { rotulo: 'Ver o que registrei', url: portal + '/contratar' },
      'Você recebeu este aviso porque ' + empresa + ' testou o ' + ferramenta.rotulo + '.'
    )

    const envio = await enviarEmail({
      para,
      assunto: 'Seu teste do ' + ferramenta.rotulo + ' terminou — seus registros continuam aí',
      html,
      marca,
    })

    if (!envio.enviado) {
      falhas.push(t.id + ': aviso de fim não saiu (' + (envio.motivo || 'sem motivo') + ')')
      continue
    }

    await supabaseAdmin
      .from('modulo_testes')
      .update({ avisado_fim_em: new Date().toISOString() })
      .eq('id', t.id)

    terminaram.push(t.id)
  }

  return NextResponse.json({
    ok: true,
    testesAbertos: testes.length,
    avisadosFaltamDias: faltam.length,
    avisadosTerminou: terminaram.length,
    falhas,
  })
}
