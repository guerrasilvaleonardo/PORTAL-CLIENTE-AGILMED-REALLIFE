/**
 * Importa a base de CAs do Ministério do Trabalho para a tabela caepi.
 *
 * De onde vem: a página de consulta do CAEPI tem o link "Base de dados
 * do sistema CAEPI (Download)". Ele só funciona num navegador — a página
 * está atrás de proteção anti-robô —, então quem importa baixa o arquivo
 * ali e passa o caminho para este script:
 *
 *     node supabase/caepi-importar.mjs C:\Users\...\Downloads\tgg_export_caepi.zip
 *
 * Aceita o .zip/.rar como veio, ou o .txt já descompactado.
 *
 * ATENÇÃO — O ARQUIVO DE gov.br ESTÁ PARADO. Sem argumento, o script
 * tenta o endereço antigo em gov.br, mas em 21/11/2026 aquele arquivo
 * era de 08/11/2020: 33 mil CAs, sem nenhuma renovação dos últimos seis
 * anos. Importado, ele fazia CA válido aparecer vencido no portal (o CA
 * 43377 dizia 29/08/2024; no CAEPI vale até 20/09/2028). Por isso o
 * script confere a data do arquivo e RECUSA base com mais de 45 dias,
 * a não ser que se passe --forcar.
 *
 * O arquivo chama-se .zip mas costuma ser um RAR. Node não abre RAR
 * sozinho, então o script usa o UnRAR do WinRAR que já existe na máquina.
 *
 * Precisa de duas variáveis de ambiente, que são as mesmas da Vercel:
 *     NEXT_PUBLIC_SUPABASE_URL
 *     SUPABASE_SERVICE_ROLE_KEY
 *
 * Rode antes supabase/caepi.sql, que cria a tabela.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ARQUIVO =
  'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/equipamentos-de-protecao-individual-epi/tgg_export_caepi.zip';

const UNRAR = [
  'C:/Program Files/WinRAR/UnRAR.exe',
  'C:/Program Files (x86)/WinRAR/UnRAR.exe',
  'unrar',
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.\n' +
      'São as mesmas variáveis que estão na Vercel, em Settings > Environment Variables.'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCAR = args.includes('--forcar');
const informado = args.find((a) => !a.startsWith('--'));
const IDADE_MAXIMA_DIAS = 45;

/* ---------- 1. o arquivo ---------- */
/* Devolve o conteúdo do .txt e a data do arquivo. A data é a que vem
 * gravada dentro do compactado (o UnRAR a preserva ao extrair): é ela
 * que diz de quando é a base, não a hora em que foi baixada. */
function descompactar(compactado) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'caepi-'));
  for (const exe of UNRAR) {
    try {
      execFileSync(exe, ['x', '-y', compactado, pasta + path.sep], { stdio: 'ignore' });
      const txt = fs.readdirSync(pasta).find((f) => f.toLowerCase().endsWith('.txt'));
      if (txt) {
        console.log('descompactado com', exe);
        const caminho = path.join(pasta, txt);
        return { bruto: fs.readFileSync(caminho), data: fs.statSync(caminho).mtime };
      }
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error(
    'não consegui descompactar. Instale o WinRAR, ou descompacte à mão e passe o caminho do .txt.'
  );
}

async function pegarTxt() {
  if (informado) {
    console.log('usando o arquivo informado:', informado);
    if (informado.toLowerCase().endsWith('.txt')) {
      return { bruto: fs.readFileSync(informado), data: fs.statSync(informado).mtime };
    }
    return descompactar(informado);
  }

  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'caepi-'));
  const compactado = path.join(pasta, 'caepi.rar');
  console.log('nenhum arquivo informado: tentando o endereço antigo em gov.br…');
  const r = await fetch(ARQUIVO, { headers: { 'User-Agent': 'portal-real-life/1.0' } });
  if (!r.ok) throw new Error('o MTE respondeu ' + r.status);
  fs.writeFileSync(compactado, Buffer.from(await r.arrayBuffer()));
  console.log('baixado:', (fs.statSync(compactado).size / 1048576).toFixed(1), 'MB');
  return descompactar(compactado);
}

