-- =====================================================================
-- Revisão dos chamados suspensos + chamado novo vinculado a um encerrado.
--
-- ANTES:  a "próxima atualização" do chamado suspenso era só uma data
--         gravada na suspensão. Passava do dia e nada mudava: ninguém era
--         avisado e não havia como trocar a data sem retomar o chamado.
--         Chamado encerrado não tinha um caminho claro para continuar o
--         assunto.
-- DEPOIS:
--   * Função reprogramar_suspensao: a equipe troca a data da próxima
--     atualização de um chamado suspenso, com motivo obrigatório. O
--     chamado continua suspenso e o prazo continua pausado.
--   * Cada reprogramação fica registrada em
--     chamado_suspensao_reprogramacoes (data anterior, data nova, motivo,
--     quem, quando e se a revisão já estava vencida). Serve ao dashboard
--     da equipe. NÃO mexe nas estrelas (decisão do Leonardo, 06/11/2026).
--   * O cliente recebe mensagem automática com a nova data prevista (o
--     motivo da reprogramação fica só com a equipe).
--   * Coluna chamados.chamado_origem_id: o cliente (ou a equipe) abre um
--     chamado novo ligado a um encerrado/cancelado/resolvido da mesma
--     empresa, em vez de reabrir o antigo.
--   * Índices para o Histórico (encerrados e cancelados por data).
--
-- O arquivamento de Encerrado/Cancelado após 72 h corridas é só de TELA
-- (quadro). Nada é apagado nem muda de situação no banco.
--
-- MOTIVO: o suspenso não pode virar "estacionamento eterno", e reabrir
--         um encerrado distorceria o SLA e as estrelas do chamado
--         original.
--
-- Depende de: chamados-cobranca-e-suspensao.sql (chamado_suspensoes,
-- suspensao_proxima, estrelas_eh_equipe, chamado_mensagens_modelo).
-- Não apaga nem altera dados existentes. Pode rodar mais de uma vez.
-- =====================================================================


-- ---------- 1. Histórico de reprogramações ------------------------------
create table if not exists public.chamado_suspensao_reprogramacoes (
  id               bigserial primary key,
  suspensao_id     bigint not null references public.chamado_suspensoes (id) on delete cascade,
  chamado_id       uuid not null references public.chamados (id) on delete cascade,
  data_anterior    date not null,
  data_nova        date not null,
  motivo           text not null check (char_length(btrim(motivo)) between 5 and 1000),
  revisao_vencida  boolean not null default false,
  reprogramado_por uuid references public.profiles (id) on delete set null,
  reprogramado_em  timestamptz not null default now()
);

create index if not exists chamado_susp_reprog_chamado
  on public.chamado_suspensao_reprogramacoes (chamado_id, reprogramado_em desc);
create index if not exists chamado_susp_reprog_em
  on public.chamado_suspensao_reprogramacoes (reprogramado_em);

alter table public.chamado_suspensao_reprogramacoes enable row level security;

drop policy if exists "Equipe ve reprogramacoes" on public.chamado_suspensao_reprogramacoes;
create policy "Equipe ve reprogramacoes" on public.chamado_suspensao_reprogramacoes
  for select to authenticated using (public.estrelas_eh_equipe());

grant select on public.chamado_suspensao_reprogramacoes to authenticated;
revoke insert, update, delete on public.chamado_suspensao_reprogramacoes from anon, authenticated;


-- ---------- 2. Mensagem automática ao cliente ---------------------------
-- Não sobrescreve se já existir/tiver sido editada.
insert into public.chamado_mensagens_modelo (gatilho, texto) values
('suspensao_reprogramada',
 E'A previsão de atualização do chamado #{numero} mudou.\n\nNova data prevista: {proxima}\n\nO atendimento continua suspenso e o prazo segue pausado. Avisaremos por aqui assim que houver novidade.')
on conflict (gatilho) do nothing;


