-- =====================================================================
-- Chamados: PARTICIPANTES (quem do cliente vê o chamado)
--           + MENSAGENS AUTOMÁTICAS no chat do chamado
-- Rode no Supabase -> SQL Editor. Pode rodar mais de uma vez.
--
-- PARTICIPANTES
--   chamados.visibilidade:
--     'restrita' (padrão dos chamados NOVOS): do lado do cliente, só vê
--                quem abriu + os participantes escolhidos;
--     'empresa' : todos os usuários da empresa veem (como era antes).
--   Os chamados que JÁ EXISTEM ficam como 'empresa' — ninguém perde
--   acesso ao que já via. Dá para restringir um a um depois.
--   Equipe interna continua vendo tudo.
--   Quem escolhe participantes: equipe interna e quem abriu o chamado.
--
--   Mensagens, anexos, links, eventos e etapas já filtram pelo que a
--   regra de chamados libera, então a restrição vale para tudo.
--
-- ANTES -> DEPOIS (únicas regras existentes alteradas, em chamados):
--   "Clientes podem visualizar seus chamados" (SELECT)
--   "Usuários podem atualizar chamados da própria empresa" (UPDATE)
--     ANTES : empresa_id = empresa do usuário
--     DEPOIS: empresa_id = empresa do usuário
--             E (visibilidade = 'empresa' OU abriu o chamado OU é participante)
--
-- MENSAGENS AUTOMÁTICAS
--   Escritas pelo banco no chat, sem autor (autor_id vazio +
--   automatica = true). Textos editáveis na tabela
--   chamado_mensagens_modelo, sem mexer em código.
--   Gatilhos: aberto, em_atendimento, reaberto, aguardando_cliente,
--   resolvido, encerrado.
--   Nada foi alterado nas funções de notificação existentes: sem autor,
--   elas não disparam aviso para essas mensagens.
-- =====================================================================


-- ---------- 1. Visibilidade do chamado --------------------------------
-- A coluna nasce com 'empresa' (preenche os chamados existentes) e
-- depois o padrão passa a 'restrita' para os novos.
alter table public.chamados
  add column if not exists visibilidade text not null default 'empresa';

alter table public.chamados
  drop constraint if exists chamados_visibilidade_check;
alter table public.chamados
  add constraint chamados_visibilidade_check
  check (visibilidade in ('restrita', 'empresa'));

alter table public.chamados
  alter column visibilidade set default 'restrita';


-- ---------- 2. Participantes ------------------------------------------
create table if not exists public.chamado_participantes (
  chamado_id     uuid not null references public.chamados (id) on delete cascade,
  usuario_id     uuid not null references public.profiles (id) on delete cascade,
  adicionado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  primary key (chamado_id, usuario_id)
);

create index if not exists chamado_participantes_usuario
  on public.chamado_participantes (usuario_id);

-- Participante tem de ser usuário cliente ativo da MESMA empresa.
create or replace function public.chamado_participantes_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1
      from public.profiles p
      join public.chamados c on c.id = new.chamado_id
     where p.id = new.usuario_id
       and p.perfil = 'cliente'
       and p.ativo = true
       and p.empresa_id = c.empresa_id
  ) then
    raise exception 'Participante precisa ser um usuário ativo da empresa do chamado.';
  end if;

  new.adicionado_por := coalesce(new.adicionado_por, auth.uid());
  return new;
end;
$fn$;

drop trigger if exists chamado_participantes_valida on public.chamado_participantes;
create trigger chamado_participantes_valida
  before insert or update on public.chamado_participantes
  for each row execute function public.chamado_participantes_valida();

-- Checagens usadas nas regras. SECURITY DEFINER evita recursão entre
-- as regras de chamados e de participantes.
create or replace function public.eh_participante(p_chamado uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.chamado_participantes
     where chamado_id = p_chamado and usuario_id = auth.uid()
  );
$fn$;

create or replace function public.abriu_o_chamado(p_chamado uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.chamados
     where id = p_chamado and criado_por = auth.uid()
  );
$fn$;

alter table public.chamado_participantes enable row level security;

grant select, insert, delete on public.chamado_participantes to authenticated;

drop policy if exists chamado_participantes_leitura on public.chamado_participantes;
create policy chamado_participantes_leitura
  on public.chamado_participantes
  for select to authenticated
  using (
    public.e_equipe_interna()
    or exists (select 1 from public.chamados c where c.id = chamado_participantes.chamado_id)
  );

