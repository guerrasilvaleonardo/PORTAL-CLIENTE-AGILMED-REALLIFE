import type { Bloco, Manual } from './tipos'

/*
 * MANUAL DO TIME INTERNO (perfis atendimento, gestor e admin).
 * Regra do projeto: TODA alteração do portal entra no mesmo PR aqui
 * (time interno) e, se o cliente vê ou é afetado, em cliente.ts.
 */

const MENU = ['Painel', 'Atendimento', 'Estrelas', 'Chamados', 'Certificados', 'Documentos SST', 'Treinamentos', 'Conversas']
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
            'Certificados e Treinamentos acompanham a validade e o andamento EAD dos colaboradores dos clientes. Documentos SST controla prazos, revisões e versões assinadas de PGR, PCMSO, laudos e programas de cada empresa.',
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
            'Menu da equipe: Painel, Atendimento, Estrelas, Chamados, Certificados, Documentos SST, Treinamentos e Conversas. O botão "?" abre este manual no assunto da tela atual. Sair encerra o acesso.',
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
                  { titulo: 'Cancelado', cartoes: [{ texto: '#109 Duplicado' }] },
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
            'Levar para Cancelado (só gestor e admin) abre a janela de cancelamento com motivo e observação obrigatórios. Para desfazer, o gestor arrasta de volta para Aberto ou Em andamento.',
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
            'Só quem tem autorização no cadastro altera o responsável ou transfere: hoje, Leonardo e Priscila. Para os demais, o campo Responsável aparece só para consulta; peça a um deles a distribuição do chamado.',
          ],
          atencao: 'Não existe botão "Assumir": assumir é transferir para si mesmo (só para os autorizados). Chamado sem responsável não entra no desempenho de ninguém e, se for resolvido assim, não gera estrelas.',
        },
        {
          titulo: 'Horário de atendimento (trava)',
          texto:
            'Fora do horário de atendimento (segunda a sexta, 8h às 17h, horário de Porto Velho, exceto feriados cadastrados), a equipe só consulta os chamados.',
          passos: [
            'Nesse período aparece uma faixa amarela no topo: "Fora do horário de atendimento".',
            'Ficam bloqueados: responder ao cliente, mudar situação, assumir ou transferir, prioridade, etapas, anexos, links e abrir chamado. Consultar, ler e usar Conversas continua liberado.',
            'Das 12h às 13h fica liberado, para não travar quem estende um atendimento.',
            'Quem tem "Pode atender chamados fora do horário" marcado no cadastro (Administração › Usuários) trabalha normalmente a qualquer hora. Só administrador marca ou desmarca.',
          ],
          atencao: 'O bloqueio é feito pelo banco de dados: não adianta tentar por outra tela. Clientes e as rotinas automáticas (encerramento, cobrança, alertas) não são afetados.',
        },
        {
          titulo: 'Mudar o status',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'opcoes', n: 1, itens: [{ rotulo: 'Aberto' }, { rotulo: 'Em atendimento', ativo: true }, { rotulo: 'Aguardando cliente' }, { rotulo: 'Atendimento suspenso' }, { rotulo: 'Resolvido' }, { rotulo: 'Encerrado' }, { rotulo: 'Cancelado' }] },
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
          titulo: 'Cancelar um chamado (gestor e admin)',
          texto:
            'Para chamado que não deve ser atendido: duplicado, aberto por engano, desistência do cliente, fora do escopo contratado, sem retorno do cliente ou substituído por outro chamado.',
          tela: {
            url: '/atendimento/…',
            blocos: [
              { t: 'topo', sobre: 'Cancelamento', titulo: 'Cancelar o chamado #210' },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Motivo', valor: 'Chamado duplicado', obrigatorio: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Observação (só a equipe vê)', valor: 'Duplicado do #205, que segue em atendimento', largo: true, obrigatorio: true }] },
              { t: 'botoes', n: 3, itens: [{ rotulo: 'Voltar' }, { rotulo: 'Cancelar chamado', primario: true }] },
            ],
          },
          passos: [
            'No Quadro, arraste o cartão para a coluna Cancelado; ou, na tela do chamado, escolha Cancelado no status e clique em Salvar status.',
            'Escolha o motivo da lista (em "Outro", descreva o motivo, que o cliente verá) e escreva a observação interna (mínimo 10 caracteres).',
            'O cliente recebe e-mail e mensagem automática com o motivo; a observação fica só com a equipe.',
            'Para desfazer, mude a situação para Aberto ou Em atendimento. O cliente é avisado e o registro do cancelamento fica guardado no chamado.',
          ],
          dica: 'Em Atendimento > Desempenho, o quadro "Cancelados por motivo" mostra quantos chamados foram cancelados no período e por quê.',
          atencao:
            'Só gestor e admin cancelam ou desfazem; o atendente pede ao gestor. Só se cancela chamado em aberto (inclusive suspenso): Resolvido e Encerrado não se cancelam. Cancelado fica fora do SLA e das estrelas e não pede avaliação, por isso não use para tirar do indicador um chamado que foi atendido com atraso.',
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
            'O cliente vê o seu nome em cada resposta, com a etiqueta "Equipe Real Life" ou "Equipe ÁgilMed".',
            'Reações: ☺+ abaixo da mensagem (👍 ❤️ 😂 😮 🙏 ✅). Uma por pessoa por mensagem; clicar de novo retira. O cliente também reage e vê quem reagiu. Reagir não muda situação, prazo nem estrelas e não gera e-mail.',
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
            'A linha do tempo registra tudo: mudanças de situação, prioridade, responsável e empresa, anexos, links, mensagens, etapas, participantes, pausas do SLA, suspensões, cancelamentos e cobranças enviadas ao cliente, com data e autor.',
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
            'Se o cliente responder num chamado Aguardando cliente, o chamado volta sozinho para Em atendimento e o relógio volta a contar. Em Resolvido, a mensagem do cliente (um "obrigado", por exemplo) NÃO reabre nem suspende as estrelas: o cliente tem os botões "Sim, pode encerrar" (vai para Encerrado) e "Não, reabrir" (precisa dizer o que falta; volta para Em atendimento). Leia a conversa: se o cliente relatar problema sem clicar em reabrir, reabra você.',
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
            'Faixa “Com o atendente” no topo de cada dia: no dia de hoje aparece tudo o que está com a pessoa (atrasados em vermelho, em atendimento, abertos e aguardando cliente); nos demais dias, o que vence em breve (amarelo). Clique para abrir o chamado.',
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
      rotas: ['/atendimento/desempenho', '/atendimento/relatorio-mensal'],
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
        {
          titulo: 'Relatório mensal de gestão (restrito à direção)',
          texto:
            'Todo dia 1º o portal gera o relatório do mês anterior: visão da equipe e uma ficha por pessoa com os mesmos indicadores desta tela, comparação com o mês anterior e com a mediana da equipe, pontos fortes, pontos de atenção, plano de ação e roteiro para a conversa individual.',
          passos: [
            'Só a direção (Leonardo Guerra e Priscila Vanzini) abre o relatório, pelo botão "🔒 Relatório mensal" desta tela. A liberação é feita no banco de dados; nem administrador libera pelo portal.',
            'Cada ponto citado mostra o dado e os números dos chamados que o comprovam. O relatório avalia resultados registrados no portal, não perfil, saúde ou motivação.',
            'Os dados de cada mês ficam congelados, como uma ata. Gerar de novo cria uma nova versão; refazer o texto da análise guarda o texto anterior. Toda abertura e todo PDF ficam registrados.',
            'O texto da análise pode ser escrito por IA a partir dos números. A IA recebe só números e códigos: sem nomes, clientes ou textos de mensagens.',
          ],
          dica: 'O resultado de cada pessoa é conversado com ela na reunião individual do mês, com o plano de ação combinado em conjunto.',
          atencao: 'É apoio à decisão da gestão: nenhuma conclusão sobre uma pessoa é automática.',
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
            'Abas: Mensal (pódio e ranking do mês), Anual (estrelas acumuladas do ano; o vencedor só aparece quando a gestão revelar o resultado pelo índice final), Meu painel (seus chamados e estrelas) e Gestão do programa (gestor e admin).',
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
            'Resultado do ano: o vencedor sai do índice final (40% estrelas do ano, 40% % no prazo, 20% nota do cliente ajustada ao número de avaliações; mínimo de 10 chamados resolvidos). O ano é civil (1/1 a 31/12), então salve a data de fechamento em janeiro. A partir dela aparece o botão verde "Revelar o resultado": só então o índice é calculado e a classificação fica congelada. Ninguém vê o vencedor antes, nem a gestão.',
            'Antes de revelar, decida todas as extensões de prazo pendentes do ano: com pendência, o sistema não deixa revelar. Até lá, as abas Mensal e Anual mostram só as estrelas acumuladas, sem medalhas no anual.',
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
            'Empresa, colaborador, função, e-mail e curso no EAD. Escolha a empresa primeiro: ao digitar o nome, aparecem os colaboradores dela que já têm certificado; clique no nome para preencher função e e-mail do cadastro. O e-mail é a chave para buscar o progresso na plataforma.',
            'Origem do progresso: Plataforma (EAD) atualiza sozinha toda manhã; Presencial (manual) pede etapa (Agendado, Em andamento, Concluído) e %.',
            'Tipo, emissão, validade, observações e link do certificado. Se o certificado não tem prazo, marque "Este certificado não vence": ele vai para Sem vencimento, e não para Validade não informada. Clique em Registrar certificado.',
          ],
          atencao: 'Sem a data de validade, o certificado não entra nos alertas de vencimento nem no Boletim de Antecedência. Deixe a validade em branco sem marcar "não vence" só quando a data realmente não for conhecida: ele aparece como Validade não informada, uma pendência a corrigir.',
        },
        {
          titulo: 'Acompanhar vencimentos',
          passos: [
            'Validade dos certificados: Vencidos, Vencem em até 90 dias (com quantos em até 30), Em dia (mais de 90 dias), Sem vencimento, Validade não informada e, quando houver, Histórico (substituído). Cada certificado entra em uma só faixa, então os cartões somam o total. Clique num cartão para filtrar a lista.',
            'Histórico (substituído): pode cadastrar certificados antigos, já renovados, para guardar o histórico. O portal reconhece sozinho: quando a mesma pessoa (mesmo nome, na mesma empresa) tem outro certificado do mesmo curso com emissão mais nova, o antigo vira "Substituído · renovado em dd/mm/aaaa". Ele não vira linha da lista: fica dentro do cadastro do atual (botão "↺ N anteriores" na linha e seção "Histórico deste certificado" no painel de edição, com o link e "Abrir"); só aparece como linha com o filtro/cartão "Histórico". Não conta como vencido nem a vencer, não entra no Boletim de Antecedência e não soma nos cartões do Painel. Sem emissão, a comparação usa a validade; datas iguais não substituem.',
            'CPF do colaborador: o cadastro do certificado tem o campo CPF. Com ele, o portal junta todos os certificados da mesma pessoa na mesma empresa, mesmo com o nome escrito de formas diferentes (ex.: "Pedro Luis" e "Pedro Luis Fregadolli"): histórico, "Por colaborador" e desligamento passam a valer para a pessoa. Ao escolher um colaborador já cadastrado na lista de sugestões, o CPF vem junto. Sem CPF, vale o nome. A busca também acha pelo CPF (com ou sem pontos).',
            'Reciclagem (novo certificado): abra o certificado atual (⋯ > Editar) e clique em "+ Lançar novo certificado". Pessoa e curso já vêm preenchidos; informe emissão, validade e link e salve. O novo vira o atual e o anterior vai para o histórico do cadastro, sem apagar nada. Não sobrescreva a emissão do atual para registrar uma reciclagem: assim o certificado antigo se perde. Editar a emissão serve só para corrigir erro de digitação.',
            'Treinamento: concluídos (100%), em andamento, não iniciados e sem dados de progresso. É outra régua, independente da validade; também filtra ao clicar.',
            'Concluído no EAD aguardando certificado: quem chegou a 100% no Maestrus e ainda não tem o certificado atualizado (sem emissão/validade/arquivo, ou a matrícula concluída começou depois da emissão registrada) vai para o topo da lista, com a linha verde piscando e "✓ Concluído · atualizar certificado". Em "Por colaborador", a pessoa sobe para o início. O chip "concluídos no EAD aguardando certificado" e o filtro de Situação mostram só esses. Para parar de piscar, emita o certificado e lance a nova emissão, validade e arquivo. Presencial, histórico e desligado não entram.',
            'Aba Certificados: busca (colaborador, função, e-mail ou curso, sem ligar para acento ou ordem), empresa, situação, "Mais filtros" (tipo, origem, mês) e Limpar. "Por colaborador" agrupa os cursos de cada pessoa. A lista mostra 25 por página; "‹ Anterior" e "Próxima ›" ficam no topo e no fim da lista. A tela carrega todos os certificados cadastrados, sem o antigo limite de 1.000 registros; com muitos certificados ela pode levar alguns segundos a mais para abrir.',
            'Menu ⋯ em cada linha: Editar abre o formulário lateral; Remover pede confirmação antes de apagar.',
            'Colaborador desligado: no menu ⋯ da linha ou no cabeçalho da pessoa em "Por colaborador", clique em "Marcar como desligado", informe a data (vem com hoje) e, se quiser, o motivo, e confirme. Os certificados dessa pessoa somem da lista, dos cartões, da Análise mensal, do Painel, do Boletim de Antecedência, da tela e do aviso de Treinamentos (e ela deixa de ser procurada no EAD). Nada é apagado: marque "Mostrar desligados" para vê-los com a pílula cinza "Desligado em dd/mm/aaaa" e use "Reativar" para voltar a contar. O desligamento vale acima do Histórico. O cliente também pode marcar e reativar, só nas empresas dele. A pessoa é reconhecida pelo nome na empresa (acento, maiúsculas e espaços não importam), a mesma regra do Histórico.',
            'Tempo de estudo no EAD (Certificados e Treinamentos): a leitura do EAD abre o relatório de desempenho de cada matrícula iniciada no Maestrus e guarda o tempo total das aulas online (igual à "Frequência Total") e o tempo por dia. Aparece abaixo do progresso como "⏱ 8h47 no EAD · 28/10: 7h58"; clique para ver dia a dia. O cliente vê o mesmo, só dos colaboradores dele. O Maestrus guarda o tempo por aula, não por acesso: cada aula conta no dia em que foi finalizada e a aula em andamento conta no dia da última atividade (uma aula começada num dia e terminada no outro conta toda no dia em que terminou). Concluído e já lido não é relido. Se a leitura apertar no tempo, o restante fica para a próxima, sem apagar o tempo já gravado. O CSV traz as colunas "Tempo no EAD" e "Tempo por dia no EAD". Depende do SQL supabase/treinamentos-tempo-por-dia.sql.',
            'Atualizar progresso do EAD com uma empresa escolhida no filtro: lê só os colaboradores dessa empresa (mais rápido, e o tempo de estudo entra na mesma hora). Sem empresa escolhida, lê todos os clientes; nesse caso o tempo de estudo pode ficar para a leitura das 06h40.',
            '⤓ Exportar baixa a lista filtrada em CSV (abre no Excel).',
            'Aba Análise mensal: o Painel por tipo e mês completo (lançados, 100%, presenciais, sem data de emissão e a matriz). O mês atual vem destacado e a cor mais forte indica mais certificados; clique num número para ver esses certificados na lista.',
            'Toda segunda-feira o Boletim de Antecedência é enviado por e-mail aos clientes e à equipe com o que vence em 90, 30 e 7 dias.',
          ],
          dica: '"Sem data de emissão" (Análise mensal) não é o mesmo que "Validade não informada" (cartões): um fala da emissão, o outro do vencimento. Para o Histórico funcionar, escreva o nome do colaborador igual nos dois cadastros (acento e maiúsculas não importam) e deixe claro no curso o que muda dentro da NR: NR-10 Básico x SEP, NR-33/35 Supervisor, nível da NR-20, equipamento da NR-11 e máquina da NR-12. Na dúvida, o portal NÃO junta: o antigo continua aparecendo como vencido.',
        },
      ],
    },

    {
      id: 'documentos',
      titulo: 'Documentos SST',
      rotas: ['/documentos'],
      slides: [
        {
          titulo: 'Cadastrar um documento',
          texto: 'Controle de PGR, PCMSO, AET, AEP, LTCAT, laudos, PCA, PPR e outros tipos, por empresa e unidade.',
          tela: {
            url: '/documentos',
            blocos: [
              menu('Documentos SST'),
              { t: 'topo', sobre: 'Todos os clientes', titulo: 'Documentos SST', botoes: ['Exportar', '+ Novo tipo de documento', '+ Novo documento'] },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Empresa', valor: 'Empresa A', obrigatorio: true }, { rotulo: 'Unidade / contrato', valor: 'Matriz' }, { rotulo: 'Tipo', valor: 'PGR', obrigatorio: true }, { rotulo: 'Versão', valor: 'Rev. 02' }, { rotulo: 'Título', valor: 'PGR — Unidade Porto Velho', largo: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Emissão', valor: '20/11/2025' }, { rotulo: 'Vencimento', valor: '20/11/2027' }, { rotulo: 'Próxima revisão', valor: '20/11/2026' }] },
              { t: 'campos', n: 3, itens: [{ rotulo: 'Responsável pelo acompanhamento', valor: 'Ana' }, { rotulo: 'Responsável técnico', valor: 'Nome · CREA' }, { rotulo: 'Link do documento assinado', valor: 'https://...', largo: true }] },
              { t: 'botoes', itens: [{ rotulo: 'Cadastrar documento', primario: true }] },
            ],
          },
          passos: [
            'Clique em "+ Novo documento". Empresa, unidade/contrato/estabelecimento (diferencia documentos da mesma empresa), tipo, versão e título.',
            'Datas: emissão, vencimento e próxima revisão são campos separados. Se o documento não tem vencimento fixo, marque "Não possui vencimento fixo" e programe a revisão.',
            'Responsável pelo acompanhamento (quem da equipe providencia a renovação), responsável técnico (quem elaborou), link do documento assinado (SharePoint, Drive...) e observações.',
            'Alertas antes do prazo: marque 90, 60, 30, 15 e/ou 7 dias. Valem para o vencimento e para a revisão programada.',
            'Mudou o processo, a função, o ambiente ou o número de trabalhadores? Marque "Revisão pendente por alteração das condições" e escreva o que mudou.',
          ],
          atencao: 'Não existe validade automática por tipo: cada documento segue o critério dele. A data cadastrada não garante que o conteúdo continua atualizado.',
        },
        {
          titulo: 'Acompanhar prazos e assinaturas',
          passos: [
            'Prazos: Cadastrados, Vencidos, A vencer em até 30 dias, 31 a 60 e 61 a 90. Cada documento entra numa faixa só; clique num cartão para filtrar.',
            'Assinatura e revisão: "Sem link assinado" e "Revisões pendentes" (marcadas à mão ou com a data de revisão vencida). É outro controle: um documento pode estar no prazo e sem a versão assinada.',
            'Filtros por empresa, unidade, tipo, responsável e situação. A lista vem ordenada pelo próximo prazo (vencimento ou revisão, o que vier antes).',
            '"Abrir assinado" abre o arquivo; sem link, "+ Inserir link" abre o cadastro.',
            'Menu ⋯: Editar, Renovar / Nova revisão, Histórico de revisões e Remover (pede confirmação; não apaga o arquivo no SharePoint/Drive).',
          ],
        },
        {
          titulo: 'Renovar e alertas automáticos',
          passos: [
            '"Renovar / Nova revisão" abre o cadastro copiado: preencha as novas datas, a versão e o link. A versão anterior vai para o histórico com o link preservado.',
            'Todo dia útil, às 08h10 de Porto Velho, o portal envia e-mail quando um prazo chega a um dos marcos marcados no documento e quando vence: um aviso por marco.',
            'O cliente recebe os da empresa dele. Na equipe, recebe o responsável pelo acompanhamento; sem responsável, gestores e administradores.',
            '"+ Novo tipo de documento" amplia a lista (ex.: Laudo de SPDA). Tipo desativado sai do cadastro, mas os documentos dele continuam.',
            'O cliente vê os documentos da empresa dele, abre o assinado e pode clicar em "Solicitar renovação", que abre um chamado em Documentos já preenchido e ligado ao documento.',
            'Chamado automático: faltando 60 dias ou menos para o próximo prazo (vencimento ou revisão) e sem chamado ligado ao documento, o portal abre sozinho um chamado de renovação para a empresa, em Documentos, prioridade Normal, já com o responsável pelo acompanhamento. Ele aparece na coluna Situação como "Chamado #N".',
            'Para um documento que a empresa trata por conta própria, desmarque "Abrir chamado de renovação automaticamente" no cadastro (o e-mail de alerta continua). A equipe também pode abrir o chamado antes pelo menu ⋯ "Abrir chamado de renovação".',
          ],
          dica: 'Marco que cair em fim de semana ou feriado sai no próximo dia útil.',
          link: { href: '/documentos', rotulo: 'Abrir Documentos SST' },
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
            'Aviso ao cliente às segundas e sextas (7h30, exceto feriado cadastrado; se cair em feriado, não envia naquele dia): cada empresa com a ferramenta Treinamentos recebe por e-mail os treinamentos em aberto (certificado ainda não emitido e curso não concluído) de cada colaborador, com percentual e "sem avanço há N dias". Concluídos aparecem uma vez. Empresa sem pendência, sem a ferramenta ou interna não recebe. Cada envio fica registrado; no máximo um por empresa por dia. A prévia sem envio fica em /api/cron/treinamentos-andamento?previa=1 (equipe logada).',
          ],
          dica: 'A leitura automática do EAD roda todo dia às 05h de Porto Velho. Certificados de origem manual não são alterados por ela. Quando o curso no EAD não traz "NR" no nome (ex.: "Integração de Segurança e Saúde Ocupacional"), o portal casa pelo nome do curso; se mesmo assim aparecer "Não informado", confira o e-mail e o curso no EAD do certificado.',
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
            'Quem mandou mensagem nova sobe para o topo da lista, em "Novas mensagens" (a mais recente primeiro), piscando e em negrito até você abrir a conversa. Nas demais seções, as conversas mais recentes ficam em cima.',
            'Abaixo de cada mensagem privada que você enviou: ✓ cinza = entregue; ✓✓ verde = a pessoa abriu a conversa e leu (passe o mouse para ver quando).',
            'O campo de escrever cresce com o texto. Enter envia; Shift+Enter quebra a linha.',
            'Reações: ☺+ abaixo da mensagem (👍 ❤️ 😂 😮 🙏 ✅), uma por pessoa; clicar de novo retira. Passe o mouse para ver quem reagiu.',
            '🎤 grava áudio de até 2 minutos (o navegador pede permissão do microfone na primeira vez): "Enviar áudio" manda, "Descartar" apaga. 📷 envia imagem (JPG, PNG ou WEBP até 10 MB); também dá para colar um print com Ctrl+V. O texto escrito no campo vai junto como legenda da imagem. Só quem está na conversa abre os arquivos.',
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
            'Ferramentas contratadas pelo cliente: marque Certificados, Treinamentos e/ou Documentos SST conforme o contrato. Empresa nova começa sem nenhuma. Sem a marcação, o cliente vê a ferramenta com cadeado, não acessa os dados dela nem recebe os e-mails automáticos dela, e pode clicar em "Solicitar contratação", que abre um chamado em Atendimento administrativo. A equipe continua vendo e controlando tudo.',
          ],
          dica: 'A marca define as cores do portal e dos e-mails para o cliente. O e-mail da empresa recebe os avisos dos chamados abertos para toda a empresa. Empresa não é excluída: marque como Inativa. Contratação aprovada? Edite a empresa, marque a ferramenta e salve: libera na hora para todos os usuários dela.',
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
            'Cliente que cuida de vários CNPJs: marque em "Outras empresas que pode atender" (só gestor e admin). A empresa do campo Empresa é a principal. No portal, ele troca de empresa no topo da tela e escolhe a empresa ao abrir o chamado. Ele vê uma empresa por vez, mas recebe os e-mails de todas.',
            'E-mail já cadastrado? A tela avisa e oferece "Acrescentar ao acesso de…": a empresa entra na lista da pessoa e a senha dela não muda. Não crie um segundo e-mail para a mesma pessoa.',
            'Equipe interna: "Pode atender chamados fora do horário" libera a pessoa da trava de horário (seg a sex, 8h às 17h). Só administrador marca; na lista aparece "fora do horário".',
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
                  ['Andamento dos treinamentos', 'Segunda e sexta, 07h30', 'E-mail ao cliente com treinamentos em aberto'],
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
