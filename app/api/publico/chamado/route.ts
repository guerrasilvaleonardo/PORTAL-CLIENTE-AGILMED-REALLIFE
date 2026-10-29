import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { HORAS_SLA, prazoEmHorasUteis } from '@/lib/prazo'
import { carregarFeriados } from '@/lib/feriados'
import { enderecoDoPortal, enviarEmail, escapar, montarEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

/*
 * ABERTURA DE CHAMADO PELO SITE (supabase/chamados-pelo-site.sql)
 *
 * Usado pelo formulário do botão de WhatsApp do site da Real Life.
 * É a única rota do portal aberta sem login, então:
 *   - aceita só os domínios do site (CORS);
 *   - valida cada campo no servidor;
 *   - barra robôs (campo-isca invisível e tempo mínimo de preenchimento);
 *   - limita envios por origem (5 por hora) e por e-mail (5 por dia);
 *   - nunca devolve dados do portal: só o número do protocolo.
 *
 * Se o e-mail é de um usuário CLIENTE ativo, o chamado entra na empresa
 * dele, no nome dele. Senão, na empresa "Contatos do site".
 */

const ORIGENS = [
  'https://www.reallifessma.com.br',
  'https://reallifessma.com.br',
]
const ORIGEM_PREVIA = /^https:\/\/site-reallifessma(-[a-z0-9-]+)?\.vercel\.app$/

const ASSUNTOS: Record<string, string> = {
  'Segurança do Trabalho': 'Segurança do Trabalho',
  'Saúde Ocupacional': 'Saúde Ocupacional',
  Treinamentos: 'Treinamentos',
  'Documentos (PGR, PCMSO, laudos)': 'Documentos',
  'Orçamento / proposta': 'Atendimento administrativo',
  Outros: 'Outros',
}

const LIMITE_POR_ORIGEM_HORA = 5
const LIMITE_POR_EMAIL_DIA = 5
const TEMPO_MINIMO_MS = 3000

function cabecalhosCors(origem: string | null) {
  const ok = origem && (ORIGENS.includes(origem) || ORIGEM_PREVIA.test(origem))
  return {
    'Access-Control-Allow-Origin': ok ? (origem as string) : ORIGENS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function origemPermitida(origem: string | null) {
  return !!origem && (ORIGENS.includes(origem) || ORIGEM_PREVIA.test(origem))
}

function resposta(origem: string | null, corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status, headers: cabecalhosCors(origem) })
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cabecalhosCors(request.headers.get('origin')) })
}

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: Request) {
  const origem = request.headers.get('origin')

  if (!origemPermitida(origem)) {
    return resposta(origem, { erro: 'Origem não permitida.' }, 403)
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return resposta(origem, { erro: 'Envio inválido.' }, 400)
  }

  /* Robôs: campo-isca preenchido ou envio rápido demais. Responde "ok"
     sem criar nada, para não ensinar o robô a contornar. */
  const iniciado = Number(body.iniciado_em || 0)
  if (texto(body.website, 200) || !iniciado || Date.now() - iniciado < TEMPO_MINIMO_MS) {
    return resposta(origem, { sucesso: true, numero: null })
  }

  const nome = texto(body.nome, 120)
  const empresa = texto(body.empresa, 120) || null
  const email = texto(body.email, 160).toLowerCase()
  const telefone = texto(body.telefone, 30).replace(/[^\d+()\-\s]/g, '') || null
  const assuntoEscolhido = texto(body.assunto, 80)
  const mensagem = String(body.mensagem ?? '').trim().slice(0, 3000)
  const pagina = texto(body.pagina, 300) || null
  const consentiu = body.consentimento === true

  const erros: string[] = []
  if (nome.length < 2) erros.push('Informe seu nome.')
  if (!EMAIL.test(email)) erros.push('Informe um e-mail válido.')
  if (telefone && telefone.replace(/\D/g, '').length < 10) erros.push('Telefone incompleto (com DDD).')
  if (!ASSUNTOS[assuntoEscolhido]) erros.push('Escolha o assunto.')
  if (mensagem.length < 10) erros.push('Descreva o pedido (pelo menos 10 caracteres).')
  if (!consentiu) erros.push('É preciso autorizar o uso dos dados para o atendimento.')
  if (erros.length) return resposta(origem, { erro: erros.join(' ') }, 400)

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sem-ip'
  const ipHash = createHash('sha256').update('site-contato|' + ip + '|' + (process.env.CRON_SECRET || '')).digest('hex').slice(0, 32)

  try {
    /* Limites de envio. */
    const umaHora = new Date(Date.now() - 3600000).toISOString()
    const umDia = new Date(Date.now() - 86400000).toISOString()
    const [{ count: porOrigem, error: e1 }, { count: porEmail }] = await Promise.all([
      supabaseAdmin.from('site_contatos').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('criado_em', umaHora),
      supabaseAdmin.from('site_contatos').select('id', { count: 'exact', head: true }).ilike('email', email).gte('criado_em', umDia),
    ])
    if (e1) {
      console.error('site_contatos indisponível:', e1)
      return resposta(origem, { erro: 'Abertura pelo site ainda não está disponível. Use o WhatsApp.' }, 503)
    }
    if ((porOrigem || 0) >= LIMITE_POR_ORIGEM_HORA || (porEmail || 0) >= LIMITE_POR_EMAIL_DIA) {
      return resposta(origem, { erro: 'Recebemos vários pedidos seguidos daqui. Tente de novo mais tarde ou fale pelo WhatsApp.' }, 429)
    }

    /* Cliente já cadastrado? (usuário cliente ativo com este e-mail) */
    const { data: cliente } = await supabaseAdmin
      .from('profiles')
      .select('id, empresa_id, nome')
      .ilike('email', email)
      .eq('perfil', 'cliente')
      .eq('ativo', true)
      .not('empresa_id', 'is', null)
      .limit(1)
      .maybeSingle()

    let empresaId = cliente?.empresa_id as string | undefined
    if (!empresaId) {
      const { data: contatoSite } = await supabaseAdmin
        .from('empresas')
        .select('id')
        .eq('contato_site', true)
        .eq('marca', 'reallife')
        .limit(1)
        .maybeSingle()
      empresaId = contatoSite?.id
    }
    if (!empresaId) {
      return resposta(origem, { erro: 'Abertura pelo site ainda não está disponível. Use o WhatsApp.' }, 503)
    }

    await carregarFeriados(supabaseAdmin, true)
    const prazoSla = prazoEmHorasUteis(HORAS_SLA.normal).toISOString()

    const descricao = [
      mensagem,
      '',
      '— Aberto pelo site (www.reallifessma.com.br) —',
      'Nome: ' + nome,
      empresa ? 'Empresa: ' + empresa : null,
      'E-mail: ' + email,
      telefone ? 'Telefone/WhatsApp: ' + telefone : null,
      cliente ? 'Reconhecido como cliente pelo e-mail.' : 'E-mail não cadastrado no portal (contato novo).',
    ]
      .filter((l) => l !== null)
      .join('\n')

    const { data: chamado, error: erroChamado } = await supabaseAdmin
      .from('chamados')
      .insert({
        empresa_id: empresaId,
        criado_por: cliente?.id ?? null,
        categoria: ASSUNTOS[assuntoEscolhido],
        assunto: ('Site: ' + assuntoEscolhido + ' — ' + (empresa || nome)).slice(0, 140),
        descricao,
        prioridade: 'normal',
        status: 'aberto',
        prazo_sla: prazoSla,
        visibilidade: 'empresa',
      })
      .select('id, numero')
      .single()

    if (erroChamado || !chamado) {
      console.error('Erro ao criar chamado pelo site:', erroChamado)
      return resposta(origem, { erro: 'Não foi possível registrar agora. Fale pelo WhatsApp.' }, 500)
    }

    await supabaseAdmin.from('site_contatos').insert({
      chamado_id: chamado.id,
      nome,
      empresa,
      email,
      telefone,
      assunto: assuntoEscolhido,
      pagina,
      consentiu_em: new Date().toISOString(),
      cliente_reconhecido: !!cliente,
      ip_hash: ipHash,
    })

    /* Avisos: equipe (novo chamado) e quem pediu (protocolo). Falha de
       e-mail não desfaz o chamado. */
    const portal = enderecoDoPortal('reallife')
    const codigo = '#' + chamado.numero
    const { data: equipe } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .in('perfil', ['atendimento', 'gestor', 'admin'])
      .eq('ativo', true)

    await Promise.allSettled([
      enviarEmail({
        para: (equipe || []).map((p: any) => p.email || ''),
        marca: 'reallife',
        assunto: 'Novo chamado pelo site ' + codigo + ' — ' + (empresa || nome),
        responderPara: email,
        html: montarEmail(
          'reallife',
          'Novo chamado pelo site ' + codigo,
          [
            '<strong>' + escapar(nome) + '</strong>' + (empresa ? ' (' + escapar(empresa) + ')' : '') + ' abriu um chamado pelo site.',
            '<strong>Assunto:</strong> ' + escapar(assuntoEscolhido),
            '<strong>E-mail:</strong> ' + escapar(email) + (telefone ? ' · <strong>Telefone:</strong> ' + escapar(telefone) : ''),
            cliente ? 'E-mail reconhecido: chamado aberto na empresa do cliente.' : 'Contato novo: chamado na empresa "Contatos do site".',
          ],
          { rotulo: 'Abrir no quadro', url: portal + '/atendimento/' + chamado.id }
        ),
      }),
      enviarEmail({
        para: [email],
        marca: 'reallife',
        assunto: 'Recebemos seu pedido — protocolo ' + codigo,
        html: montarEmail(
          'reallife',
          'Recebemos seu pedido',
          [
            'Olá, ' + escapar(nome.split(' ')[0]) + '. Seu pedido foi registrado com o protocolo <strong>' + codigo + '</strong>.',
            'Nossa equipe responde em até 3 dias úteis (horário de Porto Velho). Se falar conosco pelo WhatsApp, informe esse número.',
            cliente ? 'Você também pode acompanhar pelo Portal do Cliente.' : '',
          ].filter(Boolean),
          cliente ? { rotulo: 'Acompanhar no portal', url: portal + '/chamados/' + chamado.id } : undefined
        ),
      }),
    ])

    return resposta(origem, { sucesso: true, numero: chamado.numero })
  } catch (erro) {
    console.error('Erro inesperado no chamado pelo site:', erro)
    return resposta(origem, { erro: 'Não foi possível registrar agora. Fale pelo WhatsApp.' }, 500)
  }
}
