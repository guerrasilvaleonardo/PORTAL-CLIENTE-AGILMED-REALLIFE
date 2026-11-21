-- =====================================================================
-- Liga cada modelo .docx à atividade que manda baixá-lo.
--
-- ANTES:  a atividade dizia "baixe o modelo abaixo" e não havia botão
--         nenhum — o campo `modelo_arquivo` estava vazio em todas.
-- DEPOIS: dezoito atividades das etapas 1 a 4 apontam para o arquivo
--         correspondente no balde implantacao-modelos.
-- MOTIVO: ele autorizou gerar os modelos em 20/11/2026 ("pode gerar o
--         modelos").
--
-- O ARQUIVO EM SI NÃO VEM DAQUI. Os .docx são gerados e publicados
-- pela tela /implantacao/modelos, com a sessão de quem está logado —
-- SQL não sobe arquivo para o balde. Este script só diz qual atividade
-- aponta para qual nome.
--
-- POR QUE ISSO NÃO QUEBRA SE O ARQUIVO AINDA NÃO FOI PUBLICADO. A tela
-- pede uma URL assinada na hora do clique; sem o arquivo, ela avisa que
-- o modelo ainda não foi publicado em vez de dar erro.
--
-- Depende de supabase/implantacao-9001-parte1.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(etapa, ordem, arquivo, rotulo) as (
  values
    -- Etapa 1 — Iniciando meu Projeto
    (1, 1, 'ficha-do-interlocutor.docx'::text,              'a ficha do interlocutor'::text),
    (1, 2, 'equipe-do-sgq.docx',                            'a lista da equipe do SGQ'),
    (1, 4, 'plano-de-investimento.docx',                    'o plano de investimento'),
    -- Etapa 2 — Sistema de Gestão
    (2, 2, 'procedimento-informacao-documentada.docx',      'o Procedimento de Controle da Informação Documentada'),
    (2, 3, 'mapa-de-processos.docx',                        'o mapa de processos'),
    (2, 4, 'lista-mestra.docx',                             'a lista mestra'),
    -- Etapa 3 — Alta Direção
    (3, 1, 'analise-de-contexto.docx',                      'a análise de contexto'),
    (3, 2, 'analise-de-contexto.docx',                      'a análise de contexto (mesma folha)'),
    (3, 3, 'partes-interessadas.docx',                      'o levantamento de partes interessadas'),
    (3, 4, 'escopo-do-sgq.docx',                            'o escopo do SGQ'),
    (3, 5, 'missao-visao-valores.docx',                     'o documento de missão, visão e valores'),
    (3, 6, 'politica-da-qualidade.docx',                    'a política da qualidade'),
    (3, 7, 'matriz-de-responsabilidades.docx',              'a matriz de responsabilidades'),
    (3, 9, 'riscos-e-oportunidades.docx',                   'a planilha de riscos e oportunidades'),
    (3, 10, 'objetivos-e-planos.docx',                      'os objetivos da qualidade'),
    (3, 11, 'planejamento-de-mudancas.docx',                'o formulário de planejamento de mudanças'),
    (3, 12, 'ata-analise-critica.docx',                     'a ata de análise crítica'),
    -- Etapa 4 — Processos da Empresa
    (4, 1, 'caracterizacao-de-processos.docx',              'a caracterização dos processos')
)
update public.implantacao_atividades a
   set modelo_arquivo = d.arquivo,
       modelo_rotulo  = d.rotulo
  from dados d
  join public.implantacao_etapas e   on e.ordem = d.etapa
  join public.implantacao_modelos m  on m.id = e.modelo_id
 where a.etapa_id = e.id
   and a.ordem = d.ordem
   and m.nome = 'Implantação — ISO 9001:2026';


-- A atividade 3.2 (mudança climática) usa a MESMA folha da 3.1: a
-- resposta sobre clima é registrada dentro do documento de contexto,
-- não num arquivo separado. Duas folhas para a mesma reunião fariam a
-- empresa responder duas vezes e divergir.


-- ---------- Conferência -------------------------------------------------
select e.ordem                                      as etapa,
       e.nome,
       count(a.id)                                  as atividades,
       count(a.modelo_arquivo)                      as com_modelo
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
  left join public.implantacao_atividades a on a.etapa_id = e.id
 where m.nome = 'Implantação — ISO 9001:2026'
   and e.ordem <= 4
 group by e.ordem, e.nome
 order by e.ordem;
