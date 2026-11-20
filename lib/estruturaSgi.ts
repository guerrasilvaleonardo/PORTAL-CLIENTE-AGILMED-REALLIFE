/*
 * A estrutura de pastas que o cliente monta ANTES de responder a
 * primeira pergunta da auditoria.
 *
 * DE ONDE ELA VEM. Não foi inventada: é a estrutura que a Real Life já
 * usa no SGI da Norte Sul, em produção. Estrutura testada em empresa
 * real vale mais do que organograma bonito que ninguém nunca encheu.
 *
 * POR QUE ISSO É O PRIMEIRO PASSO. Auditoria trava quando a empresa
 * sabe que tem o documento mas não sabe onde. O tempo da auditoria
 * vira tempo de procurar arquivo, e o que não é achado em dez minutos
 * vira constatação por falta de evidência — mesmo quando a evidência
 * existe. Organizar antes não é burocracia: é o que faz a auditoria
 * durar um dia em vez de uma semana.
 *
 * CADA PASTA DIZ QUE REQUISITO ELA RESPONDE. É a ponte entre o disco
 * do cliente e o checklist: quando o auditor pedir o 7.5, a empresa
 * sabe que é a 01/01, e não sai procurando em seis lugares.
 */

export type Pasta = {
  nome: string
  oque: string
  /* Requisitos que costumam ser respondidos com o que mora aqui. */
  requisitos?: string[]
  filhas?: Pasta[]
}

