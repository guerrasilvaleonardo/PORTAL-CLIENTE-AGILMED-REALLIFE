import { MODELOS_9001 } from './modelosImplantacao9001'
import { MODELOS_45001 } from './modelosImplantacao45001'

export type { ModeloDoc, Norma } from './modelosImplantacaoBase'

/*
 * Todos os modelos que o cliente baixa nas atividades da implantação.
 *
 * Um arquivo por norma, porque o mesmo assunto muda de texto entre
 * qualidade e SSO: a política da qualidade fala de cliente, a política
 * de SSO fala de não se machucar. Juntar os dois num arquivo só faria
 * um bloco de duas mil linhas em que ninguém acha nada.
 *
 * Os ajudantes comuns — o aviso de exemplo, o cabeçalho controlado, o
 * bloco de aprovação — estão em ./modelosImplantacaoBase.ts, com o
 * porquê de cada um.
 *
 * A ORDEM IMPORTA PARA A TELA: a bancada da equipe lista nesta ordem,
 * e publicar todos percorre a lista inteira. 9001 primeiro porque é a
 * trilha mais antiga e a que a equipe já conhece de cor.
 */
export const MODELOS = [...MODELOS_9001, ...MODELOS_45001]
