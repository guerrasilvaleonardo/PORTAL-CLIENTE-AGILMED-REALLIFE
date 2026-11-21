-- ---------------------------------------------------------------
-- As fotos do item reprovado chegam inteiras na não conformidade.
--
-- O QUE JÁ FUNCIONAVA. Ao concluir o checklist, o gatilho das
-- inspeções abre uma não conformidade para cada item reprovado e
-- copia `coalesce(r.foto_path, r.fotos[1])` — a PRIMEIRA foto.
--
-- O QUE SE PERDIA. Quem fotografa um desvio raramente tira uma foto
-- só: tira a geral, a de perto e a da placa. As outras ficavam na
-- resposta do checklist, invisíveis na ficha da não conformidade e
-- ausentes da RNC impressa, que é justamente o documento que vai para
-- o cliente e para o auditor.
--
-- POR QUE UM GATILHO NOVO, e não mexer no antigo. O gatilho das
-- inspeções é grande e calcula percentual, cancelamento de NC e
-- abertura por item; reescrevê-lo inteiro para acrescentar uma coluna
-- é arriscar o que já funciona por uma linha. Este aqui faz uma coisa
-- só, e faz depois: antes de gravar a NC, se ela veio de uma resposta
-- de checklist e está sem fotos, pega as da resposta.
--
-- Vale também para quem criar NC por outro caminho no futuro: a regra
-- está no banco, não na tela.
-- ---------------------------------------------------------------

create or replace function public.nc_fotos_da_resposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fotos text[];
begin
  if new.resposta_id is null then
    return new;
  end if;

  -- Já veio com foto (apontamento de campo, por exemplo): não mexe.
  if new.fotos is not null and array_length(new.fotos, 1) is not null then
    return new;
  end if;

  select r.fotos into v_fotos
    from public.inspecao_respostas r
   where r.id = new.resposta_id;

  if v_fotos is not null and array_length(v_fotos, 1) is not null then
    new.fotos := v_fotos;
    if new.foto_path is null then
      new.foto_path := v_fotos[1];
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists nc_fotos_da_resposta on public.nao_conformidades;
create trigger nc_fotos_da_resposta
  before insert on public.nao_conformidades
  for each row execute function public.nc_fotos_da_resposta();

-- As que já nasceram com uma foto só, tendo a resposta mais de uma.
-- Não inventa nada: só completa a lista a partir da própria resposta.
update public.nao_conformidades n
   set fotos = r.fotos
  from public.inspecao_respostas r
 where r.id = n.resposta_id
   and r.fotos is not null
   and array_length(r.fotos, 1) is not null
   and (n.fotos is null or array_length(n.fotos, 1) is null);

-- ---------- Conferência -------------------------------------------
select (select count(*) from pg_trigger where tgname = 'nc_fotos_da_resposta') as gatilho,
       (select count(*) from public.nao_conformidades
         where fotos is not null and array_length(fotos, 1) > 1)               as nc_com_varias_fotos;
