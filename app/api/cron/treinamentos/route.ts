import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lerTudo } from '@/lib/lerTudo'
import { carregarDesligados, estaDesligado } from '@/lib/colaboradoresDesligados'

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
 * Quem pode disparar a leitura:
 *   - o agendador da Vercel (CRON_SECRET)        -> todos os clientes
 *   - equipe interna (botao "Atualizar agora")    -> todos os clientes
 *   - cliente ativo (botao na tela dele)          -> SO a empresa dele
 *
 * empresaId = null significa "todas as empresas".
 */
type Acesso =
  | { ok: false }
  | { ok: true; empresaId: string | null; cliente: boolean }

async function autorizado(request: Request): Promise<Acesso> {
  const cabecalho = request.headers.get('authorization') || ''

  const segredo = process.env.CRON_SECRET

  if (!segredo) return { ok: true, empresaId: null, cliente: false }

  if (cabecalho === 'Bearer ' + segredo) {
    return { ok: true, empresaId: null, cliente: false }
  }

  const token = cabecalho.replace(/^Bearer /i, '').trim()

  if (!token) return { ok: false }

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data?.user) return { ok: false }

  const { data: perfil } = await supabaseAdmin
    .from('profiles')
    .select('perfil, ativo, empresa_id')
    .eq('id', data.user.id)
    .single()

  if (!perfil || perfil.ativo !== true) return { ok: false }

  if (PERFIS_INTERNOS.includes(perfil.perfil)) {
    return { ok: true, empresaId: null, cliente: false }
  }

  /* Cliente sem empresa vinculada nao enxerga nada — nao pode disparar. */
  if (perfil.perfil === 'cliente' && perfil.empresa_id) {
    return { ok: true, empresaId: String(perfil.empresa_id), cliente: true }
  }

  return { ok: false }
}

/*
 * Intervalo minimo entre duas leituras disparadas pelo cliente.
 * Cada leitura entra no EAD e busca colaborador por colaborador; sem
 * limite, cliques repetidos sobrecarregam o Maestrus e a Vercel.
 */
const INTERVALO_CLIENTE_MIN = 10

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
  /* Numero da matricula no Maestrus (link do relatorio de desempenho). */
  matricula: number | null
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

    const idMatricula = bloco.match(/relatorio-de-desempenho\/(\d+)/)
    const matricula = idMatricula ? Number(idMatricula[1]) : null

    linhas.push({ email, aluno, curso, progresso, situacao, inicio, matricula })
  }

  return linhas
}

/* ------------------------------------------------------------------ */
/* Tempo de estudo (relatorio de desempenho)                           */
/* ------------------------------------------------------------------ */

/*
 * O relatorio de desempenho do Maestrus traz, por aula online, a
 * "Frequencia" (tempo gasto) e a "Data de Finalizacao". O Maestrus nao
 * guarda o tempo de cada acesso, so o de cada aula. Por isso:
 *   - aula finalizada: o tempo conta no dia da finalizacao;
 *   - aula em andamento (tempo sem data): conta no dia da ultima
 *     atividade da Linha do tempo.
 * A soma de tudo bate com a "Frequencia Total" das aulas online.
 */
type Tempo = { total: number; porDia: Record<string, number> }

function segundos(texto: string) {
  const p = texto.trim().split(':').map(Number)

  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return 0

  return p[0] * 3600 + p[1] * 60 + p[2]
}

