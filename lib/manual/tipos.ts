/*
 * Estrutura do Manual do Portal (botão "?" do cabeçalho).
 *
 * O conteúdo fica no código de propósito: muda junto com a tela, no
 * mesmo PR, e passa pela mesma prévia da Vercel. Quem mexer numa
 * tela deve atualizar o capítulo correspondente em cliente.ts ou
 * interno.ts.
 *
 * As "telas" dos slides são ilustrações montadas com blocos simples e
 * dados fictícios: não usam prints reais, então não expõem dado de
 * cliente (LGPD) e não envelhecem como imagem.
 */

export type Tom = 'neutro' | 'bom' | 'alerta' | 'ruim' | 'marca'

export type Bloco = { n?: number } & (
  | { t: 'menu'; itens: string[]; ativo?: string }
  | { t: 'topo'; sobre?: string; titulo: string; sub?: string; botoes?: string[] }
  | { t: 'stats'; itens: { rotulo: string; valor: string; tom?: Tom }[] }
  | { t: 'campos'; itens: { rotulo: string; valor?: string; largo?: boolean; obrigatorio?: boolean }[] }
  | { t: 'botoes'; itens: { rotulo: string; primario?: boolean }[] }
  | { t: 'opcoes'; itens: { rotulo: string; desc?: string; ativo?: boolean }[] }
  | { t: 'tabela'; colunas: string[]; linhas: string[][]; pilulas?: number }
  | { t: 'kanban'; colunas: { titulo: string; cartoes: { texto: string; tom?: Tom }[] }[] }
  | { t: 'chat'; msgs: { autor: string; texto: string; eu?: boolean; etiqueta?: string }[] }
  | { t: 'aviso'; texto: string; tom?: Tom }
  | { t: 'texto'; texto: string }
  | { t: 'barra'; rotulo: string; pct: number }
  | { t: 'checklist'; itens: { texto: string; feito?: boolean }[] }
  | { t: 'agenda' }
  | { t: 'grafico' }
  | { t: 'cartoes'; itens: { titulo: string; texto: string }[] }
  | { t: 'duas'; esquerda: Bloco[]; direita: Bloco[] }
)

export type Tela = {
  /* Endereço mostrado na barra do "navegador" da ilustração. */
  url: string
  blocos: Bloco[]
}

export type Slide = {
  titulo: string
  /* Texto de abertura do slide, em linguagem simples. */
  texto?: string
  /* Passos numerados; o número bate com o marcador na ilustração. */
  passos?: string[]
  dica?: string
  atencao?: string
  tela?: Tela
  /* Atalho para abrir a tela de verdade a partir do slide. */
  link?: { href: string; rotulo: string }
}

export type Capitulo = {
  id: string
  titulo: string
  /* Rotas que abrem o manual direto neste capítulo. */
  rotas?: string[]
  slides: Slide[]
}

export type Manual = {
  titulo: string
  publico: string
  capitulos: Capitulo[]
}
