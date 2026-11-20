-- =====================================================================
-- Os primeiros modelos de checklist da Real Life.
--
-- ANTES:  o módulo de Inspeções nasceu sem modelo nenhum. Quem abrisse
--         a tela teria de escrever as perguntas do zero antes de poder
--         inspecionar qualquer coisa.
-- DEPOIS: seis modelos da casa (empresa vazia), que servem para
--         qualquer cliente e a equipe ajusta quando quiser.
-- MOTIVO: a carteira é de PGR em 142 empresas e PCMSO em 140 — empresa
--         pequena e média, não só obra. Os três primeiros modelos
--         servem a quase todas elas; os três últimos, às obras e
--         locadoras.
--
-- AS PERGUNTAS SÃO NOSSAS, A NORMA É REFERÊNCIA. O campo "norma" diz
-- qual NR a pergunta verifica; o texto é escrito na linguagem de quem
-- vai responder em campo. Nada aqui transcreve norma, que é conteúdo
-- vendido pela ABNT.
--
-- COMO FORAM ESCRITAS. Toda pergunta é respondível com sim ou não
-- olhando para a coisa. "O extintor está desobstruído?" dá para
-- responder; "a gestão de emergências é adequada?" não dá, e vira
-- discussão em vez de achado.
--
-- Depende de supabase/inspecoes.sql.
-- Não apaga nada e não duplica: modelo que já existe é pulado inteiro.
-- Pode rodar mais de uma vez.
-- =====================================================================

do $$
declare
  v_modelo uuid;
