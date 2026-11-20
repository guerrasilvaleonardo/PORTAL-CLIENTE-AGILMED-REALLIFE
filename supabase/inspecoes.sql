-- =====================================================================
-- Inspeções e não conformidades.
--
-- ANTES:  o portal registrava documento, treinamento, certificado e
--         EPI — o que a empresa TEM. Não registrava o que o técnico
--         VIU em campo: a inspeção, o que estava errado e o que foi
--         feito a respeito.
-- DEPOIS: modelo de checklist, aplicação da inspeção num local, e cada
--         item reprovado vira uma não conformidade com responsável,
--         prazo e o ciclo de tratamento até a verificação da eficácia.
-- MOTIVO: é o que a ISO 45001 e a ISO 9001 pedem no item 10.2 — reagir
--         à não conformidade, avaliar a causa, agir sobre ela e
--         verificar se a ação funcionou, mantendo registro de tudo.
--
-- OS DOIS LADOS APLICAM. O técnico da Real Life aplica a inspeção no
-- cliente, e o cliente aplica as dele (a inspeção diária do
-- encarregado). Quem pode é a mesma regra do EPI: equipe interna
-- sempre, cliente só na empresa dele.
--
-- FERRAMENTA COBRADA À PARTE, como as outras: modulo_inspecoes nasce
-- false e é marcado empresa por empresa, conforme vender.
--
-- O QUE FICA CONGELADO, E POR QUÊ. A inspeção é documento: guarda o
-- nome do modelo, o do local, o do inspetor e o texto de cada pergunta
-- como estavam no dia. Mudar o modelo amanhã não pode reescrever o que
-- foi inspecionado ontem.
--
-- CONCLUIR GERA AS NÃO CONFORMIDADES. Ao fechar a inspeção, cada item
-- "não conforme" vira uma linha em nao_conformidades, com prazo padrão
-- de 30 dias — que o responsável ajusta. Sem isso, o achado morre na
-- tela e ninguém trata.
--
-- Depende de supabase/modulos-cliente.sql e supabase/locais-trabalho.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regprocedure('public.empresa_tem_modulo(uuid, text)') is null then
    raise exception 'Rode antes supabase/modulos-cliente.sql.';
  end if;
  if to_regclass('public.locais_trabalho') is null then
    raise exception 'Rode antes supabase/locais-trabalho.sql.';
  end if;
end
$$;


-- ---------- 1. Modelos de checklist ------------------------------------
-- empresa_id vazio = modelo da casa (Real Life), que serve para
-- qualquer cliente. Preenchido = modelo próprio daquela empresa.
create table if not exists public.inspecao_modelos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references public.empresas (id) on delete cascade,
  nome          text not null,
  descricao     text,
  -- A norma de referência, como se escreve na capa do relatório:
  -- "NR-18", "NR-35", "ISO 45001:2018", "ISO 9001:2015", "5S".
  norma         text,
  ativo         boolean not null default true,
  criado_por    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists inspecao_modelos_empresa on public.inspecao_modelos (empresa_id);

create table if not exists public.inspecao_modelo_itens (
  id          uuid primary key default gen_random_uuid(),
  modelo_id   uuid not null references public.inspecao_modelos (id) on delete cascade,
  ordem       integer not null default 0,
  -- Agrupador na folha: "Proteção coletiva", "Organização", "EPI".
  categoria   text,
  pergunta    text not null,
  -- O que olhar para responder. Vira a dica embaixo da pergunta.
  orientacao  text,
  peso        integer not null default 1,
  exige_foto  boolean not null default false,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists inspecao_modelo_itens_modelo on public.inspecao_modelo_itens (modelo_id, ordem);

alter table public.inspecao_modelo_itens drop constraint if exists inspecao_modelo_itens_peso;
alter table public.inspecao_modelo_itens add constraint inspecao_modelo_itens_peso check (peso between 1 and 10);


-- ---------- 2. A inspeção aplicada -------------------------------------
create table if not exists public.inspecoes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  modelo_id      uuid references public.inspecao_modelos (id) on delete set null,
  local_id       uuid references public.locais_trabalho (id) on delete set null,
  -- Congelados: ver o cabeçalho.
  modelo_nome    text not null,
  norma          text,
  local_nome     text,
  inspetor_id    uuid references public.profiles (id) on delete set null,
  inspetor_nome  text,
  iniciada_em    timestamptz not null default now(),
  concluida_em   timestamptz,
  situacao       text not null default 'em_andamento',
  observacoes    text,
  cancelada_em   timestamptz,
  motivo_cancelamento text,
  -- Totais congelados na conclusão.
  itens_total       integer not null default 0,
  conformes         integer not null default 0,
  nao_conformes     integer not null default 0,
  nao_aplicaveis    integer not null default 0,
  -- Conformidade em % dos itens que valiam ponto (N/A fora da conta).
  percentual     numeric(5, 2),
  created_at     timestamptz not null default now()
);

