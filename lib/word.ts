/*
 * Gera um .docx de verdade, sem biblioteca.
 *
 * POR QUE NÃO USAR UMA BIBLIOTECA. O projeto tem as versões fixadas de
 * propósito, e uma dependência nova para escrever quatro arquivos XML
 * dentro de um zip é peso que volta em toda atualização. Um .docx é
 * exatamente isso: um zip com XML dentro.
 *
 * POR QUE NÃO GERAR .doc EM HTML. O Word abre, mas avisa que o formato
 * não bate e estraga a formatação ao salvar. Minuta que o cliente vai
 * preencher e devolver não pode começar com um aviso de erro.
 *
 * O ZIP É SEM COMPRESSÃO (método "stored"). Comprimir exigiria deflate
 * escrito à mão; sem comprimir, o arquivo fica maior e abre igual. Uma
 * minuta de duas páginas dá uns 15 KB — não vale a complexidade.
 */

/* ---------- CRC-32, que o zip exige por arquivo -------------------- */
let tabelaCrc32: Uint32Array | null = null

function tabelaCrc() {
  if (tabelaCrc32) return tabelaCrc32
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  tabelaCrc32 = t
  return t
}

function crc32(dados: Uint8Array) {
  const t = tabelaCrc()
  let c = 0xffffffff
  for (let i = 0; i < dados.length; i++) c = t[(c ^ dados[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* ---------- Zip mínimo --------------------------------------------- */
type Arquivo = { nome: string; dados: Uint8Array }

/* Data e hora fixas, no formato DOS que o zip usa: 01/01/2020, 00:00.
 * Fixas para o mesmo conteúdo gerar sempre o mesmo arquivo — e VÁLIDAS,
 * porque mês ou dia zero faz leitor rigoroso recusar o pacote. */
const DATA = ((2020 - 1980) << 9) | (1 << 5) | 1
const HORA = 0

function zip(arquivos: Arquivo[]) {
  const pedacos: Uint8Array[] = []
  const central: Uint8Array[] = []
  let deslocamento = 0

  const n16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff])
  const n32 = (v: number) =>
    new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])

  const juntar = (partes: Uint8Array[]) => {
    const total = partes.reduce((s, p) => s + p.length, 0)
    const saida = new Uint8Array(total)
    let i = 0
    for (const p of partes) {
      saida.set(p, i)
      i += p.length
    }
    return saida
  }

  for (const a of arquivos) {
    const nome = new TextEncoder().encode(a.nome)
    const crc = crc32(a.dados)
    const tam = a.dados.length

    const cabecalho = juntar([
      n32(0x04034b50),
      n16(20), // versão necessária
      n16(0x0800), // nome em UTF-8
      n16(0), // sem compressão
      n16(HORA),
      n16(DATA),
      n32(crc),
      n32(tam),
      n32(tam),
      n16(nome.length),
      n16(0),
      nome,
    ])

    pedacos.push(cabecalho, a.dados)

    central.push(
      juntar([
        n32(0x02014b50),
        n16(20),
        n16(20),
        n16(0x0800),
        n16(0),
        n16(HORA),
        n16(DATA),
        n32(crc),
        n32(tam),
        n32(tam),
        n16(nome.length),
        n16(0),
        n16(0),
        n16(0),
        n16(0),
        n32(0),
        n32(deslocamento),
        nome,
      ])
    )

    deslocamento += cabecalho.length + tam
  }

  const diretorio = juntar(central)
  const fim = juntar([
    n32(0x06054b50),
    n16(0),
    n16(0),
    n16(arquivos.length),
    n16(arquivos.length),
    n32(diretorio.length),
    n32(deslocamento),
    n16(0),
  ])

  return juntar([...pedacos, diretorio, fim])
}

/* ---------- O documento -------------------------------------------- */

export type Bloco =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'secao'; texto: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'nota'; texto: string }
  /* Faixa de aviso no alto: diz que o conteúdo é exemplo. */
  | { tipo: 'aviso'; texto: string }
  /* Linha para preencher. Com `exemplo`, já vem um modelo de resposta
   * em itálico cinza, para a pessoa ver o nível de detalhe esperado. */
  | { tipo: 'campo'; rotulo: string; exemplo?: string }
  | { tipo: 'tabela'; colunas: string[]; exemplos?: string[][]; linhas: number }

const escapar = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

type Estilo = {
  tam?: number
  negrito?: boolean
  italico?: boolean
  cor?: string
  espacoAntes?: number
  fundo?: string
}

