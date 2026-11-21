/*
 * O vocabulário fechado da não conformidade.
 *
 * POR QUE LISTA E NÃO TEXTO LIVRE. Texto livre não soma. Dez pessoas
 * escrevem "falta de treinamento" de dez maneiras, e no fim do ano
 * ninguém consegue dizer qual é o problema que mais repete — que é
 * exatamente o que o auditor pergunta e o que o cliente paga para
 * saber. Lista fechada é o que transforma registro em indicador.
 *
 * AS MESMAS LISTAS ESTÃO NO BANCO, como restrição, em
 * supabase/nc-tipologia-e-causa.sql. Mexeu aqui, mexe lá: o banco
 * recusa valor que não esteja na dele, e o erro aparece na cara de
 * quem está em campo.
 *
 * O QUE NÃO ESTÁ AQUI, de propósito: nada de texto de norma. Os
 * rótulos são palavras do ofício, escritas por nós. Citar cláusula a
 * gente faz por número, no relatório.
 */

export type Opcao = { valor: string; rotulo: string }

/*
 * O ASSUNTO DO DESVIO. Serve para duas coisas: agrupar o histórico
 * ("de novo altura") e escolher as sugestões certas na espinha de
 * peixe. Dezenove entradas — cabe num celular sem virar rolagem
 * infinita, e cobre o que aparece numa visita de verdade.
 */
export const TIPOLOGIAS: Opcao[] = [
  { valor: 'epi', rotulo: 'EPI' },
  { valor: 'trabalho_altura', rotulo: 'Trabalho em altura' },
  { valor: 'trabalho_quente', rotulo: 'Trabalho a quente' },
  { valor: 'espaco_confinado', rotulo: 'Espaço confinado' },
  { valor: 'eletricidade', rotulo: 'Eletricidade' },
  { valor: 'bloqueio_etiquetagem', rotulo: 'Bloqueio e etiquetagem' },
  { valor: 'maquinas_protecoes', rotulo: 'Máquinas e proteções' },
  { valor: 'movimentacao_carga', rotulo: 'Movimentação de carga' },
  { valor: 'veiculos_transito', rotulo: 'Veículos e trânsito interno' },
  { valor: 'produto_quimico', rotulo: 'Produto químico' },
  { valor: 'ergonomia', rotulo: 'Ergonomia' },
  { valor: 'ruido_vibracao', rotulo: 'Ruído e vibração' },
  { valor: 'housekeeping', rotulo: 'Organização e limpeza' },
  { valor: 'incendio_emergencia', rotulo: 'Incêndio e emergência' },
  { valor: 'sinalizacao', rotulo: 'Sinalização' },
  { valor: 'residuos_efluentes', rotulo: 'Resíduos e efluentes' },
  { valor: 'documentacao_registro', rotulo: 'Documentação e registro' },
  { valor: 'procedimento_processo', rotulo: 'Procedimento e processo' },
  { valor: 'outros', rotulo: 'Outros' },
]

/*
 * A CAUSA-RAIZ. É esta lista que vira o Pareto do painel — por isso
 * ela é curta e fala de sistema, não de pessoa. "Distração do
 * colaborador" não está aqui de propósito: culpa não é causa, e um
 * Pareto cheio de culpa não gera ação nenhuma.
 *
 * "Condição pessoal" existe para fadiga, jornada e saúde — que são
 * condições que a empresa administra, não falhas de caráter.
 */
export const CAUSAS: Opcao[] = [
  { valor: 'procedimento_inexistente', rotulo: 'Procedimento inexistente' },
  { valor: 'procedimento_nao_seguido', rotulo: 'Procedimento existe e não foi seguido' },
  { valor: 'treinamento_insuficiente', rotulo: 'Treinamento insuficiente ou vencido' },
  { valor: 'planejamento_da_tarefa', rotulo: 'Falha no planejamento da tarefa' },
  { valor: 'epi_inadequado', rotulo: 'EPI inadequado, vencido ou ausente' },
  { valor: 'equipamento_sem_manutencao', rotulo: 'Equipamento sem manutenção' },
  { valor: 'projeto_ou_instalacao', rotulo: 'Falha de projeto ou instalação' },
  { valor: 'comunicacao_falha', rotulo: 'Comunicação falha entre equipes' },
  { valor: 'supervisao_insuficiente', rotulo: 'Supervisão insuficiente' },
  { valor: 'condicao_pessoal', rotulo: 'Condição pessoal (fadiga, jornada, saúde)' },
  { valor: 'outros', rotulo: 'Outros' },
]

export type Espinha =
  | 'metodo'
  | 'mao_de_obra'
  | 'maquina'
  | 'material'
  | 'medicao'
  | 'meio_ambiente'

export const ESPINHAS: { chave: Espinha; rotulo: string }[] = [
  { chave: 'metodo', rotulo: 'Método' },
  { chave: 'mao_de_obra', rotulo: 'Mão de obra' },
  { chave: 'maquina', rotulo: 'Máquina' },
  { chave: 'material', rotulo: 'Material' },
  { chave: 'medicao', rotulo: 'Medição' },
  { chave: 'meio_ambiente', rotulo: 'Meio ambiente' },
]

export type Ishikawa = Partial<Record<Espinha, string[]>>