alter table public.inspecoes drop constraint if exists inspecoes_situacao;
alter table public.inspecoes
  add constraint inspecoes_situacao check (situacao in ('em_andamento', 'concluida', 'cancelada'));

create index if not exists inspecoes_empresa on public.inspecoes (empresa_id, iniciada_em desc);
create index if not exists inspecoes_local on public.inspecoes (local_id);
create index if not exists inspecoes_situacao_idx on public.inspecoes (empresa_id, situacao);


create table if not exists public.inspecao_respostas (
  id          uuid primary key default gen_random_uuid(),
  inspecao_id uuid not null references public.inspecoes (id) on delete cascade,
  item_id     uuid references public.inspecao_modelo_itens (id) on delete set null,
  ordem       integer not null default 0,
  -- Congelados.
  categoria   text,
  pergunta    text not null,
  peso        integer not null default 1,
  resposta    text,
  observacao  text,
  foto_path   text,
  created_at  timestamptz not null default now()
);

alter table public.inspecao_respostas drop constraint if exists inspecao_respostas_valor;
alter table public.inspecao_respostas
  add constraint inspecao_respostas_valor
  check (resposta is null or resposta in ('conforme', 'nao_conforme', 'nao_aplicavel'));

create index if not exists inspecao_respostas_inspecao on public.inspecao_respostas (inspecao_id, ordem);


