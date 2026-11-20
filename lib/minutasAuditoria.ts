import type { Bloco } from './word'

/*
 * As minutas que o cliente baixa em cada requisito.
 *
 * O TEXTO É NOSSO. Nada aqui transcreve norma — a ABNT vende o texto.
 * O que está escrito é o formulário que a evidência costuma ter, na
 * nossa linguagem, com o número do requisito só como referência.
 *
 * VÊM PREENCHIDAS COM EXEMPLO, a pedido dele em 20/11/2026: quem nunca
 * montou um sistema de gestão não sabe o nível de detalhe esperado, e
 * uma tabela em branco não ensina nada. O exemplo mostra.
 *
 * E O EXEMPLO VEM MARCADO. Linha de exemplo sai em itálico cinza, com
 * fundo, e o documento abre com um aviso. Sem isso, a empresa devolve o
 * modelo com os dados da EMPRESA MODELO dentro — e aí não é descuido
 * nosso, é evidência falsa assinada por ela, que o auditor externo
 * derruba na primeira pergunta.
 *
 * A EMPRESA DO EXEMPLO É FICTÍCIA de propósito, com nome que ninguém
 * confunde com cliente real.
 */

type Contexto = {
  requisito: string | null
  norma: string | null
  pergunta: string
  explicacao: string | null
}

const EMPRESA = 'Metalúrgica Exemplo Ltda'

const cabecalho = (c: Contexto, titulo: string): Bloco[] => [
  { tipo: 'titulo', texto: titulo },
  {
    tipo: 'subtitulo',
    texto: [c.norma, c.requisito && 'Requisito ' + c.requisito].filter(Boolean).join(' · '),
  },
  {
    tipo: 'aviso',
    texto:
      'O que está em itálico cinza é EXEMPLO, para mostrar o nível de detalhe esperado. Apague e escreva o que a sua empresa realmente faz antes de usar este documento.',
  },
  { tipo: 'campo', rotulo: 'Empresa', exemplo: EMPRESA },
  { tipo: 'campo', rotulo: 'Responsável pelo preenchimento', exemplo: 'Ana Ribeiro — Coordenadora de SSMA' },
  { tipo: 'campo', rotulo: 'Data', exemplo: '12/03/2026' },
]

const rodape = (): Bloco[] => [
  { tipo: 'secao', texto: 'Evidências anexadas' },
  { tipo: 'texto', texto: 'Liste os documentos que acompanham este registro.' },
  {
    tipo: 'tabela',
    colunas: ['Documento', 'Data', 'Onde está arquivado'],
    exemplos: [['Ata da reunião nº 04/2026', '12/03/2026', 'Pasta SGI / 2026 / Atas']],
    linhas: 4,
  },
  { tipo: 'secao', texto: 'Aprovação' },
  { tipo: 'campo', rotulo: 'Nome e cargo', exemplo: 'Carlos Menezes — Diretor Industrial' },
  { tipo: 'campo', rotulo: 'Assinatura' },
  { tipo: 'campo', rotulo: 'Data', exemplo: '12/03/2026' },
  {
    tipo: 'nota',
    texto:
      'Modelo fornecido pela Real Life SSMA como estrutura de registro, com exemplos de preenchimento. O conteúdo final é de responsabilidade da empresa e deve descrever o que ela realmente faz.',
  },
]

