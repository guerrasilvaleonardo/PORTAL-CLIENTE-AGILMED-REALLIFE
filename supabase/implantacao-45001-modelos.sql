-- =====================================================================
-- Liga os modelos de documento às atividades da trilha da ISO 45001.
--
-- Os arquivos já estão no balde implantacao-modelos, gerados a partir
-- de lib/modelosImplantacao45001.ts. Esta é a outra ponta: dizer a
-- cada atividade qual arquivo ela oferece para baixar.
--
-- POR QUE O NOME DO ARQUIVO VIVE NO BANCO E NÃO NO CÓDIGO DA TELA. A
-- tela da trilha é a mesma para as duas normas. Se o arquivo fosse
-- escolhido no código, cada norma nova viraria um 'if' a mais numa
-- tela que já existe — e a equipe não teria como trocar um modelo sem
-- deploy.
--
-- Depende de supabase/implantacao-45001-parte1.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

with dados(etapa, atividade, arquivo, rotulo) as (
  values
    (1, 2, 'sso-equipe.docx', 'a lista da equipe do SGSSO'),
    (1, 4, 'sso-plano-de-investimento.docx', 'o plano de investimento'),
    (2, 2, 'sso-procedimento-informacao-documentada.docx', 'o Procedimento de Controle da Informação Documentada'),
    (2, 3, 'sso-lista-mestra.docx', 'a lista mestra'),
    (3, 1, 'sso-analise-de-contexto.docx', 'a análise de contexto'),
    (3, 2, 'sso-partes-interessadas.docx', 'o levantamento de partes interessadas'),
    (3, 3, 'sso-escopo.docx', 'o escopo do SGSSO'),
    (3, 5, 'sso-politica.docx', 'a política de SSO'),
    (3, 6, 'sso-matriz-de-responsabilidades.docx', 'a matriz de responsabilidades'),
    (3, 7, 'sso-objetivos.docx', 'os objetivos de SSO'),
    (3, 8, 'sso-ata-analise-critica.docx', 'a ata de análise crítica'),
    (4, 2, 'sso-canais-de-consulta.docx', 'o mapa de canais de consulta'),
    (4, 3, 'sso-procedimento-consulta.docx', 'o procedimento de consulta e participação'),
    (5, 2, 'sso-levantamento-de-perigos.docx', 'o roteiro de levantamento de perigos'),
    (5, 3, 'sso-metodologia-de-riscos.docx', 'a metodologia de avaliação de riscos'),
    (5, 4, 'sso-inventario-de-riscos.docx', 'o inventário de riscos'),
    (5, 5, 'sso-plano-de-acao-riscos.docx', 'o plano de ação de riscos'),
    (5, 6, 'sso-oportunidades.docx', 'a planilha de oportunidades'),
    (6, 2, 'sso-matriz-legal.docx', 'a matriz de requisitos legais'),
    (6, 3, 'sso-documentos-com-validade.docx', 'o controle de documentos com validade'),
    (7, 3, 'sso-instrucao-de-trabalho.docx', 'o modelo de instrução de trabalho'),
    (7, 4, 'sso-permissao-de-trabalho.docx', 'o modelo de permissão de trabalho'),
    (7, 5, 'sso-gestao-de-mudancas.docx', 'o formulário de gestão de mudanças'),
    (8, 2, 'sso-aquisicao.docx', 'o procedimento de aquisição com critérios de SSO'),
    (8, 3, 'sso-contratadas.docx', 'o procedimento de contratadas'),
    (8, 4, 'sso-integracao.docx', 'o roteiro de integração'),
    (9, 1, 'sso-matriz-de-competencia.docx', 'a matriz de competência'),
    (9, 3, 'sso-ordem-de-servico.docx', 'o modelo de ordem de serviço'),
    (9, 4, 'sso-matriz-de-comunicacao.docx', 'a matriz de comunicação'),
    (10, 1, 'sso-infraestrutura.docx', 'o levantamento de infraestrutura'),
    (11, 2, 'sso-cenarios-de-emergencia.docx', 'a planilha de cenários de emergência'),
    (11, 3, 'sso-plano-de-emergencia.docx', 'o plano de resposta a emergências'),
    (12, 2, 'sso-indicadores.docx', 'o painel de indicadores de SSO'),
    (13, 2, 'sso-investigacao-de-incidentes.docx', 'o procedimento de investigação de incidentes'),
    (14, 2, 'sso-programa-de-melhoria.docx', 'o programa de melhoria contínua')
)
update public.implantacao_atividades a
   set modelo_arquivo = d.arquivo,
       modelo_rotulo  = d.rotulo
  from dados d
  join public.implantacao_etapas e   on e.ordem = d.etapa
  join public.implantacao_modelos m  on m.id = e.modelo_id
 where a.etapa_id = e.id
   and a.ordem = d.atividade
   and m.nome = 'Implantação — ISO 45001:2024';


-- ---------- Conferência -------------------------------------------------
select count(*) filter (where modelo_arquivo is not null) as com_modelo,
       count(*)                                           as atividades
  from public.implantacao_atividades a
  join public.implantacao_etapas e  on e.id = a.etapa_id
  join public.implantacao_modelos m on m.id = e.modelo_id
 where m.nome = 'Implantação — ISO 45001:2024';
