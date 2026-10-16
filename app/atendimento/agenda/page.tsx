'use client'

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { carregarFeriados, type Feriado } from '@/lib/feriados'
import { situacaoSla } from '@/lib/prazo'

/*
 * Agenda semanal por atendente.
 *
 * Junta numa grade seg-sex, 08h-17h (horário de Porto Velho):
 *   - compromissos com dia e hora (tabela agenda_compromissos);
 *   - prazos (SLA) dos chamados em aberto sob responsabilidade dele;
 *   - etapas pendentes desses chamados;
 *   - feriados do calendário do SLA.
 *
 * Carga do dia = horas de compromissos dentro do expediente / 8h.
 * Chamados não têm estimativa de duração, então entram como prazo
 * (quando vencem), não como horas ocupadas.
 *
 * Gestor/admin veem e editam a agenda de qualquer atendente; o
 * atendente vê a de todos e edita só a própria (regra repetida no
 * banco: supabase/agenda-atendentes.sql).
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const EM_ABERTO = ['aberto', 'em_atendimento', 'aguardando_cliente']

const FUSO_MS = -4 * 3600000 // America/Porto_Velho (UTC-4, sem horário de verão)
const INICIO_H = 8
const FIM_H = 17
const ALMOCO = [12, 13]
const PX_HORA = 56
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const ROTULO_PRIORIDADE: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

type Pessoa = { id: string; nome: string; perfil: string }

type Compromisso = {
  id: number
  responsavel_id: string
  titulo: string
  inicio: string
  fim: string
  local: string | null
  observacao: string | null
  chamado_numero: number | null
}

type Chamado = {
  id: string
  numero: number
  assunto: string
  prioridade: string
  status: string
  prazo_sla: string | null
  sla_pausado_em: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  empresas?: { nome_fantasia: string | null; razao_social: string | null } | null
}

type Etapa = { chamado_id: string; titulo: string; ordem: number }

/* ---------- datas no relógio de Porto Velho ---------- */

/* Data local (AAAA-MM-DD) de um instante. */
function diaLocal(ms: number) {
  return new Date(ms + FUSO_MS).toISOString().slice(0, 10)
}

/* Instante real de um dia local + minutos. */
function instante(dia: string, minutos: number) {
  return Date.parse(dia + 'T00:00:00Z') - FUSO_MS + minutos * 60000
}