-- ---------- 3. Não conformidades ---------------------------------------
-- Os campos seguem o ciclo que a ISO 45001 e a ISO 9001 pedem no 10.2:
-- a correção imediata, a causa, a ação sobre a causa e a verificação de
-- que a ação funcionou.
create table if not exists public.nao_conformidades (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  -- Vazio = não conformidade avulsa, anotada fora de inspeção.
  inspecao_id   uuid references public.inspecoes (id) on delete set null,
  resposta_id   uuid references public.inspecao_respostas (id) on delete set null,
  local_id      uuid references public.locais_trabalho (id) on delete set null,
  local_nome    text,
  -- O que foi visto. Vem da pergunta + observação, e pode ser reescrito.
  descricao     text not null,
  foto_path     text,
  gravidade     text not null default 'media',
  prazo         date,
  responsavel_id   uuid references public.profiles (id) on delete set null,
  responsavel_nome text,
  acao_imediata text,
  causa         text,
  acao_corretiva text,
  situacao      text not null default 'aberta',
  verificada_em timestamptz,
  verificada_por uuid references public.profiles (id) on delete set null,
  eficaz        boolean,
  verificacao_obs text,
  encerrada_em  timestamptz,
  aberta_por    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.nao_conformidades drop constraint if exists nao_conformidades_gravidade;
alter table public.nao_conformidades
  add constraint nao_conformidades_gravidade
  check (gravidade in ('baixa', 'media', 'alta', 'critica'));

alter table public.nao_conformidades drop constraint if exists nao_conformidades_situacao;
alter table public.nao_conformidades
  add constraint nao_conformidades_situacao
  check (situacao in ('aberta', 'em_acao', 'aguardando_verificacao', 'encerrada', 'cancelada'));

create index if not exists nao_conformidades_empresa on public.nao_conformidades (empresa_id, situacao);
create index if not exists nao_conformidades_inspecao on public.nao_conformidades (inspecao_id);
create index if not exists nao_conformidades_prazo on public.nao_conformidades (prazo);


-- ---------- 4. Ajustes na gravação -------------------------------------
create or replace function public.inspecao_modelos_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.nome := btrim(coalesce(new.nome, ''));
  if new.nome = '' then
    raise exception 'Informe o nome do modelo de inspeção.';
  end if;

  new.descricao := nullif(btrim(coalesce(new.descricao, '')), '');
  new.norma     := nullif(btrim(coalesce(new.norma, '')), '');

  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.created_at := now();
  else
    new.empresa_id := old.empresa_id;
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists inspecao_modelos_ajustes on public.inspecao_modelos;
create trigger inspecao_modelos_ajustes
  before insert or update on public.inspecao_modelos
  for each row execute function public.inspecao_modelos_ajustes();


-- Conclusão da inspeção: conta os totais e abre as não conformidades.
create or replace function public.inspecoes_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_total    integer;
  v_conf     integer;
  v_nc       integer;
  v_na       integer;
  v_prazo    date;
  r          record;
begin
  if tg_op = 'INSERT' then
    new.inspetor_id   := coalesce(new.inspetor_id, auth.uid());
    new.created_at    := now();
  else
    new.empresa_id := old.empresa_id;
    new.created_at := old.created_at;
  end if;

  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

  -- Fechou agora: conta e abre as NCs. Reabrir não é previsto, então o
  -- bloco só roda na virada para concluída.
  if new.situacao = 'concluida' and coalesce(old.situacao, '') <> 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());

    select count(*),
           count(*) filter (where resposta = 'conforme'),
           count(*) filter (where resposta = 'nao_conforme'),
           count(*) filter (where resposta = 'nao_aplicavel')
      into v_total, v_conf, v_nc, v_na
      from public.inspecao_respostas
     where inspecao_id = new.id;

    new.itens_total    := coalesce(v_total, 0);
    new.conformes      := coalesce(v_conf, 0);
    new.nao_conformes  := coalesce(v_nc, 0);
    new.nao_aplicaveis := coalesce(v_na, 0);

    -- O "não aplicável" sai da conta: contar como acerto inflaria a
    -- nota de quem marca N/A em tudo.
    if coalesce(v_conf, 0) + coalesce(v_nc, 0) > 0 then
      new.percentual := round(100.0 * v_conf / (v_conf + v_nc), 2);
    else
      new.percentual := null;
    end if;

    v_prazo := (new.concluida_em at time zone 'America/Porto_Velho')::date + 30;

    for r in
      select id, pergunta, observacao, foto_path
        from public.inspecao_respostas
       where inspecao_id = new.id and resposta = 'nao_conforme'
       order by ordem
    loop
      -- Rodar de novo a conclusão não duplica o que já foi aberto.
      if not exists (select 1 from public.nao_conformidades where resposta_id = r.id) then
        insert into public.nao_conformidades (
          empresa_id, inspecao_id, resposta_id, local_id, local_nome,
          descricao, foto_path, prazo, aberta_por
        ) values (
          new.empresa_id, new.id, r.id, new.local_id, new.local_nome,
          r.pergunta || case when nullif(btrim(coalesce(r.observacao, '')), '') is null
                             then '' else ' — ' || btrim(r.observacao) end,
          r.foto_path, v_prazo, auth.uid()
        );
      end if;
    end loop;
  end if;

  return new;
end;
$fn$;

drop trigger if exists inspecoes_ajustes on public.inspecoes;
create trigger inspecoes_ajustes
  before insert or update on public.inspecoes
  for each row execute function public.inspecoes_ajustes();


