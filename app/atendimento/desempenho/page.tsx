'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Barras } from '@/lib/graficos'
import { marcas } from '@/lib/marca'
import {
  PERIODOS,
  STATUS_EM_ABERTO,
  calcularIndicadores,
  dataConclusao,
  limitesPeriodo,
  percentual,
  textoHoras,
  type ChamadoBase,
  type ChavePeriodo,
  type EventoStatus,
  type Indicadores,
} from '@/lib/desempenho'
import { situacaoSla } from '@/lib/prazo'

/*
 * Desempenho individual da equipe nos chamados.
 *
 * Gestor e admin veem a equipe inteira; quem é do atendimento vê só o
 * próprio resultado. As regras de cada indicador estão em
 * lib/desempenho.ts — esta tela só busca, filtra e desenha.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

/*
 * Referência visual para colorir o % de SLA cumprido. NÃO é exigência
 * de norma nem de contrato: é a meta interna que a gestão definir.
 * Ajuste aqui se a meta for outra.
 */
const META_SLA = 90
const ALERTA_SLA = 75

/* Lotes pequenos para a lista de ids caber na URL do PostgREST. */
const LOTE_IDS = 100
const PAGINA = 1000

type Pessoa = { id: string; nome: string; ativo: boolean }

type Linha = { pessoa: Pessoa; ind: Indicadores; chamados: ChamadoBase[] }

type Coluna =
  | 'nome'
  | 'recebidos'
  | 'concluidos'
  | 'sla'
  | 'resposta'
  | 'resolucao'
  | 'reabertura'
  | 'carteira'
  | 'atrasados'

function partes<T>(lista: T[], tamanho: number) {
  const r: T[][] = []

  for (let i = 0; i < lista.length; i += tamanho) r.push(lista.slice(i, i + tamanho))

  return r
}

/* Busca todas as páginas de uma consulta (o Supabase entrega 1000 por vez). */
async function buscarTudo<T>(montar: () => any): Promise<T[]> {
  const tudo: T[] = []

  for (let de = 0; de < 100000; de += PAGINA) {
    const { data, error } = await montar().range(de, de + PAGINA - 1)

    if (error) throw error

    tudo.push(...((data || []) as T[]))

    if (!data || data.length < PAGINA) break
  }

  return tudo
}

function classeSla(pct: number | null) {
  if (pct === null) return 'tmuted'

  return pct >= META_SLA ? 'bom' : pct >= ALERTA_SLA ? 'atencao' : 'ruim'
}

const corClasse: Record<string, string> = {
  bom: 'var(--success)',
  atencao: 'var(--amber)',
  ruim: 'var(--danger)',
  tmuted: 'var(--ink-faint)',
}

