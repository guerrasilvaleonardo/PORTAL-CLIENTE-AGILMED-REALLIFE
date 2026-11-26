-- =====================================================================
-- Programa de Estrelas: só o Leonardo decide.
-- Rode no Supabase ("projeto ticket") -> SQL Editor -> Run.
--
-- ANTES:  qualquer gestor ou administrador ativo (hoje, toda a equipe)
--         podia estornar e restabelecer estrelas, autorizar ou recusar
--         extensões de prazo (inclusive de suspensão), configurar o
--         programa, definir o fechamento, fechar o ano e registrar o
--         acompanhamento de avaliação ruim. Na prática, um atendente
--         podia decidir as estrelas dos PRÓPRIOS chamados.
-- DEPOIS: essas ações exigem a marcação "pode_decidir_estrelas" no
--         cadastro. Fica marcado apenas Leonardo Guerra.
--         A marcação NÃO pode ser mudada pelo portal (nem por
--         administrador): só por SQL, aqui no Supabase.
--         Continua igual: ranking, painéis, a visão de gestor/admin
--         (painel individual dos colegas, reconhecimento do mês) e o
--         cálculo automático das estrelas (prazo + avaliação).
--         Nenhuma estrela já lançada é alterada.
-- MOTIVO: pedido do Leonardo em 26/11/2026 ("decidir estrelas só
--         Leonardo"), após atendente com perfil admin poder decidir as
--         próprias estrelas.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- Ordem: rodar este SQL ANTES ou junto do merge do PR. Enquanto o SQL
-- não rodar, vale a regra antiga (gestor/admin), na tela e no banco.
-- =====================================================================

alter table public.profiles
  add column if not exists pode_decidir_estrelas boolean not null default false;

comment on column public.profiles.pode_decidir_estrelas is
  'Decide o Programa de Estrelas (estornos, prazos, configuração, fechamento). Só muda por SQL.';

-- Ninguém muda essa marcação pelo portal (só SQL / chave de serviço).
create or replace function public.profiles_proteger_decidir_estrelas()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is not null
     and new.pode_decidir_estrelas is distinct from old.pode_decidir_estrelas then
    new.pode_decidir_estrelas := old.pode_decidir_estrelas;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_proteger_decidir_estrelas on public.profiles;
create trigger profiles_proteger_decidir_estrelas
  before update on public.profiles
  for each row execute function public.profiles_proteger_decidir_estrelas();

-- Marca somente o Leonardo (conta da equipe interna).
update public.profiles p
   set pode_decidir_estrelas = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'leonardo@reallifessma.com.br'
   and p.perfil in ('atendimento', 'gestor', 'admin')
   and p.pode_decidir_estrelas is distinct from true;

-- Todas as ações de decisão do programa passam por esta função
-- (estornar, restabelecer, decidir prazo, configurar, prévia retroativa,
-- definir fechamento, fechar o ano, acompanhamento). Basta trocar a regra
-- aqui. estrelas_eh_gestor() (quem VÊ a visão de gestor) não muda.
create or replace function public.estrelas_exigir_gestor()
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.pode_decidir_estrelas = true
       and coalesce(p.ativo, true)
  ) then
    raise exception 'Somente o Leonardo (autorizado) pode decidir no Programa de Estrelas.';
  end if;
end;
$fn$;


-- ---------- Conferência -------------------------------------------------
-- Deve listar só o Leonardo.
select p.nome, u.email, p.perfil
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.pode_decidir_estrelas
 order by p.nome;