/* ---------- 2. ler as linhas ---------- */
const soData = (v) => {
  /* "25/03/2015" ou "20/09/2028 00:00:00": a hora, quando vem, é ignorada. */
  const m = (v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const limpo = (v) => {
  const s = (v || '').trim();
  return s === '' ? null : s;
};

const { bruto, data: dataArquivo } = await pegarTxt();

/* Base velha não entra: ela não só deixa de trazer os CAs novos, ela
 * PIORA o portal, porque troca validade renovada por validade vencida. */
const idadeDias = Math.floor((Date.now() - dataArquivo.getTime()) / 864e5);
console.log(
  'data do arquivo:',
  dataArquivo.toLocaleDateString('pt-BR'),
  `(${idadeDias} dia${idadeDias === 1 ? '' : 's'} atrás)`
);
if (idadeDias > IDADE_MAXIMA_DIAS && !FORCAR) {
  console.error(
    `\nPAREI: esta base é de ${dataArquivo.toLocaleDateString('pt-BR')}, com mais de ${IDADE_MAXIMA_DIAS} dias.\n` +
      'Importá-la faria CAs renovados depois disso aparecerem vencidos no portal.\n' +
      'Nada foi gravado. Baixe a base atual pelo link "Base de dados do sistema CAEPI (Download)"\n' +
      'em https://caepi.trabalho.gov.br/internet/ConsultaCAinternet.aspx e rode de novo com o arquivo.\n' +
      'Se tiver certeza de que quer esta base mesmo assim, acrescente --forcar.'
  );
  process.exit(2);
}

/* O arquivo vem em latin1: lido como utf-8, "PROTEÇÃO" sai quebrado. */
const linhas = bruto.toString('latin1').split(/\r?\n/).filter(Boolean);
const cabecalho = linhas.shift().replace(/^#/, '').split('|');
const col = Object.fromEntries(cabecalho.map((c, i) => [c.trim(), i]));
console.log('linhas no arquivo:', linhas.length);

/* O arquivo traz UMA LINHA POR LAUDO, não por CA: o mesmo certificado
 * aparece repetido, uma vez para cada ensaio de laboratório (o CA 32297
 * tem 70 linhas), e as normas se juntam de todas elas. Na maioria dos
 * CAs as linhas são idênticas do número à cor — mas não em todos: no
 * arquivo de 2020, 18 CAs traziam validades ou situações diferentes
 * entre as linhas (processo antigo e renovação lado a lado). Por isso o
 * registro vem da linha com a MAIOR validade, e não da primeira que
 * aparece: a primeira pode ser a do processo vencido. */
const montar = (c, ca) => ({
  ca,
  validade: soData(c[col.DataValidade]),
  situacao: limpo(c[col.Situacao]),
  cnpj: limpo(c[col.CNPJ]),
  razao_social: limpo(c[col.RazaoSocial]),
  natureza: limpo(c[col.Natureza]),
  nome_equipamento: limpo(c[col.NomeEquipamento]),
  descricao: limpo(c[col.DescricaoEquipamento]),
  marca: limpo(c[col.MarcaCA]),
  referencia: limpo(c[col.Referencia]),
  cor: limpo(c[col.Cor]),
  norma: null,
});
const porCa = new Map();
for (const linha of linhas) {
  const c = linha.split('|');
  const ca = limpo(c[col.NRRegistroCA]);
  if (!ca) continue;
  const norma = limpo(c[col.Norma]);

  const jaVisto = porCa.get(ca);
  if (jaVisto) {
    if (norma) jaVisto.normas.add(norma);
    const validade = soData(c[col.DataValidade]);
    if (validade && (!jaVisto.registro.validade || validade > jaVisto.registro.validade)) {
      jaVisto.registro = montar(c, ca);
    }
    continue;
  }

  porCa.set(ca, {
    normas: new Set(norma ? [norma] : []),
    registro: montar(c, ca),
  });
}
const registros = [...porCa.values()].map(({ registro, normas }) => ({
  ...registro,
  norma: normas.size ? [...normas].join(' · ') : null,
}));
const hojeIso = new Date().toISOString().slice(0, 10);
const maiorValidade = registros.reduce((m, r) => (r.validade && r.validade > m ? r.validade : m), '');
console.log('CAs distintos:', registros.length);
console.log('com validade em dia hoje:', registros.filter((r) => r.validade && r.validade >= hojeIso).length);
console.log('maior validade no arquivo:', maiorValidade.split('-').reverse().join('/'));

/* ---------- 3. gravar em lotes ---------- */
const LOTE = 1000;
let gravados = 0;
for (let i = 0; i < registros.length; i += LOTE) {
  const parte = registros.slice(i, i + LOTE);
  const r = await fetch(`${url}/rest/v1/caepi?on_conflict=ca`, {
    method: 'POST',
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(parte),
  });
  if (!r.ok) {
    console.error('erro no lote que começa em', i, '—', r.status, (await r.text()).slice(0, 300));
    process.exit(1);
  }
  gravados += parte.length;
  if (i % (LOTE * 10) === 0 || gravados === registros.length) {
    console.log(`${gravados} de ${registros.length}`);
  }
}

console.log('pronto:', gravados, 'CAs na tabela caepi.');
