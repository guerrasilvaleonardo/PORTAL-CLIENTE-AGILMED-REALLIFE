import type { Bloco, Manual } from './tipos'

/*
 * MANUAL DO TIME INTERNO (perfis atendimento, gestor e admin).
 * Regra do projeto: TODA alteração do portal entra no mesmo PR aqui
 * (time interno) e, se o cliente vê ou é afetado, em cliente.ts.
 */

const MENU = ['Painel', 'Atendimento', 'Estrelas', 'Chamados', 'Certificados', 'Treinamentos', 'Conversas']
const menu = (ativo: string, n?: number): Bloco => ({ t: 'menu', itens: MENU, ativo, n })

const manualInterno: Manual = {
  titulo: 'Manual do Time Interno',
  publico: 'Uso interno · Atendimento, Gestão e Administração',
  capitulos: [
    {
      id: 'visao-geral',
      titulo: 'Visão geral e perfis',
      rotas: ['/perfil'],
      slides: [
        {
          titulo: 'Para que serve o portal',
          texto:
            'O portal é onde recebemos, priorizamos e resolvemos os pedidos dos clientes das duas marcas (ÁgilMed e Real Life), com prazo medido em horas úteis, histórico completo e reconhecimento da equipe pelo Programa de Estrelas.',
          passos: [
            'Chamados entram pelo cliente (ou são abertos por nós em nome dele) e caem no Quadro de chamados.',
            'Cada chamado tem responsável, prioridade, prazo (SLA), conversas, etapas, anexos e histórico.',
            'Painel, Prioridades, Agenda e Desempenho ajudam a organizar a fila e a carga de cada um.',
            'Certificados e Treinamentos acompanham a validade e o andamento EAD dos colaboradores dos clientes.',
          ],
        },
        {
          titulo: 'Perfis de acesso',
          tela: {
            url: '/administracao/usuarios',
            blocos: [
              { t: 'tabela', colunas: ['Perfil', 'O que faz'], linhas: [['Atendimento', 'Atende chamados, transfere, muda status'], ['Gestor', '+ prioridade, empresa, feriados, estrelas'], ['Administrador', '+ gerencia outros administradores'], ['Cliente', 'Abre e acompanha os próprios chamados']] },
            ],
          },
          passos: [
            'Atendimento: trabalha a fila, conversa com o cliente, muda status, transfere chamados, cria etapas e gerencia a própria agenda.',
            'Gestor: tudo do atendimento, mais alterar prioridade, mover chamado de empresa, cadastrar feriados, editar a agenda de qualquer pessoa, decidir extensões de prazo e configurar o Programa de Estrelas.',
            'Administrador: tudo do gestor, mais criar, promover e editar administradores.',
          ],
        },
        {
          titulo: 'Menu e botão de ajuda',
          tela: { url: '/painel', blocos: [menu('Painel', 1), { t: 'topo', sobre: 'Painel central', titulo: 'Olá, Ana.' }] },
          passos: [
            'Menu da equipe: Painel, Atendimento, Estrelas, Chamados, Certificados, Treinamentos e Conversas. O botão "?" abre este manual no assunto da tela atual. Sair encerra o acesso.',
          ],
          dica: 'Meu perfil (dados e troca de senha) fica no link "Meu perfil", no topo de todas as telas. Mensagem nova em chamado seu (responsável, aberto ou solicitado por você) acende um balão vermelho na aba Atendimento; mensagem nova em Conversas acende o balão na aba Conversas.',
          link: { href: '/perfil', rotulo: 'Abrir Meu perfil' },
        },
      ],
    },

    {
      id: 'painel',
      titulo: 'Painel central',
      rotas: ['/painel'],
      slides: [
        {
          titulo: 'O que o Painel mostra',
          tela: {
            url: '/painel',
            blocos: [
              menu('Painel'),
              { t: 'stats', n: 1, itens: [{ rotulo: 'Chamados em aberto', valor: '18' }, { rotulo: 'Urgentes na fila', valor: '2', tom: 'ruim' }, { rotulo: 'Certificados vencidos', valor: '0' }, { rotulo: 'Vencem em 30 dias', valor: '4', tom: 'alerta' }, { rotulo: 'Comigo agora', valor: '5' }] },
              { t: 'grafico', n: 2 },
              { t: 'cartoes', n: 3, itens: [{ titulo: 'Atendimento', texto: 'Abrir fila' }, { titulo: 'Desempenho', texto: 'Ver desempenho' }, { titulo: 'Empresas', texto: 'Gerenciar' }, { titulo: 'Usuários', texto: 'Gerenciar' }] },
              { t: 'tabela', n: 4, colunas: ['Meus atendimentos', 'Empresa', 'Prazo'], linhas: [['#120 Atualizar PGR', 'Empresa A', '6h úteis restantes'], ['#118 Exames', 'Empresa B', '2h em atraso']] },
            ],
          },
          passos: [
            'Indicadores do dia. "Comigo agora" fica vermelho se algum chamado seu estiver atrasado.',
            'Gráficos: chamados por situação (90 dias), prazo da fila aberta, treinamentos no EAD e fila por empresa.',
            'Módulos: atalhos para cada área do portal, incluindo Meu perfil.',
            'Meus atendimentos: chamados no seu nome, com o prazo. "Minha fila de prioridades" e "Ver no quadro" levam à sua fila.',
          ],
          dica: 'Gestor e admin também veem "Carga por atendente": clique numa linha para abrir o quadro filtrado por aquela pessoa. A pílula "sem responsável" mostra o que ninguém assumiu.',
        },
      ],
    },

    {
      id: 'quadro',
      titulo: 'Quadro de chamados',
      rotas: ['/atendimento'],
      slides: [
        {
          titulo: 'O quadro (kanban)',
          tela: {
            url: '/atendimento',
            blocos: [
              menu('Atendimento'),
              { t: 'topo', sobre: 'Atendimento', titulo: 'Quadro de chamados', botoes: ['Prioridades', 'Agenda', '★ Estrelas', 'Modo TV', 'Atualizar'] },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Buscar', valor: 'assunto, nº ou empresa' }, { rotulo: 'Empresa', valor: 'Todas' }, { rotulo: 'Prioridade', valor: 'Todas' }, { rotulo: 'Responsável', valor: 'Meus atendimentos' }] },
              {
                t: 'kanban',
                n: 2,
                colunas: [
                  { titulo: 'Aberto', cartoes: [{ texto: '#121 FORA DO PRAZO', tom: 'ruim' }, { texto: '#125 Exames' }] },
                  { titulo: 'Em andamento', cartoes: [{ texto: '#120 PRÓXIMO DO PRAZO', tom: 'alerta' }] },
                  { titulo: 'Aguardando cliente', cartoes: [{ texto: '#112 PCMSO' }] },
                  { titulo: 'Atendimento suspenso', cartoes: [{ texto: '#115 eSocial fora do ar', tom: 'ruim' }] },
                  { titulo: 'Resolvido', cartoes: [{ texto: '#110 Laudo', tom: 'bom' }] },
                  { titulo: 'Encerrado', cartoes: [{ texto: '#101 NR-35' }] },
                ],
              },
            ],
          },
          passos: [
            'Filtros: busca, empresa, prioridade e responsável ("Meus atendimentos", "Sem responsável" ou uma pessoa).',
            'A busca procura no título, número, categoria, empresa, descrição e nas mensagens da conversa, sem diferenciar acentos, maiúsculas ou ordem das palavras ("antonio da conceicao lopes" acha "Lopes, Antônio Conceição"). Quando acha fora do título, o cartão mostra "Encontrado na descrição" ou "Encontrado na conversa".',
            'Cada coluna é uma situação. O cartão mostra número, assunto, empresa, % das etapas, prazo e as iniciais do responsável. Selo vermelho FORA DO PRAZO e amarelo PRÓXIMO DO PRAZO. O selo "nova" piscando indica mensagem não lida num chamado seu.',
          ],
        },
        {
          titulo: 'Mudar a situação arrastando',
          passos: [
            'Arraste o cartão para outra coluna para mudar a situação. Aparece "Chamado #N movido para X" e o cliente recebe e-mail.',
            'Levar para Aguardando cliente pausa o prazo. Levar para Resolvido ou Encerrado registra a data de resolução.',
            'Levar para Atendimento suspenso abre uma janela com motivo, observação (só a equipe vê) e próxima atualização, todos obrigatórios. O SLA pausa na hora e o cliente recebe o motivo e a data. Para retomar, arraste para outra coluna: o prazo é estendido pelas horas úteis suspensas.',
            'Clique no cartão para abrir a tela de atendimento do chamado.',
            'Modo TV: tela cheia para monitor da sala, sem arrastar, atualizando sozinha a cada minuto.',
          ],
          atencao: 'Só mova para Resolvido quando a solução tiver sido entregue e comunicada na conversa. Resolver antes da hora gera reabertura e suspende as estrelas.',
        },
      ],
    },

    {
      id: 'tela-chamado',
      titulo: 'Atender um chamado',
      rotas: ['/atendimento/*', '/chamados/*'],
      slides: [
        {
          titulo: 'Visão geral da tela de atendimento',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'topo', sobre: 'Atendimento interno · Empresa A', titulo: '#120 Atualizar PGR da filial' },
              {
                t: 'duas',
                esquerda: [
                  { t: 'campos', n: 1, itens: [{ rotulo: 'Aberto por', valor: 'Maria Souza' }, { rotulo: 'Categoria', valor: 'Segurança do Trabalho' }, { rotulo: 'Prazo SLA', valor: '21/10 15:00 · 6h úteis restantes' }] },
                  { t: 'checklist', n: 2, itens: [{ texto: 'Visita técnica', feito: true }, { texto: 'Emissão do documento 🔒 só equipe' }] },
                  { t: 'chat', n: 3, msgs: [{ autor: 'Maria', etiqueta: 'Cliente', texto: 'Segue a lista de funções.' }, { autor: 'Ana', etiqueta: 'Equipe', texto: 'Recebido, obrigada!', eu: true }] },
                ],
                direita: [{ t: 'campos', n: 4, itens: [{ rotulo: 'Status', valor: 'Em atendimento', largo: true }, { rotulo: 'Prioridade', valor: 'Normal', largo: true }, { rotulo: 'Responsável', valor: 'Ana', largo: true }] }],
              },
            ],
          },
          passos: [
            'Detalhes do chamado: empresa, quem abriu, categoria, datas, prazo e descrição.',
            'Etapas do atendimento: o plano de trabalho e o % concluído.',
            'Conversas: chat com o cliente. Abaixo ficam Anexos, Links de acesso e Histórico e SLA.',
            'Gestão do chamado (coluna da direita): status, prioridade, empresa, responsável e solicitante do cliente (quem pediu e avalia o atendimento).',
          ],
        },
        {
          titulo: 'Assumir e transferir',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Responsável', valor: 'Ana (eu)', largo: true }] },
              { t: 'botoes', n: 2, itens: [{ rotulo: 'Transferir chamado', primario: true }] },
            ],
          },
          passos: [
            'Para assumir, escolha o seu nome na lista Responsável. Para passar adiante, escolha o colega.',
            'Clique em Transferir chamado. O novo responsável recebe o e-mail "Chamado #N está com você".',
          ],
          atencao: 'Não existe botão "Assumir": assumir é transferir para si mesmo. Chamado sem responsável não entra no desempenho de ninguém e, se for resolvido assim, não gera estrelas.',
        },
        {
          titulo: 'Mudar o status',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'opcoes', n: 1, itens: [{ rotulo: 'Aberto' }, { rotulo: 'Em atendimento', ativo: true }, { rotulo: 'Aguardando cliente' }, { rotulo: 'Atendimento suspenso' }, { rotulo: 'Resolvido' }, { rotulo: 'Encerrado' }] },
              { t: 'botoes', n: 2, itens: [{ rotulo: 'Salvar status', primario: true }] },
            ],
          },
          passos: [
            'Escolha a nova situação. Aguardando cliente pausa o prazo; Resolvido entrega a solução; voltar para Aberto ou Em atendimento reabre.',
            'Clique em Salvar status. O cliente recebe e-mail e o sistema publica uma mensagem automática na conversa.',
            'Ao pôr em Aguardando cliente, escreva na conversa exatamente o que falta (documento, dado, confirmação e de quem). O e-mail de cobrança mostra em "O que precisamos" a última mensagem da equipe no chamado: se ela não disser o que falta, o lembrete repete um texto que não ajuda o cliente.',
          ],
          dica: 'Responder na conversa de um chamado Aberto já o passa para Em atendimento automaticamente.',
          atencao:
            'Use Aguardando cliente só quando o próximo passo depender de fato do cliente, e diga na conversa o que falta. A pausa vale até ele responder. Parado além do prazo da empresa (padrão 7 dias, ajustável em Administração > Empresas), o cliente recebe cobrança por e-mail a cada 3 dias úteis e vê aviso vermelho no painel. Atendimento suspenso é para impedimento fora do seu controle, não para esperar o cliente.',
        },
        {
          titulo: 'Suspender o atendimento',
          texto:
            'Para impedimento fora do controle do atendente: sistema indisponível, falha de software, dependência de fornecedor ou de terceiros (órgão, concessionária).',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'topo', sobre: 'Atendimento suspenso', titulo: 'Suspender o chamado #115' },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Motivo', valor: 'Indisponibilidade de sistema', obrigatorio: true }, { rotulo: 'Próxima atualização', valor: '22/10/2026', obrigatorio: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Observação (só a equipe vê)', valor: 'eSocial fora do ar; retomar quando o envio voltar', largo: true, obrigatorio: true }] },
              { t: 'botoes', n: 3, itens: [{ rotulo: 'Cancelar' }, { rotulo: 'Suspender atendimento', primario: true }] },
            ],
          },
          passos: [
            'No Quadro, arraste o cartão para a coluna Atendimento suspenso; ou, na tela do chamado, escolha Atendimento suspenso no status e clique em Salvar status.',
            'Preencha motivo, observação (mínimo 10 caracteres) e a data da próxima atualização (hoje ou depois). Sem esses dados o sistema não deixa suspender.',
            'O SLA pausa na hora. O cliente recebe e-mail e mensagem automática com o motivo e a próxima atualização; a observação fica só com a equipe.',
            'Para retomar, mude a situação (por exemplo, Em atendimento). O prazo é estendido pelas horas úteis em que o chamado ficou suspenso e o cliente é avisado da retomada.',
          ],
          atencao:
            'Nas estrelas, a extensão por suspensão fica "Aguardando gestor": só vale se o gestor autorizar, e nunca se o prazo já estava vencido quando a suspensão começou. Não use para esperar o cliente: para isso existe Aguardando cliente.',
        },
        {
          titulo: 'Prioridade e empresa (gestor e admin)',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Prioridade', valor: 'Alta', largo: true }] },
              { t: 'botoes', itens: [{ rotulo: 'Salvar prioridade', primario: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Empresa', valor: 'Empresa B', largo: true }] },
              { t: 'botoes', itens: [{ rotulo: 'Mover para esta empresa', primario: true }] },
            ],
          },
          passos: [
            'Prioridade: só gestor e admin alteram. Salvar refaz o prazo mantendo as pausas e feriados já descontados, e avisa o cliente.',
            'Empresa: move o chamado para outra empresa. Muda quem enxerga o chamado e a marca dos e-mails; o portal pede confirmação.',
          ],
          atencao:
            'O atendente vê só o texto "Somente gestor ou administrador altera a prioridade". Cliente abre no máximo como Alta: Urgente é decisão da gestão, depois da análise.',
        },
        {
          titulo: 'Conversas com o cliente',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'chat', n: 1, msgs: [{ autor: 'Assistente virtual', etiqueta: 'Automática', texto: 'Seu chamado está aguardando um retorno seu.' }, { autor: 'Maria', etiqueta: 'Cliente', texto: 'Segue em anexo.' }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Resposta', valor: 'Recebido! @Carlos pode validar o layout?', largo: true }] },
              { t: 'botoes', itens: [{ rotulo: 'Responder cliente', primario: true }] },
            ],
          },
          passos: [
            'Etiquetas: Cliente, Equipe ou Automática (aviso gerado pelo sistema a cada mudança de situação).',
            'Escreva e clique em Responder cliente: o cliente recebe e-mail. Escreva @Nome para chamar um colega; ele recebe e-mail se tiver acesso ao chamado.',
          ],
          atencao: 'Tudo o que você escreve aqui o cliente lê. Assuntos internos vão para Conversas (chat da equipe).',
        },
        {
          titulo: 'Etapas do atendimento',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'barra', rotulo: '50% · 1 de 2 · o cliente vê 100% (só etapas visíveis)', pct: 50 },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Nova etapa', valor: 'Emissão do laudo' }, { rotulo: 'Só equipe', valor: '☐' }] },
              { t: 'checklist', n: 2, itens: [{ texto: 'Visita técnica · 👁 ↑ ↓ ✕', feito: true }, { texto: 'Revisão interna · 🔒 ↑ ↓ ✕' }] },
            ],
          },
          passos: [
            'Digite a etapa e clique em Adicionar. Marque "Só equipe" para esconder a etapa do cliente.',
            'Marque a caixa ao concluir. Duplo clique renomeia; 👁/🔒 mostra ou esconde; ↑ ↓ reordenam; ✕ remove (pede confirmação).',
          ],
          dica: 'O % é calculado pela quantidade de etapas concluídas. O cliente vê o % só das etapas visíveis. Em chamado Encerrado as etapas ficam travadas.',
        },
        {
          titulo: 'Quem vê, anexos e links',
          passos: [
            'Quem vê este chamado: "Só pessoas selecionadas" ou "Toda a empresa", com os usuários do cliente marcados. A equipe sempre vê tudo.',
            'Anexos: Selecionar arquivo, até 10 MB por arquivo. Abrir mostra numa nova aba; Baixar salva. Não há exclusão de anexo.',
            'Links de acesso: pastas compartilhadas ou sistemas, com Abrir, Editar e Remover.',
          ],
        },
        {
          titulo: 'Histórico e SLA',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'stats', itens: [{ rotulo: 'Primeira resposta', valor: '1h20' }, { rotulo: 'Tempo até resolver', valor: 'em andamento' }, { rotulo: 'Espera do cliente', valor: '5h' }, { rotulo: 'Prazo', valor: 'pausado', tom: 'alerta' }] },
              { t: 'tabela', n: 1, colunas: ['Quando', 'Evento', 'Por'], linhas: [['14/10 09:02', 'Chamado aberto', 'Maria'], ['14/10 10:22', 'Situação: Aberto → Em atendimento', 'Ana'], ['15/10 14:00', 'SLA pausado', 'Sistema']] },
            ],
          },
          passos: [
            'A linha do tempo registra tudo: mudanças de situação, prioridade, responsável e empresa, anexos, links, mensagens, etapas, participantes, pausas do SLA, suspensões e cobranças enviadas ao cliente, com data e autor.',
            'Nos detalhes do chamado, "Aberto por" mostra quem abriu (nome e e-mail) e "Atualização" mostra o último movimento registrado.',
          ],
          dica: 'Nesta tela, Primeira resposta e Tempo até resolver usam horas corridas. O Desempenho usa horas úteis.',
        },
        {
          titulo: 'Estrelas e avaliação do chamado',
          passos: [
            '"Avaliação do cliente" mostra a nota (Ruim, Bom, Excelente) e o comentário, ou até quando o cliente pode avaliar.',
            '"★ Estrelas deste chamado" mostra as estrelas pelo prazo e pela avaliação, e se estão Válidas, Suspensas (chamado reaberto) ou Estornadas. O atendente vê as dos próprios chamados; gestor e admin veem todas.',
            'Extensões de prazo (por troca de prioridade, ajuste manual ou tempo em Atendimento suspenso) ficam "Aguardando gestor". Gestor e admin escrevem a justificativa e clicam em Autorizar ou Recusar; também podem estornar ou restabelecer as estrelas.',
          ],
        },
      ],
    },

    {
      id: 'sla',
      titulo: 'Regras de prazo (SLA)',
      rotas: [],
      slides: [
        {
          titulo: 'Prazo por prioridade',
          tela: {
            url: '/atendimento/prioridades',
            blocos: [{ t: 'tabela', colunas: ['Prioridade', 'Prazo'], linhas: [['Baixa', '48 h úteis (6 dias)'], ['Normal', '24 h úteis (3 dias)'], ['Alta', '8 h úteis (1 dia)'], ['Urgente', '4 h úteis']] }],
          },
          passos: [
            'Horas úteis: segunda a sexta, 08h–12h e 13h–17h, horário de Porto Velho (8 h por dia). Fim de semana, almoço, noite e feriados cadastrados não contam.',
            'Exemplo: Urgente aberto na sexta às 16h vence na segunda às 11h.',
            'O prazo é calculado na abertura. Trocar a prioridade recalcula mantendo as extensões já recebidas.',
          ],
        },
        {
          titulo: 'Pausa, retomada e encerramento automático',
          passos: [
            'Aguardando cliente: o prazo pausa. Ao sair, ele é estendido pelas horas úteis da espera. Chamado pausado nunca conta como atrasado.',
            'Se o cliente responder num chamado Aguardando cliente ou Resolvido, o chamado volta sozinho para Em atendimento e o relógio volta a contar.',
            'Resolvido sem manifestação do cliente por 24 horas úteis vira Encerrado automaticamente (verificação de hora em hora).',
            'Alerta amarelo "Próximo do prazo": aparece quando faltam poucas horas úteis (o gestor define quantas em Estrelas › Gestão).',
          ],
          atencao: 'Ao pausar, a mensagem automática ao cliente sai primeiro e a pausa vem em seguida: confira na linha do tempo se o pedido ao cliente ficou claro.',
        },
      ],
    },

    {
      id: 'prioridades',
      titulo: 'Fila de prioridades',
      rotas: ['/atendimento/prioridades'],
      slides: [
        {
          titulo: 'Qual chamado atender primeiro',
          tela: {
            url: '/atendimento/prioridades',
            blocos: [
              { t: 'topo', sobre: 'Atendimento', titulo: 'Prioridades e SLA', botoes: ['Agenda', 'Feriados', 'Quadro', 'Atualizar'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Na fila', valor: '14' }, { rotulo: 'SLA atrasado', valor: '2', tom: 'ruim' }, { rotulo: 'Vencem em até 4h', valor: '3', tom: 'alerta' }, { rotulo: 'Aguardando cliente', valor: '6' }, { rotulo: 'No prazo (30 dias)', valor: '91%', tom: 'bom' }] },
              { t: 'botoes', n: 2, itens: [{ rotulo: 'Minha fila', primario: true }, { rotulo: 'Fila geral' }] },
              { t: 'tabela', n: 3, colunas: ['Ordem', 'Chamado', 'Área', 'Resp.', 'SLA'], linhas: [['1', '#121 Exames', 'Exames 1º de 3', 'Ana', 'Fora do prazo'], ['2', '#125 PGR', 'Seg. Trab. 1º de 4', 'Carlos', 'Vence em breve']], pilulas: 4 },
            ],
          },
          passos: [
            'Indicadores da fila e "Carga por responsável" (clique numa pessoa para ver a fila dela).',
            'Minha fila mostra só os seus chamados; Fila geral mostra todos. Filtre por atendente e área.',
            'Atenda de cima para baixo: Urgentes primeiro, depois os atrasados (maior atraso antes), depois o menor prazo restante, a prioridade e a data de abertura.',
          ],
          dica: 'Chamados Aguardando cliente ficam fora da fila, numa lista própria com o saldo de prazo. A tela se atualiza sozinha a cada 2 minutos.',
        },
      ],
    },

    {
      id: 'agenda',
      titulo: 'Agenda da equipe',
      rotas: ['/atendimento/agenda'],
      slides: [
        {
          titulo: 'Agenda semanal por atendente',
          tela: {
            url: '/atendimento/agenda',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Atendente', valor: 'Ana' }, { rotulo: 'Semana', valor: '← 19/10 a 23/10 →' }] },
              { t: 'stats', itens: [{ rotulo: 'Agendadas na semana (de 32h úteis)', valor: '9h' }, { rotulo: 'Prazos na semana', valor: '4' }, { rotulo: 'Atrasados', valor: '1', tom: 'ruim' }, { rotulo: 'Etapas pendentes', valor: '6' }] },
              { t: 'agenda', n: 2 },
              { t: 'botoes', n: 3, itens: [{ rotulo: '+ Compromisso', primario: true }] },
            ],
          },
          passos: [
            'Escolha o atendente e navegue pelas semanas (Hoje volta para a atual).',
            'Grade de segunda a sexta, 08h–17h: blocos verdes são compromissos; etiquetas ⏱ são prazos de chamados (vermelho atrasado, amarelo vence em breve); feriado aparece hachurado.',
            '+ Compromisso (ou clique num horário livre): título, dia, início, término e, se quiser, nº do chamado, local e observação.',
          ],
          dica: 'Abaixo da grade ficam os chamados da pessoa (atrasados, da semana, depois e aguardando cliente) com as etapas pendentes.',
          atencao: 'Atendente edita só a própria agenda; gestor e admin editam a de qualquer pessoa. A carga do dia conta só compromissos.',
        },
      ],
    },

    {
      id: 'feriados',
      titulo: 'Calendário de feriados',
      rotas: ['/atendimento/feriados'],
      slides: [
        {
          titulo: 'Cadastrar e remover feriados (gestor e admin)',
          tela: {
            url: '/atendimento/feriados',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Data', valor: '02/10/2026' }, { rotulo: 'Descrição', valor: 'Aniversário de Porto Velho' }, { rotulo: 'Tipo', valor: 'Municipal (Porto Velho)' }] },
              { t: 'botoes', itens: [{ rotulo: 'Cadastrar feriado', primario: true }] },
              { t: 'tabela', n: 2, colunas: ['Data', 'Feriado', 'Tipo', ''], linhas: [['12/10 · segunda', 'Nossa Senhora Aparecida', 'Nacional', 'Remover']] },
            ],
          },
          passos: [
            'Informe data, descrição e tipo (Nacional, Estadual RO, Municipal Porto Velho ou Recesso da empresa) e clique em Cadastrar feriado.',
            'Remover pede confirmação.',
          ],
          dica: 'Ao cadastrar, os chamados em andamento que passam por aquele dia têm o prazo estendido automaticamente, sem prejudicar as estrelas de ninguém.',
          atencao: 'Remover um feriado não encurta prazos já estendidos. Cadastre os feriados com antecedência. A equipe consulta; só gestor e admin cadastram.',
        },
      ],
    },

    {
      id: 'desempenho',
      titulo: 'Desempenho',
      rotas: ['/atendimento/desempenho'],
      slides: [
        {
          titulo: 'Indicadores da equipe',
          tela: {
            url: '/atendimento/desempenho',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Período', valor: 'Mês atual' }, { rotulo: 'Marca', valor: 'Todas' }, { rotulo: 'Área', valor: 'Todas' }] },
              { t: 'stats', itens: [{ rotulo: 'Concluídos', valor: '64' }, { rotulo: 'SLA cumprido', valor: '92%', tom: 'bom' }, { rotulo: '1ª resposta (mediana)', valor: '1,2h' }, { rotulo: 'Resolução (mediana)', valor: '9h' }, { rotulo: 'Reabertura', valor: '4%' }] },
              { t: 'tabela', n: 2, colunas: ['Atendente', 'Concluídos', 'SLA', '1ª resp.', 'Carteira', 'Atrasados'], linhas: [['Ana', '22', '95%', '0,8h', '5', '0'], ['Carlos', '18', '88%', '1,5h', '7', '1']] },
            ],
          },
          passos: [
            'Escolha o período, a marca, a área e a origem: clientes, internos (chamados da própria equipe) ou ambos.',
            'Passe o mouse no título das colunas para ver a definição. SLA verde a partir de 90% (meta interna), amarelo a partir de 75%.',
          ],
          dica: 'O chamado conta para o responsável atual. Tempos em horas úteis e pela mediana; mensagens automáticas não contam como 1ª resposta; a resolução desconta a espera do cliente.',
          atencao: 'Gestor e admin veem todos e podem detalhar cada atendente. O atendente vê só o próprio resultado.',
        },
      ],
    },

    {
      id: 'estrelas',
      titulo: 'Programa de Estrelas',
      rotas: ['/estrelas'],
      slides: [
        {
          titulo: 'Como se ganham estrelas',
          tela: {
            url: '/estrelas',
            blocos: [
              menu('Estrelas'),
              { t: 'cartoes', n: 1, itens: [{ titulo: '★ Prazo', texto: '1 estrela por resolver dentro do prazo' }, { titulo: '★ Bom', texto: '+1 pela avaliação do cliente' }, { titulo: '★★ Excelente', texto: '+2 pela avaliação do cliente' }] },
              { t: 'botoes', n: 2, itens: [{ rotulo: 'Mensal', primario: true }, { rotulo: 'Anual' }, { rotulo: 'Meu painel' }, { rotulo: 'Gestão do programa' }] },
            ],
          },
          passos: [
            'Até 3 estrelas por chamado: 1 por resolver dentro do prazo (no limite exato também conta) e até 2 pela avaliação de quem pediu. Ruim ou sem avaliação: +0. Nos chamados internos (empresa Real Life SSMA), quem avalia é o solicitante da equipe; ninguém avalia chamado em que é o responsável nem chamado cujas estrelas recebeu.',
            'Abas: Mensal (pódio e ranking do mês), Anual, Meu painel (seus chamados e estrelas) e Gestão do programa (gestor e admin).',
          ],
        },
        {
          titulo: 'Regras importantes',
          passos: [
            'As estrelas ficam com quem era responsável na resolução. Chamado resolvido sem responsável não gera estrelas.',
            'Reabertura suspende as estrelas; elas são recalculadas na nova resolução.',
            'Extensão de prazo sem mudança de status (ex.: troca de prioridade) só vale para as estrelas se o gestor autorizar. Pausas e feriados já entram autorizados.',
            'O bônus da avaliação entra no mês da resolução, não no mês em que o cliente avaliou.',
          ],
          dica: 'Quando você ganha estrelas ou sobe no ranking, aparece uma comemoração no topo da tela. A caixa "Efeitos visuais", na tela Estrelas, liga ou desliga as animações.',
        },
        {
          titulo: 'Gestão do programa (gestor e admin)',
          passos: [
            'Configuração: data inicial, prazo para o cliente avaliar (1 a 365 dias), alerta "Próximo do prazo", pesos das estrelas e Programa ativo. Toda alteração exige justificativa e fica na auditoria.',
            'Fechamento anual: defina a data; a partir dela, "Fechar classificação" congela o ranking do ano.',
            'Avaliações ruins: acompanhamento reservado. O gestor registra a ação tomada.',
            'Extensões de prazo pendentes: decida na tela do chamado, com justificativa.',
          ],
        },
      ],
    },

    {
      id: 'abrir-para-cliente',
      titulo: 'Abrir chamado para um cliente',
      rotas: ['/chamados/novo', '/chamados'],
      slides: [
        {
          titulo: 'Registrar um pedido recebido por telefone, e-mail ou WhatsApp',
          tela: {
            url: '/chamados/novo',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Empresa', valor: 'Empresa A', obrigatorio: true }, { rotulo: 'Solicitante (quem do cliente pediu)', valor: 'Maria Souza', obrigatorio: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Categoria', valor: 'Exames', obrigatorio: true }, { rotulo: 'Assunto', valor: 'Agendar periódicos', obrigatorio: true }, { rotulo: 'Descrição', valor: 'Pedido recebido por telefone…', largo: true }] },
              { t: 'opcoes', n: 3, itens: [{ rotulo: 'Baixa' }, { rotulo: 'Normal', ativo: true }, { rotulo: 'Alta' }, { rotulo: 'Urgente' }] },
            ],
          },
          passos: [
            'Em Chamados, clique em "Abrir chamado para um cliente", escolha a empresa e o Solicitante: o usuário do cliente que fez o pedido. É ele quem acompanha e avalia o atendimento.',
            'Preencha categoria, assunto e descrição, como o cliente faria. Cite a origem do pedido (telefone, e-mail, reunião).',
            'Escolha a prioridade e, se quiser, marque os usuários do cliente que devem acompanhar. Sem ninguém marcado, o chamado fica visível para toda a empresa.',
          ],
          dica: 'Todo pedido de cliente deve virar chamado: é o que garante prazo, histórico e indicador. Na lista de Chamados, a linha abre a visão do cliente; para atender, use o Quadro.',
        },
      ],
    },

    {
      id: 'certificados',
      titulo: 'Certificados',
      rotas: ['/certificados'],
      slides: [
        {
          titulo: 'Cadastrar um certificado',
          tela: {
            url: '/certificados',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Empresa', valor: 'Empresa A', obrigatorio: true }, { rotulo: 'Colaborador', valor: 'João Lima', obrigatorio: true }, { rotulo: 'Função', valor: 'Eletricista' }, { rotulo: 'E-mail do colaborador', valor: 'joao@empresa.com.br' }, { rotulo: 'Curso no EAD', valor: 'NR-10 BÁSICO' }] },
              { t: 'opcoes', n: 2, itens: [{ rotulo: 'Plataforma (EAD)', desc: 'Atualiza sozinho todo dia', ativo: true }, { rotulo: 'Presencial (manual)', desc: 'Etapa e % informados' }] },
              { t: 'campos', n: 3, itens: [{ rotulo: 'Tipo', valor: 'NR-10', obrigatorio: true }, { rotulo: 'Emissão', valor: '10/10/2026' }, { rotulo: 'Validade', valor: '10/10/2028' }, { rotulo: 'Link do certificado', valor: 'https://...' }] },
              { t: 'botoes', itens: [{ rotulo: 'Registrar certificado', primario: true }] },
            ],
          },
          passos: [
            'Clique em "+ Novo certificado" no topo da página: o formulário abre na lateral, sem tirar a lista da tela. Esc ou Cancelar fecham sem salvar.',
            'Empresa, colaborador, função, e-mail e curso no EAD. O e-mail é a chave para buscar o progresso na plataforma.',
            'Origem do progresso: Plataforma (EAD) atualiza sozinha toda manhã; Presencial (manual) pede etapa (Agendado, Em andamento, Concluído) e %.',
            'Tipo, emissão, validade, observações e link do certificado. Se o certificado não tem prazo, marque "Este certificado não vence": ele vai para Sem vencimento, e não para Validade não informada. Clique em Registrar certificado.',
          ],
          atencao: 'Sem a data de validade, o certificado não entra nos alertas de vencimento nem no Boletim de Antecedência. Deixe a validade em branco sem marcar "não vence" só quando a data realmente não for conhecida: ele aparece como Validade não informada, uma pendência a corrigir.',
        },
        {
          titulo: 'Acompanhar vencimentos',
          passos: [
            'Validade dos certificados: Vencidos, Vencem em até 90 dias (com quantos em até 30), Em dia (mais de 90 dias), Sem vencimento e Validade não informada. Cada certificado entra em uma só faixa, então os cartões somam o total. Clique num cartão para filtrar a lista.',
            'Treinamento: concluídos (100%), em andamento, não iniciados e sem dados de progresso. É outra régua, independente da validade; também filtra ao clicar.',
            'Aba Certificados: busca (colaborador, função, e-mail ou curso, sem ligar para acento ou ordem), empresa, situação, "Mais filtros" (tipo, origem, mês) e Limpar. "Por colaborador" agrupa os cursos de cada pessoa. A lista mostra 25 por página.',
            'Menu ⋯ em cada linha: Editar abre o formulário lateral; Remover pede confirmação antes de apagar.',
            '⤓ Exportar baixa a lista filtrada em CSV (abre no Excel).',
            'Aba Análise mensal: o Painel por tipo e mês completo (lançados, 100%, presenciais, sem data de emissão e a matriz). O mês atual vem destacado e a cor mais forte indica mais certificados; clique num número para ver esses certificados na lista.',
            'Toda segunda-feira o Boletim de Antecedência é enviado por e-mail aos clientes e à equipe com o que vence em 90, 30 e 7 dias.',
          ],
          dica: '"Sem data de emissão" (Análise mensal) não é o mesmo que "Validade não informada" (cartões): um fala da emissão, o outro do vencimento.',
        },
      ],
    },

    {
      id: 'treinamentos',
      titulo: 'Treinamentos (EAD)',
      rotas: ['/treinamentos'],
      slides: [
        {
          titulo: 'Relatório de treinamentos',
          passos: [
            'Indicadores (Concluídos, Em andamento, Não iniciados) e gráficos por situação, empresa e cursos que mais travam.',
            '"Por colaborador": filtre por empresa, curso e situação. Atualizar do EAD busca o dado na hora; Baixar CSV gera planilha para o Excel.',
            'O aviso de e-mails com matrícula no EAD sem certificado cadastrado indica cadastros faltando em Certificados.',
          ],
          dica: 'A leitura automática do EAD roda todo dia às 05h de Porto Velho. Certificados de origem manual não são alterados por ela.',
        },
      ],
    },

    {
      id: 'conversas',
      titulo: 'Conversas',
      rotas: ['/equipe'],
      slides: [
        {
          titulo: 'Chat interno e com clientes',
          passos: [
            'Sala "Equipe toda": lida por toda a equipe interna.',
            'Equipe interna e Clientes: conversas privadas, só entre as duas pessoas. Mensagem privada nova acende um balão vermelho piscando na aba Conversas, em qualquer tela; some quando você abre a conversa.',
            'As mensagens se atualizam sozinhas a cada poucos segundos e não geram e-mail.',
          ],
          atencao: 'Se o cliente pedir um serviço pelo chat, abra um chamado para ele. Conversa não tem prazo, não entra no histórico do chamado nem nos indicadores.',
        },
      ],
    },

    {
      id: 'administracao',
      titulo: 'Empresas e usuários',
      rotas: ['/administracao/*'],
      slides: [
        {
          titulo: 'Cadastrar uma empresa',
          tela: {
            url: '/administracao/empresas',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Razão social', valor: 'Empresa A Ltda', obrigatorio: true }, { rotulo: 'CNPJ', valor: '00.000.000/0001-00' }, { rotulo: 'Marca que atende', valor: 'Real Life SSMA', obrigatorio: true }, { rotulo: 'E-mail', valor: 'contato@empresa.com.br' }] },
              { t: 'botoes', itens: [{ rotulo: 'Cadastrar empresa', primario: true }] },
            ],
          },
          passos: [
            'Preencha razão social, nome fantasia, CNPJ, a marca que atende (ÁgilMed ou Real Life), situação e contatos. Clique em Cadastrar empresa e depois crie os usuários dela.',
            'Cobrar cliente após (dias): quantos dias corridos um chamado pode ficar em Aguardando cliente antes da cobrança automática (padrão 7, de 1 a 60).',
          ],
          dica: 'A marca define as cores do portal e dos e-mails para o cliente. O e-mail da empresa recebe os avisos dos chamados abertos para toda a empresa. Empresa não é excluída: marque como Inativa.',
        },
        {
          titulo: 'Criar um usuário',
          tela: {
            url: '/administracao/usuarios',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Nome completo', valor: 'Maria Souza', obrigatorio: true }, { rotulo: 'E-mail', valor: 'maria@empresa.com.br', obrigatorio: true }, { rotulo: 'Senha inicial', valor: '••••••', obrigatorio: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Perfil de acesso', valor: 'Cliente', obrigatorio: true }, { rotulo: 'Empresa', valor: 'Empresa A' }] },
              { t: 'botoes', itens: [{ rotulo: 'Criar usuário', primario: true }] },
            ],
          },
          passos: [
            'Nome, e-mail, senha inicial (mínimo 6), telefone e cargo.',
            'Perfil: Cliente (exige empresa), Atendimento, Gestor ou Administrador. Ao criar, a pessoa recebe e-mail com o endereço e a senha.',
          ],
          atencao:
            'Só administrador cria ou edita administradores. Ninguém altera o próprio perfil ou situação, e o último administrador ativo não pode ser rebaixado. Para desligar alguém, edite e marque Inativo. Esqueceu a senha? Edite o usuário e defina uma nova senha.',
        },
      ],
    },

    {
      id: 'rotinas',
      titulo: 'Rotinas automáticas e e-mails',
      rotas: [],
      slides: [
        {
          titulo: 'O que o sistema faz sozinho',
          tela: {
            url: '/painel',
            blocos: [
              {
                t: 'tabela',
                colunas: ['Rotina', 'Quando (Porto Velho)', 'O que faz'],
                linhas: [
                  ['Alerta de SLA', 'Dias úteis, 08h', 'E-mail com chamados atrasados'],
                  ['Cobrança do cliente', 'Dias úteis, 08h20', 'E-mail ao cliente com chamado parado'],
                  ['Boletim', 'Segunda, 07h', 'Certificados a vencer'],
                  ['Leitura do EAD', 'Todo dia, 05h', 'Atualiza o progresso'],
                  ['Encerramento', 'De hora em hora', 'Resolvido há 24h úteis → Encerrado'],
                ],
              },
            ],
          },
          passos: [
            'Alerta de SLA: a equipe recebe a lista de chamados com prazo vencido (sem contar os Aguardando cliente), e cada responsável recebe os seus.',
            'Cobrança do cliente: chamado em Aguardando cliente além do prazo da empresa gera e-mail ao solicitante, a quem abriu (se cliente) e aos participantes do cliente; repete a cada 3 dias úteis até ele responder. Empresa interna fica fora. A cobrança fica registrada no histórico do chamado.',
            'O e-mail de cobrança diz de quem a resposta é esperada (o solicitante; sem ele, quem abriu; se a equipe abriu, os usuários do cliente no chamado), quem abriu, a empresa e a última mensagem escrita pela equipe ("O que precisamos"). Por isso, ao pôr em Aguardando cliente, escreva na conversa exatamente o que falta.',
            'Mensagens automáticas na conversa do chamado: ao abrir, entrar em atendimento, reabrir, aguardar cliente, suspender, retomar, resolver e encerrar.',
          ],
        },
        {
          titulo: 'Quem recebe cada e-mail',
          passos: [
            'Chamado aberto: a equipe recebe "Novo chamado"; o cliente recebe a confirmação com prazo e posição na fila.',
            'Resposta da equipe, mudança de situação, de prioridade ou de responsável: o lado do cliente é avisado (em chamado restrito, só quem abriu e os participantes).',
            'Mensagem do cliente: o responsável (ou a equipe, se não houver responsável).',
            'Resolvido: convite de avaliação ao solicitante (ou a quem abriu, se for do cliente), uma vez por chamado. Avaliação Ruim: e-mail reservado a gestores e admins.',
            'Citação @Nome: a pessoa citada, se tiver acesso ao chamado.',
          ],
        },
      ],
    },

    {
      id: 'boas-praticas',
      titulo: 'Boas práticas',
      slides: [
        {
          titulo: 'Combinados do time',
          passos: [
            'Comece o dia pela Minha fila em Prioridades e atenda de cima para baixo.',
            'Assuma (transfira para si) o chamado antes de começar: chamado sem responsável não conta para ninguém.',
            'Responda o cliente rápido, mesmo que seja só para confirmar o recebimento: a 1ª resposta é medida.',
            'Divida trabalhos longos em etapas: o cliente acompanha o % e cobra menos.',
            'Aguardando cliente só com pedido claro na conversa. Resolvido só com a solução entregue.',
            'Pedido de prazo maior? Fale com a gestão: extensão sem autorização não vale para as estrelas.',
          ],
        },
        {
          titulo: 'Sobre este manual',
          passos: [
            'O manual é atualizado junto com o portal. As telas são ilustrações com dados fictícios.',
            'É só para visualização: não pode ser baixado nem impresso, e mostra o e-mail de quem está vendo.',
            'Encontrou algo diferente no sistema? Avise a gestão para corrigir o manual.',
          ],
        },
      ],
    },
  ],
}

export default manualInterno
