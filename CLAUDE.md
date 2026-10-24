# Portal do Cliente — ÁgilMed Ocupacional + Real Life SSMA

Regras do projeto para o Claude Code. Leia antes de qualquer alteração.

## Quem decide e como trabalhar

- Dono do produto: **Leonardo Guerra** (engenheiro, não programador). Ele não executa git: branch, commit, push e PR ficam com o Claude.
- **Nunca fazer merge.** Abrir o PR para `main` e parar. O Leonardo aprova depois de conferir o preview da Vercel.
- **Nunca excluir** arquivos, dados, colunas, tabelas ou trechos relevantes sem autorização explícita dele. Para mudanças grandes, mostrar ANTES → DEPOIS → MOTIVO e aguardar.
- Responder sempre em **português do Brasil**, de forma direta. Explicar o impacto para o usuário do portal, não só o código.
- Se uma regra deste arquivo parecer errada ou desatualizada frente ao código, **avisar antes** de seguir.

## Stack

- Next.js 16 (App Router, `'use client'` na maioria das telas), React 19, TypeScript.
- Estilos: inline (`style={{}}`), `app/globals.css` e arquivos `.css` por tela. O pacote Tailwind 4 está instalado, mas **não está ativo** (sem PostCSS nem `@import "tailwindcss"`). Não usar classes Tailwind sem antes configurá-lo.
- Supabase (banco, auth e arquivos). O Leonardo chama o banco de **"projeto ticket"**.
- Hospedagem e crons na Vercel (`vercel.json`). E-mail por `lib/email.ts`.
- Variáveis: o `.env.example` lista só as do Supabase. O código também usa:
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (esta é só do servidor).
  - Crons: `CRON_SECRET`.
  - E-mail: `RESEND_API_KEY`, `EMAIL_REMETENTE_AGILMED`, `EMAIL_REMETENTE_REALLIFE`.
  - EAD Maestrus: `MAESTRUS_URL`, `MAESTRUS_EMAIL`, `MAESTRUS_SENHA`.
  - IA do relatório mensal: `AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (`VERCEL_OIDC_TOKEN` vem da própria Vercel).
- O código vive só no GitHub/Vercel. Não existe cópia local no PC do Leonardo.

## Checklist de todo PR

1. Branch nova a partir do `main` atualizado, com nome descritivo em português (ex.: `chamados-cobranca`).
2. `npx tsc --noEmit` sem erros. Rodar `npm run build` quando houver ambiente com as variáveis.
3. **Não commitar `package-lock.json`.** O repositório não usa lockfile.
4. Mudança de banco: um arquivo novo em `supabase/<tema>.sql` com:
   - cabeçalho ANTES / DEPOIS / MOTIVO;
   - script **idempotente** (`if not exists`, `create or replace`, `drop ... if exists`);
   - nada de apagar dados;
   - uma consulta de conferência no final.
5. **O Claude não roda SQL em produção.** O Leonardo roda no SQL Editor do Supabase. O PR deve dizer a ordem: primeiro o banco ou primeiro o código.
6. Se possível, a tela continua funcionando antes do SQL rodar (detectar coluna ausente, erro `42703`, e esconder o recurso).
7. Atualizar o manual interno (`lib/manual/interno.ts`) e, no que o cliente precisa saber, o manual do cliente (`lib/manual/cliente.ts`).
8. Mexeu em regra de prazo, avaliação, cancelamento ou suspensão: **revisar o impacto no programa de estrelas**. As estrelas precisam ficar coerentes com o sistema.
9. Descrição do PR em português: o que muda para o cliente, o que muda para a equipe e o passo a passo do SQL.

## Perfis

`cliente`, `atendimento`, `gestor`, `admin`. A equipe interna é formada por atendimento, gestor e admin. A segurança vale **na tela e no banco** (RLS, gatilhos e funções `security definer`), nunca só na tela.

## Regras de negócio decididas

### Chamados e SLA

- Situações: `aberto`, `em_atendimento`, `aguardando_cliente`, `suspenso`, `resolvido`, `encerrado`, `cancelado`.
- O prazo conta **horas úteis**: seg–sex, 8h–12h e 13h–17h (8 h/dia). Nunca horas corridas.
- Prazos por prioridade (`HORAS_SLA` em `lib/prazo.ts`): urgente 4 h, alta 8 h, normal 24 h, baixa 48 h.
- **Fuso do expediente: horário de Porto Velho** (`America/Porto_Velho`, UTC-4), confirmado pelo Leonardo em 23/10/2026. Já é o que o código usa (PR #10). Todas as telas mostram o horário de Porto Velho.
- Feriados não contam. Também não contam os pontos facultativos: vésperas de Natal e de Ano-Novo, Carnaval com Quarta de Cinzas e Corpus Christi (`lib/feriados.ts`).
- Em "Aguardando cliente", o SLA pausa automaticamente, sem validação do gestor: não conta hora e não vira atraso. A mensagem automática ao cliente sai antes da pausa. Ao sair da pausa, o prazo é estendido só pelas horas úteis da espera.
- Cliente sem retorno além do prazo da empresa (padrão 7 dias): cobrança por e-mail e aviso vermelho piscando no painel do cliente.
- "Resolvido" vira "Encerrado" após 24 h úteis (pg_cron). Resposta do cliente em chamado resolvido devolve o chamado ao atendimento.
- "Atendimento suspenso": o atendente pede e registra motivo, observação e próxima atualização. O gestor valida o tempo para as estrelas.
- Cancelamento: só gestor ou admin, com motivo obrigatório. Chamado cancelado fica fora do SLA e das estrelas.
- Trava de horário: fora de seg–sex 8h–17h, só pessoas autorizadas movimentam chamados.

### Prioridade e fila

- Fila de prioridades por área, com urgentes sempre no topo. Filtro por atendente e fila de cada um.
- O cliente abre o chamado **no máximo como Alta**. Urgente só pela gestão.
- Só gestor e admin alteram a prioridade (bloqueio na tela e no gatilho `a_chamado_prioridade_guarda`).
- O cliente recebe e-mail com a posição na fila e vê o nome do atendente responsável.
- Atrasados piscam em vermelho ("Fora do prazo"). A 1 h útil (configurável) do prazo, piscam em amarelo ("Próximo do prazo"). Respeitar `prefers-reduced-motion`.
- Sublista de etapas no chamado, com % de conclusão por quantidade de itens, visível ao cliente.

### Programa de estrelas

- Por chamado: 1 estrela por resolver no prazo. Avaliação do cliente: Bom +1, Excelente +2, Ruim 0.
- Só o cliente que abriu o chamado avalia.
- Ranking mensal e anual, com premiação de fim de ano. O resultado final do ano sai pelo índice e é revelado só no fechamento.
- Todo cálculo e toda permissão ficam no banco (`supabase/programa-estrelas.sql` e revisões posteriores).

### Certificados, Treinamentos e Documentos SST

- Esses três módulos são **contratados à parte, por empresa** (`lib/modulos.ts`). Sem contrato, o cliente vê o módulo com cadeado, pede por chamado e não recebe os e-mails automáticos.
- EAD: Maestrus (reallifessma.maestrus.com). Leitura diária do curso e do % de cada aluno, casando pelo e-mail do colaborador.
- O progresso do certificado vem do EAD ou é manual/presencial (etapas + %). Painel e filtro por mês usam a **data de emissão**.
- Documentos SST: PGR, PCMSO, AET, AEP, LTCAT, laudos e tipos personalizáveis. Não existe validade automática igual para todos os tipos. A 60 dias do prazo, sem pedido de renovação, o portal abre chamado automaticamente, inclusive para documentos já vencidos.

### Outros

- Agenda semanal por atendente: prazos, etapas pendentes, carga de horas e compromissos.
- Dashboard de desempenho individual e relatório mensal de governança, com acesso restrito.
- O usuário do cliente pode estar em várias empresas: ele escolhe a empresa ativa e pode trocar.

## Pendências técnicas conhecidas

- Aplicar `comLimiteDeTempo` (`lib/sessao.ts`) nas telas que ainda chamam `supabase.auth.getUser()` ou `getSession()` sem limite de tempo (cerca de 40 pontos). Hoje só `app/page.tsx` usa.
- Chamados abertos pela equipe sem cliente vinculado ninguém consegue avaliar, e o atendente perde o bônus. Ainda sem decisão do Leonardo.
- O card "Espera do cliente" mostra horas corridas, enquanto a extensão do prazo usa horas úteis.
