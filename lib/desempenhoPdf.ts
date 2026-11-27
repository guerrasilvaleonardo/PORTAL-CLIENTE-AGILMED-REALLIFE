import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import {
  rotuloMes,
  type AnalisePessoa,
  type FichaPessoa,
} from '@/lib/relatorioDesempenho'

/*
 * O conteúdo congelado na liberação. É o mesmo objeto que a tela
 * desenha (components/FichaPublicada), descrito aqui para o gerador
 * não depender de um componente de tela — ele roda no servidor.
 */
export type ConteudoDoPdf = {
  mes: string
  versao: number
  parcial: boolean
  periodo: { ini: string; fim: string }
  anterior: { ini: string; fim: string }
  ficha: FichaPessoa
  analise: Omit<AnalisePessoa, 'roteiro_conversa'> | null
  analiseOrigem: string | null
  fontes: string[]
  limitacoes: string[]
}

/*
 * PDF do relatório individual fechado.
 *
 * POR QUE EXISTE. O conteúdo já ficava congelado no banco desde a
 * ciência, então o relatório nunca mudava. O que faltava era o
 * ARQUIVO: numa auditoria, "posso abrir o portal e imprimir agora" é
 * resposta pior do que entregar o documento.
 *
 * POR QUE NÃO É UMA FOTO DA TELA. Converter a página em imagem produz
 * PDF pesado, com texto que não se copia nem se procura — e que
 * envelhece junto com o CSS. Aqui o PDF é montado a partir do mesmo
 * JSON congelado, então ele diz exatamente o que a pessoa leu, hoje e
 * daqui a cinco anos, mesmo que a tela mude.
 *
 * FONTES PADRÃO (Helvetica) cobrem os acentos do português pela tabela
 * WinAnsi. O que estiver fora dela é trocado antes de escrever — sem
 * isso, um travessão colado de um e-mail derruba a geração inteira.
 */

const AZUL = rgb(29 / 255, 37 / 255, 93 / 255)
const TEXTO = rgb(45 / 255, 48 / 255, 60 / 255)
const CINZA = rgb(110 / 255, 115 / 255, 135 / 255)
const LINHA = rgb(216 / 255, 220 / 255, 232 / 255)

const A4 = { largura: 595.28, altura: 841.89 }
const MARGEM = 48
const LARGURA_UTIL = A4.largura - MARGEM * 2

const TROCAS: Record<string, string> = {
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '…': '...',
  '–': '-',
  '—': '-',
  '•': '-',
  ' ': ' ',
  '→': '->',
  '★': '*',
}

const limpar = (s: string) =>
  String(s ?? '')
    .replace(/[“”‘’…–—• →★]/g, (c) => TROCAS[c])
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')

const dataCurta = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Porto_Velho' }) : '—'

