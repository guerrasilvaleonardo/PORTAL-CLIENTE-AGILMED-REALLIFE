-- =====================================================================
-- Apontamento de campo: o nível que faltava entre certo e errado.
--
-- MOTIVO: lendo a central de ajuda do OnSafety em 21/11/2026. Eles
-- trabalham com quatro conclusões — não aplicável, conforme,
-- INSUFICIENTE e não conforme — e a nossa tela obrigava a inspetora a
-- escolher entre "está certo" e "está errado" quando a verdade, em
-- campo, quase sempre é "está pela metade".
--
-- EXEMPLOS DO QUE CAI AQUI: extintor no lugar mas com sinalização
-- apagada; ficha de EPI assinada só por metade da equipe; guarda-corpo
-- instalado sem o rodapé. Marcar conforme é mentira; marcar não
-- conforme é injusto com quem já fez parte do trabalho — e as duas
-- escolhas erradas custam a confiança do cliente no relatório.
--
-- CONTA COMO PROBLEMA, E ISSO É DE PROPÓSITO. "Atende em parte" tem
-- prazo, dono e aviso, exatamente como a não conformidade, e entra nas
-- mesmas filas. É a regra que o OnSafety também adota: o item
-- insuficiente permanece nos indicadores como não conforme até a ação
-- corretiva deixá-lo conforme. Sem isso, o parcial viraria o esconderijo
-- confortável de tudo que ninguém quer tratar.
--
-- O QUE MUDA EM RELAÇÃO À NÃO CONFORMIDADE É O RELATÓRIO. O cliente lê
-- "três não atendem e dois atendem em parte" muito diferente de "cinco
-- não atendem" — e a segunda frase faz ele parar de ler.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.nao_conformidades drop constraint if exists nao_conformidades_classificacao;
alter table public.nao_conformidades
  add constraint nao_conformidades_classificacao
  check (classificacao is null or classificacao in
         ('maior', 'menor', 'observacao', 'oportunidade', 'conforme', 'insuficiente'));


-- ---------- Conferência -------------------------------------------------
select count(*)                                                as registros,
       count(*) filter (where classificacao = 'conforme')      as conformes,
       count(*) filter (where classificacao = 'insuficiente')  as atende_em_parte,
       count(*) filter (where classificacao = 'oportunidade')  as oportunidades,
       count(*) filter (where classificacao is null)           as nao_conformidades
  from public.nao_conformidades;
