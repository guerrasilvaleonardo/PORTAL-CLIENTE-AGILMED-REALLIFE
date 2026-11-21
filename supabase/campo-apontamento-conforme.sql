-- =====================================================================
-- Apontamento de campo: registrar também o que está CONFORME.
--
-- MOTIVO: pedido dele em 21/11/2026, vendo a tela em uso. "aqui a
-- inspetora também quer apontar os itens que ela identificou
-- conforme."
--
-- POR QUE ISSO IMPORTA E NÃO É ENFEITE. Um relatório que só lista
-- defeito descreve uma empresa pior do que ela é, e ensina a equipe
-- que receber o inspetor é levar bronca. Registrar o que está certo
-- faz três coisas práticas:
--   1. PROVA O QUE FOI OLHADO. Visita que aponta duas não
--      conformidades não diz se foram olhados dois itens ou duzentos.
--      O conforme é a amostra; sem ele o relatório não tem
--      denominador.
--   2. SUSTENTA O QUE DEU CERTO. Controle novo que funcionou precisa
--      de registro, senão some na próxima troca de supervisor.
--   3. É O "PONTO FORTE" QUE A AUDITORIA JÁ TEM. O relatório de
--      auditoria tem a seção; a inspeção não tinha onde guardar.
--
-- POR QUE NA MESMA TABELA. O registro é o mesmo objeto: descrição,
-- foto, local, coordenada, quem apontou, quando. Só a conclusão muda.
-- Tabela separada duplicaria o formulário, a tela e o relatório para
-- guardar as mesmas seis colunas.
--
-- A TABELA SE CHAMA nao_conformidades E ISSO FICOU ERRADO. Ela já
-- guardava observação e oportunidade de melhoria antes disto; agora
-- guarda conformidade também. O nome ficou menor que o conteúdo —
-- renomear exigiria mexer em políticas, gatilhos e seis telas, e o
-- ganho seria só o nome. Fica anotado aqui para quem vier depois não
-- achar que foi descuido.
--
-- NÃO ENTRA EM NENHUMA CONTA DE PROBLEMA. Nem na fila de abertas, nem
-- na eficácia, nem na taxa de conformidade das inspeções com
-- checklist — que tem metodologia própria e não se mistura com
-- apontamento avulso.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.nao_conformidades drop constraint if exists nao_conformidades_classificacao;
alter table public.nao_conformidades
  add constraint nao_conformidades_classificacao
  check (classificacao is null or classificacao in
         ('maior', 'menor', 'observacao', 'oportunidade', 'conforme'));


-- ---------- Conferência -------------------------------------------------
select count(*)                                               as registros,
       count(*) filter (where classificacao = 'conforme')     as conformes,
       count(*) filter (where classificacao = 'oportunidade') as oportunidades,
       count(*) filter (where classificacao is null)          as nao_conformidades
  from public.nao_conformidades;
