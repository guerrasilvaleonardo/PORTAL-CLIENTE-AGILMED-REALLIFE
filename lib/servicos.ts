import type { NomeIcone } from '@/components/Icone'

/*
 * Serviços e cursos da vitrine "Contratar e pedir orçamento" (/contratar).
 * Para mudar a lista, edite só este arquivo. Cada item vira uma linha com
 * o botão "Pedir orçamento", que abre um chamado já preenchido.
 *
 * - categoria: precisa ser uma das categorias do chamado
 *   (app/chamados/novo/page.tsx).
 * - marcas: em quais marcas o item aparece.
 *
 * ATENÇÃO: lista inicial sugerida; confirmar com o Leonardo o que cada
 * marca oferece.
 */

export type Servico = {
  titulo: string
  texto: string
  categoria: string
  icone: NomeIcone
  marcas: ('reallife' | 'agilmed')[]
}

export const SERVICOS: Servico[] = [
  {
    titulo: 'Cursos EAD para a equipe',
    texto: 'NR-35, NR-12, NR-10 e outros cursos a distância, com certificado.',
    categoria: 'Treinamentos',
    icone: 'computador',
    marcas: ['reallife', 'agilmed'],
  },
  {
    titulo: 'Treinamento presencial na empresa',
    texto: 'Turma na sua empresa, com a parte prática.',
    categoria: 'Treinamentos',
    icone: 'usuarios',
    marcas: ['reallife', 'agilmed'],
  },
  {
    titulo: 'Laudos e programas',
    texto: 'PGR, PCMSO, LTCAT e outros laudos técnicos.',
    categoria: 'Documentos',
    icone: 'prancheta',
    marcas: ['reallife', 'agilmed'],
  },
  {
    titulo: 'Exames ocupacionais',
    texto: 'Admissional, periódico, demissional e complementares.',
    categoria: 'Exames',
    icone: 'estetoscopio',
    marcas: ['reallife', 'agilmed'],
  },
  {
    titulo: 'eSocial (SST)',
    texto: 'Envio dos eventos de saúde e segurança do trabalho.',
    categoria: 'eSocial',
    icone: 'documentos',
    marcas: ['reallife', 'agilmed'],
  },
]

/* Prefixos do assunto que identificam um pedido de contratação ou orçamento. */
export const PREFIXO_CONTRATACAO = 'Contratação: '
export const PREFIXO_ORCAMENTO = 'Orçamento: '

/* Chamado de orçamento já preenchido para um serviço da vitrine. */
export function linkOrcamento(s: Servico) {
  const q = new URLSearchParams({
    categoria: s.categoria,
    assunto: PREFIXO_ORCAMENTO + s.titulo,
    descricao:
      'Gostaríamos de um orçamento de: ' +
      s.titulo +
      '.\n\nQuantidade aproximada (pessoas, unidades ou documentos): \nPrazo desejado: \nMelhor contato para a proposta: ',
  })

  return '/chamados/novo?' + q.toString()
}