export default function DesempenhoPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ehGestor, setEhGestor] = useState(false)
  const [meuId, setMeuId] = useState('')

  const [periodo, setPeriodo] = useState<ChavePeriodo>('mes')
  const [marca, setMarca] = useState('')
  const [area, setArea] = useState('')
  const [selecionado, setSelecionado] = useState('')
  const [ordem, setOrdem] = useState<{ col: Coluna; desc: boolean }>({
    col: 'concluidos',
    desc: true,
  })

  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [chamados, setChamados] = useState<ChamadoBase[]>([])
  const [eventos, setEventos] = useState<Record<string, EventoStatus[]>>({})
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [etapas, setEtapas] = useState<Record<string, number>>({})

  const { ini, fim } = useMemo(() => limitesPeriodo(periodo), [periodo])

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setCarregando(true)
        setErro('')

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          window.location.href = '/login'
          return
        }

        const { data: perfil, error: perfilErro } = await supabase
          .from('profiles')
          .select('perfil')
          .eq('id', user.id)
          .single()

        if (perfilErro) throw perfilErro

        if (!PERFIS_INTERNOS.includes(perfil?.perfil || '')) {
          window.location.href = '/'
          return
        }

        const gestor = perfil?.perfil === 'admin' || perfil?.perfil === 'gestor'

        if (!ativo) return

        setEhGestor(gestor)
        setMeuId(user.id)
        if (!gestor) setSelecionado(user.id)

        /* Inclui inativos: quem saiu ainda pode ter chamados no período. */
        const { data: pessoasData, error: pessoasErro } = await supabase
          .from('profiles')
          .select('id, nome, ativo')
          .in('perfil', PERFIS_INTERNOS)
          .order('nome')

        if (pessoasErro) throw pessoasErro

        const pessoas = ((pessoasData || []) as any[]).map((p) => ({
          id: p.id,
          nome: p.nome || 'Sem nome',
          ativo: p.ativo !== false,
        }))

        const idsInternos = new Set(pessoas.map((p) => p.id))

        /*
         * Entra tudo que pode virar indicador: aberto no período,
         * concluído no período ou ainda em aberto (carteira atual).
         */
        const desde = ini.toISOString()

        const brutos = await buscarTudo<any>(() =>
          supabase
            .from('chamados')
            .select(
              'id, numero, assunto, categoria, prioridade, status, responsavel_id, prazo_sla, sla_pausado_em, resolvido_em, encerrado_em, created_at, empresas(marca, nome_fantasia, razao_social)'
            )
            .or(
              `created_at.gte.${desde},resolvido_em.gte.${desde},encerrado_em.gte.${desde},status.in.(${STATUS_EM_ABERTO.join(',')})`
            )
            .order('created_at')
        )

        const lista: ChamadoBase[] = brutos.map((c) => {
          const emp = Array.isArray(c.empresas) ? c.empresas[0] : c.empresas

          return {
            id: c.id,
            numero: c.numero,
            assunto: c.assunto || '',
            categoria: c.categoria,
            prioridade: c.prioridade,
            status: c.status,
            responsavel_id: c.responsavel_id,
            prazo_sla: c.prazo_sla,
            sla_pausado_em: c.sla_pausado_em,
            resolvido_em: c.resolvido_em,
            encerrado_em: c.encerrado_em,
            created_at: c.created_at,
            marca: emp?.marca || null,
            empresa: emp?.nome_fantasia || emp?.razao_social || 'Empresa',
          }
        })

        /* Histórico de status: só dos concluídos no período. */
        const idsConcluidos = lista
          .filter((c) => {
            const d = dataConclusao(c)

            return d && new Date(d) >= ini && new Date(d) < fim
          })
          .map((c) => c.id)

        const idsRecebidos = lista
          .filter((c) => new Date(c.created_at) >= ini && new Date(c.created_at) < fim)
          .map((c) => c.id)

        const idsAbertos = lista
          .filter((c) => STATUS_EM_ABERTO.includes(c.status))
          .map((c) => c.id)

        const porChamado: Record<string, EventoStatus[]> = {}

        for (const lote of partes(idsConcluidos, LOTE_IDS)) {
          const evs = await buscarTudo<EventoStatus>(() =>
            supabase
              .from('chamado_eventos')
              .select('chamado_id, de, para, created_at')
              .eq('tipo', 'status')
              .in('chamado_id', lote)
              .order('created_at')
          )

          evs.forEach((e) => {
            ;(porChamado[e.chamado_id] ||= []).push(e)
          })
        }

        /* Primeira mensagem humana da equipe em cada chamado recebido. */
        const primeira: Record<string, string> = {}

        for (const lote of partes(idsRecebidos, LOTE_IDS)) {
          let msgs: any[]

          try {
            msgs = await buscarTudo<any>(() =>
              supabase
                .from('chamado_mensagens')
                .select('chamado_id, autor_id, automatica, created_at')
                .in('chamado_id', lote)
                .order('created_at')
            )
          } catch {
            /* Banco sem a coluna "automatica": toda mensagem tem autor. */
            msgs = await buscarTudo<any>(() =>
              supabase
                .from('chamado_mensagens')
                .select('chamado_id, autor_id, created_at')
                .in('chamado_id', lote)
                .order('created_at')
            )
          }

          msgs.forEach((m) => {
            if (m.automatica) return
            if (!m.autor_id || !idsInternos.has(m.autor_id)) return
            if (!primeira[m.chamado_id]) primeira[m.chamado_id] = m.created_at
          })
        }

        /* % de etapas concluídas da carteira aberta. */
        const pct: Record<string, number> = {}

        for (const lote of partes(idsAbertos, LOTE_IDS)) {
          const { data: prog, error: progErro } = await supabase
            .from('v_chamados_progresso')
            .select('chamado_id, percentual')
            .in('chamado_id', lote)

          /* Sem a view (script de etapas não rodado): segue sem o indicador. */
          if (progErro) break

          ;((prog || []) as any[]).forEach((p) => {
            pct[p.chamado_id] = Number(p.percentual) || 0
          })
        }

        if (!ativo) return

        setEquipe(pessoas)
        setChamados(lista)
        setEventos(porChamado)
        setRespostas(primeira)
        setEtapas(pct)
      } catch (e: any) {
        console.error(e)
        if (ativo) setErro(e?.message || 'Não foi possível carregar o desempenho.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [ini, fim])

  /* Áreas presentes nos dados, para o filtro. */
  const areas = useMemo(
    () => [...new Set(chamados.map((c) => c.categoria || 'Sem área'))].sort(),
    [chamados]
  )

  const filtrados = useMemo(
    () =>
      chamados.filter(
        (c) =>
          (!marca || c.marca === marca) &&
          (!area || (c.categoria || 'Sem área') === area)
      ),
    [chamados, marca, area]
  )

  const calc = (lista: ChamadoBase[]) =>
    calcularIndicadores({
      chamados: lista,
      ini,
      fim,
      eventosPorChamado: eventos,
      primeiraRespostaPorChamado: respostas,
      etapasPorChamado: etapas,
    })

  const linhas: Linha[] = useMemo(() => {
    const porPessoa: Record<string, ChamadoBase[]> = {}

    filtrados.forEach((c) => {
      if (c.responsavel_id) (porPessoa[c.responsavel_id] ||= []).push(c)
    })

    return equipe
      .filter((p) => (ehGestor ? true : p.id === meuId))
      .map((p) => ({ pessoa: p, chamados: porPessoa[p.id] || [], ind: calc(porPessoa[p.id] || []) }))
      /* Inativo sem nada no período não precisa aparecer. */
      .filter((l) => l.pessoa.ativo || l.chamados.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, equipe, ehGestor, meuId, eventos, respostas, etapas])

  const valorColuna = (l: Linha, col: Coluna): number | string => {
    const i = l.ind

    switch (col) {
      case 'nome':
        return l.pessoa.nome.toLowerCase()
      case 'recebidos':
        return i.recebidos
      case 'concluidos':
        return i.concluidos
      case 'sla':
        return percentual(i.slaCumpridos, i.slaAvaliados) ?? -1
      case 'resposta':
        return i.primeiraRespostaMediana ?? Number.MAX_VALUE
      case 'resolucao':
        return i.resolucaoMediana ?? Number.MAX_VALUE
      case 'reabertura':
        return percentual(i.reabertos, i.concluidos) ?? -1
      case 'carteira':
        return i.carteira
      case 'atrasados':
        return i.atrasados
    }
  }

  const ordenadas = useMemo(() => {
    const l = [...linhas]

    l.sort((a, b) => {
      const va = valorColuna(a, ordem.col)
      const vb = valorColuna(b, ordem.col)
      const r = va < vb ? -1 : va > vb ? 1 : 0

      return ordem.desc ? -r : r
    })

    return l
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, ordem])

  const equipeTotal = useMemo(
    () => calc(filtrados.filter((c) => c.responsavel_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrados, eventos, respostas, etapas]
  )

  const semDono = filtrados.filter(
    (c) => !c.responsavel_id && STATUS_EM_ABERTO.includes(c.status)
  ).length

  const resumo = ehGestor ? equipeTotal : linhas[0]?.ind || equipeTotal

  const detalhe = linhas.find((l) => l.pessoa.id === selecionado) || null

  function ordenarPor(col: Coluna) {
    /* No primeiro clique: nome e "quanto menor, melhor" em ordem crescente. */
    const crescente: Coluna[] = ['nome', 'resposta', 'resolucao', 'reabertura']

    setOrdem((o) =>
      o.col === col ? { col, desc: !o.desc } : { col, desc: !crescente.includes(col) }
    )
  }

  const slaEquipe = percentual(resumo.slaCumpridos, resumo.slaAvaliados)
  const reaberturaEquipe = percentual(resumo.reabertos, resumo.concluidos)

  const rotuloPeriodo = PERIODOS.find((p) => p.chave === periodo)?.rotulo || ''

  const fmtData = (d: Date) =>
    d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const fimInclusivo = new Date(fim.getTime() - 1)

  const colunas: { col: Coluna; rotulo: string; dica: string }[] = [
    { col: 'nome', rotulo: 'Atendente', dica: 'Responsável atual do chamado' },
    { col: 'recebidos', rotulo: 'Recebidos', dica: 'Abertos no período e hoje no nome da pessoa' },
    { col: 'concluidos', rotulo: 'Concluídos', dica: 'Resolvidos ou encerrados no período' },
    { col: 'sla', rotulo: 'SLA', dica: '% dos concluídos dentro do prazo (horas úteis, pausas descontadas)' },
    { col: 'resposta', rotulo: '1ª resposta', dica: 'Mediana, em horas úteis, até a 1ª mensagem humana da equipe' },
    { col: 'resolucao', rotulo: 'Resolução', dica: 'Mediana, em horas úteis, sem o tempo com o cliente' },
    { col: 'reabertura', rotulo: 'Reabertura', dica: '% dos concluídos que voltaram para atendimento' },
    { col: 'carteira', rotulo: 'Carteira', dica: 'Chamados em aberto agora' },
    { col: 'atrasados', rotulo: 'Atrasados', dica: 'Em aberto com prazo vencido agora' },
  ]

  const grade = '1.6fr repeat(8, minmax(74px, 1fr))'

  /* Matriz área x atendente (concluídos no período). */
  const matriz = useMemo(() => {
    const areasMatriz = [...new Set(filtrados.map((c) => c.categoria || 'Sem área'))].sort()

    return {
      areas: areasMatriz,
      linhas: ordenadas.map((l) => {
        const conta: Record<string, number> = {}

        l.chamados.forEach((c) => {
          const d = dataConclusao(c)

          if (d && new Date(d) >= ini && new Date(d) < fim) {
            const a = c.categoria || 'Sem área'
            conta[a] = (conta[a] || 0) + 1
          }
        })

        return { pessoa: l.pessoa, conta }
      }),
    }
  }, [filtrados, ordenadas, ini, fim])

  function concluidosPor(lista: ChamadoBase[], chave: (c: ChamadoBase) => string) {
    const conta: Record<string, number> = {}

    lista.forEach((c) => {
      const d = dataConclusao(c)

      if (d && new Date(d) >= ini && new Date(d) < fim) {
        const k = chave(c)
        conta[k] = (conta[k] || 0) + 1
      }
    })

    return Object.entries(conta)
      .map(([rotulo, valor]) => ({ rotulo, valor }))
      .sort((a, b) => b.valor - a.valor)
  }

  const nomeMarca = (m: string | null) =>
    m === 'agilmed' || m === 'reallife' ? marcas[m].nome : 'Sem marca'

  return (
    <div className="app">
      <div>
        <div className="section-title">Atendimento</div>
        <h1 style={{ fontSize: 30, marginTop: 6 }}>Desempenho da equipe</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--ink-muted)', fontSize: 14 }}>
          {ehGestor
            ? 'Resultado individual de cada atendente nos chamados'
            : 'O seu resultado nos chamados'}
          {' · '}
          {rotuloPeriodo} ({fmtData(ini)} a {fmtData(fimInclusivo)}) · prazos em horas úteis
        </p>
      </div>

      <div className="filters">
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as ChavePeriodo)}>
          {PERIODOS.map((p) => (
            <option key={p.chave} value={p.chave}>
              {p.rotulo}
            </option>
          ))}
        </select>

        <select value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas as marcas</option>
          <option value="agilmed">{marcas.agilmed.nome}</option>
          <option value="reallife">{marcas.reallife.nome}</option>
        </select>

        <select value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {ehGestor && (
          <select value={selecionado} onChange={(e) => setSelecionado(e.target.value)}>
            <option value="">Detalhar atendente...</option>
            {linhas.map((l) => (
              <option key={l.pessoa.id} value={l.pessoa.id}>
                {l.pessoa.nome}
              </option>
            ))}
          </select>
        )}

        <div style={{ flex: 1 }} />

        <Link href="/atendimento/prioridades" className="btn btn-sm">
          Fila de prioridades
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {ehGestor && semDono > 0 && (
        <Link href="/atendimento?responsavel=sem" className="banner bad" style={{ display: 'block' }}>
          {semDono} chamado(s) em aberto sem responsável — não entram no resultado de ninguém.
        </Link>
      )}

      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat">
          <div className="num">{carregando ? '—' : resumo.concluidos}</div>
          <div className="lbl">Concluídos no período</div>
        </div>

        <div className={'stat' + (slaEquipe === null ? '' : slaEquipe >= META_SLA ? ' good' : slaEquipe >= ALERTA_SLA ? ' warn' : ' bad')}>
          <div className="num">{carregando || slaEquipe === null ? '—' : slaEquipe + '%'}</div>
          <div className="lbl">SLA cumprido ({resumo.slaAvaliados} avaliados)</div>
        </div>

        <div className="stat">
          <div className="num" style={{ fontSize: 22 }}>
            {carregando ? '—' : textoHoras(resumo.primeiraRespostaMediana)}
          </div>
          <div className="lbl">1ª resposta (mediana)</div>
        </div>

        <div className="stat">
          <div className="num" style={{ fontSize: 22 }}>
            {carregando ? '—' : textoHoras(resumo.resolucaoMediana)}
          </div>
          <div className="lbl">Resolução (mediana)</div>
        </div>

        <div className={'stat' + (reaberturaEquipe && reaberturaEquipe > 0 ? ' warn' : '')}>
          <div className="num">{carregando || reaberturaEquipe === null ? '—' : reaberturaEquipe + '%'}</div>
          <div className="lbl">Reabertura</div>
        </div>

        <div className={'stat' + (resumo.atrasados > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : resumo.atrasados + '/' + resumo.carteira}</div>
          <div className="lbl">Atrasados / carteira</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <div className="trow thead" style={{ gridTemplateColumns: grade, minWidth: 900 }}>
            {colunas.map((c) => (
              <button
                key={c.col}
                type="button"
                title={c.dica}
                onClick={() => ordenarPor(c.col)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  textAlign: c.col === 'nome' ? 'left' : 'right',
                  color: ordem.col === c.col ? 'var(--ink)' : undefined,
                }}
              >
                {c.rotulo}
                {ordem.col === c.col ? (ordem.desc ? ' ↓' : ' ↑') : ''}
              </button>
            ))}
          </div>

          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : ordenadas.length === 0 ? (
            <div className="empty-state">Nenhum atendente com chamados nesse filtro.</div>
          ) : (
            ordenadas.map((l) => {
              const i = l.ind
              const sla = percentual(i.slaCumpridos, i.slaAvaliados)
              const reab = percentual(i.reabertos, i.concluidos)
              const ativoLinha = l.pessoa.id === selecionado

              return (
                <div
                  key={l.pessoa.id}
                  className="trow"
                  onClick={() => setSelecionado(ativoLinha && ehGestor ? '' : l.pessoa.id)}
                  style={{
                    gridTemplateColumns: grade,
                    minWidth: 900,
                    cursor: 'pointer',
                    background: ativoLinha ? 'var(--primary-tint)' : undefined,
                  }}
                >
                  <span className="tname">
                    {l.pessoa.nome}
                    {!l.pessoa.ativo && (
                      <span className="pill flat" style={{ marginLeft: 6, fontSize: 10 }}>
                        inativo
                      </span>
                    )}
                  </span>
                  <span className="mono" style={{ textAlign: 'right' }}>{i.recebidos}</span>
                  <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{i.concluidos}</span>
                  <span
                    className="mono"
                    title={i.slaCumpridos + ' de ' + i.slaAvaliados + ' no prazo'}
                    style={{ textAlign: 'right', fontWeight: 700, color: corClasse[classeSla(sla)] }}
                  >
                    {sla === null ? '—' : sla + '%'}
                  </span>
                  <span
                    className="mono"
                    title={i.primeiraRespostaAmostra + ' chamado(s) medido(s)'}
                    style={{ textAlign: 'right' }}
                  >
                    {textoHoras(i.primeiraRespostaMediana)}
                  </span>
                  <span className="mono" style={{ textAlign: 'right' }}>
                    {textoHoras(i.resolucaoMediana)}
                  </span>
                  <span
                    className="mono"
                    title={i.reabertos + ' reaberto(s)'}
                    style={{ textAlign: 'right', color: reab ? 'var(--amber)' : undefined }}
                  >
                    {reab === null ? '—' : reab + '%'}
                  </span>
                  <span className="mono" style={{ textAlign: 'right' }}>
                    {i.carteira}
                    {i.urgentes > 0 && (
                      <span style={{ color: 'var(--danger)', fontSize: 11 }}> ({i.urgentes} urg.)</span>
                    )}
                  </span>
                  <span
                    className="mono"
                    style={{ textAlign: 'right', fontWeight: 700, color: i.atrasados ? 'var(--danger)' : 'var(--ink-faint)' }}
                  >
                    {i.atrasados}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {ehGestor && !carregando && ordenadas.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Concluídos por atendente</div>
            </div>
            <div className="panel-body">
              <Barras
                barras={[...linhas]
                  .sort((a, b) => b.ind.concluidos - a.ind.concluidos)
                  .map((l) => ({
                    rotulo: l.pessoa.nome,
                    valor: l.ind.concluidos,
                    detalhe: l.ind.recebidos + ' recebidos',
                  }))}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">SLA cumprido por atendente</div>
              <span className="pill flat">meta interna {META_SLA}%</span>
            </div>
            <div className="panel-body">
              <Barras
                sufixo="%"
                vazio="Nenhum chamado concluído com prazo no período."
                barras={linhas
                  .filter((l) => l.ind.slaAvaliados > 0)
                  .map((l) => {
                    const p = percentual(l.ind.slaCumpridos, l.ind.slaAvaliados) as number

                    return {
                      rotulo: l.pessoa.nome,
                      valor: p,
                      detalhe: l.ind.slaCumpridos + '/' + l.ind.slaAvaliados,
                      cor: corClasse[classeSla(p)],
                    }
                  })
                  .sort((a, b) => b.valor - a.valor)}
              />
            </div>
          </div>
        </div>
      )}

      {ehGestor && !carregando && matriz.areas.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Concluídos por área e atendente</div>
          </div>
          <div className="panel-body" style={{ overflowX: 'auto' }}>
            <table className="matriz">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Atendente</th>
                  {matriz.areas.map((a) => (
                    <th key={a}>{a}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {matriz.linhas.map((l) => {
                  const total = Object.values(l.conta).reduce((s, v) => s + v, 0)

                  return (
                    <tr key={l.pessoa.id}>
                      <th scope="row">{l.pessoa.nome}</th>
                      {matriz.areas.map((a) => (
                        <td key={a} className="mono" style={{ color: l.conta[a] ? undefined : 'var(--ink-faint)' }}>
                          {l.conta[a] || '·'}
                        </td>
                      ))}
                      <td className="mono" style={{ fontWeight: 700 }}>{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detalhe && !carregando && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">
              {ehGestor ? 'Detalhe · ' + detalhe.pessoa.nome : 'Meu detalhe'}
            </div>
            <Link
              href={'/atendimento/prioridades'}
              className="btn btn-sm"
            >
              Ver fila
            </Link>
          </div>

          <div className="panel-body">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 18,
              }}
            >
              <div>
                <div className="section-title" style={{ marginBottom: 10 }}>Concluídos por área</div>
                <Barras
                  vazio="Nada concluído no período."
                  barras={concluidosPor(detalhe.chamados, (c) => c.categoria || 'Sem área')}
                />
              </div>

              <div>
                <div className="section-title" style={{ marginBottom: 10 }}>Concluídos por marca</div>
                <Barras
                  vazio="Nada concluído no período."
                  barras={concluidosPor(detalhe.chamados, (c) => nomeMarca(c.marca)).map((b) => ({
                    ...b,
                    cor:
                      b.rotulo === marcas.agilmed.nome
                        ? marcas.agilmed.principal
                        : b.rotulo === marcas.reallife.nome
                          ? marcas.reallife.principal
                          : undefined,
                  }))}
                />
              </div>

              <div>
                <div className="section-title" style={{ marginBottom: 10 }}>Carteira agora</div>
                <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <span>Em aberto: <b className="mono">{detalhe.ind.carteira}</b></span>
                  <span>Urgentes: <b className="mono">{detalhe.ind.urgentes}</b></span>
                  <span>Aguardando cliente: <b className="mono">{detalhe.ind.aguardandoCliente}</b></span>
                  <span>
                    Atrasados:{' '}
                    <b className="mono" style={{ color: detalhe.ind.atrasados ? 'var(--danger)' : undefined }}>
                      {detalhe.ind.atrasados}
                    </b>
                  </span>
                  <span>
                    Etapas concluídas (média):{' '}
                    <b className="mono">
                      {detalhe.ind.etapasMedia === null ? '—' : Math.round(detalhe.ind.etapasMedia) + '%'}
                    </b>
                    {detalhe.ind.etapasAmostra > 0 && (
                      <span style={{ color: 'var(--ink-faint)' }}> em {detalhe.ind.etapasAmostra} chamado(s)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {(() => {
              const atrasados = detalhe.chamados.filter(
                (c) => STATUS_EM_ABERTO.includes(c.status) && situacaoSla(c).chave === 'atrasado'
              )

              if (atrasados.length === 0) return null

              return (
                <div>
                  <div className="section-title" style={{ margin: '6px 0 8px' }}>Atrasados agora</div>
                  {atrasados.map((c) => (
                    <Link
                      key={c.id}
                      href={'/atendimento/' + c.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '54px 1fr auto',
                        gap: 12,
                        padding: '9px 2px',
                        borderTop: '1px solid var(--border)',
                        color: 'inherit',
                        fontSize: 13,
                      }}
                    >
                      <span className="mono" style={{ color: 'var(--ink-faint)' }}>#{c.numero ?? ''}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.assunto} <span style={{ color: 'var(--ink-muted)' }}>· {c.empresa}</span>
                      </span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{situacaoSla(c).texto}</span>
                    </Link>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      <div className="footnote" style={{ textAlign: 'left', lineHeight: 1.6 }}>
        Como ler: o chamado conta para o responsável atual. Tempos em horas úteis (seg–sex,
        08–12h e 13–17h, Brasília), pela mediana. Resolução desconta o tempo em “Aguardando
        cliente” e em “Resolvido” antes de reabrir. 1ª resposta = primeira mensagem escrita
        por alguém da equipe (mensagens automáticas não contam). Carteira e atrasados são o
        retrato de agora. A meta de {META_SLA}% de SLA é referência interna, não exigência normativa.
      </div>
    </div>
  )
}
