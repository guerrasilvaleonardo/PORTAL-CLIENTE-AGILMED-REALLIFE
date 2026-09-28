'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { duracaoUtil, situacaoSla, type ChaveSla } from '@/lib/prazo'
import '../quadro.css'

/*
 * Prioridades e SLA — lista única, ordenada por tempo, para cada pessoa
 * da equipe saber o que atacar primeiro. A ordem vem da view
 * v_chamados_fila (supabase/chamados-fila-prioridades.sql), a mesma que
 * calcula a posição que o cliente vê:
 *   atrasados primeiro (maior atraso no topo) → menor prazo restante →
 *   prioridade → data de abertura. "Aguardando cliente" fica fora da
 *   fila, com o SLA pausado.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const EM_ABERTO = ['aberto', 'em_atendimento', 'aguardando_cliente']

const ROTULO_STATUS: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em andamento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

const ROTULO_SLA: Partial<Record<ChaveSla, string>> = {
  atrasado: 'Atrasado',
  vence_em_breve: 'Vence em breve',
  no_prazo: 'No prazo',
  pausado: 'Pausado',
  sem_sla: 'Sem SLA',
}

const COR_SLA: Partial<Record<ChaveSla, string>> = {
  atrasado: 'var(--danger)',
  vence_em_breve: '#b54708',
  no_prazo: 'var(--ink-muted)',
  pausado: 'var(--ink-faint)',
  sem_sla: 'var(--ink-faint)',
}

type Chamado = {
  id: string
  numero: number
  empresa_id: string
  categoria: string
  assunto: string
  prioridade: string
  status: string
  created_at: string
  prazo_sla: string | null
  sla_pausado_em: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  responsavel_id: string | null
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
  responsavel?: { nome: string | null } | null
}

type Posicao = {
  id: string
  posicao_area: number | null
  total_area: number | null
  posicao_responsavel: number | null
  posicao_geral: number | null
}

function iniciais(nome?: string | null) {
  if (!nome) return '--'
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

function dataHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const celula: CSSProperties = {
  padding: '10px 8px',
  borderTop: '1px solid var(--border)',
  verticalAlign: 'top',
  fontSize: 13.5,
}

const cabeca: CSSProperties = {
  padding: '6px 8px',
  fontSize: 11.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: 'var(--ink-muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

export default function PrioridadesPage() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [posicoes, setPosicoes] = useState<Record<string, Posicao>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [meuId, setMeuId] = useState('')
  const [aba, setAba] = useState<'minha' | 'geral'>('minha')
  const [area, setArea] = useState('')
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  async function carregar() {
    try {
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil')
        .eq('id', user.id)
        .single()

      if (!PERFIS_INTERNOS.includes(perfil?.perfil || '')) {
        window.location.href = '/'
        return
      }

      setMeuId(user.id)

      const [lista, fila] = await Promise.all([
        supabase
          .from('chamados')
          .select(
            'id, numero, empresa_id, categoria, assunto, prioridade, status, created_at, prazo_sla, sla_pausado_em, resolvido_em, encerrado_em, responsavel_id, empresas(nome_fantasia, razao_social), responsavel:profiles!chamados_responsavel_id_fkey(nome)'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('v_chamados_fila')
          .select('id, posicao_area, total_area, posicao_responsavel, posicao_geral')
          .eq('na_fila', true),
      ])

      if (lista.error) throw lista.error
      if (fila.error) throw fila.error

      setChamados(
        (lista.data || []).map((item: any) => ({
          ...item,
          empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas,
          responsavel: Array.isArray(item.responsavel) ? item.responsavel[0] : item.responsavel,
        }))
      )

      setPosicoes(
        Object.fromEntries(((fila.data || []) as Posicao[]).map((p) => [p.id, p]))
      )

      setAtualizadoEm(new Date())
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar a fila.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()

    /* O SLA anda com o relógio: atualiza sozinho a cada 2 minutos. */
    const id = window.setInterval(carregar, 120000)

    return () => window.clearInterval(id)
  }, [])

  const abertos = useMemo(
    () =>
      chamados
        .filter((c) => EM_ABERTO.includes(c.status))
        .map((c) => ({ ...c, sla: situacaoSla(c) })),
    [chamados]
  )

  const areas = useMemo(
    () => [...new Set(abertos.map((c) => c.categoria || 'Sem área'))].sort(),
    [abertos]
  )

  const indicadores = useMemo(() => {
    const naFila = abertos.filter((c) => posicoes[c.id])

    /* Desempenho dos últimos 30 dias, pela data de resolução. */
    const limite = Date.now() - 30 * 86400000

    const concluidos = chamados
      .filter((c) => c.status === 'resolvido' || c.status === 'encerrado')
      .filter((c) => {
        const fim = c.resolvido_em || c.encerrado_em
        return fim && new Date(fim).getTime() >= limite
      })
      .map((c) => situacaoSla(c))
      .filter((s) => s.chave === 'cumprido' || s.chave === 'descumprido')

    const noPrazo = concluidos.filter((s) => s.chave === 'cumprido').length

    return {
      naFila: naFila.length,
      atrasados: abertos.filter((c) => c.sla.chave === 'atrasado').length,
      venceBreve: abertos.filter((c) => c.sla.chave === 'vence_em_breve').length,
      pausados: abertos.filter((c) => c.sla.chave === 'pausado').length,
      semResponsavel: naFila.filter((c) => !c.responsavel_id).length,
      concluidos30: concluidos.length,
      pctNoPrazo: concluidos.length
        ? Math.round((noPrazo / concluidos.length) * 100)
        : null,
    }
  }, [abertos, chamados, posicoes])

  const carga = useMemo(() => {
    const mapa = new Map<
      string,
      { id: string; nome: string; fila: number; atrasados: number; breve: number; pausados: number }
    >()

    for (const c of abertos) {
      const chave = c.responsavel_id || 'sem'
      const linha = mapa.get(chave) || {
        id: chave,
        nome: c.responsavel_id ? c.responsavel?.nome || 'Sem nome' : 'Sem responsável',
        fila: 0,
        atrasados: 0,
        breve: 0,
        pausados: 0,
      }

      if (posicoes[c.id]) linha.fila++
      if (c.sla.chave === 'atrasado') linha.atrasados++
      if (c.sla.chave === 'vence_em_breve') linha.breve++
      if (c.sla.chave === 'pausado') linha.pausados++

      mapa.set(chave, linha)
    }

    return [...mapa.values()].sort(
      (a, b) => b.atrasados - a.atrasados || b.fila - a.fila
    )
  }, [abertos, posicoes])

  const lista = useMemo(() => {
    let l = abertos.filter((c) => posicoes[c.id])

    if (aba === 'minha') l = l.filter((c) => c.responsavel_id === meuId)
    if (area) l = l.filter((c) => (c.categoria || 'Sem área') === area)

    const campo: keyof Posicao =
      aba === 'minha' ? 'posicao_responsavel' : area ? 'posicao_area' : 'posicao_geral'

    return [...l].sort(
      (a, b) =>
        ((posicoes[a.id]?.[campo] as number) ?? 9999) -
        ((posicoes[b.id]?.[campo] as number) ?? 9999)
    )
  }, [abertos, posicoes, aba, area, meuId])

  const pausados = useMemo(
    () =>
      abertos.filter(
        (c) =>
          c.sla.chave === 'pausado' &&
          (aba === 'geral' || c.responsavel_id === meuId) &&
          (!area || (c.categoria || 'Sem área') === area)
      ),
    [abertos, aba, area, meuId]
  )

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">Atendimento</div>
          <h1 style={{ fontSize: 26, marginTop: 6 }}>Prioridades e SLA</h1>
        </div>

        <div className="topbar-spacer" />

        {atualizadoEm && (
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Atualizado às{' '}
            {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}

        <Link href="/atendimento" className="btn btn-sm">
          Quadro de chamados
        </Link>

        <button type="button" className="btn btn-sm" onClick={carregar}>
          Atualizar
        </button>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : indicadores.naFila}</div>
          <div className="lbl">Na fila</div>
        </div>

        <div className={'stat' + (indicadores.atrasados > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : indicadores.atrasados}</div>
          <div className="lbl">SLA atrasado</div>
        </div>

        <div className={'stat' + (indicadores.venceBreve > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : indicadores.venceBreve}</div>
          <div className="lbl">Vencem em até 4h úteis</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : indicadores.pausados}</div>
          <div className="lbl">Aguardando cliente</div>
        </div>

        <div className={'stat' + (indicadores.semResponsavel > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : indicadores.semResponsavel}</div>
          <div className="lbl">Sem responsável</div>
        </div>

        <div className="stat">
          <div className="num">
            {carregando || indicadores.pctNoPrazo === null ? '—' : indicadores.pctNoPrazo + '%'}
          </div>
          <div className="lbl">
            No prazo (30 dias{indicadores.concluidos30 ? ', ' + indicadores.concluidos30 + ' concluídos' : ''})
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Carga por responsável</div>
        </div>

        <div className="panel-body" style={{ overflowX: 'auto', gap: 0 }}>
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : carga.length === 0 ? (
            <div className="empty-state">Nenhum chamado em aberto.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={cabeca}>Responsável</th>
                  <th style={{ ...cabeca, textAlign: 'right' }}>Na fila</th>
                  <th style={{ ...cabeca, textAlign: 'right' }}>Atrasados</th>
                  <th style={{ ...cabeca, textAlign: 'right' }}>Vencem em breve</th>
                  <th style={{ ...cabeca, textAlign: 'right' }}>Aguardando cliente</th>
                </tr>
              </thead>

              <tbody>
                {carga.map((r) => (
                  <tr key={r.id}>
                    <td style={celula}>
                      <Link
                        href={'/atendimento?responsavel=' + r.id}
                        style={{ color: 'inherit', display: 'flex', gap: 8, alignItems: 'center' }}
                      >
                        <span className="avatar">{r.id === 'sem' ? '--' : iniciais(r.nome)}</span>
                        {r.nome}
                      </Link>
                    </td>
                    <td style={{ ...celula, textAlign: 'right' }}>{r.fila}</td>
                    <td
                      style={{
                        ...celula,
                        textAlign: 'right',
                        fontWeight: r.atrasados ? 700 : 400,
                        color: r.atrasados ? 'var(--danger)' : undefined,
                      }}
                    >
                      {r.atrasados}
                    </td>
                    <td style={{ ...celula, textAlign: 'right', color: r.breve ? '#b54708' : undefined }}>
                      {r.breve}
                    </td>
                    <td style={{ ...celula, textAlign: 'right' }}>{r.pausados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="section-title">Lista de prioridades</div>

          <div className="topbar-spacer" />

          <button
            type="button"
            className={'btn btn-sm' + (aba === 'minha' ? ' btn-primary' : '')}
            onClick={() => setAba('minha')}
          >
            Minha fila
          </button>

          <button
            type="button"
            className={'btn btn-sm' + (aba === 'geral' ? ' btn-primary' : '')}
            onClick={() => setAba('geral')}
          >
            Fila geral
          </button>

          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="panel-body" style={{ overflowX: 'auto', gap: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 8 }}>
            Ordem: atrasados primeiro (maior atraso no topo) → menor prazo restante →
            prioridade → data de abertura. Prazos em horas úteis.
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cabeca}>Ordem</th>
                <th style={cabeca}>Chamado</th>
                <th style={cabeca}>Área</th>
                <th style={cabeca}>Status</th>
                <th style={cabeca}>Resp.</th>
                <th style={cabeca}>SLA</th>
                <th style={cabeca}>Prazo</th>
              </tr>
            </thead>

            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td style={celula} colSpan={7}>
                    {carregando
                      ? 'Carregando...'
                      : aba === 'minha'
                        ? 'Nenhum chamado da fila está no seu nome.'
                        : 'Nenhum chamado na fila.'}
                  </td>
                </tr>
              )}

              {lista.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ ...celula, fontWeight: 700 }}>{i + 1}º</td>

                  <td style={celula}>
                    <Link href={'/atendimento/' + c.id} style={{ color: 'inherit' }}>
                      <span className="mono" style={{ color: 'var(--ink-faint)' }}>#{c.numero}</span>{' '}
                      <strong>{c.assunto}</strong>
                    </Link>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                      {c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa'}
                      {' · '}
                      {c.prioridade}
                    </div>
                  </td>

                  <td style={celula}>
                    {c.categoria}
                    {posicoes[c.id]?.posicao_area && (
                      <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        {posicoes[c.id].posicao_area}º de {posicoes[c.id].total_area}
                      </div>
                    )}
                  </td>

                  <td style={celula}>{ROTULO_STATUS[c.status] || c.status}</td>

                  <td style={celula} title={c.responsavel?.nome || 'Sem responsável'}>
                    <span className="avatar">{iniciais(c.responsavel?.nome)}</span>
                  </td>

                  <td style={{ ...celula, whiteSpace: 'nowrap', color: COR_SLA[c.sla.chave], fontWeight: 600 }}>
                    {ROTULO_SLA[c.sla.chave] || c.sla.chave}
                    <div style={{ fontWeight: 400, fontSize: 12 }}>
                      {c.sla.horas === null ? '' : c.sla.texto}
                    </div>
                  </td>

                  <td style={{ ...celula, whiteSpace: 'nowrap' }}>{dataHora(c.prazo_sla)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pausados.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="section-title" style={{ marginBottom: 6 }}>
                Aguardando cliente — SLA pausado, fora da fila
              </div>

              {pausados.map((c) => (
                <Link
                  key={c.id}
                  href={'/atendimento/' + c.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '8px 2px',
                    borderTop: '1px solid var(--border)',
                    color: 'inherit',
                    fontSize: 13.5,
                  }}
                >
                  <span className="mono" style={{ color: 'var(--ink-faint)' }}>#{c.numero}</span>
                  <span style={{ flex: 1 }}>
                    {c.assunto}
                    <span style={{ color: 'var(--ink-muted)' }}>
                      {' · '}
                      {c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa'}
                    </span>
                  </span>
                  <span style={{ color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                    {c.sla.horas === null
                      ? ''
                      : (c.sla.horas < 0 ? 'pausou com ' : 'saldo de ') + duracaoUtil(c.sla.horas) +
                        (c.sla.horas < 0 ? ' de atraso' : '')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
