import { type ModeloDoc, aprovacao, cabeca } from './modelosImplantacaoBase'

/*
 * Os modelos da trilha da ISO 45001:2024.
 *
 * Os porquês gerais — por que vem preenchido com exemplo, por que o
 * exemplo vem marcado, por que todo modelo carrega cabeçalho
 * controlado — estão em ./modelosImplantacaoBase.ts, que as duas
 * normas dividem.
 *
 * O QUE MUDA EM RELAÇÃO AOS MODELOS DA QUALIDADE. Não é o nome do
 * arquivo: é o conteúdo. O exemplo aqui é uma empresa com risco
 * físico de verdade, porque formulário preenchido com exemplo de
 * escritório não ensina quem tem solda, altura e empilhadeira. E
 * vários documentos pedem a ligação explícita com o inventário de
 * riscos, que é o que amarra o sistema inteiro.
 *
 * O EXEMPLO É UMA EMPRESA SÓ, do começo ao fim: a mesma metalúrgica
 * dos modelos da 9001. Trocar de empresa fictícia a cada documento
 * faria o cliente perder o fio entre um formulário e outro.
 */

const EMPRESA = 'Metalúrgica Exemplo Ltda'

/* Código dos documentos desta trilha. SSO-xx, para não colidir com os
 * IMP-xx da qualidade quando a empresa implantar as duas. */
const sso = (titulo: string, codigo: string) =>
  cabeca(titulo, 'Implantação do SGSSO — ISO 45001:2024', codigo)

