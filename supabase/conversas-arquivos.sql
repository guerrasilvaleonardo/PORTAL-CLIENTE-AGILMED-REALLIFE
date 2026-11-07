-- =====================================================================
-- Conversas: envio e download de arquivos (além de áudio e imagem).
--
-- ANTES:  o chat aceitava texto, áudio (até 2 min) e imagem (JPG, PNG,
--         WEBP). Não havia como mandar um PDF ou planilha, e a imagem só
--         abria no navegador (sem "Baixar" com o nome original).
-- DEPOIS:
--   * nova categoria de anexo "arquivo": PDF, Word (doc/docx), Excel
--     (xls/xlsx), PowerPoint (ppt/pptx), CSV e TXT, até 10 MB (o mesmo
--     limite dos anexos de chamado);
--   * a mensagem guarda o nome original e o tamanho (anexo_nome e
--     anexo_tamanho), para mostrar no cartão e baixar com o nome certo;
--   * imagem e arquivo ganham o botão "Baixar".
--   As regras de acesso NÃO mudam: o arquivo continua no armazenamento
--   PRIVADO "chat-anexos", na pasta de quem enviou, e só abre para quem
--   participa da conversa (ou a equipe, na sala "Equipe toda").
--   Executáveis e compactados (.exe, .zip, .rar…) continuam bloqueados.
-- MOTIVO: trocar documentos com a equipe e com o cliente sem sair do
--         portal.
--
-- Não apaga nem altera mensagens existentes. Pode rodar mais de uma vez.
-- Depende de supabase/conversas-audio-imagem.sql.
-- =====================================================================

-- ---------- 1. Nome e tamanho do anexo ---------------------------------
alter table public.chat_equipe
  add column if not exists anexo_nome    text,
  add column if not exists anexo_tamanho bigint;

-- ---------- 2. Nova categoria "arquivo" ----------------------------------
alter table public.chat_equipe
  drop constraint if exists chat_equipe_anexo_tipo_check;

alter table public.chat_equipe
  add constraint chat_equipe_anexo_tipo_check
  check (anexo_tipo is null or anexo_tipo in ('audio', 'imagem', 'arquivo'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_equipe_anexo_nome_check') then
    alter table public.chat_equipe
      add constraint chat_equipe_anexo_nome_check
      check (anexo_nome is null or char_length(anexo_nome) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_equipe_anexo_tamanho_check') then
    alter table public.chat_equipe
      add constraint chat_equipe_anexo_tamanho_check
      check (anexo_tamanho is null or anexo_tamanho between 0 and 10485760);
  end if;
end $$;

-- ---------- 3. Tipos aceitos no armazenamento ----------------------------
-- Mantém áudio e imagem e acrescenta os documentos. Limite: 10 MB.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array[
         'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav',
         'image/jpeg', 'image/png', 'image/webp',
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'text/csv',
         'text/plain'
       ]
 where id = 'chat-anexos';


-- ---------- Conferência -------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'chat_equipe'
      and column_name in ('anexo_nome', 'anexo_tamanho'))                       as colunas,      -- esperado: 2
  (select 'application/pdf' = any(allowed_mime_types)
     from storage.buckets where id = 'chat-anexos')                               as aceita_pdf,   -- esperado: true
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'chat_equipe_anexo_tipo_check')                               as regra_tipo;   -- deve citar 'arquivo'
