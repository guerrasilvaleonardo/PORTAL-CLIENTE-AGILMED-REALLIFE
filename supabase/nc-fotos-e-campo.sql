-- =====================================================================
-- Apontamento de campo: várias fotos, e onde o registro foi feito.
--
-- MOTIVO: pedido dele em 21/11/2026. "temos que ter um modelo avulso,
-- tipo RCN, onde eu chego no campo e vou identificando cada
-- oportunidade de melhoria sem checklist, inserindo as fotos e os
-- demais itens, e também o local do cliente."
--
-- O QUE JÁ EXISTIA E NÃO PRECISOU MUDAR. A tabela já aceitava
-- `origem = 'avulsa'` (registro fora de inspeção), já tinha
-- `classificacao = 'oportunidade'` e já se liga a locais_trabalho pelo
-- `local_id`. O modelo de dados estava quase pronto; faltava a tela —
-- e as duas colunas abaixo.
--
-- POR QUE VÁRIAS FOTOS. A não conformidade guardava uma só
-- (`foto_path`), enquanto a resposta de inspeção já guardava até três
-- num array. Em campo uma foto raramente basta: a geral mostra onde é,
-- a de perto mostra o quê. Quem só pode anexar uma escolhe entre
-- provar o local e provar o problema.
--
-- `foto_path` CONTINUA, apontando para a primeira. É o que as telas e
-- os relatórios antigos leem, e trocar tudo de uma vez seria migração
-- grande para ganhar nada — o mesmo arranjo que inspecao_respostas já
-- usa.
--
-- POR QUE A COORDENADA. O relatório do concorrente (Checklist Fácil)
-- traz a coordenada e o endereço do momento da aplicação. Não é
-- enfeite: num apontamento de campo ela é a prova de que a pessoa
-- esteve lá. Escolher o local numa lista qualquer um faz do
-- escritório.
--
-- A COORDENADA É OPCIONAL, DE PROPÓSITO. O navegador pode negar, o
-- aparelho pode estar sem sinal e o galpão pode não ter GPS. Bloquear
-- o registro por isso faria o técnico desistir de apontar — e um
-- apontamento sem coordenada vale muito mais do que apontamento
-- nenhum. A tela declara quando não conseguiu, em vez de fingir.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.nao_conformidades
  add column if not exists fotos text[] not null default '{}',
  -- Onde o registro foi feito, no momento em que foi feito. Separado
  -- do local escolhido na lista: um é o que a pessoa disse, o outro é
  -- onde o aparelho dela estava.
  add column if not exists latitude   numeric(10, 7),
  add column if not exists longitude  numeric(10, 7),
  add column if not exists precisao_m integer;

-- Quem já tinha uma foto entra no array sem perder nada.
update public.nao_conformidades
   set fotos = array[foto_path]
 where foto_path is not null
   and coalesce(array_length(fotos, 1), 0) = 0;


-- ---------- Conferência -------------------------------------------------
select count(*)                                                     as registros,
       count(*) filter (where coalesce(array_length(fotos,1),0) > 0) as com_foto,
       count(*) filter (where origem = 'avulsa')                     as avulsos,
       count(*) filter (where classificacao = 'oportunidade')        as oportunidades,
       count(*) filter (where latitude is not null)                  as com_coordenada
  from public.nao_conformidades;