/*
 * As sugestões de cada espinha.
 *
 * POR QUE SUGESTÃO E NÃO CAMPO VAZIO. Seis caixas em branco na frente
 * de quem acabou de sair do campo produzem seis caixas em branco. A
 * sugestão não decide nada: ela lembra o que costuma estar por trás
 * daquele tipo de desvio, e quem investiga toca no que serve ou
 * escreve o que falta.
 *
 * O BASE vale para qualquer assunto. O resto entra conforme a
 * tipologia escolhida — numa NC de altura não faz sentido oferecer
 * "ventilação do espaço confinado".
 */
const BASE: Record<Espinha, string[]> = {
  metodo: [
    'Procedimento inexistente',
    'Procedimento existe e não foi seguido',
    'Permissão de trabalho incompleta',
    'Tarefa não planejada antes de começar',
  ],
  mao_de_obra: [
    'Treinamento vencido ou ausente',
    'Equipe nova sem integração',
    'Fadiga ou jornada estendida',
    'Supervisão ausente no momento',
  ],
  maquina: [
    'Equipamento sem manutenção em dia',
    'Dispositivo de segurança anulado',
    'Ferramenta imprópria para a tarefa',
  ],
  material: ['EPI inadequado para o risco', 'EPI vencido ou danificado', 'Material fora de especificação'],
  medicao: [
    'Inspeção anterior fora do prazo',
    'Indicador não acompanhado',
    'Checklist não cobre este item',
  ],
  meio_ambiente: ['Iluminação insuficiente', 'Piso irregular ou escorregadio', 'Área sem isolamento'],
}

const POR_TIPOLOGIA: Partial<Record<string, Partial<Record<Espinha, string[]>>>> = {
  trabalho_altura: {
    material: ['Ponto de ancoragem insuficiente', 'Talabarte inadequado para o vão'],
    meio_ambiente: ['Vento ou chuva na hora do serviço', 'Guarda-corpo ausente'],
  },
  eletricidade: {
    metodo: ['Serviço feito energizado sem justificativa'],
    maquina: ['Painel sem identificação de circuito'],
  },
  bloqueio_etiquetagem: {
    material: ['Dispositivo de bloqueio indisponível'],
    metodo: ['Bloqueio feito por um só, sem conferência'],
  },
  espaco_confinado: {
    medicao: ['Atmosfera não medida antes da entrada'],
    meio_ambiente: ['Ventilação insuficiente'],
  },
  trabalho_quente: {
    meio_ambiente: ['Material combustível próximo'],
    material: ['Extintor fora de alcance'],
  },
  maquinas_protecoes: {
    maquina: ['Proteção fixa removida para produzir', 'Intertravamento burlado'],
  },
  movimentacao_carga: {
    maquina: ['Cabo ou cinta com desgaste'],
    metodo: ['Carga içada sem plano de rigging'],
  },
  veiculos_transito: {
    meio_ambiente: ['Rota de pedestre cruza a de veículo'],
    mao_de_obra: ['Condutor sem habilitação para o equipamento'],
  },
  produto_quimico: {
    material: ['FISPQ indisponível no ponto de uso'],
    meio_ambiente: ['Contenção secundária ausente'],
  },
  ergonomia: {
    metodo: ['Pausa não prevista na tarefa repetitiva'],
    meio_ambiente: ['Posto de trabalho sem ajuste'],
  },
  ruido_vibracao: {
    medicao: ['Avaliação quantitativa desatualizada'],
    material: ['Protetor auditivo com atenuação insuficiente'],
  },
  housekeeping: {
    metodo: ['Sem rotina de limpeza definida'],
    meio_ambiente: ['Falta de lugar definido para o material'],
  },
  incendio_emergencia: {
    material: ['Extintor obstruído ou vencido'],
    mao_de_obra: ['Brigada sem reciclagem'],
  },
  epi: {
    material: ['CA vencido', 'Tamanho indisponível para a pessoa'],
    mao_de_obra: ['Entrega feita sem orientação de uso'],
  },
  residuos_efluentes: {
    metodo: ['Segregação não definida'],
    meio_ambiente: ['Baia de resíduo sem cobertura'],
  },
  sinalizacao: {
    material: ['Placa desbotada ou ilegível'],
    metodo: ['Sinalização não prevista no projeto da área'],
  },
  documentacao_registro: {
    medicao: ['Registro preenchido depois, de memória'],
    metodo: ['Documento sem controle de revisão'],
  },
}

/* As sugestões que valem para o assunto escolhido, sem repetição. */
export function sugestoesIshikawa(tipologia: string | null): Record<Espinha, string[]> {
  const extras = (tipologia && POR_TIPOLOGIA[tipologia]) || {}
  const saida = {} as Record<Espinha, string[]>

  for (const { chave } of ESPINHAS) {
    const juntas = [...(extras[chave] || []), ...BASE[chave]]
    saida[chave] = Array.from(new Set(juntas))
  }

  return saida
}

/* Rótulo do assunto; vazio quando ninguém escolheu. */
export const rotuloTipologia = (valor: string | null) =>
  TIPOLOGIAS.find((t) => t.valor === valor)?.rotulo || ''

export const rotuloCausa = (valor: string | null) =>
  CAUSAS.find((c) => c.valor === valor)?.rotulo || ''
