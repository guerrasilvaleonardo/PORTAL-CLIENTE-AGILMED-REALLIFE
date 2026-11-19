'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { lerPlanilha, type Linha } from '@/lib/planilha'

/*
 * Importar a configuração de EPI por planilha, como no OnSafety.
 *
 * A planilha dele tem seis colunas — CA, Motivo, Complemento, Vida útil
 * (dias), Estoque e Estoque mínimo — e o manual avisa que "o nome do
 * equipamento não é necessário". Aqui também não é: o nome, a descrição,
 * o fabricante e a validade saem da base do CAEPI pelo número do CA.
 * Por isso a única coluna obrigatória é o CA.
 *
 * NADA É GRAVADO ANTES DA CONFERÊNCIA. O arquivo é lido no navegador e
 * a tela mostra, linha por linha, o que vai ser criado, o que vai ser
 * alterado e o que está errado. Só depois de ver é que se grava.
 * Importar planilha é a operação com mais potencial de estrago do
 * módulo: uma coluna trocada mexe no estoque de tudo.
 */

type Epi = {
  id: string
  empresa_id: string
  nome: string
  ca: string | null
  complemento: string | null
  vida_util_dias: number
  estoque: number
  estoque_minimo: number
  ativo: boolean
}

type Caepi = {
  ca: string
  validade: string | null
  situacao: string | null
  razao_social: string | null
  nome_equipamento: string | null
  descricao: string | null
}

type Plano = {
  linha: number
  ca: string
  complemento: string
  motivo: 'entrada' | 'saida'
  vidaUtil: number | null
  quantidade: number | null
  estoqueMinimo: number | null
  nome: string
  acao: 'criar' | 'atualizar' | 'erro'
  detalhe: string
  epiId?: string
  estoqueFinal?: number
  caepi?: Caepi
}

const COLUNAS_PADRAO = ['ca', 'motivo', 'complemento', 'vida', 'estoque', 'minimo'] as const
type Coluna = (typeof COLUNAS_PADRAO)[number]

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/* Onde está cada coluna. Se a primeira linha tiver cabeçalho, vale o
 * cabeçalho; senão, a ordem da planilha do OnSafety (A a F). */
function mapaDasColunas(primeira: Linha): { mapa: Record<Coluna, number>; temCabecalho: boolean } {
  const mapa: Record<Coluna, number> = { ca: 0, motivo: 1, complemento: 2, vida: 3, estoque: 4, minimo: 5 }
  const textos = primeira.map(semAcento)
  const temCabecalho = textos.some((t) => t === 'ca' || t.startsWith('ca '))
  if (!temCabecalho) return { mapa, temCabecalho }

  textos.forEach((t, i) => {
    if (t === 'ca' || t.startsWith('ca ')) mapa.ca = i
    else if (t.includes('motivo')) mapa.motivo = i
    else if (t.includes('complemento') || t.includes('tamanho') || t.includes('cor')) mapa.complemento = i
    else if (t.includes('vida')) mapa.vida = i
    else if (t.includes('minimo')) mapa.minimo = i
    else if (t.includes('estoque')) mapa.estoque = i
  })
  return { mapa, temCabecalho }
}

const soNumero = (v: string | undefined) => {
  const limpo = (v || '').replace(/\D/g, '')
  return limpo ? limpo : ''
}

const inteiro = (v: string | undefined): number | null => {
  const t = (v || '').trim().replace(',', '.')
  if (!t) return null
  const n = Math.round(Number(t))
  return Number.isFinite(n) ? n : null
}

