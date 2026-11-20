/*
 * A estrutura de pastas que o cliente monta ANTES de responder a
 * primeira pergunta da auditoria.
 *
 * ELA É GERADA A PARTIR DO CHECKLIST, não escrita à mão. Uma pasta por
 * requisito da norma, na ordem da norma, agrupada pelo capítulo. Assim
 * pasta e pergunta nunca divergem: mudou o checklist, muda a estrutura
 * na próxima vez que alguém baixar.
 *
 * POR QUE POR REQUISITO, E NÃO POR TEMA. Organizar por tema parece mais
 * natural para quem trabalha na empresa, mas a auditoria não pergunta
 * por tema: pergunta pelo item. Com a pasta nomeada pelo número, "me
 * mostra o 8.5.4" vira um clique. É também o que deixa visível o que
 * falta — pasta vazia é requisito sem evidência.
 *
 * O NOME DA PASTA É SÓ O NÚMERO. Colocar título junto obrigaria a
 * inventar um resumo para cada um dos 89 requisitos, e nome de pasta
 * longo quebra caminho no Windows. O que a pasta quer está escrito no
 * LEIA-ME dentro dela, com a pergunta e o que pedir para ver.
 *
 * UM DOCUMENTO PODE SERVIR A MAIS DE UM REQUISITO. A ata da análise
 * crítica responde ao 9.3 e alimenta o 10.1. Nesse caso o arquivo mora
 * em um lugar só e o LEIA-ME do outro aponta para ele — cópia em duas
 * pastas vira duas versões diferentes em três meses.
 */

export type ItemDaNorma = {
  requisito: string
  categoria: string
  pergunta: string
  orientacao?: string | null
}

/* Um requisito pode ter mais de uma pergunta — o 4.1 tem a do contexto
 * e a da mudança climática, o 10.2 tem três. A pasta é uma só, e o
 * LEIA-ME dela lista todas. Antes disso o segundo LEIA-ME apagava o
 * primeiro, e a pasta ficava explicando metade do que guarda. */
export type PastaDeRequisito = {
  requisito: string
  perguntas: string[]
  orientacoes: string[]
}

export type GrupoDePastas = {
  /* "04 - Contexto", já no formato que ordena sozinho no Explorer. */
  pasta: string
  titulo: string
  itens: PastaDeRequisito[]
}

/* Pastas que não saem do checklist, mas que toda auditoria usa. */
export const PASTAS_FIXAS: { nome: string; oque: string }[] = [
  {
    nome: '00 - Programa e plano de auditoria',
    oque: 'Programa do ano, plano de cada auditoria, convocações e atas das reuniões de abertura e encerramento.',
  },
  {
    nome: '98 - Relatorios de auditoria',
    oque: 'Os relatórios emitidos e o registro de para quem foram enviados.',
  },
  {
    nome: '99 - Arquivo e legado',
    oque: 'Versões antigas e documentos fora de uso. Nunca guarde documento vigente aqui — é isso que evita o auditor achar a versão errada.',
  },
]

/* "9 Avaliação" vira "09 - Avaliação": o zero à esquerda é o que faz o
 * Explorer ordenar certo, senão o 10 aparece antes do 4. */
export function pastaDoCapitulo(categoria: string) {
  const m = categoria.match(/^(\d+)\s+(.*)$/)
  if (!m) return categoria
  return m[1].padStart(2, '0') + ' - ' + m[2]
}

export function agrupar(itens: ItemDaNorma[]): GrupoDePastas[] {
  return itens.reduce<GrupoDePastas[]>((acc, i) => {
    const pasta = pastaDoCapitulo(i.categoria)
    let grupo = acc[acc.length - 1]
    if (!grupo || grupo.pasta !== pasta) {
      grupo = { pasta, titulo: i.categoria, itens: [] }
      acc.push(grupo)
    }

    const existente = grupo.itens.find((x) => x.requisito === i.requisito)
    const alvo = existente || { requisito: i.requisito, perguntas: [], orientacoes: [] }
    if (!existente) grupo.itens.push(alvo)

    alvo.perguntas.push(i.pergunta)
    if (i.orientacao) alvo.orientacoes.push(i.orientacao)

    return acc
  }, [])
}

