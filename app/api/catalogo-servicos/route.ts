import { NextResponse } from 'next/server'

/*
 * Serviços e laudos/programas do site, servidos à tela Contratar.
 *
 * Mesmo desenho do /api/cursos-ead, e pelos mesmos motivos:
 *
 *  1. Buscando daqui, do servidor, não há CORS no caminho.
 *  2. A resposta fica guardada por uma hora: a lista muda quando a
 *     revisão técnica muda, não a cada visita.
 *  3. SE O SITE ESTIVER FORA, a tela não quebra. Este endereço devolve
 *     listas vazias com `fora: true`, e a tela mostra a linha genérica
 *     de "Laudos e programas" que existia antes.
 *
 * A fonte da verdade continua sendo lib/documentos.ts e lib/servicos.ts,
 * lá no site. Aqui não existe cópia de texto técnico nenhum.
 */

const SITE = process.env.SITE_URL || 'https://www.reallifessma.com.br'
const CATALOGO = process.env.SITE_CATALOGO_URL || SITE + '/api/catalogo'

export const revalidate = 3600

type ServicoDoSite = { slug: string; nome: string; resumo: string; url: string }

type DocumentoDoSite = {
  slug: string
  sigla: string
  nome: string
  norma: string
  area: string
  areaNome: string
  resumo: string
  url: string
}

const VAZIO = { fora: true, ordemAreas: [], servicos: [], documentos: [] }

/* O site manda o caminho; a tela precisa do endereço inteiro. */
function absoluto(url: string) {
  try {
    return new URL(url, SITE).toString()
  } catch {
    return SITE
  }
}

export async function GET() {
  try {
    /* Oito segundos: se o site demorar mais, a tela não fica esperando. */
    const resposta = await fetch(CATALOGO, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })

    if (!resposta.ok) throw new Error('catálogo respondeu ' + resposta.status)

    const dados = (await resposta.json()) as {
      ordemAreas?: string[]
      servicos?: ServicoDoSite[]
      documentos?: DocumentoDoSite[]
    }

    const servicos = (dados.servicos || []).map((s) => ({ ...s, url: absoluto(s.url) }))
    const documentos = (dados.documentos || []).map((d) => ({ ...d, url: absoluto(d.url) }))

    if (servicos.length === 0 && documentos.length === 0) return NextResponse.json(VAZIO)

    return NextResponse.json({ fora: false, ordemAreas: dados.ordemAreas || [], servicos, documentos })
  } catch (e) {
    console.error('catálogo de serviços indisponível', e)
    /* 200, não 500: para a tela é uma lista que não veio, não um erro. */
    return NextResponse.json(VAZIO)
  }
}