create or replace function public.nao_conformidades_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.descricao := btrim(coalesce(new.descricao, ''));
  if new.descricao = '' then
    raise exception 'Informe o que foi encontrado.';
  end if;

  new.acao_imediata   := nullif(btrim(coalesce(new.acao_imediata, '')), '');
  new.causa           := nullif(btrim(coalesce(new.causa, '')), '');
  new.acao_corretiva  := nullif(btrim(coalesce(new.acao_corretiva, '')), '');
  new.verificacao_obs := nullif(btrim(coalesce(new.verificacao_obs, '')), '');

  if tg_op = 'INSERT' then
    new.aberta_por := coalesce(new.aberta_por, auth.uid());
    new.created_at := now();
  else
    new.empresa_id  := old.empresa_id;
    new.inspecao_id := old.inspecao_id;
    new.resposta_id := old.resposta_id;
    new.aberta_por  := old.aberta_por;
    new.created_at  := old.created_at;
  end if;

  -- Encerrar sem dizer a causa e a ação é fechar o papel sem tratar o
  -- problema — é exatamente o que o 10.2 das duas normas não aceita.
  if new.situacao = 'encerrada' and coalesce(old.situacao, '') <> 'encerrada' then
    if new.causa is null or new.acao_corretiva is null then
      raise exception 'Para encerrar, informe a causa e a ação corretiva.';
    end if;
    if new.verificada_em is null then
      new.verificada_em  := now();
      new.verificada_por := coalesce(new.verificada_por, auth.uid());
    end if;
    new.encerrada_em := coalesce(new.encerrada_em, now());
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists nao_conformidades_ajustes on public.nao_conformidades;
create trigger nao_conformidades_ajustes
  before insert or update on public.nao_conformidades
  for each row execute function public.nao_conformidades_ajustes();


-- ---------- 5. Quem pode -----------------------------------------------
-- Mesma regra do EPI: equipe interna sempre; cliente só na empresa dele.
create or replace function public.pode_gerir_inspecoes(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and coalesce(p.ativo, true)
       and (p.perfil in ('atendimento', 'gestor', 'admin')
            or (p.perfil = 'cliente' and public.usuario_pertence_empresa(p.id, p_empresa)))
  );
$fn$;

revoke all on function public.pode_gerir_inspecoes(uuid) from public, anon;
grant execute on function public.pode_gerir_inspecoes(uuid) to authenticated;


-- ---------- 6. RLS ------------------------------------------------------
alter table public.inspecao_modelos      enable row level security;
alter table public.inspecao_modelo_itens enable row level security;
alter table public.inspecoes             enable row level security;
alter table public.inspecao_respostas    enable row level security;
alter table public.nao_conformidades     enable row level security;

-- Modelos: o da casa (empresa vazia) serve para todo mundo ler, mas só
-- a equipe cria e edita. O da empresa é dela.
drop policy if exists inspecao_modelos_leitura on public.inspecao_modelos;
create policy inspecao_modelos_leitura
  on public.inspecao_modelos for select to authenticated
  using (empresa_id is null or public.pode_gerir_inspecoes(empresa_id));

drop policy if exists inspecao_modelos_inclusao on public.inspecao_modelos;
create policy inspecao_modelos_inclusao
  on public.inspecao_modelos for insert to authenticated
  with check (
    case when empresa_id is null then public.eh_equipe()
         else public.pode_gerir_inspecoes(empresa_id) end
  );

drop policy if exists inspecao_modelos_alteracao on public.inspecao_modelos;
create policy inspecao_modelos_alteracao
  on public.inspecao_modelos for update to authenticated
  using (case when empresa_id is null then public.eh_equipe()
              else public.pode_gerir_inspecoes(empresa_id) end)
  with check (case when empresa_id is null then public.eh_equipe()
                   else public.pode_gerir_inspecoes(empresa_id) end);

-- Itens do modelo: seguem o modelo.
drop policy if exists inspecao_modelo_itens_leitura on public.inspecao_modelo_itens;
create policy inspecao_modelo_itens_leitura
  on public.inspecao_modelo_itens for select to authenticated
  using (exists (
    select 1 from public.inspecao_modelos m
     where m.id = inspecao_modelo_itens.modelo_id
       and (m.empresa_id is null or public.pode_gerir_inspecoes(m.empresa_id))
  ));

drop policy if exists inspecao_modelo_itens_escrita on public.inspecao_modelo_itens;
create policy inspecao_modelo_itens_escrita
  on public.inspecao_modelo_itens for all to authenticated
  using (exists (
    select 1 from public.inspecao_modelos m
     where m.id = inspecao_modelo_itens.modelo_id
       and (case when m.empresa_id is null then public.eh_equipe()
                 else public.pode_gerir_inspecoes(m.empresa_id) end)
  ))
  with check (exists (
    select 1 from public.inspecao_modelos m
     where m.id = inspecao_modelo_itens.modelo_id
       and (case when m.empresa_id is null then public.eh_equipe()
                 else public.pode_gerir_inspecoes(m.empresa_id) end)
  ));

