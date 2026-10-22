-- =====================================================================
-- 1) Conversas: cliente volta a conseguir enviar mensagem para a equipe.
-- 2) Chamado Resolvido: a mensagem do cliente não reabre mais sozinha;
--    o cliente confirma ("Sim, pode encerrar") ou reabre dizendo o que
--    faltou ("Não, reabrir").
--
-- 1) ANTES:  a regra de envio do chat consultava o perfil do destinatário
--            na tabela profiles. Para o cliente, essa consulta passa pela
--            regra de leitura de profiles, que não mostra a equipe: o
--            cliente nunca "via" o atendente ativo e o envio era recusado
--            ("Não foi possível enviar a mensagem").
--    DEPOIS: a mesma regra (quem pode falar com quem) é verificada por
--            funções do banco que enxergam os perfis. Nada muda para a
--            equipe; o cliente continua falando só com a equipe interna.
--
-- 2) ANTES:  qualquer mensagem do cliente num chamado Resolvido (até
--            "obrigado") reabria o chamado e suspendia as estrelas.
--    DEPOIS: em Resolvido, a mensagem só entra na conversa. O cliente tem
--            os botões "Sim, pode encerrar" (vai para Encerrado) e "Não,
--            reabrir" (exige dizer o que faltou; volta para Em atendimento).
--            Em "Aguardando cliente" a resposta continua retomando o
--            atendimento, como antes.
--            O texto automático de "Resolvido" é atualizado SÓ se ainda for
--            o texto original (texto editado por vocês não é tocado).
--
-- Não apaga mensagens, chamados nem estrelas. Pode rodar mais de uma vez.
-- =====================================================================


-- ---------- 1. Chat: regra de envio sem depender da leitura de profiles --
create or replace function public.chat_eu_sou_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.ativo = true
                    and p.perfil in ('atendimento', 'gestor', 'admin'));
$fn$;

create or replace function public.chat_eu_estou_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo = true);
$fn$;

-- Destinatário ativo e, se quem envia é cliente, destinatário da equipe.
create or replace function public.chat_destinatario_permitido(p_dest uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select p_dest is not null
     and p_dest <> auth.uid()
     and exists (
       select 1 from public.profiles d
        where d.id = p_dest and d.ativo = true
          and (public.chat_eu_sou_equipe() or d.perfil in ('atendimento', 'gestor', 'admin'))
     );
$fn$;

revoke all on function public.chat_eu_sou_equipe() from public, anon;
revoke all on function public.chat_eu_estou_ativo() from public, anon;
revoke all on function public.chat_destinatario_permitido(uuid) from public, anon;
grant execute on function public.chat_eu_sou_equipe() to authenticated;
grant execute on function public.chat_eu_estou_ativo() to authenticated;
grant execute on function public.chat_destinatario_permitido(uuid) to authenticated;

-- Mesma regra de antes: sala geral só equipe; conversa privada com
-- pessoa ativa; cliente só fala com a equipe.
drop policy if exists chat_equipe_insercao on public.chat_equipe;
create policy chat_equipe_insercao on public.chat_equipe
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and public.chat_eu_estou_ativo()
    and (
      (destinatario_id is null and public.chat_eu_sou_equipe())
      or (destinatario_id is not null and public.chat_destinatario_permitido(destinatario_id))
    )
  );


-- ---------- 2. Mensagem do cliente: só "Aguardando cliente" retoma -------
create or replace function public.reabrir_chamado_por_mensagem_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if exists (select 1 from public.profiles p where p.id = new.autor_id and p.perfil = 'cliente') then
    -- "Aguardando cliente": o cliente respondeu, o relógio volta a contar.
    -- "Resolvido" NÃO reabre mais por mensagem: o cliente usa os botões.
    update public.chamados
       set status = 'em_atendimento'
     where id = new.chamado_id
       and status = 'aguardando_cliente';
  end if;
  return null;
end;
$fn$;


