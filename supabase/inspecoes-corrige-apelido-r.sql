-- =====================================================================
-- Corrige "record r is not assigned yet" ao concluir inspeção/auditoria.
--
-- ANTES:  a função inspecoes_ajustes() declarava `r record` para o laço
--         que abre as não conformidades, e ANTES desse laço usava `r`
--         de novo, mas como APELIDO DE TABELA numa subconsulta:
--
--           and exists (
--             select 1 from public.inspecao_respostas r
--              where r.id = n.resposta_id ...
--           )
--
--         O PL/pgSQL resolve nomes antes do SQL: ele vê a variável
--         declarada, não o apelido, e tenta ler um record que ainda não
--         recebeu valor nenhum. Resultado: erro ao salvar.
-- DEPOIS: o apelido passa a ser `resp`. A variável do laço continua `r`.
-- MOTIVO: ele bateu no erro em 20/11/2026 ao salvar uma auditoria.
--
-- POR QUE SÓ APARECEU AGORA. O trecho só roda quando a inspeção é
-- concluída (ou reconcluída depois de reaberta) — é a limpeza das NCs
-- cujo item deixou de ser não conforme. Quem só preenchia respostas
-- nunca passava por ali.
--
-- POR QUE A FUNÇÃO VEM INTEIRA. Convenção do projeto: função de gatilho
-- é recriada por completo em cada migração, e a última vale. Esta é a
-- versão de supabase/inspecoes-modo-auditoria.sql com o apelido trocado
-- e mais nada.
--
-- Depende de supabase/inspecoes-modo-auditoria.sql.
-- Não apaga nada. Pode rodar mais de uma vez.
-- =====================================================================

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

    -- AQUI ESTAVA O ERRO: o apelido era `r`, igual à variável do laço.
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
      select id, pergunta, observacao, foto_path, fotos, resposta
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
          descricao, foto_path, prazo, aberta_por, classificacao
        ) values (
          new.empresa_id, new.id, r.id, new.local_id, new.local_nome,
          r.pergunta
            || case when r.resposta = 'atende_parcial' then ' — atende parcialmente' else '' end
            || case when nullif(btrim(coalesce(r.observacao, '')), '') is null
                    then '' else ' — ' || btrim(r.observacao) end,
          coalesce(r.foto_path, r.fotos[1]), v_prazo, auth.uid(),
          case when new.tipo = 'auditoria'
               then case when r.resposta = 'atende_parcial' then 'menor' else 'maior' end
          end
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


-- ---------- Conferência -------------------------------------------------
-- Tem de dar 0: nenhum `r.` sobrando antes do laço.
select (select count(*) from regexp_matches(p.prosrc, 'inspecao_respostas r\s', 'g')) as apelido_r_sobrando,
       position('inspecao_respostas resp' in p.prosrc) > 0                           as apelido_corrigido
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'inspecoes_ajustes';
