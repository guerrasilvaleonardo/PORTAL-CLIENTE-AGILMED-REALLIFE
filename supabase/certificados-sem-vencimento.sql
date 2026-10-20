-- Certificados: marcação "Sem vencimento" (validade indeterminada).
--
-- ANTES:  certificado sem data de validade aparecia como "Não informada",
--         sem distinguir o que não vence do que ficou sem a data.
-- DEPOIS: nova coluna sem_vencimento (padrão false). Marcada no cadastro,
--         o certificado vai para a faixa "Sem vencimento"; sem a marcação e
--         sem data, continua "Validade não informada".
-- MOTIVO: os indicadores da página separam as duas situações.
--
-- Não altera nem apaga dados existentes: todos os certificados atuais ficam
-- com sem_vencimento = false, ou seja, exatamente como estão hoje.
-- A página funciona sem este script (só esconde a opção "Sem vencimento").

alter table public.certificados
  add column if not exists sem_vencimento boolean not null default false;

comment on column public.certificados.sem_vencimento is
  'true = certificado sem prazo de validade (não vence). Só vale com validade vazia.';

-- Conferência
select count(*) as total, count(*) filter (where sem_vencimento) as sem_vencimento
from public.certificados;
