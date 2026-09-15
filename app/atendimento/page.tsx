'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = { nome_fantasia: string; marca: string | null }
type Chamado = {
  id: string
  numero: number | null
  empresa_id: string
  categoria: string
  assunto: string
  prioridade: string
  status: string
  created_at: string
  updated_at: string
  prazo_sla: string | null
  empresa: Empresa | null
}
type FiltroStatus = 'todos' | 'aberto' | 'em_atendimento' | 'aguardando_cliente' | 'resolvido' | 'encerrado'
type FiltroPrioridade = 'todas' | 'urgente' | 'alta' | 'normal' | 'baixa'
type Indicadores = {
  total: number; abertos: number; emAtendimento: number; aguardandoCliente: number
  resolvidos: number; encerrados: number; urgentes: number; altos: number
  slaAtrasado: number; slaProximo: number; slaNoPrazo: number; semSla: number
}

const SLA_ALERTA_HORAS = 2
const statusLabels: Record<string, string> = { aberto: 'Aberto', em_atendimento: 'Em atendimento', aguardando_cliente: 'Aguardando cliente', resolvido: 'Resolvido', encerrado: 'Encerrado' }
const prioridadeLabels: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' }

function normalizar(valor: string | null | undefined) {
  return String(valor || '').trim().toLowerCase().replace(/\s+/g, '_')
}
function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data))
}
function finalizado(c: Chamado) { return ['resolvido', 'encerrado'].includes(normalizar(c.status)) }
function atrasado(c: Chamado, agora: number) { return !!c.prazo_sla && !finalizado(c) && new Date(c.prazo_sla).getTime() < agora }
function proximo(c: Chamado, agora: number) {
  if (!c.prazo_sla || finalizado(c)) return false
  const restante = new Date(c.prazo_sla).getTime() - agora
  return restante > 0 && restante <= SLA_ALERTA_HORAS * 60 * 60 * 1000
}
function restante(prazo: string | null, agora: number) {
  if (!prazo) return 'Sem SLA'
  const ms = new Date(prazo).getTime() - agora
  if (ms <= 0) return 'Prazo vencido'
  const min = Math.floor(ms / 60000)
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
  if (d) return `${d}d ${h}h restantes`
  if (h) return `${h}h ${m}min restantes`
  return `${m}min restantes`
}
function calcularIndicadores(lista: Chamado[], agora: number): Indicadores {
  const status = (s: string) => lista.filter(c => normalizar(c.status) === s).length
  return {
    total: lista.length, abertos: status('aberto'), emAtendimento: status('em_atendimento'),
    aguardandoCliente: status('aguardando_cliente'), resolvidos: status('resolvido'), encerrados: status('encerrado'),
    urgentes: lista.filter(c => normalizar(c.prioridade) === 'urgente').length,
    altos: lista.filter(c => normalizar(c.prioridade) === 'alta').length,
    slaAtrasado: lista.filter(c => atrasado(c, agora)).length,
    slaProximo: lista.filter(c => proximo(c, agora)).length,
    slaNoPrazo: lista.filter(c => !!c.prazo_sla && !finalizado(c) && !atrasado(c, agora)).length,
    semSla: lista.filter(c => !c.prazo_sla).length,
  }
}

function Card({ titulo, valor, cor = '#0f172a', fundo = '#fff', borda = '#e2e8f0', onClick }: { titulo: string; valor: number; cor?: string; fundo?: string; borda?: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} disabled={!onClick} style={{ textAlign: 'left', border: `1px solid ${borda}`, background: fundo, borderRadius: 14, padding: 18, cursor: onClick ? 'pointer' : 'default', width: '100%' }}>
    <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase' }}>{titulo}</div>
    <div style={{ color: cor, fontSize: 30, lineHeight: 1, fontWeight: 800 }}>{valor}</div>
  </button>
}