-- Inspeções e respostas.
drop policy if exists inspecoes_leitura on public.inspecoes;
create policy inspecoes_leitura
  on public.inspecoes for select to authenticated
  using (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists inspecoes_inclusao on public.inspecoes;
create policy inspecoes_inclusao
  on public.inspecoes for insert to authenticated
  with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists inspecoes_alteracao on public.inspecoes;
create policy inspecoes_alteracao
  on public.inspecoes for update to authenticated
  using (public.pode_gerir_inspecoes(empresa_id))
  with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists inspecao_respostas_escrita on public.inspecao_respostas;
create policy inspecao_respostas_escrita
  on public.inspecao_respostas for all to authenticated
  using (exists (
    select 1 from public.inspecoes i
     where i.id = inspecao_respostas.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ))
  with check (exists (
    select 1 from public.inspecoes i
     where i.id = inspecao_respostas.inspecao_id
       and public.pode_gerir_inspecoes(i.empresa_id)
  ));

-- Não conformidades.
drop policy if exists nao_conformidades_leitura on public.nao_conformidades;
create policy nao_conformidades_leitura
  on public.nao_conformidades for select to authenticated
  using (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists nao_conformidades_inclusao on public.nao_conformidades;
create policy nao_conformidades_inclusao
  on public.nao_conformidades for insert to authenticated
  with check (public.pode_gerir_inspecoes(empresa_id));

drop policy if exists nao_conformidades_alteracao on public.nao_conformidades;
create policy nao_conformidades_alteracao
  on public.nao_conformidades for update to authenticated
  using (public.pode_gerir_inspecoes(empresa_id))
  with check (public.pode_gerir_inspecoes(empresa_id));

grant select, insert, update on public.inspecao_modelos      to authenticated;
grant select, insert, update, delete on public.inspecao_modelo_itens to authenticated;
grant select, insert, update on public.inspecoes             to authenticated;
grant select, insert, update, delete on public.inspecao_respostas to authenticated;
grant select, insert, update on public.nao_conformidades     to authenticated;

revoke delete, truncate on public.inspecao_modelos  from anon, authenticated;
revoke delete, truncate on public.inspecoes         from anon, authenticated;
revoke delete, truncate on public.nao_conformidades from anon, authenticated;
revoke all on public.inspecao_modelos      from anon;
revoke all on public.inspecao_modelo_itens from anon;
revoke all on public.inspecoes             from anon;
revoke all on public.inspecao_respostas    from anon;
revoke all on public.nao_conformidades     from anon;


-- ---------- 7. Ferramenta contratada ------------------------------------
alter table public.empresas
  add column if not exists modulo_inspecoes boolean not null default false;

create or replace function public.empresa_tem_modulo(p_empresa uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_modulo
             when 'certificados' then e.modulo_certificados
             when 'treinamentos' then e.modulo_treinamentos
             when 'documentos'   then e.modulo_documentos
             when 'epi'          then e.modulo_epi
             when 'inspecoes'    then e.modulo_inspecoes
           end
    from public.empresas e
    where e.id = p_empresa
  ), false);
$$;

drop policy if exists inspecoes_modulo_contratado on public.inspecoes;
create policy inspecoes_modulo_contratado
  on public.inspecoes
  as restrictive
  for select to authenticated
  using (public.eh_equipe() or public.empresa_tem_modulo(inspecoes.empresa_id, 'inspecoes'));

drop policy if exists nao_conformidades_modulo_contratado on public.nao_conformidades;
create policy nao_conformidades_modulo_contratado
  on public.nao_conformidades
  as restrictive
  for select to authenticated
  using (public.eh_equipe() or public.empresa_tem_modulo(nao_conformidades.empresa_id, 'inspecoes'));


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.inspecao_modelos)                           as modelos,
       (select count(*) from public.inspecoes)                                  as inspecoes,
       (select count(*) from public.nao_conformidades)                          as nao_conformidades,
       (select count(*) from public.empresas where modulo_inspecoes)            as empresas_com_modulo,
       (select count(*) from pg_policies
         where schemaname = 'public'
           and tablename in ('inspecao_modelos', 'inspecao_modelo_itens', 'inspecoes',
                             'inspecao_respostas', 'nao_conformidades'))        as politicas;
