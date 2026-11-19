'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { lerPlanilha } from '@/lib/planilha'

/*
 * Preencher a função de muita gente de uma vez, por planilha.
 *
 * POR QUE ISTO EXISTE. A tela de EPI por função só rende quando os
 * trabalhadores têm função preenchida, e no dia em que ela ficou pronta
 * havia 3 funções preenchidas em 957 cadastros. Digitar uma por uma não
 * é trabalho de ninguém.
 *
 * CASA POR CPF OU MATRÍCULA, NUNCA POR NOME. Dois Josés da Silva na
 * mesma obra é o caso comum, não a exceção, e a função sai na ficha de
 * EPI, que é documento da NR-06. Errar a pessoa aqui é pôr o cargo
 * errado no documento de alguém.
 *
 * Mostra tudo antes de gravar, como a importação de equipamentos: quem
 * encontrou, o que muda, e quem não foi encontrado.
 */

type Pessoa = {
  id: string
  empresa_id: string
  nome: string
  cpf: string | null
  matricula: string | null
  funcao: string | null
}

type Plano = {
  linha: number
  chave: string
  nome: string
  antes: string
  depois: string
  acao: 'alterar' | 'igual' | 'erro'
  detalhe: string
  pessoaId?: string
}

const soDigitos = (v: string | undefined) => (v || '').replace(/\D/g, '')

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export default function ImportarFuncoes({
  empresaId,
  nomeEmpresa,
  pessoas,
  aoTerminar,
}: {
  empresaId: string
  nomeEmpresa: string
  pessoas: Pessoa[]
  aoTerminar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState('')
  const [arquivo, setArquivo] = useState('')
  const [plano, setPlano] = useState<Plano[] | null>(null)
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
      const linhas = (await lerPlanilha(f)).filter((l) => l.some((c) => (c || '').trim() !== ''))
      if (!linhas.length) throw new Error('A planilha está vazia.')

      /* Aqui o cabeçalho é obrigatório: a ordem das colunas não é
       * padronizada em lugar nenhum, e adivinhar qual coluna é o CPF
       * seria chutar com o documento dos outros. */
      const cabecalho = linhas[0].map(semAcento)
      const achar = (...nomes: string[]) =>
        cabecalho.findIndex((c) => nomes.some((n) => c === n || c.includes(n)))

      const iCpf = achar('cpf')
      const iMatricula = achar('matricula', 'registro', 'chapa')
      const iFuncao = achar('funcao', 'cargo')

      if (iFuncao < 0 || (iCpf < 0 && iMatricula < 0)) {
        throw new Error(
          'A primeira linha precisa ter os títulos das colunas: FUNÇÃO e pelo menos CPF ou MATRÍCULA.'
        )
      }

      const daEmpresa = pessoas.filter((p) => p.empresa_id === empresaId)
      const porCpf = new Map(daEmpresa.filter((p) => p.cpf).map((p) => [soDigitos(p.cpf!), p]))
      const porMatricula = new Map(
        daEmpresa.filter((p) => p.matricula).map((p) => [semAcento(p.matricula!), p])
      )

      const novo: Plano[] = linhas.slice(1).map((l, i) => {
        const numeroLinha = i + 2
        const cpf = iCpf >= 0 ? soDigitos(l[iCpf]) : ''
        const matricula = iMatricula >= 0 ? (l[iMatricula] || '').trim() : ''
        const funcao = (l[iFuncao] || '').trim()
        const chave = cpf || matricula

        const pessoa =
          (cpf && porCpf.get(cpf)) || (matricula && porMatricula.get(semAcento(matricula))) || null

        if (!chave) {
          return { linha: numeroLinha, chave: '', nome: '', antes: '', depois: funcao, acao: 'erro', detalhe: 'sem CPF nem matrícula' }
        }
        if (!funcao) {
          return { linha: numeroLinha, chave, nome: pessoa?.nome || '', antes: pessoa?.funcao || '', depois: '', acao: 'erro', detalhe: 'sem a função' }
        }
        if (!pessoa) {
          return { linha: numeroLinha, chave, nome: '', antes: '', depois: funcao, acao: 'erro', detalhe: `ninguém com ${cpf ? 'esse CPF' : 'essa matrícula'} em ${nomeEmpresa}` }
        }

        const antes = (pessoa.funcao || '').trim()
        if (semAcento(antes) === semAcento(funcao)) {
          return { linha: numeroLinha, chave, nome: pessoa.nome, antes, depois: funcao, acao: 'igual', detalhe: 'já está assim', pessoaId: pessoa.id }
        }

        return {
          linha: numeroLinha,
          chave,
          nome: pessoa.nome,
          antes,
          depois: funcao,
          acao: 'alterar',
          detalhe: antes ? `era "${antes}"` : 'estava em branco',
          pessoaId: pessoa.id,
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
      for (const p of plano.filter((x) => x.acao === 'alterar')) {
        const { error } = await supabase
          .from('colaboradores')
          .update({ funcao: p.depois })
          .eq('id', p.pessoaId)
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
    const linhas = ['CPF;Matrícula;Função', '000.000.000-00;;Pedreiro', ';1234;Eletricista'].join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + linhas], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-funcoes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const contas = plano
    ? {
        alterar: plano.filter((p) => p.acao === 'alterar').length,
        igual: plano.filter((p) => p.acao === 'igual').length,
        erro: plano.filter((p) => p.acao === 'erro').length,
      }
    : null

  if (!aberto) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => setAberto(true)}>
        Importar funções
      </button>
    )
  }

  return (
    <div className="cortina" onClick={(e) => e.target === e.currentTarget && !gravando && fechar()}>
      <div className="painel-lateral" role="dialog" aria-label="Importar funções por planilha">
        <div className="panel-head">
          <h2>Importar funções</h2>
          <button type="button" className="btn btn-sm" onClick={fechar} disabled={gravando}>
            Fechar
          </button>
        </div>

        <div className="painel-corpo">
          {erro && <div className="banner bad">{erro}</div>}

          <p className="dica">
            Colunas: <strong>CPF</strong> ou <strong>Matrícula</strong> para achar a pessoa, e{' '}
            <strong>Função</strong>. A primeira linha tem de ser o título das colunas. Só a função é
            alterada — nome, CPF e o resto do cadastro não são tocados.
          </p>

          <div className="linha-arquivo">
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

          {arquivo && <p className="dica">{lendo ? `Lendo ${arquivo}…` : arquivo}</p>}

          {plano && contas && (
            <>
              <div className="banner">
                {contas.alterar} para mudar
                {contas.igual > 0 ? ` · ${contas.igual} já estão assim` : ''}
                {contas.erro > 0 ? ` · ${contas.erro} com problema` : ''} — em {nomeEmpresa}
              </div>

              <div className="table-scroll">
                <table className="tabela-colab">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Quem</th>
                      <th>Função</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plano.map((p) => (
                      <tr key={p.linha} className={p.acao === 'erro' ? 'inativo' : ''}>
                        <td>{p.linha}</td>
                        <td className="nome">{p.nome || p.chave || '—'}</td>
                        <td>
                          {p.acao === 'erro' ? (
                            <span className="pill bad">{p.detalhe}</span>
                          ) : p.acao === 'igual' ? (
                            <span className="pill flat">{p.detalhe}</span>
                          ) : (
                            <>
                              <strong>{p.depois}</strong>{' '}
                              <span className="pill">{p.detalhe}</span>
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
            disabled={gravando || !contas || contas.alterar === 0}
          >
            {gravando
              ? 'Gravando…'
              : contas
                ? `Mudar ${contas.alterar} ${contas.alterar === 1 ? 'função' : 'funções'}`
                : 'Gravar'}
          </button>
        </div>
      </div>
    </div>
  )
}
