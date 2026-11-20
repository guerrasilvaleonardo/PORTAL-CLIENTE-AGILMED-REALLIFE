import { writeFileSync } from 'node:fs'
import { montarAvisoEpi, type ItemAvisoEpi } from '@/lib/avisoEpi'

/*
 * Prévia do aviso semanal de EPI, sem mandar e-mail para ninguém.
 *
 * Rodar: npx tsx scripts/previa-aviso-epi.ts [arquivo.html]
 *
 * Os dados abaixo são de mentira de propósito: a prévia serve para ver o
 * texto e o layout, não para espiar entrega de cliente. Troque à vontade
 * para testar um caso (vencido, vários EPIs na mesma pessoa, sem CA).
 */

const HOJE = new Date()
const emDias = (n: number) => {
  const d = new Date(HOJE)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const ITENS: ItemAvisoEpi[] = [
  {
    nome: 'Botina de segurança',
    ca: '43377',
    quantidade: 1,
    troca_em: emDias(-8),
    dias: -8,
    colaborador: 'José da Silva',
    funcao: 'Pedreiro',
  },
  {
    nome: 'Luva de vaqueta',
    ca: '41234',
    quantidade: 2,
    troca_em: emDias(3),
    dias: 3,
    colaborador: 'José da Silva',
    funcao: 'Pedreiro',
  },
  {
    nome: 'Protetor auricular',
    ca: '39856',
    quantidade: 1,
    troca_em: emDias(0),
    dias: 0,
    colaborador: 'Maria de Souza',
    funcao: 'Auxiliar de produção',
  },
  {
    nome: 'Uniforme (calça e camisa)',
    ca: null,
    quantidade: 1,
    troca_em: emDias(5),
    dias: 5,
    colaborador: 'Antônio Pereira',
    funcao: null,
  },
]

const { assunto, html, marca } = montarAvisoEpi({
  empresa: { nome_fantasia: 'Empresa de Exemplo', razao_social: 'Empresa de Exemplo LTDA', marca: 'reallife' },
  itens: ITENS,
  limite: emDias(6),
})

const destino = process.argv[2] || 'previa-aviso-epi.html'
writeFileSync(destino, html, 'utf8')

console.log('Marca:   ' + marca)
console.log('Assunto: ' + assunto)
console.log('Arquivo: ' + destino)
