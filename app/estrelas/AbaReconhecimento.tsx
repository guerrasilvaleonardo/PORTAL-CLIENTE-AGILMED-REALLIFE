'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MESES, ROTULO_NOTA, formatarDataHora, hojeBrasilia, medalha } from '@/lib/estrelas'
import {
  ROTULO_ACAO,
  ehPodio,
  fraseMesParcial,
  linhaDeNumeros,
  montarReconhecimento,
  type AcaoReconhecimento,
  type Reconhecimento,
} from '@/lib/reconhecimentoEstrelas'

/*
 * Aba "Reconhecimento do mês" (só gestor e admin).
 * O ranking do mês é congelado no 3º dia útil do mês seguinte (agendamento
 * /api/cron/estrelas-reconhecimento). Aqui o gestor escreve o destaque,
 * revisa e envia os e-mails. Nada sai sem a confirmação dele.
 */

const pad = (n: number) => String(n).padStart(2, '0')

function periodoAnterior(hoje: ReturnType<typeof hojeBrasilia>) {
  const ano = hoje.mes === 1 ? hoje.ano - 1 : hoje.ano
  const mes = hoje.mes === 1 ? 12 : hoje.mes - 1
  return ano + '-' + pad(mes) + '-01'
}

function rotuloPeriodo(periodo: string) {
  const [a, m] = periodo.split('-').map(Number)
  return MESES[m - 1] + ' de ' + a
}

type Edicao = { destaque: string; complemento: string; acao: AcaoReconhecimento }

