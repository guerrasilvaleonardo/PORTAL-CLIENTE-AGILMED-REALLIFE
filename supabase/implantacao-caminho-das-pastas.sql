-- Corrige o caminho que a trilha indica para a tela de pastas.
-- Ela saiu do menu de Auditorias e passou a morar em Implantação.
update public.implantacao_atividades a
   set passos = array['Abra "Antes de começar", aqui mesmo em Implantar o sistema;',
                     'Baixe o arquivo que cria as pastas e execute-o na pasta onde o SGQ vai morar;',
                     'Confira que as pastas apareceram com os nomes certos;',
                     'Combine com a equipe que esta é a única cópia válida — e que ninguém guarda documento do SGQ no desktop;',
                     'Tire um print da estrutura criada e suba aqui.']
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
 where a.etapa_id = e.id and e.ordem = 1 and a.ordem = 3
   and m.nome = 'Implantação — ISO 9001:2026';

update public.implantacao_atividades a
   set passos = array['Abra "Antes de começar", aqui mesmo em Implantar o sistema;',
                     'Baixe o arquivo que cria as pastas e execute-o na pasta onde o SGSSO vai morar;',
                     'Confira que as pastas apareceram com os nomes certos;',
                     'Crie uma pasta separada, de acesso restrito, para documento médico individual;',
                     'Combine com a equipe que esta é a única cópia válida — e que ninguém guarda documento do SGSSO no desktop;',
                     'Tire um print da estrutura criada e suba aqui.']
  from public.implantacao_etapas e
  join public.implantacao_modelos m on m.id = e.modelo_id
 where a.etapa_id = e.id and e.ordem = 1 and a.ordem = 3
   and m.nome = 'Implantação — ISO 45001:2024';

select m.nome, a.passos[1] as primeiro_passo
  from public.implantacao_atividades a
  join public.implantacao_etapas e on e.id = a.etapa_id
  join public.implantacao_modelos m on m.id = e.modelo_id
 where e.ordem = 1 and a.ordem = 3
 order by m.nome;
