import type { Bloco } from './word'

/*
 * Os modelos que o cliente baixa em cada atividade da implantação.
 *
 * O TEXTO É NOSSO. Nada aqui transcreve norma — a ABNT vende o texto.
 * O que está escrito é o formulário que o documento costuma ter, na
 * nossa linguagem, com o número do requisito só como referência.
 *
 * VÊM PREENCHIDOS COM EXEMPLO, pela mesma razão das minutas da
 * auditoria: quem nunca montou um sistema de gestão não sabe o nível
 * de detalhe esperado, e um formulário em branco não ensina nada.
 *
 * E O EXEMPLO VEM MARCADO. Sai em itálico cinza, com fundo, e o
 * documento abre com um aviso. Sem isso, a empresa devolve o modelo
 * com os dados da empresa fictícia dentro — e aí não é descuido nosso,
 * é evidência falsa assinada por ela, que o auditor externo derruba na
 * primeira pergunta.
 *
 * O CABEÇALHO CONTROLADO VEM NO MODELO. Código, revisão e data de
 * aprovação em todo documento, porque é o que o 7.5.2 cobra — e porque
 * o primeiro procedimento da trilha é justamente o que define esse
 * formato. Entregar modelo sem cabeçalho seria contradizer a aula.
 */

export const EMPRESA = 'Metalúrgica Exemplo Ltda'

export type Norma = '9001' | '45001'

export type ModeloDoc = {
  /* Nome do arquivo no balde implantacao-modelos. */
  arquivo: string
  rotulo: string
  /* A norma a que o modelo pertence. As duas trilhas tem modelo
   * proprio: o mesmo assunto muda de texto entre qualidade e SSO. */
  norma: Norma
  /* Etapa e atividade a que ele pertence, para ligar depois. */
  etapa: number
  atividade: number
  blocos: Bloco[]
}

export const aviso = (): Bloco => ({
  tipo: 'aviso',
  texto:
    'O que está em itálico cinza é EXEMPLO, para mostrar o nível de detalhe esperado. ' +
    'Apague e escreva o que a sua empresa realmente faz antes de usar este documento.',
})

/* O cabeçalho que o próprio procedimento de informação documentada
 * manda usar. Repetido em todo modelo de propósito. */
export const controle = (codigo: string): Bloco[] => [
  {
    tipo: 'tabela',
    colunas: ['Documento', 'Código', 'Revisão', 'Aprovado em'],
    exemplos: [[codigo + ' — ver título acima', codigo, '00', '12/03/2026']],
    linhas: 1,
  },
  { tipo: 'campo', rotulo: 'Empresa', exemplo: EMPRESA },
  { tipo: 'campo', rotulo: 'Responsável pelo preenchimento', exemplo: 'Ana Ribeiro — Coordenadora da Qualidade' },
]

export const aprovacao = (): Bloco[] => [
  { tipo: 'secao', texto: 'Aprovação' },
  { tipo: 'campo', rotulo: 'Nome e cargo', exemplo: 'Carlos Menezes — Diretor Industrial' },
  { tipo: 'campo', rotulo: 'Data' },
  { tipo: 'campo', rotulo: 'Assinatura' },
  { tipo: 'secao', texto: 'Histórico de alterações' },
  {
    tipo: 'tabela',
    colunas: ['Revisão', 'Data', 'O que mudou', 'Quem aprovou'],
    exemplos: [['00', '12/03/2026', 'Emissão inicial', 'Carlos Menezes']],
    linhas: 3,
  },
]

export const cabeca = (titulo: string, sub: string, codigo: string): Bloco[] => [
  { tipo: 'titulo', texto: titulo },
  { tipo: 'subtitulo', texto: sub },
  aviso(),
  ...controle(codigo),
]

