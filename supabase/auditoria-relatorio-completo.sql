-- =====================================================================
-- O relatório de auditoria como o organismo certificador entrega.
--
-- ANTES:  o relatório tinha objetivo, escopo, critérios, equipe, as duas
--         reuniões, a conclusão e a lista de não conformidades. É a
--         espinha da ISO 19011 6.5, mas é menos do que chega à mesa do
--         cliente quando vem uma certificadora.
-- DEPOIS: nove coisas que faltavam, todas tiradas do relatório real de
--         renovação que ele guardou:
--           1. tipo de auditoria (interna, certificação, supervisão...)
--           2. quem participou e quem acompanhou cada área
--           3. três níveis de achado — a oportunidade de melhoria
--              faltava; só havia maior, menor e observação
--           4. pontos fortes
--           5. verificação das não conformidades da auditoria anterior
--           6. exclusões do escopo
--           7. recomendações
--           8. ressalva de amostragem
--           9. cabeçalho controlado: código, revisão, confidencialidade
--         e a agenda hora a hora, que até aqui era um campo de texto
--         solto (`plano_agenda`) que ninguém consegue imprimir em tabela.
-- MOTIVO: um relatório sem cabeçalho controlado é, ele mesmo, uma
--         constatação de 7.5.2. A ferramenta não pode entregar ao
--         cliente um documento que seria reprovado numa auditoria.
--
-- POR QUE `plano_agenda` CONTINUA. Quem já escreveu uma agenda lá não
-- pode perdê-la. A tabela nova é o caminho daqui para frente; a tela
-- mostra a tabela quando ela existe e o texto antigo quando não existe.
--
-- POR QUE A AMOSTRAGEM TEM DEFAULT E NÃO É TEXTO FIXO NA TELA. A frase
-- é padrão, mas o auditor tem o direito de ajustá-la — e a frase que
-- valia na auditoria de março precisa continuar no relatório de março,
-- mesmo que mudemos o padrão depois. Texto fixo na tela reescreveria o
-- passado a cada deploy.
--
-- Depende de supabase/auditoria-ritos.sql e supabase/inspecoes-modo-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 1. Campos novos na auditoria --------------------------------
alter table public.inspecoes
  -- Que auditoria é esta. Muda o tom do relatório inteiro: numa interna
  -- quem assina é a própria empresa; numa de certificação é terceiro.
  add column if not exists modalidade          text,
  -- 6.5 — o que foi bem. O relatório que só lista defeito é lido como
  -- perseguição e some na gaveta.
  add column if not exists pontos_fortes       text,
  -- Recomendação não é constatação: não obriga, mas orienta.
  add column if not exists recomendacoes       text,
  -- Requisitos que não se aplicam ao escopo, com a justificativa.
  add column if not exists exclusoes           text,
  -- A auditoria anterior e o que se verificou das constatações dela.
  add column if not exists anterior_id         uuid references public.inspecoes (id) on delete set null,
  add column if not exists anterior_verificacao text,
  -- Cabeçalho controlado (7.5.2): sem isso o próprio relatório falha.
  add column if not exists doc_codigo          text,
  add column if not exists doc_revisao         text,
  add column if not exists confidencialidade   text,
  -- A ressalva que todo relatório sério traz.
  add column if not exists amostragem          text;

alter table public.inspecoes drop constraint if exists inspecoes_modalidade;
alter table public.inspecoes
  add constraint inspecoes_modalidade
  check (modalidade is null or modalidade in
         ('interna', 'certificacao', 'supervisao', 'recertificacao',
          'transicao', 'fornecedor', 'diagnostico'));

-- Preenche a ressalva e a confidencialidade nas auditorias que já existem
-- e ainda não têm nada escrito. Não toca em quem já escreveu.
update public.inspecoes
   set amostragem = coalesce(amostragem,
         'A auditoria foi conduzida por amostragem. A ausência de constatação '
         || 'em um requisito significa que, nas evidências examinadas, nada '
         || 'foi encontrado em desacordo — não é garantia de conformidade '
         || 'plena de todo o processo.'),
       confidencialidade = coalesce(confidencialidade,
         'Documento de uso restrito. As informações aqui registradas são de '
         || 'propriedade da organização auditada e não podem ser divulgadas '
         || 'a terceiros sem autorização formal.')
 where tipo = 'auditoria'
   and (amostragem is null or confidencialidade is null);


