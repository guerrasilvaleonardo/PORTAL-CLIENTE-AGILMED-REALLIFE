import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/*
 * SINCRONIZACAO DIARIA DO EAD (Maestrus)
 *
 * Todo dia as 06h (horario de Brasilia) o portal entra na plataforma
 * de ensino, procura cada colaborador pelo e-mail registrado em
 * Certificados e guarda o curso e o percentual de andamento.
 *
 * Variaveis necessarias na Vercel:
 *   MAESTRUS_URL    (ex.: https://reallifessma.maestrus.com)
 *   MAESTRUS_EMAIL  (usuario administrador do EAD)
 *   MAESTRUS_SENHA  (senha desse usuario)
 *   CRON_SECRET     (protege a rota)
 */

const PADRAO_URL = 'https://reallifessma.maestrus.com'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

/*
 * Aceita a chamada do agendador da Vercel (CRON_SECRET) e tambem o
 * botao "Atualizar agora" da tela de Certificados, usado por quem e da
 * equipe interna.
 */
async function autorizado(request: Request) {
  const cabecalho = request.headers.get('authorization') || ''

  const segredo = process.env.CRON_SECRET

  if (!segredo) return true

  if (cabecalho === 'Bearer ' + segredo) return true

  const token = cabecalho.replace(/^Bearer /i, '').trim()

  if (!token) return false

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data?.user) return false

  const { data: perfil } = await supabaseAdmin
    .from('profiles')
    .select('perfil, ativo')
    .eq('id', data.user.id)
    .single()

  return Boolean(
    perfil && perfil.ativo === true && PERFIS_INTERNOS.includes(perfil.perfil)
  )
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

type Jar = Map<string, string>

function guardarCookies(jar: Jar, resposta: Response) {
  const cabecalhos = resposta.headers as unknown as {
    getSetCookie?: () => string[]
  }

  const lista =
    typeof cabecalhos.getSetCookie === 'function'
      ? cabecalhos.getSetCookie()
      : resposta.headers.get('set-cookie')
        ? [resposta.headers.get('set-cookie') as string]
        : []

  for (const bruto of lista) {
    const parte = bruto.split(';')[0]
    const igual = parte.indexOf('=')

    if (igual > 0) {
      jar.set(parte.slice(0, igual).trim(), parte.slice(igual + 1).trim())
    }
  }
}

