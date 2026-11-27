-- =====================================================================
-- Teste de 7 dias em EPI e Inspeções.
--
-- ANTES:  ferramenta não contratada era beco sem saída. O cliente via o
--         cadeado, e a única porta era pedir orçamento de uma coisa que
--         ele nunca usou. Ou tem contrato e usa tudo, ou não tem e não
--         vê nada.
-- DEPOIS: a empresa liga sozinha um teste de 7 dias em EPI ou em
--         Inspeções, uma vez por ferramenta, para sempre. Durante o
--         teste a ferramenta é a de verdade: grava, assina, imprime.
--         No 8º dia ela FECHA EM MODO LEITURA — o cliente continua
--         vendo e imprimindo tudo o que registrou, e só não registra
--         mais. Se quiser seguir, um clique abre o chamado.
-- MOTIVO: uso é o que cria vontade de contratar, e nenhuma dessas duas
--         ferramentas se explica em texto. Mas o que o cliente registrou
--         nos 7 dias é registro legal dele (ficha da NR-06, relatório de
--         inspeção): apagar é inaceitável e esconder atrás do cadeado
--         também. Daí o modo leitura, que é honesto e é o melhor
--         argumento de venda que existe — ele teria de refazer tudo em
--         outro lugar.
--
-- SÓ EPI E INSPEÇÕES. As outras cinco ferramentas não entram: elas só
-- mostram valor com os dados do cliente já carregados, e teste em tela
-- vazia vende contra nós. Implantar e Auditar, além disso, consomem a
-- nossa equipe a cada etapa.
--
-- O QUE ESTE SCRIPT NÃO MEXE: `empresa_tem_modulo` continua querendo
-- dizer CONTRATADO, exatamente como hoje. Se o teste entrasse ali, a
-- empresa em teste passaria a receber os e-mails automáticos da
-- ferramenta, que é justamente o que não pode. Por isso as funções
-- novas, separadas.
--
-- Depende de supabase/modulos-cliente.sql, supabase/modulo-epi.sql,
-- supabase/inspecoes.sql, supabase/modulo-auditoria.sql e
-- supabase/visitas-e-relatorios-emitidos.sql.
-- Não apaga nem altera dados. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regprocedure('public.empresa_tem_modulo(uuid, text)') is null then
    raise exception 'Rode antes supabase/modulos-cliente.sql e os scripts dos módulos.';
  end if;
  if to_regclass('public.epi_entregas') is null then
    raise exception 'Rode antes supabase/epi-entregas.sql.';
  end if;
  if to_regclass('public.inspecao_visitas') is null then
    raise exception 'Rode antes supabase/visitas-e-relatorios-emitidos.sql.';
  end if;
end
$$;


-- ---------- 1. O registro do teste -------------------------------------
-- Uma linha por empresa e ferramenta. A chave única é o que garante
-- "uma vez só, para sempre": sem ela o cliente reiniciaria o teste toda
-- semana e nunca contrataria.
create table if not exists public.modulo_testes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  modulo         text not null check (modulo in ('epi', 'inspecoes')),
  iniciado_em    timestamptz not null default now(),
  termina_em     timestamptz not null,
  iniciado_por   uuid references public.profiles (id) on delete set null,
  -- Preenchidos quando o cliente clica em "Quero contratar" no 8º dia.
  convertido_em  timestamptz,
  chamado_id     uuid references public.chamados (id) on delete set null,
  constraint modulo_testes_um_por_empresa unique (empresa_id, modulo),
  constraint modulo_testes_prazo_coerente check (termina_em > iniciado_em)
);

create index if not exists modulo_testes_empresa_idx
  on public.modulo_testes (empresa_id, modulo);

-- Para o cron que avisa quem está terminando.
create index if not exists modulo_testes_termina_idx
  on public.modulo_testes (termina_em)
  where convertido_em is null;

alter table public.modulo_testes enable row level security;

-- O cliente enxerga o teste da empresa dele; a equipe enxerga todos.
drop policy if exists modulo_testes_leitura on public.modulo_testes;
create policy modulo_testes_leitura
  on public.modulo_testes
  for select to authenticated
  using (
    public.eh_equipe()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.empresa_id = modulo_testes.empresa_id
    )
  );

