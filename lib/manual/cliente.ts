import type { Bloco, Manual } from './tipos'

/*
 * MANUAL DO CLIENTE.
 * Linguagem simples, para quem nunca usou o portal.
 * Regra do projeto: toda alteração que o cliente vê ou que o afeta
 * entra aqui no mesmo PR (e a parte da equipe em interno.ts).
 */

const MENU = ['Início', 'Chamados', 'Colaboradores', 'EPI', 'Certificados', 'Documentos SST', 'Treinamentos', 'Conversas', 'Contratar']
const menu = (ativo: string, n?: number): Bloco => ({ t: 'menu', itens: MENU, ativo, n })

const manualCliente: Manual = {
  titulo: 'Manual do Cliente',
  publico: 'Portal do Cliente · ÁgilMed & Real Life',
  capitulos: [
    {
      id: 'boas-vindas',
      titulo: 'Boas-vindas e como navegar',
      rotas: ['/perfil'],
      slides: [
        {
          titulo: 'Bem-vindo ao Portal do Cliente',
          texto:
            'O portal é o canal oficial entre a sua empresa e a nossa equipe. Por aqui você pede atendimento, acompanha cada pedido até o fim, conversa com quem está cuidando dele e consulta os certificados e treinamentos dos seus colaboradores.',
          passos: [
            'Chamados: pedidos à nossa equipe, com prazo e histórico.',
            'Certificados: validade dos treinamentos e exames de cada colaborador.',
            'Documentos SST: prazos, revisões e versões assinadas de PGR, PCMSO, laudos e programas da sua empresa.',
            'Treinamentos: andamento de cada colaborador nos cursos a distância (EAD).',
            'Conversas: mensagens rápidas e privadas com a nossa equipe.',
          ],
          dica: 'Use as setas do teclado (← →) ou os botões lá embaixo para passar os slides. O botão Índice leva direto a qualquer assunto.',
        },
        {
          titulo: 'Entrar no portal',
          texto: 'Seu acesso é criado pela nossa equipe. Você recebe por e-mail o endereço do portal e uma senha inicial.',
          tela: {
            url: '/login',
            blocos: [
              { t: 'topo', sobre: 'ÁgilMed & Real Life', titulo: 'Acesso ao Portal', sub: 'Entre com seus dados para acessar os serviços da sua empresa.' },
              { t: 'campos', n: 1, itens: [{ rotulo: 'E-mail', valor: 'seu@email.com', largo: true }, { rotulo: 'Senha', valor: '••••••••', largo: true }] },
              { t: 'botoes', n: 2, itens: [{ rotulo: 'Entrar no Portal', primario: true }] },
            ],
          },
          passos: ['Digite o e-mail cadastrado e a sua senha.', 'Clique em Entrar no Portal. Você cai na tela Início.'],
          atencao:
            'Se aparecer "E-mail ou senha inválidos", confira o que digitou. Se esqueceu a senha, fale com a nossa equipe: ela cria uma nova senha para você.',
        },
        {
          titulo: 'O menu do portal',
          texto: 'O menu fica sempre no topo da tela, em qualquer página.',
          tela: {
            url: '/',
            blocos: [menu('Início', 1), { t: 'topo', titulo: 'Olá, Maria!', sub: 'Bem-vindo ao Portal do Cliente.' }],
          },
          passos: [
            'Clique no nome da área para ir até ela: Início, Chamados, Certificados, Documentos SST, Treinamentos, Conversas ou Contratar. A área aberta fica destacada.',
            'Áreas com cadeado são ferramentas contratadas à parte (Certificados, Treinamentos, Documentos SST). Ao clicar, você vê o que a ferramenta resolve, o que ela entrega e como contratar. O botão "Quero uma proposta" abre um chamado já preenchido para a nossa equipe enviar a proposta.',
            'Contratar reúne tudo o que dá para contratar: as ferramentas do portal (com cadeado quando a sua empresa ainda não tem), serviços e cursos, cada um com o botão "Pedir orçamento". Em "Seus pedidos" você acompanha cada orçamento pedido e a situação dele.',
            'O botão "?" abre este manual já no assunto da tela em que você está.',
            'Atende mais de uma empresa (vários CNPJs)? No topo aparece "Empresa ▾": escolha a empresa e o portal mostra os chamados, certificados e documentos dela. Ao abrir um link de chamado recebido por e-mail, o portal troca sozinho para a empresa certa.',
            'Meu perfil (no topo, ao lado do "?") abre seus dados e a troca de senha. O botão Sair encerra o seu acesso: use sempre que estiver em um computador compartilhado.',
          ],
          dica: 'Se você ficar muito tempo parado, o portal pede para entrar de novo ("Sua sessão expirou"). É uma proteção: basta entrar outra vez.',
        },
        {
          titulo: 'Meu perfil e troca de senha',
          texto: 'Na tela Meu perfil você atualiza seus dados e troca a senha. Recomendamos trocar a senha inicial no primeiro acesso.',
          tela: {
            url: '/perfil',
            blocos: [
              { t: 'topo', sobre: 'Minha conta', titulo: 'Meu perfil', sub: 'Visualize e atualize seus dados pessoais.' },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Nome', valor: 'Maria Souza', obrigatorio: true }, { rotulo: 'E-mail', valor: 'maria@empresa.com.br' }, { rotulo: 'Telefone', valor: '(69) 99999-0000' }, { rotulo: 'Cargo', valor: 'Técnica de Segurança' }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Nova senha', valor: '••••••' }, { rotulo: 'Confirmar nova senha', valor: '••••••' }] },
              { t: 'botoes', itens: [{ rotulo: 'Alterar senha', primario: true }] },
            ],
          },
          passos: [
            'Em Dados pessoais, ajuste nome, telefone e cargo e clique em Salvar alterações. O e-mail de acesso não muda por aqui: peça à nossa equipe.',
            'Em Segurança, digite a nova senha duas vezes (mínimo de 6 caracteres) e clique em Alterar senha.',
          ],
          link: { href: '/perfil', rotulo: 'Abrir Meu perfil' },
        },
      ],
    },

    {
      id: 'inicio',
      titulo: 'Tela Início',
      rotas: ['/'],
      slides: [
        {
          titulo: 'O que a tela Início mostra',
          texto: 'É a primeira tela depois de entrar. Ela mostra as áreas do portal em ícones e os chamados mais recentes da sua empresa.',
          tela: {
            url: '/',
            blocos: [
              menu('Início'),
              { t: 'topo', titulo: 'Olá, Maria! O que você precisa hoje?', sub: 'Real Life SSMA' },
              { t: 'cartoes', n: 1, itens: [{ titulo: 'Atendimento', texto: '1 aguarda você' }, { titulo: 'Treinamentos EAD', texto: 'Abrir →' }, { titulo: 'Certificados', texto: 'Abrir →' }, { titulo: 'Documentos SST', texto: 'Conhecer e contratar' }] },
              { t: 'cartoes', n: 2, itens: [{ titulo: 'Abrir chamado', texto: '+ Abrir chamado' }, { titulo: 'Ver todos os chamados', texto: 'Lista completa' }] },
              { t: 'tabela', n: 3, colunas: ['Nº', 'Assunto', 'Situação', 'Prioridade'], linhas: [['#120', 'Atualizar PGR', 'Em atendimento', 'Normal'], ['#118', 'Agendar exames', 'Resolvido', 'Alta']], pilulas: 2 },
            ],
          },
          passos: [
            'Clique em um ícone para entrar na área. Em Atendimento, o selo avisa quantos chamados esperam a sua resposta. Área com cadeado é uma ferramenta que a sua empresa ainda não contratou: clique para conhecer e pedir a contratação.',
            'Atalhos: "Abrir chamado" abre um pedido e "Ver todos os chamados" mostra a lista completa.',
            'Chamados recentes: clique em uma linha para abrir o chamado. O botão "O que significa cada situação?" explica cada etapa.',
          ],
        },
        {
          titulo: 'Aviso "Você tem chamados para avaliar"',
          texto:
            'Quando um chamado que você pediu é resolvido, aparece no Início (e na lista de Chamados) um quadro amarelo piscando com os chamados que esperam a sua avaliação.',
          tela: {
            url: '/',
            blocos: [
              menu('Início'),
              { t: 'aviso', n: 1, tom: 'alerta', texto: '● Você tem 2 chamados para avaliar — Leva menos de 1 minuto.' },
              { t: 'tabela', n: 2, colunas: ['Nº', 'Assunto', 'Prazo', ''], linhas: [['#118', 'Agendar exames', 'Avalie até 25/10', 'Avaliar agora →'], ['#115', 'Laudo NR-10', 'Avalie até 27/10', 'Avaliar agora →']] },
            ],
          },
          passos: [
            'O quadro só aparece quando há avaliação pendente e some sozinho quando você avalia.',
            'Clique em "Avaliar agora": o portal abre o chamado já no cartão de avaliação.',
          ],
          atencao: 'Cada chamado recebe uma única avaliação, dentro do prazo mostrado. Depois do prazo, a avaliação não fica mais disponível.',
        },
        {
          titulo: 'Aviso vermelho: chamado aguardando a sua resposta',
          texto:
            'Quando um chamado fica em "Aguardando cliente" por mais dias que o combinado com a sua empresa (normalmente 7), aparece no Início e em Chamados um quadro vermelho piscando.',
          tela: {
            url: '/',
            blocos: [
              menu('Início'),
              { t: 'aviso', n: 1, tom: 'ruim', texto: '● 1 chamado aguarda a sua resposta — Precisamos de um retorno seu para continuar.' },
              { t: 'tabela', n: 2, colunas: ['Nº', 'Assunto', 'Aguardando', ''], linhas: [['#112', 'PCMSO 2027', 'desde 10/10 · 9 dias', 'Responder →']] },
            ],
          },
          passos: [
            'Clique em "Responder": o portal abre o chamado. Responda na conversa ou envie o que foi pedido; o chamado volta para a nossa equipe na hora e o aviso some.',
            'Enquanto o chamado aguardar a sua resposta, você também recebe um e-mail de lembrete a cada 3 dias úteis. O e-mail mostra de quem a resposta é esperada, quem abriu o chamado e o que a nossa equipe precisa.',
          ],
          dica: 'Se o pedido já foi atendido por outro meio, escreva isso na conversa para a equipe atualizar o chamado.',
        },
      ],
    },

    {
      id: 'abrir-chamado',
      titulo: 'Abrir um chamado',
      rotas: ['/chamados/novo'],
      slides: [
        {
          titulo: 'Quando abrir um chamado',
          texto:
            'Abra um chamado sempre que precisar de algo da nossa equipe: um documento, um exame, um treinamento, uma dúvida técnica ou administrativa. O chamado registra tudo, tem prazo de atendimento e fica no histórico da sua empresa.',
          passos: [
            'Um assunto por chamado: fica mais fácil de acompanhar e de cumprir o prazo.',
            'Para uma conversa rápida, sem necessidade de registro, use Conversas.',
            'Você chega à tela de abertura pelo botão "Novo chamado" (no Início, na lista de Chamados ou dentro de um chamado).',
            'Dúvida rápida, que não precisa de registro? O quadro ao lado do formulário leva direto a Conversas.',
            'Se você atende mais de uma empresa, escolha primeiro "Empresa do chamado": a tela recarrega com os dados dela e o chamado fica registrado nessa empresa.',
          ],
          link: { href: '/chamados/novo', rotulo: 'Abrir um chamado agora' },
        },
        {
          titulo: 'Passo 1: categoria, assunto e descrição',
          tela: {
            url: '/chamados/novo',
            blocos: [
              { t: 'topo', sobre: 'Central de atendimento', titulo: 'Abrir novo chamado' },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Categoria', valor: 'Segurança do Trabalho', obrigatorio: true, largo: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Assunto', valor: 'Atualizar PGR da filial Ariquemes', obrigatorio: true, largo: true }] },
              { t: 'campos', n: 3, itens: [{ rotulo: 'Descrição', valor: 'Mudamos o layout do galpão e incluímos 2 funções novas...', obrigatorio: true, largo: true }] },
            ],
          },
          passos: [
            'Categoria: escolha a área do pedido (Saúde Ocupacional, Segurança do Trabalho, Exames, Treinamentos, Documentos, eSocial, Atendimento administrativo, Financeiro ou Outros). Ela direciona o chamado para a equipe certa.',
            'Assunto: resuma em poucas palavras (até 150 caracteres).',
            'Descrição: explique com detalhes o que precisa, onde, para quando e o que mudou. Quanto mais completa, mais rápido conseguimos ajudar.',
          ],
        },
        {
          titulo: 'Passo 2: prioridade',
          texto: 'A prioridade define o prazo de atendimento, contado em horas úteis.',
          tela: {
            url: '/chamados/novo',
            blocos: [
              {
                t: 'opcoes',
                n: 1,
                itens: [
                  { rotulo: 'Baixa', desc: '48 horas úteis (6 dias úteis)' },
                  { rotulo: 'Normal', desc: '24 horas úteis (3 dias úteis)', ativo: true },
                ],
              },
              { t: 'texto', n: 2, texto: 'As prioridades Alta e Urgente são definidas pela nossa equipe após a análise do chamado.' },
            ],
          },
          passos: [
            'Escolha Baixa ou Normal. Já vem marcada Normal.',
            'Alta (8 horas úteis) e Urgente (4 horas úteis) são definidas só pela nossa equipe, depois de analisar o caso. Se for crítico, explique o impacto na descrição: a equipe avalia e pode subir a prioridade.',
          ],
          dica: 'Horas úteis são de segunda a sexta, das 8h às 12h e das 13h às 17h (horário de Porto Velho). Fim de semana e feriado não contam.',
        },
        {
          titulo: 'Passo 3: link e quem pode ver',
          tela: {
            url: '/chamados/novo',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Nome do link (opcional)', valor: 'Planilha de exames' }, { rotulo: 'Endereço', valor: 'https://drive.exemplo.com/...' }] },
              {
                t: 'opcoes',
                n: 2,
                itens: [
                  { rotulo: 'Só pessoas selecionadas', desc: 'Quem abriu e quem for marcado abaixo.', ativo: true },
                  { rotulo: 'Toda a empresa', desc: 'Todos os usuários da empresa veem o chamado.' },
                ],
              },
              { t: 'checklist', n: 3, itens: [{ texto: 'João Lima · joao@empresa.com.br', feito: true }, { texto: 'Ana Reis · ana@empresa.com.br' }] },
            ],
          },
          passos: [
            'Link de acesso (opcional): se o material está numa pasta compartilhada ou em outro sistema, informe o nome e o endereço. Dá para incluir mais links depois.',
            'Quem vê o chamado: "Só pessoas selecionadas" (padrão) deixa o chamado visível só para você e quem você marcar. "Toda a empresa" libera para todos os usuários da sua empresa.',
            'Marque os colegas que devem acompanhar. Nossa equipe sempre tem acesso.',
          ],
        },
        {
          titulo: 'Passo 4: enviar',
          tela: {
            url: '/chamados/novo',
            blocos: [
              { t: 'aviso', tom: 'neutro', texto: 'Anexos: após abrir o chamado, você poderá enviar documentos, imagens e outros arquivos.' },
              { t: 'botoes', n: 1, itens: [{ rotulo: 'Cancelar' }, { rotulo: 'Abrir chamado →', primario: true }] },
            ],
          },
          passos: [
            'Clique em "Abrir chamado". O portal mostra a tela do chamado criado, com número e prazo.',
          ],
          texto:
            'Depois de enviar, você recebe um e-mail "Recebemos o chamado #N" com o prazo de atendimento e a posição na fila da área. A nossa equipe é avisada na hora.',
          dica: 'Os arquivos (fotos, PDFs, planilhas) são enviados dentro do chamado, logo depois de abri-lo. Veja o capítulo "Acompanhar um chamado".',
        },
      ],
    },

    {
      id: 'lista-chamados',
      titulo: 'Lista de chamados',
      rotas: ['/chamados'],
      slides: [
        {
          titulo: 'Encontrar um chamado',
          tela: {
            url: '/chamados',
            blocos: [
              menu('Chamados'),
              { t: 'topo', sobre: 'Sua empresa', titulo: 'Chamados', botoes: ['Novo chamado'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Total', valor: '24' }, { rotulo: 'Em aberto', valor: '3' }, { rotulo: 'Urgentes', valor: '0' }, { rotulo: 'Resolvidos', valor: '21' }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Buscar', valor: 'PGR' }, { rotulo: 'Situação', valor: 'Só os em aberto' }] },
              { t: 'tabela', n: 3, colunas: ['Nº', 'Assunto', 'Situação', 'Prioridade', 'Aberto em'], linhas: [['#120', 'Atualizar PGR', 'Em atendimento', 'Normal', '14/10/26'], ['#112', 'PCMSO 2027', 'Aguardando cliente', 'Alta', '02/10/26']], pilulas: 2 },
            ],
          },
          passos: [
            'Os números mostram o total de chamados que você pode ver, quantos estão em aberto, urgentes e resolvidos.',
            'Busque pelo assunto, número, categoria ou por um nome escrito na descrição, e filtre pela situação (por exemplo, "Só os em aberto"). Acentos e ordem das palavras não importam.',
            'Clique em uma linha para abrir o chamado.',
          ],
          dica: 'Você vê os chamados abertos para toda a empresa, os que você abriu e aqueles em que foi marcado. Um chamado restrito de um colega não aparece para você.',
        },
      ],
    },

    {
      id: 'acompanhar',
      titulo: 'Acompanhar um chamado',
      rotas: ['/chamados/*'],
      slides: [
        {
          titulo: 'Visão geral da tela do chamado',
          tela: {
            url: '/chamados/…',
            blocos: [
              { t: 'topo', sobre: 'Chamado #120', titulo: 'Atualizar PGR da filial Ariquemes', botoes: ['+ Novo chamado'] },
              {
                t: 'duas',
                esquerda: [
                  { t: 'campos', n: 1, itens: [{ rotulo: 'Situação', valor: 'Em atendimento' }, { rotulo: 'Prazo de atendimento', valor: '21/10 15:00' }, { rotulo: 'Atendente', valor: 'Priscila' }] },
                  { t: 'chat', n: 2, msgs: [{ autor: 'Assistente virtual', etiqueta: 'Mensagem automática', texto: 'Seu chamado está em atendimento.' }, { autor: 'Priscila', etiqueta: 'Equipe', texto: 'Pode enviar a lista de funções atualizada?' }] },
                ],
                direita: [
                  { t: 'checklist', n: 3, itens: [{ texto: 'Visita técnica', feito: true }, { texto: 'Emissão do documento' }] },
                  { t: 'botoes', n: 4, itens: [{ rotulo: 'Selecionar arquivo', primario: true }] },
                ],
              },
            ],
          },
          passos: [
            'No alto: a situação do chamado, a barra de etapas (Aberto, Em atendimento, Resolvido, Encerrado), o prazo de atendimento e quem está cuidando.',
            'Logo abaixo, a conversa com a equipe e a caixa para responder.',
            'Etapas do atendimento: o que já foi feito e o que falta, com percentual.',
            'Anexos e links: envie e consulte arquivos e endereços ligados ao chamado. Categoria, quem abriu, datas, posição entre os chamados da área e a descrição ficam em "Detalhes do chamado": clique para abrir.',
          ],
        },
        {
          titulo: 'As situações do chamado',
          texto: 'Todo chamado passa por estas situações. A explicação da situação atual aparece no alto do chamado, em Situação do chamado.',
          tela: {
            url: '/chamados/…',
            blocos: [
              {
                t: 'cartoes',
                itens: [
                  { titulo: 'Aberto', texto: 'Chegou e ainda não foi assumido. O prazo já corre.' },
                  { titulo: 'Em atendimento', texto: 'Um atendente está trabalhando nele.' },
                  { titulo: 'Aguardando cliente', texto: 'Precisamos de algo seu. Prazo pausado.' },
                  { titulo: 'Atendimento suspenso', texto: 'Impedimento fora do nosso controle. Prazo pausado.' },
                  { titulo: 'Resolvido', texto: 'Solução entregue, aguardando sua conferência.' },
                  { titulo: 'Encerrado', texto: 'Finalizado. Para continuar o assunto, abra um novo chamado ligado a ele.' },
                  { titulo: 'Cancelado', texto: 'Encerrado sem atendimento. Você vê o motivo.' },
                ],
              },
            ],
          },
          passos: [
            'Aberto → Em atendimento: um atendente assumiu. Você não precisa fazer nada.',
            'Aguardando cliente: a bola está com você. Responda na conversa ou envie o que foi pedido. Enquanto isso, o prazo fica pausado.',
            'Se o chamado ficar em Aguardando cliente além do prazo combinado com a sua empresa (normalmente 7 dias), aparece um aviso vermelho piscando no Início e em Chamados, e você recebe um e-mail de lembrete a cada 3 dias úteis até responder.',
            'Atendimento suspenso: o atendimento parou por um impedimento fora do nosso controle (sistema indisponível, falha de software, fornecedor). Você vê o motivo e a data prevista da próxima atualização, e o prazo fica pausado. Se a previsão mudar, a nova data aparece no chamado e você recebe uma mensagem automática. Se a data chegar e a equipe ainda estiver tratando, aparece "Próxima atualização: em andamento pela equipe".',
            'Resolvido: confira a solução e use os botões do chamado: "Sim, pode encerrar" ou "Não, reabrir" (conte o que falta). Agradecer ou comentar na conversa não reabre o chamado. Sem resposta em 24 horas úteis, ele é encerrado sozinho.',
            'Encerrado: sem resposta em 24 horas úteis depois de resolvido, o chamado é encerrado automaticamente. Chamado encerrado não reabre e não recebe mais mensagens. Se o assunto voltar, use o botão "Abrir novo chamado sobre este assunto" no próprio chamado: o novo fica ligado ao anterior e a equipe vê todo o histórico.',
            'Cancelado: o chamado foi encerrado sem atendimento (por exemplo, duplicado, aberto por engano ou desistência). O motivo aparece no chamado e você recebe e-mail. Se ainda precisar, responda na conversa ou abra um novo chamado.',
          ],
        },
        {
          titulo: 'Prazo de atendimento (SLA)',
          texto: 'O prazo mostra até quando a nossa equipe se compromete a resolver o chamado.',
          tela: {
            url: '/chamados/…',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Prioridade', valor: 'Normal' }, { rotulo: 'Prazo de atendimento', valor: '21/10/2026 15:00' }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Prazo de atendimento', valor: 'pausado até você responder' }] },
            ],
          },
          passos: [
            'O prazo conta só horas úteis: de segunda a sexta, das 8h às 12h e das 13h às 17h, horário de Porto Velho. Fim de semana, almoço, noite e feriados não contam.',
            'Quando o chamado está "Aguardando cliente", o prazo aparece como Pausado. Ele volta a contar assim que você responder.',
            'Em "Atendimento suspenso" o prazo também fica pausado e volta a contar quando o atendimento é retomado.',
          ],
          dica: 'Exemplo: um chamado Alta (8 horas úteis) aberto na sexta às 16h vence na segunda às 16h.',
        },
        {
          titulo: 'Conversar com a equipe',
          tela: {
            url: '/chamados/…',
            blocos: [
              { t: 'chat', n: 1, msgs: [{ autor: 'Priscila', etiqueta: 'Equipe', texto: 'Pode enviar a lista de funções atualizada?' }, { autor: 'Maria', etiqueta: 'Cliente', texto: 'Enviei em anexo. @Priscila confere, por favor.', eu: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Mensagem', valor: 'Digite sua mensagem...', largo: true }] },
              { t: 'botoes', itens: [{ rotulo: 'Enviar mensagem', primario: true }] },
            ],
          },
          passos: [
            'As mensagens aparecem em ordem, com quem escreveu e uma etiqueta: Cliente, Equipe ou Mensagem automática (avisos do sistema a cada mudança). Quando chega mensagem nova em um chamado seu, a aba Chamados ganha um balão vermelho piscando e o chamado aparece com o selo "nova" na lista; o aviso some quando você abre o chamado.',
            'Escreva e clique em Enviar mensagem. A equipe é avisada por e-mail. Escrevendo @Nome, a pessoa citada também recebe um e-mail.',
            'As respostas da equipe mostram o nome de quem respondeu e a etiqueta "Equipe Real Life" ou "Equipe ÁgilMed".',
            'Para reagir a uma mensagem, clique em ☺+ abaixo dela e escolha um emoji (👍 ❤️ 😂 😮 🙏 ✅). Cada pessoa deixa uma reação por mensagem; clicar de novo na sua retira, escolher outra troca. Passe o mouse sobre a reação para ver quem reagiu.',
          ],
          atencao:
            'Responder num chamado "Aguardando cliente" devolve o chamado para "Em atendimento". Em "Resolvido", a resposta fica na conversa e não reabre: para reabrir, use o botão "Não, reabrir". A tela não se atualiza sozinha: recarregue a página para ver respostas novas. Mensagens enviadas não podem ser editadas nem apagadas.',
        },
        {
          titulo: 'Enviar arquivos e links',
          tela: {
            url: '/chamados/…',
            blocos: [
              { t: 'botoes', n: 1, itens: [{ rotulo: 'Selecionar arquivo', primario: true }] },
              { t: 'tabela', n: 2, colunas: ['Arquivo', 'Tamanho', 'Ações'], linhas: [['PDF lista-funcoes.pdf', '320 KB', 'Abrir · Baixar']] },
              { t: 'campos', n: 3, itens: [{ rotulo: 'Nome do link (opcional)', valor: 'Fotos do galpão' }, { rotulo: 'Endereço', valor: 'https://...' }] },
            ],
          },
          passos: [
            'Anexos: clique em Selecionar arquivo e escolha o arquivo. Escolher ainda não anexa: aparece um quadro com o nome e o tamanho, e você confirma em Anexar arquivo ou desiste em Descartar. Vai um por vez, com até 10 MB cada.',
            'Abrir mostra o arquivo numa nova aba; Baixar salva no seu computador. Renomear corrige o nome que aparece na lista, e Excluir tira do chamado o arquivo que você mesmo enviou.',
            'Links de acesso: informe nome e endereço e clique em Adicionar. Cada link aparece com os botões Abrir, Editar e Remover.',
          ],
          atencao: 'Renomear muda só o nome que aparece na lista, nunca o arquivo. Se mandou o errado, exclua e envie de novo — assim a data nova fica registrada, em vez de um arquivo trocado por baixo do que a equipe já viu.',
        },
        {
          titulo: 'Etapas e quem vê o chamado',
          tela: {
            url: '/chamados/…',
            blocos: [
              { t: 'barra', n: 1, rotulo: '50% · 1 de 2 etapas concluídas', pct: 50 },
              { t: 'checklist', itens: [{ texto: 'Visita técnica — concluída em 15/10 10:30', feito: true }, { texto: 'Emissão do documento' }] },
              { t: 'opcoes', n: 2, itens: [{ rotulo: 'Só pessoas selecionadas', ativo: true }, { rotulo: 'Toda a empresa' }] },
            ],
          },
          passos: [
            'Etapas do atendimento: a equipe divide o trabalho em etapas e marca cada uma ao concluir. Você acompanha o percentual; não precisa marcar nada.',
            'Quem vê este chamado: quem abriu pode mudar entre "Só pessoas selecionadas" e "Toda a empresa" e marcar colegas, enquanto o chamado não estiver encerrado. Os demais só veem a lista.',
          ],
        },
      ],
    },

    {
      id: 'avaliar',
      titulo: 'Avaliar o atendimento',
      rotas: [],
      slides: [
        {
          titulo: 'Como avaliar',
          texto: 'Depois que o chamado é resolvido, quem pediu o chamado pode dizer como foi o atendimento. Leva menos de um minuto e ajuda a melhorar o serviço.',
          tela: {
            url: '/chamados/…',
            blocos: [
              { t: 'topo', titulo: 'Como foi seu atendimento?', sub: 'A avaliação é opcional e pode ser enviada uma única vez. Disponível até 25/10/2026.' },
              { t: 'opcoes', n: 1, itens: [{ rotulo: '⭐ Ruim' }, { rotulo: '⭐⭐ Bom' }, { rotulo: '⭐⭐⭐ Excelente', ativo: true }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Comentário (opcional)', valor: 'Atendimento rápido e claro.', largo: true }] },
              { t: 'botoes', n: 3, itens: [{ rotulo: 'Enviar avaliação', primario: true }] },
            ],
          },
          passos: [
            'Escolha uma nota: Ruim, Bom ou Excelente.',
            'Se quiser, escreva um comentário: o que gostou ou o que podemos melhorar.',
            'Clique em Enviar avaliação. Aparece "Obrigado! Sua avaliação foi registrada."',
          ],
          atencao: 'A avaliação é feita uma única vez e não pode ser alterada depois. Ela fica disponível até a data indicada no cartão.',
        },
        {
          titulo: 'Onde a avaliação aparece',
          passos: [
            'No Início e na lista de Chamados, um quadro amarelo piscando lista os chamados à espera da sua avaliação, com o selo "Avaliar" na linha do chamado.',
            'Você também recebe um e-mail "Como foi seu atendimento no chamado #N?" com o botão Avaliar o atendimento.',
            'O cartão de avaliação fica dentro do chamado, logo abaixo da conversa com a equipe.',
          ],
          dica: 'Quem avalia: quem abriu o chamado ou, quando a nossa equipe abriu o chamado por você, o solicitante indicado por ela. Se a equipe abriu sem indicar ninguém, qualquer usuário da empresa que veja o chamado pode avaliar. Vale a primeira avaliação.',
        },
      ],
    },

    {
      id: 'colaboradores',
      titulo: 'Colaboradores',
      rotas: ['/colaboradores'],
      slides: [
        {
          titulo: 'As pessoas da sua empresa',
          texto:
            'É a lista de quem trabalha na sua empresa, com CPF, matrícula e função. O portal usa este cadastro para saber que "João da Silva" e "JOAO SILVA" são a mesma pessoa e juntar os certificados dela.',
          tela: {
            url: '/colaboradores',
            blocos: [
              menu('Colaboradores'),
              { t: 'topo', sobre: 'Cadastro', titulo: 'Colaboradores', botoes: ['Novo colaborador'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Cadastrados', valor: '38' }, { rotulo: 'Sem CPF', valor: '4' }, { rotulo: 'Afastados', valor: '1' }, { rotulo: 'Desligados', valor: '3' }] },
              { t: 'tabela', n: 2, colunas: ['Nome', 'CPF', 'Matrícula', 'Função', 'Situação'], linhas: [['Marcos Pereira da Luz', '104.•••.•••-00', '1042', 'Pedreiro', 'Ativo'], ['Ana Cláudia Ribeiro', '228.•••.•••-11', '1088', 'Auxiliar de produção', 'Afastado']], pilulas: 4 },
            ],
          },
          passos: [
            'Os cartões mostram quantas pessoas estão cadastradas, quantas ainda estão sem CPF, quantas estão afastadas e quantas já foram desligadas.',
            'A lista veio preenchida com as pessoas que já apareciam nos seus certificados. Confira e complete o que faltar, principalmente o CPF.',
            '"Novo colaborador" abre o cadastro. Só o nome é obrigatório; CPF, matrícula, função e local de trabalho ajudam a identificar a pessoa certa.',
          ],
          dica: 'Preencher o CPF vale a pena: é o que junta todos os certificados da mesma pessoa, mesmo quando o nome foi escrito de formas diferentes ao longo dos anos.',
          atencao: 'Para registrar quem saiu da empresa, use "Desligar" em Certificados. O desligamento vale para o portal inteiro e aparece aqui sozinho — esta tela não desliga ninguém.',
          link: { href: '/colaboradores', rotulo: 'Abrir Colaboradores' },
        },
        {
          titulo: 'Obras, frentes e quem entrega',
          texto:
            'Em "Locais de trabalho" você cadastra as obras, frentes, unidades e setores da sua empresa — sem precisar pedir para ninguém. Depois é só escolher o local de cada pessoa, e a ficha de EPI passa a dizer onde ela estava no dia da entrega.',
          tela: {
            url: '/colaboradores/locais',
            blocos: [
              menu('Colaboradores'),
              { t: 'topo', sobre: 'Cadastros', titulo: 'Locais de trabalho', botoes: ['Novo local'] },
              { t: 'tabela', n: 1, colunas: ['Local', 'Tipo', 'Cidade/UF', 'CNO', 'Responsável', 'Pessoas'], linhas: [['Obra Jardins', 'Obra', 'Porto Velho/RO', '12.345.67890/12', 'Vitor Oliveira', '14'], ['Unidade Centro', 'Unidade', 'Porto Velho/RO', '—', 'Priscila Macedo', '6']] },
            ],
          },
          passos: [
            'Canteiro de obra tem CNO: o número de 12 dígitos que liga a obra ao eSocial e à NR-18. Os outros tipos de local podem ficar sem.',
            'Obra que acabou não se apaga: desmarque "Local em atividade". Ela sai das listas e continua nas fichas antigas, onde faz parte do registro.',
            'Em Colaboradores, marque "Esta pessoa entrega EPI" em quem é almoxarife ou encarregado. Na entrega, o nome dela passa a poder ser escolhido como responsável.',
          ],
          dica: 'O nome de quem entrega importa na ficha: sem marcar ninguém, sai o nome de quem estava com o portal aberto — que nem sempre é quem passou o equipamento para a mão do trabalhador.',
          link: { href: '/colaboradores/locais', rotulo: 'Abrir os Locais' },
        },
      ],
    },

    {
      id: 'epi',
      titulo: 'EPI · Entregas',
      rotas: ['/epi'],
      slides: [
        {
          titulo: 'Entregar EPI e colher a assinatura',
          texto:
            'A entrega é feita no celular, com o trabalhador na frente: você escolhe a pessoa, marca os equipamentos, tira a foto e salva. Na tela seguinte aparece um QR; ele aponta a câmera, confere o CPF e assina ali mesmo.',
          tela: {
            url: '/epi',
            blocos: [
              menu('EPI'),
              { t: 'topo', sobre: 'EPI', titulo: 'Entregas', botoes: ['Nova entrega'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Nos últimos 30 dias', valor: '38' }, { rotulo: 'Aguardando assinatura', valor: '6', tom: 'alerta' }, { rotulo: 'Com troca vencida', valor: '4', tom: 'ruim' }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Quem está recebendo', valor: 'Marcos Pereira da Luz · 1042 · Pedreiro' }, { rotulo: 'Equipamentos', valor: 'Luva de vaqueta · G · CA 41385' }, { rotulo: 'Foto da entrega', valor: 'obrigatória', obrigatorio: true }] },
              { t: 'aviso', n: 3, texto: 'Entrega registrada. Peça para ele apontar a câmera e assinar agora.', tom: 'bom' },
            ],
          },
          passos: [
            'Os cartões mostram o movimento dos últimos 30 dias, quantas entregas ainda não foram assinadas e quantas já passaram do prazo de troca.',
            'Em "Nova entrega", a pessoa vem do cadastro de Colaboradores e os equipamentos do cadastro de EPI — o CA e o prazo de troca entram sozinhos.',
            'A foto é obrigatória: o botão de registrar só funciona depois dela. Ela é reduzida no próprio aparelho antes de subir.',
            'Salvou, aparece o QR. Se o trabalhador não puder assinar na hora, a entrega fica como "Aguardando assinatura" e o link continua valendo.',
          ],
          atencao: 'Equipamento com CA vencido não pode ser marcado na entrega, e quem está sem CPF no cadastro não consegue assinar. Os dois casos aparecem avisados na própria tela.',
          dica: 'A entrega não é editada nem apagada depois de salva: ela registra um ato que aconteceu. Se algo saiu errado, cancele — o cancelamento fica registrado com o motivo.',
          link: { href: '/epi', rotulo: 'Abrir Entregas' },
        },
        {
          titulo: 'A ficha que a fiscalização pede',
          texto:
            'Em "Ficha", o portal monta uma folha por trabalhador com tudo que ele recebeu: equipamento, CA, motivo, prazo de troca, a foto da entrega e a data em que ele assinou. É o documento do item 6.6.1 da NR-06.',
          tela: {
            url: '/epi/ficha',
            blocos: [
              menu('EPI'),
              { t: 'topo', sobre: 'EPI', titulo: 'Ficha de entrega', botoes: ['Imprimir'] },
              { t: 'tabela', n: 1, colunas: ['Entrega', 'Equipamento', 'CA', 'Motivo', 'Trocar até', 'Assinatura'], linhas: [['17/11 08:40', 'Luva de vaqueta · G', '41385', 'Entrega', '17/02/2027', 'assinado 17/11 08:42'], ['02/09 14:10', 'Botina de segurança', '48413', 'Substituição', '02/03/2027', 'assinado 02/09 14:11']] },
            ],
          },
          passos: [
            'Escolha um trabalhador ou deixe em "Todos": sai uma ficha por página, pronta para imprimir ou salvar em PDF pelo próprio navegador.',
            'As fotos entram como miniatura ao lado de cada entrega. Dá para tirá-las da ficha desmarcando "Incluir as fotos".',
            'Entrega sem assinatura aparece marcada em vermelho — serve para você cobrar antes de a fiscalização aparecer.',
          ],
          dica: 'Entrega cancelada não entra na ficha. Para cancelar, use o botão "Cancelar" ao lado da data, na tela de Entregas; o motivo fica registrado.',
          link: { href: '/epi/ficha', rotulo: 'Abrir a Ficha' },
        },
        {
          titulo: 'Quando o EPI volta',
          texto:
            'Em cada entrega há "Editar / dar baixa". É onde você registra que o equipamento voltou — no fim da obra, na troca, quando estraga ou quando a pessoa é desligada. Sem isso a ficha diz que o trabalhador está com tudo que já recebeu na vida.',
          tela: {
            url: '/epi',
            blocos: [
              menu('EPI'),
              { t: 'topo', sobre: 'EPI', titulo: 'Entrega de Priscila', botoes: ['Fechar'] },
              { t: 'campos', n: 1, itens: [{ rotulo: 'Data e hora da entrega', valor: '17/11/2026 14:24', largo: true }, { rotulo: 'Trocar até', valor: '15/02/2027' }, { rotulo: 'Previsão de devolução', valor: '30/06/2027' }, { rotulo: 'Este equipamento voltou', valor: '17/11/2026 · Devolveu', largo: true }] },
            ],
          },
          passos: [
            'Marque "Este equipamento voltou", diga quando e por quê. Ele sai da conta do que está com a pessoa e passa a aparecer na coluna Devolução da ficha.',
            'Errou a baixa? Desmarque e salve: a devolução é desfeita, e o registro de que ela existiu fica guardado.',
            'Dá para corrigir a data da entrega, a observação e os prazos. O equipamento, o CA e a quantidade não: é o que está escrito na ficha que o trabalhador assinou.',
          ],
          dica: 'Previsão de devolução é diferente de "trocar até": trocar até é quando a vida útil acaba; previsão de devolução é quando você espera o equipamento de volta, como no fim de um contrato.',
          link: { href: '/epi', rotulo: 'Abrir as Entregas' },
        },
        {
          titulo: 'O painel do EPI',
          texto:
            'Em "Painel" você vê de uma olhada o que está vencido, quem ainda não assinou e quanto a sua empresa está entregando. O número de trocas vencidas é o primeiro item que a fiscalização cobra.',
          tela: {
            url: '/epi/painel',
            blocos: [
              menu('EPI'),
              { t: 'topo', sobre: 'EPI', titulo: 'Painel' },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Entregas no período', valor: '34' }, { rotulo: 'Aguardando assinatura', valor: '2' }, { rotulo: 'Com troca vencida', valor: '5' }, { rotulo: 'Devolvidos no período', valor: '7' }] },
            ],
          },
          passos: [
            'Os prazos olham tudo que está em uso hoje, não só o período: o EPI que a pessoa pegou há oito meses continua com ela.',
            'O resto dos números acompanha o período escolhido — 30 dias, 90 dias, 6 meses ou 1 ano.',
            '"Quem entregou" mostra o responsável de cada entrega. Para o nome certo aparecer aqui, marque em Colaboradores quem entrega EPI.',
          ],
          dica: 'Equipamento devolvido sai da conta de "em uso" e não cobra mais troca de ninguém. Por isso vale dar baixa assim que o EPI volta.',
          link: { href: '/epi/painel', rotulo: 'Abrir o Painel' },
        },
      ],
    },

    {
      id: 'epi-equipamentos',
      titulo: 'EPI · Equipamentos',
      rotas: ['/epi/equipamentos'],
      slides: [
        {
          titulo: 'Os equipamentos que você entrega',
          texto:
            'Cadastre aqui cada EPI com o número do CA, a validade do CA e de quantos em quantos dias ele é trocado. Na hora da entrega, escolher o equipamento já traz o CA e calcula a data da próxima troca.',
          tela: {
            url: '/epi/equipamentos',
            blocos: [
              menu('EPI'),
              { t: 'topo', sobre: 'EPI', titulo: 'Equipamentos', botoes: ['Novo equipamento'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Cadastrados', valor: '12' }, { rotulo: 'CA vencido', valor: '1', tom: 'ruim' }, { rotulo: 'CA vence em 60 dias', valor: '2', tom: 'alerta' }, { rotulo: 'Sem CA', valor: '0' }] },
              { t: 'tabela', n: 2, colunas: ['Equipamento', 'CA', 'Validade do CA', 'Troca a cada', 'Situação'], linhas: [['Luva de vaqueta · G', '41385', '30/06/2027', '3 meses', 'No prazo'], ['Óculos de proteção', '28976', '10/01/2027', '6 meses', 'Vence em 54 d']], pilulas: 4 },
            ],
          },
          passos: [
            'Os cartões mostram quantos equipamentos estão cadastrados e quantos estão com o CA vencido ou perto de vencer.',
            'A validade é a do Certificado de Aprovação, que o Ministério do Trabalho concede ao equipamento. Ela não é a validade do produto que está na sua prateleira.',
            '"Trocar a cada" é o prazo que usamos para marcar a próxima troca de quem recebeu. Vale a recomendação do fabricante ou o que a sua empresa pratica.',
            'Equipamento que saiu de linha: abra, marque "Fora de linha" e ele para de aparecer para entregar, sem sumir das entregas antigas.',
          ],
          atencao: 'EPI com CA vencido não pode ser entregue. É um dos primeiros itens que a fiscalização confere.',
          dica: 'Tamanho e cor entram no campo "Tamanho ou cor": luva P e luva G ficam como dois cadastros, porque na prática são dois itens diferentes no almoxarifado.',
          link: { href: '/epi/equipamentos', rotulo: 'Abrir Equipamentos' },
        },
      ],
    },

    {
      id: 'certificados',
      titulo: 'Certificados',
      rotas: ['/certificados'],
      slides: [
        {
          titulo: 'Acompanhar a validade dos certificados',
          texto: 'A área Certificados reúne os treinamentos e exames de cada colaborador da sua empresa, com o que vence primeiro no topo.',
          tela: {
            url: '/certificados',
            blocos: [
              menu('Certificados'),
              { t: 'topo', sobre: 'Sua empresa', titulo: 'Certificados', botoes: ['Relatório de treinamentos', 'Atualizar progresso do EAD', 'Exportar planilha'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Vencidos', valor: '0', tom: 'ruim' }, { rotulo: 'Vencem em até 90 dias', valor: '2', tom: 'alerta' }, { rotulo: 'Em dia', valor: '50', tom: 'bom' }, { rotulo: 'Validade não informada', valor: '1' }] },
              { t: 'tabela', n: 2, colunas: ['Colaborador', 'Curso / Modalidade', 'Progresso', 'Validade / Situação', 'Certificado'], linhas: [['João Lima', 'NR-35 · EAD', 'Concluído', 'Vence em 24 dias', 'Pedir reciclagem'], ['Ana Reis', 'NR-10 · Presencial', 'Concluído', 'Válido', 'Ver certificado']], pilulas: 3 },
            ],
          },
          passos: [
            'Os cartões de validade separam cada certificado em uma faixa: Vencidos, Vencem em até 90 dias, Em dia (mais de 90 dias), Sem vencimento (não tem prazo) e, quando houver, Validade não informada (falta a data no cadastro). Clique num cartão para ver só esses certificados.',
            'Histórico (substituído): quando o colaborador renova um treinamento, a lista mostra só o certificado atual. Os anteriores ficam guardados no histórico, com o documento: clique em "N anteriores" na linha do curso para vê-los. Eles não contam como vencido nem entra no e-mail de vencimentos.',
            'Certificado vencido ou que vence em até 90 dias ganha o botão "Pedir reciclagem": ele abre um chamado já preenchido com o curso e o colaborador. É só conferir, dizer se há mais gente para a mesma turma e enviar.',
            'Os certificados da mesma pessoa são reunidos pelo CPF dela, mesmo quando o nome aparece escrito de formas diferentes em certificados antigos.',
            'Quando um colaborador conclui 100% do curso no EAD e o certificado ainda não foi atualizado, ele aparece no topo da lista, com a linha verde piscando e "Concluído · atualizar certificado". É a nossa equipe emitindo o certificado; quando ele for lançado, o destaque some sozinho.',
            'Colaborador que saiu da empresa: no menu ⋯ da linha ou em "Por colaborador", clique em "Marcar como desligado", informe a data e, se quiser, o motivo. Os certificados dessa pessoa deixam de aparecer na lista, nos cartões e nos e-mails de vencimento e de treinamentos. Nada é apagado: marque "Mostrar desligados" para vê-los. "Editar desligamento" corrige a data ou o motivo, e "Reativar (recontratado)" volta a contar os certificados quando a pessoa for recontratada (os vencidos aparecem como vencidos).',
            'Treinamento que a sua empresa não vai mais fazer (a atividade deixou de existir, ou por decisão da empresa): peça à nossa equipe por chamado. O certificado fica guardado com a marcação "Não será renovado" e deixa de aparecer como vencido e nos e-mails de vencimento.',
            'Aba Certificados: busque por colaborador, função, e-mail ou curso e use os filtros (Mais filtros traz tipo, origem e mês). "Por colaborador" junta os cursos de cada pessoa. "Ver certificado" abre o documento, quando houver; "Exportar planilha" baixa a lista. O andamento dos cursos fica na tela Treinamentos.',
            'Aba Análise mensal: quantos certificados de cada tipo saíram em cada mês, com o mês atual destacado. Clique em um número para ver esses certificados na lista.',
          ],
          dica: 'Vermelho: vencido ou vence em até 30 dias. Amarelo: vence em até 90 dias. Programe a reciclagem antes de chegar no vermelho.',
        },
        {
          titulo: 'Atualizar o progresso do EAD',
          texto: 'O andamento dos cursos a distância é lido automaticamente da plataforma EAD todos os dias de manhã cedo.',
          passos: [
            'Se quiser o dado mais recente na hora, clique em "Atualizar progresso do EAD".',
            'O botão pode ser usado de novo depois de 10 minutos.',
            'Tempo de estudo no EAD: abaixo do progresso aparece o relógio com "8h47 no EAD · 28/10: 7h58" (tempo total nas aulas online e o tempo do dia mais recente). Clique para ver o tempo de cada dia. O EAD registra o tempo por aula, então cada aula conta no dia em que foi finalizada (a aula em andamento conta no dia da última atividade). O total é o mesmo da "Frequência Total" da plataforma EAD.',
            'Cadastro, correção e exclusão de certificados são feitos pela nossa equipe. Se algo estiver errado (inclusive um certificado em "Validade não informada"), abra um chamado na categoria Treinamentos ou Documentos.',
          ],
          link: { href: '/certificados', rotulo: 'Abrir Certificados' },
        },
      ],
    },

    {
      id: 'documentos',
      titulo: 'Documentos SST',
      rotas: ['/documentos'],
      slides: [
        {
          titulo: 'Prazos e documentos assinados',
          texto: 'Reúne os documentos de SST da sua empresa (PGR, PCMSO, AET, LTCAT, laudos e outros), com prazos e o arquivo assinado.',
          tela: {
            url: '/documentos',
            blocos: [
              menu('Documentos SST'),
              { t: 'topo', sobre: 'Sua empresa', titulo: 'Documentos SST', botoes: ['Exportar planilha'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Cadastrados', valor: '6' }, { rotulo: 'Vencidos', valor: '0', tom: 'ruim' }, { rotulo: 'A vencer em até 30 dias', valor: '1', tom: 'ruim' }, { rotulo: 'Sem link assinado', valor: '1' }] },
              { t: 'tabela', n: 2, colunas: ['Unidade', 'Documento', 'Próximo prazo', 'Situação', 'Arquivo'], linhas: [['Matriz', 'PGR · Rev. 02', '20/11/2026', 'Vence em 31 dias', 'Pedir renovação'], ['Obra', 'PCMSO · Rev. 01', '15/10/2027', 'No prazo', 'Abrir assinado']], pilulas: 3 },
            ],
          },
          passos: [
            'Os cartões mostram quantos documentos estão vencidos ou vencem em até 30, 60 e 90 dias, quantos ainda não têm a versão assinada no portal e quantos têm revisão pendente. Clique num cartão para filtrar.',
            'Na lista, "Próximo prazo" é o vencimento ou a revisão programada, o que vier antes. "Abrir assinado" abre o documento.',
            '"Pedir renovação", ao lado do arquivo, abre um chamado já preenchido para a nossa equipe. Depois de pedido, o documento mostra "Chamado #N". No menu de três pontos, "Histórico de revisões" mostra as versões anteriores com os links.',
            'Documento que a sua empresa decidiu não renovar é desativado pela nossa equipe: ele sai da lista, para de gerar avisos e fica na seção "Desativados · não serão renovados", no fim da tela, com a data e o motivo. Mudou de ideia? Fale com a nossa equipe para reativar.',
          ],
          atencao: 'Mudou processo, função, ambiente ou número de trabalhadores? Peça a revisão mesmo antes do prazo: a data no portal não garante que o conteúdo continua atualizado.',
          dica: 'Você recebe e-mail quando um documento se aproxima do vencimento ou da revisão programada. Se faltarem 60 dias ou menos e ninguém tiver pedido a renovação, abrimos o chamado automaticamente e ele aparece no documento como "Chamado #N".',
          link: { href: '/documentos', rotulo: 'Abrir Documentos SST' },
        },
      ],
    },

    {
      id: 'treinamentos',
      titulo: 'Treinamentos (relatório EAD)',
      rotas: ['/treinamentos'],
      slides: [
        {
          titulo: 'Relatório de treinamentos',
          texto: 'Mostra o andamento de cada colaborador nos cursos a distância.',
          tela: {
            url: '/treinamentos',
            blocos: [
              menu('Treinamentos'),
              { t: 'topo', sobre: 'Relatório', titulo: 'Treinamentos da sua equipe' },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Treinamentos', valor: '40' }, { rotulo: 'Concluídos', valor: '31', tom: 'bom' }, { rotulo: 'Em andamento', valor: '6', tom: 'alerta' }, { rotulo: 'Não iniciados', valor: '3', tom: 'ruim' }] },
              { t: 'grafico', n: 2 },
              { t: 'botoes', n: 3, itens: [{ rotulo: 'Atualizar do EAD' }, { rotulo: 'Baixar planilha', primario: true }] },
              { t: 'tabela', colunas: ['Colaborador', 'Curso', 'Progresso', 'Situação'], linhas: [['João Lima', 'NR-35', '100%', 'Concluído'], ['Ana Reis', 'NR-10', '40%', 'Em andamento']], pilulas: 3 },
            ],
          },
          passos: [
            'Concluído = 100%. Em andamento = começou. Não iniciado = 0%. Sem matrícula = não encontramos o colaborador no EAD.',
            '"Situação geral" e "Cursos que mais travam" mostram onde a turma está parada.',
            'Abaixo da barra de progresso aparece o tempo de estudo no EAD (total e do dia mais recente); clique para ver por dia. A planilha traz as colunas "Tempo no EAD" e "Tempo por dia no EAD".',
            '"Atualizar do EAD" busca o dado mais recente (de novo, só depois de 10 minutos). "Baixar planilha" gera a lista para abrir no Excel.',
            'Aviso por e-mail às segundas e sextas, por volta das 7h30 (Porto Velho), os usuários da empresa recebem os treinamentos ainda em aberto de cada colaborador, com o percentual e há quantos dias não avança. Concluídos aparecem uma vez, no aviso seguinte. Sem treinamento em aberto, o e-mail não é enviado.',
          ],
          dica: 'Colaborador "Não iniciado" ou travado? Cobre internamente e, se precisar de apoio, abra um chamado na categoria Treinamentos.',
        },
      ],
    },

    {
      id: 'conversas',
      titulo: 'Conversas',
      rotas: ['/equipe'],
      slides: [
        {
          titulo: 'Conversas rápidas com a equipe',
          texto: 'Conversas é um chat privado entre você e uma pessoa da nossa equipe. Serve para dúvidas rápidas.',
          tela: {
            url: '/equipe',
            blocos: [
              menu('Conversas'),
              {
                t: 'duas',
                esquerda: [{ t: 'chat', n: 2, msgs: [{ autor: 'Priscila', texto: 'Bom dia! Em que posso ajudar?' }, { autor: 'Maria', texto: 'O laudo sai ainda hoje?', eu: true }] }, { t: 'campos', n: 3, itens: [{ rotulo: 'Escreva para Priscila', valor: '', largo: true }] }],
                direita: [{ t: 'tabela', n: 1, colunas: ['Equipe interna'], linhas: [['Priscila ● 1'], ['Leonardo'], ['Carlos']] }],
              },
            ],
          },
          passos: [
            'Escolha na lista com quem quer falar. Mensagem nova acende um balão vermelho piscando na aba Conversas, em qualquer tela do portal; na lista, quem mandou mensagem nova sobe para o topo, em "Novas mensagens", piscando até você abrir a conversa.',
            'Abaixo de cada mensagem que você enviou: ✓ cinza = entregue; ✓✓ verde = a nossa equipe leu.',
            'O campo de escrever cresce conforme o texto. Enter envia; Shift+Enter pula linha.',
            '🎤 grava um áudio de até 2 minutos (na primeira vez o navegador pede para usar o microfone). 📷 envia uma imagem ou um print (também dá para colar com Ctrl+V). 📎 envia um arquivo: PDF, Word, Excel, PowerPoint, CSV ou TXT, até 10 MB. Arquivos e imagens recebidos têm o botão Baixar. Só você e a pessoa da conversa abrem e baixam os arquivos.',
            'A conversa é privada, só entre vocês dois, e se atualiza sozinha a cada poucos segundos.',
            'Escreva e clique em Enviar.',
          ],
          atencao: 'Conversas não têm prazo nem ficam no histórico do chamado. Pedido de serviço, documento ou qualquer assunto que precise de registro deve ser feito por chamado.',
        },
      ],
    },

    {
      id: 'duvidas',
      titulo: 'Dúvidas frequentes',
      slides: [
        {
          titulo: 'Perguntas comuns',
          passos: [
            'Abri com a prioridade errada. E agora? Escreva na conversa do chamado. Só a nossa equipe altera a prioridade.',
            'Meu chamado foi encerrado mas o problema voltou. Abra um novo chamado e cite o número do anterior na descrição.',
            'Um colega não vê meu chamado. Abra o chamado e, em "Quem vê este chamado", marque o colega ou escolha "Toda a empresa".',
            'Por que o prazo não andou no fim de semana? O prazo conta só horas úteis, de segunda a sexta.',
            'Mandei um arquivo errado. Avise na conversa do chamado e envie o arquivo correto.',
            'Recebi um e-mail de lembrete. O chamado está esperando uma resposta sua há mais tempo que o combinado. Responda na conversa do chamado que o lembrete para.',
            'O que é "Atendimento suspenso"? O atendimento parou por um impedimento fora do nosso controle (sistema indisponível, fornecedor, órgão). O chamado mostra o motivo e a data da próxima atualização, e o prazo fica pausado até a retomada.',
            'Meu chamado foi cancelado. Por quê? O motivo aparece no topo do chamado e no e-mail que você recebeu. Se ainda precisar de ajuda, responda na conversa que a nossa equipe avalia, ou abra um novo chamado.',
            'Esqueci a senha ou meu acesso está inativo. Fale com a nossa equipe para gerar uma nova senha ou reativar o acesso.',
          ],
        },
        {
          titulo: 'Sobre este manual',
          passos: [
            'O manual é atualizado junto com o portal. As telas dos slides são ilustrações com dados fictícios.',
            'Ele é apenas para visualização na tela: não pode ser baixado nem impresso.',
            'Ficou alguma dúvida? Abra um chamado na categoria "Atendimento administrativo" ou fale conosco em Conversas.',
          ],
        },
      ],
    },
  ],
}

export default manualCliente