export const ESTRUTURA_SGI: Pasta[] = [
  {
    nome: '00 - Governança SGI',
    oque: 'A base do sistema: quem decide, o que a empresa se compromete a fazer e onde isso está escrito.',
    requisitos: ['4.1', '4.2', '4.3', '5.2', '5.3'],
    filhas: [
      { nome: '01 - Política SGI', oque: 'A política assinada pela direção, e as versões anteriores.', requisitos: ['5.2'] },
      { nome: '02 - Objetivos SGI', oque: 'Objetivos do ano, com meta, indicador, responsável e prazo.', requisitos: ['6.2'] },
      {
        nome: '03 - Contexto e partes interessadas',
        oque: 'Análise de contexto, lista de partes interessadas e o que cada uma exige. É aqui que entra a análise sobre mudança climática.',
        requisitos: ['4.1', '4.2'],
      },
      { nome: '04 - Papéis e responsabilidades', oque: 'Quem responde pelo quê, por escrito.', requisitos: ['5.3'] },
      {
        nome: '05 - Reuniões e análises críticas',
        oque: 'Atas da análise crítica pela direção, com entradas, decisões e prazos.',
        requisitos: ['9.3'],
      },
    ],
  },
  {
    nome: '01 - Controle de documentos e registros',
    oque: 'O controle do que é documento: versão vigente, quem aprovou, por quanto tempo guarda.',
    requisitos: ['7.5'],
    filhas: [
      { nome: '01 - Lista mestra', oque: 'A lista de todos os documentos do sistema, com versão e guarda.', requisitos: ['7.5'] },
      { nome: '02 - Procedimentos documentados', oque: 'Os procedimentos vigentes.', requisitos: ['7.5', '8.1'] },
      { nome: '03 - Modelos e formulários', oque: 'Os formulários em branco, prontos para usar.' },
      { nome: '04 - Registros SGI', oque: 'Registros preenchidos que não cabem em outra pasta.' },
    ],
  },
  {
    nome: '02 - Planejamento e riscos',
    oque: 'O que pode dar errado, o que a lei exige, e o plano para tratar os dois.',
    requisitos: ['6.1.1', '6.1.2', '6.1.3', '6.1.4'],
    filhas: [
      {
        nome: '01 - Riscos e oportunidades',
        oque: 'Levantamento de perigos e avaliação de riscos, com o critério usado. E as oportunidades, que quase sempre são esquecidas.',
        requisitos: ['6.1.1', '6.1.2', '6.1.3'],
      },
      {
        nome: '02 - Requisitos legais e outros',
        oque: 'A lista do que se aplica à empresa, e a avaliação periódica de atendimento.',
        requisitos: ['6.1.3', '9.1.2'],
      },
      {
        nome: '03 - Planos de ação',
        oque: 'O plano que transforma risco em ação, com responsável, prazo e verificação da eficácia.',
        requisitos: ['6.1.4'],
      },
    ],
  },
  {
    nome: '03 - Operação por obra',
    oque: 'Uma pasta por obra ou contrato. É onde a evidência de campo mora, e onde o auditor vai pedir amostra.',
    requisitos: ['8.1.1', '8.1.3', '8.1.4'],
    filhas: [
      { nome: '01 - Contrato e plano da obra', oque: 'Contrato, escopo e plano específico daquela obra.' },
      { nome: '02 - Integração e treinamentos', oque: 'Integração de quem entrou, com lista de presença.', requisitos: ['7.2', '7.3'] },
      { nome: '03 - APR, PT e PGR', oque: 'Análise de risco da tarefa, permissões de trabalho e o PGR da obra.', requisitos: ['6.1.2', '8.1.1'] },
      { nome: '04 - EPI e EPC', oque: 'Fichas de entrega, CA e controle de validade.', requisitos: ['7.1', '8.1.2'] },
      { nome: '05 - Inspeções', oque: 'Inspeções feitas em campo e o tratamento do que reprovou.', requisitos: ['9.1.1'] },
      { nome: '06 - Ocorrências', oque: 'Incidentes, quase-acidentes e acidentes daquela obra.', requisitos: ['10.2'] },
      { nome: '07 - Encerramento', oque: 'O que fecha a obra: devoluções, desmobilização, lições.' },
    ],
  },
  {
    nome: '04 - Saúde ocupacional',
    oque: 'Documento de saúde é dado sensível. Esta pasta tem acesso restrito — não é só organização, é obrigação legal.',
    requisitos: ['7.1', '8.2'],
    filhas: [
      { nome: '01 - PCMSO', oque: 'Programa vigente e os anteriores.' },
      { nome: '02 - ASO e exames', oque: 'Atestados de saúde ocupacional, por colaborador. ACESSO RESTRITO.' },
      { nome: '03 - Afastamentos', oque: 'Afastamentos, com início, fim e motivo. ACESSO RESTRITO.' },
      { nome: '04 - Controle de vencimentos', oque: 'Quem vence quando, para não deixar passar.' },
    ],
  },
  {
    nome: '05 - Segurança do trabalho',
    oque: 'Procedimentos, treinamentos e a evidência de que o sistema funciona no dia a dia.',
    requisitos: ['7.2', '7.3', '8.1.1', '8.2'],
    filhas: [
      { nome: '01 - Procedimentos SST', oque: 'Procedimentos de segurança, por risco ou atividade.' },
      { nome: '02 - Treinamentos e DDS', oque: 'Certificados, listas de presença e os DDS.', requisitos: ['7.2', '7.3'] },
      { nome: '03 - Catálogo EPI e EPC', oque: 'O que a empresa usa, com CA e critério de escolha.' },
      { nome: '04 - Emergência', oque: 'Plano de emergência, brigada e registro dos simulados.', requisitos: ['8.2'] },
      { nome: '05 - Acidentes e incidentes', oque: 'Investigação, causa e ação. É o que o auditor cruza com o 10.2.', requisitos: ['10.2'] },
    ],
  },
  {
    nome: '06 - Qualidade e processos',
    oque: 'Só para quem tem ISO 9001: processos, fornecedores e controle de produto ou serviço.',
    requisitos: ['4.4', '8.4.1', '8.5.1', '8.6', '8.7'],
    filhas: [
      { nome: '01 - Mapa de processos', oque: 'Os processos, com entradas, saídas e responsáveis.', requisitos: ['4.4'] },
      { nome: '02 - Fornecedores', oque: 'Avaliação, critério e o que foi comunicado a eles.', requisitos: ['8.4.1', '8.4.2', '8.4.3'] },
      { nome: '03 - Controle de produto e serviço', oque: 'Liberação, rastreabilidade e saídas não conformes.', requisitos: ['8.5.1', '8.6', '8.7'] },
      { nome: '04 - Satisfação do cliente', oque: 'Como a empresa mede e o que fez com o resultado.', requisitos: ['9.1.2'] },
    ],
  },
  {
    nome: '07 - Avaliação de desempenho',
    oque: 'Os números do sistema e as auditorias. É daqui que sai metade da evidência do capítulo 9.',
    requisitos: ['9.1.1', '9.1.3', '9.2', '9.3'],
    filhas: [
      { nome: '01 - Indicadores', oque: 'O que é medido, com que método e o resultado no tempo.', requisitos: ['9.1.1', '9.1.3'] },
      { nome: '02 - Auditorias', oque: 'Programa do ano, planos, relatórios e as constatações.', requisitos: ['9.2'] },
      { nome: '03 - Análise crítica', oque: 'Material levado à direção e o que ela decidiu.', requisitos: ['9.3'] },
      { nome: '04 - Relatórios de desempenho', oque: 'Consolidados que vão para o cliente e para a direção.' },
    ],
  },
  {
    nome: '08 - Melhoria',
    oque: 'O que deu errado, o que foi feito, e o que mudou por vontade própria.',
    requisitos: ['10.1', '10.2'],
    filhas: [
      { nome: '01 - Não conformidades', oque: 'Registro, causa e tratamento.', requisitos: ['10.2'] },
      { nome: '02 - Ações corretivas', oque: 'A ação, o prazo e a verificação da eficácia.', requisitos: ['10.2'] },
      { nome: '03 - Lições aprendidas', oque: 'O que a empresa não quer repetir.' },
      {
        nome: '04 - Melhorias implementadas',
        oque: 'Melhoria que NÃO nasceu de problema. É a evidência que falta em quase toda empresa.',
        requisitos: ['10.1'],
      },
    ],
  },
  {
    nome: '99 - Arquivo e legado',
    oque: 'Onde vai o que saiu de uso. Nunca é repositório de documento vigente — e é isso que evita o auditor achar a versão errada.',
    requisitos: ['7.5'],
    filhas: [
      { nome: '01 - Legado a revisar', oque: 'O que veio de antes e ainda não foi conferido.' },
      { nome: '02 - Obsoletos', oque: 'Versões antigas, marcadas como obsoletas.' },
      { nome: '03 - Duplicados para validação', oque: 'Dois arquivos iguais em lugares diferentes, à espera de decisão.' },
    ],
  },
]

