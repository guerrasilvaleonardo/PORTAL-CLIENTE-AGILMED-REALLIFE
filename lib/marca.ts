export type Marca = 'agilmed' | 'reallife';

export const marcas = {
  agilmed: {
    nome: 'ÁgilMed Ocupacional',
    descricao: 'Saúde Ocupacional, Segurança do Trabalho e Medicina Ocupacional',
  },

  reallife: {
    nome: 'Real Life SSMA',
    descricao: 'Saúde, Segurança, Meio Ambiente e Gestão de Riscos',
  },
} as const;

export function obterMarca(marca: string | null | undefined): Marca {
  return marca === 'reallife' ? 'reallife' : 'agilmed';
}