/* Windows não aceita estes caracteres em nome de pasta. */
const limpar = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim()

/*
 * Gera o .bat que cria a estrutura.
 *
 * .bat e não instruções na tela porque ele é clicado duas vezes e
 * pronto. Pedir para alguém criar 60 pastas à mão é pedir para a
 * estrutura nascer torta — e estrutura torta no começo é retrabalho no
 * meio da auditoria.
 *
 * `chcp 65001` no topo: sem isso o cmd escreve "Avaliação" como
 * "AvaliaÃ§Ã£o" e a pasta nasce com o nome errado.
 */
export function gerarBatEstrutura(raiz: string, norma: string, grupos: GrupoDePastas[]) {
  const linhas: string[] = [
    '@echo off',
    'chcp 65001 > nul',
    '',
    `rem Estrutura de pastas por requisito da ${limpar(norma)}.`,
    'rem Gerada pelo portal da Real Life SSMA.',
    'rem Rodar de novo nao apaga nada: pasta que ja existe e mantida.',
    '',
    `set "RAIZ=${raiz.replace(/"/g, '')}"`,
    '',
    'echo.',
    'echo Criando a estrutura em "%RAIZ%"',
    'echo.',
  ]

  /* O cmd trata estes caracteres como comando dentro do echo. */
  const seguro = (s: string) => s.replace(/[\^&<>|%]/g, (c) => '^' + c)

  const criar = (caminho: string) =>
    linhas.push(`if not exist "%RAIZ%\\${caminho}" mkdir "%RAIZ%\\${caminho}"`)

  const leiaMe = (caminho: string, titulo: string, corpo: string[]) => {
    const arq = `%RAIZ%\\${caminho}\\LEIA-ME.txt`
    linhas.push(`> "${arq}" echo ${seguro(titulo)}`)
    for (const l of corpo) {
      linhas.push(`>> "${arq}" echo.`)
      linhas.push(`>> "${arq}" echo ${seguro(l)}`)
    }
    linhas.push(`>> "${arq}" echo.`)
    linhas.push(`>> "${arq}" echo Real Life SSMA - portal do cliente`)
  }

  for (const f of PASTAS_FIXAS.slice(0, 1)) {
    criar(f.nome)
    leiaMe(f.nome, f.nome, [f.oque])
  }

  for (const g of grupos) {
    criar(g.pasta)
    leiaMe(g.pasta, g.titulo, [
      `Uma pasta por requisito deste capitulo da ${limpar(norma)}.`,
      'Pasta vazia e requisito sem evidencia.',
    ])

    for (const i of g.itens) {
      const caminho = `${g.pasta}\\${limpar(i.requisito)}`
      criar(caminho)
      leiaMe(caminho, `Requisito ${i.requisito}`, [
        i.perguntas.length > 1
          ? 'Guarde aqui a evidencia que responde a estas perguntas:'
          : 'Guarde aqui a evidencia que responde a:',
        ...i.perguntas,
        ...(i.orientacoes.length ? ['O que o auditor pede para ver:', ...i.orientacoes] : []),
      ])
    }
  }

  for (const f of PASTAS_FIXAS.slice(1)) {
    criar(f.nome)
    leiaMe(f.nome, f.nome, [f.oque])
  }

  const total =
    PASTAS_FIXAS.length + grupos.length + grupos.reduce((s, g) => s + g.itens.length, 0)

  linhas.push(
    '',
    'echo.',
    `echo Pronto. ${total} pastas criadas.`,
    'echo Abra o LEIA-ME dentro de cada uma para saber o que guardar nela.',
    'echo.',
    'pause'
  )

  return linhas.join('\r\n') + '\r\n'
}