const ESPECIFICAS: Record<string, { titulo: string; rotulo: string; miolo: () => Bloco[] }> = {
  '4.1': {
    titulo: 'Análise do contexto da organização',
    rotulo: 'modelo de análise de contexto',
    miolo: () => [
      { tipo: 'secao', texto: 'Questões que afetam o sistema' },
      {
        tipo: 'texto',
        texto:
          'Registre o que, de dentro e de fora da empresa, ajuda ou atrapalha o sistema de gestão. Questão sem efeito declarado não é questão: diga o que ela muda.',
      },
      {
        tipo: 'tabela',
        colunas: ['Interna ou externa', 'Questão', 'Como afeta o sistema', 'O que fazemos a respeito'],
        exemplos: [
          [
            'Interna',
            'Rotatividade alta na produção (28% ao ano)',
            'Trabalhador novo entra na linha antes de completar a integração',
            'Integração virou pré-requisito de crachá; líder só libera com o registro assinado',
          ],
          [
            'Interna',
            'Turno da noite sem técnico de segurança presente',
            'Desvio à noite só é visto no dia seguinte',
            'Checklist de ronda do encarregado às 22h e 02h, lançado no portal',
          ],
          [
            'Externa',
            'Cliente exige ISO 45001 em contrato a partir de 2027',
            'Prazo de certificação deixou de ser opcional',
            'Programa de implantação aprovado pela direção em 02/2026',
          ],
          [
            'Externa',
            'Fiscalização regional intensificada em NR-12',
            'Risco de interdição de máquina sem proteção',
            'Inventário de máquinas e plano de adequação com prazo até 12/2026',
          ],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Revisão' },
      { tipo: 'campo', rotulo: 'Data desta revisão', exemplo: '12/03/2026' },
      { tipo: 'campo', rotulo: 'Próxima revisão prevista', exemplo: '03/2027, ou antes se houver mudança relevante' },
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
        exemplos: [
          [
            'Trabalhadores',
            'Ambiente seguro, EPI adequado e treinamento antes da tarefa',
            'Sim — NR-01 e NR-06',
            'Ficha de EPI no portal, integração registrada, CIPA atuante',
          ],
          [
            'Cliente Alfa Montagens',
            'Certificação ISO 45001 até 12/2027 e índice de acidentes informado por trimestre',
            'Não — exigência contratual',
            'Cláusula 7.3 do contrato; indicador enviado junto com a medição',
          ],
          [
            'Sindicato dos Metalúrgicos',
            'Participação na CIPA e acesso às atas',
            'Sim — NR-05',
            'Eleição anual com edital; atas enviadas em até 5 dias',
          ],
          [
            'Órgão ambiental estadual',
            'Licença de operação e destinação de resíduos',
            'Sim — licença LO nº 2.184/2024',
            'MTR por coleta, arquivado na pasta de licenciamento',
          ],
        ],
        linhas: 6,
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
      {
        tipo: 'tabela',
        colunas: ['Unidade / endereço', 'Atividades cobertas'],
        exemplos: [
          [
            'Matriz — Av. das Indústrias, 1.200, Porto Velho/RO',
            'Corte, dobra, solda e pintura de estruturas metálicas; expedição',
          ],
          ['Almoxarifado — Rua 7, 340, Porto Velho/RO', 'Recebimento, armazenagem e separação de insumos'],
        ],
        linhas: 3,
      },
      { tipo: 'secao', texto: 'O que fica de fora, e por quê' },
      {
        tipo: 'texto',
        texto:
          'Exclusão sem justificativa é constatação na certificação. Diga o que não está no escopo e a razão.',
      },
      {
        tipo: 'tabela',
        colunas: ['O que fica de fora', 'Justificativa'],
        exemplos: [
          [
            'Projeto e desenvolvimento de produto',
            'A empresa produz conforme desenho fornecido pelo cliente; não há atividade de projeto',
          ],
          ['Montagem em campo', 'Serviço subcontratado; o contratado tem sistema próprio e é avaliado como provedor externo'],
        ],
        linhas: 3,
      },
      { tipo: 'secao', texto: 'Disponibilidade' },
      {
        tipo: 'campo',
        rotulo: 'Onde o escopo está publicado e acessível',
        exemplo: 'Quadro de gestão à vista na entrada da produção e no portal do cliente',
      },
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
        exemplos: [
          [
            'Nenhuma tarefa começa sem que o risco esteja avaliado e o controle definido',
            'Análise de risco por atividade; ordem de serviço com os controles listados',
          ],
          [
            'Atender a legislação de SSO aplicável à nossa atividade',
            'Lista de requisitos legais e avaliação semestral de atendimento',
          ],
          [
            'Consultar os trabalhadores nas decisões que afetam a segurança deles',
            'Atas da CIPA e registro das reuniões de área',
          ],
          [
            'Melhorar o sistema a partir do que os incidentes mostram',
            'Tratamento de NC com causa e verificação de eficácia; análise crítica anual',
          ],
        ],
        linhas: 3,
      },
      { tipo: 'secao', texto: 'Divulgação' },
      { tipo: 'campo', rotulo: 'Onde está afixada ou publicada', exemplo: 'Portaria, refeitório e quadro de cada setor' },
      {
        tipo: 'campo',
        rotulo: 'Como foi comunicada aos trabalhadores',
        exemplo: 'DDS de 04/02/2026 em todos os turnos, com lista de presença',
      },
      {
        tipo: 'campo',
        rotulo: 'Como é disponibilizada a partes externas',
        exemplo: 'Site da empresa e anexo do contrato com fornecedores',
      },
      { tipo: 'secao', texto: 'Aprovação da direção' },
      { tipo: 'campo', rotulo: 'Nome e cargo', exemplo: 'Carlos Menezes — Diretor Industrial' },
      { tipo: 'campo', rotulo: 'Assinatura' },
      { tipo: 'campo', rotulo: 'Data', exemplo: '03/02/2026' },
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
        exemplos: [
          [
            '11/02/2026',
            'Escolha da luva para a solda',
            '6 soldadores e o técnico de segurança',
            'A luva atual esquenta e eles tiram no meio da tarefa',
            'Teste de dois modelos por 15 dias; escolhido o de raspa com forro aluminizado',
          ],
          [
            '05/03/2026',
            'Revisão da análise de risco da prensa',
            'Operadores do 1º e 2º turno, manutenção',
            'O dispositivo bimanual é burlado quando o molde trava',
            'Parada para ajuste do molde; procedimento de desarme incluído na OS',
          ],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Mecanismos em uso' },
      { tipo: 'campo', rotulo: 'CIPA, comissão ou equivalente', exemplo: 'CIPA gestão 2026/2027, 4 titulares' },
      { tipo: 'campo', rotulo: 'Reuniões e periodicidade', exemplo: 'CIPA mensal; reunião de área quinzenal por turno' },
      {
        tipo: 'campo',
        rotulo: 'Canal para o trabalhador relatar risco',
        exemplo: 'Cartão de desvio na portaria e WhatsApp da segurança, sem identificação obrigatória',
      },
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
          'P',
          'S',
          'Risco',
          'Controle existente',
          'Controle necessário',
        ],
        exemplos: [
          [
            'Prensa 40 t — setor de dobra',
            'Zona de prensagem acessível',
            'Amputação de dedos',
            '3',
            '5',
            '15',
            'Comando bimanual',
            'Cortina de luz e bloqueio por chave; prazo 30/06/2026',
          ],
          [
            'Solda MIG — bancadas 1 a 4',
            'Fumos metálicos',
            'Doença respiratória',
            '4',
            '3',
            '12',
            'Ventilação geral',
            'Exaustão localizada por bancada; prazo 30/09/2026',
          ],
          [
            'Expedição',
            'Movimentação de carga com empilhadeira junto a pedestres',
            'Atropelamento',
            '3',
            '4',
            '12',
            'Sinalização de piso',
            'Separação física das rotas e espelho em esquina cega',
          ],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Critério usado' },
      {
        tipo: 'campo',
        rotulo: 'Escala de probabilidade',
        exemplo: '1 raro · 2 pouco provável · 3 possível · 4 provável · 5 frequente',
      },
      {
        tipo: 'campo',
        rotulo: 'Escala de severidade',
        exemplo: '1 sem afastamento · 2 leve · 3 afastamento · 4 incapacidade permanente · 5 fatal',
      },
      {
        tipo: 'campo',
        rotulo: 'A partir de que nível o risco exige ação',
        exemplo: 'Risco ≥ 10: ação com prazo. Risco ≥ 15: a tarefa não começa antes do controle',
      },
      { tipo: 'secao', texto: 'Quem participou' },
      {
        tipo: 'texto',
        texto:
          'Levantamento feito sem quem executa a tarefa costuma perder o perigo real. Registre os participantes.',
      },
      {
        tipo: 'tabela',
        colunas: ['Nome', 'Função', 'Assinatura'],
        exemplos: [
          ['José Nunes', 'Operador de prensa', ''],
          ['Ana Ribeiro', 'Coordenadora de SSMA', ''],
        ],
        linhas: 4,
      },
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
        exemplos: [
          ['NR-12', 'Proteção de máquinas e dispositivo de parada de emergência', 'Prensas, guilhotina e calandra', 'Manutenção'],
          ['NR-35', 'Autorização e capacitação para trabalho acima de 2 m', 'Manutenção de telhado e ponte rolante', 'SSMA'],
          ['NR-06', 'Fornecimento, treinamento e registro de EPI com CA válido', 'Toda a produção', 'SSMA'],
          [
            'Licença de operação LO 2.184/2024',
            'Destinação de resíduo de pintura por empresa licenciada',
            'Cabine de pintura',
            'Meio ambiente',
          ],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Atualização' },
      {
        tipo: 'campo',
        rotulo: 'Como a empresa acompanha mudanças na legislação',
        exemplo: 'Boletim da assessoria de SSMA e consulta trimestral ao portal do MTE',
      },
      { tipo: 'campo', rotulo: 'Data da última atualização desta lista', exemplo: '28/02/2026' },
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
        exemplos: [
          [
            'Risco: um único fornecedor de chapa',
            'Análise de contexto',
            'Homologar segundo fornecedor',
            'Suprimentos',
            '30/06/2026',
          ],
          [
            'Risco: perder o cliente Alfa sem a certificação',
            'Requisito de parte interessada',
            'Cronograma de implantação com auditoria interna em 09/2026',
            'Direção',
            '31/12/2026',
          ],
          [
            'Oportunidade: reduzir retrabalho de solda',
            'Indicador de não conformidade',
            'Gabarito de montagem e requalificação dos soldadores',
            'Produção',
            '31/08/2026',
          ],
        ],
        linhas: 5,
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
        exemplos: [
          [
            'Reduzir acidentes com afastamento',
            'De 4 para 1 no ano',
            'Nº de acidentes com afastamento',
            'SSMA',
            '31/12/2026',
            'Em andamento — 1 até 03/2026',
          ],
          [
            'Adequar as máquinas à NR-12',
            '100% das 9 máquinas críticas',
            '% de máquinas adequadas',
            'Manutenção',
            '31/12/2026',
            '3 de 9 concluídas',
          ],
          [
            'Treinar todos os soldadores em NR-35',
            '100% dos 12 soldadores',
            '% com treinamento válido',
            'RH',
            '30/06/2026',
            '7 de 12',
          ],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Acompanhamento' },
      { tipo: 'campo', rotulo: 'Com que frequência os objetivos são revistos', exemplo: 'Mensal, na reunião de gestão' },
      { tipo: 'campo', rotulo: 'Onde o resultado é registrado', exemplo: 'Painel de indicadores e ata da reunião' },
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
        exemplos: [
          ['Operador de prensa', 'NR-12 e procedimento da máquina', 'Certificado + avaliação prática', '2 anos'],
          ['Soldador', 'NR-35 e qualificação de solda', 'Certificado NR-35 e registro de qualificação', 'NR-35: 2 anos'],
          ['Operador de empilhadeira', 'NR-11', 'Certificado e ASO com aptidão', '1 ano'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Situação por pessoa' },
      {
        tipo: 'tabela',
        colunas: ['Nome', 'Função', 'Competência', 'Evidência', 'Vence em'],
        exemplos: [
          ['José Nunes', 'Operador de prensa', 'NR-12', 'Certificado 2025-114', '18/09/2027'],
          ['Marcos Lopes', 'Soldador', 'NR-35', 'Certificado 2024-087', '02/05/2026'],
        ],
        linhas: 6,
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
        exemplos: [
          ['Política de SSO', '02', 'Diretor Industrial', '03/02/2026', 'Portal e quadros', 'Permanente'],
          ['PR-SSO-004 Bloqueio e etiquetagem', '01', 'Coord. SSMA', '15/01/2026', 'Portal', '5 anos'],
          ['Análise de risco — prensa 40 t', '03', 'Coord. SSMA', '05/03/2026', 'Pasta SGI', '20 anos'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Regras de controle' },
      {
        tipo: 'campo',
        rotulo: 'Quem aprova um documento novo ou revisado',
        exemplo: 'Coordenação de SSMA; política e procedimentos críticos, a direção',
      },
      {
        tipo: 'campo',
        rotulo: 'Como a versão antiga é retirada de uso',
        exemplo: 'Cópia física recolhida pelo líder e carimbada "obsoleto"; no portal, só a vigente fica visível',
      },
      {
        tipo: 'campo',
        rotulo: 'Como documento de origem externa é controlado',
        exemplo: 'Registrado na lista com a data da versão baixada (NRs, normas de cliente)',
      },
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
        exemplos: [
          [
            'Princípio de incêndio na cabine de pintura',
            'Cortar energia e exaustão, acionar extintor de pó, evacuar o setor, chamar o 193',
            'Brigada do turno',
            'Extintores PQS, alarme, rota sinalizada',
          ],
          [
            'Acidente com amputação na prensa',
            'Não remover a peça; estancar sangramento, acionar SAMU 192, preservar o membro em gelo indireto',
            'Socorrista do turno',
            'Kit de primeiros socorros, gelo, telefone',
          ],
          [
            'Vazamento de óleo hidráulico',
            'Conter com barreira absorvente, isolar a área, recolher como resíduo classe I',
            'Manutenção',
            'Kit de contenção, tambor identificado',
          ],
        ],
        linhas: 4,
      },
      { tipo: 'secao', texto: 'Acionamento' },
      {
        tipo: 'campo',
        rotulo: 'Quem aciona e como',
        exemplo: 'Qualquer trabalhador pela botoeira de alarme; o encarregado confirma e aciona o externo',
      },
      { tipo: 'campo', rotulo: 'Telefones de emergência', exemplo: 'Bombeiros 193 · SAMU 192 · Ambulatório ramal 215' },
      { tipo: 'campo', rotulo: 'Ponto de encontro', exemplo: 'Estacionamento de visitantes, junto ao portão 2' },
      { tipo: 'secao', texto: 'Simulados realizados' },
      {
        tipo: 'tabela',
        colunas: ['Data', 'Cenário', 'Participantes', 'O que falhou', 'O que foi corrigido'],
        exemplos: [
          [
            '22/11/2025',
            'Incêndio na pintura',
            '48 pessoas, 2 turnos',
            'Saída dos fundos estava obstruída por paletes',
            'Demarcação de piso e ronda diária do encarregado',
          ],
        ],
        linhas: 4,
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
        exemplos: [
          ['NR-06 — EPI com CA válido', 'Sim', 'Ficha de EPI de 12 colaboradores conferida por amostragem', '—', '—'],
          [
            'NR-12 — proteção de máquinas',
            'Parcial',
            '3 de 9 máquinas adequadas',
            'Cronograma de adequação das 6 restantes',
            '31/12/2026',
          ],
          ['NR-35 — capacitação válida', 'Não', '5 soldadores com certificado vencido', 'Turma de reciclagem contratada', '30/06/2026'],
        ],
        linhas: 6,
      },
      { tipo: 'campo', rotulo: 'Data desta avaliação', exemplo: '10/03/2026' },
      { tipo: 'campo', rotulo: 'Quem avaliou', exemplo: 'Ana Ribeiro — Coordenadora de SSMA' },
    ],
  },

  '9.2.2': {
    titulo: 'Programa anual de auditoria interna',
    rotulo: 'modelo de programa',
    miolo: () => [
      { tipo: 'secao', texto: 'Definição do programa' },
      { tipo: 'campo', rotulo: 'Ano', exemplo: '2026' },
      {
        tipo: 'campo',
        rotulo: 'Objetivos do programa',
        exemplo:
          'Verificar se o sistema atende à norma e aos nossos procedimentos, e preparar a empresa para a certificação em 2027',
      },
      {
        tipo: 'campo',
        rotulo: 'Critérios (normas e documentos internos)',
        exemplo: 'ABNT NBR ISO 45001, procedimentos do SGI e requisitos legais aplicáveis',
      },
      { tipo: 'campo', rotulo: 'Responsável pelo programa', exemplo: 'Ana Ribeiro — Coordenadora de SSMA' },
      { tipo: 'secao', texto: 'Cronograma' },
      {
        tipo: 'texto',
        texto:
          'A norma pede um programa, não auditorias avulsas: o que será auditado, quando, por quem e com que critério.',
      },
      {
        tipo: 'tabela',
        colunas: ['Área ou processo', 'Mês previsto', 'Auditor', 'Critério', 'Realizada em'],
        exemplos: [
          ['Liderança e planejamento', 'Março', 'Auditor externo contratado', 'Seções 5 e 6', '12/03/2026'],
          ['Produção — solda e dobra', 'Junho', 'Ana Ribeiro', 'Seção 8 e NR-12', ''],
          ['Manutenção', 'Agosto', 'Ana Ribeiro', 'Seção 8 e NR-12', ''],
          ['Sistema completo (pré-certificação)', 'Setembro', 'Auditor externo contratado', 'Seções 4 a 10', ''],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Riscos do próprio programa' },
      {
        tipo: 'texto',
        texto:
          'O que pode fazer o programa não acontecer: agenda, competência do auditor, acesso às áreas, independência.',
      },
      {
        tipo: 'tabela',
        colunas: ['Risco', 'Como será tratado'],
        exemplos: [
          ['Auditoria adiada por pico de produção', 'Datas fechadas com a produção em janeiro e reservadas na agenda'],
          [
            'Único auditor interno, que atua na área auditada',
            'Auditoria da própria área de SSMA feita por auditor externo',
          ],
        ],
        linhas: 3,
      },
      { tipo: 'secao', texto: 'Competência dos auditores' },
      {
        tipo: 'texto',
        texto: 'Auditor não audita o próprio trabalho — a independência precisa estar demonstrada.',
      },
      {
        tipo: 'tabela',
        colunas: ['Auditor', 'Formação', 'Áreas que pode auditar'],
        exemplos: [
          ['Ana Ribeiro', 'Curso de auditor interno 45001, 24 h, 2025', 'Produção, manutenção, expedição'],
          ['Auditor externo contratado', 'Auditor líder 45001', 'Todas, inclusive SSMA'],
        ],
        linhas: 3,
      },
    ],
  },

  '9.2': {
    titulo: 'Programa anual de auditoria interna',
    rotulo: 'modelo de programa',
    miolo: () => ESPECIFICAS['9.2.2'].miolo(),
  },

  '9.3': {
    titulo: 'Ata de análise crítica pela direção',
    rotulo: 'modelo de ata',
    miolo: () => [
      { tipo: 'campo', rotulo: 'Data da reunião', exemplo: '18/03/2026' },
      { tipo: 'campo', rotulo: 'Período analisado', exemplo: 'Março de 2025 a fevereiro de 2026' },
      { tipo: 'secao', texto: 'Participantes' },
      {
        tipo: 'tabela',
        colunas: ['Nome', 'Cargo', 'Assinatura'],
        exemplos: [
          ['Carlos Menezes', 'Diretor Industrial', ''],
          ['Ana Ribeiro', 'Coordenadora de SSMA', ''],
          ['Paulo Serra', 'Gerente de Produção', ''],
        ],
        linhas: 4,
      },
      { tipo: 'secao', texto: 'O que foi analisado' },
      {
        tipo: 'texto',
        texto:
          'O que se audita aqui é a ata. Cada entrada precisa do dado analisado, não da menção ao assunto.',
      },
      {
        tipo: 'tabela',
        colunas: ['Entrada analisada', 'Dado apresentado', 'Conclusão da direção'],
        exemplos: [
          [
            'Desempenho de SSO',
            '4 acidentes, sendo 1 com afastamento de 21 dias; 37 desvios tratados',
            'Resultado abaixo do esperado; concentra-se na dobra',
          ],
          [
            'Atendimento a requisitos legais',
            'Avaliação de 10/03: NR-12 parcial, NR-35 com 5 certificados vencidos',
            'Prioridade para NR-35, que é mais rápida de resolver',
          ],
          [
            'Resultado da auditoria interna',
            '12/03: 3 NC maiores e 5 menores',
            'Plano de ação aprovado com prazo até 30/06',
          ],
          [
            'Consulta aos trabalhadores',
            '2 consultas no período, com encaminhamento registrado',
            'Manter; ampliar para o turno da noite',
          ],
          ['Recursos', 'Pedido de R$ 85 mil para cortina de luz nas prensas', 'Aprovado para o segundo trimestre'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Decisões e ações' },
      { tipo: 'texto', texto: 'Reunião sem decisão registrada não conta como análise crítica.' },
      {
        tipo: 'tabela',
        colunas: ['Decisão', 'Ação definida', 'Responsável', 'Prazo', 'Recursos'],
        exemplos: [
          [
            'Adequar as prensas antes das demais máquinas',
            'Comprar e instalar cortina de luz em 3 prensas',
            'Manutenção',
            '30/06/2026',
            'R$ 85 mil aprovados',
          ],
          [
            'Regularizar a capacitação de NR-35',
            'Contratar turma de reciclagem para 5 soldadores',
            'RH',
            '30/06/2026',
            'R$ 6 mil',
          ],
        ],
        linhas: 5,
      },
    ],
  },

  '10.2': {
    titulo: 'Tratamento de não conformidade e ação corretiva',
    rotulo: 'modelo de tratamento de NC',
    miolo: () => [
      { tipo: 'secao', texto: 'Identificação' },
      { tipo: 'campo', rotulo: 'Número', exemplo: 'NC 2026-014' },
      { tipo: 'campo', rotulo: 'Data da ocorrência', exemplo: '06/03/2026, 14h20' },
      { tipo: 'campo', rotulo: 'Onde ocorreu', exemplo: 'Setor de dobra — prensa 40 t' },
      { tipo: 'campo', rotulo: 'Quem identificou', exemplo: 'Encarregado do 2º turno' },
      { tipo: 'secao', texto: 'O que aconteceu' },
      { tipo: 'texto', texto: 'Descreva o fato, não a opinião: o que foi visto, onde, quando e por quem.' },
      {
        tipo: 'tabela',
        colunas: ['Descrição do fato'],
        exemplos: [
          [
            'O operador acionava a prensa com o comando bimanual travado por fita, mantendo a mão livre para ajustar a peça. Constatado pelo encarregado às 14h20 do dia 06/03/2026.',
          ],
        ],
        linhas: 2,
      },
      { tipo: 'secao', texto: 'Ação imediata' },
      {
        tipo: 'campo',
        rotulo: 'O que foi feito na hora para conter',
        exemplo: 'Máquina parada e bloqueada; fita retirada; produção remanejada para a prensa 2',
      },
      { tipo: 'campo', rotulo: 'Quem fez e quando', exemplo: 'Encarregado do 2º turno, 06/03/2026 às 14h25' },
      { tipo: 'secao', texto: 'Investigação da causa' },
      {
        tipo: 'texto',
        texto:
          'Pergunte por que até a resposta deixar de ser sobre a pessoa e passar a ser sobre o processo. Ação corretiva que termina em "orientar o colaborador" quase sempre parou cedo demais.',
      },
      {
        tipo: 'tabela',
        colunas: ['Por quê?', 'Resposta'],
        exemplos: [
          ['Por que a fita estava no bimanual?', 'Para manter a mão livre e segurar a peça'],
          ['Por que precisava segurar a peça?', 'A peça escorrega no molde quando é curta'],
          ['Por que escorrega?', 'O molde não tem batente para peça abaixo de 20 cm'],
          ['Por que não tem batente?', 'O molde foi feito para a peça antiga, de 35 cm'],
          ['Por que ninguém reviu o molde?', 'Não há análise de risco quando muda o tamanho da peça'],
        ],
        linhas: 2,
      },
      {
        tipo: 'campo',
        rotulo: 'Causa raiz identificada',
        exemplo:
          'Mudança de produto sem revisão do dispositivo e sem análise de risco — falha de gestão de mudança, não do operador',
      },
      { tipo: 'secao', texto: 'Ação corretiva' },
      {
        tipo: 'tabela',
        colunas: ['Ação', 'Responsável', 'Prazo', 'Concluída em'],
        exemplos: [
          ['Fabricar batente para peça curta', 'Manutenção', '20/03/2026', '18/03/2026'],
          ['Incluir análise de risco no procedimento de troca de produto', 'SSMA', '31/03/2026', ''],
          ['Instalar cortina de luz na prensa 40 t', 'Manutenção', '30/06/2026', ''],
        ],
        linhas: 4,
      },
      { tipo: 'secao', texto: 'Verificação da eficácia' },
      { tipo: 'texto', texto: 'Fechar sem verificar se o problema voltou é só arquivar o problema.' },
      {
        tipo: 'campo',
        rotulo: 'Como foi verificada',
        exemplo: 'Três rondas sem aviso nos dois turnos, em 04, 11 e 25/04, e conferência de 12 ordens de troca',
      },
      { tipo: 'campo', rotulo: 'Data da verificação', exemplo: '25/04/2026' },
      {
        tipo: 'campo',
        rotulo: 'Foi eficaz? Se não, o que será feito',
        exemplo: 'Sim — nenhum bimanual burlado e a análise de risco consta nas 12 ordens verificadas',
      },
    ],
  },
}

export function minutaDoRequisito(c: Contexto): { blocos: Bloco[]; rotulo: string } {
  const especifica = c.requisito ? ESPECIFICAS[c.requisito] : undefined

  if (especifica) {
    return {
      rotulo: especifica.rotulo,
      blocos: [...cabecalho(c, especifica.titulo), ...especifica.miolo(), ...rodape()],
    }
  }

  /* Genérica: estrutura de registro para o requisito, com o que
   * pedimos para ver já escrito dentro, e um exemplo de resposta. */
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
      {
        tipo: 'tabela',
        colunas: ['O que é feito', 'Quem faz', 'Frequência', 'Onde fica o registro'],
        exemplos: [
          [
            'Ronda de verificação nas áreas de produção, com checklist',
            'Encarregado do turno',
            'Diária, às 22h e 02h',
            'Portal — módulo de Inspeções',
          ],
          [
            'Revisão do documento com a equipe envolvida',
            'Coordenação de SSMA',
            'Anual, ou quando houver mudança',
            'Pasta SGI / 2026',
          ],
        ],
        linhas: 4,
      },
      ...rodape(),
    ],
  }
}
