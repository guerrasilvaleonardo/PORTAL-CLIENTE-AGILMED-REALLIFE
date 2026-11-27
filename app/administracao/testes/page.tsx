'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/*
 * Quem testou o portal, e o que fez com o teste.
 *
 * POR QUE ESTA TELA EXISTE. O teste de 7 dias já gravava tudo em
 * modulo_testes — quem ligou, quando acabou, se virou chamado — e
 * ninguém lia. Era informação comercial parada no banco.
 *
 * A linha que importa é a do meio: TESTOU, ACABOU E NÃO PEDIU NADA.
 * Essa empresa levantou a mão, usou a ferramenta com os dados dela e
 * parou. É a ligação mais fácil do mês, e sem esta tela ninguém sabe
 * que ela existe. Por isso ela vem primeiro na lista, e não em ordem
 * de data.
 */

type Teste = {
  id: string
  modulo: string
  empresa: string
  interna: boolean
  iniciadoEm: string
  terminaEm: string
  situacao: 'andamento' | 'encerrado' | 'convertido'
  diasRestantes: number
  convertidoEm: string | null
  chamadoNumero: number | null
  chamadoStatus: string | null
}

type Resumo = { total: number; andamento: number; encerrados: number; convertidos: number }

const ROTULO_FERRAMENTA: Record<string, string> = {
  epi: 'EPI',
  inspecoes: 'Inspeções',
}

/* Encerrado sem pedido primeiro: é o que pede ação. */
const ORDEM_SITUACAO: Record<Teste['situacao'], number> = {
  encerrado: 0,
  andamento: 1,
  convertido: 2,
}

function data(valor: string | null) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR')
}

export default function TestesPage() {
  const [testes, setTestes] = useState<Teste[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [mostrarInternas, setMostrarInternas] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          window.location.href = '/login'
          return
        }

        const resposta = await fetch('/api/administracao/testes', {
          headers: { Authorization: 'Bearer ' + session.access_token },
        })
        const resultado = await resposta.json()

        if (!resposta.ok) {
          throw new Error(resultado.erro || 'Não foi possível carregar os testes.')
        }

        if (!ativo) return

        if (resultado.semTabela) {
          setSemTabela(true)
          return
        }

        setTestes(resultado.testes || [])
        setResumo(resultado.resumo || null)
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar os testes.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          O teste de 7 dias ainda não foi criado no banco. Rode{' '}
          <code>supabase/teste-de-7-dias.sql</code> no SQL Editor do Supabase.
        </div>
      </div>
    )
  }

  const visiveis = testes
    .filter((t) => mostrarInternas || !t.interna)
    .sort((a, b) => {
      const porSituacao = ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
      if (porSituacao !== 0) return porSituacao
      return new Date(b.terminaEm).getTime() - new Date(a.terminaEm).getTime()
    })

  const internas = testes.filter((t) => t.interna).length

  return (
    <div className="app">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1 className="titulo-tela">Testes de 7 dias</h1>
          <p className="subtitulo-tela">
            Quem experimentou EPI ou Inspeções por conta própria, e o que fez depois.
          </p>
        </div>
        <Link href="/administracao/empresas" className="btn btn-sm">
          Empresas
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {resumo && (
        <div className="stats">
          <div className="stat">
            <div className="num">{resumo.total}</div>
            <div className="lbl">Testes de clientes</div>
          </div>
          <div className="stat warn">
            <div className="num">{resumo.encerrados}</div>
            <div className="lbl">Acabaram e não pediram nada</div>
          </div>
          <div className="stat">
            <div className="num">{resumo.andamento}</div>
            <div className="lbl">Em andamento</div>
          </div>
          <div className="stat good">
            <div className="num">{resumo.convertidos}</div>
            <div className="lbl">Viraram pedido</div>
          </div>
        </div>
      )}

      {internas > 0 && (
        <div className="filters">
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mostrarInternas}
              onChange={(e) => setMostrarInternas(e.target.checked)}
            />
            Mostrar também os {internas} testes das nossas empresas
          </label>
        </div>
      )}

      <div className="panel">
        {carregando ? (
          <div className="empty-state">Carregando...</div>
        ) : visiveis.length === 0 ? (
          <div className="empty-state">
            Nenhum cliente ligou o teste ainda. O botão fica em Contratar, nos cartões de EPI e
            Inspeções.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tabela-colab">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Ferramenta</th>
                  <th>Começou</th>
                  <th>Terminou</th>
                  <th>Situação</th>
                  <th>Pedido</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((t) => (
                  <tr key={t.id}>
                    <td className="nome">
                      {t.empresa}
                      {t.interna && (
                        <span className="pill flat" style={{ marginLeft: 6 }}>
                          nossa
                        </span>
                      )}
                    </td>
                    <td>{ROTULO_FERRAMENTA[t.modulo] || t.modulo}</td>
                    <td>{data(t.iniciadoEm)}</td>
                    <td>{data(t.terminaEm)}</td>
                    <td>
                      {t.situacao === 'convertido' ? (
                        <span className="pill good">Virou pedido</span>
                      ) : t.situacao === 'andamento' ? (
                        <span className="pill">
                          {t.diasRestantes <= 1 ? 'Acaba hoje' : 'Faltam ' + t.diasRestantes + ' dias'}
                        </span>
                      ) : (
                        <span className="pill warn">Acabou, sem pedido</span>
                      )}
                    </td>
                    <td>
                      {t.chamadoNumero ? (
                        <Link href={'/atendimento'}>#{t.chamadoNumero}</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.55, marginTop: 4 }}>
        &quot;Acabou, sem pedido&quot; é a linha que vale a ligação: a empresa usou a ferramenta com
        os dados dela e parou. O que ela registrou continua no portal, em modo leitura — e é o
        melhor assunto para começar a conversa.
      </p>
    </div>
  )
}