export default function ImportarPlanilha({
  empresaId,
  nomeEmpresa,
  epis,
  aoTerminar,
}: {
  empresaId: string
  nomeEmpresa: string
  epis: Epi[]
  aoTerminar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState('')
  const [plano, setPlano] = useState<Plano[] | null>(null)
  const [arquivo, setArquivo] = useState('')
  const campo = useRef<HTMLInputElement | null>(null)

  function fechar() {
    setAberto(false)
    setPlano(null)
    setErro('')
    setArquivo('')
    if (campo.current) campo.current.value = ''
  }

  async function aoEscolher(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0]
    if (!f) return
    setLendo(true)
    setErro('')
    setPlano(null)
    setArquivo(f.name)

    try {
      const linhas = await lerPlanilha(f)
      const comConteudo = linhas.filter((l) => l.some((c) => (c || '').trim() !== ''))
      if (!comConteudo.length) throw new Error('A planilha está vazia.')

      const { mapa, temCabecalho } = mapaDasColunas(comConteudo[0])
      const dados = temCabecalho ? comConteudo.slice(1) : comConteudo
      if (!dados.length) throw new Error('A planilha só tem o cabeçalho.')

      /* Um pedido só para todos os CAs da planilha. */
      const cas = [...new Set(dados.map((l) => soNumero(l[mapa.ca])).filter(Boolean))]
      const porCa = new Map<string, Caepi>()
      if (cas.length) {
        const { data } = await supabase
          .from('caepi')
          .select('ca, validade, situacao, razao_social, nome_equipamento, descricao')
          .in('ca', cas)
        for (const c of (data || []) as Caepi[]) porCa.set(c.ca, c)
      }

      const daEmpresa = epis.filter((e) => e.empresa_id === empresaId)
      const chave = (ca: string, comp: string) => `${ca}|${semAcento(comp)}`
      const existentes = new Map(daEmpresa.map((e) => [chave(e.ca || '', e.complemento || ''), e]))

      const novo: Plano[] = dados.map((l, i) => {
        const numeroLinha = i + 1 + (temCabecalho ? 1 : 0)
        const ca = soNumero(l[mapa.ca])
        const complemento = (l[mapa.complemento] || '').trim()
        const motivoTexto = semAcento(l[mapa.motivo] || 'entrada')
        const motivo: 'entrada' | 'saida' = motivoTexto.startsWith('sa') ? 'saida' : 'entrada'
        const vidaUtil = inteiro(l[mapa.vida])
        const quantidade = inteiro(l[mapa.estoque])
        const estoqueMinimo = inteiro(l[mapa.minimo])
        const doCaepi = porCa.get(ca)
        const base: Omit<Plano, 'acao' | 'detalhe' | 'nome'> = {
          linha: numeroLinha,
          ca,
          complemento,
          motivo,
          vidaUtil,
          quantidade,
          estoqueMinimo,
          caepi: doCaepi,
        }

        if (!ca) {
          return { ...base, nome: '', acao: 'erro', detalhe: 'sem o número do CA' }
        }
        if (vidaUtil !== null && (vidaUtil < 1 || vidaUtil > 3650)) {
          return { ...base, nome: '', acao: 'erro', detalhe: 'vida útil fora de 1 a 3650 dias' }
        }

        const existente = existentes.get(chave(ca, complemento))
        const nome = existente?.nome || doCaepi?.nome_equipamento || `CA ${ca}`

        if (existente) {
          const antes = existente.estoque
          const final = motivo === 'saida' ? antes - (quantidade || 0) : antes + (quantidade || 0)
          return {
            ...base,
            nome,
            acao: 'atualizar',
            epiId: existente.id,
            estoqueFinal: final,
            detalhe:
              quantidade === null
                ? 'sem mudar o estoque'
                : `estoque ${antes} ${motivo === 'saida' ? '−' : '+'} ${quantidade} = ${final}`,
          }
        }

        return {
          ...base,
          nome,
          acao: 'criar',
          estoqueFinal: motivo === 'saida' ? 0 : quantidade || 0,
          detalhe: doCaepi
            ? `${doCaepi.razao_social || 'fabricante não informado'}`
            : 'CA fora da base do MTE — confira o número',
        }
      })

      setPlano(novo)
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível ler a planilha.')
    } finally {
      setLendo(false)
      if (campo.current) campo.current.value = ''
    }
  }

  async function gravar() {
    if (!plano) return
    setGravando(true)
    setErro('')
    try {
      const criar = plano.filter((p) => p.acao === 'criar')
      const atualizar = plano.filter((p) => p.acao === 'atualizar')

      if (criar.length) {
        const { error } = await supabase.from('epis').insert(
          criar.map((p) => ({
            empresa_id: empresaId,
            nome: p.nome,
            tipo: 'epi',
            ca: p.ca,
            validade_ca: p.caepi?.validade || null,
            vida_util_dias: p.vidaUtil ?? 90,
            complemento: p.complemento || null,
            fabricante: p.caepi?.razao_social || null,
            observacoes: p.caepi?.descricao || null,
            estoque: p.estoqueFinal ?? 0,
            estoque_minimo: p.estoqueMinimo ?? 0,
          }))
        )
        if (error) throw error
      }

      /* Um a um: são poucas linhas, e assim um erro numa não derruba o resto. */
      for (const p of atualizar) {
        const mudanca: Record<string, unknown> = {}
        if (p.vidaUtil !== null) mudanca.vida_util_dias = p.vidaUtil
        if (p.estoqueMinimo !== null) mudanca.estoque_minimo = p.estoqueMinimo
        if (p.quantidade !== null) mudanca.estoque = p.estoqueFinal
        if (!Object.keys(mudanca).length) continue
        const { error } = await supabase.from('epis').update(mudanca).eq('id', p.epiId)
        if (error) throw error
      }

      fechar()
      aoTerminar()
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível gravar.')
    } finally {
      setGravando(false)
    }
  }

  function baixarModelo() {
    const linhas = [
      'CA;Motivo;Complemento;Vida útil (dias);Estoque;Estoque mínimo',
      '43377;entrada;TAMANHO 40;90;10;2',
      '27414;entrada;;360;5;1',
    ].join('\r\n')
    /* Com BOM, para o Excel abrir os acentos certos. */
    const url = URL.createObjectURL(new Blob(['﻿' + linhas], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-epi.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const contas = plano
    ? {
        criar: plano.filter((p) => p.acao === 'criar').length,
        atualizar: plano.filter((p) => p.acao === 'atualizar').length,
        erro: plano.filter((p) => p.acao === 'erro').length,
      }
    : null

  if (!aberto) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => setAberto(true)}>
        Importar planilha
      </button>
    )
  }

  return (
    <div className="cortina" onClick={(e) => e.target === e.currentTarget && !gravando && fechar()}>
      <div className="painel-lateral" role="dialog" aria-label="Importar planilha de EPI">
        <div className="panel-head">
          <h2>Importar planilha</h2>
          <button type="button" className="btn btn-sm" onClick={fechar} disabled={gravando}>
            Fechar
          </button>
        </div>

        <div className="painel-corpo">
          {erro && <div className="banner bad">{erro}</div>}

          <p className="dica">
            Colunas: <strong>CA</strong>, Motivo (entrada ou saída), Complemento, Vida útil (dias),
            Estoque e Estoque mínimo — a mesma planilha do OnSafety. Só o CA é obrigatório: o nome,
            a descrição, o fabricante e a validade vêm da base do MTE pelo número do CA.
          </p>

          <div className="linha-ca">
            <input
              ref={campo}
              type="file"
              accept=".xlsx,.csv"
              onChange={aoEscolher}
              disabled={lendo || gravando}
            />
            <button type="button" className="btn btn-sm" onClick={baixarModelo}>
              Baixar modelo
            </button>
          </div>

          {/* O campo de arquivo é limpo depois da leitura, para dar para
              escolher o mesmo arquivo de novo. Sem isto ele diria
              "nenhum arquivo escolhido" com a prévia na tela. */}
          {arquivo && <p className="dica">{lendo ? `Lendo ${arquivo}…` : arquivo}</p>}

          {plano && contas && (
            <>
              <div className="banner">
                {contas.criar} para cadastrar · {contas.atualizar} para atualizar
                {contas.erro > 0 ? ` · ${contas.erro} com problema` : ''} — em {nomeEmpresa}
              </div>

              <div className="table-scroll">
                <table className="tabela-colab">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>CA</th>
                      <th>Equipamento</th>
                      <th>O que vai acontecer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plano.map((p) => (
                      <tr key={p.linha} className={p.acao === 'erro' ? 'inativo' : ''}>
                        <td>{p.linha}</td>
                        <td>{p.ca || '—'}</td>
                        <td className="nome">
                          {p.nome || '—'}
                          {p.complemento ? ` · ${p.complemento}` : ''}
                        </td>
                        <td>
                          {p.acao === 'erro' ? (
                            <span className="pill bad">{p.detalhe}</span>
                          ) : (
                            <>
                              <span className={p.acao === 'criar' ? 'pill good' : 'pill'}>
                                {p.acao === 'criar' ? 'cadastrar' : 'atualizar'}
                              </span>{' '}
                              {p.detalhe}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="painel-rodape">
          <button type="button" className="btn" onClick={fechar} disabled={gravando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={gravar}
            disabled={gravando || !plano || !contas || contas.criar + contas.atualizar === 0}
          >
            {gravando
              ? 'Gravando…'
              : contas
                ? `Gravar ${contas.criar + contas.atualizar} linha${contas.criar + contas.atualizar === 1 ? '' : 's'}`
                : 'Gravar'}
          </button>
        </div>
      </div>
    </div>
  )
}
