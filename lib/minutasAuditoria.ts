import type { Bloco } from './word'

/*
 * As minutas que o cliente baixa em cada requisito.
 *
 * O TEXTO É NOSSO. Nada aqui transcreve norma — a ABNT vende o texto.
 * O que está escrito é o formulário que a evidência costuma ter, na
 * nossa linguagem, com o número do requisito só como referência.
 *
 * POR QUE FORMULÁRIO E NÃO DOCUMENTO PRONTO. Minuta preenchida de
 * antemão é a forma mais rápida de produzir evidência falsa: a empresa
 * assina um papel que não descreve o que ela faz, e o auditor externo
 * percebe na primeira pergunta. O que entregamos é a estrutura certa —
 * o que precisa estar lá e em que ordem — para a empresa preencher com
 * a realidade dela.
 *
 * ONDE NÃO HÁ MINUTA ESPECÍFICA, vale a genérica: cabeçalho, o que se
 * pede para ver, espaço para a descrição, para as evidências anexadas e
 * para quem responde. É menos do que um formulário sob medida e é mais
 * do que uma folha em branco.
 */

type Contexto = {
  requisito: string | null
  norma: string | null
  pergunta: string
  explicacao: string | null
}

const cabecalho = (c: Contexto, titulo: string): Bloco[] => [
  { tipo: 'titulo', texto: titulo },
  {
    tipo: 'subtitulo',
    texto: [c.norma, c.requisito && 'Requisito ' + c.requisito].filter(Boolean).join(' · '),
  },
  { tipo: 'campo', rotulo: 'Empresa' },
  { tipo: 'campo', rotulo: 'Responsável pelo preenchimento' },
  { tipo: 'campo', rotulo: 'Data' },
]

const rodape = (): Bloco[] => [
  { tipo: 'secao', texto: 'Evidências anexadas' },
  { tipo: 'texto', texto: 'Liste os documentos que acompanham este registro.' },
  { tipo: 'tabela', colunas: ['Documento', 'Data', 'Onde está arquivado'], linhas: 4 },
  { tipo: 'secao', texto: 'Aprovação' },
  { tipo: 'campo', rotulo: 'Nome e cargo' },
  { tipo: 'campo', rotulo: 'Assinatura' },
  { tipo: 'campo', rotulo: 'Data' },
  {
    tipo: 'nota',
    texto:
      'Modelo fornecido pela Real Life SSMA como estrutura de registro. O conteúdo preenchido é de responsabilidade da empresa e deve descrever o que ela realmente faz.',
  },
]

/* Minutas específicas, por requisito. A chave vale para as duas normas
 * quando o documento é o mesmo na prática. */