function DashboardEmpresa({ nome, lista, agora, cor, onStatus }: { nome: string; lista: Chamado[]; agora: number; cor: string; onStatus: (s: FiltroStatus) => void }) {
  const i = calcularIndicadores(lista, agora)
  const cards: Array<[string, number, FiltroStatus | undefined]> = [['Total', i.total, 'todos'], ['Abertos', i.abertos, 'aberto'], ['Em atendimento', i.emAtendimento, 'em_atendimento'], ['Aguardando cliente', i.aguardandoCliente, 'aguardando_cliente'], ['Resolvidos', i.resolvidos, 'resolvido'], ['Urgentes', i.urgentes, undefined]]
  return <section style={{ background: '#fff', border: `1px solid ${cor}33`, borderRadius: 18, padding: 20, marginBottom: 22 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <div><div style={{ color: cor, fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Dashboard por empresa</div><h2 style={{ margin: '5px 0 0', fontSize: 22, color: '#0f172a' }}>{nome}</h2></div>
      <span style={{ background: `${cor}12`, color: cor, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 800 }}>{i.total} chamado(s)</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
      {cards.map(([titulo, valor, filtro]) => <Card key={titulo} titulo={titulo} valor={valor} cor={titulo === 'Urgentes' ? '#b91c1c' : cor} fundo={titulo === 'Urgentes' ? '#fef2f2' : '#fff'} borda={titulo === 'Urgentes' ? '#fecaca' : `${cor}33`} onClick={filtro ? () => onStatus(filtro) : undefined} />)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 10 }}>
      <Card titulo="SLA atrasado" valor={i.slaAtrasado} cor="#b91c1c" fundo="#fef2f2" borda="#fecaca" />
      <Card titulo="SLA próximo" valor={i.slaProximo} cor="#b45309" fundo="#fffbeb" borda="#fde68a" />
      <Card titulo="SLA no prazo" valor={i.slaNoPrazo} cor="#15803d" fundo="#f0fdf4" borda="#bbf7d0" />
      <Card titulo="Sem SLA" valor={i.semSla} />
    </div>
  </section>
}

export default function AtendimentoPage() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState<FiltroPrioridade>('todas')
  const [busca, setBusca] = useState('')
  const [agora, setAgora] = useState(() => Date.now())

  async function carregarChamados() {
    try {
      setCarregando(true); setErro('')
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) { window.location.href = '/login'; return }
      const { data, error } = await supabase.from('chamados').select(`id,numero,empresa_id,categoria,assunto,prioridade,status,created_at,updated_at,prazo_sla,empresas(nome_fantasia,marca)`).order('created_at', { ascending: false })
      if (error) throw error
      setChamados((data || []).map((item: any) => {
        const e = Array.isArray(item.empresas) ? item.empresas[0] : item.empresas
        return { id: item.id, numero: item.numero, empresa_id: item.empresa_id, categoria: item.categoria, assunto: item.assunto, prioridade: item.prioridade, status: item.status, created_at: item.created_at, updated_at: item.updated_at, prazo_sla: item.prazo_sla || null, empresa: e ? { nome_fantasia: e.nome_fantasia || 'Empresa não identificada', marca: e.marca || null } : null }
      }))
    } catch (e: any) { console.error(e); setErro(e?.message || 'Não foi possível carregar os chamados.'); setChamados([]) }
    finally { setCarregando(false) }
  }
  useEffect(() => { carregarChamados() }, [])
  useEffect(() => { const id = window.setInterval(() => setAgora(Date.now()), 60000); return () => window.clearInterval(id) }, [])

  const indicadores = useMemo(() => calcularIndicadores(chamados, agora), [chamados, agora])
  const porEmpresa = useMemo(() => {
    const agilmed = chamados.filter(c => normalizar(c.empresa?.marca) === 'agilmed')
    const reallife = chamados.filter(c => normalizar(c.empresa?.marca) === 'reallife')
    return { agilmed, reallife }
  }, [chamados])
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return chamados.filter(c => {
      const s = normalizar(c.status), p = normalizar(c.prioridade)
      if (filtroStatus !== 'todos' && s !== filtroStatus) return false
      if (filtroPrioridade !== 'todas' && p !== filtroPrioridade) return false
      if (!termo) return true
      return [c.numero, c.assunto, c.categoria, c.empresa?.nome_fantasia, c.empresa?.marca, s, p].join(' ').toLowerCase().includes(termo)
    })
  }, [chamados, filtroStatus, filtroPrioridade, busca])
  const definirStatus = (s: FiltroStatus) => { setFiltroStatus(s); setFiltroPrioridade('todas'); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) }

  const empresaNome = (marca: string) => marca === 'agilmed' ? 'ÁgilMed Ocupacional' : 'Real Life SSMA'
  const empresaCor = (marca: string) => marca === 'agilmed' ? '#2563eb' : '#0f766e'

  return <main style={{ minHeight: 'calc(100vh - 70px)', background: '#f8fafc', padding: '32px 24px 60px' }}>
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
        <div><div style={{ color: '#0f766e', fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' }}>Atendimento interno</div><h1 style={{ margin: '6px 0 0', color: '#0f172a', fontSize: 32 }}>Central de Atendimento</h1><p style={{ margin: '9px 0 0', color: '#64748b' }}>Visão consolidada de ÁgilMed e Real Life, com dashboards por empresa e tabela unificada.</p></div>
        <button type="button" onClick={carregarChamados} disabled={carregando} style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 10, padding: '11px 16px', cursor: carregando ? 'not-allowed' : 'pointer', fontWeight: 800 }}>{carregando ? 'Atualizando...' : '↻ Atualizar'}</button>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, margin: '0 0 12px', color: '#0f172a' }}>Dashboard geral</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Card titulo="Total" valor={indicadores.total} onClick={() => definirStatus('todos')} />
          <Card titulo="Abertos" valor={indicadores.abertos} cor="#1d4ed8" fundo="#eff6ff" borda="#bfdbfe" onClick={() => definirStatus('aberto')} />
          <Card titulo="Em atendimento" valor={indicadores.emAtendimento} cor="#b45309" fundo="#fffbeb" borda="#fde68a" onClick={() => definirStatus('em_atendimento')} />
          <Card titulo="Aguardando cliente" valor={indicadores.aguardandoCliente} cor="#7e22ce" fundo="#faf5ff" borda="#e9d5ff" onClick={() => definirStatus('aguardando_cliente')} />
          <Card titulo="Resolvidos" valor={indicadores.resolvidos} cor="#15803d" fundo="#f0fdf4" borda="#bbf7d0" onClick={() => definirStatus('resolvido')} />
          <Card titulo="Urgentes" valor={indicadores.urgentes} cor="#b91c1c" fundo="#fef2f2" borda="#fecaca" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 10 }}><Card titulo="SLA atrasado" valor={indicadores.slaAtrasado} cor="#b91c1c" fundo="#fef2f2" borda="#fecaca" /><Card titulo="SLA próximo" valor={indicadores.slaProximo} cor="#b45309" fundo="#fffbeb" borda="#fde68a" /><Card titulo="SLA no prazo" valor={indicadores.slaNoPrazo} cor="#15803d" fundo="#f0fdf4" borda="#bbf7d0" /><Card titulo="Sem SLA" valor={indicadores.semSla} /></div>
      </section>

      <DashboardEmpresa nome={empresaNome('agilmed')} lista={porEmpresa.agilmed} agora={agora} cor={empresaCor('agilmed')} onStatus={definirStatus} />
      <DashboardEmpresa nome={empresaNome('reallife')} lista={porEmpresa.reallife} agora={agora} cor={empresaCor('reallife')} onStatus={definirStatus} />

      {erro && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 12, padding: 14, marginBottom: 16, fontWeight: 700 }}>Erro: {erro}</div>}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: 20, borderBottom: '1px solid #e2e8f0' }}><h2 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>Todos os chamados</h2><p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>{filtrados.length} resultado(s) exibido(s)</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) 190px 190px', gap: 10, padding: 16, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por chamado, assunto, empresa..." style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff' }} />
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as FiltroStatus)} style={{ padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff' }}><option value="todos">Todos os status</option>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value as FiltroPrioridade)} style={{ padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff' }}><option value="todas">Todas as prioridades</option>{Object.entries(prioridadeLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        {carregando ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando chamados...</div> : filtrados.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Nenhum chamado encontrado.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}><thead><tr style={{ background: '#f8fafc' }}>{['Chamado','Empresa','Assunto','Categoria','Prioridade','Status','SLA','Abertura',''].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}</tr></thead><tbody>{filtrados.map(c => { const a = atrasado(c, agora), p = proximo(c, agora); const marca = normalizar(c.empresa?.marca); const cor = marca === 'agilmed' ? '#2563eb' : '#0f766e'; return <tr key={c.id}><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', fontWeight: 800, whiteSpace: 'nowrap' }}>#{c.numero ?? '—'}</td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}><span style={{ color: cor, fontWeight: 800 }}>{c.empresa?.nome_fantasia || '—'}</span></td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', minWidth: 220 }}>{c.assunto}</td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9' }}>{c.categoria}</td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9' }}><span style={{ background: c.prioridade === 'urgente' ? '#fee2e2' : c.prioridade === 'alta' ? '#ffedd5' : '#f1f5f9', color: c.prioridade === 'urgente' ? '#b91c1c' : c.prioridade === 'alta' ? '#c2410c' : '#475569', borderRadius: 999, padding: '5px 9px', fontSize: 12, fontWeight: 800 }}>{prioridadeLabels[normalizar(c.prioridade)] || c.prioridade}</span></td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9' }}><span style={{ background: '#f1f5f9', color: '#334155', borderRadius: 999, padding: '5px 9px', fontSize: 12, fontWeight: 800 }}>{statusLabels[normalizar(c.status)] || c.status}</span></td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', minWidth: 170 }}><div style={{ color: a ? '#b91c1c' : p ? '#b45309' : '#15803d', fontWeight: 800, fontSize: 12 }}>{a ? '🔴 Atrasado' : p ? '🟡 Próximo do vencimento' : c.prazo_sla ? '🟢 No prazo' : '⚪ Sem SLA'}</div><div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{restante(c.prazo_sla, agora)}</div></td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', color: '#64748b', fontSize: 12 }}>{formatarData(c.created_at)}</td><td style={{ padding: 14, borderBottom: '1px solid #f1f5f9' }}><Link href={`/atendimento/${c.id}`} style={{ color: cor, fontWeight: 800, textDecoration: 'none' }}>Abrir →</Link></td></tr>})}</tbody></table></div>}
      </section>
    </div>
  </main>
}
