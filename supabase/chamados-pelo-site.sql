-- =====================================================================
-- Chamados abertos pelo site (botão de WhatsApp do reallifessma.com.br).
--
-- ANTES:  o botão de WhatsApp do site abria a conversa direto. O pedido
--         não entrava no portal: sem número, sem prazo, sem histórico.
-- DEPOIS: o botão abre um formulário curto. Ao enviar, o portal cria o
--         chamado e devolve o número do protocolo; a pessoa pode seguir
--         no WhatsApp já citando o número.
--         - Se o e-mail informado é de um usuário CLIENTE ativo, o
--           chamado entra na empresa dele e fica no nome dele (ele
--           acompanha pelo portal).
--         - Se não, entra na empresa "Contatos do site" (criada aqui,
--           marca Real Life), para a equipe tratar como pedido novo/lead.
--         - Os dados de contato (nome, empresa, e-mail, telefone, página
--           de origem) ficam em site_contatos, visível só para a equipe.
--           O IP NÃO é guardado: só um resumo irreversível (hash), usado
--           para barrar envio em massa.
-- MOTIVO: todo pedido que chega pelo site vira chamado com prazo e
--         rastreabilidade (pedido do Leonardo em 29/10/2026).
--
-- Também: chamados.criado_por passa a aceitar vazio (chamado aberto por
-- quem não tem usuário no portal). Nada é apagado.
-- Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Empresa que recebe os pedidos de quem ainda não é cliente.
alter table public.empresas
  add column if not exists contato_site boolean not null default false;

insert into public.empresas (razao_social, nome_fantasia, marca, contato_site)
select 'Contatos do site (Real Life)', 'Contatos do site', 'reallife', true
 where not exists (select 1 from public.empresas where contato_site = true and marca = 'reallife');

-- 2) Chamado sem usuário no portal (visitante do site).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'chamados'
       and column_name = 'criado_por' and is_nullable = 'NO'
  ) then
    alter table public.chamados alter column criado_por drop not null;
  end if;
end
$$;

-- 3) Dados de contato de quem abriu pelo site.
create table if not exists public.site_contatos (
  id           bigserial primary key,
  chamado_id   uuid references public.chamados (id) on delete set null,
  nome         text not null check (char_length(btrim(nome)) between 2 and 120),
  empresa      text check (empresa is null or char_length(empresa) <= 120),
  email        text not null check (char_length(email) between 5 and 160),
  telefone     text check (telefone is null or char_length(telefone) <= 30),
  assunto      text not null check (char_length(assunto) <= 80),
  pagina       text check (pagina is null or char_length(pagina) <= 300),
  consentiu_em timestamptz not null,
  cliente_reconhecido boolean not null default false,
  ip_hash      text,
  criado_em    timestamptz not null default now()
);

create index if not exists site_contatos_ip on public.site_contatos (ip_hash, criado_em desc);
create index if not exists site_contatos_email on public.site_contatos (lower(email), criado_em desc);
create index if not exists site_contatos_chamado on public.site_contatos (chamado_id);

alter table public.site_contatos enable row level security;

-- Só a equipe interna lê. Ninguém grava pelo navegador: quem grava é o
-- servidor do portal (chave de serviço), depois de validar o envio.
drop policy if exists site_contatos_equipe on public.site_contatos;
create policy site_contatos_equipe on public.site_contatos
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.perfil in ('atendimento', 'gestor', 'admin')
       and coalesce(p.ativo, true)
  ));

grant select on public.site_contatos to authenticated;


-- ---------- Conferência -------------------------------------------------
-- Deve mostrar 1 linha (a empresa "Contatos do site") e criado_por = YES.
select e.nome_fantasia, e.marca,
       (select is_nullable from information_schema.columns
         where table_schema = 'public' and table_name = 'chamados' and column_name = 'criado_por') as criado_por_aceita_vazio
  from public.empresas e
 where e.contato_site = true;
