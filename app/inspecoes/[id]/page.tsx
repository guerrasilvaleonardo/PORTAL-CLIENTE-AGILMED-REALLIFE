'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { use } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'

/*
 * Aplicar a inspeção (supabase/inspecoes.sql).
 *
 * Uma pergunta por bloco, três respostas e um campo de observação. Grava
 * a cada clique, sem botão de salvar: quem está em campo, no celular,
 * não volta para apertar "salvar".
 *
 * CONCLUIR É O QUE IMPORTA. Ao concluir, o banco conta os totais e abre
 * uma não conformidade para cada item reprovado. Antes disso a inspeção
 * é rascunho.
 */

type Resposta = {
  id: string
  ordem: number
  categoria: string | null
  pergunta: string
  resposta: string | null
  observacao: string | null
}

type Inspecao = {
  id: string
  modelo_nome: string
  norma: string | null
  local_nome: string | null
  inspetor_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  observacoes: string | null
  itens_total: number
  conformes: number
  nao_conformes: number
  nao_aplicaveis: number
  percentual: number | null
}

function AplicarInspecaoConteudo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [inspecao, setInspecao] = useState<Inspecao | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [concluindo, setConcluindo] = useState(false)

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const { data: i, error: erroI } = await supabase
        .from('inspecoes')
        .select(
          'id, modelo_nome, norma, local_nome, inspetor_nome, iniciada_em, concluida_em, ' +
            'situacao, observacoes, itens_total, conformes, nao_conformes, nao_aplicaveis, percentual'
        )
        .eq('id', id)
        .single()

      if (erroI) throw erroI
      setInspecao(i as unknown as Inspecao)

      const { data: rs } = await supabase
        .from('inspecao_respostas')
        .select('id, ordem, categoria, pergunta, resposta, observacao')
        .eq('inspecao_id', id)
        .order('ordem')
      setRespostas((rs || []) as unknown as Resposta[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível abrir a inspeção.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fechada = inspecao?.situacao !== 'em_andamento'

  async function responder(rid: string, valor: string) {
    if (fechada) return
    const anterior = respostas.find((r) => r.id === rid)?.resposta || null
    /* Clicar de novo na mesma resposta desmarca. */
    const nova = anterior === valor ? null : valor

    setRespostas((lista) => lista.map((r) => (r.id === rid ? { ...r, resposta: nova } : r)))

    const { error } = await supabase.from('inspecao_respostas').update({ resposta: nova }).eq('id', rid)
    if (error) {
      setErro(error.message)
      setRespostas((lista) => lista.map((r) => (r.id === rid ? { ...r, resposta: anterior } : r)))
    }
  }

  async function anotar(rid: string, texto: string) {
    if (fechada) return
    setRespostas((lista) => lista.map((r) => (r.id === rid ? { ...r, observacao: texto } : r)))
    await supabase.from('inspecao_respostas').update({ observacao: texto || null }).eq('id', rid)
  }

  async function concluir() {
    if (concluindo || fechada) return

    const semResposta = respostas.filter((r) => !r.resposta).length
    if (semResposta > 0) {
      const segue = window.confirm(
        semResposta +
          (semResposta === 1 ? ' pergunta ficou' : ' perguntas ficaram') +
          ' sem resposta e não entram na conta. Concluir mesmo assim?'
      )
      if (!segue) return
    }

    setConcluindo(true)
    setErro('')

    const { error } = await supabase.from('inspecoes').update({ situacao: 'concluida' }).eq('id', id)
    setConcluindo(false)

    if (error) {
      setErro(error.message)
      return
    }

    await carregar()
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  if (!inspecao) {
    return (
      <div className="app">
        <div className="banner bad">{erro || 'Inspeção não encontrada.'}</div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">{inspecao.modelo_nome}</h1>
        <p className="subtitulo-tela">
          {[inspecao.norma, inspecao.local_nome, inspecao.inspetor_nome].filter(Boolean).join(' · ')}
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {fechada && (
        <div className="banner">
          Inspeção concluída. {inspecao.conformes} conforme{inspecao.conformes === 1 ? '' : 's'},{' '}
          {inspecao.nao_conformes} não conforme{inspecao.nao_conformes === 1 ? '' : 's'},{' '}
          {inspecao.nao_aplicaveis} não aplicável
          {inspecao.percentual !== null ? ` — ${inspecao.percentual}% de conformidade` : ''}.{' '}
          <Link href="/inspecoes/nc" className="btn btn-sm">
            Ver as não conformidades
          </Link>
        </div>
      )}

      <div className="filters">
        <Link href="/inspecoes" className="btn btn-sm">
          ← Voltar
        </Link>
        <span style={{ flex: 1 }} />
        {!fechada && (
          <button type="button" className="btn btn-primary" disabled={concluindo} onClick={concluir}>
            {concluindo ? 'Concluindo…' : 'Concluir inspeção'}
          </button>
        )}
      </div>

      {respostas.length === 0 ? (
        <p className="empty-state">
          Este modelo não tinha pergunta nenhuma quando a inspeção foi aberta.
        </p>
      ) : (
        <div>
          {respostas.map((r, n) => (
            <div key={r.id} className={'insp-item respondido-' + (r.resposta || 'nenhum')}>
              <div className="pergunta">
                {n + 1}. {r.pergunta}
              </div>
              {r.categoria && <div className="orientacao">{r.categoria}</div>}

              <div className="insp-respostas">
                <button
                  type="button"
                  className={'sim' + (r.resposta === 'conforme' ? ' ativo' : '')}
                  disabled={fechada}
                  onClick={() => responder(r.id, 'conforme')}
                >
                  Conforme
                </button>
                <button
                  type="button"
                  className={'nao' + (r.resposta === 'nao_conforme' ? ' ativo' : '')}
                  disabled={fechada}
                  onClick={() => responder(r.id, 'nao_conforme')}
                >
                  Não conforme
                </button>
                <button
                  type="button"
                  className={'na' + (r.resposta === 'nao_aplicavel' ? ' ativo' : '')}
                  disabled={fechada}
                  onClick={() => responder(r.id, 'nao_aplicavel')}
                >
                  Não se aplica
                </button>
              </div>

              {(r.resposta === 'nao_conforme' || r.observacao) && (
                <input
                  type="text"
                  value={r.observacao || ''}
                  disabled={fechada}
                  placeholder="O que foi encontrado (entra na não conformidade)"
                  onChange={(e) => anotar(r.id, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function AplicarInspecao({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ComModulo modulo="inspecoes">
      <AplicarInspecaoConteudo params={params} />
    </ComModulo>
  )
}