const dataHora = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString('pt-BR', {
        timeZone: 'America/Porto_Velho',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—'

/* O fim do período é exclusivo no dado e inclusivo para quem lê. */
const fimInclusivo = (v: string) => dataCurta(new Date(new Date(v).getTime() - 1).toISOString())

const num = (v: number | null | undefined, sufixo = '') =>
  v === null || v === undefined ? '—' : `${v}${sufixo}`

/* Minutos viram "2 h 10 min": ninguém lê 130 como duas horas. */
function duracao(min: number | null | undefined) {
  if (min === null || min === undefined) return '—'
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

/*
 * Escrever num PDF é empilhar linhas à mão: a folha não quebra sozinha.
 * Esta classe guarda a posição e abre página nova quando acaba o
 * espaço, para o resto do arquivo falar de conteúdo e não de
 * coordenada.
 */
class Folha {
  doc!: PDFDocument
  pagina!: PDFPage
  y = 0
  normal!: PDFFont
  negrito!: PDFFont
  paginas: PDFPage[] = []

  static async criar() {
    const f = new Folha()
    f.doc = await PDFDocument.create()
    f.normal = await f.doc.embedFont(StandardFonts.Helvetica)
    f.negrito = await f.doc.embedFont(StandardFonts.HelveticaBold)
    f.novaPagina()
    return f
  }

  novaPagina() {
    this.pagina = this.doc.addPage([A4.largura, A4.altura])
    this.paginas.push(this.pagina)
    this.y = A4.altura - MARGEM
  }

  espaco(altura: number) {
    if (this.y - altura < MARGEM + 28) this.novaPagina()
  }

  /* Quebra o texto na largura da folha, palavra por palavra. */
  linhas(texto: string, fonte: PDFFont, tamanho: number, largura = LARGURA_UTIL) {
    const saida: string[] = []
    for (const paragrafo of limpar(texto).split('\n')) {
      let atual = ''
      for (const palavra of paragrafo.split(/\s+/)) {
        const teste = atual ? atual + ' ' + palavra : palavra
        if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
          saida.push(atual)
          atual = palavra
        } else {
          atual = teste
        }
      }
      saida.push(atual)
    }
    return saida
  }

  texto(
    t: string,
    opcoes: { tamanho?: number; cor?: any; fonte?: PDFFont; recuo?: number; espacoDepois?: number } = {}
  ) {
    const tamanho = opcoes.tamanho ?? 10
    const fonte = opcoes.fonte ?? this.normal
    const recuo = opcoes.recuo ?? 0
    const altura = tamanho * 1.35
    for (const linha of this.linhas(t, fonte, tamanho, LARGURA_UTIL - recuo)) {
      this.espaco(altura)
      this.pagina.drawText(linha, {
        x: MARGEM + recuo,
        y: this.y - tamanho,
        size: tamanho,
        font: fonte,
        color: opcoes.cor ?? TEXTO,
      })
      this.y -= altura
    }
    this.y -= opcoes.espacoDepois ?? 0
  }

  titulo(t: string) {
    this.espaco(34)
    this.y -= 10
    this.texto(t, { tamanho: 11.5, fonte: this.negrito, cor: AZUL })
    this.espaco(8)
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y - 2 },
      end: { x: A4.largura - MARGEM, y: this.y - 2 },
      thickness: 0.7,
      color: LINHA,
    })
    this.y -= 10
  }

  /* Rótulo à esquerda, valor à direita, numa linha só. */
  campo(rotulo: string, valor: string) {
    const altura = 14
    this.espaco(altura)
    this.pagina.drawText(limpar(rotulo), {
      x: MARGEM,
      y: this.y - 10,
      size: 9.5,
      font: this.normal,
      color: CINZA,
    })
    const v = limpar(valor)
    this.pagina.drawText(v, {
      x: A4.largura - MARGEM - this.negrito.widthOfTextAtSize(v, 9.5),
      y: this.y - 10,
      size: 9.5,
      font: this.negrito,
      color: TEXTO,
    })
    this.y -= altura
  }

  item(t: string) {
    this.texto('- ' + t, { tamanho: 9.5, recuo: 6 })
  }

  /* Rodapé em todas as páginas, no fim: o total só se sabe no fim. */
  rodape(t: string) {
    const total = this.paginas.length
    this.paginas.forEach((p, i) => {
      const texto = limpar(`${t} · página ${i + 1} de ${total}`)
      p.drawText(texto, {
        x: MARGEM,
        y: MARGEM - 14,
        size: 7.5,
        font: this.normal,
        color: CINZA,
      })
    })
  }
}

export type DadosDoPdf = {
  conteudo: ConteudoDoPdf
  mensagem: string | null
  liberadoEm: string
  cienteEm: string | null
  manifestacao: string | null
  manifestacaoEm: string | null
  perguntas: string[] | null
  respostas: Record<string, string> | null
}

