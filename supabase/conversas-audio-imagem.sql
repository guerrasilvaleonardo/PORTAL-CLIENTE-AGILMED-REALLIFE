-- =====================================================================
-- Conversas: áudio (gravado no navegador) e imagem.
--
-- ANTES:  o chat só aceitava texto.
-- DEPOIS: a mensagem pode levar um anexo: áudio de até 2 minutos ou
--         imagem (JPG, PNG, WEBP) de até 10 MB. O arquivo fica no
--         armazenamento PRIVADO "chat-anexos": só quem enviou e quem
--         recebeu (ou a equipe, na sala "Equipe toda") conseguem abrir.
--         Cada pessoa só grava arquivos na própria pasta.
-- MOTIVO: recado rápido por voz e foto de documento/tela, como no
--         WhatsApp, sem sair do portal.
--
-- Não apaga nem altera mensagens existentes. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.chat_equipe
  add column if not exists anexo_path    text,
  add column if not exists anexo_tipo    text,
  add column if not exists anexo_duracao integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_equipe_anexo_tipo_check') then
    alter table public.chat_equipe
      add constraint chat_equipe_anexo_tipo_check
      check (anexo_tipo is null or anexo_tipo in ('audio', 'imagem'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_equipe_anexo_duracao_check') then
    alter table public.chat_equipe
      add constraint chat_equipe_anexo_duracao_check
      check (anexo_duracao is null or anexo_duracao between 0 and 130);
  end if;
end $$;

-- Envio: mesma regra de antes (supabase/chat-cliente-e-confirmacao-resolucao.sql)
-- + o anexo precisa estar na pasta de quem envia.
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
    and (anexo_path is null or split_part(anexo_path, '/', 1) = auth.uid()::text)
  );


-- ---------- Armazenamento privado dos anexos ----------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-anexos', 'chat-anexos', false, 10485760,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav',
              'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
   set public = false,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- Pode abrir o anexo de uma mensagem que eu posso ler?
create or replace function public.chat_pode_ver_anexo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select split_part(p_path, '/', 1) = auth.uid()::text
      or exists (
        select 1 from public.chat_equipe c
         where c.anexo_path = p_path
           and (c.destinatario_id = auth.uid()
                or c.autor_id = auth.uid()
                or (c.destinatario_id is null and public.chat_eu_sou_equipe()))
      );
$fn$;

revoke all on function public.chat_pode_ver_anexo(text) from public, anon;
grant execute on function public.chat_pode_ver_anexo(text) to authenticated;

drop policy if exists chat_anexos_envio on storage.objects;
create policy chat_anexos_envio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.chat_eu_estou_ativo()
  );

drop policy if exists chat_anexos_leitura on storage.objects;
create policy chat_anexos_leitura on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-anexos' and public.chat_pode_ver_anexo(name));


-- ---------- Conferência -------------------------------------------------
select id, public, file_size_limit from storage.buckets where id = 'chat-anexos';