export default function AbaReconhecimento({ hoje }: { hoje: ReturnType<typeof hojeBrasilia> }) {
  const [periodo, setPeriodo] = useState(periodoAnterior(hoje))
  const [periodos, setPeriodos] = useState<string[]>([])
  const [linhas, setLinhas] = useState<Reconhecimento[]>([])
  const [edicoes, setEdicoes] = useState<Record<number, Edicao>>({})
  const [assinatura, setAssinatura] = useState('Leonardo Guerra')
  const [carregando, setCarregando] = useState(true)
  const [instalado, setInstalado] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [congelando, setCongelando] = useState(false)
  const [versao, setVersao] = useState(0)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data: u } = await supabase.auth.getUser()
      if (u.user) {
        const { data: p } = await supabase.from('profiles').select('nome').eq('id', u.user.id).maybeSingle()
        if (p?.nome) setAssinatura(p.nome)
      }

      const { data: todos, error: e1 } = await supabase
        .from('estrelas_reconhecimentos')
        .select('periodo')
        .order('periodo', { ascending: false })
      if (e1) {
        if (e1.code === '42P01' || /does not exist|schema cache/i.test(e1.message)) {
          setInstalado(false)
          return
        }
        throw e1
      }
      setInstalado(true)
      setPeriodos([...new Set(((todos || []) as any[]).map((t) => String(t.periodo).slice(0, 10)))])

      const { data, error } = await supabase
        .from('estrelas_reconhecimentos')
        .select('*')
        .eq('periodo', periodo)
        .order('posicao')
        .order('nome')
      if (error) throw error

      const lista = ((data || []) as any[]).map((l) => ({
        ...l,
        periodo: String(l.periodo).slice(0, 10),
        media_nota: l.media_nota === null ? null : Number(l.media_nota),
      })) as Reconhecimento[]
      setLinhas(lista)
      setEdicoes(
        Object.fromEntries(
          lista.map((l) => [l.id, { destaque: l.destaque || '', complemento: l.complemento || '', acao: l.acao }])
        )
      )
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar o reconhecimento do mês.')
    } finally {
      setCarregando(false)
    }
  }, [periodo])

  useEffect(() => {
    carregar()
  }, [carregar, versao])

  const opcoesPeriodo = useMemo(() => {
    const base = new Set(periodos)
    base.add(periodoAnterior(hoje))
    return [...base].sort().reverse()
  }, [periodos, hoje])

  function comEdicao(l: Reconhecimento): Reconhecimento {
    const e = edicoes[l.id]
    return e ? { ...l, destaque: e.destaque, complemento: e.complemento, acao: e.acao } : l
  }

  function alterado(l: Reconhecimento) {
    const e = edicoes[l.id]
    if (!e) return false
    return e.destaque !== (l.destaque || '') || e.complemento !== (l.complemento || '') || e.acao !== l.acao
  }

  async function salvar(l: Reconhecimento) {
    const e = edicoes[l.id]
    if (!e) return
    setSalvando(l.id)
    setErro('')
    const { error } = await supabase.rpc('estrelas_reconhecimento_salvar', {
      p_id: l.id,
      p_destaque: e.destaque,
      p_complemento: e.complemento,
      p_acao: e.acao,
    })
    setSalvando(null)
    if (error) {
      setErro(error.message)
      return
    }
    setLinhas((atual) =>
      atual.map((x) =>
        x.id === l.id ? { ...x, destaque: e.destaque.trim() || null, complemento: e.complemento.trim() || null, acao: e.acao } : x
      )
    )
  }

  async function congelar() {
    if (
      !window.confirm(
        'Congelar agora o ranking de ' + rotuloPeriodo(periodo) +
          '? Avaliações que chegarem depois contam para o ano, mas não mudam os e-mails deste mês.'
      )
    )
      return
    setCongelando(true)
    setErro('')
    const { data, error } = await supabase.rpc('estrelas_congelar_mes', { p_mes: periodo })
    setCongelando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setAviso(Number(data) ? 'Ranking congelado: ' + data + ' pessoa(s).' : 'Não há chamados resolvidos neste mês.')
    setVersao((v) => v + 1)
  }

  const prontos = linhas.filter((l) => {
    const r = comEdicao(l)
    return r.situacao === 'rascunho' && r.acao === 'email' && !montarReconhecimento(r, assinatura).pendencias.length
  })
  const pendentes = linhas.filter((l) => {
    const r = comEdicao(l)
    return r.situacao === 'rascunho' && r.acao === 'email' && montarReconhecimento(r, assinatura).pendencias.length > 0
  })
  const naoSalvos = linhas.filter(alterado)

  async function enviar() {
    if (naoSalvos.length) {
      setErro('Salve as alterações antes de enviar: ' + naoSalvos.map((l) => l.nome).join(', ') + '.')
      return
    }
    if (!prontos.length) return
    if (
      !window.confirm(
        'Enviar agora ' + prontos.length + ' e-mail(s) de reconhecimento de ' + rotuloPeriodo(periodo) +
          '? Cada pessoa recebe só o próprio e-mail, com você como remetente.'
      )
    )
      return

    setEnviando(true)
    setErro('')
    setAviso('')
    try {
      const { data: s } = await supabase.auth.getSession()
      const r = await fetch('/api/estrelas/reconhecimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s.session?.access_token || '') },
        body: JSON.stringify({ ids: prontos.map((l) => l.id) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.erro || 'Falha no envio.')
      const falhas = (j.resultado || []).filter((x: any) => !x.enviado)
      setAviso(
        j.enviados + ' e-mail(s) enviado(s).' +
          (falhas.length ? ' Não enviados: ' + falhas.map((f: any) => f.nome + ' (' + f.motivo + ')').join('; ') + '.' : '')
      )
      setVersao((v) => v + 1)
    } catch (e: any) {
      setErro(e?.message || 'Falha no envio.')
    } finally {
      setEnviando(false)
    }
  }

  if (!instalado) {
    return (
      <div className="banner bad">
        O reconhecimento mensal ainda não foi instalado. Rode o arquivo supabase/estrelas-reconhecimento-mensal.sql no
        Supabase.
      </div>
    )
  }

  const mesTerminou = periodo < hoje.iso.slice(0, 8) + '01'
  const enviados = linhas.filter((l) => l.situacao === 'enviado').length

  return (
    <>
      <div className="filters">
        <select value={periodo} onChange={(e) => (setAviso(''), setPeriodo(e.target.value))} aria-label="Mês">
          {opcoesPeriodo.map((p) => (
            <option key={p} value={p}>{rotuloPeriodo(p)}</option>
          ))}
        </select>
        {linhas.length > 0 && (
          <span className="selo-periodo final">
            Congelado em {formatarDataHora(linhas[0].congelado_em)}
          </span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
        O ranking do mês é congelado automaticamente no 3º dia útil do mês seguinte (ou depois do fim do prazo de
        avaliação, se for mais tarde), e você recebe um aviso por e-mail. Escreva o destaque de quem ficou no pódio,
        revise os demais e envie. Cada pessoa recebe só o próprio e-mail, com seus números, e nunca a posição no ano.
      </p>

      {erro && <div className="banner bad">{erro}</div>}
      {aviso && <div className="banner good">{aviso}</div>}

      {carregando ? (
        <div className="empty-state">Carregando...</div>
      ) : !linhas.length ? (
        <div className="panel">
          <div className="panel-body" style={{ display: 'grid', gap: 10 }}>
            <strong>{rotuloPeriodo(periodo)} ainda não foi congelado.</strong>
            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              {mesTerminou
                ? 'O congelamento automático acontece no 3º dia útil do mês seguinte. Se precisar adiantar, congele agora.'
                : 'O mês ainda não terminou.'}
            </span>
            {mesTerminou && (
              <div>
                <button type="button" className="btn btn-sm" onClick={congelar} disabled={congelando}>
                  {congelando ? 'Congelando...' : 'Congelar agora'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><div className="num">{linhas.length}</div><div className="lbl">Pessoas no mês</div></div>
            <div className="stat"><div className="num">{prontos.length}</div><div className="lbl">Prontos para enviar</div></div>
            <div className={'stat' + (pendentes.length ? ' warn' : '')}><div className="num">{pendentes.length}</div><div className="lbl">Faltam informações</div></div>
            <div className="stat"><div className="num">{linhas.filter((l) => l.acao === 'conversa').length}</div><div className="lbl">Conversa pessoal</div></div>
            <div className="stat"><div className="num">{enviados}</div><div className="lbl">Enviados</div></div>
          </div>

          {linhas.map((l) => (
            <CartaoPessoa
              key={l.id}
              linha={l}
              edicao={edicoes[l.id]}
              assinatura={assinatura}
              alterado={alterado(l)}
              salvando={salvando === l.id}
              onEditar={(e) => setEdicoes((atual) => ({ ...atual, [l.id]: { ...atual[l.id], ...e } }))}
              onSalvar={() => salvar(l)}
            />
          ))}

          <div className="panel">
            <div className="panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={enviar}
                disabled={enviando || !prontos.length}
              >
                {enviando ? 'Enviando...' : 'Enviar ' + prontos.length + ' e-mail(s) prontos'}
              </button>
              <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                {naoSalvos.length
                  ? 'Há alterações não salvas.'
                  : pendentes.length
                    ? pendentes.length + ' e-mail(s) ainda sem as informações obrigatórias ficam para depois.'
                    : 'Remetente: ' + assinatura + ' (respostas vão para o seu e-mail).'}
              </span>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function CartaoPessoa({
  linha,
  edicao,
  assinatura,
  alterado,
  salvando,
  onEditar,
  onSalvar,
}: {
  linha: Reconhecimento
  edicao: Edicao | undefined
  assinatura: string
  alterado: boolean
  salvando: boolean
  onEditar: (e: Partial<Edicao>) => void
  onSalvar: () => void
}) {
  const e = edicao || { destaque: linha.destaque || '', complemento: linha.complemento || '', acao: linha.acao }
  const atual: Reconhecimento = { ...linha, ...e }
  const email = montarReconhecimento(atual, assinatura)
  const enviado = linha.situacao === 'enviado'
  const podio = ehPodio(linha)

  return (
    <section className="panel">
      <div className="panel-head" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16 }}>
          {medalha(linha.posicao)} {linha.posicao}º · {linha.nome}
        </strong>
        {linha.empatado && <span className="pill">empate</span>}
        <span className="pill">{linha.total} estrela(s)</span>
        <div style={{ flex: 1 }} />
        {enviado ? (
          <span className="pill" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>
            Enviado em {formatarDataHora(linha.enviado_em)}
          </span>
        ) : (
          <select
            value={e.acao}
            onChange={(ev) => onEditar({ acao: ev.target.value as AcaoReconhecimento })}
            aria-label={'O que fazer com ' + linha.nome}
          >
            {(Object.keys(ROTULO_ACAO) as AcaoReconhecimento[]).map((a) => (
              <option key={a} value={a}>{ROTULO_ACAO[a]}</option>
            ))}
          </select>
        )}
      </div>

      <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{linhaDeNumeros(linha)}</div>

        {linha.motivo_conversa && (
          <div className="banner" style={{ background: 'var(--amber-tint)', color: 'var(--amber)', fontSize: 13 }}>
            Sugerido para conversa pessoal: {linha.motivo_conversa}. Você decide se envia o e-mail.
          </div>
        )}

        {linha.erro_envio && !enviado && (
          <div className="banner bad" style={{ fontSize: 13 }}>Última tentativa de envio falhou: {linha.erro_envio}</div>
        )}

        {enviado ? (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Ver o e-mail enviado</summary>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <strong>{linha.assunto_enviado}</strong>
            </div>
          </details>
        ) : (
          e.acao === 'email' && (
            <>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 700 }}>
                Destaque do mês {podio ? '(obrigatório)' : '(opcional)'}
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={e.destaque}
                  onChange={(ev) => onEditar({ destaque: ev.target.value })}
                  placeholder={
                    podio
                      ? 'Um resultado que a pessoa reconheça como fruto do próprio trabalho. Ex.: o chamado #493, que você resolveu em 2 horas e o cliente avaliou como Excelente.'
                      : 'Opcional. Ex.: Quero destacar seu trabalho no chamado #480. Sua atuação ajudou o cliente a regularizar o PGR antes da fiscalização.'
                  }
                  style={{ fontWeight: 400, font: 'inherit', padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 700 }}>
                Frase extra (opcional, entra logo depois dos números)
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={e.complemento}
                  onChange={(ev) => onEditar({ complemento: ev.target.value })}
                  placeholder="Ex.: mês parcial por entrada, férias ou afastamento (sem citar o motivo)."
                  style={{ fontWeight: 400, font: 'inherit', padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}
                />
              </label>
              <div>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEditar({ complemento: fraseMesParcial() })}>
                  Inserir frase de mês parcial
                </button>
              </div>

              <ChamadosDoMes linha={linha} />

              <details open={podio}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Prévia do e-mail</summary>
                <div
                  style={{
                    marginTop: 8,
                    padding: 14,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 8 }}>
                    Para: {linha.email || 'sem e-mail cadastrado'} · Assunto: <strong>{email.assunto}</strong>
                  </div>
                  {email.paragrafos.map((p, i) =>
                    p === '§NUMEROS' ? (
                      <p key={i} style={{ margin: '0 0 10px', padding: '8px 12px', borderLeft: '3px solid var(--primary)', background: 'var(--surface-sunken)', fontSize: 13 }}>
                        {email.numeros}
                      </p>
                    ) : (
                      <p key={i} style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{p}</p>
                    )
                  )}
                </div>
              </details>

              {email.pendencias.length > 0 && (
                <div className="banner bad" style={{ fontSize: 13 }}>{email.pendencias.join(' ')}</div>
              )}
            </>
          )
        )}

        {!enviado && (
          <div>
            <button type="button" className="btn btn-sm" onClick={onSalvar} disabled={!alterado || salvando}>
              {salvando ? 'Salvando...' : alterado ? 'Salvar' : 'Salvo'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

/* Chamados resolvidos pela pessoa no mês, com avaliação e comentário do cliente. */
function ChamadosDoMes({ linha }: { linha: Reconhecimento }) {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<any[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto || itens) return
    let ativo = true
    ;(async () => {
      try {
        const [a, m] = linha.periodo.split('-').map(Number)
        const inicio = linha.periodo + 'T00:00:00-04:00'
        const proximo = (m === 12 ? a + 1 + '-01' : a + '-' + pad(m + 1)) + '-01T00:00:00-04:00'
        const { data, error } = await supabase
          .from('estrelas_lancamentos')
          .select('chamado_id, resolvido_em, dentro_prazo, nota, situacao, chamados(numero, assunto)')
          .eq('atendente_id', linha.atendente_id)
          .eq('situacao', 'valida')
          .gte('resolvido_em', inicio)
          .lt('resolvido_em', proximo)
          .order('resolvido_em')
        if (error) throw error
        const ids = ((data || []) as any[]).map((d) => d.chamado_id)
        const { data: av } = ids.length
          ? await supabase.from('chamado_avaliacoes').select('chamado_id, comentario').in('chamado_id', ids)
          : { data: [] as any[] }
        const comentarios = new Map(((av || []) as any[]).map((x) => [x.chamado_id, x.comentario]))
        if (ativo) setItens(((data || []) as any[]).map((d) => ({ ...d, comentario: comentarios.get(d.chamado_id) || '' })))
      } catch (e: any) {
        if (ativo) setErro(e?.message || 'Erro ao carregar os chamados.')
      }
    })()
    return () => {
      ativo = false
    }
  }, [aberto, itens, linha])

  return (
    <details onToggle={(ev) => setAberto((ev.target as HTMLDetailsElement).open)}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
        Chamados do mês ({linha.resolvidos}) para escolher o destaque
      </summary>
      <div style={{ marginTop: 8, display: 'grid', gap: 6, fontSize: 13 }}>
        {erro && <div className="banner bad">{erro}</div>}
        {!itens && !erro && <span style={{ color: 'var(--ink-muted)' }}>Carregando...</span>}
        {itens?.map((c) => (
          <div key={c.chamado_id} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
            <Link href={'/atendimento/' + c.chamado_id} target="_blank" style={{ fontWeight: 700 }}>
              #{c.chamados?.numero ?? '—'} {c.chamados?.assunto || ''}
            </Link>
            <div style={{ color: 'var(--ink-muted)' }}>
              {c.dentro_prazo === true ? 'No prazo' : c.dentro_prazo === false ? 'Fora do prazo' : 'Sem prazo'}
              {c.nota ? ' · Cliente: ' + ROTULO_NOTA[c.nota] : ' · Sem avaliação'}
              {' · resolvido em ' + formatarDataHora(c.resolvido_em)}
            </div>
            {c.comentario && <div style={{ marginTop: 4, fontStyle: 'italic' }}>“{c.comentario}”</div>}
          </div>
        ))}
        {itens && !itens.length && <span style={{ color: 'var(--ink-muted)' }}>Nenhum chamado válido no mês.</span>}
      </div>
    </details>
  )
}