const formato = (o: Estilo) =>
  '<w:rPr>' +
  (o.negrito ? '<w:b/>' : '') +
  (o.italico ? '<w:i/>' : '') +
  `<w:sz w:val="${o.tam || 22}"/><w:szCs w:val="${o.tam || 22}"/>` +
  (o.cor ? `<w:color w:val="${o.cor}"/>` : '') +
  '</w:rPr>'

/* meio-ponto: o Word mede fonte em half-points. 24 = 12pt. */
function paragrafo(texto: string, o: Estilo = {}) {
  const rpr = formato(o)

  return (
    '<w:p><w:pPr>' +
    `<w:spacing w:before="${o.espacoAntes ?? 60}" w:after="60"/>` +
    (o.fundo ? `<w:shd w:val="clear" w:fill="${o.fundo}"/>` : '') +
    rpr +
    '</w:pPr>' +
    `<w:r>${rpr}<w:t xml:space="preserve">${escapar(texto)}</w:t></w:r></w:p>`
  )
}

/* Duas corridas no mesmo parágrafo: o rótulo normal e o exemplo em
 * itálico cinza, para a pessoa distinguir à primeira vista o que é
 * formulário e o que é sugestão. */
function paragrafoComExemplo(rotulo: string, exemplo: string) {
  const base = formato({})
  const sugestao = formato({ italico: true, cor: '888888' })

  return (
    '<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>' +
    `<w:r>${base}<w:t xml:space="preserve">${escapar(rotulo)}: </w:t></w:r>` +
    `<w:r>${sugestao}<w:t xml:space="preserve">${escapar(exemplo)}</w:t></w:r></w:p>`
  )
}

function celula(texto: string, largura: number, o: Estilo) {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>` +
    (o.fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fundo}"/>` : '') +
    '</w:tcPr>' +
    paragrafo(texto, { ...o, tam: 20 }) +
    '</w:tc>'
  )
}

function tabela(colunas: string[], exemplos: string[][], linhas: number) {
  const largura = Math.floor(9360 / colunas.length)

  const borda =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((b) => `<w:${b} w:val="single" w:sz="4" w:color="BBBBBB"/>`)
      .join('') +
    '</w:tblBorders>'

  const cabecalho =
    '<w:tr>' +
    colunas.map((c) => celula(c, largura, { negrito: true, fundo: 'EFEFEF' })).join('') +
    '</w:tr>'

  /* Linha de exemplo: itálico, cinza e com fundo, para ninguém
   * confundir sugestão com registro da própria empresa. */
  const comExemplo = exemplos
    .map(
      (linha) =>
        '<w:tr>' +
        colunas
          .map((_, i) =>
            celula(linha[i] || '', largura, { italico: true, cor: '888888', fundo: 'FAFAFA' })
          )
          .join('') +
        '</w:tr>'
    )
    .join('')

  const vazias = Array.from({ length: linhas })
    .map(() => '<w:tr>' + colunas.map(() => celula('', largura, {})).join('') + '</w:tr>')
    .join('')

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>${borda}</w:tblPr>` +
    cabecalho +
    comExemplo +
    vazias +
    '</w:tbl>' +
    paragrafo('')
  )
}

function corpo(blocos: Bloco[]) {
  return blocos
    .map((b) => {
      switch (b.tipo) {
        case 'titulo':
          return paragrafo(b.texto, { tam: 32, negrito: true, espacoAntes: 0 })
        case 'subtitulo':
          return paragrafo(b.texto, { tam: 22, cor: '555555' })
        case 'secao':
          return paragrafo(b.texto, { tam: 24, negrito: true, espacoAntes: 240 })
        case 'texto':
          return paragrafo(b.texto)
        case 'nota':
          return paragrafo(b.texto, { tam: 18, cor: '777777' })
        case 'aviso':
          return paragrafo(b.texto, {
            tam: 20,
            negrito: true,
            cor: '8A5A00',
            fundo: 'FDF4E3',
            espacoAntes: 120,
          })
        case 'campo':
          return b.exemplo
            ? paragrafoComExemplo(b.rotulo, b.exemplo)
            : paragrafo(b.rotulo + ': ___________________________________________')
        case 'tabela':
          return tabela(b.colunas, b.exemplos || [], b.linhas)
      }
    })
    .join('')
}

const TIPOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>'

const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>'

export function gerarDocx(blocos: Bloco[]) {
  const documento =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' +
    corpo(blocos) +
    /* A4 retrato com margens de 2 cm. */
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    '</w:body></w:document>'

  const texto = (s: string) => new TextEncoder().encode(s)

  const bytes = zip([
    { nome: '[Content_Types].xml', dados: texto(TIPOS) },
    { nome: '_rels/.rels', dados: texto(RELS) },
    { nome: 'word/document.xml', dados: texto(documento) },
  ])

  return new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
