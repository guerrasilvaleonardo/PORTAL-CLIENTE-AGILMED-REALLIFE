/*
 * Ler planilha no navegador, sem biblioteca.
 *
 * Aceita .xlsx (o que sai do Excel e do OnSafety) e .csv. O .xlsx é um
 * ZIP com XML dentro; o navegador já sabe descompactar (DecompressionStream),
 * então dá para ler o arquivo sem acrescentar dependência ao projeto —
 * que é o que mantém o portal leve e sem CVE de biblioteca de planilha.
 *
 * Lê o que precisamos e só isso: a grade de texto da primeira aba.
 * Formatação, fórmula, data formatada, imagem — nada disso importa aqui,
 * porque a planilha de EPI é uma tabelinha de CA, complemento e números.
 *
 * As datas do Excel vêm como número de série e saem assim mesmo. Nenhuma
 * coluna da planilha de EPI é data; no dia em que for, trata-se aqui.
 */

export type Linha = string[]

/* ---------- CSV ---------- */

/* Excel brasileiro salva CSV com ponto e vírgula. Descobrimos pelo que
 * aparece mais na primeira linha, em vez de obrigar a pessoa a saber. */
function separadorDe(texto: string): string {
  const primeira = texto.split(/\r?\n/)[0] || ''
  const pontoEVirgula = (primeira.match(/;/g) || []).length
  const virgula = (primeira.match(/,/g) || []).length
  return pontoEVirgula >= virgula ? ';' : ','
}

export function lerCsv(texto: string): Linha[] {
  /* O BOM do "CSV UTF-8" do Excel vira um caractere invisível na
   * primeira célula se não for tirado. */
  const limpo = texto.replace(/^﻿/, '')
  const sep = separadorDe(limpo)

  const linhas: Linha[] = []
  let celula = ''
  let linha: Linha = []
  let aspas = false

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]

    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          celula += '"'
          i++
        } else {
          aspas = false
        }
      } else {
        celula += c
      }
      continue
    }

    if (c === '"') {
      aspas = true
    } else if (c === sep) {
      linha.push(celula)
      celula = ''
    } else if (c === '\n') {
      linha.push(celula)
      linhas.push(linha)
      linha = []
      celula = ''
    } else if (c !== '\r') {
      celula += c
    }
  }

  if (celula !== '' || linha.length) {
    linha.push(celula)
    linhas.push(linha)
  }

  return linhas
}

/* ---------- ZIP ---------- */

type Entrada = { nome: string; metodo: number; inicio: number; tamanho: number; cru: number }

/* Lê o índice do ZIP (o "diretório central", no fim do arquivo). */
function entradasDoZip(b: DataView): Entrada[] {
  const bytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)

  /* Acontece de um .xls antigo estar salvo com o nome .xlsx. Ele começa
   * com a assinatura do formato antigo da Microsoft, e nenhum navegador
   * lê isso. Melhor dizer o que é do que dizer "arquivo inválido". */
  if (
    bytes.length > 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  ) {
    throw new Error(
      'Este arquivo é um Excel antigo (.xls) com nome de .xlsx. Abra no Excel e salve como .xlsx.'
    )
  }

  let fim = -1
  const minimo = Math.max(0, bytes.length - 70000)
  for (let i = bytes.length - 22; i >= minimo; i--) {
    if (b.getUint32(i, true) === 0x06054b50) {
      fim = i
      break
    }
  }
  if (fim < 0) throw new Error('Este arquivo não parece uma planilha do Excel.')

  const total = b.getUint16(fim + 10, true)
  let p = b.getUint32(fim + 16, true)
  const entradas: Entrada[] = []

  for (let n = 0; n < total; n++) {
    if (b.getUint32(p, true) !== 0x02014b50) break
    const metodo = b.getUint16(p + 10, true)
    const tamanho = b.getUint32(p + 20, true)
    const cru = b.getUint32(p + 24, true)
    const nomeLen = b.getUint16(p + 28, true)
    const extraLen = b.getUint16(p + 30, true)
    const comentLen = b.getUint16(p + 32, true)
    const desloc = b.getUint32(p + 42, true)
    const nome = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nomeLen))

    /* O cabeçalho local diz onde os dados começam de verdade: os campos
     * de nome e extra dele têm tamanho próprio, diferente daqui. */
    const nomeLocal = b.getUint16(desloc + 26, true)
    const extraLocal = b.getUint16(desloc + 28, true)
    const inicio = desloc + 30 + nomeLocal + extraLocal

    entradas.push({ nome, metodo, inicio, tamanho, cru })
    p += 46 + nomeLen + extraLen + comentLen
  }

  return entradas
}

