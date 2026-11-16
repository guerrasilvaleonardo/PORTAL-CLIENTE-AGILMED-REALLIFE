export type Marca = 'agilmed' | 'reallife'

/*
 * Identidade de cada marca. O layout é o mesmo da plataforma EAD da
 * Real Life (Montserrat, botões em pílula, cartões de 20 px); muda só a
 * cor.
 *
 * - principal / dark / fundo / borda: cor da marca para títulos, abas,
 *   bordas e tintas.
 * - acento / acentoHover / noAcento: preenchimento do botão principal e
 *   a cor do texto sobre ele.
 *
 * Real Life: azul #1D255D e verde #A3D123, os mesmos valores do site e
 * do EAD. Verde nunca é cor de texto (contraste reprova): só fundo, com
 * texto azul por cima.
 *
 * ÁgilMed: mantém o azul que já usava, até virem as cores oficiais.
 */
export const marcas = {
  agilmed: {
    nome: 'ÁgilMed Ocupacional',
    descricao:
      'Saúde Ocupacional, Segurança do Trabalho e Medicina Ocupacional',

    principal: '#2563eb',
    dark: '#1d4ed8',
    fundo: '#eff6ff',
    borda: '#dbeafe',
    acento: '#2563eb',
    acentoHover: '#1d4ed8',
    noAcento: '#ffffff',
  },

  reallife: {
    nome: 'Real Life SSMA',
    descricao:
      'Saúde, Segurança, Meio Ambiente e Gestão de Riscos',

    principal: '#1D255D',
    dark: '#141A45',
    fundo: '#EEF6D6',
    borda: '#E4E5EC',
    acento: '#A3D123',
    acentoHover: '#B4D85A',
    noAcento: '#1D255D',
  },
} as const

export function obterMarca(
  marca: string | null | undefined
): Marca | null {
  if (marca === 'agilmed') {
    return 'agilmed'
  }

  if (marca === 'reallife') {
    return 'reallife'
  }

  return null
}

/*
 * Quem é da equipe interna não tem empresa vinculada, então não há
 * marca para herdar. Nesse caso o endereço decide: cada marca tem o
 * seu próprio domínio, e é essa a identidade que a pessoa espera ver.
 */
export function marcaDoDominio(): Marca {
  if (typeof window === 'undefined') {
    return 'reallife'
  }

  return window.location.hostname.includes('agilmed')
    ? 'agilmed'
    : 'reallife'
}
