import { NextResponse } from 'next/server'

/*
 * O catálogo de cursos da plataforma, servido ao portal.
 *
 * POR QUE PASSAR POR AQUI em vez de a tela buscar direto. Três razões,
 * e a terceira é a que importa:
 *
 *  1. A tela é do navegador do cliente e a plataforma é outro domínio.
 *     Buscando daqui, do servidor, não há CORS no caminho.
 *  2. Dá para guardar a resposta: a lista muda quando o preço muda,
 *     não a cada visita.
 *  3. SE A PLATAFORMA ESTIVER FORA, a tela não quebra. Este endereço
 *     devolve uma lista vazia com `fora: true`, e a tela mostra o
 *     convite para pedir orçamento sem os preços — que é exatamente o
 *     que ela mostrava antes de tudo isto existir.
 *
 * A fonte da verdade continua sendo lib/cursos-ead.ts, lá na
 * plataforma. Aqui não existe cópia de preço nenhum.
 */

/* Dá para apontar para um preview da plataforma sem mexer no código,
   como `lib/portal.ts` faz do outro lado. */
const CATALOGO =
  process.env.EAD_CATALOGO_URL || 'https://www.reallifessma.com.br/api/ead/catalogo'

export const revalidate = 3600

type CursoDaPlataforma = {
  grupo: string
  nome: string
  nivel: string
  descricao: string
  ead: number
  pratica: number
  preco: number
  slug: string
  url: string
  novo: boolean
}

export async function GET() {
  try {
    /* Oito segundos: se a plataforma demorar mais que isso, a tela do
       cliente não fica pendurada esperando. */
    const resposta = await fetch(CATALOGO, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })

    if (!resposta.ok) throw new Error('catálogo respondeu ' + resposta.status)

    const dados = (await resposta.json()) as {
      ordemGrupos?: string[]
      cursos?: CursoDaPlataforma[]
    }

    const cursos = dados.cursos || []

    return NextResponse.json({
      fora: false,
      ordemGrupos: dados.ordemGrupos || [],
      cursos,
      /* A tela escreve "de R$ X a R$ Y" no alto; a conta sai aqui para
         não ser refeita em cada navegador. */
      menorPreco: cursos.length ? Math.min(...cursos.map((c) => c.preco)) : 0,
      maiorPreco: cursos.length ? Math.max(...cursos.map((c) => c.preco)) : 0,
    })
  } catch (e) {
    console.error('catálogo de cursos indisponível', e)
    /* 200, não 500: para a tela isto não é erro, é uma lista que não
       veio. O pedido de orçamento continua funcionando sem ela. */
    return NextResponse.json({ fora: true, ordemGrupos: [], cursos: [], menorPreco: 0, maiorPreco: 0 })
  }
}