function lerTempo(html: string): Tempo | null {
  const aulas = [
    ...html.matchAll(/data-timelog=["']([^"']*)["'][^>]*?data-finish-date=["']([^"']*)["']/gi),
  ]

  if (aulas.length === 0) return null

  const ultimaAtividade = html.match(
    /id=["']timeline-grid["'][\s\S]*?<tbody>\s*<tr>\s*<td>\s*(\d{2}\/\d{2}\/\d{4})/i
  )

  let diaSemData = ultimaAtividade ? paraDataIso(ultimaAtividade[1]) : null

  const porDia: Record<string, number> = {}
  let total = 0
  let semData = 0

  for (const [, tempo, fim] of aulas) {
    const s = segundos(tempo)

    if (s <= 0) continue

    total += s

    const dia = paraDataIso(fim)

    if (dia) porDia[dia] = (porDia[dia] || 0) + s
    else semData += s
  }

  if (semData > 0) {
    if (!diaSemData) diaSemData = Object.keys(porDia).sort().pop() || null

    if (diaSemData) porDia[diaSemData] = (porDia[diaSemData] || 0) + semData
  }

  return { total, porDia }
}

/*
 * Precisa (re)ler o tempo desta matricula?
 *   - nunca lido;
 *   - o percentual mudou desde a ultima leitura do tempo;
 *   - curso em andamento e a ultima leitura do tempo e anterior a
 *     ultima leitura do progresso (o colaborador pode ter estudado sem
 *     mudar o %).
 * Concluido (100%) e ja lido com 100% nao e relido.
 */
function precisaLerTempo(r: {
  progresso: number | null
  tempo_lido_em: string | null
  tempo_progresso: number | null
  atualizado_em: string | null
}) {
  if (!r.tempo_lido_em) return true

  const progresso = Math.round(Number(r.progresso) || 0)

  if (r.tempo_progresso === null || Number(r.tempo_progresso) !== progresso) return true

  if (progresso >= 100) return false

  const lido = new Date(r.tempo_lido_em).getTime()
  const atualizado = r.atualizado_em ? new Date(r.atualizado_em).getTime() : 0

  return lido < atualizado
}

/* ------------------------------------------------------------------ */
/* Rotina                                                              */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  const acesso = await autorizado(request)

  if (!acesso.ok) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const { empresaId, cliente } = acesso

  const inicioRotina = Date.now()

  /*
   * /api/cron/treinamentos-tempo (ou ?etapa=tempo): so le o tempo de
   * estudo das matriculas ja gravadas. Roda 40 min depois da leitura do
   * progresso, para o tempo nao depender da sobra daquela rotina.
   */
  const url = new URL(request.url)
  const soTempo =
    !cliente &&
    (url.pathname.replace(/\/+$/, '').endsWith('/treinamentos-tempo') ||
      url.searchParams.get('etapa') === 'tempo')

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
    const quem = empresaId ? '[empresa ' + empresaId + '] ' : ''

    await supabaseAdmin.from('treinamentos_sync_log').insert({
      origem: 'maestrus',
      registros,
      sucesso,
      detalhe: (quem + detalhe).slice(0, 900),
    })
  }

  async function entrar() {
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

    return Boolean(jar.get('sessionid'))
  }

  /*
   * Le o tempo de estudo (relatorio de desempenho) das matriculas
   * gravadas que precisam (precisaLerTempo), ate o limite de tempo da
   * rotina. O que nao couber fica para a proxima leitura, sem apagar o
   * tempo ja gravado. `soEmails` restringe aos colaboradores de uma
   * empresa (botao do cliente).
   *
   * Sem as colunas (supabase/treinamentos-tempo-por-dia.sql nao rodado),
   * devolve null e nao faz nada.
   */
  async function atualizarTempos(limiteMs: number, soEmails: string[] | null) {
    const prazo = inicioRotina + limiteMs

    const lidas = await lerTudo<any>(() =>
      supabaseAdmin
        .from('treinamentos_progresso')
        .select('email, curso, inicio, progresso, atualizado_em, matricula_ead, tempo_lido_em, tempo_progresso')
        .not('matricula_ead', 'is', null)
        .gt('progresso', 0)
        .order('email')
        .order('curso')
        .order('inicio', { nullsFirst: true })
    )

    if (lidas.error) return null

    const filtro = soEmails ? new Set(soEmails) : null

    const fila = (lidas.data || [])
      .filter((r) => !filtro || filtro.has(String(r.email || '').toLowerCase()))
      .filter(precisaLerTempo)
      /* Nunca lidos primeiro; depois os lidos ha mais tempo. */
      .sort((a, b) => String(a.tempo_lido_em || '').localeCompare(String(b.tempo_lido_em || '')))

    const PARALELO = 4
    let lidos = 0

    for (let i = 0; i < fila.length; i += PARALELO) {
      if (Date.now() > prazo) break

      await Promise.all(
        fila.slice(i, i + PARALELO).map(async (r) => {
          try {
            const resposta = await pedir(
              '/ead/gestao-educacao/relatorio-de-desempenho/' + r.matricula_ead + '/'
            )

            if (!resposta.ok) return

            const tempo = lerTempo(await resposta.text())

            if (!tempo) return

            let alvo = supabaseAdmin
              .from('treinamentos_progresso')
              .update({
                tempo_total_seg: tempo.total,
                tempo_por_dia: tempo.porDia,
                tempo_lido_em: new Date().toISOString(),
                tempo_progresso: Math.round(Number(r.progresso) || 0),
              })
              .eq('email', r.email)
              .eq('curso', r.curso)

            alvo = r.inicio ? alvo.eq('inicio', r.inicio) : alvo.is('inicio', null)

            const { error } = await alvo

            if (!error) lidos += 1
          } catch {
            /* Relatorio indisponivel: fica o tempo ja gravado. */
          }
        })
      )
    }

    return { lidos, pendentes: fila.length - lidos }
  }

  if (soTempo) {
    try {
      if (!(await entrar())) {
        await registrar(false, 0, 'Tempo de estudo: não foi possível entrar no EAD.')

        return NextResponse.json({ sucesso: false, erro: 'O EAD não aceitou o login.' })
      }

      const tempo = await atualizarTempos(280000, null)

      if (!tempo) {
        return NextResponse.json({
          sucesso: false,
          erro: 'Rode supabase/treinamentos-tempo-por-dia.sql para ligar o tempo de estudo.',
        })
      }

      await registrar(
        true,
        tempo.lidos,
        'Tempo de estudo: ' + tempo.lidos + ' matrícula(s) lida(s)' +
          (tempo.pendentes > 0 ? ', ' + tempo.pendentes + ' para a próxima leitura.' : '.')
      )

      return NextResponse.json({ sucesso: true, tempo_lido: tempo.lidos, tempo_pendente: tempo.pendentes })
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro)

      await registrar(false, 0, 'Tempo de estudo: ' + mensagem)

      return NextResponse.json({ sucesso: false, erro: mensagem })
    }
  }

  try {
    /* 1. E-mails registrados em Certificados ----------------------- */

    /*
     * So entram os certificados com progresso vindo do EAD. Os
     * presenciais (progresso_origem = 'manual') sao atualizados a mao
     * e nao devem gerar busca nem aviso de "sem matricula no EAD".
     * Se a coluna ainda nao existir (migracao nao rodada), cai na
     * leitura antiga em vez de derrubar a rotina.
     */
    let { data: certificados, error: erroCertificados } = await lerTudo<any>(() => {
      let c = supabaseAdmin
        .from('certificados')
        .select('email_colaborador, empresa_id, colaborador')
        .not('email_colaborador', 'is', null)
        .neq('progresso_origem', 'manual')
      if (empresaId) c = c.eq('empresa_id', empresaId)
      return c.order('id')
    })

    if (erroCertificados && erroCertificados.code === '42703') {
      const antiga = await lerTudo<any>(() => {
        let c = supabaseAdmin
          .from('certificados')
          .select('email_colaborador, empresa_id, colaborador')
          .not('email_colaborador', 'is', null)
        if (empresaId) c = c.eq('empresa_id', empresaId)
        return c.order('id')
      })

      certificados = antiga.data
      erroCertificados = antiga.error
    }

    if (erroCertificados) throw erroCertificados

    /*
     * Colaborador desligado (lib/colaboradoresDesligados.ts) não é
     * procurado no EAD nem gera "sem matrícula". Se o mesmo e-mail também
     * está num certificado de quem segue ativo, continua na leitura.
     * Sem a tabela, ninguém é tirado.
     */
    const { mapa: desligados } = await carregarDesligados(supabaseAdmin)

    const emails = [
      ...new Set(
        (certificados || [])
          .filter((c) => !estaDesligado(desligados, c))
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

    /*
     * Cliente: uma leitura a cada INTERVALO_CLIENTE_MIN minutos. Vale a
     * leitura mais recente dos colaboradores DELE, venha ela do
     * agendador, da equipe ou do proprio cliente.
     */
    if (cliente) {
      const { data: recente } = await supabaseAdmin
        .from('treinamentos_progresso')
        .select('atualizado_em')
        .in('email', emails)
        .order('atualizado_em', { ascending: false })
        .limit(1)

      const ultima = recente?.[0]?.atualizado_em

      if (ultima) {
        const minutos = (Date.now() - new Date(ultima).getTime()) / 60000

        if (minutos < INTERVALO_CLIENTE_MIN) {
          const espera = Math.max(1, Math.ceil(INTERVALO_CLIENTE_MIN - minutos))

          return NextResponse.json({
            sucesso: true,
            registros: 0,
            recente: true,
            aviso:
              'O progresso foi atualizado há menos de ' +
              INTERVALO_CLIENTE_MIN +
              ' minutos. Tente de novo em ' +
              espera +
              ' minuto(s).',
          })
        }
      }
    }

    /* 2. Entrar na plataforma ------------------------------------- */

    if (!(await entrar())) {
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

    /* 3. Renovar o csrf na tela de matrículas ---------------------- */

    const telaLista = await pedir('/ead/gestao-cursos/matriculas/')
    const htmlLista = await telaLista.text()
    const csrf = tokenDoFormulario(htmlLista) || jar.get('csrftoken') || ''

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

    /*
     * Uma linha por MATRICULA (e-mail + curso + data de inicio). O mesmo
     * curso pode ser liberado de novo para o colaborador (ex.: NR 33 em
     * 2025 e outra vez em 2026); antes as duas viravam uma so e o
     * certificado novo herdava o percentual do antigo.
     */
    const porMatricula = new Map<string, Linha>()

    for (const linha of encontrados) {
      const chave =
        linha.email + '|' + linha.curso.toUpperCase() + '|' + (linha.inicio || '')

      const anterior = porMatricula.get(chave)

      if (!anterior || melhorLinha(linha, anterior) === linha) {
        porMatricula.set(chave, linha)
      }
    }

    /* Coluna do numero da matricula (treinamentos-tempo-por-dia.sql). */
    const sonda = await supabaseAdmin
      .from('treinamentos_progresso')
      .select('matricula_ead')
      .limit(1)

    const suportaTempo = !sonda.error

    const paraRegistro = (l: Linha) => ({
      email: l.email,
      aluno: l.aluno,
      curso: l.curso,
      progresso: l.progresso,
      situacao: l.situacao,
      inicio: l.inicio,
      origem: 'maestrus',
      atualizado_em: agora,
      ...(suportaTempo ? { matricula_ead: l.matricula } : {}),
    })

    let registros = [...porMatricula.values()].map(paraRegistro)

    if (registros.length > 0) {
      const { error: erroGravacao } = await supabaseAdmin
        .from('treinamentos_progresso')
        .upsert(registros, { onConflict: 'email,curso,inicio' })

      /*
       * 42P10: o banco ainda tem a regra antiga (uma linha por e-mail +
       * curso). Ate rodar supabase/ead-matriculas-repetidas.sql, grava
       * do jeito antigo para a rotina nao parar.
       */
      if (erroGravacao && erroGravacao.code === '42P10') {
        const unicos = new Map<string, Linha>()

        for (const linha of encontrados) {
          const chave = linha.email + '|' + linha.curso.toUpperCase()
          const anterior = unicos.get(chave)

          if (!anterior || melhorLinha(linha, anterior) === linha) {
            unicos.set(chave, linha)
          }
        }

        registros = [...unicos.values()].map(paraRegistro)

        const antiga = await supabaseAdmin
          .from('treinamentos_progresso')
          .upsert(registros, { onConflict: 'email,curso' })

        if (antiga.error) throw antiga.error
      } else if (erroGravacao) {
        throw erroGravacao
      }
    }

    /*
     * 6. Tempo de estudo, no que sobrar do tempo da rotina. O agendador
     * tambem chama /api/cron/treinamentos-tempo depois, so para isso.
     */
    const tempo = suportaTempo
      ? await atualizarTempos(250000, cliente || empresaId ? emails : null)
      : null

    await registrar(
      true,
      registros.length,
      (semCadastro.length
        ? 'Sem matrícula no EAD: ' + semCadastro.join(', ')
        : 'Leitura concluída.') +
        (tempo ? ' Tempo de estudo: ' + tempo.lidos + ' lido(s), ' + tempo.pendentes + ' pendente(s).' : '')
    )

    return NextResponse.json({
      sucesso: true,
      colaboradores: emails.length,
      registros: registros.length,
      gravados: registros.length,
      tempo_lido: tempo?.lidos ?? 0,
      tempo_pendente: tempo?.pendentes ?? 0,
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
