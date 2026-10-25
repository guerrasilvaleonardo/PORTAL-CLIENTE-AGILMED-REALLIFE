-- =====================================================================
-- CPF do colaborador nos certificados.
--
-- ANTES:  o portal reconhecia a pessoa só pelo nome. "Pedro Luis" e
--         "Pedro Luis Fregadolli" (mesma pessoa) viravam dois
--         colaboradores, com históricos separados e vencimentos
--         repetidos.
-- DEPOIS: coluna cpf (só os 11 dígitos) em certificados, mais cpf_fonte
--         (de onde veio: "pdf" = lido no certificado assinado, "nome" =
--         deduzido pelo nome na mesma empresa, "manual" = digitado). O
--         portal junta os certificados pelo CPF (empresa + CPF); sem CPF,
--         continua pelo nome. O campo aparece no cadastro do certificado.
-- MOTIVO: vincular todos os certificados da mesma pessoa, mesmo com o
--         nome escrito de formas diferentes.
--
-- Não altera nem apaga nomes, datas ou links. Pode rodar mais de uma vez.
-- O preenchimento dos CPFs existentes vem em arquivos separados
-- (vinculo-cpf-certificados-parte-NN.sql), gerados a partir dos PDFs.
-- =====================================================================

alter table public.certificados add column if not exists cpf text;
alter table public.certificados add column if not exists cpf_fonte text;

-- Só dígitos, 11 posições (ou vazio).
alter table public.certificados drop constraint if exists certificados_cpf_formato;
alter table public.certificados
  add constraint certificados_cpf_formato check (cpf is null or cpf ~ '^[0-9]{11}$');

create index if not exists certificados_empresa_cpf on public.certificados (empresa_id, cpf) where cpf is not null;

-- Quem digita o CPF no portal: limpa pontuação e marca a fonte.
create or replace function public.certificados_cpf_ajuste()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.cpf is not null then
    new.cpf := nullif(regexp_replace(new.cpf, '\D', '', 'g'), '');
    if new.cpf is not null and length(new.cpf) = 10 then
      new.cpf := '0' || new.cpf;
    end if;
  end if;

  if tg_op = 'INSERT' or new.cpf is distinct from old.cpf then
    if new.cpf is null then
      new.cpf_fonte := null;
    elsif new.cpf_fonte is null or (tg_op = 'UPDATE' and new.cpf_fonte is not distinct from old.cpf_fonte) then
      new.cpf_fonte := 'manual';
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists certificados_cpf_ajuste on public.certificados;
create trigger certificados_cpf_ajuste
  before insert or update of cpf on public.certificados
  for each row execute function public.certificados_cpf_ajuste();


-- ---------- Conferência -------------------------------------------------
select count(*) as certificados,
       count(cpf) as com_cpf,
       count(*) filter (where cpf_fonte = 'pdf') as cpf_do_pdf,
       count(*) filter (where cpf_fonte = 'nome') as cpf_deduzido_pelo_nome
  from public.certificados;