drop policy if exists chamado_participantes_inclusao on public.chamado_participantes;
create policy chamado_participantes_inclusao
  on public.chamado_participantes
  for insert to authenticated
  with check (
    public.e_equipe_interna()
    or public.abriu_o_chamado(chamado_id)
  );

drop policy if exists chamado_participantes_remocao on public.chamado_participantes;
create policy chamado_participantes_remocao
  on public.chamado_participantes
  for delete to authenticated
  using (
    public.e_equipe_interna()
    or public.abriu_o_chamado(chamado_id)
  );


-- ---------- 3. Regras de chamados (ANTES -> DEPOIS no cabeçalho) ------
drop policy if exists "Clientes podem visualizar seus chamados" on public.chamados;
create policy "Clientes podem visualizar seus chamados"
  on public.chamados
  for select
  using (
    empresa_id = (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
    and (
      visibilidade = 'empresa'
      or criado_por = auth.uid()
      or public.eh_participante(id)
    )
  );

drop policy if exists "Usuários podem atualizar chamados da própria empresa" on public.chamados;
create policy "Usuários podem atualizar chamados da própria empresa"
  on public.chamados
  for update
  using (
    empresa_id = (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
    and (
      visibilidade = 'empresa'
      or criado_por = auth.uid()
      or public.eh_participante(id)
    )
  )
  with check (
    empresa_id = (select profiles.empresa_id from public.profiles where profiles.id = auth.uid())
  );


-- Só equipe interna ou quem abriu podem mudar quem vê o chamado
-- (participantes também têm permissão de atualizar o chamado, mas não
-- podem abri-lo para a empresa toda). A mudança fica no histórico.
create or replace function public.chamado_visibilidade_guarda()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.visibilidade is distinct from old.visibilidade then
    if auth.uid() is not null
       and not public.e_equipe_interna()
       and old.criado_por is distinct from auth.uid() then
      raise exception 'Só a equipe ou quem abriu o chamado pode mudar quem o vê.';
    end if;

    begin
      insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id)
      values (new.id, 'visibilidade', old.visibilidade, new.visibilidade, auth.uid());
    exception when others then null;
    end;
  end if;

  return new;
end;
$fn$;

drop trigger if exists chamado_visibilidade_guarda on public.chamados;
create trigger chamado_visibilidade_guarda
  before update of visibilidade on public.chamados
  for each row execute function public.chamado_visibilidade_guarda();

-- Histórico de participantes (protegido: falha no histórico não
-- impede a inclusão/remoção).
create or replace function public.chamado_participantes_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  alvo record;
  nome text;
begin
  alvo := case when tg_op = 'DELETE' then old else new end;
  select coalesce(p.nome, p.email) into nome from public.profiles p where p.id = alvo.usuario_id;

  begin
    insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id)
    values (alvo.chamado_id, 'participante', nome,
            case when tg_op = 'DELETE' then 'removido' else 'adicionado' end,
            auth.uid());
  exception when others then null;
  end;

  return null;
end;
$fn$;

drop trigger if exists chamado_participantes_historico on public.chamado_participantes;
create trigger chamado_participantes_historico
  after insert or delete on public.chamado_participantes
  for each row execute function public.chamado_participantes_historico();


-- ---------- 4. Mensagens automáticas ----------------------------------
alter table public.chamado_mensagens
  add column if not exists automatica boolean not null default false;

-- Mensagem automática não tem autor; as demais continuam exigindo.
alter table public.chamado_mensagens
  alter column autor_id drop not null;

alter table public.chamado_mensagens
  drop constraint if exists chamado_mensagens_autor_check;
alter table public.chamado_mensagens
  add constraint chamado_mensagens_autor_check
  check (autor_id is not null or automatica);