function minutosLocais(ms: number) {
  const d = new Date(ms + FUSO_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function somarDias(dia: string, n: number) {
  return new Date(Date.parse(dia + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
}

function segundaDaSemana(dia: string) {
  const d = new Date(dia + 'T00:00:00Z').getUTCDay()
  return somarDias(dia, d === 0 ? -6 : 1 - d)
}

function hhmm(ms: number) {
  const m = minutosLocais(ms)
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

function dataCurta(dia: string) {
  return dia.slice(8, 10) + '/' + dia.slice(5, 7)
}

function paraMinutos(texto: string) {
  const [h, m] = texto.split(':').map(Number)
  return h * 60 + (m || 0)
}

/* Horas de um intervalo que caem dentro do expediente do dia. */
function horasNoExpediente(ini: number, fim: number, dia: string) {
  let total = 0
  for (const [a, b] of [
    [INICIO_H, ALMOCO[0]],
    [ALMOCO[1], FIM_H],
  ]) {
    const s = Math.max(ini, instante(dia, a * 60))
    const e = Math.min(fim, instante(dia, b * 60))
    if (e > s) total += e - s
  }
  return total / 3600000
}

function nomeEmpresa(c: Chamado) {
  return c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa'
}

const formVazio = {
  id: 0,
  titulo: '',
  dia: '',
  inicio: '08:00',
  fim: '09:00',
  local: '',
  chamado: '',
  observacao: '',
}

export default function AgendaPage() {
  const hoje = diaLocal(Date.now())

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [meuId, setMeuId] = useState('')
  const [meuPerfil, setMeuPerfil] = useState('')
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [pessoa, setPessoa] = useState('')
  const [semana, setSemana] = useState(segundaDaSemana(hoje))

  const [compromissos, setCompromissos] = useState<Compromisso[]>([])
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [feriados, setFeriados] = useState<Feriado[]>([])

  const [form, setForm] = useState<typeof formVazio | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)

  const ehGestor = ['gestor', 'admin'].includes(meuPerfil)
  const podeEditar = ehGestor || (meuPerfil === 'atendimento' && pessoa === meuId)

  const dias = useMemo(() => DIAS.map((_, i) => somarDias(semana, i)), [semana])

  /* ---------- carga inicial: quem sou eu e a equipe ---------- */
  useEffect(() => {
    async function iniciar() {
      try {
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
        setMeuPerfil(perfil?.perfil || '')

        const { data: lista } = await supabase
          .from('profiles')
          .select('id, nome, perfil')
          .in('perfil', PERFIS_INTERNOS)
          .eq('ativo', true)
          .order('nome')

        setEquipe(
          ((lista || []) as any[]).map((p) => ({
            id: p.id,
            nome: p.nome || 'Sem nome',
            perfil: p.perfil,
          }))
        )

        /* Atalho: /atendimento/agenda?pessoa=<id> */
        const pedido = new URLSearchParams(window.location.search).get('pessoa')
        setPessoa(pedido || user.id)

        setFeriados(await carregarFeriados(supabase, true))
      } catch (e) {
        console.error(e)
        setErro('Não foi possível carregar a agenda.')
        setCarregando(false)
      }
    }

    iniciar()
  }, [])

  /* ---------- dados da pessoa e da semana ---------- */
  async function carregarSemana() {
    if (!pessoa) return

    try {
      setCarregando(true)
      setErro('')

      const ini = new Date(instante(semana, 0)).toISOString()
      const fim = new Date(instante(somarDias(semana, 7), 0)).toISOString()

      const { data: comp, error: e1 } = await supabase
        .from('agenda_compromissos')
        .select('id, responsavel_id, titulo, inicio, fim, local, observacao, chamado_numero')
        .eq('responsavel_id', pessoa)
        .lt('inicio', fim)
        .gt('fim', ini)
        .order('inicio')

      if (e1) throw e1

      const { data: chs, error: e2 } = await supabase
        .from('chamados')
        .select(
          'id, numero, assunto, prioridade, status, prazo_sla, sla_pausado_em, resolvido_em, encerrado_em, empresas(nome_fantasia, razao_social)'
        )
        .eq('responsavel_id', pessoa)
        .in('status', EM_ABERTO)
        .order('prazo_sla', { nullsFirst: false })

      if (e2) throw e2

      const lista = ((chs || []) as any[]).map((c) => ({
        ...c,
        empresas: Array.isArray(c.empresas) ? c.empresas[0] : c.empresas,
      })) as Chamado[]

      let pend: Etapa[] = []

      if (lista.length) {
        const { data: et } = await supabase
          .from('chamado_etapas')
          .select('chamado_id, titulo, ordem')
          .in(
            'chamado_id',
            lista.map((c) => c.id)
          )
          .eq('concluida', false)
          .order('ordem')

        pend = (et || []) as Etapa[]
      }

      setCompromissos((comp || []) as Compromisso[])
      setChamados(lista)
      setEtapas(pend)
    } catch (e) {
      console.error(e)
      setErro(
        'Não foi possível carregar a agenda. Confira se o script supabase/agenda-atendentes.sql já foi rodado no banco.'
      )
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarSemana()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa, semana])

  /* ---------- organização ---------- */
  const feriadoDoDia = useMemo(() => {
    const m: Record<string, string> = {}
    feriados.forEach((f) => (m[f.data.slice(0, 10)] = f.descricao))
    return m
  }, [feriados])

  const comSla = useMemo(() => chamados.map((c) => ({ ...c, sla: situacaoSla(c) })), [chamados])

  const etapasPorChamado = useMemo(() => {
    const m: Record<string, Etapa[]> = {}
    etapas.forEach((e) => (m[e.chamado_id] = [...(m[e.chamado_id] || []), e]))
    return m
  }, [etapas])

  const inicioSemana = instante(semana, 0)
  const fimSemana = instante(somarDias(semana, 7), 0)

  const grupos = useMemo(() => {
    const atrasados = comSla.filter((c) => c.sla.chave === 'atrasado')
    const pausados = comSla.filter((c) => c.sla.chave === 'pausado')
    const naSemana = comSla.filter((c) => {
      if (c.sla.chave === 'atrasado' || c.sla.chave === 'pausado' || !c.prazo_sla) return false
      const t = Date.parse(c.prazo_sla)
      return t >= inicioSemana && t < fimSemana
    })
    const depois = comSla.filter(
      (c) =>
        !atrasados.includes(c) &&
        !pausados.includes(c) &&
        !naSemana.includes(c)
    )
    return { atrasados, pausados, naSemana, depois }
  }, [comSla, inicioSemana, fimSemana])

  const cargaDia = useMemo(() => {
    const m: Record<string, number> = {}
    dias.forEach((d) => {
      m[d] = compromissos.reduce(
        (s, c) => s + horasNoExpediente(Date.parse(c.inicio), Date.parse(c.fim), d),
        0
      )
    })
    return m
  }, [compromissos, dias])

  const horasSemana = dias.reduce((s, d) => s + (cargaDia[d] || 0), 0)
  const diasUteis = dias.filter((d) => !feriadoDoDia[d]).length

  const nomePessoa = equipe.find((p) => p.id === pessoa)?.nome || ''

  /* ---------- compromissos: criar, editar, remover ---------- */
  function novo(dia?: string, minuto?: number) {
    if (!podeEditar) return
    const ini = minuto ?? INICIO_H * 60
    const fim = Math.min(ini + 60, FIM_H * 60)
    const f = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
    setConfirmarRemocao(false)
    setForm({ ...formVazio, dia: dia || (dias.includes(hoje) ? hoje : dias[0]), inicio: f(ini), fim: f(fim) })
  }

  function editar(c: Compromisso) {
    setConfirmarRemocao(false)
    setForm({
      id: c.id,
      titulo: c.titulo,
      dia: diaLocal(Date.parse(c.inicio)),
      inicio: hhmm(Date.parse(c.inicio)),
      fim: hhmm(Date.parse(c.fim)),
      local: c.local || '',
      chamado: c.chamado_numero ? String(c.chamado_numero) : '',
      observacao: c.observacao || '',
    })
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (!form || !podeEditar) return

    const ini = instante(form.dia, paraMinutos(form.inicio))
    const fim = instante(form.dia, paraMinutos(form.fim))

    if (form.titulo.trim().length < 2) {
      setErro('Informe o título do compromisso.')
      return
    }

    if (!(fim > ini)) {
      setErro('O horário de término precisa ser depois do início.')
      return
    }

    const registro = {
      responsavel_id: pessoa,
      titulo: form.titulo.trim(),
      inicio: new Date(ini).toISOString(),
      fim: new Date(fim).toISOString(),
      local: form.local.trim() || null,
      observacao: form.observacao.trim() || null,
      chamado_numero: form.chamado ? Number(form.chamado) || null : null,
    }

    try {
      setSalvando(true)
      setErro('')

      const { error } = form.id
        ? await supabase.from('agenda_compromissos').update(registro).eq('id', form.id)
        : await supabase.from('agenda_compromissos').insert(registro)

      if (error) throw error

      setAviso(form.id ? 'Compromisso atualizado.' : 'Compromisso incluído na agenda.')
      setForm(null)
      setSemana(segundaDaSemana(form.dia))
      await carregarSemana()
    } catch (e) {
      console.error(e)
      setErro('Não foi possível salvar o compromisso.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover() {
    if (!form?.id || !podeEditar) return

    try {
      setSalvando(true)
      setErro('')

      const { error } = await supabase.from('agenda_compromissos').delete().eq('id', form.id)

      if (error) throw error

      setAviso('Compromisso removido.')
      setForm(null)
      await carregarSemana()
    } catch (e) {
      console.error(e)
      setErro('Não foi possível remover o compromisso.')
    } finally {
      setSalvando(false)
      setConfirmarRemocao(false)
    }
  }

  /* ---------- posição na grade ---------- */
  function topo(minutos: number) {
    const m = Math.min(Math.max(minutos, INICIO_H * 60), FIM_H * 60)
    return ((m - INICIO_H * 60) / 60) * PX_HORA
  }

  const alturaGrade = (FIM_H - INICIO_H) * PX_HORA

  function corPrazo(chave: string) {
    if (chave === 'atrasado') return { bg: 'var(--danger-tint)', fg: 'var(--danger)' }
    if (chave === 'vence_em_breve') return { bg: 'var(--amber-tint)', fg: 'var(--amber)' }
    return { bg: 'var(--surface-sunken)', fg: 'var(--ink)' }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">Atendimento</div>
          <h1 style={{ fontSize: 26, marginTop: 6 }}>Agenda</h1>
        </div>

        <div className="topbar-spacer" />

        <Link href="/atendimento/prioridades" className="btn btn-sm">
          Prioridades
        </Link>

        <Link href="/atendimento" className="btn btn-sm">
          Quadro de chamados
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {aviso && <div className="banner good">{aviso}</div>}

      <div className="panel">
        <div
          className="panel-body"
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}
        >
          <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="agenda-pessoa">
            Atendente
          </label>
          <select
            id="agenda-pessoa"
            value={pessoa}
            onChange={(e) => {
              setForm(null)
              setPessoa(e.target.value)
            }}
            style={{ minWidth: 200 }}
          >
            {equipe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.id === meuId ? ' (eu)' : ''}
              </option>
            ))}
          </select>

          <div style={{ flex: 1 }} />

          <button type="button" className="btn btn-sm" onClick={() => setSemana(somarDias(semana, -7))}>
            ← Semana anterior
          </button>
          <span className="mono" style={{ fontSize: 13, minWidth: 120, textAlign: 'center' }}>
            {dataCurta(dias[0])} a {dataCurta(dias[4])}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setSemana(somarDias(semana, 7))}>
            Próxima semana →
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setSemana(segundaDaSemana(hoje))}>
            Hoje
          </button>

          {podeEditar && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => novo()}>
              + Compromisso
            </button>
          )}
        </div>
      </div>

      <div className="stats">
        <div className={'stat' + (horasSemana > diasUteis * 8 ? ' bad' : '')}>
          <div className="num">
            {carregando ? '—' : horasSemana.toFixed(1).replace('.0', '') + 'h'}
          </div>
          <div className="lbl">
            Agendadas na semana (de {diasUteis * 8}h úteis)
          </div>
        </div>

        <div className={'stat' + (grupos.naSemana.length ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : grupos.naSemana.length}</div>
          <div className="lbl">Prazos que vencem na semana</div>
        </div>

        <div className={'stat' + (grupos.atrasados.length ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : grupos.atrasados.length}</div>
          <div className="lbl">Chamados atrasados</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : etapas.length}</div>
          <div className="lbl">Etapas pendentes</div>
        </div>
      </div>

      {form && (
        <form className="panel" onSubmit={salvar}>
          <div className="panel-head">
            <div className="section-title">
              {form.id ? 'Editar compromisso' : 'Novo compromisso'} · {nomePessoa}
            </div>
          </div>

          <div className="panel-body">
            <div className="field-row">
              <div className="field">
                <label htmlFor="ag-titulo">Título</label>
                <input
                  id="ag-titulo"
                  value={form.titulo}
                  maxLength={160}
                  placeholder="Ex.: Visita técnica — levantamento de riscos"
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  required
                  disabled={!podeEditar}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field" style={{ maxWidth: 170 }}>
                <label htmlFor="ag-dia">Dia</label>
                <input
                  id="ag-dia"
                  type="date"
                  value={form.dia}
                  onChange={(e) => setForm({ ...form, dia: e.target.value })}
                  required
                  disabled={!podeEditar}
                />
              </div>
              <div className="field" style={{ maxWidth: 120 }}>
                <label htmlFor="ag-ini">Início</label>
                <input
                  id="ag-ini"
                  type="time"
                  value={form.inicio}
                  onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                  required
                  disabled={!podeEditar}
                />
              </div>
              <div className="field" style={{ maxWidth: 120 }}>
                <label htmlFor="ag-fim">Término</label>
                <input
                  id="ag-fim"
                  type="time"
                  value={form.fim}
                  onChange={(e) => setForm({ ...form, fim: e.target.value })}
                  required
                  disabled={!podeEditar}
                />
              </div>
              <div className="field" style={{ maxWidth: 140 }}>
                <label htmlFor="ag-chamado">Chamado nº (opcional)</label>
                <input
                  id="ag-chamado"
                  inputMode="numeric"
                  value={form.chamado}
                  onChange={(e) => setForm({ ...form, chamado: e.target.value.replace(/\D/g, '') })}
                  disabled={!podeEditar}
                />
              </div>
              <div className="field">
                <label htmlFor="ag-local">Local (opcional)</label>
                <input
                  id="ag-local"
                  value={form.local}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  disabled={!podeEditar}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ag-obs">Observação (opcional)</label>
              <textarea
                id="ag-obs"
                value={form.observacao}
                maxLength={1000}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                disabled={!podeEditar}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {podeEditar && (
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setForm(null)}>
                {podeEditar ? 'Cancelar' : 'Fechar'}
              </button>
              <div style={{ flex: 1 }} />
              {podeEditar && form.id > 0 &&
                (confirmarRemocao ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      style={{ color: 'var(--danger)' }}
                      disabled={salvando}
                      onClick={remover}
                    >
                      Confirmar remoção
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmarRemocao(false)}>
                      Manter
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn" onClick={() => setConfirmarRemocao(true)}>
                    Remover
                  </button>
                ))}
            </div>
          </div>
        </form>
      )}

      {/* ---------- grade da semana ---------- */}
      <div className="panel">
        <div className="panel-head">
          <div className="section-title">
            Semana de {nomePessoa || '—'}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(5, minmax(130px, 1fr))', minWidth: 720 }}>
            <div />
            {dias.map((d, i) => {
              const carga = cargaDia[d] || 0
              const feriado = feriadoDoDia[d]
              const pct = Math.min(100, (carga / 8) * 100)
              return (
                <div
                  key={d}
                  style={{
                    padding: '8px 8px 6px',
                    borderLeft: '1px solid var(--border)',
                    background: d === hoje ? 'var(--primary-tint)' : undefined,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {DIAS[i]} {dataCurta(d)}
                  </div>
                  {feriado ? (
                    <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>
                      Feriado · {feriado}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: carga > 8 ? 'var(--danger)' : 'var(--ink-muted)' }}>
                        {carga.toFixed(1).replace('.0', '')}h de 8h agendadas
                      </div>
                      <div style={{ height: 4, background: 'var(--surface-sunken)', borderRadius: 2, marginTop: 4 }}>
                        <div
                          style={{
                            width: pct + '%',
                            height: 4,
                            borderRadius: 2,
                            background: carga > 8 ? 'var(--danger)' : carga >= 6 ? 'var(--amber)' : 'var(--primary)',
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* coluna de horas */}
            <div style={{ position: 'relative', height: alturaGrade }}>
              {Array.from({ length: FIM_H - INICIO_H + 1 }, (_, i) => (
                <div
                  key={i}
                  className="mono"
                  style={{
                    position: 'absolute',
                    top: i * PX_HORA - 7,
                    right: 6,
                    fontSize: 10,
                    color: 'var(--ink-faint)',
                  }}
                >
                  {String(INICIO_H + i).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {dias.map((d) => {
              const feriado = feriadoDoDia[d]
              const doDia = compromissos.filter((c) => diaLocal(Date.parse(c.inicio)) === d)
              const prazos = comSla.filter(
                (c) =>
                  c.prazo_sla &&
                  c.sla.chave !== 'pausado' &&
                  diaLocal(Date.parse(c.prazo_sla)) === d
              )

              return (
                <div
                  key={d}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget || feriado) return
                    const y = e.nativeEvent.offsetY
                    const min = INICIO_H * 60 + Math.floor((y / PX_HORA) * 2) * 30
                    novo(d, min)
                  }}
                  title={podeEditar && !feriado ? 'Clique para marcar um compromisso' : undefined}
                  style={{
                    position: 'relative',
                    height: alturaGrade,
                    borderLeft: '1px solid var(--border)',
                    borderTop: '1px solid var(--border)',
                    background: feriado
                      ? 'repeating-linear-gradient(135deg, var(--surface-sunken) 0 6px, transparent 6px 12px)'
                      : `linear-gradient(to bottom, transparent ${topo(ALMOCO[0] * 60)}px, var(--surface-sunken) ${topo(ALMOCO[0] * 60)}px, var(--surface-sunken) ${topo(ALMOCO[1] * 60)}px, transparent ${topo(ALMOCO[1] * 60)}px)`,
                    cursor: podeEditar && !feriado ? 'copy' : 'default',
                  }}
                >
                  {Array.from({ length: FIM_H - INICIO_H - 1 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: (i + 1) * PX_HORA,
                        borderTop: '1px dashed var(--border)',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {doDia.map((c) => {
                    const ini = Date.parse(c.inicio)
                    const fim = Date.parse(c.fim)
                    const top = topo(minutosLocais(ini))
                    const alt = Math.max(22, topo(minutosLocais(fim)) - top)
                    return (
                      <button
                        type="button"
                        key={'c' + c.id}
                        onClick={() => editar(c)}
                        style={{
                          position: 'absolute',
                          left: 3,
                          right: 3,
                          top,
                          height: alt,
                          padding: '3px 6px',
                          textAlign: 'left',
                          overflow: 'hidden',
                          borderRadius: 6,
                          border: '1px solid var(--primary)',
                          background: 'var(--primary-tint)',
                          color: 'var(--primary-strong)',
                          fontSize: 11,
                          lineHeight: 1.3,
                          cursor: 'pointer',
                        }}
                      >
                        <strong>
                          {hhmm(ini)}–{hhmm(fim)}
                        </strong>{' '}
                        {c.titulo}
                        {c.chamado_numero ? ' · #' + c.chamado_numero : ''}
                        {c.local ? ' · ' + c.local : ''}
                      </button>
                    )
                  })}

                  {prazos.map((c) => {
                    const t = Date.parse(c.prazo_sla as string)
                    const cor = corPrazo(c.sla.chave)
                    const estilo: CSSProperties = {
                      position: 'absolute',
                      left: '45%',
                      right: 3,
                      top: Math.min(topo(minutosLocais(t)), alturaGrade - 20) ,
                      minHeight: 18,
                      padding: '2px 5px',
                      borderRadius: 5,
                      borderLeft: '3px solid ' + cor.fg,
                      background: cor.bg,
                      color: cor.fg,
                      fontSize: 10.5,
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      zIndex: 2,
                    }
                    return (
                      <Link
                        key={'p' + c.id}
                        href={'/atendimento/' + c.id}
                        style={estilo}
                        title={'#' + c.numero + ' ' + c.assunto + ' — vence ' + hhmm(t)}
                      >
                        ⏱ {hhmm(t)} #{c.numero} {c.assunto}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel-body" style={{ fontSize: 12, color: 'var(--ink-muted)', paddingTop: 10 }}>
          Blocos verdes: compromissos (clique para abrir). ⏱ Etiquetas: prazo do chamado
          (vermelho = atrasado, amarelo = vence em breve). Faixa cinza: almoço. Dias
          hachurados: feriado. A carga do dia considera só compromissos; chamados não têm
          duração estimada.
        </div>
      </div>

      {/* ---------- chamados e etapas ---------- */}
      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Chamados de {nomePessoa || '—'}</div>
        </div>

        <div className="panel-body" style={{ gap: 18 }}>
          {carregando ? (
            <span style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Carregando...</span>
          ) : chamados.length === 0 ? (
            <span style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Nenhum chamado em aberto.</span>
          ) : (
            (
              [
                ['Atrasados', grupos.atrasados],
                ['Vencem nesta semana', grupos.naSemana],
                ['Vencem depois', grupos.depois],
                ['Aguardando cliente (SLA pausado)', grupos.pausados],
              ] as const
            )
              .filter(([, lista]) => lista.length)
              .map(([titulo, lista]) => (
                <div key={titulo}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
                    {titulo} · {lista.length}
                  </div>

                  {lista.map((c) => {
                    const pend = etapasPorChamado[c.id] || []
                    const cor = corPrazo(c.sla.chave)
                    return (
                      <div
                        key={c.id}
                        style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}
                      >
                        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <Link href={'/atendimento/' + c.id} style={{ color: 'inherit', fontWeight: 600, fontSize: 14 }}>
                            <span className="mono" style={{ color: 'var(--ink-faint)' }}>#{c.numero}</span>{' '}
                            {c.assunto}
                          </Link>
                          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{nomeEmpresa(c)}</span>
                          <span className={'pill' + (c.prioridade === 'urgente' ? ' bad' : c.prioridade === 'alta' ? ' warn' : ' flat')}>
                            {ROTULO_PRIORIDADE[c.prioridade] || c.prioridade}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: cor.fg }}>
                            {c.prazo_sla && c.sla.chave !== 'pausado'
                              ? dataCurta(diaLocal(Date.parse(c.prazo_sla))) + ' ' + hhmm(Date.parse(c.prazo_sla)) + ' · '
                              : ''}
                            {c.sla.texto}
                          </span>
                        </div>

                        {pend.length > 0 && (
                          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>
                            {pend.map((e, i) => (
                              <li key={i}>☐ {e.titulo}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}