-- ---------- 3. Cliente confirma ou reabre o chamado Resolvido ----------
create or replace function public.cliente_confirmar_resolucao(p_chamado uuid, p_resolvido boolean,
                                                             p_motivo text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu     record;
  c      record;
  v_mot  text := btrim(coalesce(p_motivo, ''));
begin
  select id, perfil, empresa_id, ativo into eu from public.profiles where id = auth.uid();
  if not found or eu.ativo is not true or eu.perfil <> 'cliente' then
    raise exception 'Somente o cliente confirma a resolução por aqui.';
  end if;

  select id, status, empresa_id, criado_por, solicitante_id, visibilidade
    into c from public.chamados where id = p_chamado for update;
  if not found then raise exception 'Chamado não encontrado.'; end if;

  -- Mesma regra de quem vê o chamado no portal do cliente.
  if c.empresa_id is distinct from eu.empresa_id
     or not (c.visibilidade = 'empresa'
             or c.criado_por = eu.id
             or c.solicitante_id = eu.id
             or exists (select 1 from public.chamado_participantes cp
                         where cp.chamado_id = c.id and cp.usuario_id = eu.id)) then
    raise exception 'Você não tem acesso a este chamado.';
  end if;

  if c.status <> 'resolvido' then
    raise exception 'Este chamado não está aguardando a sua confirmação (situação atual: %).', c.status;
  end if;

  if p_resolvido then
    update public.chamados set status = 'encerrado', encerrado_em = now() where id = c.id;
    begin
      insert into public.chamado_eventos (chamado_id, tipo, de, para, autor_id, observacao)
      values (c.id, 'status', 'resolvido', 'encerrado', eu.id, 'Cliente confirmou a resolução');
    exception when others then null;
    end;
    return 'encerrado';
  end if;

  if char_length(v_mot) < 5 then
    raise exception 'Conte o que ainda falta para reabrir (mínimo de 5 caracteres).';
  end if;

  insert into public.chamado_mensagens (chamado_id, autor_id, mensagem)
  values (c.id, eu.id, 'Reabri o chamado. O que ainda falta: ' || v_mot);

  update public.chamados set status = 'em_atendimento' where id = c.id;
  return 'em_atendimento';
end;
$fn$;

revoke all on function public.cliente_confirmar_resolucao(uuid, boolean, text) from public, anon;
grant execute on function public.cliente_confirmar_resolucao(uuid, boolean, text) to authenticated;


-- ---------- 4. Texto automático de "Resolvido" -------------------------
-- Só troca se ainda for o texto original de fábrica.
update public.chamado_mensagens_modelo
   set texto = E'Olá! 😊 Seu chamado #{numero} foi atualizado para Resolvido.\n\nConfira a solução e, no chamado, clique em "Sim, pode encerrar" ou, se algo ainda não estiver certo, em "Não, reabrir" e conte o que falta. Sem manifestação nas próximas 24 horas úteis, ele será encerrado e arquivado automaticamente.\n\nAgradecemos pela confiança e esperamos ter contribuído da melhor forma possível. Foi um prazer atendê-lo(a)! Sempre que precisar, estaremos à disposição.'
 where gatilho = 'resolvido'
   and texto = E'Olá! 😊 Seu chamado #{numero} foi atualizado para Resolvido.\n\nCaso não haja nenhuma manifestação nas próximas 24 horas úteis, ele será encerrado e arquivado automaticamente. Se algo ainda não estiver certo, basta responder por aqui que o chamado volta para atendimento.\n\nAgradecemos pela confiança e esperamos ter contribuído da melhor forma possível. Foi um prazer atendê-lo(a)! Sempre que precisar, estaremos à disposição.';


-- ---------- Conferência -------------------------------------------------
select policyname, with_check from pg_policies where tablename = 'chat_equipe' and cmd = 'INSERT';
select gatilho, left(texto, 120) as texto from public.chamado_mensagens_modelo where gatilho = 'resolvido';
