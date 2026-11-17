-- =====================================================================
-- Renomear anexo de chamado.
--
-- ANTES:  chamado_anexos tinha políticas de SELECT, INSERT e DELETE, mas
--         nenhuma de UPDATE. Anexo entrava com o nome que o arquivo
--         tinha no computador de quem enviou — "IMG_20261117_0003.jpg",
--         "digitalizar0001.pdf" — e não dava para arrumar depois.
-- DEPOIS: quem enviou o anexo, e a equipe interna, podem corrigir o
--         nome. Só o nome: o arquivo em si, o caminho no balde, o tipo,
--         o tamanho e o autor continuam intocáveis.
-- MOTIVO: o nome é o que a outra ponta lê na lista do chamado. Nome que
--         não diz nada obriga a abrir um por um para achar o documento
--         certo.
--
-- POR QUE NÃO TROCAR O ARQUIVO. Trocar o conteúdo mantendo a mesma linha
-- apagaria o que a outra parte já viu, sem deixar rastro. Arquivo errado
-- se exclui e se envia de novo — aí a lista mostra a data nova.
--
-- Não altera nem apaga nada do que já existe. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 0. Pré-requisitos -----------------------------------------
do $$
begin
  if to_regclass('public.chamado_anexos') is null then
    raise exception 'A tabela chamado_anexos não existe neste banco.';
  end if;
end
$$;


-- ---------- 1. Só o nome muda -------------------------------------------
create or replace function public.chamado_anexos_so_nome()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.id              := old.id;
  new.chamado_id      := old.chamado_id;
  new.enviado_por     := old.enviado_por;
  new.caminho_arquivo := old.caminho_arquivo;
  new.tipo_arquivo    := old.tipo_arquivo;
  new.tamanho_bytes   := old.tamanho_bytes;
  new.created_at      := old.created_at;

  new.nome_arquivo := btrim(coalesce(new.nome_arquivo, ''));
  if new.nome_arquivo = '' then
    raise exception 'O anexo precisa de um nome.';
  end if;
  if length(new.nome_arquivo) > 200 then
    raise exception 'O nome do anexo está muito longo.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists chamado_anexos_so_nome on public.chamado_anexos;
create trigger chamado_anexos_so_nome
  before update on public.chamado_anexos
  for each row execute function public.chamado_anexos_so_nome();


-- ---------- 2. Quem pode renomear ---------------------------------------
-- Quem enviou corrige o próprio anexo; a equipe interna corrige qualquer
-- um, porque é ela que organiza o chamado para a fiscalização e para o
-- cliente.
drop policy if exists chamado_anexos_renomear on public.chamado_anexos;
create policy chamado_anexos_renomear
  on public.chamado_anexos for update to authenticated
  using (
    enviado_por = auth.uid()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.perfil in ('atendimento', 'gestor', 'admin')
    )
  )
  with check (
    enviado_por = auth.uid()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.perfil in ('atendimento', 'gestor', 'admin')
    )
  );

grant update (nome_arquivo) on public.chamado_anexos to authenticated;


-- ---------- Conferência -------------------------------------------------
select (select count(*) from public.chamado_anexos)                            as anexos,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'chamado_anexos')          as politicas,
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'chamado_anexos'
           and cmd = 'UPDATE')                                                  as politicas_update,
       (select count(*) from pg_trigger
         where tgrelid = 'public.chamado_anexos'::regclass
           and tgname = 'chamado_anexos_so_nome')                               as gatilho;