-- ---------- 2. A oportunidade de melhoria -------------------------------
-- Três níveis não bastam. O relatório real separa a não conformidade
-- (maior ou menor), a observação (um desvio que ainda não é NC) e a
-- oportunidade de melhoria (nada está errado, mas dá para ser melhor).
-- Misturar oportunidade com observação faz a empresa tratar sugestão
-- como defeito e perder tempo abrindo ação corretiva do que não falhou.
alter table public.nao_conformidades drop constraint if exists nao_conformidades_classificacao;
alter table public.nao_conformidades
  add constraint nao_conformidades_classificacao
  check (classificacao is null or classificacao in
         ('maior', 'menor', 'observacao', 'oportunidade'));


-- ---------- 3. A agenda, hora a hora ------------------------------------
-- Horário | Processo/Área | Auditor | Participantes | Requisitos.
-- É assim que a agenda chega ao auditado antes da auditoria, e é assim
-- que ela volta no relatório provando o que foi coberto.
create table if not exists public.auditoria_agenda (
  id            bigint generated always as identity primary key,
  inspecao_id   uuid not null references public.inspecoes (id) on delete cascade,
  ordem         integer not null default 0,
  -- Texto e não `time`: na prática se escreve "08:00 às 09:30", e às
  -- vezes "a confirmar". Coluna de hora obrigaria a inventar precisão.
  horario       text,
  dia           date,
  area          text not null,
  auditor       text,
  participantes text,
  -- Os números dos requisitos cobertos nesta janela. Ex.: "4.1, 4.2, 6.1".
  requisitos    text,
  observacao    text
);

create index if not exists auditoria_agenda_inspecao
  on public.auditoria_agenda (inspecao_id, ordem, id);


-- ---------- 4. Quem estava na sala --------------------------------------
-- O relatório da certificadora nomeia cada pessoa e o papel dela. Sem
-- isso, seis meses depois ninguém sabe a quem perguntar o que foi dito.
create table if not exists public.auditoria_participantes (
  id          bigint generated always as identity primary key,
  inspecao_id uuid not null references public.inspecoes (id) on delete cascade,
  nome        text not null,
  cargo       text,
  area        text,
  papel       text not null default 'auditado',
  -- Esteve na abertura? No encerramento? Nas duas?
  abertura    boolean not null default false,
  encerramento boolean not null default false
);

alter table public.auditoria_participantes drop constraint if exists auditoria_participantes_papel;
alter table public.auditoria_participantes
  add constraint auditoria_participantes_papel
  check (papel in ('auditor_lider', 'auditor', 'auditor_em_treinamento',
                   'observador', 'acompanhante', 'auditado', 'convidado'));

create index if not exists auditoria_participantes_inspecao
  on public.auditoria_participantes (inspecao_id, papel, nome);


-- ---------- 5. Quem enxerga ---------------------------------------------
-- Mesma regra das demais filhas da auditoria: quem pode gerir a inspeção
-- da empresa dona daquela auditoria, pode ler e escrever estas linhas.
-- A separação comercial do módulo continua sendo feita na tela e na
-- política restritiva de `inspecoes`, como está em modulo-auditoria.sql.
alter table public.auditoria_agenda        enable row level security;
alter table public.auditoria_participantes enable row level security;

drop policy if exists auditoria_agenda_acesso on public.auditoria_agenda;
create policy auditoria_agenda_acesso
  on public.auditoria_agenda for all to authenticated
  using (exists (
    select 1 from public.inspecoes i
     where i.id = auditoria_agenda.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ))
  with check (exists (
    select 1 from public.inspecoes i
     where i.id = auditoria_agenda.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

drop policy if exists auditoria_participantes_acesso on public.auditoria_participantes;
create policy auditoria_participantes_acesso
  on public.auditoria_participantes for all to authenticated
  using (exists (
    select 1 from public.inspecoes i
     where i.id = auditoria_participantes.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ))
  with check (exists (
    select 1 from public.inspecoes i
     where i.id = auditoria_participantes.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

grant select, insert, update, delete on public.auditoria_agenda        to authenticated;
grant select, insert, update, delete on public.auditoria_participantes to authenticated;
revoke all on public.auditoria_agenda        from anon;
revoke all on public.auditoria_participantes from anon;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'inspecoes'
           and column_name in ('modalidade', 'pontos_fortes', 'recomendacoes',
                               'exclusoes', 'anterior_id', 'anterior_verificacao',
                               'doc_codigo', 'doc_revisao', 'confidencialidade',
                               'amostragem'))                       as campos_novos,
       (select count(*) from public.inspecoes
         where tipo = 'auditoria' and amostragem is not null)       as com_ressalva,
       (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name in ('auditoria_agenda', 'auditoria_participantes')) as tabelas_novas;