const ESPECIFICAS: Record<string, { titulo: string; rotulo: string; miolo: (c: Contexto) => Bloco[] }> = {
  '4.1': {
    titulo: 'Análise do contexto da organização',
    rotulo: 'modelo de análise de contexto',
    miolo: () => [
      {
        tipo: 'secao',
        texto: 'Questões que afetam o sistema',
      },
      {
        tipo: 'texto',
        texto:
          'Registre o que, de dentro e de fora da empresa, ajuda ou atrapalha o sistema de gestão. Questão sem efeito declarado não é questão: diga o que ela muda.',
      },
      {
        tipo: 'tabela',
        colunas: ['Interna ou externa', 'Questão', 'Como afeta o sistema', 'O que fazemos a respeito'],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Revisão' },
      { tipo: 'campo', rotulo: 'Data desta revisão' },
      { tipo: 'campo', rotulo: 'Próxima revisão prevista' },
    ],
  },

  '4.2': {
    titulo: 'Partes interessadas e seus requisitos',
    rotulo: 'modelo de partes interessadas',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Quem tem interesse no que a empresa faz, o que cada um exige, e se aquilo virou requisito do sistema. Inclua os requisitos legais aplicáveis.',
      },
      {
        tipo: 'tabela',
        colunas: ['Parte interessada', 'O que exige', 'É requisito legal?', 'Como atendemos'],
        linhas: 10,
      },
    ],
  },

  '4.3': {
    titulo: 'Escopo do sistema de gestão',
    rotulo: 'modelo de escopo',
    miolo: () => [
      { tipo: 'secao', texto: 'Escopo' },
      {
        tipo: 'texto',
        texto:
          'Descreva o que o sistema cobre: atividades, produtos ou serviços, e em quais unidades ou endereços.',
      },
      { tipo: 'tabela', colunas: ['Unidade / endereço', 'Atividades cobertas'], linhas: 5 },
      { tipo: 'secao', texto: 'O que fica de fora, e por quê' },
      {
        tipo: 'texto',
        texto:
          'Exclusão sem justificativa é constatação na certificação. Diga o que não está no escopo e a razão.',
      },
      { tipo: 'tabela', colunas: ['O que fica de fora', 'Justificativa'], linhas: 4 },
      { tipo: 'secao', texto: 'Disponibilidade' },
      { tipo: 'campo', rotulo: 'Onde o escopo está publicado e acessível' },
    ],
  },

  '5.2': {
    titulo: 'Política do sistema de gestão',
    rotulo: 'modelo de política',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'A política é curta e é da direção. Escreva compromissos que a empresa possa provar, não frases de efeito — o auditor vai pedir a evidência de cada uma.',
      },
      { tipo: 'secao', texto: 'Compromissos' },
      {
        tipo: 'tabela',
        colunas: ['Compromisso assumido', 'Como se comprova'],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Divulgação' },
      { tipo: 'campo', rotulo: 'Onde está afixada ou publicada' },
      { tipo: 'campo', rotulo: 'Como foi comunicada aos trabalhadores' },
      { tipo: 'campo', rotulo: 'Como é disponibilizada a partes externas' },
      { tipo: 'secao', texto: 'Aprovação da direção' },
      { tipo: 'campo', rotulo: 'Nome e cargo' },
      { tipo: 'campo', rotulo: 'Assinatura' },
      { tipo: 'campo', rotulo: 'Data' },
    ],
  },

  '5.4': {
    titulo: 'Consulta e participação dos trabalhadores',
    rotulo: 'modelo de registro de consulta',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Consulta sem registro não é auditável. Anote o assunto, quem participou, o que foi levantado e o que a empresa fez com aquilo.',
      },
      {
        tipo: 'tabela',
        colunas: ['Data', 'Assunto', 'Quem participou', 'O que foi levantado', 'Encaminhamento'],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Mecanismos em uso' },
      { tipo: 'campo', rotulo: 'CIPA, comissão ou equivalente' },
      { tipo: 'campo', rotulo: 'Reuniões e periodicidade' },
      { tipo: 'campo', rotulo: 'Canal para o trabalhador relatar risco' },
    ],
  },

  '6.1.2': {
    titulo: 'Levantamento de perigos e avaliação de riscos',
    rotulo: 'modelo de levantamento de perigos',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Um perigo por linha, com o critério de avaliação declarado. Avaliação no olho não se sustenta em auditoria: escreva a escala usada.',
      },
      {
        tipo: 'tabela',
        colunas: [
          'Atividade / local',
          'Perigo',
          'Dano possível',
          'Probab.',
          'Sever.',
          'Risco',
          'Controle existente',
          'Controle necessário',
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Critério usado' },
      { tipo: 'campo', rotulo: 'Escala de probabilidade' },
      { tipo: 'campo', rotulo: 'Escala de severidade' },
      { tipo: 'campo', rotulo: 'A partir de que nível o risco exige ação' },
      { tipo: 'secao', texto: 'Quem participou' },
      {
        tipo: 'texto',
        texto:
          'Levantamento feito sem quem executa a tarefa costuma perder o perigo real. Registre os participantes.',
      },
      { tipo: 'tabela', colunas: ['Nome', 'Função', 'Assinatura'], linhas: 5 },
    ],
  },

  '6.1.3': {
    titulo: 'Requisitos legais aplicáveis',
    rotulo: 'modelo de requisitos legais',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Liste o que se aplica à empresa de fato, com o que cada requisito obriga e quem responde por ele. Lista genérica de NRs não é evidência.',
      },
      {
        tipo: 'tabela',
        colunas: ['Requisito (norma, lei, portaria)', 'O que obriga', 'Onde se aplica', 'Responsável'],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Atualização' },
      { tipo: 'campo', rotulo: 'Como a empresa acompanha mudanças na legislação' },
      { tipo: 'campo', rotulo: 'Data da última atualização desta lista' },
    ],
  },

  '6.1': {
    titulo: 'Riscos e oportunidades do sistema',
    rotulo: 'modelo de riscos e oportunidades',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Risco levantado e sem ação definida é só uma lista. Para cada um, diga o que a empresa vai fazer, quem faz e até quando.',
      },
      {
        tipo: 'tabela',
        colunas: ['Risco ou oportunidade', 'Origem', 'Ação definida', 'Responsável', 'Prazo'],
        linhas: 8,
      },
    ],
  },

  '6.2': {
    titulo: 'Objetivos e planos de ação',
    rotulo: 'modelo de objetivos',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Objetivo sem forma de medir não se audita. Cada linha precisa de meta, indicador, responsável e prazo.',
      },
      {
        tipo: 'tabela',
        colunas: ['Objetivo', 'Meta', 'Indicador', 'Responsável', 'Prazo', 'Situação'],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Acompanhamento' },
      { tipo: 'campo', rotulo: 'Com que frequência os objetivos são revistos' },
      { tipo: 'campo', rotulo: 'Onde o resultado é registrado' },
    ],
  },

  '7.2': {
    titulo: 'Matriz de competência',
    rotulo: 'modelo de matriz de competência',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Primeiro o que a função exige; depois a prova de que a pessoa atende. Treinamento sem registro de conclusão não comprova competência.',
      },
      {
        tipo: 'tabela',
        colunas: ['Função', 'Competência exigida', 'Como se comprova', 'Validade'],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Situação por pessoa' },
      {
        tipo: 'tabela',
        colunas: ['Nome', 'Função', 'Competência', 'Evidência', 'Vence em'],
        linhas: 10,
      },
    ],
  },

  '7.5': {
    titulo: 'Lista mestra de informação documentada',
    rotulo: 'modelo de lista mestra',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'O que o auditor verifica aqui é controle: se a versão que está em uso é a vigente, quem aprovou e por quanto tempo se guarda.',
      },
      {
        tipo: 'tabela',
        colunas: ['Documento', 'Versão', 'Aprovado por', 'Data', 'Onde fica', 'Guarda'],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Regras de controle' },
      { tipo: 'campo', rotulo: 'Quem aprova um documento novo ou revisado' },
      { tipo: 'campo', rotulo: 'Como a versão antiga é retirada de uso' },
      { tipo: 'campo', rotulo: 'Como documento de origem externa é controlado' },
    ],
  },

  '8.2': {
    titulo: 'Plano de resposta a emergências',
    rotulo: 'modelo de plano de emergência',
    miolo: () => [
      { tipo: 'secao', texto: 'Cenários previstos' },
      {
        tipo: 'texto',
        texto:
          'Um cenário por linha, com o que fazer e quem faz. Plano que não foi testado é papel: registre os simulados no fim.',
      },
      {
        tipo: 'tabela',
        colunas: ['Cenário', 'O que fazer', 'Quem responde', 'Recursos necessários'],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Acionamento' },
      { tipo: 'campo', rotulo: 'Quem aciona e como' },
      { tipo: 'campo', rotulo: 'Telefones de emergência' },
      { tipo: 'campo', rotulo: 'Ponto de encontro' },
      { tipo: 'secao', texto: 'Simulados realizados' },
      {
        tipo: 'tabela',
        colunas: ['Data', 'Cenário', 'Participantes', 'O que falhou', 'O que foi corrigido'],
        linhas: 5,
      },
    ],
  },

  '9.1.2': {
    titulo: 'Avaliação do atendimento a requisitos legais',
    rotulo: 'modelo de avaliação legal',
    miolo: () => [
      {
        tipo: 'texto',
        texto:
          'Não basta ter a lista de requisitos: a norma pede a avaliação periódica de que eles estão sendo atendidos, com registro.',
      },
      {
        tipo: 'tabela',
        colunas: ['Requisito', 'Atende?', 'Evidência verificada', 'Se não atende, o que será feito', 'Prazo'],
        linhas: 10,
      },
      { tipo: 'campo', rotulo: 'Data desta avaliação' },
      { tipo: 'campo', rotulo: 'Quem avaliou' },
    ],
  },

  '9.2.2': {
    titulo: 'Programa anual de auditoria interna',
    rotulo: 'modelo de programa',
    miolo: () => [
      { tipo: 'secao', texto: 'Definição do programa' },
      { tipo: 'campo', rotulo: 'Ano' },
      { tipo: 'campo', rotulo: 'Objetivos do programa' },
      { tipo: 'campo', rotulo: 'Critérios (normas e documentos internos)' },
      { tipo: 'campo', rotulo: 'Responsável pelo programa' },
      { tipo: 'secao', texto: 'Cronograma' },
      {
        tipo: 'texto',
        texto:
          'A norma pede um programa, não auditorias avulsas: o que será auditado, quando, por quem e com que critério.',
      },
      {
        tipo: 'tabela',
        colunas: ['Área ou processo', 'Mês previsto', 'Auditor', 'Critério', 'Realizada em'],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Riscos do próprio programa' },
      {
        tipo: 'texto',
        texto:
          'O que pode fazer o programa não acontecer: agenda, competência do auditor, acesso às áreas, independência.',
      },
      { tipo: 'tabela', colunas: ['Risco', 'Como será tratado'], linhas: 4 },
      { tipo: 'secao', texto: 'Competência dos auditores' },
      {
        tipo: 'texto',
        texto: 'Auditor não audita o próprio trabalho — a independência precisa estar demonstrada.',
      },
      { tipo: 'tabela', colunas: ['Auditor', 'Formação', 'Áreas que pode auditar'], linhas: 5 },
    ],
  },

  '9.2': {
    titulo: 'Programa anual de auditoria interna',
    rotulo: 'modelo de programa',
    miolo: () => ESPECIFICAS['9.2.2'].miolo({} as Contexto),
  },

  '9.3': {
    titulo: 'Ata de análise crítica pela direção',
    rotulo: 'modelo de ata',
    miolo: () => [
      { tipo: 'campo', rotulo: 'Data da reunião' },
      { tipo: 'campo', rotulo: 'Período analisado' },
      { tipo: 'secao', texto: 'Participantes' },
      { tipo: 'tabela', colunas: ['Nome', 'Cargo', 'Assinatura'], linhas: 6 },
      { tipo: 'secao', texto: 'O que foi analisado' },
      {
        tipo: 'texto',
        texto:
          'O que se audita aqui é a ata. Cada entrada precisa do dado analisado, não da menção ao assunto.',
      },
      {
        tipo: 'tabela',
        colunas: ['Entrada analisada', 'Dado apresentado', 'Conclusão da direção'],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Decisões e ações' },
      {
        tipo: 'texto',
        texto: 'Reunião sem decisão registrada não conta como análise crítica.',
      },
      {
        tipo: 'tabela',
        colunas: ['Decisão', 'Ação definida', 'Responsável', 'Prazo', 'Recursos'],
        linhas: 8,
      },
    ],
  },

  '10.2': {
    titulo: 'Tratamento de não conformidade e ação corretiva',
    rotulo: 'modelo de tratamento de NC',
    miolo: () => [
      { tipo: 'secao', texto: 'Identificação' },
      { tipo: 'campo', rotulo: 'Número' },
      { tipo: 'campo', rotulo: 'Data da ocorrência' },
      { tipo: 'campo', rotulo: 'Onde ocorreu' },
      { tipo: 'campo', rotulo: 'Quem identificou' },
      { tipo: 'secao', texto: 'O que aconteceu' },
      {
        tipo: 'texto',
        texto: 'Descreva o fato, não a opinião: o que foi visto, onde, quando e por quem.',
      },
      { tipo: 'tabela', colunas: ['Descrição do fato'], linhas: 3 },
      { tipo: 'secao', texto: 'Ação imediata' },
      { tipo: 'campo', rotulo: 'O que foi feito na hora para conter' },
      { tipo: 'campo', rotulo: 'Quem fez e quando' },
      { tipo: 'secao', texto: 'Investigação da causa' },
      {
        tipo: 'texto',
        texto:
          'Pergunte por que até a resposta deixar de ser sobre a pessoa e passar a ser sobre o processo. Ação corretiva que termina em "orientar o colaborador" quase sempre parou cedo demais.',
      },
      { tipo: 'tabela', colunas: ['Por quê?', 'Resposta'], linhas: 5 },
      { tipo: 'campo', rotulo: 'Causa raiz identificada' },
      { tipo: 'secao', texto: 'Ação corretiva' },
      { tipo: 'tabela', colunas: ['Ação', 'Responsável', 'Prazo', 'Concluída em'], linhas: 5 },
      { tipo: 'secao', texto: 'Verificação da eficácia' },
      {
        tipo: 'texto',
        texto: 'Fechar sem verificar se o problema voltou é só arquivar o problema.',
      },
      { tipo: 'campo', rotulo: 'Como foi verificada' },
      { tipo: 'campo', rotulo: 'Data da verificação' },
      { tipo: 'campo', rotulo: 'Foi eficaz? Se não, o que será feito' },
    ],
  },
}

export function minutaDoRequisito(c: Contexto): { blocos: Bloco[]; rotulo: string } {
  const especifica = c.requisito ? ESPECIFICAS[c.requisito] : undefined

  if (especifica) {
    return {
      rotulo: especifica.rotulo,
      blocos: [...cabecalho(c, especifica.titulo), ...especifica.miolo(c), ...rodape()],
    }
  }

  /* Genérica: estrutura de registro para o requisito, com o que
   * pedimos para ver já escrito dentro. */
  return {
    rotulo: 'modelo de registro',
    blocos: [
      ...cabecalho(c, 'Registro do requisito ' + (c.requisito || '')),
      { tipo: 'secao', texto: 'O que este requisito cobra' },
      { tipo: 'texto', texto: c.pergunta },
      ...(c.explicacao ? ([{ tipo: 'nota', texto: c.explicacao }] as Bloco[]) : []),
      { tipo: 'secao', texto: 'Como a empresa atende' },
      {
        tipo: 'texto',
        texto:
          'Descreva o que é feito na prática, quem faz e com que frequência. Depois indique onde isso está registrado.',
      },
      { tipo: 'tabela', colunas: ['O que é feito', 'Quem faz', 'Frequência', 'Onde fica o registro'], linhas: 6 },
      ...rodape(),
    ],
  }
}
