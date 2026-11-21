-- ===========================================================
--  O item reprovado do checklist também tem assunto e potencial
--  (depois de supabase/nc-titulo-do-checklist.sql)
-- ===========================================================
--
-- O QUE FALTAVA. O vocabulário novo — assunto do desvio e "podia ter
-- matado alguém" — só era perguntado no apontamento livre. Quem
-- reprovava um item de checklist não tinha onde dizer nem uma coisa
-- nem outra, e a não conformidade nascia muda: sem assunto, mesmo num
-- checklist de trabalho em altura, e sem potencial, mesmo quando a
-- cena era de cair de 6 metros.
--
-- A coluna `tipologia` já existia em inspecao_respostas e já descia
-- para a NC pelo gatilho; o que faltava era a tela perguntar. O
-- potencial não existia nem na coluna — é o que entra aqui.
--
-- POR QUE NO ITEM E NÃO SÓ NA NC. Quem sabe se aquilo podia matar
-- alguém é quem estava na frente da cena, no momento em que reprovou.
-- Perguntar depois, na mesa, é perguntar para quem não viu.

alter table public.inspecao_respostas
  add column if not exists potencial_fatal boolean not null default false;


-- ---------- O gatilho leva as duas para a NC ----------------------
-- Mesma função de sempre, com uma linha a mais no insert.

create or replace function public.inspecoes_ajustes()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_total integer;
  v_conf  integer;
  v_nc    integer;
  v_na    integer;
  v_par   integer;
  v_prazo date;
  v_nome  text;
  r       record;
begin
  if tg_op = 'INSERT' then
    new.inspetor_id := coalesce(new.inspetor_id, auth.uid());
    new.created_at  := now();
  else
    new.empresa_id := old.empresa_id;
    new.created_at := old.created_at;
    new.tipo       := old.tipo;
  end if;

  new.observacoes := nullif(btrim(coalesce(new.observacoes, '')), '');

  if tg_op = 'UPDATE'
     and old.situacao = 'concluida'
     and new.situacao = 'em_andamento' then

    if nullif(btrim(coalesce(new.motivo_reabertura, '')), '') is null then
      raise exception 'Para reabrir a inspeção, diga o motivo.';
    end if;

    select coalesce(p.nome, p.email) into v_nome
      from public.profiles p where p.id = auth.uid();

    insert into public.inspecoes_alteracoes (inspecao_id, de, para, motivo, por, por_nome)
    values (new.id, old.situacao, new.situacao, btrim(new.motivo_reabertura), auth.uid(), v_nome);

    new.concluida_em := null;
  end if;

  new.motivo_reabertura := null;

  if new.situacao = 'concluida' and coalesce(old.situacao, '') <> 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());

    select count(*),
           count(*) filter (where resposta = 'conforme'),
           count(*) filter (where resposta = 'nao_conforme'),
           count(*) filter (where resposta = 'nao_aplicavel'),
           count(*) filter (where resposta = 'atende_parcial')
      into v_total, v_conf, v_nc, v_na, v_par
      from public.inspecao_respostas
     where inspecao_id = new.id;

    new.itens_total    := coalesce(v_total, 0);
    new.conformes      := coalesce(v_conf, 0);
    new.nao_conformes  := coalesce(v_nc, 0);
    new.nao_aplicaveis := coalesce(v_na, 0);
    new.parciais       := coalesce(v_par, 0);

    -- Parcial vale meio ponto: parte do requisito está lá.
    if coalesce(v_conf, 0) + coalesce(v_nc, 0) + coalesce(v_par, 0) > 0 then
      new.percentual := round(
        100.0 * (v_conf + 0.5 * v_par) / (v_conf + v_nc + v_par), 2);
    else
      new.percentual := null;
    end if;

    v_prazo := (new.concluida_em at time zone 'America/Porto_Velho')::date + 30;

    update public.nao_conformidades n
       set situacao = 'cancelada',
           descricao = n.descricao || ' — cancelada: o item deixou de ser não conforme na revisão da inspeção.'
     where n.inspecao_id = new.id
       and n.situacao not in ('encerrada', 'cancelada')
       and exists (
         select 1 from public.inspecao_respostas resp
          where resp.id = n.resposta_id
            and coalesce(resp.resposta, '') not in ('nao_conforme', 'atende_parcial')
       );

    -- Parcial também abre NC: a parte que falta precisa de dono e prazo,
    -- senão fica eternamente "quase".
    for r in
      select id, pergunta, observacao, foto_path, fotos, resposta, tipologia, potencial_fatal
        from public.inspecao_respostas
       where inspecao_id = new.id
         and resposta in ('nao_conforme', 'atende_parcial')
       order by ordem
    loop
      if not exists (
        select 1 from public.nao_conformidades
         where resposta_id = r.id and situacao <> 'cancelada'
      ) then
        insert into public.nao_conformidades (
          empresa_id, inspecao_id, resposta_id, local_id, local_nome,
          titulo, descricao, foto_path, prazo, aberta_por, classificacao,
          tipologia, potencial_fatal
        ) values (
          new.empresa_id, new.id, r.id, new.local_id, new.local_nome,
          -- O TÍTULO é a pergunta, limpa: é ela que se repete entre
          -- visitas e é por ela que o portal reconhece o mesmo
          -- problema. A descrição, logo abaixo, continua trazendo a
          -- pergunta mais a observação de quem reprovou.
          btrim(r.pergunta),
          r.pergunta
            || case when r.resposta = 'atende_parcial' then ' — atende parcialmente' else '' end
            || case when nullif(btrim(coalesce(r.observacao, '')), '') is null
                    then '' else ' — ' || btrim(r.observacao) end,
          coalesce(r.foto_path, r.fotos[1]), v_prazo, auth.uid(),
          case when new.tipo = 'auditoria'
               then case when r.resposta = 'atende_parcial' then 'menor' else 'maior' end
          end,
          r.tipologia,
          coalesce(r.potencial_fatal, false)
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


-- ---------- Conferência -------------------------------------------
-- As duas têm de vir verdadeiras.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'inspecao_respostas'
      and column_name = 'potencial_fatal') = 1                        as coluna_no_item,
  (select position('r.potencial_fatal' in p.prosrc) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'inspecoes_ajustes')   as gatilho_leva_potencial;
