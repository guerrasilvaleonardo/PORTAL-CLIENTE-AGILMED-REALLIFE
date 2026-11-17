-- Certificados: "O treinamento não será realizado novamente".
--
-- ANTES:  certificado de um treinamento que a empresa não vai mais fazer
--         (a atividade deixou de existir, ou o cliente pediu) continuava
--         aparecendo como vencido, entrava nos cartões, no painel e nos
--         e-mails de vencimento para sempre.
-- DEPOIS: no "Editar certificado" a equipe marca "O treinamento não será
--         realizado novamente" e escolhe o motivo:
--           atividade_nao_executada = a atividade não é mais executada
--           solicitacao_cliente     = solicitação do cliente
--           outro                   = outro motivo (com detalhe)
--         O certificado fica no cadastro (nada é apagado), na faixa "Não
--         serão renovados", e sai de vencidos/a vencer, do painel e do
--         boletim semanal de vencimentos.
-- MOTIVO: pedido do Leonardo (16/11/2026).
--
-- Ordem: pode rodar antes ou depois do código. Sem estas colunas a tela
-- funciona como antes, só sem a opção. Idempotente; não altera dados.

alter table public.certificados
  add column if not exists nao_renovar boolean not null default false,
  add column if not exists nao_renovar_motivo text,
  add column if not exists nao_renovar_obs text,
  add column if not exists nao_renovar_em date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'certificados_nao_renovar_motivo_check') then
    alter table public.certificados
      add constraint certificados_nao_renovar_motivo_check
      check (nao_renovar_motivo is null or nao_renovar_motivo in ('atividade_nao_executada', 'solicitacao_cliente', 'outro'));
  end if;
end $$;

comment on column public.certificados.nao_renovar is
  'true = o treinamento não será realizado novamente: sai de vencidos, avisos e e-mails de vencimento.';

-- Conferência: total de certificados e quantos estão marcados (deve ser 0 logo após rodar).
select count(*) as total, count(*) filter (where nao_renovar) as nao_renovar
from public.certificados;
