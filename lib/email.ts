import { marcas, obterMarca, type Marca } from '@/lib/marca'

/*
 * Camada de e-mail do portal. Fica só no servidor: a chave do Resend
 * nunca pode chegar ao navegador, então tudo aqui é chamado por rotas
 * de API, nunca por componentes de tela.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

const REMETENTES: Record<Marca, string> = {
  agilmed:
    process.env.EMAIL_REMETENTE_AGILMED ||
    'ÁgilMed Ocupacional <portal@agilmedocupacional.com.br>',
  reallife:
    process.env.EMAIL_REMETENTE_REALLIFE ||
    'Real Life SSMA <portal@avisos.reallifessma.com.br>',
}

const PORTAIS: Record<Marca, string> = {
  agilmed: 'https://portal.agilmedocupacional.com.br',
  reallife: 'https://portal.reallifessma.com.br',
}

export function enderecoDoPortal(marca: Marca) {
  return PORTAIS[marca]
}

export function marcaDaEmpresa(valor: string | null | undefined): Marca {
  return obterMarca(valor) || 'reallife'
}

function escapar(texto: string | null | undefined) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

type Botao = { rotulo: string; url: string }

/*
 * Um único layout para todos os avisos, tingido pela marca. Cliente de
 * e-mail não entende CSS moderno, por isso tudo vai em tabela e estilo
 * embutido.
 */
export function montarEmail(
  marca: Marca,
  titulo: string,
  paragrafos: string[],
  botao?: Botao,
  rodapeExtra?: string
) {
  const tema = marcas[marca]
  const portal = PORTAIS[marca]

  const corpo = paragrafos
    .map(
      (p) =>
        '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">' +
        p +
        '</p>'
    )
    .join('')

  const acao = botao
    ? '<p style="margin:26px 0 0;"><a href="' +
      botao.url +
      '" style="display:inline-block;background:' +
      tema.principal +
      ';color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px;">' +
      escapar(botao.rotulo) +
      '</a></p>'
    : ''

  return [
    '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f1f5f9;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">',
    '<tr><td style="background:' +
      tema.principal +
      ';padding:20px 26px;color:#ffffff;font-size:17px;font-weight:700;">' +
      escapar(tema.nome) +
      '<span style="display:block;font-size:12px;font-weight:400;opacity:.85;margin-top:3px;">Portal do Cliente</span></td></tr>',
    '<tr><td style="padding:26px;">',
    '<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;">' +
      escapar(titulo) +
      '</h1>',
    corpo,
    acao,
    '</td></tr>',
    '<tr><td style="padding:18px 26px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">' +
      (rodapeExtra ? escapar(rodapeExtra) + '<br>' : '') +
      'Este é um aviso automático do Portal do Cliente. Para responder, acesse ' +
      portal +
      '.</td></tr>',
    '</table></td></tr></table></body></html>',
  ].join('')
}

export type Envio = {
  para: string[]
  assunto: string
  html: string
  marca: Marca
  responderPara?: string
}

/*
 * Nunca deixa o envio derrubar a operação: se o e-mail falhar, o
 * chamado já foi criado e o portal precisa seguir funcionando.
 */
export async function enviarEmail(envio: Envio) {
  const destinatarios = [
    ...new Set(
      envio.para
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e.includes('@'))
    ),
  ]

  if (!destinatarios.length) {
    return { enviado: false, motivo: 'sem destinatarios' }
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada; e-mail não enviado.')
    return { enviado: false, motivo: 'sem chave' }
  }

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMETENTES[envio.marca],
        to: destinatarios,
        subject: envio.assunto,
        html: envio.html,
        reply_to: envio.responderPara,
      }),
    })

    if (!resposta.ok) {
      const detalhe = await resposta.text()
      console.error('Resend recusou o envio:', resposta.status, detalhe)
      return { enviado: false, motivo: detalhe }
    }

    return { enviado: true, destinatarios: destinatarios.length }
  } catch (erro) {
    console.error('Falha ao chamar o Resend:', erro)
    return { enviado: false, motivo: 'excecao' }
  }
}

export function formatarData(valor: string | null | undefined) {
  if (!valor) return '—'

  const d = new Date(valor)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Porto_Velho' })
}

export function diasAte(valor: string | null | undefined) {
  if (!valor) return null

  const alvo = new Date(valor + 'T00:00:00-04:00').getTime()

  if (Number.isNaN(alvo)) return null

  return Math.round((alvo - Date.now()) / 86400000)
}

export { escapar }
