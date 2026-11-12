'use client'

import FiltroEmpresa from '@/components/FiltroEmpresa'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { carregarFeriados } from '@/lib/feriados'
import { situacaoSla } from '@/lib/prazo'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import { HORAS_ARQUIVAR } from '@/lib/revisaoSuspensao'

/*
 * Histórico de chamados: encerrados e cancelados.
 *
 * O quadro mostra Encerrado e Cancelado só por 72 horas corridas; depois
 * eles ficam aqui. Nada é excluído nem muda de situação: continuam na
 * busca do quadro, nos indicadores, no dashboard e nas estrelas.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const POR_PAGINA = 25
const PAGINA_BANCO = 1000

type Situacao = '' | 'encerrado' | 'cancelado'

const PERIODOS = [
  { id: '30', rotulo: 'Últimos 30 dias', dias: 30 },
  { id: '90', rotulo: 'Últimos 90 dias', dias: 90 },
  { id: '365', rotulo: 'Últimos 12 meses', dias: 365 },
  { id: 'tudo', rotulo: 'Todo o período', dias: 0 },
] as const

type Linha = {
  id: string
  numero: number
  assunto: string
  categoria: string
  status: string
  empresa_id: string
  empresa: string
  responsavel_id: string | null
  responsavel: string
  prazo_sla: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  cancelado_em: string | null
  saida: string | null
}

function dataCurta(iso: string | null) {
  if (!iso) return '—'

  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Porto_Velho' })
}

async function lerTudo(comCancelamento: boolean) {
  const campos =
    'id, numero, assunto, categoria, status, empresa_id, responsavel_id, prazo_sla, resolvido_em, encerrado_em, created_at' +
    (comCancelamento ? ', cancelado_em' : '') +
    ', empresas(nome_fantasia, razao_social), responsavel:profiles!chamados_responsavel_id_fkey(nome)'

  const todos: any[] = []

  for (let de = 0; de < 50000; de += PAGINA_BANCO) {
    const { data, error } = await supabase
      .from('chamados')
      .select(campos)
      .in('status', ['encerrado', 'cancelado'])
      .order('created_at', { ascending: false })
      .range(de, de + PAGINA_BANCO - 1)

    if (error) return { dados: todos, error }

    todos.push(...(data || []))

    if (!data || data.length < PAGINA_BANCO) break
  }

  return { dados: todos, error: null }
}

export default function HistoricoPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])

  const [situacao, setSituacao] = useState<Situacao>('')
  const [busca, setBusca] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [periodo, setPeriodo] = useState<string>('90')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('situacao')

    if (q === 'encerrado' || q === 'cancelado') setSituacao(q)

    async function carregar() {
      try {
        setCarregando(true)
        setErro('')

        await carregarFeriados(supabase)

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

        /* Sem o SQL de cancelamento a coluna cancelado_em não existe: lê sem ela. */
        let r = await lerTudo(true)

        if (r.error && /cancelado_em|42703/.test((r.error.code || '') + ' ' + (r.error.message || ''))) {
          r = await lerTudo(false)
        }

        if (r.error) throw r.error

        setLinhas(
          r.dados.map((c: any) => {
            const emp = Array.isArray(c.empresas) ? c.empresas[0] : c.empresas
            const resp = Array.isArray(c.responsavel) ? c.responsavel[0] : c.responsavel
            const saida = c.status === 'cancelado' ? c.cancelado_em || null : c.encerrado_em

            return {
              id: c.id,
              numero: c.numero,
              assunto: c.assunto || '',
              categoria: c.categoria || '',
              status: c.status,
              empresa_id: c.empresa_id,
              empresa: emp?.nome_fantasia || emp?.razao_social || 'Empresa',
              responsavel_id: c.responsavel_id,
              responsavel: resp?.nome || 'Sem responsável',
              prazo_sla: c.prazo_sla,
              resolvido_em: c.resolvido_em,
              encerrado_em: c.encerrado_em,
              cancelado_em: c.cancelado_em || null,
              saida,
            } as Linha
          })
        )
      } catch (e: any) {
        console.error(e)
        setErro(e?.message || 'Não foi possível carregar o histórico.')
      } finally {
        setCarregando(false)
      }
    }

    carregar()
  }, [])

  const palavras = useMemo(() => palavrasDaBusca(busca), [busca])

  const empresas = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const l of linhas) if (!mapa.has(l.empresa_id)) mapa.set(l.empresa_id, l.empresa)

    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [linhas])

  const pessoas = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const l of linhas) if (l.responsavel_id && !mapa.has(l.responsavel_id)) mapa.set(l.responsavel_id, l.responsavel)

    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [linhas])

  /* Filtros menos a aba, para os contadores das abas. */
  const semAba = useMemo(() => {
    const dias = PERIODOS.find((p) => p.id === periodo)?.dias || 0
    const desde = dias ? Date.now() - dias * 86400000 : 0

    return linhas
      .filter((l) => !empresa || l.empresa_id === empresa)
      .filter((l) => !responsavel || l.responsavel_id === responsavel)
      /* Sem data de saída (registro antigo): entra em qualquer período. */
      .filter((l) => !desde || !l.saida || new Date(l.saida).getTime() >= desde)
      .filter(
        (l) =>
          !palavras.length ||
          casaBusca([l.numero, l.assunto, l.categoria, l.empresa, l.responsavel].join(' '), palavras)
      )
      .sort((a, b) => (b.saida || '').localeCompare(a.saida || ''))
  }, [linhas, empresa, responsavel, periodo, palavras])

  const lista = useMemo(
    () => (situacao ? semAba.filter((l) => l.status === situacao) : semAba),
    [semAba, situacao]
  )

  useEffect(() => setPagina(1), [situacao, busca, empresa, responsavel, periodo])

  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const visiveis = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const contagem = {
    '': semAba.length,
    encerrado: semAba.filter((l) => l.status === 'encerrado').length,
    cancelado: semAba.filter((l) => l.status === 'cancelado').length,
  }

  const abas: { id: Situacao; rotulo: string }[] = [
    { id: '', rotulo: 'Todos' },
    { id: 'encerrado', rotulo: 'Encerrados' },
    { id: 'cancelado', rotulo: 'Cancelados' },
  ]

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <Link href="/atendimento" className="section-title">
            ← Voltar ao quadro
          </Link>
          <h1 style={{ fontSize: 26, marginTop: 6 }}>Histórico de chamados</h1>
        </div>
      </div>

      <div className="banner" role="note" style={{ background: 'var(--primary-tint)', color: 'var(--primary-strong)' }}>
        Chamados encerrados ou cancelados saem do quadro {HORAS_ARQUIVAR} horas depois e ficam aqui. Nada é
        excluído: eles continuam na busca do quadro, nos indicadores, no dashboard da equipe e nas estrelas.
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div role="tablist" aria-label="Situação" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {abas.map((a) => (
          <button
            key={a.id || 'todos'}
            type="button"
            role="tab"
            aria-selected={situacao === a.id}
            className={'btn' + (situacao === a.id ? ' btn-primary' : '')}
            onClick={() => setSituacao(a.id)}
          >
            {a.rotulo} · {carregando ? '—' : contagem[a.id]}
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          type="search"
          aria-label="Buscar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nº, assunto, empresa ou responsável"
        />

        <FiltroEmpresa valor={empresa} aoMudar={setEmpresa} opcoes={empresas.map(([id, nome]) => ({ id, nome }))} />

        <select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>

        <select aria-label="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {pessoas.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <div className="trow thead" style={{ gridTemplateColumns: '70px 2fr 1.3fr 110px 110px 1.2fr 1fr 60px' }}>
            <span>Nº</span>
            <span>Assunto</span>
            <span>Empresa</span>
            <span>Situação</span>
            <span>Saída</span>
            <span>Prazo</span>
            <span>Responsável</span>
            <span />
          </div>

          {carregando ? (
            <div className="empty-state">Carregando…</div>
          ) : visiveis.length === 0 ? (
            <div className="empty-state">Nenhum chamado encontrado com esses filtros.</div>
          ) : (
            visiveis.map((l) => {
              const sla = situacaoSla(l)

              return (
                <div
                  key={l.id}
                  className="trow"
                  style={{ gridTemplateColumns: '70px 2fr 1.3fr 110px 110px 1.2fr 1fr 60px' }}
                >
                  <span className="tcode">#{l.numero}</span>
                  <span className="tname">{l.assunto}</span>
                  <span className="tmuted">{l.empresa}</span>
                  <span>
                    <span className={'pill ' + (l.status === 'encerrado' ? 'good' : 'flat')}>
                      {l.status === 'encerrado' ? 'Encerrado' : 'Cancelado'}
                    </span>
                  </span>
                  <span className="tmuted" style={{ fontFamily: 'IBM Plex Mono' }}>
                    {dataCurta(l.saida)}
                  </span>
                  <span className="tmuted" style={sla.chave === 'descumprido' ? { color: 'var(--danger)' } : undefined}>
                    {sla.texto}
                  </span>
                  <span className="tmuted">{l.responsavel}</span>
                  <span>
                    <Link href={'/atendimento/' + l.id} className="btn btn-sm">
                      Abrir
                    </Link>
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {paginas > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            Página {pagina} de {paginas} · {lista.length} chamados
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={pagina >= paginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