-- Ninguém grava direto: só pela função abaixo e pela equipe.
drop policy if exists modulo_testes_equipe on public.modulo_testes;
create policy modulo_testes_equipe
  on public.modulo_testes
  for all to authenticated
  using (public.eh_equipe())
  with check (public.eh_equipe());


-- ---------- 2. As três perguntas que o banco precisa responder ---------

-- Está testando AGORA? (grava)
create or replace function public.teste_em_andamento(p_empresa uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.modulo_testes t
     where t.empresa_id = p_empresa
       and t.modulo = p_modulo
       and now() < t.termina_em
  );
$$;

-- Já testou alguma vez? (continua vendo, mesmo depois de fechar)
create or replace function public.teste_ja_houve(p_empresa uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.modulo_testes t
     where t.empresa_id = p_empresa
       and t.modulo = p_modulo
  );
$$;

-- PODE VER: contratou, ou testou um dia. O "testou um dia" é o modo
-- leitura — o registro dele não vira refém.
create or replace function public.empresa_pode_ver_modulo(p_empresa uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.empresa_tem_modulo(p_empresa, p_modulo)
      or public.teste_ja_houve(p_empresa, p_modulo);
$$;

-- PODE GRAVAR: contratou, ou está dentro dos 7 dias.
create or replace function public.empresa_pode_gravar_modulo(p_empresa uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.empresa_tem_modulo(p_empresa, p_modulo)
      or public.teste_em_andamento(p_empresa, p_modulo);
$$;


-- ---------- 3. Ligar o teste, pelo próprio cliente ----------------------
-- Security definer porque o cliente não grava em modulo_testes direto.
-- Recusa em voz alta nos três casos que importam: ferramenta que não
-- tem teste, empresa que já contratou, e empresa que já usou o teste.
create or replace function public.iniciar_teste_modulo(p_modulo text)
returns public.modulo_testes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_linha   public.modulo_testes;
begin
  if p_modulo not in ('epi', 'inspecoes') then
    raise exception 'A ferramenta % não tem teste de 7 dias.', p_modulo
      using errcode = '22023';
  end if;

  select p.empresa_id into v_empresa
    from public.profiles p
   where p.id = auth.uid();

  if v_empresa is null then
    raise exception 'Só dá para começar o teste dentro de uma empresa.'
      using errcode = '42501';
  end if;

  if public.empresa_tem_modulo(v_empresa, p_modulo) then
    raise exception 'A sua empresa já tem essa ferramenta contratada.'
      using errcode = '22023';
  end if;

  if public.teste_ja_houve(v_empresa, p_modulo) then
    raise exception 'A sua empresa já usou o teste desta ferramenta.'
      using errcode = '22023';
  end if;

  insert into public.modulo_testes (empresa_id, modulo, termina_em, iniciado_por)
  values (v_empresa, p_modulo, now() + interval '7 days', auth.uid())
  returning * into v_linha;

  return v_linha;
end
$$;

revoke all on function public.iniciar_teste_modulo(text) from public;
grant execute on function public.iniciar_teste_modulo(text) to authenticated;

-- Registrar que o teste virou pedido, para o portal parar de insistir.
create or replace function public.teste_virou_chamado(p_modulo text, p_chamado uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  select p.empresa_id into v_empresa from public.profiles p where p.id = auth.uid();
  if v_empresa is null then return; end if;

  update public.modulo_testes
     set convertido_em = coalesce(convertido_em, now()),
         chamado_id    = coalesce(chamado_id, p_chamado)
   where empresa_id = v_empresa
     and modulo = p_modulo;
end
$$;

revoke all on function public.teste_virou_chamado(text, uuid) from public;
grant execute on function public.teste_virou_chamado(text, uuid) to authenticated;


-- ---------- 4. Ver: as políticas passam a aceitar quem testou ----------
-- São as mesmas de supabase/modulo-epi.sql e supabase/modulo-auditoria.sql,
-- trocando empresa_tem_modulo por empresa_pode_ver_modulo. A lógica de
-- auditoria x inspeção fica igual: o teste é só de 'inspecoes'.

drop policy if exists epis_modulo_contratado on public.epis;
create policy epis_modulo_contratado
  on public.epis
  as restrictive
  for select to authenticated
  using (public.eh_equipe() or public.empresa_pode_ver_modulo(epis.empresa_id, 'epi'));

drop policy if exists epi_entregas_modulo_contratado on public.epi_entregas;
create policy epi_entregas_modulo_contratado
  on public.epi_entregas
  as restrictive
  for select to authenticated
  using (public.eh_equipe() or public.empresa_pode_ver_modulo(epi_entregas.empresa_id, 'epi'));

drop policy if exists epi_entregas_itens_modulo_contratado on public.epi_entregas_itens;
create policy epi_entregas_itens_modulo_contratado
  on public.epi_entregas_itens
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or exists (
      select 1 from public.epi_entregas e
       where e.id = epi_entregas_itens.entrega_id
         and public.empresa_pode_ver_modulo(e.empresa_id, 'epi')
    )
  );

drop policy if exists inspecoes_modulo_contratado on public.inspecoes;
create policy inspecoes_modulo_contratado
  on public.inspecoes
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or (inspecoes.tipo = 'auditoria'
        and public.empresa_tem_modulo(inspecoes.empresa_id, 'auditoria'))
    or (inspecoes.tipo <> 'auditoria'
        and public.empresa_pode_ver_modulo(inspecoes.empresa_id, 'inspecoes'))
  );

drop policy if exists nao_conformidades_modulo_contratado on public.nao_conformidades;
create policy nao_conformidades_modulo_contratado
  on public.nao_conformidades
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or (
      exists (
        select 1 from public.inspecoes i
         where i.id = nao_conformidades.inspecao_id
           and i.tipo = 'auditoria'
      )
      and public.empresa_tem_modulo(nao_conformidades.empresa_id, 'auditoria')
    )
    or (
      not exists (
        select 1 from public.inspecoes i
         where i.id = nao_conformidades.inspecao_id
           and i.tipo = 'auditoria'
      )
      and public.empresa_pode_ver_modulo(nao_conformidades.empresa_id, 'inspecoes')
    )
  );

