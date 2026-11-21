-- ===========================================================
--  A não conformidade que nasce do checklist ganha título
--  (depois de supabase/nc-tipologia-e-causa.sql)
-- ===========================================================
--
-- O QUE ESTAVA ERRADO. O gatilho preenchia a descrição juntando a
-- pergunta do checklist com a observação de quem reprovou, e deixava
-- o título vazio. Só o apontamento de campo escrevia título.
--
-- O título não é enfeite: é a chave pela qual o portal reconhece o
-- MESMO problema entre visitas. Sem ele:
--
--   · o cartão de potencial fatal do painel aparecia escrito
--     "Sem título" — justamente o bloco que avisa sobre o que pode
--     matar alguém;
--   · "já aconteceu antes", na ficha da NC, nunca casava nada;
--   · a reincidência por título ficava cega para tudo o que vem de
--     checklist, que é a maior parte.
--
-- A pergunta do checklist é o título natural: ela já é curta, já é
-- constante entre visitas e já descreve o problema. A descrição segue
-- trazendo pergunta + observação, como antes.

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
      select id, pergunta, observacao, foto_path, fotos, resposta, tipologia
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
          titulo, descricao, foto_path, prazo, aberta_por, classificacao, tipologia
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
          r.tipologia
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


-- ---------- As que já nasceram sem título -------------------------
-- Só as de checklist (têm resposta_id) e só as que estão em branco:
-- título escrito à mão em campo não se mexe.
update public.nao_conformidades n
   set titulo = btrim(r.pergunta)
  from public.inspecao_respostas r
 where r.id = n.resposta_id
   and nullif(btrim(coalesce(n.titulo, '')), '') is null;


-- ---------- Conferência -------------------------------------------
-- A primeira tem de vir verdadeira e a segunda, zero.
select
  (select position('btrim(r.pergunta)' in p.prosrc) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'inspecoes_ajustes')  as gatilho_escreve_titulo,
  (select count(*) from public.nao_conformidades n
     where n.resposta_id is not null
       and nullif(btrim(coalesce(n.titulo, '')), '') is null)        as sem_titulo_sobrando;
