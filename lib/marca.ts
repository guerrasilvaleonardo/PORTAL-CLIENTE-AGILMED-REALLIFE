export type Marca = 'agilmed' | 'reallife'

export const marcas = {
  agilmed: {
    nome: 'ÁgilMed Ocupacional',
    descricao:
      'Saúde Ocupacional, Segurança do Trabalho e Medicina Ocupacional',

    principal: '#2563eb',
    dark: '#1d4ed8',
    fundo: '#eff6ff',
    borda: '#dbeafe',
  },

  reallife: {
    nome: 'Real Life SSMA',
    descricao:
      'Saúde, Segurança, Meio Ambiente e Gestão de Riscos',

    principal: '#0f766e',
    dark: '#115e59',
    fundo: '#f0fdfa',
    borda: '#ccfbf1',
  },
} as const

export function obterMarca(
  marca: string | null | undefined
): Marca {
  return marca === 'reallife' ? 'reallife' : 'agilmed'
}
