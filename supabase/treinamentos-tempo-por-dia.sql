-- =====================================================================
-- EAD: tempo de estudo do colaborador (total e por dia).
--
-- ANTES:  o portal guardava do Maestrus só o curso e o percentual (%)
--         de cada matrícula. O cliente não sabia quanto tempo o
--         colaborador ficou estudando em cada dia.
-- DEPOIS: colunas novas em treinamentos_progresso, preenchidas pela
--         leitura do EAD (relatório de desempenho do Maestrus):
--           - tempo_total_seg: tempo total nas aulas online (segundos),
--             o mesmo número de "Frequência Total" no Maestrus;
--           - tempo_por_dia:   tempo por dia, ex.:
--             {"2026-10-28": 31616, "2026-10-29": 5400};
--           - matricula_ead:   número da matrícula no Maestrus (abre o
--             relatório de desempenho);
--           - tempo_lido_em / tempo_progresso: quando o tempo foi lido e
--             com qual % (evita reler cursos concluídos todo dia).
--         Nova rotina diária /api/cron/treinamentos-tempo (06h40 de
--         Brasília), depois da leitura do progresso.
--         O cliente vê esses números em Certificados e Treinamentos,
--         com a mesma regra de leitura de hoje (só os colaboradores
--         das empresas dele).
-- MOTIVO: o cliente precisa saber quanto tempo o colaborador dedicou
--         ao treinamento em cada dia (pedido do Leonardo em 28/10/2026).
--
-- Só ACRESCENTA colunas. Não apaga nem altera dados. Pode rodar mais
-- de uma vez. Depois de rodar: Certificados > "Atualizar progresso do
-- EAD" (ou esperar a leitura das 06h).
-- =====================================================================

alter table public.treinamentos_progresso
  add column if not exists tempo_total_seg integer;

alter table public.treinamentos_progresso
  add column if not exists tempo_por_dia jsonb;

alter table public.treinamentos_progresso
  add column if not exists matricula_ead integer;

alter table public.treinamentos_progresso
  add column if not exists tempo_lido_em timestamptz;

alter table public.treinamentos_progresso
  add column if not exists tempo_progresso smallint;

comment on column public.treinamentos_progresso.tempo_total_seg is
  'Tempo total nas aulas online do EAD, em segundos (Frequência Total do Maestrus).';

comment on column public.treinamentos_progresso.tempo_por_dia is
  'Tempo de aula online por dia, em segundos: {"AAAA-MM-DD": segundos}. Cada aula conta no dia em que foi finalizada; aula em andamento conta no dia da última atividade.';


-- ---------- Conferência -------------------------------------------------
-- Deve listar as 5 colunas novas.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'treinamentos_progresso'
   and column_name in ('tempo_total_seg', 'tempo_por_dia', 'matricula_ead',
                       'tempo_lido_em', 'tempo_progresso')
 order by column_name;