drop policy if exists inspecao_modelos_modulo_contratado on public.inspecao_modelos;
create policy inspecao_modelos_modulo_contratado
  on public.inspecao_modelos
  as restrictive
  for select to authenticated
  using (
    public.eh_equipe()
    or inspecao_modelos.empresa_id is null
    or (inspecao_modelos.tipo = 'auditoria'
        and public.empresa_tem_modulo(inspecao_modelos.empresa_id, 'auditoria'))
    or (inspecao_modelos.tipo <> 'auditoria'
        and public.empresa_pode_ver_modulo(inspecao_modelos.empresa_id, 'inspecoes'))
  );


-- ---------- 5. Gravar: o modo leitura, de verdade ----------------------
-- O 8º dia tem de fechar NO BANCO, não só na tela. Uma política por
-- verbo, nunca `for all`: `for all` restritiva valeria também para o
-- select e fecharia a leitura junto, que é exatamente o contrário do
-- que queremos.
--
-- Antes destas, nada gateava escrita por ferramenta — quem é da empresa
-- gravava. Continua assim para quem contratou; muda para quem só testou.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('epis',             'epi'),
      ('epi_entregas',     'epi'),
      ('inspecoes',        'inspecoes'),
      ('inspecao_visitas', 'inspecoes'),
      ('nao_conformidades','inspecoes'),
      ('inspecao_modelos', 'inspecoes')
    ) as x(tabela, modulo)
  loop
    if to_regclass('public.' || t.tabela) is null then
      continue;
    end if;

    execute format(
      'drop policy if exists %I on public.%I',
      t.tabela || '_grava_so_com_acesso', t.tabela);

    -- insert: só WITH CHECK (a linha que está entrando).
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
         with check (public.eh_equipe() or public.empresa_pode_gravar_modulo(%I.empresa_id, %L))',
      t.tabela || '_grava_so_com_acesso', t.tabela, t.tabela, t.modulo);

    execute format(
      'drop policy if exists %I on public.%I',
      t.tabela || '_altera_so_com_acesso', t.tabela);

    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated
         using (public.eh_equipe() or public.empresa_pode_gravar_modulo(%I.empresa_id, %L))
         with check (public.eh_equipe() or public.empresa_pode_gravar_modulo(%I.empresa_id, %L))',
      t.tabela || '_altera_so_com_acesso', t.tabela, t.tabela, t.modulo, t.tabela, t.modulo);

    execute format(
      'drop policy if exists %I on public.%I',
      t.tabela || '_apaga_so_com_acesso', t.tabela);

    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated
         using (public.eh_equipe() or public.empresa_pode_gravar_modulo(%I.empresa_id, %L))',
      t.tabela || '_apaga_so_com_acesso', t.tabela, t.tabela, t.modulo);
  end loop;