export const MODELOS_45001: ModeloDoc[] = [
  // ===================== Etapa 1 =====================
  {
    arquivo: 'sso-equipe.docx',
    rotulo: 'a lista da equipe do SGSSO',
    norma: '45001',
    etapa: 1,
    atividade: 2,
    blocos: [
      ...sso('Equipe do sistema de gestão de SSO', 'SSO-01'),
      {
        tipo: 'texto',
        texto:
          'Uma pessoa por área, mais quem a empresa já tem em segurança. O SESMT e a CIPA ' +
          'não conduzem o projeto, mas nada que envolva risco pode ser decidido sem eles.',
      },
      {
        tipo: 'tabela',
        colunas: ['Área', 'Nome', 'Cargo', 'E-mail', 'Papel em SSO'],
        exemplos: [
          ['Produção', 'Pedro Alves', 'Supervisor', 'pedro@exemplo.com.br', 'Representante da área'],
          ['Segurança', 'Juliana Reis', 'Téc. Segurança do Trabalho', 'juliana@exemplo.com.br', 'SESMT'],
          ['Montagem', 'Elias Pinto', 'Soldador', 'elias@exemplo.com.br', 'Membro da CIPA — mandato 2026'],
        ],
        linhas: 10,
      },
      {
        tipo: 'nota',
        texto:
          'Se a empresa tem CIPA, liste todos os membros. É com eles que a consulta aos ' +
          'trabalhadores (requisito 5.4) vai acontecer.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-plano-de-investimento.docx',
    rotulo: 'o plano de investimento',
    norma: '45001',
    etapa: 1,
    atividade: 4,
    blocos: [
      ...sso('Plano de investimento e cronograma', 'SSO-02'),
      {
        tipo: 'texto',
        texto:
          'Certificar em SSO custa em quatro frentes. A quarta — adequação física — é a que ' +
          'tem preço de obra e a que você ainda não sabe estimar, porque o inventário de ' +
          'riscos só vem na etapa 5.',
      },
      {
        tipo: 'tabela',
        colunas: ['Frente', 'O que entra', 'Valor estimado', 'Quando', 'É provisório?'],
        exemplos: [
          ['Consultoria', 'Acompanhamento da implantação', 'R$ 00.000', 'Mensal, 10 meses', 'Não'],
          ['Organismo certificador', 'Fase 1, fase 2 e manutenções', 'R$ 00.000', 'Ciclo de 3 anos', 'Não'],
          ['Documentos e treinamento', 'NR-35, NR-33, brigada, integração', 'R$ 00.000', 'Etapas 9 e 11', 'Não'],
          [
            'Adequação física',
            'Guarda-corpo, proteção de máquina, exaustão, sinalização',
            'R$ 00.000',
            'A definir',
            'SIM — revisar após a etapa 5',
          ],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Data-alvo' },
      {
        tipo: 'campo',
        rotulo: 'Auditoria de certificação prevista para',
        exemplo: 'setembro de 2027',
      },
      {
        tipo: 'campo',
        rotulo: 'Auditoria interna prevista para',
        exemplo: 'julho de 2027 — pelo menos dois meses antes',
      },
      {
        tipo: 'nota',
        texto:
          'Declare a adequação física como provisória e avise a direção agora. Número ' +
          'provisório declarado é melhor do que susto no meio do projeto.',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 2 =====================
  {
    arquivo: 'sso-procedimento-informacao-documentada.docx',
    rotulo: 'o Procedimento de Controle da Informação Documentada',
    norma: '45001',
    etapa: 2,
    atividade: 2,
    blocos: [
      ...sso('Procedimento de controle da informação documentada', 'SSO-03'),
      {
        tipo: 'texto',
        texto:
          'A regra que governa todas as outras: como um documento do SGSSO nasce, quem ' +
          'aprova, como se identifica a versão, onde fica e por quanto tempo.',
      },
      { tipo: 'secao', texto: '1. Para que serve' },
      {
        tipo: 'campo',
        rotulo: 'Objetivo',
        exemplo:
          'Definir como os documentos e registros do sistema de gestão de SSO são criados, ' +
          'aprovados, identificados, distribuídos, guardados e descartados.',
      },
      { tipo: 'secao', texto: '2. Como um documento nasce e é aprovado' },
      {
        tipo: 'tabela',
        colunas: ['Tipo de documento', 'Quem elabora', 'Quem aprova', 'Onde fica'],
        exemplos: [
          ['Política de SSO', 'Coordenação de SSO', 'Direção', 'Portal e quadro de avisos'],
          ['Procedimento', 'Área dona do assunto', 'Coordenação de SSO', 'Pasta do SGSSO'],
          ['Instrução de trabalho', 'Supervisor da área', 'Coordenação de SSO', 'No próprio posto'],
          ['Inventário de riscos', 'Coordenação de SSO com a área', 'Direção', 'Pasta do SGSSO'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: '3. Identificação e versão' },
      {
        tipo: 'campo',
        rotulo: 'Como o código é formado',
        exemplo: 'SSO-00 — sequencial por ordem de criação, registrado na lista mestra',
      },
      {
        tipo: 'campo',
        rotulo: 'Como a revisão é numerada',
        exemplo: 'Dois dígitos a partir de 00; qualquer mudança de conteúdo sobe um número',
      },
      {
        tipo: 'secao',
        texto: '4. Documento médico individual — acesso restrito',
      },
      {
        tipo: 'texto',
        texto:
          'ASO, atestado, resultado de exame e laudo individual não ficam na pasta geral do ' +
          'SGSSO. Esta é a regra que o auditor vai pedir para ver, e "ninguém mexe" não é ' +
          'resposta: precisa estar escrito quem pode abrir.',
      },
      {
        tipo: 'campo',
        rotulo: 'Onde esses documentos ficam',
        exemplo: 'Pasta restrita do RH, com acesso por senha',
      },
      {
        tipo: 'campo',
        rotulo: 'Quem pode acessar',
        exemplo: 'Médico do trabalho, coordenação de RH e o próprio trabalhador',
      },
      { tipo: 'secao', texto: '5. Por quanto tempo cada registro é guardado' },
      {
        tipo: 'tabela',
        colunas: ['Registro', 'Prazo de guarda', 'Por quê'],
        exemplos: [
          ['Registro de treinamento de NR', 'Enquanto durar o vínculo + 20 anos', 'Prazo legal'],
          ['Investigação de acidente', '20 anos', 'Prazo legal'],
          ['Ficha de EPI', 'Enquanto durar o vínculo + 20 anos', 'Prazo legal'],
          ['Ata de reunião da CIPA', '5 anos', 'Definido pela empresa'],
        ],
        linhas: 6,
      },
      {
        tipo: 'nota',
        texto:
          'Confira os prazos legais com o jurídico antes de aprovar. Vários registros de SSO ' +
          'têm guarda longa, e descartar antes é problema sério.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-lista-mestra.docx',
    rotulo: 'a lista mestra',
    norma: '45001',
    etapa: 2,
    atividade: 3,
    blocos: [
      ...sso('Lista mestra de documentos e registros', 'SSO-04'),
      {
        tipo: 'texto',
        texto:
          'O índice do sistema. Acrescente uma linha a cada entrega da trilha — quem deixa ' +
          'para preencher no fim gasta dois dias e erra metade.',
      },
      {
        tipo: 'tabela',
        colunas: ['Código', 'Documento', 'Revisão', 'Aprovado em', 'Onde fica', 'Guarda'],
        exemplos: [
          ['SSO-03', 'Procedimento de informação documentada', '00', '12/03/2027', 'Pasta do SGSSO', 'Permanente'],
          ['SSO-09', 'Política de SSO', '00', '20/03/2027', 'Portal e quadro', 'Permanente'],
          ['SSO-14', 'Inventário de riscos', '01', '02/05/2027', 'Pasta do SGSSO', 'Permanente'],
        ],
        linhas: 14,
      },
      {
        tipo: 'campo',
        rotulo: 'Quem mantém esta lista atualizada',
        exemplo: 'Juliana Reis — Técnica de Segurança do Trabalho',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 3 =====================
  {
    arquivo: 'sso-analise-de-contexto.docx',
    rotulo: 'a análise de contexto',
    norma: '45001',
    etapa: 3,
    atividade: 1,
    blocos: [
      ...sso('Análise do contexto da organização', 'SSO-05'),
      {
        tipo: 'texto',
        texto:
          'O que, de fora e de dentro, afeta a segurança e a saúde de quem trabalha aqui. ' +
          'Contexto escrito pela segurança sozinha não vale: leve à direção para validar.',
      },
      { tipo: 'secao', texto: 'Questões externas' },
      {
        tipo: 'tabela',
        colunas: ['Questão', 'Como afeta a segurança e a saúde', 'Risco ou oportunidade'],
        exemplos: [
          [
            'Fiscalização do trabalho ativa na região',
            'Autuação e interdição param a produção',
            'Risco',
          ],
          [
            'Cliente grande exige certificação em contrato',
            'Sem certificado, perde o contrato em 2028',
            'Risco e oportunidade',
          ],
          [
            'Mão de obra escassa de soldador',
            'Contratação de gente sem experiência aumenta o risco de acidente',
            'Risco',
          ],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Questões internas' },
      {
        tipo: 'tabela',
        colunas: ['Questão', 'Como afeta a segurança e a saúde', 'Risco ou oportunidade'],
        exemplos: [
          ['Parque de máquinas com 20 anos', 'Proteções originais ausentes ou improvisadas', 'Risco'],
          ['Turno da noite sem supervisão de segurança', 'Desvio de madrugada não é corrigido', 'Risco'],
          ['Rotatividade alta na montagem', 'Gente nova em tarefa de risco antes de dominar', 'Risco'],
          ['Cultura de "sempre foi assim"', 'Resistência a usar proteção nova', 'Risco'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Mudança climática' },
      {
        tipo: 'texto',
        texto:
          'A Emenda 1:2025 acrescentou a mudança climática ao requisito 4.1: a empresa ' +
          'precisa determinar se ela é questão relevante. Em SSO isso não é formalidade — ' +
          'calor extremo, chuva fora de época e queimada mudam o risco de quem trabalha ' +
          'exposto.',
      },
      {
        tipo: 'campo',
        rotulo: 'É questão relevante para esta empresa?',
        exemplo: 'Sim',
      },
      {
        tipo: 'campo',
        rotulo: 'Por quê, e o que entra como risco',
        exemplo:
          'Pátio de montagem a céu aberto; onda de calor eleva o risco de exaustão térmica ' +
          'na equipe de solda entre setembro e novembro. Entra no inventário como risco ' +
          'de exposição ao calor.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-partes-interessadas.docx',
    rotulo: 'o levantamento de partes interessadas',
    norma: '45001',
    etapa: 3,
    atividade: 2,
    blocos: [
      ...sso('Partes interessadas e suas necessidades', 'SSO-06'),
      {
        tipo: 'texto',
        texto:
          'Parte interessada em SSO é quem pode ser afetado pelo que a empresa faz. O ' +
          'trabalhador vem primeiro — a norma dá a ele posição de destaque.',
      },
      {
        tipo: 'tabela',
        colunas: ['Parte interessada', 'O que precisa e espera', 'Vira requisito nosso?'],
        exemplos: [
          [
            'Trabalhadores',
            'Trabalhar sem se machucar e sem adoecer; ser ouvido; poder parar tarefa insegura',
            'Sim',
          ],
          [
            'CIPA e representantes',
            'Participar das decisões de segurança e receber retorno do que apontam',
            'Sim',
          ],
          ['Sindicato da categoria', 'Cumprimento do acordo coletivo', 'Sim'],
          ['Fiscalização do trabalho', 'Cumprimento das NRs aplicáveis', 'Sim'],
          ['Cliente', 'Certificação ISO 45001 até 2028, conforme contrato', 'Sim'],
          ['Contratadas e terceirizados', 'Condições seguras dentro das nossas instalações', 'Sim'],
          ['Vizinhança', 'Não ser atingida por emergência nossa', 'Sim'],
          ['Famílias dos trabalhadores', 'Que a pessoa volte inteira para casa', 'Não — mas orienta a política'],
        ],
        linhas: 10,
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-escopo.docx',
    rotulo: 'o escopo do SGSSO',
    norma: '45001',
    etapa: 3,
    atividade: 3,
    blocos: [
      ...sso('Escopo do sistema de gestão de SSO', 'SSO-07'),
      {
        tipo: 'texto',
        texto:
          'Onde o sistema vale. Escopo mal escrito é a primeira coisa que o auditor ataca, ' +
          'porque tudo depois dele fica torto.',
      },
      {
        tipo: 'campo',
        rotulo: 'O SGSSO cobre',
        exemplo:
          'Fabricação e montagem de estruturas metálicas na unidade da Rodovia BR-000, km 00, ' +
          'Porto Velho/RO, incluindo o pátio de montagem e o escritório administrativo.',
      },
      { tipo: 'secao', texto: 'Unidades e atividades cobertas' },
      {
        tipo: 'tabela',
        colunas: ['Unidade ou área', 'Atividades', 'Nº de pessoas'],
        exemplos: [
          ['Fábrica — corte e solda', 'Corte, dobra, solda, pintura', '38'],
          ['Pátio de montagem', 'Montagem e carregamento', '12'],
          ['Administrativo', 'Comercial, compras, RH', '9'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Quem está coberto' },
      {
        tipo: 'texto',
        texto:
          'Em SSO não se exclui trabalhador do escopo. Terceirizado que trabalha dentro da ' +
          'sua área está dentro, e isso precisa estar declarado.',
      },
      {
        tipo: 'campo',
        rotulo: 'Declaração',
        exemplo:
          'O SGSSO cobre todos os empregados próprios, os trabalhadores de empresas ' +
          'contratadas que atuem nas instalações, os estagiários e os visitantes.',
      },
      {
        tipo: 'nota',
        texto:
          'Evite exclusões. Se achar que precisa de uma, converse com o consultor antes de ' +
          'escrever — exclusão em SSO raramente passa.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-politica.docx',
    rotulo: 'a política de SSO',
    norma: '45001',
    etapa: 3,
    atividade: 5,
    blocos: [
      ...sso('Política de SSO', 'SSO-08'),
      {
        tipo: 'texto',
        texto:
          'O compromisso público da direção. A norma pede compromissos específicos, e falta ' +
          'de um deles é não conformidade na leitura do documento, antes mesmo de o auditor ' +
          'sair da sala.',
      },
      { tipo: 'secao', texto: 'Os compromissos que a norma exige' },
      {
        tipo: 'tabela',
        colunas: ['Compromisso', 'Está no texto abaixo?'],
        exemplos: [
          ['Condições de trabalho seguras e saudáveis, prevenindo lesão e doença', 'Sim'],
          ['Eliminar perigos e reduzir riscos de SSO', 'Sim'],
          ['Melhorar continuamente o sistema de gestão', 'Sim'],
          ['Cumprir os requisitos legais e os outros requisitos assumidos', 'Sim'],
          ['Consulta e participação dos trabalhadores e seus representantes', 'Sim'],
        ],
        linhas: 5,
      },
      {
        tipo: 'nota',
        texto:
          'Use esta tabela como conferência antes de assinar. Os cinco precisam estar no ' +
          'texto, com estas palavras ou equivalentes claros.',
      },
      { tipo: 'secao', texto: 'Política' },
      {
        tipo: 'campo',
        rotulo: 'Texto',
        exemplo:
          'A Metalúrgica Exemplo fabrica e monta estruturas metálicas, e assume que nenhuma ' +
          'entrega justifica alguém se machucar. Para isso nos comprometemos a: oferecer ' +
          'condições de trabalho seguras e saudáveis e prevenir lesões e doenças; eliminar ' +
          'os perigos e reduzir os riscos de SSO, nesta ordem; cumprir a legislação e os ' +
          'compromissos que assumimos com clientes e com o sindicato; consultar os ' +
          'trabalhadores e seus representantes nas decisões que afetam a segurança deles, e ' +
          'devolver resposta ao que apontarem; e melhorar continuamente o nosso sistema de ' +
          'gestão. Qualquer pessoa aqui pode interromper uma tarefa que considere insegura, ' +
          'e não será prejudicada por isso.',
      },
      {
        tipo: 'nota',
        texto:
          'Escreva em linguagem que o operador entenda. Política que só o escritório lê não ' +
          'muda comportamento nenhum — e o auditor vai perguntar ao operador, não a você.',
      },
      { tipo: 'secao', texto: 'Divulgação' },
      {
        tipo: 'tabela',
        colunas: ['Onde foi divulgada', 'Quando', 'Evidência'],
        exemplos: [
          ['Quadro de avisos da fábrica e do pátio', '22/03/2027', 'Foto do quadro'],
          ['Integração de novos e de terceiros', 'A partir de 22/03/2027', 'Lista de presença'],
          ['Portal do cliente', '22/03/2027', 'Documento publicado'],
        ],
        linhas: 4,
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-matriz-de-responsabilidades.docx',
    rotulo: 'a matriz de responsabilidades',
    norma: '45001',
    etapa: 3,
    atividade: 6,
    blocos: [
      ...sso('Papéis, responsabilidades e autoridades', 'SSO-09'),
      {
        tipo: 'texto',
        texto: 'Quem responde por quê, com nome e cargo — não só com o nome do setor.',
      },
      {
        tipo: 'tabela',
        colunas: ['Papel', 'Nome e cargo', 'Responsabilidade', 'Autoridade'],
        exemplos: [
          [
            'Direção',
            'Carlos Menezes — Diretor Industrial',
            'Responder pelo SGSSO e prover recursos',
            'Aprovar política, objetivos e investimento',
          ],
          [
            'Coordenação de SSO',
            'Juliana Reis — Téc. Segurança do Trabalho',
            'Manter o sistema e conduzir investigações',
            'Aprovar procedimentos e instruções',
          ],
          [
            'Supervisão de área',
            'Pedro Alves — Supervisor de Produção',
            'Fazer cumprir os controles na área',
            'Interromper atividade insegura',
          ],
          [
            'CIPA',
            'Elias Pinto — Presidente, mandato 2026',
            'Apontar riscos e participar das investigações',
            'Convocar inspeção na área',
          ],
        ],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Autoridade de interromper uma atividade insegura' },
      {
        tipo: 'texto',
        texto:
          'Esta é a linha que mais importa. Autoridade que só o gerente tem é autoridade que ' +
          'não existe às três da manhã.',
      },
      {
        tipo: 'campo',
        rotulo: 'Quem pode interromper',
        exemplo:
          'Qualquer trabalhador, próprio ou de contratada, pode interromper uma tarefa que ' +
          'considere insegura e comunicar o supervisor. Ninguém será prejudicado por isso.',
      },
      {
        tipo: 'campo',
        rotulo: 'Como essa autoridade chega às pessoas',
        exemplo: 'Integração, ordem de serviço assinada e DDS mensal',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-objetivos.docx',
    rotulo: 'os objetivos de SSO',
    norma: '45001',
    etapa: 3,
    atividade: 7,
    blocos: [
      ...sso('Objetivos de SSO e planos de ação', 'SSO-10'),
      {
        tipo: 'texto',
        texto:
          'Objetivo de SSO não é "reduzir acidentes". É um número, com prazo, com ' +
          'responsável e com um plano do que será feito para chegar lá.',
      },
      {
        tipo: 'nota',
        texto:
          'Misture indicadores que antecipam (quase-acidente reportado, inspeção feita) com ' +
          'os que contam o que já houve (acidente com afastamento). Quem mede só acidente ' +
          'ensina a equipe a não reportar.',
      },
      {
        tipo: 'tabela',
        colunas: ['Objetivo', 'Indicador', 'Tipo', 'Meta', 'Prazo', 'Responsável'],
        exemplos: [
          [
            'Fazer o reporte de quase-acidente virar hábito',
            'Quase-acidentes reportados por mês',
            'Antecipação',
            'Mínimo de 8 por mês',
            'dez/2027',
            'Juliana Reis',
          ],
          [
            'Tratar o desvio antes que vire acidente',
            '% de desvios de inspeção corrigidos no prazo',
            'Antecipação',
            'Acima de 90%',
            'dez/2027',
            'Pedro Alves',
          ],
          [
            'Eliminar o risco de queda no pátio',
            'Pontos sem proteção coletiva',
            'Antecipação',
            'Zero',
            'ago/2027',
            'Manutenção',
          ],
          [
            'Reduzir acidente com afastamento',
            'Taxa de frequência',
            'Resultado',
            'Abaixo de 5,0',
            'dez/2027',
            'Direção',
          ],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Plano de ação de cada objetivo' },
      {
        tipo: 'tabela',
        colunas: ['Objetivo', 'O que será feito', 'Quem', 'Até quando', 'Recurso'],
        exemplos: [
          [
            'Eliminar o risco de queda no pátio',
            'Instalar guarda-corpo definitivo nas plataformas 1 a 4',
            'Manutenção',
            'ago/2027',
            'R$ 00.000 aprovados',
          ],
        ],
        linhas: 8,
      },
      {
        tipo: 'campo',
        rotulo: 'Como o resultado é comunicado aos trabalhadores',
        exemplo: 'Quadro de indicadores atualizado todo mês e DDS do primeiro dia útil',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-ata-analise-critica.docx',
    rotulo: 'a ata de análise crítica',
    norma: '45001',
    etapa: 3,
    atividade: 8,
    blocos: [
      ...sso('Ata de análise crítica pela direção', 'SSO-11'),
      {
        tipo: 'texto',
        texto:
          'A reunião em que a direção olha o sistema inteiro e decide. A ata é a prova de ' +
          'que aconteceu — e o auditor lê as decisões, não a presença.',
      },
      { tipo: 'campo', rotulo: 'Data', exemplo: '18/08/2027' },
      {
        tipo: 'campo',
        rotulo: 'Participantes',
        exemplo: 'Carlos Menezes (Direção), Juliana Reis (SSO), Pedro Alves (Produção), Elias Pinto (CIPA)',
      },
      { tipo: 'secao', texto: 'Entradas — o que foi posto na mesa' },
      {
        tipo: 'tabela',
        colunas: ['Entrada', 'O que mostrou'],
        exemplos: [
          ['Situação das ações da reunião anterior', '6 de 8 concluídas; 2 reprogramadas'],
          ['Mudanças no contexto e nos requisitos legais', 'Nova exigência do cliente em contrato'],
          ['Desempenho: incidentes e indicadores', '1 acidente sem afastamento; 54 quase-acidentes'],
          ['Avaliação do atendimento legal', '3 itens não atendidos, com ação aberta'],
          ['Resultado da consulta aos trabalhadores', '11 apontamentos; 9 respondidos'],
          ['Auditoria interna', '7 constatações, 1 maior'],
          ['Riscos e oportunidades', 'Risco de calor entrou no inventário'],
          ['Adequação dos recursos', 'Falta orçamento para exaustão da pintura'],
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Decisões' },
      {
        tipo: 'tabela',
        colunas: ['Decisão', 'Responsável', 'Prazo'],
        exemplos: [
          ['Liberar R$ 00.000 para a exaustão da cabine de pintura', 'Direção', 'out/2027'],
          ['Rever a meta de taxa de frequência para 4,0 em 2028', 'Juliana Reis', 'dez/2027'],
        ],
        linhas: 8,
      },
      {
        tipo: 'nota',
        texto:
          'A direção precisa sair da sala com decisões, não com um "ficou ciente". Ata sem ' +
          'decisão é a não conformidade mais comum no requisito 9.3.',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 4 =====================
  {
    arquivo: 'sso-canais-de-consulta.docx',
    rotulo: 'o mapa de canais de consulta',
    norma: '45001',
    etapa: 4,
    atividade: 2,
    blocos: [
      ...sso('Mapa dos canais de consulta aos trabalhadores', 'SSO-12'),
      {
        tipo: 'texto',
        texto:
          'Antes de criar canal novo, aproveite o que existe. O problema raramente é falta ' +
          'de canal: é que nada do que entra por eles volta como resposta.',
      },
      {
        tipo: 'tabela',
        colunas: ['Canal', 'Quem alcança', 'Frequência', 'Quem recebe', 'O que é feito hoje'],
        exemplos: [
          [
            'Reunião da CIPA',
            'Membros eleitos e indicados',
            'Mensal',
            'Coordenação de SSO',
            'Ata feita; ações nem sempre acompanhadas',
          ],
          [
            'DDS',
            'Turno da manhã e tarde — a noite não participa',
            'Diária',
            'Supervisor',
            'Nada é registrado',
          ],
          [
            'Caixa de sugestão',
            'Todos',
            'Contínua',
            'RH',
            'Aberta a cada dois meses; sem retorno a quem sugeriu',
          ],
        ],
        linhas: 8,
      },
      {
        tipo: 'nota',
        texto:
          'A última coluna é a que dói. Escreva a verdade, mesmo que a resposta seja ' +
          '"nada" — é dela que sai o plano da próxima atividade.',
      },
      { tipo: 'secao', texto: 'Quem não é alcançado por nenhum canal' },
      {
        tipo: 'campo',
        rotulo: 'Quem fica de fora hoje',
        exemplo:
          'Turno da noite (12 pessoas) e os trabalhadores das contratadas no pátio (cerca de 20)',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-procedimento-consulta.docx',
    rotulo: 'o procedimento de consulta e participação',
    norma: '45001',
    etapa: 4,
    atividade: 3,
    blocos: [
      ...sso('Procedimento de consulta e participação dos trabalhadores', 'SSO-13'),
      {
        tipo: 'texto',
        texto:
          'A norma trata as duas coisas de modo diferente. CONSULTA é ouvir antes de ' +
          'decidir. PARTICIPAÇÃO é o trabalhador tomando parte na decisão.',
      },
      { tipo: 'secao', texto: '1. O que é consulta e o que é participação' },
      {
        tipo: 'tabela',
        colunas: ['Assunto', 'Consulta ou participação', 'Com quem', 'Como'],
        exemplos: [
          [
            'Identificação de perigos e avaliação de riscos',
            'Participação',
            'Trabalhadores não-gerenciais da área',
            'Levantamento em campo, com registro de quem participou',
          ],
          [
            'Determinação dos controles',
            'Participação',
            'Trabalhadores da área e CIPA',
            'Reunião de análise do plano de ação',
          ],
          [
            'Investigação de incidentes',
            'Participação',
            'Trabalhador da área envolvida',
            'Compõe a equipe de investigação',
          ],
          [
            'Política e objetivos de SSO',
            'Consulta',
            'CIPA e representantes',
            'Reunião antes da aprovação pela direção',
          ],
          [
            'Necessidades de treinamento',
            'Consulta',
            'Todos',
            'Levantamento anual com os supervisores',
          ],
        ],
        linhas: 8,
      },
      {
        tipo: 'nota',
        texto:
          'Nos assuntos de participação, "eu avisei a equipe depois" não cumpre o requisito. ' +
          'O trabalhador precisa estar na decisão, não no comunicado.',
      },
      { tipo: 'secao', texto: '2. Como o turno da noite e o terceirizado são alcançados' },
      {
        tipo: 'campo',
        rotulo: 'Turno da noite',
        exemplo:
          'Reunião própria às 22h, uma vez por mês, conduzida pelo supervisor do turno; ata ' +
          'enviada à coordenação de SSO',
      },
      {
        tipo: 'campo',
        rotulo: 'Trabalhadores de contratadas',
        exemplo:
          'Representante indicado por contratada participa da reunião mensal de segurança do pátio',
      },
      { tipo: 'secao', texto: '3. Como a resposta volta' },
      {
        tipo: 'texto',
        texto: 'Consulta sem retorno ensina o trabalhador a não falar mais.',
      },
      {
        tipo: 'tabela',
        colunas: ['Quem responde', 'Em quantos dias', 'Por onde'],
        exemplos: [
          ['Coordenação de SSO', '15 dias corridos', 'Quadro de avisos e DDS da área'],
        ],
        linhas: 3,
      },
      { tipo: 'secao', texto: '4. Obstáculos à participação e o que será feito' },
      {
        tipo: 'tabela',
        colunas: ['Obstáculo', 'O que será feito', 'Quem', 'Prazo'],
        exemplos: [
          [
            'Medo de represália ao reportar',
            'Comunicado assinado pela direção garantindo não punição',
            'Direção',
            'abr/2027',
          ],
          [
            'Reunião em horário que o turno da noite não alcança',
            'Reunião própria do turno, às 22h',
            'Supervisão',
            'abr/2027',
          ],
          [
            'Formulário em linguagem difícil',
            'Reescrever o formulário de reporte em uma página, com desenho',
            'Juliana Reis',
            'mai/2027',
          ],
          ['A resposta nunca volta', 'Prazo de 15 dias definido neste procedimento', 'Juliana Reis', 'abr/2027'],
        ],
        linhas: 6,
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 5 =====================
  {
    arquivo: 'sso-levantamento-de-perigos.docx',
    rotulo: 'o roteiro de levantamento de perigos',
    norma: '45001',
    etapa: 5,
    atividade: 2,
    blocos: [
      ...sso('Levantamento de perigos em campo', 'SSO-14'),
      {
        tipo: 'texto',
        texto:
          'Esta é a atividade mais longa da trilha e não dá para fazer sentada. O ' +
          'levantamento acontece no posto de trabalho, com quem trabalha nele.',
      },
      {
        tipo: 'nota',
        texto:
          'A participação dos trabalhadores aqui não é cortesia: é o requisito 5.4 valendo. ' +
          'Registre quem participou de cada área — é a evidência.',
      },
      { tipo: 'secao', texto: 'Perguntas que abrem a conversa' },
      {
        tipo: 'texto',
        texto:
          '1. O que já quase aconteceu aqui? · 2. Qual parte desta tarefa você faria ' +
          'diferente se pudesse? · 3. O que você faz quando a máquina trava? · 4. Qual é a ' +
          '"manha" desta máquina? · 5. O que muda quando falta gente?',
      },
      { tipo: 'secao', texto: 'Levantamento por área' },
      {
        tipo: 'campo',
        rotulo: 'Área',
        exemplo: 'Fábrica — setor de solda',
      },
      {
        tipo: 'campo',
        rotulo: 'Quem participou (nome e função)',
        exemplo: 'Elias Pinto (soldador), Rita Nunes (soldadora), Pedro Alves (supervisor)',
      },
      { tipo: 'campo', rotulo: 'Data', exemplo: '14/04/2027' },
      {
        tipo: 'tabela',
        colunas: ['Tarefa', 'Rotina / Não-rotina / Emergência', 'Perigo', 'O que pode acontecer', 'Controle que já existe'],
        exemplos: [
          ['Solda MIG em bancada', 'Rotina', 'Fumos metálicos', 'Doença respiratória', 'Exaustor parado desde 2025'],
          ['Solda MIG em bancada', 'Rotina', 'Radiação do arco', 'Lesão ocular', 'Máscara automática'],
          ['Troca do cilindro de gás', 'Não-rotina', 'Queda do cilindro', 'Esmagamento de pé', 'Nenhum'],
          ['Limpeza da cabine', 'Não-rotina', 'Espaço restrito e resíduo', 'Intoxicação', 'Nenhum'],
          ['Princípio de incêndio na bancada', 'Emergência', 'Material inflamável próximo', 'Queimadura', 'Extintor a 15 m'],
          ['Jornada de 12 h em pico de entrega', 'Rotina', 'Fadiga', 'Erro e acidente', 'Nenhum'],
        ],
        linhas: 14,
      },
      {
        tipo: 'nota',
        texto:
          'Não esqueça o que adoece devagar: ruído, postura, repetição, produto químico, ' +
          'ritmo e jornada. Se o seu levantamento só tem o que corta e queima, ele está ' +
          'incompleto.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-metodologia-de-riscos.docx',
    rotulo: 'a metodologia de avaliação de riscos',
    norma: '45001',
    etapa: 5,
    atividade: 3,
    blocos: [
      ...sso('Metodologia de avaliação de riscos de SSO', 'SSO-15'),
      {
        tipo: 'texto',
        texto:
          'A régua, escrita antes de classificar. A norma não impõe método, mas exige que ' +
          'ele seja definido e aplicado sempre do mesmo jeito.',
      },
      { tipo: 'secao', texto: 'Probabilidade' },
      {
        tipo: 'tabela',
        colunas: ['Nível', 'Nome', 'O que significa nesta empresa'],
        exemplos: [
          ['1', 'Raro', 'Não ocorreu aqui nem em empresa parecida que conhecemos'],
          ['2', 'Pouco provável', 'Ocorreu uma vez em mais de 5 anos'],
          ['3', 'Possível', 'Ocorreu nos últimos 2 anos, ou há quase-acidente registrado'],
          ['4', 'Provável', 'Ocorre pelo menos uma vez por ano'],
          ['5', 'Quase certo', 'Ocorre todo mês, ou a exposição é diária e sem controle'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Severidade' },
      {
        tipo: 'tabela',
        colunas: ['Nível', 'Nome', 'O que significa nesta empresa'],
        exemplos: [
          ['1', 'Desprezível', 'Primeiros socorros, sem afastamento'],
          ['2', 'Pequena', 'Afastamento de até 3 dias'],
          ['3', 'Moderada', 'Afastamento acima de 3 dias, sem sequela'],
          ['4', 'Grande', 'Sequela permanente ou doença ocupacional estabelecida'],
          ['5', 'Catastrófica', 'Óbito ou mais de uma vítima grave'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Classificação (probabilidade × severidade)' },
      {
        tipo: 'tabela',
        colunas: ['Faixa', 'Classificação', 'O que a empresa faz'],
        exemplos: [
          ['1 a 4', 'Baixo', 'Manter o controle existente e monitorar'],
          ['5 a 9', 'Moderado', 'Ação programada no plano anual'],
          ['10 a 16', 'Alto', 'Ação com prazo definido e acompanhamento mensal'],
          ['17 a 25', 'Inaceitável', 'A atividade não continua como está'],
        ],
        linhas: 4,
      },
      { tipo: 'secao', texto: 'Risco inaceitável' },
      {
        tipo: 'campo',
        rotulo: 'O que acontece quando um aparece',
        exemplo:
          'A atividade é interrompida imediatamente pelo supervisor ou por quem identificar. ' +
          'Só volta com controle implantado e reavaliação registrada. A direção é comunicada ' +
          'no mesmo dia.',
      },
      {
        tipo: 'nota',
        texto:
          'Esta é a linha que dá dente ao sistema. Se a empresa não estiver disposta a ' +
          'parar, melhor rever a régua agora do que descobrir na auditoria que ela é ficção.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-inventario-de-riscos.docx',
    rotulo: 'o inventário de riscos',
    norma: '45001',
    etapa: 5,
    atividade: 4,
    blocos: [
      ...sso('Inventário de riscos', 'SSO-16'),
      {
        tipo: 'aviso',
        texto:
          'ESTE É O MESMO INVENTÁRIO DE RISCOS QUE A NR-01 JÁ OBRIGA NO PGR. É um documento ' +
          'só. Se a empresa já tem o PGR, traga o inventário dele para cá e complete o que ' +
          'faltar — manter duas planilhas é garantir que elas se contradigam na frente do ' +
          'auditor.',
      },
      {
        tipo: 'texto',
        texto:
          'Cada perigo levantado, com o risco avaliado pela sua metodologia e o controle ' +
          'que já existe hoje — mesmo que seja frágil.',
      },
      {
        tipo: 'campo',
        rotulo: 'A empresa já tem PGR?',
        exemplo: 'Sim — PGR revisão 03, de 10/02/2027. Este inventário substitui o anexo dele.',
      },
      {
        tipo: 'tabela',
        colunas: [
          'Área',
          'Tarefa',
          'Perigo',
          'Tipo',
          'Lesão ou doença possível',
          'Controle existente',
          'P',
          'S',
          'Risco',
        ],
        exemplos: [
          ['Solda', 'Solda MIG', 'Fumos metálicos', 'Químico', 'Doença respiratória', 'Exaustor parado', '4', '4', 'Inaceitável (16)'],
          ['Solda', 'Solda MIG', 'Radiação do arco', 'Físico', 'Lesão ocular', 'Máscara automática', '2', '3', 'Moderado (6)'],
          ['Pátio', 'Montagem em altura', 'Queda de 4 m', 'Físico', 'Óbito', 'Cinto, sem ponto fixo definido', '3', '5', 'Inaceitável (15)'],
          ['Pátio', 'Carregamento', 'Empilhadeira x pedestre', 'Mecânico', 'Atropelamento', 'Sem rota separada', '4', '4', 'Inaceitável (16)'],
          ['Montagem', 'Esmerilhamento', 'Ruído acima de 85 dB', 'Físico', 'Perda auditiva', 'Protetor auricular', '4', '3', 'Alto (12)'],
          ['Montagem', 'Movimentação de peça', 'Postura e peso', 'Ergonômico', 'Lombalgia', 'Nenhum', '4', '3', 'Alto (12)'],
          ['Toda a empresa', 'Pico de entrega', 'Jornada estendida', 'Organizacional', 'Fadiga e erro', 'Nenhum', '3', '3', 'Moderado (9)'],
          ['Pátio', 'Trabalho a céu aberto', 'Calor extremo', 'Físico', 'Exaustão térmica', 'Pausa informal', '4', '3', 'Alto (12)'],
        ],
        linhas: 20,
      },
      {
        tipo: 'nota',
        texto:
          'Ordene do maior risco para o menor antes de levar à direção. O que está no topo ' +
          'é o que vira obra, e é por ele que o plano de investimento será revisto.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-plano-de-acao-riscos.docx',
    rotulo: 'o plano de ação de riscos',
    norma: '45001',
    etapa: 5,
    atividade: 5,
    blocos: [
      ...sso('Planejamento das ações sobre os riscos', 'SSO-17'),
      {
        tipo: 'texto',
        texto:
          'O inventário aponta; este plano decide. Para cada risco alto ou inaceitável: o ' +
          'que será feito, por quem e até quando.',
      },
      {
        tipo: 'nota',
        texto:
          'A ordem não é livre. Primeiro eliminar, depois substituir, depois engenharia, ' +
          'depois administrativo, e só então EPI. Plano que só distribui EPI é plano que o ' +
          'auditor devolve.',
      },
      {
        tipo: 'tabela',
        colunas: ['Risco', 'Ação', 'Nível da hierarquia', 'Por que não foi um nível acima', 'Quem', 'Prazo', 'Custo'],
        exemplos: [
          [
            'Fumos metálicos na solda (16)',
            'Recuperar a exaustão e instalar captação na fonte',
            'Engenharia',
            'Não dá para eliminar a solda nem substituir o processo',
            'Manutenção',
            'set/2027',
            'R$ 00.000',
          ],
          [
            'Queda de 4 m no pátio (15)',
            'Instalar guarda-corpo definitivo nas plataformas',
            'Engenharia',
            '—',
            'Manutenção',
            'ago/2027',
            'R$ 00.000',
          ],
          [
            'Empilhadeira x pedestre (16)',
            'Separar rota de pedestre com barreira física e espelho',
            'Engenharia',
            '—',
            'Manutenção',
            'jul/2027',
            'R$ 00.000',
          ],
          [
            'Ruído acima de 85 dB (12)',
            'Enclausurar o esmeril; manter protetor até a obra',
            'Engenharia',
            '—',
            'Manutenção',
            'nov/2027',
            'R$ 00.000',
          ],
          [
            'Calor extremo no pátio (12)',
            'Pausa programada e ponto de hidratação coberto',
            'Administrativo',
            'Não há como climatizar área aberta; sombreamento parcial em estudo',
            'Supervisão',
            'set/2027',
            'R$ 0.000',
          ],
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Impacto no plano de investimento' },
      {
        tipo: 'campo',
        rotulo: 'Total das adequações físicas',
        exemplo: 'R$ 00.000 — substitui a estimativa provisória da etapa 1',
      },
      {
        tipo: 'campo',
        rotulo: 'Aprovado pela direção em',
        exemplo: '06/05/2027',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-oportunidades.docx',
    rotulo: 'a planilha de oportunidades',
    norma: '45001',
    etapa: 5,
    atividade: 6,
    blocos: [
      ...sso('Oportunidades de SSO', 'SSO-18'),
      {
        tipo: 'texto',
        texto:
          'O que pode melhorar a segurança e a saúde além de corrigir o que está errado. É ' +
          'onde cabem as ideias boas que aparecem no levantamento de campo e normalmente ' +
          'não têm onde ser registradas.',
      },
      {
        tipo: 'tabela',
        colunas: ['Oportunidade', 'De onde veio', 'Ganho esperado', 'Viável?', 'Vai para o plano?'],
        exemplos: [
          [
            'Mesa regulável na bancada de solda',
            'Sugestão da Rita, soldadora',
            'Reduz postura forçada em quem solda peça pequena',
            'Sim',
            'Sim — set/2027',
          ],
          [
            'Trocar o desengraxante por produto de base aquosa',
            'Levantamento de campo',
            'Elimina um químico do inventário',
            'Em teste',
            'Decidir em jul/2027',
          ],
          [
            'Antecipar o turno no verão',
            'Conversa com a equipe do pátio',
            'Reduz exposição ao calor do meio do dia',
            'Depende do acordo coletivo',
            'Levar ao sindicato',
          ],
        ],
        linhas: 8,
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 6 =====================
  {
    arquivo: 'sso-matriz-legal.docx',
    rotulo: 'a matriz de requisitos legais',
    norma: '45001',
    etapa: 6,
    atividade: 2,
    blocos: [
      ...sso('Matriz de requisitos legais e outros requisitos', 'SSO-19'),
      {
        tipo: 'texto',
        texto:
          'Nem toda NR se aplica a toda empresa. O que o auditor cobra é que você saiba ' +
          'dizer quais se aplicam e por quê — e que tenha olhado todas antes de descartar.',
      },
      {
        tipo: 'nota',
        texto:
          'Use o inventário de riscos como guia: cada perigo aponta para a NR que o trata. ' +
          'Perigo mapeado sem NR correspondente merece uma segunda olhada.',
      },
      { tipo: 'secao', texto: 'Requisitos legais' },
      {
        tipo: 'tabela',
        colunas: ['Norma ou lei', 'Aplica?', 'Por quê', 'O que exige de nós', 'Situação'],
        exemplos: [
          ['NR-01 — Disposições gerais e GRO', 'Sim', 'Toda empresa', 'PGR com inventário de riscos e ordem de serviço', 'Atende'],
          ['NR-06 — EPI', 'Sim', 'Uso de EPI em solda e montagem', 'Ficha por trabalhador, CA válido', 'Atende parcialmente'],
          ['NR-10 — Eletricidade', 'Sim', 'Manutenção em painel elétrico', 'Treinamento e procedimento', 'Não atende'],
          ['NR-12 — Máquinas', 'Sim', 'Guilhotina, dobradeira, esmeril', 'Proteção e apreciação de risco', 'Não atende'],
          ['NR-13 — Caldeiras e vasos', 'Não', 'A empresa não possui', '—', '—'],
          ['NR-15 — Insalubridade', 'Sim', 'Ruído e fumos', 'Laudo e avaliação', 'Atende'],
          ['NR-17 — Ergonomia', 'Sim', 'Movimentação manual de peças', 'Avaliação ergonômica', 'Não atende'],
          ['NR-33 — Espaço confinado', 'Sim', 'Limpeza interna da cabine', 'Permissão e treinamento', 'Não atende'],
          ['NR-35 — Trabalho em altura', 'Sim', 'Montagem acima de 2 m', 'Treinamento, análise de risco, permissão', 'Atende parcialmente'],
        ],
        linhas: 16,
      },
      { tipo: 'secao', texto: 'Outros requisitos assumidos' },
      {
        tipo: 'texto',
        texto:
          'O que a empresa assumiu sem ser obrigada. Cláusula contratual descumprida é não ' +
          'conformidade do mesmo tamanho que NR descumprida.',
      },
      {
        tipo: 'tabela',
        colunas: ['Origem', 'O que exige', 'Situação'],
        exemplos: [
          ['Contrato com o cliente X, cláusula 8ª', 'Certificação ISO 45001 até 06/2028', 'Em andamento'],
          ['Acordo coletivo 2026/2027, cláusula 22', 'Pausa de 10 min a cada 2 h em trabalho a céu aberto', 'Não atende'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Como a matriz é mantida em dia' },
      {
        tipo: 'campo',
        rotulo: 'Quem acompanha a mudança legal e com que frequência',
        exemplo: 'Juliana Reis — consulta trimestral',
      },
      {
        tipo: 'campo',
        rotulo: 'Fontes consultadas',
        exemplo: 'Portarias publicadas no Diário Oficial, informativo da consultoria, sindicato patronal',
      },
      {
        tipo: 'campo',
        rotulo: 'Gatilhos de revisão fora do prazo',
        exemplo:
          'Renegociação do acordo coletivo; contrato novo com cláusula de SSO; compra de ' +
          'máquina ou produto químico diferente',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-documentos-com-validade.docx',
    rotulo: 'o controle de documentos com validade',
    norma: '45001',
    etapa: 6,
    atividade: 3,
    blocos: [
      ...sso('Licenças, laudos e documentos com prazo', 'SSO-20'),
      {
        tipo: 'texto',
        texto:
          'Documento de SSO vence, e vencido não vale nada na auditoria. A empresa que ' +
          'gerencia isso por memória sempre tem um vencido.',
      },
      {
        tipo: 'tabela',
        colunas: ['Documento', 'Emitido em', 'Vence em', 'Quem renova', 'Situação'],
        exemplos: [
          ['PGR', '10/02/2027', '10/02/2029', 'Coordenação de SSO', 'Em dia'],
          ['PCMSO', '10/02/2027', '10/02/2028', 'Médico do trabalho', 'Em dia'],
          ['Laudo de insalubridade', '03/2024', '—', 'Consultoria', 'Desatualizado — refazer'],
          ['AVCB — Corpo de Bombeiros', '08/2025', '08/2026', 'Administrativo', 'VENCIDO'],
          ['Licença de operação ambiental', '01/2025', '01/2030', 'Administrativo', 'Em dia'],
          ['Inspeção de ponte rolante', '06/2026', '06/2027', 'Manutenção', 'Em dia'],
          ['Calibração do decibelímetro', '09/2026', '09/2027', 'Consultoria', 'Em dia'],
        ],
        linhas: 14,
      },
      {
        tipo: 'nota',
        texto:
          'Cadastre cada vencimento em Documentos de SST, no portal, para o aviso chegar ' +
          'antes. Esta planilha é a foto de hoje; o aviso é o que impede o vencido amanhã.',
      },
      { tipo: 'secao', texto: 'Vencidos — ação prioritária' },
      {
        tipo: 'tabela',
        colunas: ['Documento', 'Há quanto tempo vencido', 'Ação', 'Quem', 'Prazo'],
        exemplos: [['AVCB', '3 meses', 'Protocolar renovação no Corpo de Bombeiros', 'Administrativo', '30 dias']],
        linhas: 5,
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 7 =====================
  {
    arquivo: 'sso-instrucao-de-trabalho.docx',
    rotulo: 'o modelo de instrução de trabalho',
    norma: '45001',
    etapa: 7,
    atividade: 3,
    blocos: [
      ...sso('Instrução de trabalho de atividade de risco', 'SSO-21'),
      {
        tipo: 'nota',
        texto:
          'Instrução boa é curta, tem foto e fica onde a tarefa acontece. Oito páginas em ' +
          'linguagem de engenheiro não são lidas — e o auditor descobre isso perguntando ao ' +
          'operador o que está escrito nelas.',
      },
      { tipo: 'campo', rotulo: 'Tarefa', exemplo: 'Montagem de estrutura em altura no pátio' },
      { tipo: 'campo', rotulo: 'Área', exemplo: 'Pátio de montagem' },
      {
        tipo: 'campo',
        rotulo: 'Riscos desta tarefa (do inventário)',
        exemplo: 'Queda de altura (inaceitável); queda de material sobre terceiros; calor',
      },
      {
        tipo: 'campo',
        rotulo: 'Quem pode executar',
        exemplo: 'Montador com NR-35 válida e ASO com aptidão para altura',
      },
      { tipo: 'secao', texto: 'Antes de começar' },
      {
        tipo: 'tabela',
        colunas: ['Verificação', 'OK?'],
        exemplos: [
          ['Permissão de trabalho emitida e assinada', ''],
          ['Ponto de ancoragem definido e inspecionado', ''],
          ['Cinto e talabarte inspecionados no dia', ''],
          ['Área abaixo isolada e sinalizada', ''],
          ['Equipe de resgate disponível e avisada', ''],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Passo a passo' },
      {
        tipo: 'tabela',
        colunas: ['Passo', 'O que fazer', 'Cuidado'],
        exemplos: [
          ['1', 'Montar a plataforma e travar as rodas', 'Não subir antes de travar'],
          ['2', 'Ancorar o talabarte acima da cintura', 'Nunca ancorar no guarda-corpo provisório'],
          ['3', 'Içar a peça com a corda-guia', 'Ninguém embaixo da carga'],
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Quando algo sai do previsto' },
      {
        tipo: 'campo',
        rotulo: 'O que fazer',
        exemplo:
          'Interromper a tarefa, descer em segurança e comunicar o supervisor. Qualquer um ' +
          'da equipe pode interromper, e não será prejudicado por isso.',
      },
      {
        tipo: 'campo',
        rotulo: 'A quem comunicar',
        exemplo: 'Pedro Alves — Supervisor (ramal 000); Juliana Reis — SSO (ramal 000)',
      },
      {
        tipo: 'nota',
        texto:
          'Imprima com foto do posto real, não com desenho genérico, e deixe plastificada no ' +
          'local da tarefa. Repita esta ficha para cada atividade de risco alto do inventário.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-permissao-de-trabalho.docx',
    rotulo: 'o modelo de permissão de trabalho',
    norma: '45001',
    etapa: 7,
    atividade: 4,
    blocos: [
      ...sso('Permissão de trabalho — atividade crítica', 'SSO-22'),
      {
        tipo: 'texto',
        texto:
          'A permissão não repete a instrução. Ela checa as condições DAQUELE dia: a pessoa ' +
          'está treinada e apta, o equipamento foi inspecionado, a área está isolada, o ' +
          'resgate está disponível.',
      },
      { tipo: 'secao', texto: 'Identificação' },
      { tipo: 'campo', rotulo: 'Número', exemplo: 'PT-2027-0142' },
      { tipo: 'campo', rotulo: 'Data e horário de validade', exemplo: '14/06/2027, das 08h às 17h' },
      {
        tipo: 'campo',
        rotulo: 'Tipo de atividade',
        exemplo: 'Trabalho em altura (NR-35)',
      },
      { tipo: 'campo', rotulo: 'Local exato', exemplo: 'Pátio — plataforma 3, lado leste' },
      { tipo: 'campo', rotulo: 'Descrição do serviço', exemplo: 'Içamento e fixação de viga V-12' },
      { tipo: 'secao', texto: 'Quem executa' },
      {
        tipo: 'tabela',
        colunas: ['Nome', 'Empresa', 'Treinamento válido até', 'ASO válido até', 'Assinatura'],
        exemplos: [['Elias Pinto', 'Própria', '12/2027', '03/2028', '']],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Verificação no local, antes de liberar' },
      {
        tipo: 'tabela',
        colunas: ['Item', 'Sim', 'Não', 'N/A'],
        exemplos: [
          ['Equipe treinada e apta, documentos conferidos', '', '', ''],
          ['Equipamento inspecionado hoje', '', '', ''],
          ['Área isolada e sinalizada', '', '', ''],
          ['Ponto de ancoragem definido e testado', '', '', ''],
          ['Resgate disponível e comunicado', '', '', ''],
          ['Condição do tempo adequada', '', '', ''],
          ['Equipe sabe o que fazer em emergência', '', '', ''],
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Liberação' },
      {
        tipo: 'texto',
        texto: 'Quem emite e quem aprova não podem ser a mesma pessoa que executa.',
      },
      { tipo: 'campo', rotulo: 'Emitida por (nome, cargo, hora)', exemplo: 'Pedro Alves — Supervisor — 07h50' },
      { tipo: 'campo', rotulo: 'Aprovada por (nome, cargo, hora)', exemplo: 'Juliana Reis — SSO — 07h55' },
      { tipo: 'secao', texto: 'Encerramento' },
      { tipo: 'campo', rotulo: 'Serviço concluído em', exemplo: '14/06/2027, 16h20' },
      { tipo: 'campo', rotulo: 'Área liberada e organizada?', exemplo: 'Sim' },
      { tipo: 'campo', rotulo: 'Ocorrência durante o serviço', exemplo: 'Nenhuma' },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-gestao-de-mudancas.docx',
    rotulo: 'o formulário de gestão de mudanças',
    norma: '45001',
    etapa: 7,
    atividade: 5,
    blocos: [
      ...sso('Gestão de mudanças', 'SSO-23'),
      {
        tipo: 'texto',
        texto:
          'Toda mudança cria perigo que ninguém mapeou, porque o inventário descreve a ' +
          'empresa de antes. A avaliação acontece ANTES da mudança, não depois do primeiro ' +
          'acidente com o equipamento novo.',
      },
      { tipo: 'secao', texto: 'O que conta como mudança que exige avaliação' },
      {
        tipo: 'texto',
        texto:
          'Máquina ou equipamento novo · mudança de layout · produto químico diferente · ' +
          'turno ou jornada nova · processo terceirizado · mudança de legislação · pessoa ' +
          'nova em atividade de risco alto.',
      },
      { tipo: 'secao', texto: 'A mudança' },
      { tipo: 'campo', rotulo: 'O que vai mudar', exemplo: 'Compra de uma guilhotina usada para o setor de corte' },
      { tipo: 'campo', rotulo: 'Por quê', exemplo: 'Dobrar a capacidade de corte para o contrato novo' },
      { tipo: 'campo', rotulo: 'Quando', exemplo: 'Entrega prevista para 20/07/2027' },
      { tipo: 'campo', rotulo: 'Quem solicitou', exemplo: 'Pedro Alves — Supervisor de Produção' },
      { tipo: 'secao', texto: 'Perigos que a mudança traz' },
      {
        tipo: 'tabela',
        colunas: ['Perigo novo ou agravado', 'Risco', 'Controle necessário antes de operar'],
        exemplos: [
          ['Prensagem na área de corte', 'Inaceitável', 'Proteção conforme NR-12 e apreciação de risco'],
          ['Ruído adicional no setor', 'Alto', 'Medição após instalação; enclausuramento se passar de 85 dB'],
          ['Operador sem treinamento na máquina', 'Alto', 'Treinamento e autorização antes do primeiro uso'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Decisão' },
      {
        tipo: 'campo',
        rotulo: 'A mudança está autorizada a seguir?',
        exemplo: 'Sim, condicionada à instalação da proteção e ao treinamento antes do primeiro uso',
      },
      { tipo: 'campo', rotulo: 'Quem avaliou', exemplo: 'Juliana Reis — SSO' },
      { tipo: 'campo', rotulo: 'Quem autorizou', exemplo: 'Carlos Menezes — Direção' },
      {
        tipo: 'campo',
        rotulo: 'Inventário de riscos atualizado em',
        exemplo: 'Preencher após a mudança — é o passo que todo mundo esquece',
      },
      {
        tipo: 'nota',
        texto:
          'Combine o gatilho com Compras: nenhuma compra de máquina ou troca de químico ' +
          'passa sem este formulário. Mudança tem pressa, e segurança parece atraso — por ' +
          'isso o gatilho precisa estar fora da boa vontade.',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 8 =====================
  {
    arquivo: 'sso-aquisicao.docx',
    rotulo: 'o procedimento de aquisição com critérios de SSO',
    norma: '45001',
    etapa: 8,
    atividade: 2,
    blocos: [
      ...sso('Critérios de SSO na aquisição', 'SSO-24'),
      {
        tipo: 'texto',
        texto:
          'O momento mais barato de resolver um perigo é antes de ele entrar. Máquina sem ' +
          'proteção custa caro de adequar depois; químico sem alternativa vira EPI para ' +
          'sempre.',
      },
      { tipo: 'secao', texto: 'Máquinas e equipamentos' },
      {
        tipo: 'tabela',
        colunas: ['Exigência', 'Quem verifica', 'Antes ou depois da compra'],
        exemplos: [
          ['Proteções conforme a NR-12, instaladas e funcionando', 'Coordenação de SSO', 'Antes'],
          ['Manual em português e apreciação de risco do fabricante', 'Coordenação de SSO', 'Antes'],
          ['Nível de ruído declarado pelo fabricante', 'Coordenação de SSO', 'Antes'],
          ['Treinamento de operação incluído no fornecimento', 'Compras', 'Antes'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Produtos químicos' },
      {
        tipo: 'tabela',
        colunas: ['Exigência', 'Quem verifica', 'Antes ou depois da compra'],
        exemplos: [
          ['Ficha com dados de segurança do produto, em português', 'Coordenação de SSO', 'Antes'],
          ['Avaliação de alternativa menos agressiva', 'Coordenação de SSO', 'Antes'],
          ['Rotulagem adequada e EPI compatível disponível', 'Coordenação de SSO', 'Antes'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Como isso entra no processo de compra' },
      {
        tipo: 'campo',
        rotulo: 'Quem aprova tecnicamente antes de a compra ser fechada',
        exemplo: 'Juliana Reis — Coordenação de SSO',
      },
      {
        tipo: 'campo',
        rotulo: 'O que acontece se a compra for fechada sem essa aprovação',
        exemplo:
          'O equipamento não é liberado para uso até a adequação, e o caso entra como não ' +
          'conformidade do processo de compras',
      },
      {
        tipo: 'campo',
        rotulo: 'Acordado com Compras em',
        exemplo: '12/06/2027 — Marina Costa, Gerente de Compras',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-contratadas.docx',
    rotulo: 'o procedimento de contratadas',
    norma: '45001',
    etapa: 8,
    atividade: 3,
    blocos: [
      ...sso('Qualificação e controle de contratadas', 'SSO-25'),
      {
        tipo: 'aviso',
        texto:
          'ACIDENTE COM FUNCIONÁRIO DE CONTRATADA DENTRO DAS SUAS INSTALAÇÕES É ACIDENTE DO ' +
          'SEU SISTEMA DE GESTÃO. Terceirizar a atividade perigosa não terceiriza o risco.',
      },
      { tipo: 'secao', texto: '1. Antes de contratar — qualificação' },
      {
        tipo: 'tabela',
        colunas: ['Critério', 'Como é verificado', 'Elimina?'],
        exemplos: [
          ['Possui SESMT ou responsável técnico de segurança', 'Documento', 'Não — mas pontua'],
          ['Apresenta PGR e PCMSO próprios', 'Documento', 'Sim'],
          ['Histórico de acidentes nos últimos 2 anos', 'Declaração', 'Avaliar caso a caso'],
          ['Treinamentos de NR da equipe que virá', 'Certificados', 'Sim'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: '2. Na entrada — documentos por pessoa' },
      {
        tipo: 'tabela',
        colunas: ['Documento', 'Quem confere', 'Onde fica'],
        exemplos: [
          ['ASO com aptidão para a função', 'Portaria e SSO', 'Pasta da contratada'],
          ['Certificado da NR aplicável, dentro da validade', 'SSO', 'Pasta da contratada'],
          ['Ficha de EPI assinada', 'SSO', 'Pasta da contratada'],
          ['Ordem de serviço da função', 'SSO', 'Pasta da contratada'],
          ['Registro da integração feita aqui', 'SSO', 'Pasta da contratada'],
        ],
        linhas: 7,
      },
      { tipo: 'secao', texto: '3. Durante o serviço — fiscalização' },
      {
        tipo: 'texto',
        texto:
          'A maioria das empresas faz os dois primeiros momentos e esquece este. É neste ' +
          'que o acidente acontece.',
      },
      {
        tipo: 'tabela',
        colunas: ['O que é fiscalizado', 'Quem', 'Com que frequência', 'Registro'],
        exemplos: [
          ['Uso de EPI e cumprimento do procedimento', 'Supervisor da área', 'Diária', 'Checklist de inspeção'],
          ['Permissão de trabalho emitida nas atividades críticas', 'SSO', 'A cada emissão', 'A própria PT'],
          ['Condição de equipamento trazido pela contratada', 'SSO', 'Semanal', 'Checklist de inspeção'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: '4. Quando a contratada descumpre' },
      {
        tipo: 'campo',
        rotulo: 'Consequência, por escrito',
        exemplo:
          '1ª vez: advertência formal à contratada e correção imediata. 2ª vez: afastamento ' +
          'do trabalhador envolvido. 3ª vez: suspensão do contrato. Risco inaceitável: ' +
          'paralisação imediata, sem gradação.',
      },
      {
        tipo: 'nota',
        texto:
          'Escreva a consequência antes de precisar dela. Regra criada no calor do acidente ' +
          'não se sustenta.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-integracao.docx',
    rotulo: 'o roteiro de integração',
    norma: '45001',
    etapa: 8,
    atividade: 4,
    blocos: [
      ...sso('Integração de terceirizados e visitantes', 'SSO-26'),
      {
        tipo: 'texto',
        texto:
          'Quem chega não conhece o risco da sua casa. Precisa ser curta e precisa ser ' +
          'registrada: quinze minutos bem feitos, com o mapa da área na mão, funcionam — ' +
          'duas horas que ninguém escuta cumprem o papel na pasta e falham no pátio.',
      },
      { tipo: 'secao', texto: 'Conteúdo' },
      {
        tipo: 'tabela',
        colunas: ['Tema', 'O que dizer', 'Tempo'],
        exemplos: [
          ['Política de SSO', 'O compromisso da empresa, em uma frase', '1 min'],
          ['Riscos da área onde a pessoa vai atuar', 'Do inventário: altura, empilhadeira, ruído, solda', '5 min'],
          ['Regras que não se negociam', 'EPI obrigatório, rota de pedestre, PT em atividade crítica', '3 min'],
          ['O que fazer no alarme', 'Rota de fuga, ponto de encontro, quem comanda', '3 min'],
          ['A quem avisar', 'Supervisor da área e SSO, com ramal', '1 min'],
          ['Direito de parar', 'Pode interromper tarefa insegura e não será prejudicado', '2 min'],
        ],
        linhas: 8,
      },
      {
        tipo: 'nota',
        texto:
          'Monte o conteúdo a partir dos riscos reais do SEU inventário, não de um modelo ' +
          'genérico. Integração que não cita a empilhadeira do seu pátio não protege ninguém.',
      },
      { tipo: 'secao', texto: 'Registro' },
      { tipo: 'campo', rotulo: 'Data e horário', exemplo: '18/06/2027, 07h30' },
      { tipo: 'campo', rotulo: 'Quem aplicou', exemplo: 'Juliana Reis — SSO' },
      {
        tipo: 'tabela',
        colunas: ['Nome', 'Empresa', 'Vai atuar em', 'Assinatura'],
        exemplos: [['João Breda', 'Montagem Sul Ltda', 'Pátio — plataforma 3', '']],
        linhas: 12,
      },
      {
        tipo: 'campo',
        rotulo: 'Onde o registro fica guardado',
        exemplo: 'Pasta da contratada, na pasta do SGSSO',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 9 =====================
  {
    arquivo: 'sso-matriz-de-competencia.docx',
    rotulo: 'a matriz de competência',
    norma: '45001',
    etapa: 9,
    atividade: 1,
    blocos: [
      ...sso('Matriz de competência', 'SSO-27'),
      {
        tipo: 'texto',
        texto:
          'Em SSO boa parte da competência é exigida por lei, com carga horária e ' +
          'periodicidade definidas em NR. Treinamento vencido é o mesmo que treinamento ' +
          'inexistente.',
      },
      {
        tipo: 'tabela',
        colunas: ['Função', 'O que precisa saber', 'Treinamento', 'Exigido por NR?', 'Periodicidade'],
        exemplos: [
          ['Montador', 'Trabalhar em altura com segurança', 'NR-35', 'Sim', 'Bienal'],
          ['Montador', 'Movimentar carga com segurança', 'Rigging básico', 'Não', 'Sem prazo'],
          ['Soldador', 'Riscos do fumo e da radiação', 'Integração de SSO do posto', 'Não', 'Anual'],
          ['Eletricista', 'Intervenção segura em instalação elétrica', 'NR-10 básico', 'Sim', 'Bienal'],
          ['Operador de empilhadeira', 'Operar e inspecionar o equipamento', 'NR-11', 'Sim', 'Conforme NR'],
          ['Equipe de limpeza da cabine', 'Entrar em espaço confinado', 'NR-33', 'Sim', 'Anual'],
          ['Brigadista', 'Combate a princípio de incêndio e evacuação', 'Brigada', 'Sim', 'Anual'],
          ['Membro da CIPA', 'Identificar risco e investigar incidente', 'Curso da CIPA', 'Sim', 'Por mandato'],
        ],
        linhas: 14,
      },
      { tipo: 'secao', texto: 'Lacunas — quem precisa e ainda não tem' },
      {
        tipo: 'tabela',
        colunas: ['Pessoa', 'Função', 'Treinamento que falta', 'Situação', 'Prazo'],
        exemplos: [
          ['Rita Nunes', 'Montadora', 'NR-35', 'Nunca fez', 'jul/2027'],
          ['Elias Pinto', 'Soldador', 'NR-33', 'Venceu em 03/2027', 'jun/2027'],
        ],
        linhas: 10,
      },
      {
        tipo: 'nota',
        texto:
          'Cadastre os treinamentos e as validades em Certificados, no portal. O aviso de ' +
          'vencimento passa a chegar sozinho, em 90, 30 e 7 dias — que é o que impede a ' +
          'surpresa na auditoria.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-ordem-de-servico.docx',
    rotulo: 'o modelo de ordem de serviço',
    norma: '45001',
    etapa: 9,
    atividade: 3,
    blocos: [
      ...sso('Ordem de serviço de segurança', 'SSO-28'),
      {
        tipo: 'texto',
        texto:
          'Exigência da NR-01 e evidência direta do requisito 7.3: é como a empresa informa ' +
          'ao trabalhador, por escrito, os riscos da função dele.',
      },
      {
        tipo: 'nota',
        texto:
          'Gere uma por função, puxando os riscos do inventário da etapa 5. Se a ordem de ' +
          'serviço não bater com o inventário, um dos dois está errado — e os dois são seus.',
      },
      { tipo: 'campo', rotulo: 'Função', exemplo: 'Soldador' },
      { tipo: 'campo', rotulo: 'Área', exemplo: 'Fábrica — setor de solda' },
      { tipo: 'secao', texto: 'Riscos da sua função' },
      {
        tipo: 'tabela',
        colunas: ['Risco', 'O que pode causar', 'Como a empresa controla', 'O que você precisa fazer'],
        exemplos: [
          ['Fumos metálicos', 'Doença respiratória', 'Exaustão na fonte', 'Trabalhar com a captação ligada'],
          ['Radiação do arco', 'Lesão ocular', 'Máscara automática e biombo', 'Usar máscara e fechar o biombo'],
          ['Ruído', 'Perda auditiva', 'Protetor auricular', 'Usar durante todo o turno'],
          ['Queimadura', 'Lesão de pele', 'Vestimenta de raspa', 'Usar manga e avental'],
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'O que a empresa espera de você' },
      {
        tipo: 'texto',
        texto:
          'Usar o EPI fornecido · seguir a instrução de trabalho · comunicar condição ' +
          'insegura e quase-acidente · comparecer aos treinamentos e exames · interromper a ' +
          'tarefa que considerar insegura.',
      },
      { tipo: 'secao', texto: 'Seu direito' },
      {
        tipo: 'texto',
        texto:
          'Você pode se afastar de uma situação de perigo grave e iminente e não será ' +
          'prejudicado por isso.',
      },
      { tipo: 'secao', texto: 'Ciência' },
      { tipo: 'campo', rotulo: 'Nome', exemplo: 'Elias Pinto' },
      { tipo: 'campo', rotulo: 'Data' },
      { tipo: 'campo', rotulo: 'Assinatura' },
      {
        tipo: 'nota',
        texto: 'Guarde a via assinada na pasta da pessoa. É a evidência mais simples do 7.3.',
      },
    ],
  },
  {
    arquivo: 'sso-matriz-de-comunicacao.docx',
    rotulo: 'a matriz de comunicação',
    norma: '45001',
    etapa: 9,
    atividade: 4,
    blocos: [
      ...sso('Matriz de comunicação', 'SSO-29'),
      {
        tipo: 'texto',
        texto:
          'O que a empresa comunica sobre SSO, quando, a quem e como — considerando quem ' +
          'recebe. Comunicado em português técnico para equipe que não lê bem não comunica ' +
          'nada.',
      },
      { tipo: 'secao', texto: 'Comunicação interna' },
      {
        tipo: 'tabela',
        colunas: ['O que', 'Para quem', 'Quando', 'Por onde', 'Quem é responsável'],
        exemplos: [
          ['Política de SSO', 'Todos', 'Na admissão e a cada revisão', 'Integração e quadro', 'SSO'],
          ['Indicadores do mês', 'Todos', 'Mensal', 'Quadro e DDS', 'SSO'],
          ['Resultado da consulta', 'Quem apontou e a área', 'Até 15 dias', 'DDS e quadro', 'SSO'],
          ['Acidente ocorrido e o que mudou', 'Todos', 'Até 7 dias', 'DDS de todas as áreas', 'SSO'],
          ['Mudança que afeta a segurança', 'Área afetada', 'Antes da mudança', 'Reunião da área', 'Supervisão'],
        ],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Comunicação externa' },
      {
        tipo: 'tabela',
        colunas: ['Com quem', 'O que', 'Quando', 'Quem fala pela empresa'],
        exemplos: [
          ['Fiscalização do trabalho', 'O que for solicitado', 'Na fiscalização', 'Direção, com apoio do SSO'],
          ['Cliente', 'Indicadores de SSO do contrato', 'Trimestral', 'Comercial, com dado do SSO'],
          ['Sindicato', 'Cumprimento do acordo coletivo', 'Anual', 'RH'],
          ['Vizinhança', 'Plano de emergência e ponto de contato', 'Na revisão do plano', 'Direção'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Quem recebe — adaptações' },
      {
        tipo: 'campo',
        rotulo: 'Turno da noite',
        exemplo: 'Mesma comunicação, repetida na reunião das 22h',
      },
      {
        tipo: 'campo',
        rotulo: 'Quem tem dificuldade de leitura',
        exemplo: 'Comunicação verbal no DDS, com cartaz ilustrado no quadro',
      },
      {
        tipo: 'campo',
        rotulo: 'Trabalhadores de contratadas',
        exemplo: 'Pelo representante da contratada e no quadro do pátio',
      },
      { tipo: 'secao', texto: 'Acidente grave — quem fala' },
      {
        tipo: 'campo',
        rotulo: 'Porta-voz único',
        exemplo: 'Carlos Menezes — Diretor Industrial. Ninguém mais fala com imprensa ou família.',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 10 =====================
  {
    arquivo: 'sso-infraestrutura.docx',
    rotulo: 'o levantamento de infraestrutura',
    norma: '45001',
    etapa: 10,
    atividade: 1,
    blocos: [
      ...sso('Levantamento de infraestrutura', 'SSO-30'),
      {
        tipo: 'texto',
        texto:
          'A conferência física do que o inventário apontou. Costuma produzir a lista de ' +
          'obras do projeto — e é melhor descobrir agora do que na auditoria.',
      },
      {
        tipo: 'tabela',
        colunas: ['Item', 'Local', 'Condição hoje', 'Está no inventário de riscos?', 'Ação'],
        exemplos: [
          ['Instalação elétrica', 'Fábrica', 'Painel sem identificação e sem travamento', 'Sim', 'Adequar à NR-10'],
          ['Proteção de máquina', 'Guilhotina e esmeril', 'Proteção removida pela operação', 'Sim', 'Reinstalar e travar'],
          ['Exaustão', 'Setor de solda', 'Parada desde 2025', 'Sim', 'Recuperar — já no plano'],
          ['Iluminação', 'Pátio', 'Insuficiente no turno da noite', 'Não — incluir', 'Medir e adequar'],
          ['Piso', 'Corredor da fábrica', 'Irregular, com poça de óleo', 'Não — incluir', 'Reparo e contenção'],
          ['Sanitários e vestiário', 'Fábrica', 'Adequados', 'Não se aplica', 'Manter'],
          ['Refeitório', 'Administrativo', 'Adequado', 'Não se aplica', 'Manter'],
          ['Área de descanso', 'Pátio', 'Não existe', 'Sim — risco de calor', 'Instalar ponto coberto'],
        ],
        linhas: 14,
      },
      {
        tipo: 'nota',
        texto:
          'Perigo de instalação precisa aparecer nos dois documentos. Item encontrado aqui e ' +
          'ausente do inventário significa que o levantamento da etapa 5 passou por cima.',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 11 =====================
  {
    arquivo: 'sso-cenarios-de-emergencia.docx',
    rotulo: 'a planilha de cenários de emergência',
    norma: '45001',
    etapa: 11,
    atividade: 2,
    blocos: [
      ...sso('Cenários de emergência', 'SSO-31'),
      {
        tipo: 'texto',
        texto:
          'Cenário de emergência não se inventa: ele sai do inventário de riscos. Onde há ' +
          'inflamável, incêndio; onde há altura, queda com vítima suspensa; onde há espaço ' +
          'confinado, resgate.',
      },
      {
        tipo: 'tabela',
        colunas: ['Cenário', 'De onde vem', 'Onde pode ocorrer', 'Gravidade', 'Probabilidade'],
        exemplos: [
          ['Incêndio na área de solda', 'Inventário — inflamável próximo', 'Fábrica', 'Alta', 'Possível'],
          ['Queda com vítima suspensa no cinto', 'Inventário — trabalho em altura', 'Pátio', 'Catastrófica', 'Pouco provável'],
          ['Vítima inconsciente em espaço confinado', 'Inventário — limpeza da cabine', 'Fábrica', 'Catastrófica', 'Pouco provável'],
          ['Atropelamento por empilhadeira', 'Inventário — rota não separada', 'Pátio', 'Alta', 'Possível'],
          ['Choque elétrico em manutenção', 'Inventário — painel sem travamento', 'Fábrica', 'Catastrófica', 'Possível'],
          ['Exaustão térmica no pátio', 'Contexto — calor extremo', 'Pátio', 'Moderada', 'Provável no verão'],
          ['Incêndio na vizinhança', 'Externo', 'Divisa leste', 'Alta', 'Raro'],
          ['Falta de energia prolongada', 'Externo', 'Toda a planta', 'Baixa', 'Possível'],
        ],
        linhas: 12,
      },
      {
        tipo: 'nota',
        texto:
          'Inclua os cenários externos — vizinhança, energia, clima. O plano que só cobre o ' +
          'que nasce dentro da planta deixa a empresa de fora no dia do evento climático.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'sso-plano-de-emergencia.docx',
    rotulo: 'o plano de resposta a emergências',
    norma: '45001',
    etapa: 11,
    atividade: 3,
    blocos: [
      ...sso('Plano de resposta a emergências', 'SSO-32'),
      {
        tipo: 'nota',
        texto:
          'Escreva curto: uma página por cenário, com telefone, rota e nome de quem decide. ' +
          'Plano de quarenta páginas não é lido no dia do incêndio.',
      },
      { tipo: 'secao', texto: 'Comum a todos os cenários' },
      { tipo: 'campo', rotulo: 'Sinal de alarme', exemplo: 'Sirene contínua por 30 segundos' },
      { tipo: 'campo', rotulo: 'Ponto de encontro', exemplo: 'Estacionamento externo, junto ao portão 2' },
      {
        tipo: 'campo',
        rotulo: 'Quem comanda a emergência',
        exemplo: 'Coordenador da brigada; na ausência, o supervisor de turno',
      },
      {
        tipo: 'campo',
        rotulo: 'Quem aciona os serviços externos',
        exemplo: 'Portaria — Bombeiros 193, SAMU 192, concessionária de energia 0800-000-0000',
      },
      {
        tipo: 'campo',
        rotulo: 'Como terceirizados e visitantes são alertados e conduzidos',
        exemplo:
          'Brigadista da área acompanha o grupo até o ponto de encontro; a lista de ' +
          'visitantes da portaria é conferida na chamada',
      },
      { tipo: 'secao', texto: 'Resposta por cenário' },
      { tipo: 'campo', rotulo: 'Cenário', exemplo: 'Incêndio na área de solda' },
      {
        tipo: 'tabela',
        colunas: ['Passo', 'O que fazer', 'Quem'],
        exemplos: [
          ['1', 'Acionar o alarme e cortar o gás da bancada', 'Quem identificar'],
          ['2', 'Combater com extintor de CO2 se for princípio', 'Brigadista da área'],
          ['3', 'Evacuar pela rota leste até o ponto de encontro', 'Todos'],
          ['4', 'Conferir a chamada, incluindo terceiros e visitantes', 'Coordenador da brigada'],
          ['5', 'Acionar os Bombeiros', 'Portaria'],
          ['6', 'Liberar o retorno só após vistoria', 'Coordenador da brigada'],
        ],
        linhas: 8,
      },
      {
        tipo: 'nota',
        texto: 'Repita esta página para cada cenário da planilha anterior.',
      },
      { tipo: 'secao', texto: 'Comunicação às partes interessadas' },
      {
        tipo: 'tabela',
        colunas: ['Quem', 'O que recebe', 'Quando'],
        exemplos: [
          ['Corpo de Bombeiros', 'Cópia do plano e planta de risco', 'A cada revisão'],
          ['Empresa vizinha', 'Ponto de contato e cenários que podem atingi-la', 'A cada revisão'],
          ['Contratadas', 'Rota, ponto de encontro e sinal de alarme', 'Na integração'],
        ],
        linhas: 5,
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 12 =====================
  {
    arquivo: 'sso-indicadores.docx',
    rotulo: 'o painel de indicadores de SSO',
    norma: '45001',
    etapa: 12,
    atividade: 2,
    blocos: [
      ...sso('Painel de indicadores de SSO', 'SSO-33'),
      {
        tipo: 'nota',
        texto:
          'Quem mede só acidente ensina a equipe a não reportar: os números ficam ótimos e o ' +
          'risco fica igual. Misture indicadores que antecipam com os de resultado.',
      },
      { tipo: 'secao', texto: 'Indicadores de antecipação' },
      {
        tipo: 'tabela',
        colunas: ['Indicador', 'Como se calcula', 'Meta', 'Frequência', 'Quem apura'],
        exemplos: [
          ['Quase-acidentes reportados', 'Contagem no período', 'Mínimo de 8/mês', 'Mensal', 'SSO'],
          ['Desvios corrigidos no prazo', 'Corrigidos no prazo ÷ total × 100', 'Acima de 90%', 'Mensal', 'SSO'],
          ['Inspeções realizadas', 'Realizadas ÷ programadas × 100', '100%', 'Mensal', 'SSO'],
          ['Treinamentos de NR em dia', 'Em dia ÷ exigidos × 100', '100%', 'Mensal', 'RH'],
          ['Ações do plano concluídas', 'Concluídas ÷ previstas no período × 100', 'Acima de 85%', 'Mensal', 'SSO'],
        ],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Indicadores de resultado' },
      {
        tipo: 'texto',
        texto:
          'Escreva a fórmula que a empresa vai usar e não mude no meio do ano — existe mais ' +
          'de uma convenção, e trocar destrói a comparação.',
      },
      {
        tipo: 'tabela',
        colunas: ['Indicador', 'Fórmula adotada', 'Meta', 'Frequência'],
        exemplos: [
          [
            'Taxa de frequência',
            'Acidentes com afastamento × 1.000.000 ÷ homens-hora trabalhadas',
            'Abaixo de 5,0',
            'Mensal e acumulada no ano',
          ],
          [
            'Taxa de gravidade',
            'Dias perdidos e debitados × 1.000.000 ÷ homens-hora trabalhadas',
            'Abaixo de 100',
            'Mensal e acumulada no ano',
          ],
          ['Acidentes sem afastamento', 'Contagem no período', 'Tendência de queda', 'Mensal'],
          ['Dias perdidos', 'Soma dos dias de afastamento', 'Tendência de queda', 'Mensal'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Ligação com os objetivos' },
      {
        tipo: 'campo',
        rotulo: 'Indicador que não serve a nenhum objetivo',
        exemplo: 'Nenhum — todos estão ligados aos objetivos da etapa 3',
      },
      {
        tipo: 'campo',
        rotulo: 'Onde o painel é publicado para os trabalhadores',
        exemplo: 'Quadro da fábrica e quadro do pátio, atualizado até o dia 5',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 13 =====================
  {
    arquivo: 'sso-investigacao-de-incidentes.docx',
    rotulo: 'o procedimento de investigação de incidentes',
    norma: '45001',
    etapa: 13,
    atividade: 2,
    blocos: [
      ...sso('Procedimento de investigação de incidentes', 'SSO-34'),
      { tipo: 'secao', texto: '1. O que é comunicado, por quem e em quanto tempo' },
      {
        tipo: 'tabela',
        colunas: ['Ocorrência', 'Prazo para comunicar', 'A quem', 'Quem investiga'],
        exemplos: [
          ['Acidente com afastamento', 'Imediato', 'SSO, direção e RH', 'SSO + área + CIPA'],
          ['Acidente sem afastamento', 'Mesmo turno', 'SSO e supervisor', 'SSO + área'],
          ['Quase-acidente', 'Mesmo turno', 'Supervisor', 'Supervisor + trabalhador'],
          ['Desvio de inspeção', '24 horas', 'SSO', 'Área'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: '2. Quem participa' },
      {
        tipo: 'texto',
        texto:
          'A investigação é um dos assuntos reservados à participação dos trabalhadores ' +
          '(requisito 5.4). Investigação feita só por técnico atrás da mesa não cumpre o ' +
          'requisito — e também não descobre nada.',
      },
      {
        tipo: 'campo',
        rotulo: 'Composição da equipe de investigação',
        exemplo:
          'Coordenação de SSO, supervisor da área, um trabalhador da área envolvida e, nos ' +
          'acidentes com afastamento, um membro da CIPA',
      },
      { tipo: 'secao', texto: '3. Método de análise de causa-raiz' },
      {
        tipo: 'campo',
        rotulo: 'Método adotado',
        exemplo: 'Cinco porquês, com árvore de causas nos acidentes com afastamento',
      },
      {
        tipo: 'nota',
        texto:
          '"Falta de atenção do colaborador" não é causa-raiz: é o ponto onde a investigação ' +
          'preguiçosa para. Se o seu último porquê é sobre a pessoa, falta um porquê.',
      },
      { tipo: 'secao', texto: '4. A ação e a hierarquia de controles' },
      {
        tipo: 'campo',
        rotulo: 'Regra',
        exemplo:
          'Toda ação é avaliada pela hierarquia de controles. Ação que termina em "reforçar ' +
          'o treinamento" só é aceita com justificativa escrita de por que os níveis acima ' +
          'não eram viáveis.',
      },
      { tipo: 'secao', texto: '5. Verificação de eficácia' },
      {
        tipo: 'tabela',
        colunas: ['Quem verifica', 'Quando', 'Com que evidência'],
        exemplos: [
          [
            'Coordenação de SSO',
            '60 dias após a conclusão da ação',
            'Inspeção no local e ausência de recorrência registrada',
          ],
        ],
        linhas: 3,
      },
      { tipo: 'secao', texto: '6. Onde o mesmo problema pode existir' },
      {
        tipo: 'campo',
        rotulo: 'Regra',
        exemplo:
          'Toda investigação responde: isto pode acontecer em outra área, outro turno ou ' +
          'outra máquina? Se sim, a ação alcança as duas.',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 14 =====================
  {
    arquivo: 'sso-programa-de-melhoria.docx',
    rotulo: 'o programa de melhoria contínua',
    norma: '45001',
    etapa: 14,
    atividade: 2,
    blocos: [
      ...sso('Programa de melhoria contínua', 'SSO-35'),
      {
        tipo: 'texto',
        texto:
          'Melhoria contínua não é uma reunião: é um conjunto de entradas que já existem e ' +
          'precisam ter para onde ir.',
      },
      { tipo: 'secao', texto: 'As entradas e o destino de cada uma' },
      {
        tipo: 'tabela',
        colunas: ['Entrada', 'De onde vem', 'Quem analisa', 'Com que frequência'],
        exemplos: [
          ['Quase-acidentes reportados', 'Canal de reporte', 'SSO', 'Semanal'],
          ['Desvios de inspeção', 'Inspeções no portal', 'SSO e supervisão', 'Mensal'],
          ['Investigações concluídas', 'Procedimento de incidentes', 'SSO e CIPA', 'A cada caso'],
          ['Apontamentos da consulta', 'Canais do requisito 5.4', 'SSO', 'Mensal'],
          ['Relatório do simulado', 'Etapa 11', 'Brigada e SSO', 'A cada simulado'],
          ['Indicadores fora da meta', 'Painel', 'SSO e direção', 'Mensal'],
          ['Constatações de auditoria', 'Auditoria interna e externa', 'SSO', 'A cada auditoria'],
          ['Mudança legal', 'Matriz de requisitos legais', 'SSO', 'Trimestral'],
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Como os trabalhadores participam da implementação' },
      {
        tipo: 'campo',
        rotulo: 'De que forma',
        exemplo:
          'Quem apontou participa da definição da ação; a CIPA acompanha a execução e ' +
          'confere o resultado na reunião mensal',
      },
      { tipo: 'secao', texto: 'Como o resultado volta para quem trabalha' },
      {
        tipo: 'texto',
        texto:
          'Esta é a parte que quase ninguém faz. A empresa melhora, mede, leva o número para ' +
          'a diretoria — e o operador que apontou o problema nunca fica sabendo que mudou ' +
          'alguma coisa. Da próxima vez ele não aponta.',
      },
      {
        tipo: 'tabela',
        colunas: ['O que é devolvido', 'Para quem', 'Por onde', 'Quando'],
        exemplos: [
          ['O que foi feito com cada apontamento', 'Quem apontou e a área', 'DDS e quadro', 'Até 15 dias'],
          ['O que mudou depois de um acidente', 'Todas as áreas', 'DDS', 'Até 7 dias'],
          ['Resultado dos indicadores', 'Todos', 'Quadro', 'Mensal'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Cultura de SSO' },
      {
        tipo: 'campo',
        rotulo: 'O que a empresa fará este ano para fortalecer a cultura',
        exemplo:
          'Reconhecer publicamente quem reporta quase-acidente; direção na linha uma vez por ' +
          'mês; nenhuma punição por reporte, reafirmada na integração',
      },
      ...aprovacao(),
    ],
  },
]