/* Gera o .bat que cria tudo isso na pasta escolhida.
 *
 * .bat e não instruções na tela porque ele é clicado duas vezes e
 * pronto. Pedir para alguém criar 45 pastas à mão é pedir para a
 * estrutura nascer torta — e estrutura torta no começo é retrabalho no
 * meio da auditoria.
 *
 * `chcp 65001` no topo: sem isso o cmd escreve "Avaliação" como
 * "AvaliaÃ§Ã£o" e a pasta nasce com o nome errado. */
export function gerarBatEstrutura(raiz: string) {
  const linhas: string[] = [
    '@echo off',
    'chcp 65001 > nul',
    'setlocal enabledelayedexpansion',
    '',
    'rem Cria a estrutura de pastas do SGI para ISO 45001 e ISO 9001.',
    'rem Gerado pelo portal da Real Life SSMA.',
    'rem Rodar de novo nao apaga nada: pasta que ja existe e mantida.',
    '',
    `set "RAIZ=${raiz.replace(/"/g, '')}"`,
    '',
    'echo.',
    'echo Criando a estrutura em "%RAIZ%"',
    'echo.',
  ]

  /* O cmd trata estes caracteres como comando dentro do echo. */
  const seguro = (s: string) => s.replace(/[\^&<>|%]/g, (c) => '^' + c)

  /* Cada pasta ganha um LEIA-ME dizendo o que guardar nela e que
   * requisito ela responde. Sem isso a estrutura dura três meses: a
   * pessoa que criou sabe para que serve cada pasta, quem chegou
   * depois não — e aí começam as pastas paralelas. */
  const leiaMe = (caminho: string, p: Pasta) => {
    const arq = `%RAIZ%\\${caminho}\\LEIA-ME.txt`
    linhas.push(`> "${arq}" echo ${seguro(p.nome)}`)
    linhas.push(`>> "${arq}" echo.`)
    linhas.push(`>> "${arq}" echo ${seguro(p.oque)}`)
    if (p.requisitos?.length) {
      linhas.push(`>> "${arq}" echo.`)
      linhas.push(
        `>> "${arq}" echo Responde aos requisitos: ${seguro(p.requisitos.join(', '))}`
      )
    }
    linhas.push(`>> "${arq}" echo.`)
    linhas.push(`>> "${arq}" echo Real Life SSMA - portal do cliente`)
  }

  for (const p of ESTRUTURA_SGI) {
    linhas.push(`if not exist "%RAIZ%\\${p.nome}" mkdir "%RAIZ%\\${p.nome}"`)
    leiaMe(p.nome, p)
    for (const f of p.filhas || []) {
      const caminho = `${p.nome}\\${f.nome}`
      linhas.push(`if not exist "%RAIZ%\\${caminho}" mkdir "%RAIZ%\\${caminho}"`)
      leiaMe(caminho, f)
    }
  }

  linhas.push(
    '',
    'echo.',
    'echo Pronto. A estrutura foi criada.',
    'echo Abra o LEIA-ME dentro de cada pasta para saber o que guardar nela.',
    'echo.',
    'pause'
  )

  return linhas.join('\r\n') + '\r\n'
}