-- ---------- 3. Reprogramar a próxima atualização ------------------------
create or replace function public.reprogramar_suspensao(p_chamado uuid, p_proxima date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c       record;
  s       public.chamado_suspensoes%rowtype;
  v_mot   text := btrim(coalesce(p_motivo, ''));
  v_hoje  date := (now() at time zone 'America/Porto_Velho')::date;
begin
  if not public.estrelas_eh_equipe() then
    raise exception 'Somente a equipe de atendimento pode reprogramar a suspensão.';
  end if;
  if char_length(v_mot) < 5 then
    raise exception 'Informe o motivo da reprogramação (mínimo de 5 caracteres).';
  end if;
  if p_proxima is null or p_proxima < v_hoje then
    raise exception 'A nova data precisa ser hoje ou depois.';
  end if;

  select id, status, suspensao_proxima into c
    from public.chamados where id = p_chamado for update;
  if not found then raise exception 'Chamado não encontrado.'; end if;
  if c.status <> 'suspenso' then
    raise exception 'Só é possível reprogramar chamado suspenso (situação atual: %).', c.status;
  end if;

  select * into s from public.chamado_suspensoes
   where chamado_id = p_chamado and fim is null
   order by inicio desc limit 1 for update;
  if not found then raise exception 'Suspensão em andamento não encontrada.'; end if;

  if s.proxima_atualizacao = p_proxima then
    raise exception 'A nova data é igual à data atual.';
  end if;

  insert into public.chamado_suspensao_reprogramacoes
         (suspensao_id, chamado_id, data_anterior, data_nova, motivo, revisao_vencida, reprogramado_por)
  values (s.id, p_chamado, s.proxima_atualizacao, p_proxima, v_mot,
          s.proxima_atualizacao < v_hoje, auth.uid());

  update public.chamado_suspensoes
     set proxima_atualizacao = p_proxima
   where id = s.id;

  -- Não muda o status: os gatilhos de SLA/suspensão/estrelas não disparam.
  update public.chamados
     set suspensao_proxima = p_proxima
   where id = p_chamado;

  begin
    insert into public.chamado_eventos (chamado_id, tipo, para, autor_id, observacao)
    values (p_chamado, 'suspensao_reprogramada', 'suspenso', auth.uid(),
            'Próxima atualização: ' || to_char(s.proxima_atualizacao, 'DD/MM/YYYY')
            || ' → ' || to_char(p_proxima, 'DD/MM/YYYY') || ' · ' || v_mot);
  exception when others then null;
  end;

  perform public.mensagem_suspensao(p_chamado, 'suspensao_reprogramada', null, p_proxima);
end;
$fn$;

revoke all on function public.reprogramar_suspensao(uuid, date, text) from public, anon;
grant execute on function public.reprogramar_suspensao(uuid, date, text) to authenticated;


-- ---------- 4. Chamado novo vinculado ao anterior ------------------------
alter table public.chamados
  add column if not exists chamado_origem_id uuid references public.chamados (id) on delete set null;

create index if not exists chamados_origem on public.chamados (chamado_origem_id)
  where chamado_origem_id is not null;

-- Só vale ligar a um chamado da MESMA empresa que já terminou. Quem não é
-- da equipe só liga na criação (não troca o vínculo depois).
create or replace function public.chamado_origem_guarda()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  o record;
begin
  if new.chamado_origem_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.chamado_origem_id is not distinct from old.chamado_origem_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and not public.estrelas_eh_equipe() then
    raise exception 'Somente a equipe pode alterar o chamado de origem.';
  end if;
  if new.chamado_origem_id = new.id then
    raise exception 'Um chamado não pode ser origem de si mesmo.';
  end if;

  select empresa_id, status into o from public.chamados where id = new.chamado_origem_id;
  if not found then
    raise exception 'Chamado de origem não encontrado.';
  end if;
  if o.empresa_id is distinct from new.empresa_id then
    raise exception 'O chamado de origem precisa ser da mesma empresa.';
  end if;
  if o.status not in ('resolvido', 'encerrado', 'cancelado') then
    raise exception 'Só é possível vincular a um chamado resolvido, encerrado ou cancelado.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists a_chamado_origem_guarda on public.chamados;
create trigger a_chamado_origem_guarda
  before insert or update of chamado_origem_id on public.chamados
  for each row execute function public.chamado_origem_guarda();


-- ---------- 5. Índices do Histórico -------------------------------------
create index if not exists chamados_encerrado_em on public.chamados (encerrado_em)
  where status = 'encerrado';
create index if not exists chamados_cancelado_em on public.chamados (cancelado_em)
  where status = 'cancelado';


-- ---------- Conferência -------------------------------------------------
-- 1) Função e tabela criadas:
select
  (select count(*) from pg_proc where proname = 'reprogramar_suspensao')            as funcao_reprogramar,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'chamado_suspensao_reprogramacoes') as tabela_reprogramacoes,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'chamados'
      and column_name = 'chamado_origem_id')                                        as coluna_origem,
  (select count(*) from public.chamado_mensagens_modelo
    where gatilho = 'suspensao_reprogramada')                                       as modelo_mensagem;

-- 2) Suspensos hoje, com a situação da revisão (horário de Porto Velho):
-- select numero, assunto, suspensao_proxima,
--        case when suspensao_proxima < (now() at time zone 'America/Porto_Velho')::date then 'vencida'
--             when suspensao_proxima = (now() at time zone 'America/Porto_Velho')::date then 'hoje'
--             else 'futura' end as revisao
--   from public.chamados where status = 'suspenso' order by suspensao_proxima;
