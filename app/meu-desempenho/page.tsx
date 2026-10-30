'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { rotuloMes } from '@/lib/relatorioDesempenho'
import FichaPublicada, { type ConteudoPublicado } from '@/components/FichaPublicada'
import '../atendimento/relatorio-mensal/relatorio.css'

/*
 * Meu desempenho (supabase/desempenho-ciencia.sql).
 * A pessoa da equipe vê os relatórios individuais que a direção liberou
 * para ela, registra ciência e pode escrever a sua manifestação.
 * O banco só devolve as cópias da própria pessoa; esta tela só desenha.
 */

type Publicacao = {
  id: number
  mes: string
  conteudo: ConteudoPublicado
  mensagem: string | null
  liberado_em: string
  ciente_em: string | null
  manifestacao: string | null
  manifestacao_em: string | null
}

function dataHora(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Porto_Velho', dateStyle: 'short', timeStyle: 'short' })
}

export default function MeuDesempenhoPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [lista, setLista] = useState<Publicacao[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [meuId, setMeuId] = useState('')
  const [li, setLi] = useState(false)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('desempenho_publicacoes')
      .select('id, mes, conteudo, mensagem, liberado_em, ciente_em, manifestacao, manifestacao_em')
      .eq('pessoa_id', uid)
      .is('revogado_em', null)
      .order('mes', { ascending: false })
      .order('liberado_em', { ascending: false })
    if (error) {
      if ((error as any).code === '42P01' || /desempenho_publicacoes/.test(error.message)) {
        setErro('Os relatórios individuais ainda não foram instalados no portal.')
        return [] as Publicacao[]
      }
      throw error
    }
    const l = (data || []) as Publicacao[]
    setLista(l)
    return l
  }, [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
          return
        }
        if (!vivo) return
        setMeuId(user.id)
        const l = await carregar(user.id)
        if (!vivo) return
        // Abre primeiro o que ainda está sem ciência.
        const pendente = l.find((x) => !x.ciente_em)
        setSelId((pendente || l[0])?.id ?? null)
      } catch (e: any) {
        if (vivo) setErro(e?.message || 'Não foi possível carregar.')
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [carregar])

  useEffect(() => {
    if (!selId) return
    setLi(false)
    setTexto('')
    setAviso('')
    supabase.rpc('abrir_relatorio_publicado', { p_id: selId }).then(() => {})
  }, [selId])

  const sel = lista.find((x) => x.id === selId) || null

  async function registrar() {
    if (!sel) return
    if (!sel.ciente_em && !li) {
      setErro('Marque "Li o relatório" para registrar a ciência.')
      return
    }
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      const { error } = await supabase.rpc('dar_ciencia_relatorio', { p_id: sel.id, p_manifestacao: texto.trim() || null })
      if (error) throw error
      await carregar(meuId)
      setTexto('')
      setAviso(sel.ciente_em ? 'Manifestação registrada.' : 'Ciência registrada. Obrigado.')
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível registrar.')
    } finally {
      setSalvando(false)
    }
  }

  function imprimir() {
    if (!sel) return
    const titulo = document.title
    document.title = 'Relatorio de desempenho ' + sel.conteudo.mes + ' - ' + sel.conteudo.ficha.nome
    window.print()
    setTimeout(() => (document.title = titulo), 1000)
  }

  if (carregando) {
    return (
      <div className="app">
        <div className="empty-state">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="nao-imprimir">
        <div className="section-title">Desenvolvimento</div>
        <h1 style={{ fontSize: 30, marginTop: 6 }}>Meu desempenho</h1>
        <p className="rel-sub">
          Relatórios individuais que a direção liberou para você. Leia, registre a ciência e, se quiser, escreva a sua manifestação
          (concordância, discordância ou contexto). Só você e a direção veem.
        </p>
      </div>

      {erro && <div className="rel-aviso nao-imprimir" style={{ background: 'var(--danger-tint)' }}>{erro}</div>}
      {aviso && <div className="rel-aviso nao-imprimir">{aviso}</div>}

      {!lista.length && !erro && (
        <div className="panel">
          <div className="empty-state">Nenhum relatório liberado para você ainda.</div>
        </div>
      )}

      {lista.length > 0 && (
        <div className="filters nao-imprimir">
          <select value={selId ?? ''} onChange={(ev) => setSelId(Number(ev.target.value) || null)} aria-label="Relatório">
            {lista.map((x) => (
              <option key={x.id} value={x.id}>
                {rotuloMes(x.conteudo.mes)} · versão {x.conteudo.versao} · {x.ciente_em ? 'ciência registrada' : 'aguardando ciência'}
              </option>
            ))}
          </select>
          {sel && (
            <button className="btn btn-sm btn-primary" onClick={imprimir}>
              Imprimir cópia
            </button>
          )}
          <div style={{ flex: 1 }} />
          <Link href="/atendimento/desempenho" className="btn btn-sm">
            Indicadores do mês atual
          </Link>
        </div>
      )}

      {sel && (
        <>
          <FichaPublicada c={sel.conteudo} mensagem={sel.mensagem} />

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Ciência</div>
            </div>
            <div className="panel-body">
              <p className="rel-sub" style={{ color: 'var(--ink)' }}>
                Liberado em {dataHora(sel.liberado_em)}.{' '}
                {sel.ciente_em ? <strong>Ciência registrada em {dataHora(sel.ciente_em)}.</strong> : 'Ciência ainda não registrada.'}
              </p>

              {sel.manifestacao && (
                <div>
                  <div className="section-title" style={{ marginBottom: 6 }}>Minha manifestação ({dataHora(sel.manifestacao_em)})</div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{sel.manifestacao}</p>
                </div>
              )}

              {(!sel.ciente_em || !sel.manifestacao) && (
                <div className="nao-imprimir" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label htmlFor="manifestacao" className="section-title">
                    {sel.ciente_em ? 'Acrescentar manifestação (uma vez)' : 'Manifestação (opcional)'}
                  </label>
                  <textarea
                    id="manifestacao"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    maxLength={3000}
                    rows={4}
                    placeholder="Se quiser, registre aqui se concorda, se discorda de algum ponto ou o contexto que a direção deve considerar."
                    style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 14, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
                  />
                  {!sel.ciente_em && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
                      <input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>Li o relatório e tomei ciência do seu conteúdo. Ciência não significa concordância.</span>
                    </label>
                  )}
                  <div>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={registrar}
                      disabled={salvando || (!!sel.ciente_em && !texto.trim()) || (!sel.ciente_em && !li)}
                    >
                      {salvando ? 'Registrando...' : sel.ciente_em ? 'Registrar manifestação' : 'Registrar ciência'}
                    </button>
                  </div>
                  <p className="rel-sub">Depois de registrada, a ciência e a manifestação não podem ser editadas.</p>
                </div>
              )}

              <div className="rel-assinaturas">
                <div>
                  <div className="rel-linha-assinatura" />
                  {sel.conteudo.ficha.nome} — colaborador(a)
                </div>
                <div>
                  <div className="rel-linha-assinatura" />
                  Direção
                </div>
                <div>
                  <div className="rel-linha-assinatura" />
                  Data
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
