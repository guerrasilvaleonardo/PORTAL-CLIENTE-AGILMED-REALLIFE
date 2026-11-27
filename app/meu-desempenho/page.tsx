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
  /* As perguntas da devolutiva e o que já foi respondido. Devolutiva
     liberada antes de 27/11/2026 não tem nenhuma das duas. */
  perguntas: string[] | null
  respostas: Record<string, string> | null
  respostas_em: string | null
}

/*
 * Baixa o PDF do relatório fechado.
 *
 * A rota monta o arquivo na primeira vez, guarda no balde privado e
 * devolve um link que expira. Por isso ela é chamada tanto logo depois
 * da ciência (para o arquivo nascer sem ninguém precisar lembrar)
 * quanto no botão (para quem quiser a folha meses depois).
 */
async function pedirPdf(id: number): Promise<{ url?: string; erro?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const r = await fetch('/api/desempenho-pdf', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + (session?.access_token || ''),
    },
    body: JSON.stringify({ id }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return { erro: j.erro || 'Não foi possível gerar o PDF.' }
  return { url: j.url as string }
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
  /* O que a pessoa está escrevendo agora, por índice de pergunta. */
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [salvandoResp, setSalvandoResp] = useState(false)
  const [avisoResp, setAvisoResp] = useState('')
  const [baixando, setBaixando] = useState(false)

  const BASE =
    'id, mes, conteudo, mensagem, liberado_em, ciente_em, manifestacao, manifestacao_em'
  const COM_PERGUNTAS = BASE + ', perguntas, respostas, respostas_em'

  const carregar = useCallback(async (uid: string) => {
    /*
     * Tenta com as colunas das perguntas e, se elas ainda não existirem
     * no banco (42703), busca de novo sem elas. Assim a tela continua
     * mostrando a ficha e aceitando ciência mesmo antes de o SQL rodar
     * — a pessoa não fica sem o próprio relatório por causa disso.
     */
    const buscar = (colunas: string) =>
      supabase
        .from('desempenho_publicacoes')
        .select(colunas)
        .eq('pessoa_id', uid)
        .is('revogado_em', null)
        .order('mes', { ascending: false })
        .order('liberado_em', { ascending: false })

    let { data, error } = await buscar(COM_PERGUNTAS)
    if (error && ((error as any).code === '42703' || /perguntas|respostas/.test(error.message))) {
      ;({ data, error } = await buscar(BASE))
    }
    if (error) {
      if ((error as any).code === '42P01' || /desempenho_publicacoes/.test(error.message)) {
        setErro('Os relatórios individuais ainda não foram instalados no portal.')
        return [] as Publicacao[]
      }
      throw error
    }
    const l = (data || []) as unknown as Publicacao[]
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
    setAvisoResp('')
    /* Começa do que já foi respondido, para a pessoa continuar de onde
       parou em vez de recomeçar. */
    const p = lista.find((x) => x.id === selId)
    setRespostas({ ...((p?.respostas || {}) as Record<string, string>) })
    supabase.rpc('abrir_relatorio_publicado', { p_id: selId }).then(() => {})
    /* `lista` fora das dependências de propósito: recarregar a lista
       depois de salvar não pode apagar o que a pessoa está digitando. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])

  const sel = lista.find((x) => x.id === selId) || null
  const perguntas = sel?.perguntas || []
  const respondidas = perguntas.filter((_, i) => (respostas[String(i)] || '').trim()).length
  const faltam = perguntas.length - respondidas

  /* Salva sem dar ciência: responder seis perguntas não cabe numa
     sentada só, e perder o escrito ensina a responder "ok" em tudo. */
  async function salvarRespostas() {
    if (!sel || salvandoResp) return
    setSalvandoResp(true)
    setErro('')
    setAvisoResp('')
    try {
      const limpas: Record<string, string> = {}
      perguntas.forEach((_, i) => {
        const t = (respostas[String(i)] || '').trim()
        if (t) limpas[String(i)] = t
      })
      const { error } = await supabase.rpc('responder_relatorio_publicado', {
        p_id: sel.id,
        p_respostas: limpas,
      })
      if (error) throw error
      await carregar(meuId)
      setAvisoResp(
        faltam > 0
          ? `Respostas guardadas. Falta${faltam === 1 ? '' : 'm'} ${faltam} pergunta${faltam === 1 ? '' : 's'}.`
          : 'Respostas guardadas. Pode registrar a ciência.'
      )
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível guardar as respostas.')
    } finally {
      setSalvandoResp(false)
    }
  }

  async function registrar() {
    if (!sel) return
    if (!sel.ciente_em && !li) {
      setErro('Marque "Li o relatório" para registrar a ciência.')
      return
    }
    if (!sel.ciente_em && faltam > 0) {
      setErro(
        `Responda as ${perguntas.length} perguntas antes de registrar a ciência: ${respondidas} respondida${respondidas === 1 ? '' : 's'}.`
      )
      return
    }
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      /* Grava o que está na tela antes da ciência: o banco confere as
         respostas GRAVADAS, e sem isto quem escrevesse tudo e clicasse
         direto em ciência levaria uma recusa sem entender o motivo. */
      if (!sel.ciente_em && perguntas.length) {
        const limpas: Record<string, string> = {}
        perguntas.forEach((_, i) => {
          const t = (respostas[String(i)] || '').trim()
          if (t) limpas[String(i)] = t
        })
        const { error: erroResp } = await supabase.rpc('responder_relatorio_publicado', {
          p_id: sel.id,
          p_respostas: limpas,
        })
        if (erroResp) throw erroResp
      }

      const { error } = await supabase.rpc('dar_ciencia_relatorio', { p_id: sel.id, p_manifestacao: texto.trim() || null })
      if (error) throw error
      await carregar(meuId)
      setTexto('')
      setAviso(sel.ciente_em ? 'Manifestação registrada.' : 'Ciência registrada. Obrigado.')

      /* O PDF do relatório fechado nasce agora, sem ninguém precisar
         lembrar. Falhar aqui não desfaz a ciência: o botão "Baixar o
         PDF" tenta de novo quando a pessoa quiser. */
      if (!sel.ciente_em) pedirPdf(sel.id).catch(() => {})
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível registrar.')
    } finally {
      setSalvando(false)
    }
  }

  async function baixarPdf() {
    if (!sel || baixando) return
    setBaixando(true)
    setErro('')
    const r = await pedirPdf(sel.id)
    setBaixando(false)
    if (r.erro) {
      setErro(r.erro)
      return
    }
    /* Abre em aba nova: o link já vem com o nome do arquivo e expira
       em poucos minutos. */
    if (r.url) window.open(r.url, '_blank', 'noopener')
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
          {/* O PDF guardado só existe depois da ciência: antes disso a
              liberação ainda pode ser revogada ou refeita. */}
          {sel?.ciente_em && (
            <button className="btn btn-sm" disabled={baixando} onClick={baixarPdf}>
              {baixando ? 'Preparando…' : 'Baixar o PDF guardado'}
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

          {/*
            * SUAS RESPOSTAS, ANTES DA CONVERSA.
            *
            * A conversa individual costumava começar com "como você
            * avalia o seu mês?" perguntado na hora, de improviso, na
            * frente de quem avalia. Respondendo por escrito antes,
            * quem é avaliado chega tendo pensado e a gestão chega
            * tendo lido — a conversa começa do segundo assunto.
            *
            * Sai impresso junto com a ficha: faz parte do registro.
            */}
          {perguntas.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <div className="section-title">Suas respostas</div>
                <span className="rel-sub">
                  {sel.ciente_em
                    ? `${respondidas} de ${perguntas.length} respondidas`
                    : faltam > 0
                      ? `Falta${faltam === 1 ? '' : 'm'} ${faltam} de ${perguntas.length}`
                      : 'Tudo respondido'}
                </span>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {!sel.ciente_em && (
                  <p className="rel-sub nao-imprimir" style={{ margin: 0 }}>
                    Responda antes da conversa. Pode guardar e voltar depois — fecha quando você
                    registrar a ciência.
                  </p>
                )}

                {perguntas.map((q, i) => (
                  <div key={i}>
                    <label
                      htmlFor={'resp-' + i}
                      className="section-title"
                      style={{ display: 'block', marginBottom: 6, lineHeight: 1.4 }}
                    >
                      {i + 1}. {q}
                    </label>
                    {sel.ciente_em ? (
                      <p
                        style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: (respostas[String(i)] || '').trim() ? undefined : 'var(--ink-faint)',
                        }}
                      >
                        {(respostas[String(i)] || '').trim() || 'Sem resposta.'}
                      </p>
                    ) : (
                      <textarea
                        id={'resp-' + i}
                        className="nao-imprimir"
                        rows={3}
                        style={{ width: '100%' }}
                        value={respostas[String(i)] || ''}
                        onChange={(e) =>
                          setRespostas({ ...respostas, [String(i)]: e.target.value })
                        }
                      />
                    )}
                  </div>
                ))}

                {!sel.ciente_em && (
                  <div className="nao-imprimir" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={salvandoResp}
                      onClick={salvarRespostas}
                    >
                      {salvandoResp ? 'Guardando…' : 'Guardar respostas'}
                    </button>
                    {avisoResp && <span className="rel-sub">{avisoResp}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

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
                      disabled={
                        salvando ||
                        (!!sel.ciente_em && !texto.trim()) ||
                        (!sel.ciente_em && !li) ||
                        /* Decisão dele: responder tudo é condição para a
                           ciência. O botão diz por que está apagado logo
                           abaixo, para não virar um botão morto sem
                           explicação. */
                        (!sel.ciente_em && faltam > 0)
                      }
                    >
                      {salvando ? 'Registrando...' : sel.ciente_em ? 'Registrar manifestação' : 'Registrar ciência'}
                    </button>
                  </div>
                  {!sel.ciente_em && faltam > 0 && (
                    <p className="rel-sub">
                      Falta{faltam === 1 ? '' : 'm'} responder {faltam} pergunta
                      {faltam === 1 ? '' : 's'} acima para registrar a ciência.
                    </p>
                  )}
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