type Inflar = (dados: Uint8Array) => Promise<Uint8Array>

async function conteudo(
  bytes: Uint8Array,
  e: Entrada | undefined,
  inflar: Inflar
): Promise<string> {
  if (!e) return ''
  const dados = bytes.subarray(e.inicio, e.inicio + e.tamanho)
  const cru = e.metodo === 0 ? dados : await inflar(dados)
  return new TextDecoder('utf-8').decode(cru)
}

/* ---------- XLSX ---------- */

const semEscape = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

/* O texto de um <si> ou <is>: pode vir partido em vários <t> quando a
 * célula tem pedaços com formatação diferente. */
function textoDe(xml: string): string {
  const partes = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []
  return semEscape(partes.map((p) => p.replace(/<[^>]+>/g, '')).join(''))
}

/* "BC12" -> 54 (coluna 0-based). */
function colunaDe(ref: string): number {
  const letras = (ref.match(/^[A-Z]+/) || [''])[0]
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

export async function lerXlsx(bytes: Uint8Array, inflar: Inflar): Promise<Linha[]> {
  const visao = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entradas = entradasDoZip(visao)

  /* A primeira aba. sheet1.xml é o caso normal; a busca cobre quem
   * salvou com outro número. */
  const aba =
    entradas.find((e) => e.nome === 'xl/worksheets/sheet1.xml') ||
    entradas
      .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.nome))
      .sort((a, b) => a.nome.localeCompare(b.nome))[0]
  if (!aba) throw new Error('A planilha está sem abas.')

  const compartilhadas = (
    await conteudo(bytes, entradas.find((e) => e.nome === 'xl/sharedStrings.xml'), inflar)
  )
    .split('<si>')
    .slice(1)
    .map(textoDe)

  const xml = await conteudo(bytes, aba, inflar)
  const linhas: Linha[] = []

  for (const linhaXml of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
    const linha: Linha = []

    for (const celula of linhaXml.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) || []) {
      const ref = (celula.match(/\sr="([A-Z]+\d+)"/) || [])[1]
      const coluna = ref ? colunaDe(ref) : linha.length
      const tipo = (celula.match(/\st="([^"]+)"/) || [])[1] || 'n'

      let valor = ''
      if (tipo === 's') {
        const i = Number((celula.match(/<v>([^<]*)<\/v>/) || [])[1])
        valor = compartilhadas[i] ?? ''
      } else if (tipo === 'inlineStr') {
        valor = textoDe(celula)
      } else {
        valor = semEscape((celula.match(/<v>([^<]*)<\/v>/) || [])[1] || '')
      }

      while (linha.length < coluna) linha.push('')
      linha[coluna] = valor
    }

    linhas.push(linha)
  }

  return linhas
}

/* ---------- a porta de entrada ---------- */

export async function lerPlanilha(arquivo: File): Promise<Linha[]> {
  const nome = arquivo.name.toLowerCase()

  if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    /* Excel antigo salva CSV em latin1; o moderno, em UTF-8. Se a
     * leitura como UTF-8 tiver caractere quebrado, é latin1. */
    const utf8 = new TextDecoder('utf-8').decode(bytes)
    const texto = utf8.includes('�') ? new TextDecoder('latin1').decode(bytes) : utf8
    return lerCsv(texto)
  }

  if (!nome.endsWith('.xlsx')) {
    throw new Error('Mande um arquivo .xlsx ou .csv. O .xls antigo não serve — salve como .xlsx.')
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  return lerXlsx(bytes, async (dados) => {
    const fluxo = new Blob([dados as unknown as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(fluxo).arrayBuffer())
  })
}
