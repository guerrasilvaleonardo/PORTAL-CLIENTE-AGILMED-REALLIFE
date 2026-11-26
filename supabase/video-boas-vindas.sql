-- =====================================================================
-- Vídeo de boas-vindas do Portal do Cliente (Lif explicando o portal).
--
-- ANTES:  não havia registro de quem já tinha visto o vídeo.
-- DEPOIS: o perfil ganha a data em que a pessoa terminou o vídeo
--         (video_boas_vindas_em). Enquanto estiver vazia, o vídeo abre
--         sozinho na tela Início e só fecha quando chega ao fim. Depois,
--         não abre mais sozinho; o botão "Vídeo: como usar o portal"
--         continua na tela Início para rever, com opção de fechar.
--         Quem grava a data é a função marcar_video_boas_vindas(), e só
--         na linha da própria pessoa.
-- MOTIVO: garantir que todo cliente veja como usar o portal no primeiro
--         acesso, sem obrigar quem já viu a assistir de novo.
--
-- Não apaga nada. Pode rodar mais de uma vez.
-- Ordem: pode rodar antes ou depois do código. Sem este SQL, o portal
-- guarda a marcação só no navegador da pessoa.
-- =====================================================================

alter table public.profiles
  add column if not exists video_boas_vindas_em timestamptz;

comment on column public.profiles.video_boas_vindas_em is
  'Quando a pessoa assistiu até o fim o vídeo de boas-vindas do portal. Vazio = ainda não assistiu.';

create or replace function public.marcar_video_boas_vindas()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_quando timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  update public.profiles
     set video_boas_vindas_em = coalesce(video_boas_vindas_em, now())
   where id = auth.uid()
  returning video_boas_vindas_em into v_quando;

  return v_quando;
end;
$fn$;

revoke all on function public.marcar_video_boas_vindas() from public;
grant execute on function public.marcar_video_boas_vindas() to authenticated;

-- Conferência: quantos clientes já assistiram e quantos ainda não.
select
  count(*) filter (where video_boas_vindas_em is not null) as ja_assistiram,
  count(*) filter (where video_boas_vindas_em is null)     as ainda_nao
from public.profiles
where perfil = 'cliente';
