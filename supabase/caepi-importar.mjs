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
 * Em 21/11/2026 esse link entregava RelatorioCA_AAAAMMDD_HHMMSS.csv.gz
 * (CSV em UTF-8, separado por ";"). Aceita também o formato antigo
 * (tgg_export_caepi .zip/.rar ou .txt).
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
import zlib from 'node:zlib';
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

/* O CAEPI entrega hoje um RelatorioCA_AAAAMMDD_HHMMSS.csv.gz. O gzip
 * vem com bytes sobrando no fim, e o gunzip do Node recusa o arquivo
 * por isso ("incorrect header check"); o conteúdo em si está íntegro.
 * Então pula o cabeçalho do gzip e descompacta o deflate cru, que para
 * sozinho no fim dos dados. */
function gunzipTolerante(buf) {
  try {
    return zlib.gunzipSync(buf);
  } catch {
    if (buf[0] !== 0x1f || buf[1] !== 0x8b) throw new Error('o arquivo não é um .gz válido');
    const flags = buf[3];
    let p = 10;
    if (flags & 4) p += 2 + buf.readUInt16LE(p); // FEXTRA
    if (flags & 8) while (buf[p++] !== 0); // FNAME
    if (flags & 16) while (buf[p++] !== 0); // FCOMMENT
    if (flags & 2) p += 2; // FHCRC
    return zlib.inflateRawSync(buf.subarray(p));
  }
}

/* A data da base: no RelatorioCA ela está no próprio nome do arquivo
 * (RelatorioCA_20261121_093110 = 21/11/2026); fora isso, a data do
 * arquivo em disco. */
function dataDoArquivo(caminho) {
  const m = path.basename(caminho).match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return fs.statSync(caminho).mtime;
}

async function pegarTxt() {
  if (informado) {
    console.log('usando o arquivo informado:', informado);
    const nome = informado.toLowerCase();
    if (nome.endsWith('.gz')) {
      return { bruto: gunzipTolerante(fs.readFileSync(informado)), data: dataDoArquivo(informado) };
    }
    if (nome.endsWith('.txt') || nome.endsWith('.csv')) {
      return { bruto: fs.readFileSync(informado), data: dataDoArquivo(informado) };
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
/* A hora no nome do RelatorioCA é a do servidor e pode vir adiantada
 * em relação ao relógio daqui: nunca menos que zero. */
const idadeDias = Math.max(0, Math.floor((Date.now() - dataArquivo.getTime()) / 864e5));
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

/* Dois formatos convivem:
 *  - o tgg_export_caepi.txt antigo: latin1, separado por "|", sem aspas,
 *    cabeçalho "#NRRegistroCA|DataValidade|...";
 *  - o RelatorioCA.csv atual: UTF-8 com BOM, separado por ";", campos
 *    entre aspas (que podem ter ";" e quebra de linha dentro), cabeçalho
 *    "NR Registro CA;DATA DE VALIDADE;...".
 * Os dois são lidos como lista de campos, e as colunas são achadas pelo
 * nome sem espaço, acento ou caixa — "NR Registro CA" e "NRRegistroCA"
 * viram a mesma chave. */
function* linhasPipe(texto) {
  for (const l of texto.split(/\r?\n/)) if (l) yield l.split('|');
}
function* linhasCsv(texto, sep = ';') {
  let campo = '';
  let linha = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = '';
    } else if (ch === '\n') {
      linha.push(campo);
      campo = '';
      if (linha.length > 1 || linha[0] !== '') yield linha;
      linha = [];
    } else if (ch !== '\r') campo += ch;
  }
  if (campo || linha.length) {
    linha.push(campo);
    yield linha;
  }
}
const ehUtf8 = !bruto.toString('utf8', 0, 200000).includes('�');
/* O formato antigo vem em latin1: lido como utf-8, "PROTEÇÃO" sai quebrado. */
const texto = bruto.toString(ehUtf8 ? 'utf8' : 'latin1').replace(/^﻿+/, '');
const primeira = texto.slice(0, texto.indexOf('\n'));
const leitor = primeira.includes('|') ? linhasPipe(texto) : linhasCsv(texto);
const chaveCol = (n) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const cabecalho = leitor.next().value.map((c) => chaveCol(c.replace(/^#/, '')));
const achar = (...nomes) => {
  const i = cabecalho.findIndex((c) => nomes.includes(c));
  return i < 0 ? undefined : i;
};
const col = {
  NRRegistroCA: achar('NRREGISTROCA'),
  DataValidade: achar('DATAVALIDADE', 'DATADEVALIDADE'),
  Situacao: achar('SITUACAO'),
  CNPJ: achar('CNPJ'),
  RazaoSocial: achar('RAZAOSOCIAL'),
  Natureza: achar('NATUREZA'),
  NomeEquipamento: achar('NOMEEQUIPAMENTO', 'EQUIPAMENTO'),
  DescricaoEquipamento: achar('DESCRICAOEQUIPAMENTO'),
  MarcaCA: achar('MARCACA'),
  Referencia: achar('REFERENCIA'),
  Cor: achar('COR'),
  Norma: achar('NORMA'),
};
const faltando = ['NRRegistroCA', 'DataValidade', 'Situacao'].filter((k) => col[k] === undefined);
if (faltando.length) {
  console.error('O arquivo não tem as colunas esperadas (' + faltando.join(', ') + '). Nada foi gravado.');
  console.error('Cabeçalho encontrado:', cabecalho.join(' | '));
  process.exit(1);
}
const linhas = [...leitor];
console.log('formato:', primeira.includes('|') ? 'tgg_export (txt)' : 'RelatorioCA (csv)', '· linhas no arquivo:', linhas.length);

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
for (const c of linhas) {
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
