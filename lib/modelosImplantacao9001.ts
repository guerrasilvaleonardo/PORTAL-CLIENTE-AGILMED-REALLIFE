import { type ModeloDoc, aprovacao, cabeca } from './modelosImplantacaoBase'

/*
 * Os modelos da trilha da ISO 9001:2026.
 *
 * Os porques — por que vem preenchido com exemplo, por que o exemplo
 * vem marcado, por que todo modelo carrega cabecalho controlado —
 * estao em ./modelosImplantacaoBase.ts, que as duas normas dividem.
 * Aqui ficam so os documentos da qualidade; os de SSO estao em
 * ./modelosImplantacao45001.ts.
 */

export const MODELOS_9001: ModeloDoc[] = [
  // ===================== Etapa 1 =====================
  {
    arquivo: 'ficha-do-interlocutor.docx',
    rotulo: 'a ficha do interlocutor',
    norma: '9001',
    etapa: 1,
    atividade: 1,
    blocos: [
      ...cabeca('Ficha do interlocutor', 'Implantação do SGQ — ISO 9001:2026', 'IMP-01'),
      { tipo: 'secao', texto: 'Quem conduz a implantação' },
      {
        tipo: 'texto',
        texto:
          'Não precisa ser o dono nem alguém da qualidade. Precisa ser quem consegue abrir ' +
          'portas internamente e tem horas livres na semana.',
      },
      { tipo: 'campo', rotulo: 'Nome', exemplo: 'Ana Ribeiro' },
      { tipo: 'campo', rotulo: 'Cargo', exemplo: 'Coordenadora da Qualidade' },
      { tipo: 'campo', rotulo: 'E-mail', exemplo: 'ana.ribeiro@exemplo.com.br' },
      { tipo: 'campo', rotulo: 'Telefone', exemplo: '(69) 99999-0000' },
      {
        tipo: 'campo',
        rotulo: 'Horas por semana dedicadas à implantação',
        exemplo: '6 horas — terças e quintas à tarde',
      },
      { tipo: 'nota', texto: 'Seja realista, não otimista. Prazo combinado com hora que não existe atrasa a trilha inteira.' },
      { tipo: 'secao', texto: 'Substituto' },
      { tipo: 'texto', texto: 'Quem responde em férias, licença ou viagem.' },
      { tipo: 'campo', rotulo: 'Nome e cargo', exemplo: 'Pedro Alves — Supervisor de Produção' },
      { tipo: 'campo', rotulo: 'E-mail', exemplo: 'pedro.alves@exemplo.com.br' },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'equipe-do-sgq.docx',
    rotulo: 'a lista da equipe do SGQ',
    norma: '9001',
    etapa: 1,
    atividade: 2,
    blocos: [
      ...cabeca('Equipe do sistema de gestão', 'Implantação do SGQ — ISO 9001:2026', 'IMP-02'),
      {
        tipo: 'texto',
        texto:
          'Uma pessoa por área. É a esta lista que vamos recorrer para marcar as reuniões e ' +
          'para saber a quem cobrar cada entrega.',
      },
      {
        tipo: 'tabela',
        colunas: ['Área', 'Nome', 'Cargo', 'E-mail', 'Já participou de certificação?'],
        exemplos: [
          ['Comercial', 'Marina Costa', 'Gerente Comercial', 'marina@exemplo.com.br', 'Não'],
          ['Produção', 'Pedro Alves', 'Supervisor', 'pedro@exemplo.com.br', 'Sim — ISO 9001 em 2019'],
        ],
        linhas: 10,
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'plano-de-investimento.docx',
    rotulo: 'o plano de investimento',
    norma: '9001',
    etapa: 1,
    atividade: 4,
    blocos: [
      ...cabeca('Plano de investimento da certificação', 'Implantação do SGQ — ISO 9001:2026', 'IMP-03'),
      {
        tipo: 'texto',
        texto:
          'Certificar custa dinheiro em três frentes. Quem descobre a terceira no fim trava o ' +
          'projeto a dois meses do final — por isso a direção aprova o investimento inteiro agora.',
      },
      { tipo: 'secao', texto: '1. Consultoria e acompanhamento' },
      {
        tipo: 'tabela',
        colunas: ['Item', 'Valor', 'Quando'],
        exemplos: [['Acompanhamento da implantação', 'R$ 0.000,00', 'mensal, 10 meses']],
        linhas: 3,
      },
      { tipo: 'secao', texto: '2. Adequações internas' },
      {
        tipo: 'texto',
        texto: 'Calibração de instrumentos, treinamento, software, obra, sinalização, EPI.',
      },
      {
        tipo: 'tabela',
        colunas: ['O que', 'Por que é necessário', 'Valor', 'Prazo'],
        exemplos: [
          ['Calibração de 6 paquímetros', 'Requisito 7.1.5 — recursos de medição', 'R$ 0.000,00', 'até 04/2026'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: '3. Organismo certificador' },
      {
        tipo: 'tabela',
        colunas: ['Item', 'Valor', 'Quando'],
        exemplos: [
          ['Auditoria fase 1', 'R$ 0.000,00', '09/2026'],
          ['Auditoria fase 2', 'R$ 0.000,00', '11/2026'],
          ['Manutenção anual', 'R$ 0.000,00', 'a partir de 2027'],
        ],
        linhas: 4,
      },
      { tipo: 'secao', texto: 'Data-alvo da certificação' },
      { tipo: 'campo', rotulo: 'Auditoria de certificação prevista para', exemplo: 'novembro de 2026' },
      {
        tipo: 'nota',
        texto:
          'Trabalhe de trás para frente a partir desta data: a auditoria interna precisa ' +
          'acontecer antes, e ela precisa de sistema rodando há alguns meses para ter o que auditar.',
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 2 =====================
  {
    arquivo: 'procedimento-informacao-documentada.docx',
    rotulo: 'o Procedimento de Controle da Informação Documentada',
    norma: '9001',
    etapa: 2,
    atividade: 2,
    blocos: [
      ...cabeca(
        'Procedimento — Controle da Informação Documentada',
        'Requisito 7.5 · ISO 9001:2026',
        'PRO-01'
      ),
      { tipo: 'secao', texto: '1. Objetivo' },
      {
        tipo: 'texto',
        texto:
          'Definir como os documentos e registros do sistema de gestão da qualidade são ' +
          'criados, identificados, aprovados, distribuídos, alterados, guardados e descartados.',
      },
      { tipo: 'secao', texto: '2. Abrangência' },
      {
        tipo: 'texto',
        texto: 'Aplica-se a todos os documentos e registros do SGQ, em qualquer meio.',
      },
      { tipo: 'secao', texto: '3. Como um documento nasce' },
      {
        tipo: 'tabela',
        colunas: ['Etapa', 'Quem faz', 'O que fica registrado'],
        exemplos: [
          ['Redação', 'Responsável da área', 'Rascunho na pasta de trabalho'],
          ['Análise crítica', 'Coordenação da Qualidade', 'Comentários no próprio arquivo'],
          ['Aprovação', 'Direção', 'Assinatura no rodapé e data'],
          ['Publicação', 'Coordenação da Qualidade', 'Registro na lista mestra'],
        ],
        linhas: 4,
      },
      { tipo: 'secao', texto: '4. Identificação' },
      {
        tipo: 'texto',
        texto:
          'Todo documento do SGQ traz, no cabeçalho: título, código, número da revisão e data ' +
          'de aprovação. O código segue o formato XXX-00, onde as letras indicam o tipo.',
      },
      {
        tipo: 'tabela',
        colunas: ['Tipo', 'Sigla', 'Exemplo'],
        exemplos: [
          ['Procedimento', 'PRO', 'PRO-01'],
          ['Instrução de trabalho', 'IT', 'IT-03'],
          ['Formulário', 'FOR', 'FOR-12'],
          ['Registro da implantação', 'IMP', 'IMP-01'],
        ],
        linhas: 4,
      },
      { tipo: 'secao', texto: '5. Revisão e alteração' },
      {
        tipo: 'texto',
        texto:
          'Toda alteração sobe o número da revisão e é registrada na tabela de histórico do ' +
          'próprio documento. A versão anterior sai de circulação no mesmo dia.',
      },
      { tipo: 'secao', texto: '6. Onde fica guardado e por quanto tempo' },
      {
        tipo: 'tabela',
        colunas: ['Tipo', 'Onde', 'Tempo de guarda', 'Descarte'],
        exemplos: [
          ['Procedimentos', 'Pasta SGQ / 07 - Apoio', 'enquanto vigente + 3 anos', 'Exclusão pela Qualidade'],
          ['Registros de produção', 'Pasta SGQ / 08 - Operação', '5 anos', 'Fragmentação'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: '7. Backup e proteção' },
      { tipo: 'campo', rotulo: 'Onde o backup é feito', exemplo: 'Nuvem corporativa, sincronização automática' },
      { tipo: 'campo', rotulo: 'Com que frequência', exemplo: 'Contínua, com histórico de 30 dias' },
      { tipo: 'campo', rotulo: 'Quem confere se está funcionando, e quando', exemplo: 'TI — teste de restauração trimestral' },
      {
        tipo: 'nota',
        texto:
          'Ajuste os itens 6 e 7 para a realidade da empresa. Prazo de guarda copiado de modelo, ' +
          'que ninguém cumpre, é pior do que prazo curto que se cumpre.',
      },
      { tipo: 'secao', texto: '8. Documentos de origem externa' },
      {
        tipo: 'texto',
        texto:
          'Normas, legislação e manuais de fornecedor usados no SGQ são identificados na lista ' +
          'mestra e têm a versão controlada da mesma forma.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'mapa-de-processos.docx',
    rotulo: 'o mapa de processos',
    norma: '9001',
    etapa: 2,
    atividade: 3,
    blocos: [
      ...cabeca('Mapa dos processos', 'Requisito 4.4 · ISO 9001:2026', 'IMP-04'),
      {
        tipo: 'texto',
        texto:
          'Liste os processos que existem de fato, não os que deveriam existir. É por este mapa ' +
          'que o auditor decide o que vai auditar.',
      },
      {
        tipo: 'tabela',
        colunas: ['Processo', 'Tipo', 'Recebe de', 'Entrega para', 'Toca o cliente?'],
        exemplos: [
          ['Comercial', 'Principal', 'Mercado', 'Planejamento', 'Sim'],
          ['Compras', 'Apoio', 'Planejamento', 'Produção', 'Não'],
          ['Produção', 'Principal', 'Planejamento, Compras', 'Expedição', 'Não'],
        ],
        linhas: 12,
      },
      { tipo: 'secao', texto: 'Desenho' },
      {
        tipo: 'texto',
        texto:
          'Cole aqui o desenho de uma página com as setas entre os processos. Pode ser feito à ' +
          'mão e fotografado — o que importa é que as ligações fiquem visíveis.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'lista-mestra.docx',
    rotulo: 'a lista mestra',
    norma: '9001',
    etapa: 2,
    atividade: 4,
    blocos: [
      ...cabeca('Lista mestra de documentos e registros', 'Requisito 7.5.3 · ISO 9001:2026', 'IMP-05'),
      {
        tipo: 'texto',
        texto:
          'Sem esta lista, a resposta para "qual é a versão válida?" vira memória de uma pessoa ' +
          'só — e essa pessoa sai de férias.',
      },
      {
        tipo: 'tabela',
        colunas: ['Documento', 'Código', 'Rev.', 'Aprovado em', 'Onde fica', 'Guarda'],
        exemplos: [
          ['Controle da Informação Documentada', 'PRO-01', '00', '12/03/2026', 'SGQ / 07 - Apoio', 'vigente + 3 anos'],
          ['Mapa dos processos', 'IMP-04', '00', '12/03/2026', 'SGQ / 04 - Contexto', 'vigente + 3 anos'],
        ],
        linhas: 20,
      },
      { tipo: 'campo', rotulo: 'Quem mantém esta lista atualizada', exemplo: 'Ana Ribeiro — Coordenadora da Qualidade' },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 3 =====================
  {
    arquivo: 'analise-de-contexto.docx',
    rotulo: 'a análise de contexto',
    norma: '9001',
    etapa: 3,
    atividade: 1,
    blocos: [
      ...cabeca('Análise do negócio e contexto', 'Requisito 4.1 · ISO 9001:2026', 'IMP-06'),
      {
        tipo: 'texto',
        texto:
          'Não é redação. É a lista das coisas que tiram o sono da direção — e ela vira a ' +
          'matéria-prima dos riscos mais adiante nesta etapa.',
      },
      { tipo: 'secao', texto: 'Questões externas' },
      {
        tipo: 'tabela',
        colunas: ['Questão', 'Hoje ajuda ou atrapalha?', 'Por quê'],
        exemplos: [
          ['Concorrência de fora do estado', 'Atrapalha', 'Preço menor em pedidos grandes'],
          ['Exigência de certificação por clientes', 'Ajuda', 'Abre licitações que hoje não podemos disputar'],
        ],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Questões internas' },
      {
        tipo: 'tabela',
        colunas: ['Questão', 'Hoje ajuda ou atrapalha?', 'Por quê'],
        exemplos: [
          ['Equipe antiga e experiente', 'Ajuda', 'Pouco retrabalho na produção'],
          ['Nada documentado', 'Atrapalha', 'O conhecimento sai pela porta junto com a pessoa'],
        ],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Mudança climática' },
      {
        tipo: 'texto',
        texto:
          'A norma exige que a empresa determine se a mudança climática é questão relevante ' +
          'para o seu contexto. A pergunta é obrigatória; a resposta pode ser não — mas precisa ' +
          'estar escrita.',
      },
      {
        tipo: 'campo',
        rotulo: 'É questão relevante para esta empresa?',
        exemplo: 'Sim — estiagem afeta a estrada que escoa a produção entre agosto e outubro',
      },
      { tipo: 'campo', rotulo: 'Se sim, o que entra como risco' },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'partes-interessadas.docx',
    rotulo: 'o levantamento de partes interessadas',
    norma: '9001',
    etapa: 3,
    atividade: 3,
    blocos: [
      ...cabeca('Partes interessadas e suas exigências', 'Requisito 4.2 · ISO 9001:2026', 'IMP-07'),
      {
        tipo: 'texto',
        texto:
          'Quem tem interesse no que a empresa faz, e o que cada um exige — porque é isso que ' +
          'vira requisito do sistema.',
      },
      {
        tipo: 'tabela',
        colunas: ['Parte interessada', 'O que exige', 'É exigência legal?', 'Como atendemos hoje'],
        exemplos: [
          ['Cliente', 'Prazo de entrega cumprido', 'Não', 'Acompanhamento semanal da carteira'],
          ['Órgão ambiental', 'Licença de operação vigente', 'Sim', 'Renovação anual pelo jurídico'],
          ['Colaboradores', 'Ambiente seguro e salário em dia', 'Sim', 'PGR e folha em dia'],
        ],
        linhas: 10,
      },
      {
        tipo: 'nota',
        texto:
          'Marque as exigências legais: elas reaparecem na etapa 5, no levantamento da legislação.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'escopo-do-sgq.docx',
    rotulo: 'o escopo do SGQ',
    norma: '9001',
    etapa: 3,
    atividade: 4,
    blocos: [
      ...cabeca('Escopo do sistema de gestão da qualidade', 'Requisito 4.3 · ISO 9001:2026', 'IMP-08'),
      {
        tipo: 'texto',
        texto:
          'O escopo é o que vai impresso no certificado. Largo demais obriga a auditar o que não ' +
          'precisava; estreito demais faz o certificado não servir ao cliente que você queria atender.',
      },
      { tipo: 'secao', texto: 'Declaração do escopo' },
      {
        tipo: 'campo',
        rotulo: 'O SGQ cobre',
        exemplo: 'Fabricação e montagem de estruturas metálicas sob encomenda',
      },
      { tipo: 'secao', texto: 'Endereços incluídos' },
      {
        tipo: 'tabela',
        colunas: ['Unidade', 'Endereço', 'O que é feito ali'],
        exemplos: [['Matriz', 'Av. Exemplo, 1000 — Porto Velho/RO', 'Administração e fabricação']],
        linhas: 4,
      },
      { tipo: 'secao', texto: 'Exclusões' },
      {
        tipo: 'texto',
        texto:
          'Requisito que não se aplica, com a justificativa. A exclusão mais comum é 8.3 — ' +
          'Projeto e desenvolvimento, quando a empresa executa projeto fornecido pelo cliente.',
      },
      {
        tipo: 'tabela',
        colunas: ['Requisito', 'Por que não se aplica'],
        exemplos: [['8.3', 'A empresa fabrica conforme projeto fornecido pelo cliente, sem desenvolver produto próprio']],
        linhas: 3,
      },
      { tipo: 'nota', texto: 'Exclusão que afeta a conformidade do produto não é aceita. Na dúvida, fale com a nossa equipe antes de declarar.' },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'missao-visao-valores.docx',
    rotulo: 'o documento de missão, visão e valores',
    norma: '9001',
    etapa: 3,
    atividade: 5,
    blocos: [
      ...cabeca('Missão, visão e valores', 'Apoio à política da qualidade', 'IMP-09'),
      {
        tipo: 'texto',
        texto:
          'A norma não exige. Está aqui porque a política da qualidade precisa ser coerente com ' +
          'isso — e porque quase toda empresa tem os três escritos em algum lugar, desatualizados.',
      },
      { tipo: 'campo', rotulo: 'Missão (por que a empresa existe)', exemplo: 'Entregar estrutura metálica no prazo combinado, para obras que não podem parar' },
      { tipo: 'campo', rotulo: 'Visão (onde quer chegar)', exemplo: 'Ser a primeira escolha em estrutura metálica na região Norte até 2030' },
      { tipo: 'secao', texto: 'Valores' },
      {
        tipo: 'tabela',
        colunas: ['Valor', 'O que significa na prática'],
        exemplos: [['Prazo', 'Preferimos recusar o pedido a prometer data que não cumprimos']],
        linhas: 6,
      },
      { tipo: 'nota', texto: 'Valor sem a coluna da direita é palavra de parede. A coluna da direita é o que o auditor pergunta.' },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'politica-da-qualidade.docx',
    rotulo: 'a política da qualidade',
    norma: '9001',
    etapa: 3,
    atividade: 6,
    blocos: [
      ...cabeca('Política da qualidade', 'Requisito 5.2 · ISO 9001:2026', 'POL-01'),
      {
        tipo: 'texto',
        texto:
          'Política copiada da internet se reconhece de longe: fala de "excelência" e não diz o ' +
          'que a empresa faz. O auditor pergunta a um funcionário do chão o que ela significa; se ' +
          'ninguém souber, vira constatação.',
      },
      { tipo: 'secao', texto: 'Texto da política' },
      {
        tipo: 'texto',
        texto:
          'De cinco a oito linhas. Precisa citar o que a empresa faz, o compromisso de atender ' +
          'aos requisitos do cliente e aos legais, e o compromisso de melhorar continuamente.',
      },
      {
        tipo: 'campo',
        rotulo: 'Política',
        exemplo:
          'A Metalúrgica Exemplo fabrica estruturas metálicas sob encomenda e se compromete a ' +
          'entregar no prazo acordado, atendendo aos requisitos do cliente e à legislação ' +
          'aplicável, mantendo a equipe treinada e melhorando continuamente seus processos.',
      },
      { tipo: 'secao', texto: 'Coerência' },
      {
        tipo: 'tabela',
        colunas: ['Confira', 'Onde está'],
        exemplos: [
          ['Conversa com o contexto?', 'Análise de contexto IMP-06'],
          ['Conversa com a missão?', 'IMP-09'],
          ['Serve de base para os objetivos?', 'Objetivos IMP-12'],
        ],
        linhas: 3,
      },
      { tipo: 'secao', texto: 'Como será comunicada' },
      {
        tipo: 'tabela',
        colunas: ['Meio', 'Para quem', 'Quando'],
        exemplos: [
          ['Quadro no refeitório', 'Todos', 'permanente'],
          ['Integração de novos', 'Admitidos', 'no primeiro dia'],
        ],
        linhas: 4,
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'matriz-de-responsabilidades.docx',
    rotulo: 'a matriz de responsabilidades',
    norma: '9001',
    etapa: 3,
    atividade: 7,
    blocos: [
      ...cabeca('Papéis, responsabilidades e autoridades', 'Requisito 5.3 · ISO 9001:2026', 'IMP-10'),
      {
        tipo: 'texto',
        texto: 'Atribuição que a pessoa desconhece não existe. Confirme com cada um antes de assinar.',
      },
      {
        tipo: 'tabela',
        colunas: ['O que', 'Quem responde', 'Quem substitui', 'Confirmado com a pessoa?'],
        exemplos: [
          ['Aprovar documento do SGQ', 'Diretor Industrial', 'Coordenadora da Qualidade', 'Sim — 12/03/2026'],
          ['Tratar não conformidade', 'Coordenadora da Qualidade', 'Supervisor de Produção', 'Sim — 12/03/2026'],
          ['Falar com o cliente sobre qualidade', 'Gerente Comercial', 'Diretor Industrial', 'Sim — 12/03/2026'],
        ],
        linhas: 10,
      },
      { tipo: 'secao', texto: 'Organograma' },
      { tipo: 'texto', texto: 'Cole aqui o organograma da empresa.' },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'riscos-e-oportunidades.docx',
    rotulo: 'a planilha de riscos e oportunidades',
    norma: '9001',
    etapa: 3,
    atividade: 9,
    blocos: [
      ...cabeca('Riscos e oportunidades', 'Requisitos 6.1.1, 6.1.2 e 6.1.3 · ISO 9001:2026', 'IMP-11'),
      {
        tipo: 'texto',
        texto:
          'As entradas são o que você já produziu: o contexto, a mudança climática e as partes ' +
          'interessadas. Risco que não sai de lá costuma ser risco inventado para preencher planilha.',
      },
      {
        tipo: 'tabela',
        colunas: ['Veio de', 'Risco ou oportunidade', 'R/O', 'Grav.', 'Prob.', 'Ação', 'Responsável', 'Prazo', 'Como saber se funcionou'],
        exemplos: [
          [
            'Contexto — estiagem',
            'Estrada intransitável atrasa entrega',
            'R',
            'Alta',
            'Média',
            'Antecipar carga de setembro para agosto',
            'Logística',
            '31/07/2026',
            'Nenhuma entrega atrasada por estrada na safra',
          ],
          [
            'Partes interessadas — clientes',
            'Certificação abre licitações',
            'O',
            '—',
            '—',
            'Concluir a certificação até 11/2026',
            'Direção',
            '30/11/2026',
            'Participação em 2 licitações novas até 03/2027',
          ],
        ],
        linhas: 12,
      },
      {
        tipo: 'nota',
        texto:
          'A última coluna é o 6.1.3: sem ela, a empresa trata o risco e nunca sabe se a ação ' +
          'resolveu. É a pergunta que o auditor faz na auditoria seguinte.',
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'objetivos-e-planos.docx',
    rotulo: 'os objetivos da qualidade',
    norma: '9001',
    etapa: 3,
    atividade: 10,
    blocos: [
      ...cabeca('Objetivos da qualidade e planos de ação', 'Requisito 6.2 · ISO 9001:2026', 'IMP-12'),
      {
        tipo: 'texto',
        texto:
          '"Melhorar a satisfação do cliente" não é objetivo — não dá para medir. "Chegar a 90% ' +
          'de satisfação até dezembro, medindo por pesquisa trimestral" é.',
      },
      {
        tipo: 'tabela',
        colunas: ['Objetivo', 'Meta', 'Prazo', 'Como se mede', 'De onde vem o número'],
        exemplos: [
          ['Entregar no prazo', '95% dos pedidos', '12/2026', '% de pedidos entregues na data', 'Planilha da expedição'],
          ['Reduzir retrabalho', 'abaixo de 3%', '12/2026', 'horas de retrabalho / horas totais', 'Apontamento da produção'],
        ],
        linhas: 6,
      },
      { tipo: 'secao', texto: 'Plano de cada objetivo' },
      {
        tipo: 'tabela',
        colunas: ['Objetivo', 'O que será feito', 'Com que recursos', 'Responsável', 'Prazo', 'Como avaliar'],
        exemplos: [
          [
            'Entregar no prazo',
            'Reunião semanal de carteira com produção e comercial',
            'Hora da equipe, sem custo',
            'Gerente Comercial',
            'a partir de 04/2026',
            'Indicador mensal na análise crítica',
          ],
        ],
        linhas: 8,
      },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'planejamento-de-mudancas.docx',
    rotulo: 'o formulário de planejamento de mudanças',
    norma: '9001',
    etapa: 3,
    atividade: 11,
    blocos: [
      ...cabeca('Planejamento de mudanças', 'Requisito 6.3 · ISO 9001:2026', 'FOR-01'),
      { tipo: 'secao', texto: 'Quando usar este formulário' },
      {
        tipo: 'texto',
        texto:
          'Preencha os gatilhos combinados com a direção. O que não estiver aqui não dispara o ' +
          'formulário — e o que estiver, dispara sempre.',
      },
      {
        tipo: 'tabela',
        colunas: ['Gatilho', 'Quem decide se aplica'],
        exemplos: [
          ['Processo novo ou processo que sai', 'Coordenadora da Qualidade'],
          ['Troca de sistema ou software do SGQ', 'Coordenadora da Qualidade'],
          ['Mudança de endereço ou de layout', 'Direção'],
          ['Saída de pessoa-chave do SGQ', 'Direção'],
        ],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'A mudança' },
      { tipo: 'campo', rotulo: 'O que vai mudar', exemplo: 'Troca do controle de produção em papel por planilha compartilhada' },
      { tipo: 'campo', rotulo: 'Por que', exemplo: 'O papel se perde e o dado chega tarde demais para corrigir' },
      { tipo: 'campo', rotulo: 'O que pode dar errado', exemplo: 'Equipe sem hábito de preencher; dado incompleto nas primeiras semanas' },
      { tipo: 'campo', rotulo: 'Recursos necessários', exemplo: 'Treinamento de 2 h; tablet na produção' },
      { tipo: 'campo', rotulo: 'Quem responde pela mudança', exemplo: 'Supervisor de Produção' },
      { tipo: 'campo', rotulo: 'Quando', exemplo: 'Abril de 2026' },
      { tipo: 'campo', rotulo: 'Documentos do SGQ que precisam ser revisados', exemplo: 'IT-03, FOR-12 e a lista mestra' },
      ...aprovacao(),
    ],
  },
  {
    arquivo: 'ata-analise-critica.docx',
    rotulo: 'a ata de análise crítica',
    norma: '9001',
    etapa: 3,
    atividade: 12,
    blocos: [
      ...cabeca('Ata de análise crítica pela direção', 'Requisito 9.3 · ISO 9001:2026', 'IMP-13'),
      {
        tipo: 'texto',
        texto:
          'Ata sem decisão não é análise crítica. Se a reunião terminou sem nada decidido, ou o ' +
          'sistema está perfeito, ou a reunião não aconteceu de verdade.',
      },
      { tipo: 'campo', rotulo: 'Data', exemplo: '12/03/2026' },
      { tipo: 'campo', rotulo: 'Participantes', exemplo: 'Carlos Menezes (Direção), Ana Ribeiro (Qualidade), Marina Costa (Comercial)' },
      { tipo: 'secao', texto: 'Pauta — nenhum item fica de fora' },
      {
        tipo: 'tabela',
        colunas: ['Tópico', 'O que foi apresentado'],
        exemplos: [
          ['Situação das ações da reunião anterior', 'Primeira reunião — não se aplica'],
          ['Mudanças no contexto e nas partes interessadas', 'Novo concorrente regional desde janeiro'],
          ['Desempenho: satisfação, indicadores, processos, fornecedores', 'Entrega no prazo em 88%'],
          ['Não conformidades e ações corretivas', '3 abertas, 1 encerrada'],
          ['Resultados de auditoria', 'Auditoria interna prevista para 08/2026'],
          ['Suficiência de recursos', 'Falta um inspetor de qualidade no segundo turno'],
          ['Eficácia das ações sobre riscos e oportunidades', 'Ação da estiagem ainda não testada'],
          ['Oportunidades de melhoria', 'Automatizar o apontamento da produção'],
        ],
        linhas: 8,
      },
      { tipo: 'secao', texto: 'Decisões' },
      {
        tipo: 'tabela',
        colunas: ['Decisão', 'Responsável', 'Prazo'],
        exemplos: [
          ['Contratar inspetor de qualidade para o segundo turno', 'RH', '30/05/2026'],
          ['Rever a meta de entrega no prazo para 92%', 'Direção', 'imediato'],
        ],
        linhas: 8,
      },
      ...aprovacao(),
    ],
  },

  // ===================== Etapa 4 =====================
  {
    arquivo: 'caracterizacao-de-processos.docx',
    rotulo: 'a caracterização dos processos',
    norma: '9001',
    etapa: 4,
    atividade: 1,
    blocos: [
      ...cabeca('Caracterização dos processos', 'Requisitos 4.4 e 8.1 · ISO 9001:2026', 'IMP-14'),
      {
        tipo: 'texto',
        texto:
          'Uma ficha por processo do mapa. É onde o sistema deixa de ser desenho e vira operação ' +
          '— e é o que desmascara processo fantasma: se ninguém sabe dizer o que entra e o que ' +
          'sai, aquilo não é processo, é hábito.',
      },
      { tipo: 'secao', texto: 'Ficha do processo' },
      { tipo: 'campo', rotulo: 'Processo', exemplo: 'Produção' },
      { tipo: 'campo', rotulo: 'Responsável', exemplo: 'Supervisor de Produção' },
      { tipo: 'campo', rotulo: 'Objetivo', exemplo: 'Fabricar conforme projeto e prazo acordados' },
      {
        tipo: 'tabela',
        colunas: ['Entradas', 'Vêm de'],
        exemplos: [
          ['Ordem de produção', 'Planejamento'],
          ['Matéria-prima conferida', 'Compras'],
        ],
        linhas: 5,
      },
      {
        tipo: 'tabela',
        colunas: ['Saídas', 'Vão para'],
        exemplos: [['Peça fabricada e inspecionada', 'Expedição']],
        linhas: 5,
      },
      { tipo: 'secao', texto: 'Critérios de aceitação' },
      {
        tipo: 'campo',
        rotulo: 'O que define que a saída está boa',
        exemplo: 'Medidas dentro da tolerância do projeto e solda sem descontinuidade visível',
      },
      { tipo: 'secao', texto: 'Indicador' },
      {
        tipo: 'tabela',
        colunas: ['Indicador', 'Meta', 'De onde vem o número', 'Com que frequência'],
        exemplos: [['Retrabalho', 'abaixo de 3%', 'Apontamento diário da produção', 'Mensal']],
        linhas: 3,
      },
      { tipo: 'secao', texto: 'Registro que prova que o processo rodou' },
      {
        tipo: 'campo',
        rotulo: 'Qual registro',
        exemplo: 'Ordem de produção preenchida e ficha de inspeção final',
      },
      { tipo: 'nota', texto: 'Repita esta ficha para cada processo. Comece pelos que tocam o cliente.' },
      ...aprovacao(),
    ],
  },
]
