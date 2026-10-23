-- =====================================================================
-- Aviso diário do andamento dos treinamentos (por empresa e pessoa).
--
-- ANTES:  o cliente só via o andamento dos treinamentos entrando na tela
--         Treinamentos do portal.
-- DEPOIS: de segunda a sexta (exceto feriados cadastrados), às 7h30 de
--         Porto Velho, depois da leitura do EAD, cada empresa que tem a
--         ferramenta Treinamentos recebe por e-mail os treinamentos ainda
--         não concluídos de cada colaborador (percentual, situação e há
--         quantos dias não avança). Concluídos aparecem uma única vez, no
--         aviso seguinte à conclusão. Empresa sem pendência não recebe.
--         Esta tabela guarda só o último percentual visto de cada
--         certificado, para saber "há quantos dias não avança" e não
--         repetir o aviso de conclusão. Só o servidor lê e grava.
-- MOTIVO: manter o cliente ciente do andamento sem precisar entrar no
--         portal.
--
-- Não apaga nem altera certificados nem o progresso do EAD. Pode rodar
-- mais de uma vez.
-- =====================================================================

create table if not exists public.treinamentos_aviso (
  certificado_id        uuid primary key references public.certificados (id) on delete cascade,
  progresso             integer not null default 0,
  mudou_em              timestamptz not null default now(),
  concluido_avisado_em  timestamptz,
  atualizado_em         timestamptz not null default now()
);

-- Sem políticas: só a chave de serviço (rotina diária) acessa.
alter table public.treinamentos_aviso enable row level security;
revoke all on public.treinamentos_aviso from anon, authenticated;

create table if not exists public.treinamentos_aviso_envios (
  id            bigserial primary key,
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  enviado_em    timestamptz not null default now(),
  pendentes     integer not null,
  concluidos    integer not null,
  destinatarios integer not null,
  sucesso       boolean not null,
  detalhe       text
);

create index if not exists treinamentos_aviso_envios_empresa on public.treinamentos_aviso_envios (empresa_id, enviado_em desc);

-- A equipe interna consulta o histórico de envios; o cliente não.
alter table public.treinamentos_aviso_envios enable row level security;
revoke all on public.treinamentos_aviso_envios from anon, authenticated;
grant select on public.treinamentos_aviso_envios to authenticated;

drop policy if exists treinamentos_aviso_envios_leitura on public.treinamentos_aviso_envios;
create policy treinamentos_aviso_envios_leitura on public.treinamentos_aviso_envios
  for select to authenticated
  using (public.e_equipe_interna());


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.treinamentos_aviso) as certificados_acompanhados,
       (select count(*) from public.treinamentos_aviso_envios) as envios_registrados;