function cabecalhoCookie(jar: Jar) {
  return [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

function semTags(texto: string) {
  return texto
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenDoFormulario(html: string) {
  const achado = html.match(
    /name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/i
  )

  if (achado) return achado[1]

  const invertido = html.match(
    /value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/i
  )

  return invertido ? invertido[1] : ''
}

/* ------------------------------------------------------------------ */
/* Leitura das matriculas                                              */
/* ------------------------------------------------------------------ */

type Linha = {
  email: string
  aluno: string | null
  curso: string
  progresso: number
  situacao: string | null
  inicio: string | null
}

const SITUACOES = ['ativo', 'inativo', 'expirado', 'cancelado', 'trancado']

function ehAtiva(linha: { situacao: string | null }) {
  return (linha.situacao || '').toLowerCase() === 'ativo'
}

function melhorLinha(nova: Linha, atual: Linha) {
  if (ehAtiva(nova) !== ehAtiva(atual)) {
    return ehAtiva(nova) ? nova : atual
  }

  return nova.progresso > atual.progresso ? nova : atual
}

function paraDataIso(texto: string | null) {
  if (!texto) return null

  const p = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/)

  return p ? p[3] + '-' + p[2] + '-' + p[1] : null
}

function lerLinhas(conteudo: string): Linha[] {
  const linhas: Linha[] = []

  const blocos = conteudo.split(/<tr[\s>]/i).slice(1)

  for (const bloco of blocos) {
    const celulas = [...bloco.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      semTags(c[1])
    )

    if (celulas.length < 4) continue

    const indiceEmail = celulas.findIndex((c) =>
      /[\w.+-]+@[\w-]+\.[\w.]+/.test(c)
    )

    if (indiceEmail < 0) continue

    const email = (
      celulas[indiceEmail].match(/[\w.+-]+@[\w-]+\.[\w.]+/) as RegExpMatchArray
    )[0].toLowerCase()

    const aluno =
      celulas[indiceEmail].replace(email, '').trim().replace(/\s+/g, ' ') || null

    const curso = (celulas[indiceEmail + 1] || '').trim()

    if (!curso) continue

    /*
     * A coluna Progresso e a primeira celula depois do e-mail cujo texto
     * e apenas um percentual ("47%"). Procurar o percentual no bloco
     * inteiro pegava por engano a largura da barra de outra linha.
     */
    const indiceProgresso = celulas.findIndex(
      (c, i) => i > indiceEmail && /^\d{1,3}\s*%$/.test(c)
    )

    const numero =
      indiceProgresso >= 0
        ? Number((celulas[indiceProgresso].match(/\d{1,3}/) || ['0'])[0])
        : 0

    const progresso = Math.max(0, Math.min(100, numero))

    const situacao =
      celulas.find((c) => SITUACOES.includes(c.toLowerCase())) || null

    const inicio = paraDataIso(
      celulas.find((c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c)) || null
    )

    linhas.push({ email, aluno, curso, progresso, situacao, inicio })
  }

  return linhas
}

/* ------------------------------------------------------------------ */
/* Rotina                                                              */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const base = (process.env.MAESTRUS_URL || PADRAO_URL).replace(/\/+$/, '')
  const usuario = process.env.MAESTRUS_EMAIL || ''
  const senha = process.env.MAESTRUS_SENHA || ''

  if (!usuario || !senha) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          'Configure MAESTRUS_EMAIL e MAESTRUS_SENHA na Vercel para ligar a leitura do EAD.',
      },
      { status: 200 }
    )
  }

  const jar: Jar = new Map()

  async function pedir(caminho: string, corpo?: URLSearchParams) {
    const resposta = await fetch(base + caminho, {
      method: corpo ? 'POST' : 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'PortalDoCliente/1.0',
        Accept: corpo ? 'application/json, text/html, */*' : 'text/html,*/*',
        Cookie: cabecalhoCookie(jar),
        Referer: base + '/ead/gestao-cursos/matriculas/',
        ...(corpo
          ? {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
              'X-CSRFToken': jar.get('csrftoken') || '',
            }
          : {}),
      },
      body: corpo ? corpo.toString() : undefined,
    })

    guardarCookies(jar, resposta)

    return resposta
  }

  async function registrar(
    sucesso: boolean,
    registros: number,
    detalhe: string
  ) {
    await supabaseAdmin.from('treinamentos_sync_log').insert({
      origem: 'maestrus',
      registros,
      sucesso,
      detalhe: detalhe.slice(0, 900),
    })
  }

  try {
    /* 1. Entrar na plataforma ------------------------------------- */

    const paginaLogin = await pedir('/ead/login/')
    const htmlLogin = await paginaLogin.text()
    const token = tokenDoFormulario(htmlLogin) || jar.get('csrftoken') || ''

    const dadosLogin = new URLSearchParams()
    dadosLogin.set('csrfmiddlewaretoken', token)
    dadosLogin.set('username', usuario)
    dadosLogin.set('password', senha)
    dadosLogin.set('fp', '')
    dadosLogin.set('remember', 'on')
    dadosLogin.set('next', '')

    const entrada = await fetch(base + '/ead/login/', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'User-Agent': 'PortalDoCliente/1.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cabecalhoCookie(jar),
        Referer: base + '/ead/login/',
      },
      body: dadosLogin.toString(),
    })

    guardarCookies(jar, entrada)

    if (!jar.get('sessionid')) {
      await registrar(false, 0, 'Não foi possível entrar no EAD com o usuário configurado.')

      return NextResponse.json(
        {
          sucesso: false,
          erro:
            'O EAD não aceitou o login. Confira MAESTRUS_EMAIL e MAESTRUS_SENHA.',
        },
        { status: 200 }
      )
    }

    /* 2. Renovar o csrf na tela de matrículas ---------------------- */

    const telaLista = await pedir('/ead/gestao-cursos/matriculas/')
    const htmlLista = await telaLista.text()
    const csrf = tokenDoFormulario(htmlLista) || jar.get('csrftoken') || ''

    /* 3. E-mails registrados em Certificados ----------------------- */

    const { data: certificados, error: erroCertificados } = await supabaseAdmin
      .from('certificados')
      .select('email_colaborador')
      .not('email_colaborador', 'is', null)

    if (erroCertificados) throw erroCertificados

    const emails = [
      ...new Set(
        (certificados || [])
          .map((c) => (c.email_colaborador || '').toLowerCase().trim())
          .filter(Boolean)
      ),
    ]

    if (emails.length === 0) {
      await registrar(true, 0, 'Nenhum colaborador com e-mail registrado.')

      return NextResponse.json({
        sucesso: true,
        registros: 0,
        aviso:
          'Nenhum certificado tem e-mail de colaborador preenchido ainda.',
      })
    }

    /* 4. Buscar cada colaborador no EAD ---------------------------- */

    const encontrados: Linha[] = []
    const semCadastro: string[] = []

    for (const email of emails) {
      const busca = new URLSearchParams()
      busca.set('csrfmiddlewaretoken', csrf)
      busca.set('s', email)

      const respostaBusca = await pedir(
        '/ead/gestao-cursos/matriculas/carga-alunos-ajax/',
        busca
      )

      let alunos: Array<{ value: number; text: string; email: string }> = []

      try {
        alunos = (await respostaBusca.json()) as typeof alunos
      } catch {
        alunos = []
      }

      const aluno =
        alunos.find((a) => (a.email || '').toLowerCase() === email) || alunos[0]

      if (!aluno) {
        semCadastro.push(email)
        continue
      }

      for (let pagina = 1; pagina <= 5; pagina += 1) {
        const filtro = new URLSearchParams()
        filtro.set('csrfmiddlewaretoken', csrf)
        filtro.set('exporttype', '')
        filtro.set('student', String(aluno.value))
        filtro.set('course', '')
        filtro.set('classroom', '')
        filtro.set('plan', '')
        filtro.set('start-date', '')
        filtro.set('end-date', '')
        filtro.set('kind', '')
        filtro.set('progress', '')
        filtro.set('status', '')
        filtro.set('id-search', '')
        filtro.set('cpage', String(pagina))

        const respostaLista = await pedir(
          '/ead/gestao-cursos/matriculas/',
          filtro
        )

        const bruto = await respostaLista.text()

        let conteudo = ''

        try {
          const json = JSON.parse(bruto) as { content?: string }
          conteudo = json.content || ''
        } catch {
          conteudo = bruto
        }

        const linhas = lerLinhas(conteudo).filter((l) => l.email === email)

        if (linhas.length === 0) break

        encontrados.push(...linhas)

        if (linhas.length < 15) break
      }
    }

    /* 5. Gravar ---------------------------------------------------- */

    const agora = new Date().toISOString()

    const unicos = new Map<string, Linha>()

    for (const linha of encontrados) {
      const chave = linha.email + '|' + linha.curso.toUpperCase()

      const anterior = unicos.get(chave)

      /*
       * O mesmo curso pode aparecer em mais de uma matricula do aluno.
       * Fica valendo a matricula ativa e, entre iguais, a de maior
       * andamento.
       */
      if (!anterior || melhorLinha(linha, anterior) === linha) {
        unicos.set(chave, linha)
      }
    }

    const registros = [...unicos.values()].map((l) => ({
      email: l.email,
      aluno: l.aluno,
      curso: l.curso,
      progresso: l.progresso,
      situacao: l.situacao,
      inicio: l.inicio,
      origem: 'maestrus',
      atualizado_em: agora,
    }))

    if (registros.length > 0) {
      const { error: erroGravacao } = await supabaseAdmin
        .from('treinamentos_progresso')
        .upsert(registros, { onConflict: 'email,curso' })

      if (erroGravacao) throw erroGravacao
    }

    await registrar(
      true,
      registros.length,
      semCadastro.length
        ? 'Sem matrícula no EAD: ' + semCadastro.join(', ')
        : 'Leitura concluída.'
    )

    return NextResponse.json({
      sucesso: true,
      colaboradores: emails.length,
      registros: registros.length,
      sem_cadastro_no_ead: semCadastro,
    })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)

    await registrar(false, 0, mensagem)

    return NextResponse.json(
      { sucesso: false, erro: mensagem },
      { status: 200 }
    )
  }
}
