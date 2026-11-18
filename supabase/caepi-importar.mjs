/**
 * Importa a base de CAs do Ministério do Trabalho para a tabela caepi.
 *
 * De onde vem: o MTE publica a base inteira num arquivo atualizado todo
 * dia às 20h, em gov.br. A página de consulta ao vivo está atrás de
 * proteção anti-robô e recusa pedido de servidor — o arquivo é a porta
 * da frente, e é por ela que entramos.
 *
 * O arquivo chama-se tgg_export_caepi.zip mas é um RAR. Node não abre
 * RAR sozinho, então o script usa o UnRAR que já existe na máquina
 * (WinRAR). Se preferir, descompacte à mão e passe o caminho do .txt:
 *
 *     node supabase/caepi-importar.mjs C:\caminho\tgg_export_caepi.txt
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

/* ---------- 1. o arquivo ---------- */
async function pegarTxt() {
  const informado = process.argv[2];
  if (informado) {
    console.log('usando o arquivo informado:', informado);
    return fs.readFileSync(informado);
  }

  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'caepi-'));
  const compactado = path.join(pasta, 'caepi.rar');
  console.log('baixando a base do MTE…');
  const r = await fetch(ARQUIVO, { headers: { 'User-Agent': 'portal-real-life/1.0' } });
  if (!r.ok) throw new Error('o MTE respondeu ' + r.status);
  fs.writeFileSync(compactado, Buffer.from(await r.arrayBuffer()));
  console.log('baixado:', (fs.statSync(compactado).size / 1048576).toFixed(1), 'MB');

  for (const exe of UNRAR) {
    try {
      execFileSync(exe, ['x', '-y', compactado, pasta + path.sep], { stdio: 'ignore' });
      const txt = fs
        .readdirSync(pasta)
        .find((f) => f.toLowerCase().endsWith('.txt'));
      if (txt) {
        console.log('descompactado com', exe);
        return fs.readFileSync(path.join(pasta, txt));
      }
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error(
    'não achei o UnRAR. Instale o WinRAR ou descompacte à mão e passe o caminho do .txt como argumento.'
  );
}

/* ---------- 2. ler as linhas ---------- */
const soData = (v) => {
  const m = (v || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const limpo = (v) => {
  const s = (v || '').trim();
  return s === '' ? null : s;
};

const bruto = await pegarTxt();
/* O arquivo vem em latin1: lido como utf-8, "PROTEÇÃO" sai quebrado. */
const linhas = bruto.toString('latin1').split(/\r?\n/).filter(Boolean);
const cabecalho = linhas.shift().replace(/^#/, '').split('|');
const col = Object.fromEntries(cabecalho.map((c, i) => [c.trim(), i]));
console.log('linhas no arquivo:', linhas.length);

/* O arquivo traz UMA LINHA POR LAUDO, não por CA: o mesmo certificado
 * aparece repetido, uma vez para cada ensaio de laboratório. Conferido
 * no CA 32297, que tem 70 linhas: do número à cor, tudo é idêntico em
 * todas elas; só mudam laboratório, nº do laudo e norma. Então a
 * primeira linha define o registro, e as demais servem para juntar as
 * normas, que é o que de fato varia e interessa. */
const porCa = new Map();
for (const linha of linhas) {
  const c = linha.split('|');
  const ca = limpo(c[col.NRRegistroCA]);
  if (!ca) continue;
  const norma = limpo(c[col.Norma]);

  const jaVisto = porCa.get(ca);
  if (jaVisto) {
    if (norma) jaVisto.normas.add(norma);
    continue;
  }

  porCa.set(ca, {
    normas: new Set(norma ? [norma] : []),
    registro: {
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
    },
  });
}

const registros = [...porCa.values()].map(({ registro, normas }) => ({
  ...registro,
  norma: normas.size ? [...normas].join(' · ') : null,
}));
console.log('CAs distintos:', registros.length);

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