create table if not exists public.chamado_mensagens_modelo (
  gatilho     text primary key,
  texto       text not null,
  ativo       boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table public.chamado_mensagens_modelo enable row level security;
grant select, update on public.chamado_mensagens_modelo to authenticated;

drop policy if exists chamado_mensagens_modelo_equipe on public.chamado_mensagens_modelo;
create policy chamado_mensagens_modelo_equipe
  on public.chamado_mensagens_modelo
  for all to authenticated
  using (public.e_equipe_interna())
  with check (public.e_equipe_interna());

-- Textos iniciais. Só insere o que ainda não existe: se você já
-- editou algum texto, rodar de novo NÃO sobrescreve.
-- Marcadores: {numero} e {assunto}.
insert into public.chamado_mensagens_modelo (gatilho, texto) values
('aberto',
 E'Olá! 😊 Recebemos o seu chamado #{numero} — {assunto}.\n\nEle já está na fila de atendimento. Você será avisado(a) por aqui e por e-mail a cada atualização.'),
('em_atendimento',
 E'Seu chamado #{numero} está em atendimento. Um especialista da nossa equipe já está cuidando da sua solicitação.'),
('reaberto',
 E'Recebemos o seu retorno e o chamado #{numero} voltou para atendimento. Vamos analisar e responder por aqui.'),
('aguardando_cliente',
 E'Para darmos continuidade ao chamado #{numero}, precisamos de um retorno seu. Responda por aqui assim que possível.\n\nEnquanto aguardamos, o prazo de atendimento fica pausado.'),
('resolvido',
 E'Olá! 😊 Seu chamado #{numero} foi atualizado para Resolvido.\n\nCaso não haja nenhuma manifestação nas próximas 24 horas úteis, ele será encerrado e arquivado automaticamente. Se algo ainda não estiver certo, basta responder por aqui que o chamado volta para atendimento.\n\nAgradecemos pela confiança e esperamos ter contribuído da melhor forma possível. Foi um prazer atendê-lo(a)! Sempre que precisar, estaremos à disposição.'),
('encerrado',
 E'O chamado #{numero} foi encerrado e arquivado. Se o assunto voltar a acontecer, é só abrir um novo chamado.\n\nObrigado pela confiança!')
on conflict (gatilho) do nothing;

create or replace function public.enviar_mensagem_automatica(p_chamado uuid, p_gatilho text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  modelo text;
  c record;
begin
  select texto into modelo
    from public.chamado_mensagens_modelo
   where gatilho = p_gatilho and ativo;

  if modelo is null then
    return;
  end if;

  select numero, assunto into c from public.chamados where id = p_chamado;

  insert into public.chamado_mensagens (chamado_id, autor_id, mensagem, automatica)
  values (
    p_chamado,
    null,
    replace(replace(modelo, '{numero}', coalesce(c.numero::text, '')),
            '{assunto}', coalesce(c.assunto, '')),
    true
  );
exception when others then
  -- A mensagem automática nunca pode impedir a mudança do chamado.
  raise warning 'Mensagem automatica nao enviada (%): %', p_gatilho, sqlerrm;
end;
$fn$;

revoke all on function public.enviar_mensagem_automatica(uuid, text) from public, anon, authenticated;

create or replace function public.chamado_mensagem_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  gatilho text;
begin
  if tg_op = 'INSERT' then
    gatilho := 'aberto';
  elsif new.status is distinct from old.status then
    gatilho := case
      when new.status = 'resolvido'          then 'resolvido'
      when new.status = 'encerrado'          then 'encerrado'
      when new.status = 'aguardando_cliente' then 'aguardando_cliente'
      when old.status = 'resolvido'
           and new.status in ('aberto', 'em_atendimento') then 'reaberto'
      when new.status = 'em_atendimento'
           and old.status = 'aberto'         then 'em_atendimento'
      else null
    end;
  end if;

  if gatilho is not null then
    perform public.enviar_mensagem_automatica(new.id, gatilho);
  end if;

  return null;
end;
$fn$;

drop trigger if exists chamado_mensagem_automatica on public.chamados;
create trigger chamado_mensagem_automatica
  after insert or update of status on public.chamados
  for each row execute function public.chamado_mensagem_automatica();


-- =====================================================================
-- CONFERÊNCIA (rode à parte, se quiser)
--   select visibilidade, count(*) from public.chamados group by 1;
--   select gatilho, ativo, left(texto, 60) from public.chamado_mensagens_modelo;
-- Para editar um texto:
--   update public.chamado_mensagens_modelo
--      set texto = '...', atualizado_em = now() where gatilho = 'resolvido';
-- Para desligar um gatilho:
--   update public.chamado_mensagens_modelo set ativo = false where gatilho = 'em_atendimento';
-- =====================================================================
