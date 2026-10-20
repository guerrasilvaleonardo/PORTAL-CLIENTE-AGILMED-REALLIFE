'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  MESES,
  ROTULO_NOTA,
  avisarAtualizacao,
  carregarConfig,
  carregarRanking,
  definirEfeitos,
  efeitosLigados,
  formatarData,
  formatarDataHora,
  hojeBrasilia,
  limitesAno,
  limitesMes,
  media,
  medalha,
  percentual,
  rotuloMedalha,
  type ConfigEstrelas,
  type Fechamento,
  type LinhaRanking,
} from '@/lib/estrelas'
import './estrelas.css'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const ATUALIZAR_MS = 60000

type Aba = 'mensal' | 'anual' | 'meu' | 'gestao'

export default function EstrelasPage() {
  const hoje = useMemo(() => hojeBrasilia(), [])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [instalado, setInstalado] = useState(true)
  const [meuId, setMeuId] = useState('')
  const [ehGestor, setEhGestor] = useState(false)
  const [cfg, setCfg] = useState<ConfigEstrelas | null>(null)
  const [aba, setAba] = useState<Aba>('mensal')
  const [efeitos, setEfeitos] = useState(true)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    setEfeitos(efeitosLigados())
    try {
      const p = new URLSearchParams(window.location.search).get('aba')
      if (p === 'mensal' || p === 'anual' || p === 'meu' || p === 'gestao') setAba(p)
    } catch {
      /* ignora */
    }
  }, [])

  /* Atualização automática: a cada minuto, ao voltar para a aba e após ações. */
  useEffect(() => {
    const bump = () => setVersao((v) => v + 1)
    const t = window.setInterval(bump, ATUALIZAR_MS)
    window.addEventListener('focus', bump)
    window.addEventListener('estrelas-atualizadas', bump)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', bump)
      window.removeEventListener('estrelas-atualizadas', bump)
    }
  }, [])

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
          return
        }

        const { data: perfil } = await supabase.from('profiles').select('perfil').eq('id', user.id).single()
        if (!PERFIS_INTERNOS.includes(perfil?.perfil || '')) {
          window.location.href = '/'
          return
        }

        const config = await carregarConfig()
        if (!ativo) return

        setMeuId(user.id)
        setEhGestor(perfil?.perfil === 'gestor' || perfil?.perfil === 'admin')
        setInstalado(!!config)
        setCfg(config)
      } catch (e: any) {
        if (ativo) setErro(e?.message || 'Não foi possível carregar o programa de estrelas.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [versao])

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'mensal', rotulo: 'Mensal' },
    { id: 'anual', rotulo: 'Anual' },
    { id: 'meu', rotulo: ehGestor ? 'Painel individual' : 'Meu painel' },
    ...(ehGestor ? [{ id: 'gestao' as Aba, rotulo: 'Gestão do programa' }] : []),
  ]

  return (
    <div className={'app' + (efeitos ? '' : ' sem-efeitos')}>
      <div>
        <div className="section-title">Atendimento</div>
        <h1 style={{ fontSize: 30, marginTop: 6 }}>
          <span className="estrela-ouro" aria-hidden="true">★</span> Programa de estrelas
        </h1>
        <p style={{ margin: '8px 0 0', color: 'var(--ink-muted)', fontSize: 14 }}>
          Até {(cfg?.estrelas_prazo ?? 1) + (cfg?.bonus_excelente ?? 2)} estrelas por chamado:{' '}
          {cfg?.estrelas_prazo ?? 1} por resolver dentro do prazo e as estrelas da avaliação do cliente
          (Ruim +{cfg?.bonus_ruim ?? 0}, Bom +{cfg?.bonus_bom ?? 1}, Excelente +{cfg?.bonus_excelente ?? 2}).
        </p>
      </div>

      <div className="filters">
        <Link href="/atendimento" className="btn btn-sm">Quadro de chamados</Link>
        <Link href="/atendimento/desempenho" className="btn btn-sm">Desempenho da equipe</Link>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={efeitos}
            onChange={(e) => {
              setEfeitos(e.target.checked)
              definirEfeitos(e.target.checked)
            }}
          />
          Efeitos visuais
        </label>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {!carregando && !instalado && (
        <div className="banner bad">
          O programa de estrelas ainda não foi instalado no banco de dados. Rode o arquivo
          supabase/programa-estrelas.sql no Supabase.
        </div>
      )}

      {!carregando && instalado && cfg && !cfg.ativo && (
        <div className="banner" style={{ background: 'var(--amber-tint)', color: 'var(--amber)' }}>
          O programa está <strong>desativado</strong>. Nenhuma estrela é concedida até um gestor ativá-lo
          {ehGestor ? ' na aba "Gestão do programa".' : '.'}
        </div>
      )}

      {instalado && !carregando && (
        <details className="panel como-funciona">
          <summary className="panel-head" style={{ cursor: 'pointer' }}>
            <span className="section-title">Como funciona o programa</span>
          </summary>
          <div className="panel-body">
            <TextoComoFunciona cfg={cfg} />
          </div>
        </details>
      )}

      {instalado && (
        <>
          <div className="estrelas-abas" role="tablist" aria-label="Visões do programa">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
              >
                {a.rotulo}
              </button>
            ))}
          </div>

          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : aba === 'mensal' ? (
            <AbaMensal hoje={hoje} meuId={meuId} cfg={cfg} versao={versao} />
          ) : aba === 'anual' ? (
            <AbaAnual hoje={hoje} meuId={meuId} versao={versao} />
          ) : aba === 'meu' ? (
            <AbaMeuPainel hoje={hoje} meuId={meuId} ehGestor={ehGestor} versao={versao} />
          ) : (
            <AbaGestao hoje={hoje} cfg={cfg} versao={versao} onSalvo={() => setVersao((v) => v + 1)} />
          )}
        </>
      )}

      <div className="footnote">
        Ranking por estrelas acumuladas: o total também depende do volume de chamados resolvidos. A nota do
        cliente (1 a 3) é diferente das estrelas do ranking. Comentários de clientes não aparecem no ranking.
        Prazos em horas úteis (seg–sex, 8h–12h e 13h–17h, horário de Porto Velho).
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TabelaRanking({ linhas, meuId }: { linhas: LinhaRanking[]; meuId: string }) {
  const grade = '70px minmax(140px, 1.6fr) repeat(9, minmax(78px, 1fr))'

  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <div className="trow thead" style={{ gridTemplateColumns: grade, minWidth: 1050 }}>
          <span>Posição</span>
          <span>Atendente</span>
          <span style={{ textAlign: 'right' }} title="Estrelas por cumprimento do prazo">★ Prazo</span>
          <span style={{ textAlign: 'right' }} title="Estrelas pela avaliação do cliente">★ Avaliação</span>
          <span style={{ textAlign: 'right' }}>★ Total</span>
          <span style={{ textAlign: 'right' }}>Resolvidos</span>
          <span style={{ textAlign: 'right' }} title="Dentro / fora do prazo">Dentro / fora</span>
          <span style={{ textAlign: 'right' }}>% no prazo</span>
          <span style={{ textAlign: 'right' }}>Avaliações</span>
          <span style={{ textAlign: 'right' }}>% avaliados</span>
          <span style={{ textAlign: 'right' }} title="Nota do cliente, escala de 1 a 3">Média (1–3)</span>
        </div>

        {linhas.length === 0 ? (
          <div className="empty-state">Nenhum chamado resolvido com estrelas neste período.</div>
        ) : (
          linhas.map((l) => (
            <div
              key={l.atendente_id}
              className={'trow' + (l.atendente_id === meuId ? ' linha-minha' : '')}
              style={{ gridTemplateColumns: grade, minWidth: 1050 }}
            >
              <span className="posicao-cel">
                {l.posicao}º {medalha(l.posicao) && <span aria-label={'Medalha de ' + rotuloMedalha(l.posicao)}>{medalha(l.posicao)}</span>}
              </span>
              <span className="tname">
                {l.nome}
                {l.atendente_id === meuId && <span className="pill flat" style={{ marginLeft: 6, fontSize: 10 }}>você</span>}
              </span>
              <span className="mono" style={{ textAlign: 'right' }}>{l.estrelas_prazo}</span>
              <span className="mono" style={{ textAlign: 'right' }}>{l.estrelas_avaliacao}</span>
              <span className="mono estrela-ouro" style={{ textAlign: 'right', fontWeight: 800 }}>{l.total} ★</span>
              <span className="mono" style={{ textAlign: 'right' }}>{l.resolvidos}</span>
              <span className="mono" style={{ textAlign: 'right' }}>{l.dentro_prazo} / {l.fora_prazo}</span>
              <span className="mono" style={{ textAlign: 'right' }}>{percentual(l.dentro_prazo, l.dentro_prazo + l.fora_prazo)}</span>
              <span className="mono" style={{ textAlign: 'right' }}>{l.avaliados}</span>
              <span className="mono" style={{ textAlign: 'right' }}>{percentual(l.avaliados, l.resolvidos)}</span>
              <span className="mono" style={{ textAlign: 'right' }}>{media(l.media_nota)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Podio({ linhas }: { linhas: LinhaRanking[] }) {
  const topo = linhas.filter((l) => l.posicao <= 3 && l.total > 0)
  if (topo.length === 0) return null

  return (
    <div className="podio">
      {topo.map((l) => (
        <div key={l.atendente_id} className={'podio-card p' + l.posicao}>
          <div className="podio-medalha" aria-hidden="true">{medalha(l.posicao)}</div>
          <div className="podio-detalhe" style={{ fontWeight: 700 }}>
            {l.posicao}º lugar · medalha de {rotuloMedalha(l.posicao)}
          </div>
          <div className="podio-nome">{l.nome}</div>
          <div className="podio-total">{l.total} ★</div>
          <div className="podio-detalhe">
            {l.estrelas_prazo} pelo prazo · {l.estrelas_avaliacao} pela avaliação · {l.resolvidos} resolvido(s)
          </div>
        </div>
      ))}
    </div>
  )
}

function AbaMensal({
  hoje,
  meuId,
  cfg,
  versao,
}: {
  hoje: ReturnType<typeof hojeBrasilia>
  meuId: string
  cfg: ConfigEstrelas | null
  versao: number
}) {
  const [ano, setAno] = useState(hoje.ano)
  const [mes, setMes] = useState(hoje.mes)
  const [linhas, setLinhas] = useState<LinhaRanking[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    const { inicio, fim } = limitesMes(ano, mes)
    carregarRanking(inicio, fim)
      .then((r) => ativo && (setLinhas(r), setErro('')))
      .catch((e) => ativo && setErro(e?.message || 'Erro ao carregar o ranking.'))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [ano, mes, versao])

  /* Provisório enquanto ainda cabem avaliações de chamados do mês. */
  const { fim } = limitesMes(ano, mes)
  const limiteAvaliacoes = new Date(fim + 'T23:59:59-03:00')
  limiteAvaliacoes.setDate(limiteAvaliacoes.getDate() + (cfg?.prazo_avaliacao_dias || 0))
  const provisorio = new Date() <= limiteAvaliacoes

  const anos = Array.from({ length: 4 }, (_, i) => hoje.ano - i)

  return (
    <>
      <div className="filters">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} aria-label="Mês">
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <span className={'selo-periodo ' + (provisorio ? 'provisorio' : 'final')}>
          {provisorio ? 'Resultado provisório' : 'Resultado do mês consolidado'}
        </span>
      </div>

      <div className="section-title">Ranking por estrelas acumuladas — {MESES[mes - 1]} de {ano}</div>
      {erro && <div className="banner bad">{erro}</div>}
      {carregando ? <div className="empty-state">Carregando...</div> : (
        <>
          <Podio linhas={linhas} />
          <TabelaRanking linhas={linhas} meuId={meuId} />
        </>
      )}
      {provisorio && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
          Provisório: chamados resolvidos no mês ainda podem receber avaliação
          {cfg?.prazo_avaliacao_dias ? ' (até ' + cfg.prazo_avaliacao_dias + ' dia(s) após a resolução)' : ''}. O bônus
          entra no mês da resolução, nunca no mês da avaliação.
        </p>
      )}
    </>
  )
}

function AbaAnual({
  hoje,
  meuId,
  versao,
}: {
  hoje: ReturnType<typeof hojeBrasilia>
  meuId: string
  versao: number
}) {
  const [ano, setAno] = useState(hoje.ano)
  const [linhas, setLinhas] = useState<LinhaRanking[]>([])
  const [fech, setFech] = useState<Fechamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setCarregando(true)

    async function carregar() {
      try {
        const { data: f } = await supabase
          .from('estrelas_fechamentos')
          .select('ano, data_fechamento, fechado_em, classificacao')
          .eq('ano', ano)
          .maybeSingle()

        const fechamento = (f as Fechamento) || null
        let r: LinhaRanking[]
        if (fechamento?.fechado_em && Array.isArray(fechamento.classificacao)) {
          r = fechamento.classificacao
        } else {
          const { inicio, fim } = limitesAno(ano)
          r = await carregarRanking(inicio, fim)
        }
        if (!ativo) return
        setFech(fechamento)
        setLinhas(r)
        setErro('')
      } catch (e: any) {
        if (ativo) setErro(e?.message || 'Erro ao carregar o ranking anual.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [ano, versao])

  const fechado = !!fech?.fechado_em
  const anos = Array.from({ length: 4 }, (_, i) => hoje.ano - i)
  const empatadosNoTopo = linhas.filter((l) => l.posicao === 1).length

  return (
    <>
      <div className="filters">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <span className={'selo-periodo ' + (fechado ? 'final' : 'provisorio')}>
          {fechado
            ? 'Classificação final (fechada em ' + formatarDataHora(fech!.fechado_em) + ')'
            : 'Resultado provisório' + (fech ? ' · fechamento em ' + formatarData(fech.data_fechamento) : '')}
        </span>
      </div>

      <div className="section-title">Ranking por estrelas acumuladas — janeiro a dezembro de {ano}</div>
      {erro && <div className="banner bad">{erro}</div>}
      {carregando ? <div className="empty-state">Carregando...</div> : (
        <>
          <Podio linhas={linhas} />
          <TabelaRanking linhas={linhas} meuId={meuId} />
        </>
      )}
      {empatadosNoTopo > 1 && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Empate no 1º lugar: a premiação de fim de ano é compartilhada entre os empatados.
        </p>
      )}
      {fechado && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
          Esta é a versão final usada na premiação. Ajustes posteriores não alteram a classificação fechada.
        </p>
      )}
    </>
  )
}

function AbaMeuPainel({
  hoje,
  meuId,
  ehGestor,
  versao,
}: {
  hoje: ReturnType<typeof hojeBrasilia>
  meuId: string
  ehGestor: boolean
  versao: number
}) {
  const [pessoa, setPessoa] = useState(meuId)
  const [equipe, setEquipe] = useState<{ id: string; nome: string }[]>([])
  const [mensal, setMensal] = useState<LinhaRanking | null>(null)
  const [anual, setAnual] = useState<LinhaRanking | null>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [eventos, setEventos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!ehGestor) return
    supabase
      .from('profiles')
      .select('id, nome')
      .in('perfil', PERFIS_INTERNOS)
      .order('nome')
      .then(({ data }) => setEquipe(((data || []) as any[]).map((p) => ({ id: p.id, nome: p.nome || 'Sem nome' }))))
  }, [ehGestor])

  useEffect(() => {
    let ativo = true
    setCarregando(true)

    async function carregar() {
      const m = limitesMes(hoje.ano, hoje.mes)
      const a = limitesAno(hoje.ano)
      const [rm, ra] = await Promise.all([carregarRanking(m.inicio, m.fim), carregarRanking(a.inicio, a.fim)])

      const { data: h } = await supabase
        .from('estrelas_lancamentos')
        .select('chamado_id, resolvido_em, dentro_prazo, estrelas_prazo, nota, estrelas_avaliacao, situacao, motivo, chamados(numero, assunto)')
        .eq('atendente_id', pessoa)
        .gte('resolvido_em', a.inicio + 'T00:00:00-03:00')
        .order('resolvido_em', { ascending: false })
        .limit(300)

      const { data: ev } = await supabase
        .from('estrelas_eventos')
        .select('id, chamado_id, tipo, motivo, created_at, chamados(numero)')
        .eq('atendente_id', pessoa)
        .in('tipo', ['suspensa', 'restabelecida', 'estornada', 'prazo_decidido'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (!ativo) return
      setMensal(rm.find((l) => l.atendente_id === pessoa) || null)
      setAnual(ra.find((l) => l.atendente_id === pessoa) || null)
      setHistorico((h || []) as any[])
      setEventos((ev || []) as any[])
      setCarregando(false)
    }

    carregar().catch(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [pessoa, hoje, versao])

  const cartoes = [
    { rotulo: 'Minhas estrelas no mês', valor: mensal ? mensal.total + ' ★' : '0 ★' },
    { rotulo: 'Minhas estrelas no ano', valor: anual ? anual.total + ' ★' : '0 ★' },
    { rotulo: 'Minha posição mensal', valor: mensal ? mensal.posicao + 'º ' + medalha(mensal.posicao) : 'Sem dados' },
    { rotulo: 'Minha posição anual', valor: anual ? anual.posicao + 'º ' + medalha(anual.posicao) : 'Sem dados' },
    { rotulo: 'Minha avaliação média (1 a 3)', valor: media(anual?.media_nota) },
  ]

  const grade = '90px 120px minmax(160px, 2fr) 130px 120px 90px 100px 80px minmax(150px, 1.5fr)'

  return (
    <>
      {ehGestor && (
        <div className="filters">
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label="Atendente">
            {equipe.map((p) => (
              <option key={p.id} value={p.id}>{p.id === meuId ? p.nome + ' (você)' : p.nome}</option>
            ))}
          </select>
        </div>
      )}

      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {cartoes.map((c) => (
          <div key={c.rotulo} className="stat cartao-estrela">
            <div className="num" style={{ fontSize: 22 }}>{carregando ? '—' : c.valor}</div>
            <div className="lbl">{c.rotulo}{pessoa !== meuId ? ' (selecionado)' : ''}</div>
          </div>
        ))}
      </div>

      <div className="section-title">Histórico de {hoje.ano}</div>
      <div className="table-wrap">
        <div className="table-scroll">
          <div className="trow thead" style={{ gridTemplateColumns: grade, minWidth: 1100 }}>
            <span>Chamado</span>
            <span>Resolução</span>
            <span>Assunto</span>
            <span>Prazo</span>
            <span>Nota do cliente</span>
            <span style={{ textAlign: 'right' }}>★ Prazo</span>
            <span style={{ textAlign: 'right' }}>★ Avaliação</span>
            <span>Situação</span>
            <span>Motivo</span>
          </div>
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : historico.length === 0 ? (
            <div className="empty-state">Nenhum chamado com estrelas neste ano.</div>
          ) : (
            historico.map((h) => (
              <Link
                key={h.chamado_id}
                href={'/atendimento/' + h.chamado_id}
                className="trow"
                style={{ gridTemplateColumns: grade, minWidth: 1100, color: 'inherit', textDecoration: 'none' }}
              >
                <span className="tcode">#{h.chamados?.numero ?? '—'}</span>
                <span className="tmuted">{formatarDataHora(h.resolvido_em)}</span>
                <span>{h.chamados?.assunto || '—'}</span>
                <span>
                  {h.dentro_prazo === null ? 'Sem prazo' : h.dentro_prazo ? '✓ Dentro do prazo' : '✗ Fora do prazo'}
                </span>
                <span>{h.nota ? h.nota + ' — ' + ROTULO_NOTA[h.nota] : 'Sem avaliação'}</span>
                <span className="mono" style={{ textAlign: 'right' }}>{h.estrelas_prazo}</span>
                <span className="mono" style={{ textAlign: 'right' }}>+{h.estrelas_avaliacao}</span>
                <span>
                  <span className={'pill ' + (h.situacao === 'valida' ? 'good' : h.situacao === 'suspensa' ? 'warn' : 'bad')}>
                    {h.situacao === 'valida' ? 'Válida' : h.situacao === 'suspensa' ? 'Suspensa' : 'Estornada'}
                  </span>
                </span>
                <span className="tmuted" style={{ fontSize: 12 }}>{h.motivo || ''}</span>
              </Link>
            ))
          )}
        </div>
      </div>

      {eventos.length > 0 && (
        <>
          <div className="section-title">Suspensões, estornos e ajustes</div>
          <div className="panel">
            <div className="panel-body">
              {eventos.map((e) => (
                <div key={e.id} style={{ fontSize: 13 }}>
                  <strong>{formatarDataHora(e.created_at)}</strong> · chamado #{e.chamados?.numero ?? '—'} ·{' '}
                  {{ suspensa: 'Suspensa', restabelecida: 'Restabelecida', estornada: 'Estornada', prazo_decidido: 'Prazo decidido pelo gestor' }[e.tipo as string] || e.tipo}
                  {e.motivo ? ' — ' + e.motivo : ''}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

/* Texto explicativo do programa (mesmo texto para toda a equipe). */
function TextoComoFunciona({ cfg }: { cfg: ConfigEstrelas | null }) {
  const ep = cfg?.estrelas_prazo ?? 1
  const ruim = cfg?.bonus_ruim ?? 0
  const bom = cfg?.bonus_bom ?? 1
  const exc = cfg?.bonus_excelente ?? 2
  const max = ep + exc
  const prazoAval = cfg?.prazo_avaliacao_dias
  const alerta = cfg?.alerta_prazo_horas ?? 1
  const item = { margin: '0 0 6px' }
  const bloco = { margin: '0 0 14px' }
  const titulo = { fontSize: 15, margin: '0 0 6px' }

  return (
    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
      <div style={bloco}>
        <h3 style={titulo}>1. Quantas estrelas cada chamado vale</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={item}>
            <strong>{ep} estrela(s)</strong> quando o chamado é resolvido dentro do prazo do SLA. Resolver
            exatamente no limite conta como dentro do prazo.
          </li>
          <li style={item}>
            Bônus pela avaliação do cliente: <strong>Excelente +{exc}</strong>, <strong>Bom +{bom}</strong>,
            <strong> Ruim +{ruim}</strong>; sem avaliação +0.
          </li>
          <li style={item}>Máximo por chamado: <strong>{max} estrelas</strong>.</li>
          <li style={item}>
            A nota do cliente (1 = Ruim, 2 = Bom, 3 = Excelente) é diferente da quantidade de estrelas do
            ranking.
          </li>
        </ul>
      </div>

      <div style={bloco}>
        <h3 style={titulo}>2. Prazo</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={item}>
            O prazo é o mesmo SLA do portal, em horas úteis: segunda a sexta, 8h–12h e 13h–17h, horário de
            Porto Velho (RO). Feriados cadastrados no calendário do SLA não contam hora útil, e a extensão de prazo que o feriado gera já entra autorizada (não tira estrela). Todos os horários do portal aparecem no horário de
            Porto Velho.
          </li>
          <li style={item}>
            Em “Aguardando cliente” quem espera é o atendente: o SLA pausa automaticamente. Quando o cliente
            responde, o chamado volta sozinho para “Em atendimento” e o relógio volta a contar. O prazo é
            estendido só pelas horas úteis da espera.
          </li>
          <li style={item}>
            No quadro, o chamado pisca em <strong>vermelho com “Fora do prazo”</strong> quando atrasa e fica
            <strong> amarelo com “Próximo do prazo”</strong> quando falta {alerta}h útil(eis) ou menos.
          </li>
          <li style={item}>
            Se o prazo for estendido sem mudança de status (por exemplo, troca de prioridade) ou pelo tempo em
            “Atendimento suspenso”, a extensão só vale para as estrelas se um gestor autorizar. Ela nunca vale se o
            prazo antigo já tinha vencido (na suspensão, conta o momento em que ela começou).
          </li>
          <li style={item}>O horário de resolução é o do servidor, não o do computador de quem resolveu.</li>
        </ul>
      </div>

      <div style={bloco}>
        <h3 style={titulo}>3. Avaliação do cliente</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={item}>
            Só quem abriu o chamado avalia, uma única vez, logado no portal, depois que o chamado é resolvido.
          </li>
          <li style={item}>
            {prazoAval
              ? 'O cliente tem ' + prazoAval + ' dia(s) após a resolução para avaliar.'
              : 'O prazo para o cliente avaliar ainda não foi definido pela gestão.'}
          </li>
          <li style={item}>
            O bônus entra no mês em que o chamado foi resolvido, mesmo que a avaliação chegue depois.
          </li>
          <li style={item}>
            Avaliações Ruins são acompanhadas pela gestão de forma reservada. Comentários de clientes não
            aparecem no ranking.
          </li>
        </ul>
      </div>

      <div style={bloco}>
        <h3 style={titulo}>4. Reaberturas, transferências e correções</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={item}>Cada chamado gera no máximo um lançamento. Repetir ações ou atualizar a página não duplica estrelas.</li>
          <li style={item}>
            Chamado reaberto: as estrelas ficam <strong>suspensas</strong>. Ao ser resolvido de novo, a pontuação é
            recalculada com a nova resolução, sem gerar uma segunda concessão.
          </li>
          <li style={item}>
            As estrelas são de quem era responsável quando o chamado foi resolvido. Transferir depois disso não
            move as estrelas.
          </li>
          <li style={item}>
            O gestor pode <strong>estornar</strong> as estrelas de um chamado, ou restabelecê-las, sempre com
            justificativa registrada no histórico.
          </li>
        </ul>
      </div>

      <div style={{ margin: 0 }}>
        <h3 style={titulo}>5. Ranking e fechamento</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={item}>
            Ranking mensal e anual pela soma das estrelas. O total também depende do volume de chamados
            resolvidos. Empates ficam na mesma posição.
          </li>
          <li style={item}>
            No fim do ano, na data definida pela gestão, a classificação anual é fechada e congelada. É essa
            versão que vale para a premiação.
          </li>
          <li style={item}>
            Mudanças nas regras valem só para novas concessões. Chamados já pontuados mantêm a regra da época.
          </li>
          <li style={item}>
            Nenhuma estrela é concedida enquanto o programa estiver desativado ou para chamados resolvidos antes
            da data inicial.
          </li>
        </ul>
      </div>
    </div>
  )
}

/* Como os dados atuais estão montados (visão da gestão). */
function DadosAtuais({
  hoje,
  cfg,
  fechamentos,
  pendentes,
  versao,
}: {
  hoje: ReturnType<typeof hojeBrasilia>
  cfg: ConfigEstrelas | null
  fechamentos: Fechamento[]
  pendentes: number
  versao: number
}) {
  const [lanc, setLanc] = useState<any[] | null>(null)
  const [notas, setNotas] = useState<number[] | null>(null)

  useEffect(() => {
    let ativoEfeito = true
    async function carregar() {
      const [{ data: l }, { data: n }] = await Promise.all([
        supabase.from('estrelas_lancamentos').select('situacao, estrelas_prazo, estrelas_avaliacao, dentro_prazo').range(0, 9999),
        supabase.from('chamado_avaliacoes').select('nota').range(0, 9999),
      ])
      if (!ativoEfeito) return
      setLanc((l || []) as any[])
      setNotas(((n || []) as any[]).map((x) => Number(x.nota)))
    }
    carregar()
    return () => {
      ativoEfeito = false
    }
  }, [versao])

  const fech = fechamentos.find((f) => f.ano === hoje.ano)
  const validos = (lanc || []).filter((x) => x.situacao === 'valida')
  const suspensos = (lanc || []).filter((x) => x.situacao === 'suspensa').length
  const estornados = (lanc || []).filter((x) => x.situacao === 'estornada').length
  const estrelasPrazo = validos.reduce((t, x) => t + Number(x.estrelas_prazo || 0), 0)
  const estrelasAval = validos.reduce((t, x) => t + Number(x.estrelas_avaliacao || 0), 0)
  const dentro = validos.filter((x) => x.dentro_prazo === true).length
  const fora = validos.filter((x) => x.dentro_prazo === false).length
  const contaNota = (v: number) => (notas || []).filter((x) => x === v).length

  const linha = { display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 2fr', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 14 } as const
  const rot = { color: 'var(--ink-muted)', fontWeight: 600 } as const

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 6 }}>Configuração em vigor</div>
      <div style={linha}><span style={rot}>Situação</span><span>{cfg?.ativo ? 'Ativo' : 'Desativado (nenhuma estrela é concedida)'}</span></div>
      <div style={linha}><span style={rot}>Data inicial</span><span>{cfg?.data_inicio ? formatarData(cfg.data_inicio) : 'Não definida'}</span></div>
      <div style={linha}><span style={rot}>Prazo para o cliente avaliar</span><span>{cfg?.prazo_avaliacao_dias ? cfg.prazo_avaliacao_dias + ' dia(s) após a resolução' : 'Não definido'}</span></div>
      <div style={linha}><span style={rot}>Alerta “Próximo do prazo”</span><span>{(cfg?.alerta_prazo_horas ?? 1) + 'h útil(eis) antes do vencimento'}</span></div>
      <div style={linha}>
        <span style={rot}>Regras (versão {cfg?.regra_versao ?? 1})</span>
        <span>Prazo {cfg?.estrelas_prazo ?? 1} · Ruim +{cfg?.bonus_ruim ?? 0} · Bom +{cfg?.bonus_bom ?? 1} · Excelente +{cfg?.bonus_excelente ?? 2}</span>
      </div>
      <div style={linha}><span style={rot}>Última alteração da configuração</span><span>{cfg?.atualizado_em ? formatarDataHora(cfg.atualizado_em) : '—'}</span></div>
      <div style={linha}>
        <span style={rot}>Fechamento de {hoje.ano}</span>
        <span>
          {!fech
            ? 'Data não definida (obrigatória para ativar o programa)'
            : fech.fechado_em
              ? 'Fechado em ' + formatarDataHora(fech.fechado_em) + '. Classificação congelada.'
              : 'Previsto para ' + formatarData(fech.data_fechamento) + ' (ainda aberto)'}
        </span>
      </div>

      <div className="section-title" style={{ margin: '18px 0 6px' }}>Números atuais (todos os períodos)</div>
      {lanc === null || notas === null ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <>
          <div style={linha}><span style={rot}>Chamados pontuados (válidos)</span><span>{validos.length} · {dentro} dentro e {fora} fora do prazo</span></div>
          <div style={linha}><span style={rot}>Estrelas válidas concedidas</span><span>{estrelasPrazo + estrelasAval} ({estrelasPrazo} pelo prazo, {estrelasAval} pela avaliação)</span></div>
          <div style={linha}><span style={rot}>Lançamentos suspensos (reabertos)</span><span>{suspensos}</span></div>
          <div style={linha}><span style={rot}>Lançamentos estornados</span><span>{estornados}</span></div>
          <div style={linha}>
            <span style={rot}>Avaliações de clientes</span>
            <span>{notas.length} · Excelente {contaNota(3)} · Bom {contaNota(2)} · Ruim {contaNota(1)}</span>
          </div>
          <div style={linha}><span style={rot}>Extensões de prazo aguardando decisão</span><span>{pendentes}</span></div>
        </>
      )}

      <div className="section-title" style={{ margin: '18px 0 6px' }}>Onde cada informação fica</div>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55 }}>
        <li><strong>Configuração</strong>: uma única linha com as regras acima. Toda alteração exige justificativa e fica na auditoria.</li>
        <li><strong>Lançamentos</strong>: um por chamado, com atendente, resolução, prazo usado, estrelas e situação (válido, suspenso ou estornado). É a base do ranking.</li>
        <li><strong>Avaliações</strong>: uma por chamado, feita pelo cliente que abriu. Guarda nota, comentário e o acompanhamento reservado da gestão.</li>
        <li><strong>Histórico</strong>: cada concessão, bônus, suspensão, estorno, decisão de prazo e mudança de configuração, com autor, data, antes e depois.</li>
        <li><strong>Alterações de prazo</strong>: extensões feitas sem mudança de status, aguardando ou já decididas pelo gestor.</li>
        <li><strong>Fechamentos</strong>: um por ano, com a data prevista e a classificação congelada no fechamento.</li>
      </ul>
      <p className="footnote" style={{ marginTop: 10 }}>
        Ninguém grava estrelas ou avaliações diretamente: todo cálculo e toda permissão ficam no banco de dados.
        Atendentes veem só os próprios lançamentos; a gestão vê todos.
      </p>
    </div>
  )
}

function AbaGestao({
  hoje,
  cfg,
  versao,
  onSalvo,
}: {
  hoje: ReturnType<typeof hojeBrasilia>
  cfg: ConfigEstrelas | null
  versao: number
  onSalvo: () => void
}) {
  const [ativo, setAtivo] = useState(cfg?.ativo || false)
  const [dataInicio, setDataInicio] = useState(cfg?.data_inicio || hoje.iso)
  const [prazoAval, setPrazoAval] = useState<string>(cfg?.prazo_avaliacao_dias ? String(cfg.prazo_avaliacao_dias) : '')
  const [alerta, setAlerta] = useState<string>(String(cfg?.alerta_prazo_horas ?? 1))
  const [ep, setEp] = useState(cfg?.estrelas_prazo ?? 1)
  const [ruim, setRuim] = useState(cfg?.bonus_ruim ?? 0)
  const [bom, setBom] = useState(cfg?.bonus_bom ?? 1)
  const [exc, setExc] = useState(cfg?.bonus_excelente ?? 2)
  const [motivo, setMotivo] = useState('')
  const [previa, setPrevia] = useState<any[] | null>(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [anoFech, setAnoFech] = useState(hoje.ano)
  const [dataFech, setDataFech] = useState(hoje.ano + '-12-20')
  const [ruins, setRuins] = useState<any[]>([])
  const [pendentes, setPendentes] = useState<any[]>([])
  const [auditoria, setAuditoria] = useState<any[]>([])
  const [textoAcomp, setTextoAcomp] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    const [{ data: f }, { data: r }, { data: p }, { data: a }] = await Promise.all([
      supabase.from('estrelas_fechamentos').select('ano, data_fechamento, fechado_em, classificacao').order('ano', { ascending: false }),
      supabase
        .from('chamado_avaliacoes')
        .select('chamado_id, nota, comentario, created_at, acompanhado_em, acompanhamento, chamados(numero, assunto, responsavel_id)')
        .eq('nota', 1)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('estrelas_prazo_alteracoes')
        .select('id, chamado_id, prazo_anterior, prazo_novo, origem, alterado_em, autorizado, chamados(numero, assunto)')
        .is('autorizado', null)
        .order('alterado_em', { ascending: false })
        .limit(100),
      supabase
        .from('estrelas_eventos')
        .select('id, tipo, motivo, created_at, chamado_id, autor_id, chamados(numero), autor:autor_id(nome)')
        .in('tipo', ['config', 'fechamento', 'estornada', 'restabelecida', 'prazo_decidido', 'acompanhamento'])
        .order('created_at', { ascending: false })
        .limit(40),
    ])
    const idsResp = Array.from(new Set(((r || []) as any[]).map((x) => x.chamados?.responsavel_id).filter(Boolean)))
    const nomes: Record<string, string> = {}
    if (idsResp.length > 0) {
      const { data: pessoas } = await supabase.from('profiles').select('id, nome').in('id', idsResp)
      for (const p of (pessoas || []) as any[]) nomes[p.id] = p.nome || ''
    }
    setFechamentos((f || []) as Fechamento[])
    setRuins(((r || []) as any[]).map((x) => ({ ...x, atendente: nomes[x.chamados?.responsavel_id] || '—' })))
    setPendentes(((p || []) as any[]).filter((x) => new Date(x.prazo_novo) > new Date(x.prazo_anterior)))
    setAuditoria((a || []) as any[])
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar, versao])

  /* Prévia obrigatória quando a data inicial está no passado. */
  const retroativo = !!dataInicio && dataInicio < hoje.iso && !(cfg?.ativo && cfg?.data_inicio === dataInicio)

  async function verPrevia() {
    setErro('')
    const { data, error } = await supabase.rpc('estrelas_previa_retroativa', { p_data_inicio: dataInicio })
    if (error) return setErro(error.message)
    setPrevia((data || []) as any[])
  }

  async function salvar() {
    setErro('')
    setMsg('')
    if (ativo && retroativo && previa === null) {
      setErro('Veja a prévia da pontuação retroativa antes de ativar com data inicial no passado.')
      return
    }
    setSalvando(true)
    const { data, error } = await supabase.rpc('estrelas_salvar_config', {
      p_ativo: ativo,
      p_data_inicio: dataInicio || null,
      p_prazo_avaliacao_dias: prazoAval ? Number(prazoAval) : null,
      p_alerta_prazo_horas: alerta ? Number(alerta) : null,
      p_estrelas_prazo: ep,
      p_bonus_bom: bom,
      p_bonus_excelente: exc,
      p_motivo: motivo,
      /* Só envia se o banco já tiver o bônus Ruim (senão a função antiga recusa o parâmetro). */
      ...(cfg?.bonus_ruim !== undefined ? { p_bonus_ruim: ruim } : {}),
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setMsg('Configuração salva.' + ((data as any)?.processados ? ' ' + (data as any).processados + ' chamado(s) processado(s).' : ''))
    setMotivo('')
    setPrevia(null)
    avisarAtualizacao()
    onSalvo()
  }

  async function definirFechamento() {
    setErro('')
    const { error } = await supabase.rpc('estrelas_definir_fechamento', {
      p_ano: anoFech,
      p_data: dataFech,
      p_motivo: 'Data de fechamento definida pela gestão',
    })
    if (error) return setErro(error.message)
    setMsg('Data de fechamento de ' + anoFech + ' salva.')
    carregar()
  }

  async function fecharAno(ano: number) {
    if (!window.confirm('Fechar a classificação de ' + ano + '? A versão final não poderá mais ser alterada.')) return
    setErro('')
    const { error } = await supabase.rpc('estrelas_fechar_ano', { p_ano: ano, p_motivo: null })
    if (error) return setErro(error.message)
    setMsg('Classificação de ' + ano + ' fechada.')
    avisarAtualizacao()
    carregar()
  }

  async function registrarAcompanhamento(chamadoId: string) {
    setErro('')
    const { error } = await supabase.rpc('estrelas_registrar_acompanhamento', {
      p_chamado: chamadoId,
      p_texto: textoAcomp[chamadoId] || '',
    })
    if (error) return setErro(error.message)
    carregar()
  }

  const campo = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', font: 'inherit' } as const
  const rotuloCampo = { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 13, fontWeight: 600 }

  return (
    <>
      {erro && <div className="banner bad" role="alert">{erro}</div>}
      {msg && <div className="banner good" role="status">{msg}</div>}

      <div className="panel">
        <div className="panel-head"><div className="section-title">Como funciona o programa</div></div>
        <div className="panel-body">
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-muted)' }}>
            Este texto também aparece para toda a equipe no topo da tela de Estrelas, em “Como funciona o programa”.
            Os valores mostrados acompanham a configuração em vigor.
          </p>
          <TextoComoFunciona cfg={cfg} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="section-title">Como os dados atuais estão montados</div></div>
        <div className="panel-body">
          <DadosAtuais hoje={hoje} cfg={cfg} fechamentos={fechamentos} pendentes={pendentes.length} versao={versao} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="section-title">Configuração do programa</div></div>
        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label style={rotuloCampo}>
              Data inicial (resoluções a partir de)
              <input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPrevia(null) }} style={campo} />
            </label>
            <label style={rotuloCampo}>
              Prazo para o cliente avaliar (dias após a resolução)
              <input type="number" min={1} max={365} value={prazoAval} onChange={(e) => setPrazoAval(e.target.value)} style={campo} placeholder="Ex.: 7" />
            </label>
            <label style={rotuloCampo}>
              Alerta amarelo “Próximo do prazo” (horas úteis antes)
              <input type="number" min={0.5} max={40} step={0.5} value={alerta} onChange={(e) => setAlerta(e.target.value)} style={campo} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label style={rotuloCampo}>
              Estrelas pelo prazo
              <select value={ep} onChange={(e) => setEp(Number(e.target.value))} style={campo}>
                <option value={1}>1</option><option value={0}>0</option>
              </select>
            </label>
            {cfg?.bonus_ruim !== undefined && (
              <label style={rotuloCampo}>
                Bônus avaliação “Ruim”
                <select value={ruim} onChange={(e) => setRuim(Number(e.target.value))} style={campo}>
                  <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </label>
            )}
            <label style={rotuloCampo}>
              Bônus avaliação “Bom”
              <select value={bom} onChange={(e) => setBom(Number(e.target.value))} style={campo}>
                <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </select>
            </label>
            <label style={rotuloCampo}>
              Bônus avaliação “Excelente”
              <select value={exc} onChange={(e) => setExc(Number(e.target.value))} style={campo}>
                <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </select>
            </label>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
            Mudanças nas regras valem só para novas concessões; o histórico mantém a regra de cada chamado
            (versão atual: {cfg?.regra_versao ?? 1}). Avaliação “Ruim” nunca dá bônus.
          </p>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Programa ativo
          </label>

          {ativo && retroativo && (
            <div className="banner" style={{ background: 'var(--amber-tint)', color: 'var(--amber)' }}>
              A data inicial está no passado: chamados já resolvidos desde {formatarData(dataInicio)} receberão
              estrelas pelo prazo (sem avaliação fictícia).{' '}
              <button type="button" className="btn btn-sm" onClick={verPrevia}>Ver prévia</button>
            </div>
          )}

          {previa && (
            <div className="table-wrap">
              <div className="trow thead" style={{ gridTemplateColumns: '2fr repeat(4, 1fr)' }}>
                <span>Atendente</span><span>Chamados</span><span>Dentro do prazo</span><span>Fora do prazo</span><span>Sem prazo</span>
              </div>
              {previa.length === 0 ? (
                <div className="empty-state">Nenhum chamado retroativo a pontuar.</div>
              ) : previa.map((p) => (
                <div key={p.atendente_id} className="trow" style={{ gridTemplateColumns: '2fr repeat(4, 1fr)' }}>
                  <span className="tname">{p.nome}</span>
                  <span className="mono">{p.chamados}</span>
                  <span className="mono">{p.dentro_prazo}</span>
                  <span className="mono">{p.fora_prazo}</span>
                  <span className="mono">{p.sem_prazo}</span>
                </div>
              ))}
            </div>
          )}

          <label style={rotuloCampo}>
            Justificativa da alteração (obrigatória, fica na auditoria)
            <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={campo} placeholder="Ex.: Programa aprovado em reunião de 20/10" />
          </label>
          <div>
            <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="section-title">Fechamento anual da classificação</div></div>
        <div className="panel-body">
          <div className="filters">
            <select value={anoFech} onChange={(e) => setAnoFech(Number(e.target.value))} aria-label="Ano do fechamento">
              {[hoje.ano, hoje.ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <input type="date" value={dataFech} onChange={(e) => setDataFech(e.target.value)} style={campo} aria-label="Data de fechamento" />
            <button type="button" className="btn btn-sm" onClick={definirFechamento}>Salvar data de fechamento</button>
          </div>
          {fechamentos.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Nenhuma data de fechamento definida.</p>
          ) : fechamentos.map((f) => (
            <div key={f.ano} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
              <strong>{f.ano}</strong>
              <span>fechamento em {formatarData(f.data_fechamento)}</span>
              {f.fechado_em ? (
                <span className="pill good">Fechado em {formatarDataHora(f.fechado_em)}</span>
              ) : (
                <>
                  <span className="pill warn">Provisório</span>
                  <button type="button" className="btn btn-sm" disabled={hoje.iso < f.data_fechamento} onClick={() => fecharAno(f.ano)}
                    title={hoje.iso < f.data_fechamento ? 'Disponível a partir da data de fechamento' : ''}>
                    Fechar classificação de {f.ano}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="section-title">Avaliações ruins — acompanhamento reservado</div></div>
        <div className="panel-body">
          {ruins.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Nenhuma avaliação ruim.</p>
          ) : ruins.map((r) => (
            <div key={r.chamado_id} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div style={{ fontSize: 14 }}>
                <Link href={'/atendimento/' + r.chamado_id}><strong>#{r.chamados?.numero}</strong></Link> — {r.chamados?.assunto} ·
                atendente: {r.atendente} · {formatarDataHora(r.created_at)}
              </div>
              {r.comentario && <em style={{ fontSize: 13, color: 'var(--ink-muted)' }}>“{r.comentario}”</em>}
              {r.acompanhado_em ? (
                <span style={{ fontSize: 13 }}><span className="pill good">Acompanhado</span> {r.acompanhamento}</span>
              ) : (
                <div className="filters">
                  <input type="text" style={{ ...campo, flex: 1, minWidth: 220 }} placeholder="Registro do acompanhamento"
                    value={textoAcomp[r.chamado_id] || ''} onChange={(e) => setTextoAcomp((t) => ({ ...t, [r.chamado_id]: e.target.value }))} />
                  <button type="button" className="btn btn-sm" onClick={() => registrarAcompanhamento(r.chamado_id)}>Registrar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="section-title">Extensões de prazo aguardando decisão</div></div>
        <div className="panel-body">
          {pendentes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Nenhuma extensão pendente.</p>
          ) : pendentes.map((p) => (
            <div key={p.id} style={{ fontSize: 14 }}>
              <Link href={'/atendimento/' + p.chamado_id}><strong>#{p.chamados?.numero}</strong></Link> — {p.chamados?.assunto}:{' '}
              {formatarDataHora(p.prazo_anterior)} → {formatarDataHora(p.prazo_novo)}
              {' '}({p.origem === 'prioridade' ? 'troca de prioridade' : p.origem === 'suspensao' ? 'atendimento suspenso' : 'manual'}). Decida na tela do chamado, com justificativa.
            </div>
          ))}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
            O SLA do chamado não muda. Sem autorização, a estrela usa o prazo anterior. Extensão de prazo que já
            estava vencido não pode ser autorizada.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="section-title">Auditoria recente</div></div>
        <div className="panel-body">
          {auditoria.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Sem registros.</p>
          ) : auditoria.map((a) => (
            <div key={a.id} style={{ fontSize: 13 }}>
              <strong>{formatarDataHora(a.created_at)}</strong> · {a.autor?.nome || 'Sistema'} ·{' '}
              {{ config: 'Configuração', fechamento: 'Fechamento', estornada: 'Estorno', restabelecida: 'Restabelecimento', prazo_decidido: 'Decisão de prazo', acompanhamento: 'Acompanhamento' }[a.tipo as string] || a.tipo}
              {a.chamados?.numero ? ' · chamado #' + a.chamados.numero : ''}
              {a.motivo ? ' — ' + a.motivo : ''}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
