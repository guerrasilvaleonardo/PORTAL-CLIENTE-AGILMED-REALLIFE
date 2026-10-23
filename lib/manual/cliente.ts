import type { Bloco, Manual } from './tipos'

/*
 * MANUAL DO CLIENTE.
 * Linguagem simples, para quem nunca usou o portal.
 * Regra do projeto: toda alteração que o cliente vê ou que o afeta
 * entra aqui no mesmo PR (e a parte da equipe em interno.ts).
 */

const MENU = ['Início', 'Chamados', 'Certificados', 'Documentos SST', 'Treinamentos', 'Conversas']
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
            'Clique no nome da área para ir até ela: Início, Chamados, Certificados, Documentos SST, Treinamentos ou Conversas. A área aberta fica destacada.',
            'Áreas com 🔒 são ferramentas contratadas à parte (Certificados, Treinamentos, Documentos SST). Ao clicar, você vê o que a ferramenta oferece e o botão "Solicitar contratação", que abre um chamado para a nossa equipe enviar a proposta.',
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
          texto: 'É a primeira tela depois de entrar. Ela resume os chamados mais recentes da sua empresa e dá atalhos para o que você mais usa.',
          tela: {
            url: '/',
            blocos: [
              menu('Início'),
              { t: 'topo', titulo: 'Olá, Maria!', sub: 'Bem-vindo ao Portal do Cliente.' },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Chamados recentes', valor: '5' }, { rotulo: 'Em andamento', valor: '2' }, { rotulo: 'Resolvidos', valor: '3' }, { rotulo: 'Urgentes', valor: '0' }] },
              { t: 'cartoes', n: 2, itens: [{ titulo: 'Novo chamado', texto: '+ Abrir chamado' }, { titulo: 'Meus chamados', texto: 'Ver chamados →' }] },
              { t: 'tabela', n: 3, colunas: ['Nº', 'Assunto', 'Situação', 'Prioridade'], linhas: [['#120', 'Atualizar PGR', 'Em atendimento', 'Normal'], ['#118', 'Agendar exames', 'Resolvido', 'Alta']], pilulas: 2 },
            ],
          },
          passos: [
            'Os números contam todos os chamados da empresa que você pode ver: total, em andamento, resolvidos e urgentes ainda em aberto.',
            'Atalhos: "Novo chamado" abre um pedido e "Meus chamados" mostra a lista completa.',
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
                  { rotulo: 'Alta', desc: '8 horas úteis (1 dia útil)' },
                ],
              },
              { t: 'texto', n: 2, texto: 'A prioridade Urgente é definida pela nossa equipe após a análise do chamado.' },
            ],
          },
          passos: [
            'Escolha Baixa, Normal ou Alta. Já vem marcada Normal.',
            'Urgente (4 horas úteis) é definida só pela nossa equipe, depois de analisar o caso. Se for crítico, explique o impacto na descrição: a equipe avalia e pode subir a prioridade.',
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
                  { t: 'campos', n: 1, itens: [{ rotulo: 'Situação', valor: 'Em atendimento' }, { rotulo: 'Atendente responsável', valor: 'Priscila' }, { rotulo: 'Prazo SLA', valor: '21/10 15:00' }, { rotulo: 'Posição na fila', valor: '2º de 5' }] },
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
            'Detalhes: situação, quem está cuidando, prioridade, prazo de atendimento e posição na fila da área.',
            'Conversas: troque mensagens com a equipe sobre este chamado.',
            'Etapas do atendimento: o que já foi feito e o que falta, com percentual.',
            'Anexos e links: envie e consulte arquivos e endereços ligados ao chamado.',
          ],
        },
        {
          titulo: 'As situações do chamado',
          texto: 'Todo chamado passa por estas situações. A explicação da situação atual aparece no cartão Detalhes do chamado.',
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
                  { titulo: 'Encerrado', texto: 'Finalizado. Não recebe mais movimentação.' },
                  { titulo: 'Cancelado', texto: 'Encerrado sem atendimento. Você vê o motivo.' },
                ],
              },
            ],
          },
          passos: [
            'Aberto → Em atendimento: um atendente assumiu. Você não precisa fazer nada.',
            'Aguardando cliente: a bola está com você. Responda na conversa ou envie o que foi pedido. Enquanto isso, o prazo fica pausado.',
            'Se o chamado ficar em Aguardando cliente além do prazo combinado com a sua empresa (normalmente 7 dias), aparece um aviso vermelho piscando no Início e em Chamados, e você recebe um e-mail de lembrete a cada 3 dias úteis até responder.',
            'Atendimento suspenso: o atendimento parou por um impedimento fora do nosso controle (sistema indisponível, falha de software, fornecedor). Você vê o motivo e a data prevista da próxima atualização, e o prazo fica pausado.',
            'Resolvido: confira a solução e use os botões do chamado: "Sim, pode encerrar" ou "Não, reabrir" (conte o que falta). Agradecer ou comentar na conversa não reabre o chamado. Sem resposta em 24 horas úteis, ele é encerrado sozinho.',
            'Encerrado: sem resposta em 24 horas úteis depois de resolvido, o chamado é encerrado automaticamente. Se o assunto voltar, abra um novo chamado.',
            'Cancelado: o chamado foi encerrado sem atendimento (por exemplo, duplicado, aberto por engano ou desistência). O motivo aparece no chamado e você recebe e-mail. Se ainda precisar, responda na conversa ou abra um novo chamado.',
          ],
        },
        {
          titulo: 'Prazo de atendimento (SLA)',
          texto: 'O prazo mostra até quando a nossa equipe se compromete a resolver o chamado.',
          tela: {
            url: '/chamados/…',
            blocos: [
              { t: 'campos', n: 1, itens: [{ rotulo: 'Prioridade', valor: 'Normal' }, { rotulo: 'Prazo SLA', valor: '21/10/2026 15:00' }] },
              { t: 'campos', n: 2, itens: [{ rotulo: 'Prazo SLA', valor: 'Pausado — o prazo volta a contar quando você responder' }] },
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
            'Anexos: clique em Selecionar arquivo e escolha o arquivo. Vai um por vez, com até 10 MB cada.',
            'Abrir mostra o arquivo numa nova aba; Baixar salva no seu computador.',
            'Links de acesso: informe nome e endereço e clique em Adicionar. Cada link aparece com os botões Abrir, Editar e Remover.',
          ],
          atencao: 'Arquivos enviados não podem ser apagados por você. Confira antes de enviar e, se mandar o arquivo errado, avise a equipe na conversa.',
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
            'O cartão de avaliação fica dentro do chamado, logo abaixo de Detalhes do chamado.',
          ],
          dica: 'Quem avalia: quem abriu o chamado ou, quando a nossa equipe abriu o chamado por você, o solicitante indicado por ela. Se a equipe abriu sem indicar ninguém, qualquer usuário da empresa que veja o chamado pode avaliar. Vale a primeira avaliação.',
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
              { t: 'topo', sobre: 'Sua empresa', titulo: 'Certificados', botoes: ['Relatório de treinamentos', 'Atualizar progresso do EAD', 'Exportar'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Vencidos', valor: '0', tom: 'ruim' }, { rotulo: 'Vencem em até 90 dias', valor: '2', tom: 'alerta' }, { rotulo: 'Em dia', valor: '50', tom: 'bom' }, { rotulo: 'Validade não informada', valor: '1' }] },
              { t: 'tabela', n: 2, colunas: ['Colaborador', 'Curso / Modalidade', 'Progresso', 'Validade / Situação', 'Certificado'], linhas: [['João Lima', 'NR-35 · EAD', 'Concluído', 'Vence em 24 dias', 'Ver certificado'], ['Ana Reis', 'NR-10 · Presencial', 'Concluído', 'Válido', 'Ver certificado']], pilulas: 3 },
            ],
          },
          passos: [
            'Os cartões de validade separam cada certificado em uma faixa: Vencidos, Vencem em até 90 dias, Em dia (mais de 90 dias), Sem vencimento (não tem prazo) e Validade não informada (falta a data no cadastro). Clique num cartão para ver só esses certificados.',
            'Logo abaixo, a linha Treinamento mostra o andamento dos cursos: concluídos, em andamento, não iniciados e sem dados de progresso.',
            'Aba Certificados: busque por colaborador, função, e-mail ou curso e use os filtros (Mais filtros traz tipo, origem e mês). "Por colaborador" junta os cursos de cada pessoa. "Ver certificado" abre o documento, quando houver; Exportar baixa a lista em planilha.',
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
              { t: 'topo', sobre: 'Sua empresa', titulo: 'Documentos SST', botoes: ['Exportar'] },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Cadastrados', valor: '6' }, { rotulo: 'Vencidos', valor: '0', tom: 'ruim' }, { rotulo: 'A vencer em até 30 dias', valor: '1', tom: 'ruim' }, { rotulo: 'Sem link assinado', valor: '1' }] },
              { t: 'tabela', n: 2, colunas: ['Unidade', 'Documento', 'Próximo prazo', 'Situação', 'Arquivo'], linhas: [['Matriz', 'PGR · Rev. 02', '20/11/2026', 'Vence em 31 dias', 'Abrir assinado'], ['Obra', 'PCMSO · Rev. 01', '15/10/2027', 'No prazo', 'Abrir assinado']], pilulas: 3 },
            ],
          },
          passos: [
            'Os cartões mostram quantos documentos estão vencidos ou vencem em até 30, 60 e 90 dias, quantos ainda não têm a versão assinada no portal e quantos têm revisão pendente. Clique num cartão para filtrar.',
            'Na lista, "Próximo prazo" é o vencimento ou a revisão programada, o que vier antes. "Abrir assinado" abre o documento.',
            'No menu ⋯: "Solicitar renovação" abre um chamado já preenchido para a nossa equipe, e "Histórico de revisões" mostra as versões anteriores com os links.',
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
              { t: 'topo', sobre: 'Relatório', titulo: 'Treinamentos' },
              { t: 'stats', n: 1, itens: [{ rotulo: 'Treinamentos', valor: '40' }, { rotulo: 'Concluídos', valor: '31', tom: 'bom' }, { rotulo: 'Em andamento', valor: '6', tom: 'alerta' }, { rotulo: 'Não iniciados', valor: '3', tom: 'ruim' }] },
              { t: 'grafico', n: 2 },
              { t: 'botoes', n: 3, itens: [{ rotulo: 'Atualizar do EAD' }, { rotulo: 'Baixar CSV', primario: true }] },
              { t: 'tabela', colunas: ['Colaborador', 'Curso', 'Progresso', 'Situação'], linhas: [['João Lima', 'NR-35', '100%', 'Concluído'], ['Ana Reis', 'NR-10', '40%', 'Em andamento']], pilulas: 3 },
            ],
          },
          passos: [
            'Concluído = 100%. Em andamento = começou. Não iniciado = 0%. Sem matrícula = não encontramos o colaborador no EAD.',
            '"Situação geral" e "Cursos que mais travam" mostram onde a turma está parada.',
            '"Atualizar do EAD" busca o dado mais recente (de novo, só depois de 10 minutos). "Baixar CSV" gera uma planilha da lista para abrir no Excel.',
            'Aviso diário por e-mail: de segunda a sexta, por volta das 7h30 (Porto Velho), os usuários da empresa recebem os treinamentos ainda em aberto de cada colaborador, com o percentual e há quantos dias não avança. Concluídos aparecem uma vez, no aviso seguinte. Sem treinamento em aberto, o e-mail não é enviado.',
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
            '🎤 grava um áudio de até 2 minutos (na primeira vez o navegador pede para usar o microfone). 📷 envia uma imagem ou um print (também dá para colar com Ctrl+V). Só você e a pessoa da conversa abrem os arquivos.',
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