begin
  if to_regclass('public.inspecao_modelos') is null then
    raise exception 'Rode antes supabase/inspecoes.sql.';
  end if;

  -- ================================================================
  -- 1. Verificação do PGR em campo
  -- O inventário de riscos virou controle no chão? É o que transforma
  -- o PGR de documento entregue em serviço que se repete.
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Verificação do PGR em campo';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Verificação do PGR em campo', 'NR-01',
            'Confere no local se as medidas de controle previstas no PGR existem de verdade.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta) values
      (v_modelo,  1, 'Documento',  'O PGR está disponível no local e dentro da validade?'),
      (v_modelo,  2, 'Documento',  'O inventário de riscos cobre as atividades que estão sendo feitas hoje aqui?'),
      (v_modelo,  3, 'Documento',  'O plano de ação do PGR tem responsável e prazo em cada item?'),
      (v_modelo,  4, 'Controles',  'As medidas de proteção coletiva previstas no PGR estão instaladas?'),
      (v_modelo,  5, 'Controles',  'Os EPI entregues são os que o inventário de riscos indica para a função?'),
      (v_modelo,  6, 'Controles',  'Há trabalhador exposto a risco que o PGR não previu?'),
      (v_modelo,  7, 'Pessoas',    'Os trabalhadores sabem dizer quais são os riscos da função deles?'),
      (v_modelo,  8, 'Pessoas',    'Os treinamentos exigidos para as atividades em andamento estão em dia?'),
      (v_modelo,  9, 'Pessoas',    'Quem opera equipamento tem a capacitação registrada?'),
      (v_modelo, 10, 'Emergência', 'O plano de emergência está afixado e as rotas conferem com o local?'),
      (v_modelo, 11, 'Emergência', 'Há brigadista ou responsável por primeiros socorros no turno?'),
      (v_modelo, 12, 'Registro',   'As ocorrências e quase-acidentes do período foram registrados?');
  end if;

  -- ================================================================
  -- 2. Inspeção geral de segurança
  -- A ronda que serve para quase qualquer empresa da carteira.
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Inspeção geral de segurança';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Inspeção geral de segurança', 'NR-01 · NR-06 · NR-08 · NR-24',
            'Ronda de rotina para qualquer empresa: organização, instalações, elétrica e uso de EPI.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta) values
      (v_modelo,  1, 'Organização',  'As áreas de circulação estão livres de material e obstáculos?'),
      (v_modelo,  2, 'Organização',  'O material armazenado está empilhado de forma estável?'),
      (v_modelo,  3, 'Organização',  'O lixo e os resíduos estão em recipientes adequados e sendo retirados?'),
      (v_modelo,  4, 'Piso e acesso','O piso está íntegro, sem buraco, desnível solto ou área escorregadia?'),
      (v_modelo,  5, 'Piso e acesso','As escadas têm corrimão firme e degraus em boas condições?'),
      (v_modelo,  6, 'Sinalização',  'A sinalização de segurança está visível, legível e correta para o local?'),
      (v_modelo,  7, 'Elétrica',     'Os quadros elétricos estão fechados, sinalizados e sem obstrução?'),
      (v_modelo,  8, 'Elétrica',     'Há fiação exposta, emenda improvisada ou tomada quebrada?'),
      (v_modelo,  9, 'Elétrica',     'As extensões e os benjamins estão em uso provisório, e não como instalação fixa?'),
      (v_modelo, 10, 'EPI',          'Os trabalhadores estão usando o EPI exigido para a atividade?'),
      (v_modelo, 11, 'EPI',          'Os EPI em uso estão em bom estado e dentro da validade do CA?'),
      (v_modelo, 12, 'Instalações',  'Os sanitários estão limpos, com água, papel e sabão?'),
      (v_modelo, 13, 'Instalações',  'O local de refeição está limpo e separado da área de trabalho?'),
      (v_modelo, 14, 'Instalações',  'Há água potável disponível e identificada?');
  end if;

  -- ================================================================
  -- 3. Extintores e saídas de emergência
  -- Amarra com o laudo do Corpo de Bombeiros que a casa já emite.
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Extintores e saídas de emergência';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Extintores e saídas de emergência', 'NR-23',
            'O que o Corpo de Bombeiros olha: extintor em condição de uso e saída desobstruída.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta) values
      (v_modelo,  1, 'Extintores', 'Os extintores estão nos pontos previstos no projeto ou no laudo?'),
      (v_modelo,  2, 'Extintores', 'A carga está dentro da validade e o manômetro na faixa verde?'),
      (v_modelo,  3, 'Extintores', 'O lacre está intacto e a mangueira sem rachadura?'),
      (v_modelo,  4, 'Extintores', 'O acesso ao extintor está desobstruído e a sinalização visível?'),
      (v_modelo,  5, 'Extintores', 'O extintor está na altura certa e fora do chão?'),
      (v_modelo,  6, 'Saídas',     'As saídas de emergência estão desobstruídas e destrancadas por dentro?'),
      (v_modelo,  7, 'Saídas',     'As portas corta-fogo fecham sozinhas e não estão escoradas?'),
      (v_modelo,  8, 'Saídas',     'A rota de fuga está sinalizada do posto de trabalho até a saída?'),
      (v_modelo,  9, 'Saídas',     'A iluminação de emergência acende quando testada?'),
      (v_modelo, 10, 'Saídas',     'O ponto de encontro está definido, sinalizado e conhecido pela equipe?'),
      (v_modelo, 11, 'Hidrantes',  'Os hidrantes e mangueiras estão acessíveis e com as peças completas?'),
      (v_modelo, 12, 'Documento',  'O laudo do Corpo de Bombeiros está dentro da validade?');
  end if;

  -- ================================================================
  -- 4. Canteiro de obra (NR-18)
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Canteiro de obra';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Canteiro de obra', 'NR-18',
            'Inspeção de canteiro: proteção de borda, andaime, escavação, instalações e circulação.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta) values
      (v_modelo,  1, 'Proteção coletiva', 'As aberturas no piso estão fechadas ou cercadas?'),
      (v_modelo,  2, 'Proteção coletiva', 'As bordas e periferias têm guarda-corpo com travessa e rodapé?'),
      (v_modelo,  3, 'Proteção coletiva', 'As plataformas de proteção estão instaladas onde a obra exige?'),
      (v_modelo,  4, 'Andaimes',          'Os andaimes estão apoiados em base firme e travados?'),
      (v_modelo,  5, 'Andaimes',          'O piso do andaime está completo, sem tábua solta ou faltando?'),
      (v_modelo,  6, 'Andaimes',          'O acesso ao andaime é seguro, sem subir pela estrutura?'),
      (v_modelo,  7, 'Escavação',         'As escavações estão escoradas ou com talude conforme o projeto?'),
      (v_modelo,  8, 'Escavação',         'O material retirado está afastado da borda da vala?'),
      (v_modelo,  9, 'Escavação',         'Há acesso de entrada e saída a cada trecho da escavação?'),
      (v_modelo, 10, 'Elétrica',          'A instalação provisória está em quadro adequado, sem gambiarra?'),
      (v_modelo, 11, 'Elétrica',          'Os cabos estão suspensos ou protegidos, fora da área de circulação?'),
      (v_modelo, 12, 'Máquinas',          'As máquinas e ferramentas estão com proteção e em bom estado?'),
      (v_modelo, 13, 'Circulação',        'As vias de circulação de pedestres estão separadas das de veículos?'),
      (v_modelo, 14, 'Instalações',       'As instalações sanitárias atendem ao número de trabalhadores?'),
      (v_modelo, 15, 'Instalações',       'O refeitório e o vestiário estão em condição de uso?'),
      (v_modelo, 16, 'Pessoas',           'Os trabalhadores receberam a ordem de serviço e o treinamento admissional?');
  end if;

  -- ================================================================
  -- 5. Trabalho em altura (NR-35)
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Trabalho em altura';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Trabalho em altura', 'NR-35',
            'Antes de subir: autorização, análise de risco, ancoragem e equipamento.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta) values
      (v_modelo,  1, 'Autorização', 'Existe permissão de trabalho emitida para esta atividade?'),
      (v_modelo,  2, 'Autorização', 'A análise de risco foi feita e discutida com a equipe antes de começar?'),
      (v_modelo,  3, 'Autorização', 'Os trabalhadores estão capacitados e autorizados para trabalho em altura?'),
      (v_modelo,  4, 'Autorização', 'O estado de saúde dos trabalhadores foi verificado no dia?'),
      (v_modelo,  5, 'Ancoragem',   'O ponto de ancoragem foi definido por quem tem competência para isso?'),
      (v_modelo,  6, 'Ancoragem',   'O trabalhador fica conectado o tempo todo, inclusive no deslocamento?'),
      (v_modelo,  7, 'Equipamento', 'O cinto, o talabarte e o trava-quedas estão sem desgaste, corte ou oxidação?'),
      (v_modelo,  8, 'Equipamento', 'O CA dos equipamentos está válido e a inspeção periódica registrada?'),
      (v_modelo,  9, 'Equipamento', 'A escada ou plataforma usada é adequada e está fixada?'),
      (v_modelo, 10, 'Área',        'A área abaixo está isolada e sinalizada contra queda de material?'),
      (v_modelo, 11, 'Área',        'As condições de tempo e vento permitem o trabalho agora?'),
      (v_modelo, 12, 'Emergência',  'Existe plano de resgate definido e equipe para executá-lo?');
  end if;

  -- ================================================================
  -- 6. Máquinas e equipamentos (NR-12)
  -- ================================================================
  select id into v_modelo from public.inspecao_modelos
   where empresa_id is null and nome = 'Máquinas e equipamentos';

  if v_modelo is null then
    insert into public.inspecao_modelos (empresa_id, nome, norma, descricao)
    values (null, 'Máquinas e equipamentos', 'NR-12',
            'Proteções, parada de emergência, comandos e manutenção das máquinas.')
    returning id into v_modelo;

    insert into public.inspecao_modelo_itens (modelo_id, ordem, categoria, pergunta) values
      (v_modelo,  1, 'Proteções',    'As partes móveis que oferecem risco estão protegidas?'),
      (v_modelo,  2, 'Proteções',    'As proteções estão fixas ou intertravadas, sem terem sido removidas?'),
      (v_modelo,  3, 'Proteções',    'A máquina para quando a proteção móvel é aberta?'),
      (v_modelo,  4, 'Comandos',     'O botão de emergência está acessível, identificado e funcionando?'),
      (v_modelo,  5, 'Comandos',     'Os comandos estão identificados e protegidos contra acionamento acidental?'),
      (v_modelo,  6, 'Comandos',     'A máquina volta a funcionar sozinha depois de uma queda de energia?'),
      (v_modelo,  7, 'Manutenção',   'Existe procedimento de bloqueio e etiquetagem para manutenção?'),
      (v_modelo,  8, 'Manutenção',   'A manutenção preventiva está registrada e em dia?'),
      (v_modelo,  9, 'Manutenção',   'Há vazamento, ruído anormal ou peça improvisada na máquina?'),
      (v_modelo, 10, 'Instalação',   'A máquina está estável, fixada e com área de trabalho suficiente em volta?'),
      (v_modelo, 11, 'Instalação',   'O aterramento e a parte elétrica estão íntegros?'),
      (v_modelo, 12, 'Pessoas',      'O operador foi capacitado para esta máquina, com registro?'),
      (v_modelo, 13, 'Pessoas',      'O manual ou a instrução de operação está disponível no posto?');
  end if;
end
$$;


-- ---------- Conferência -------------------------------------------------
select m.nome,
       m.norma,
       count(i.id) as perguntas
  from public.inspecao_modelos m
  left join public.inspecao_modelo_itens i on i.modelo_id = m.id
 where m.empresa_id is null
 group by m.nome, m.norma
 order by m.nome;