export async function montarPdfDesempenho(d: DadosDoPdf): Promise<Uint8Array> {
  const c = d.conteudo
  const f = await Folha.criar()
  const a = c.ficha.atual
  const ant = c.ficha.anterior

  /* Capa */
  f.texto('RELATÓRIO INDIVIDUAL DE DESEMPENHO', {
    tamanho: 8.5,
    fonte: f.negrito,
    cor: CINZA,
    espacoDepois: 2,
  })
  f.texto(c.ficha.nome, { tamanho: 20, fonte: f.negrito, cor: AZUL, espacoDepois: 2 })
  f.texto(
    `${rotuloMes(c.mes)} · versão ${c.versao}${c.parcial ? ' · mês parcial' : ''}`,
    { tamanho: 10, cor: CINZA, espacoDepois: 6 }
  )

  f.titulo('1. Identificação')
  f.campo('Período', `${dataCurta(c.periodo.ini)} a ${fimInclusivo(c.periodo.fim)}`)
  f.campo('Mês anterior', `${dataCurta(c.anterior.ini)} a ${fimInclusivo(c.anterior.fim)}`)
  f.campo('Perfil', c.ficha.perfil)
  f.campo('Liberado em', dataHora(d.liberadoEm))
  f.campo('Ciência', d.cienteEm ? dataHora(d.cienteEm) : 'não registrada')
  if (c.ficha.amostraPequena) {
    f.y -= 4
    f.texto(
      'Amostra pequena no período: os números servem de contexto, não de conclusão sobre a pessoa.',
      { tamanho: 9, cor: CINZA }
    )
  }

  f.titulo('2. Números do mês')
  f.campo('Chamados recebidos', `${a.recebidos} (mês anterior: ${ant.recebidos})`)
  f.campo('Chamados concluídos', `${a.concluidos} (mês anterior: ${ant.concluidos})`)
  f.campo(
    'Dentro do prazo',
    `${num(a.slaPct, '%')} de ${a.slaAvaliados} avaliados (mês anterior: ${num(ant.slaPct, '%')})`
  )
  f.campo('Primeira resposta (mediana)', duracao(a.primeiraRespostaMediana))
  f.campo('Resolução (mediana)', duracao(a.resolucaoMediana))
  f.campo('Reabertura', `${num(a.reaberturaPct, '%')} (${a.reabertos} chamado(s))`)
  f.campo('Em carteira na data', String(a.carteira))
  f.campo('Fora do prazo em aberto', String(a.atrasados))
  f.campo(
    'Avaliações do cliente',
    `${a.notas.excelente} excelente · ${a.notas.bom} bom · ${a.notas.ruim} ruim`
  )
  f.campo(
    'Estrelas',
    `${a.estrelas.total} (prazo ${a.estrelas.prazo} · avaliação ${a.estrelas.avaliacao})`
  )
  if (a.prazoAlteracoes.total > 0) {
    f.campo(
      'Alterações de prazo',
      `${a.prazoAlteracoes.total} (negadas ${a.prazoAlteracoes.negadas} · pendentes ${a.prazoAlteracoes.pendentes})`
    )
  }

  if (c.ficha.achados.length) {
    f.titulo('3. O que os dados mostram')
    for (const achado of c.ficha.achados) {
      const rotulo =
        achado.tipo === 'forte' ? 'Forte' : achado.tipo === 'atencao' ? 'Atenção' : 'Contexto'
      const chamados = achado.chamados.length
        ? ` (chamados ${achado.chamados.slice(0, 8).join(', ')})`
        : ''
      f.item(`${rotulo}: ${achado.texto}${chamados}`)
    }
  }

  if (c.analise) {
    f.titulo('4. Análise')
    if (c.analise.sintese) f.texto(c.analise.sintese, { tamanho: 10, espacoDepois: 6 })

    if (c.analise.pontos_fortes?.length) {
      f.texto('Pontos fortes', { tamanho: 10, fonte: f.negrito, espacoDepois: 2 })
      c.analise.pontos_fortes.forEach((t) => f.item(t))
      f.y -= 4
    }
    if (c.analise.pontos_atencao?.length) {
      f.texto('Pontos de atenção', { tamanho: 10, fonte: f.negrito, espacoDepois: 2 })
      c.analise.pontos_atencao.forEach((t) => f.item(t))
      f.y -= 4
    }
    if (c.analise.plano_acao?.length) {
      f.texto('Plano de ação', { tamanho: 10, fonte: f.negrito, espacoDepois: 2 })
      c.analise.plano_acao.forEach((x) =>
        f.item(`${x.acao} · indicador: ${x.indicador} · meta: ${x.meta} · prazo: ${x.prazo}`)
      )
    }
    if (c.analiseOrigem) {
      f.y -= 4
      f.texto(`Análise escrita por: ${c.analiseOrigem}.`, { tamanho: 8.5, cor: CINZA })
    }
  }

  /*
   * As respostas entram no documento, e não só na tela: o que a pessoa
   * disse sobre o próprio mês é parte do registro da avaliação — e um
   * relatório que guarda só o lado de quem avalia não é registro, é
   * acusação arquivada.
   */
  if ((d.perguntas || []).length) {
    f.titulo('5. Respostas da pessoa avaliada')
    ;(d.perguntas || []).forEach((q, i) => {
      const r = (d.respostas?.[String(i)] || '').trim()
      f.texto(`${i + 1}. ${q}`, { tamanho: 9.5, fonte: f.negrito, espacoDepois: 2 })
      f.texto(r || 'Sem resposta.', {
        tamanho: 9.5,
        recuo: 10,
        cor: r ? TEXTO : CINZA,
        espacoDepois: 6,
      })
    })
  }

  if (d.mensagem || d.manifestacao) {
    f.titulo('6. Mensagem e manifestação')
    if (d.mensagem) {
      f.texto('Mensagem da direção', { tamanho: 10, fonte: f.negrito, espacoDepois: 2 })
      f.texto(d.mensagem, { tamanho: 9.5, espacoDepois: 6 })
    }
    if (d.manifestacao) {
      f.texto(`Manifestação de ${c.ficha.nome.split(' ')[0]} (${dataHora(d.manifestacaoEm)})`, {
        tamanho: 10,
        fonte: f.negrito,
        espacoDepois: 2,
      })
      f.texto(d.manifestacao, { tamanho: 9.5 })
    }
  }

  f.titulo('Como ler este documento')
  f.texto(
    'Ciência não significa concordância: registra que a pessoa leu o relatório. ' +
      'Os números comparam a pessoa com ela mesma no mês anterior e com a mediana da equipe, nunca com um alvo inventado.',
    { tamanho: 9, cor: CINZA, espacoDepois: 4 }
  )
  if (c.fontes?.length) f.texto('Fontes: ' + c.fontes.join('; '), { tamanho: 8.5, cor: CINZA })
  if (c.limitacoes?.length)
    f.texto('Limitações: ' + c.limitacoes.join('; '), { tamanho: 8.5, cor: CINZA })

  /* Assinaturas: o documento também circula em papel. */
  f.espaco(70)
  f.y -= 28
  const meio = A4.largura / 2
  const largura = (LARGURA_UTIL - 24) / 2
  ;[
    { x: MARGEM, rotulo: c.ficha.nome, papel: 'Colaborador(a)' },
    { x: meio + 12, rotulo: 'Direção', papel: 'Real Life SSMA / ÁgilMed' },
  ].forEach((bloco) => {
    f.pagina.drawLine({
      start: { x: bloco.x, y: f.y },
      end: { x: bloco.x + largura, y: f.y },
      thickness: 0.7,
      color: LINHA,
    })
    f.pagina.drawText(limpar(bloco.rotulo), {
      x: bloco.x,
      y: f.y - 12,
      size: 9,
      font: f.negrito,
      color: TEXTO,
    })
    f.pagina.drawText(limpar(bloco.papel), {
      x: bloco.x,
      y: f.y - 23,
      size: 8,
      font: f.normal,
      color: CINZA,
    })
  })
  f.y -= 36

  f.rodape(
    `${c.ficha.nome} · ${rotuloMes(c.mes)} · versão ${c.versao} · ` +
      (d.cienteEm ? `ciência em ${dataHora(d.cienteEm)}` : 'sem ciência')
  )

  return f.doc.save()
}

/* Nome do arquivo que a pessoa vê ao baixar. */
export function nomeDoPdf(nome: string, mes: string) {
  const limpo = limpar(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `desempenho-${limpo}-${mes}.pdf`
}
