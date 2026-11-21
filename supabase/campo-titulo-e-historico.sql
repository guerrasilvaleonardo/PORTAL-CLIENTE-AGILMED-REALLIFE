-- =====================================================================
-- Título do apontamento: o que permite reconhecer o mesmo problema.
--
-- MOTIVO: lendo a central de ajuda do OnSafety em 21/11/2026. No
-- relatório deles, cada apontamento aparece junto do anterior do mesmo
-- problema — situação anterior e situação atual, com as duas fotos. O
-- casamento é automático: mesmo TÍTULO, mesmo LOCAL, data anterior.
--
-- POR QUE PRECISA DE UM CAMPO NOVO. A nossa descrição é texto livre, e
-- texto livre nunca casa: "extintor obstruído por paletes" e "extintor
-- bloqueado com palete na frente" são o mesmo problema e duas cadeias
-- de caracteres diferentes. O título é curto, escolhido de uma lista
-- do que já existe naquele local, e é ele que fecha a conta.
--
-- POR QUE NÃO USAR INTELIGÊNCIA ARTIFICIAL PARA AGRUPAR. Daria para
-- comparar sentido em vez de letra, mas agrupamento que a pessoa não
-- controla produz relatório que ela não sabe explicar ao cliente — e
-- este relatório vai para auditoria. A lista de títulos deixa a
-- decisão com quem está no campo, que é quem sabe se é o mesmo
-- problema ou outro parecido.
--
-- O ÍNDICE É A FUNCIONALIDADE. Buscar "o que já foi apontado com este
-- título neste local" roda a cada tecla digitada na tela de campo, com
-- o técnico de pé esperando. Sem índice isso varre a tabela inteira.
--
-- Fica opcional: os 31 registros que já existem não têm título, e
-- exigir agora quebraria as telas que escrevem nesta tabela (inspeção
-- com checklist, incidente, auditoria). A tela de campo é que passa a
-- pedir.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.nao_conformidades
  add column if not exists titulo text;

/* A busca da tela de campo: empresa + local + título. */
create index if not exists nao_conformidades_titulo
  on public.nao_conformidades (empresa_id, local_id, titulo)
  where titulo is not null;

/* O relatório agrupa por título dentro do período. */
create index if not exists nao_conformidades_titulo_data
  on public.nao_conformidades (empresa_id, titulo, created_at desc)
  where titulo is not null;


-- ---------- Conferência -------------------------------------------------
select count(*)                                  as registros,
       count(titulo)                             as com_titulo,
       count(distinct titulo)                    as titulos_distintos
  from public.nao_conformidades;