end
$$;

-- Os filhos não têm empresa própria: seguem o pai.
drop policy if exists epi_entregas_itens_grava_so_com_acesso on public.epi_entregas_itens;
create policy epi_entregas_itens_grava_so_com_acesso
  on public.epi_entregas_itens
  as restrictive
  for insert to authenticated
  with check (
    public.eh_equipe()
    or exists (
      select 1 from public.epi_entregas e
       where e.id = epi_entregas_itens.entrega_id
         and public.empresa_pode_gravar_modulo(e.empresa_id, 'epi')
    )
  );

drop policy if exists epi_entregas_itens_altera_so_com_acesso on public.epi_entregas_itens;
create policy epi_entregas_itens_altera_so_com_acesso
  on public.epi_entregas_itens
  as restrictive
  for update to authenticated
  using (
    public.eh_equipe()
    or exists (
      select 1 from public.epi_entregas e
       where e.id = epi_entregas_itens.entrega_id
         and public.empresa_pode_gravar_modulo(e.empresa_id, 'epi')
    )
  )
  with check (
    public.eh_equipe()
    or exists (
      select 1 from public.epi_entregas e
       where e.id = epi_entregas_itens.entrega_id
         and public.empresa_pode_gravar_modulo(e.empresa_id, 'epi')
    )
  );

drop policy if exists inspecao_respostas_grava_so_com_acesso on public.inspecao_respostas;
create policy inspecao_respostas_grava_so_com_acesso
  on public.inspecao_respostas
  as restrictive
  for insert to authenticated
  with check (
    public.eh_equipe()
    or exists (
      select 1 from public.inspecoes i
       where i.id = inspecao_respostas.inspecao_id
         and public.empresa_pode_gravar_modulo(i.empresa_id, 'inspecoes')
    )
  );

drop policy if exists inspecao_respostas_altera_so_com_acesso on public.inspecao_respostas;
create policy inspecao_respostas_altera_so_com_acesso
  on public.inspecao_respostas
  as restrictive
  for update to authenticated
  using (
    public.eh_equipe()
    or exists (
      select 1 from public.inspecoes i
       where i.id = inspecao_respostas.inspecao_id
         and public.empresa_pode_gravar_modulo(i.empresa_id, 'inspecoes')
    )
  )
  with check (
    public.eh_equipe()
    or exists (
      select 1 from public.inspecoes i
       where i.id = inspecao_respostas.inspecao_id
         and public.empresa_pode_gravar_modulo(i.empresa_id, 'inspecoes')
    )
  );


-- ---------- Conferência -------------------------------------------------
-- Esperado numa base que ainda não tem nenhum teste:
--   testes_registrados ....... 0
--   politicas_de_escrita ..... 22  (6 tabelas x 3 verbos + 4 dos filhos)
--   funcoes .................. 6
--   ver_sem_contrato ......... false   (empresa sem contrato nem teste)
--   gravar_sem_contrato ...... false
select
  (select count(*) from public.modulo_testes)                                   as testes_registrados,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and (policyname like '%_grava_so_com_acesso'
        or policyname like '%_altera_so_com_acesso'
        or policyname like '%_apaga_so_com_acesso'))                            as politicas_de_escrita,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('teste_em_andamento', 'teste_ja_houve',
                        'empresa_pode_ver_modulo', 'empresa_pode_gravar_modulo',
                        'iniciar_teste_modulo', 'teste_virou_chamado'))         as funcoes,
  (select public.empresa_pode_ver_modulo(
            (select id from public.empresas where not coalesce(modulo_epi, false)
              order by razao_social limit 1), 'epi'))                           as ver_sem_contrato,
  (select public.empresa_pode_gravar_modulo(
            (select id from public.empresas where not coalesce(modulo_epi, false)
              order by razao_social limit 1), 'epi'))                           as gravar_sem_contrato;
