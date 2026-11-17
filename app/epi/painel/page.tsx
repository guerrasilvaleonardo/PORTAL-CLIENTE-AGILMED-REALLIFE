'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Rosca, Barras } from '@/lib/graficos'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import EpiAbas from '@/components/EpiAbas'
import '../../colaboradores/colaboradores.css'
import '../entregas.css'

/*
 * Painel de EPI — o que está acontecendo com os equipamentos.
 *
 * Cada empresa vê só o que é dela; quem é da Real Life escolhe no
 * filtro. É a resposta a três perguntas que a gente só conseguia
 * responder abrindo a lista entrega por entrega: o que está vencido,
 * quem não assinou e quanto a empresa está entregando.
 *
 * Os números saem das entregas que já estão na tela de Entregas —
 * nenhuma consulta nova de agregação no banco. Com o volume de hoje
 * (centenas de entregas por empresa) isso é mais rápido do que ir e
 * voltar ao servidor, e o filtro de período responde na hora.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

/* Quanto tempo o painel olha para trás. 90 dias é o padrão porque a
 * vida útil mais comum de EPI fica entre 3 e 6 meses: é o que mostra
 * um ciclo inteiro sem afogar a tela. */
const PERIODOS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 180, rotulo: '6 meses' },
  { dias: 365, rotulo: '1 ano' },
]

/* O prazo que ainda dá para providenciar a troca sem a pessoa ficar
 * sem equipamento. */
const DIAS_PROXIMO = 30

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Item = {
  nome: string
  complemento: string | null
  ca: string | null
  quantidade: number
  troca_em: string
  devolvido_em: string | null
  devolucao_motivo: string | null
}

type Entrega = {
  id: string
  empresa_id: string
  entregue_em: string
  assinado_em: string | null
  cancelada_em: string | null
  entregue_por_nome: string | null
  local_nome: string | null
  colaborador_id: string
  colaboradores: { nome: string } | null
  epi_entregas_itens: Item[]
}

const hojeBrasilia = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

/* Dias entre hoje e a data (negativo quando já passou). */
function diasAte(iso: string): number {
  const hoje = new Date(hojeBrasilia() + 'T12:00:00')
  const alvo = new Date(iso + 'T12:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/* "nov/26" — o rótulo que cabe na barra sem virar abreviação ilegível. */
function rotuloMes(iso: string): string {
  const d = new Date(iso)
  return `${MES_CURTO[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
}

/* Conta ocorrências e devolve as maiores, já no formato das barras. */
function ranking(
  pares: (string | null)[],
  limite = 8,
  vazio = '— sem nome —'
): { rotulo: string; valor: number }[] {
  const conta = new Map<string, number>()
  for (const p of pares) {
    const chave = (p || '').trim() || vazio
    conta.set(chave, (conta.get(chave) || 0) + 1)
  }
  return [...conta.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite)
}

export default function PainelEpi() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [interno, setInterno] = useState(false)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [periodo, setPeriodo] = useState(90)

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

      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('perfil')
        .eq('id', user.id)
        .single()
      if (perfilError) throw perfilError

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const { data, error } = await supabase
        .from('epi_entregas')
        .select(
          'id, empresa_id, entregue_em, assinado_em, cancelada_em, entregue_por_nome, ' +
            'local_nome, colaborador_id, colaboradores(nome), ' +
            'epi_entregas_itens(nome, complemento, ca, quantidade, troca_em, devolvido_em, devolucao_motivo)'
        )
        .order('entregue_em', { ascending: false })
        .limit(2000)

      if (error) {
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setEntregas(
        ((data || []) as any[]).map((e) => ({
          ...e,
          colaboradores: Array.isArray(e.colaboradores) ? e.colaboradores[0] : e.colaboradores,
        })) as Entrega[]
      )
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar o painel.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const numeros = useMemo(() => {
    const limite = new Date()
    limite.setDate(limite.getDate() - periodo)

    /* Entrega cancelada não entra em conta nenhuma: ela não aconteceu. */
    const vivas = entregas.filter(
      (e) => !e.cancelada_em && (!empresaFiltro || e.empresa_id === empresaFiltro)
    )
    const noPeriodo = vivas.filter((e) => new Date(e.entregue_em) >= limite)

    const itensNoPeriodo = noPeriodo.flatMap((e) => e.epi_entregas_itens)

    /* "Em uso" olha TODAS as entregas, não só as do período: o EPI que
     * a pessoa pegou há oito meses continua com ela hoje. */
    const emUso = vivas.flatMap((e) => e.epi_entregas_itens).filter((i) => !i.devolvido_em)

    const prazos = emUso.map((i) => diasAte(i.troca_em))
    const vencidos = prazos.filter((d) => d < 0).length
    const proximos = prazos.filter((d) => d >= 0 && d <= DIAS_PROXIMO).length
    const tranquilos = prazos.filter((d) => d > DIAS_PROXIMO).length

    const devolvidos = vivas
      .flatMap((e) => e.epi_entregas_itens)
      .filter((i) => i.devolvido_em && new Date(i.devolvido_em) >= limite).length

    const porMes = new Map<string, number>()
    for (const e of noPeriodo) {
      const chave = rotuloMes(e.entregue_em)
      porMes.set(chave, (porMes.get(chave) || 0) + 1)
    }

    return {
      entregas: noPeriodo.length,
      itens: itensNoPeriodo.reduce((s, i) => s + i.quantidade, 0),
      trabalhadores: new Set(noPeriodo.map((e) => e.colaborador_id)).size,
      semAssinatura: vivas.filter((e) => !e.assinado_em).length,
      devolvidos,
      emUso: emUso.length,
      vencidos,
      proximos,
      tranquilos,
      /* Invertido porque o mapa veio do mais recente para o mais antigo. */
      porMes: [...porMes.entries()].reverse().map(([rotulo, valor]) => ({ rotulo, valor })),
      porResponsavel: ranking(
        noPeriodo.map((e) => e.entregue_por_nome),
        8,
        '— não informado —'
      ),
      porEquipamento: ranking(
        itensNoPeriodo.map((i) => (i.complemento ? `${i.nome} · ${i.complemento}` : i.nome))
      ),
      porTrabalhador: ranking(noPeriodo.map((e) => e.colaboradores?.nome || null)),
      porLocal: ranking(noPeriodo.map((e) => e.local_nome), 8, '— sem local —'),
    }
  }, [entregas, empresaFiltro, periodo])

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          O módulo de EPI ainda não foi criado no banco. Rode{' '}
          <code>supabase/epi-entregas.sql</code> no SQL Editor do Supabase.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <EpiAbas />

      <div>
        <p className="eyebrow">EPI</p>
        <h1 className="titulo-tela">Painel</h1>
        <p className="subtitulo-tela">
          O que está vencido, quem ainda não assinou e quanto a empresa está entregando. Os prazos
          olham tudo que está em uso hoje; o resto acompanha o período escolhido.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {!carregando && numeros.vencidos > 0 && (
        <div className="banner bad">
          {numeros.vencidos} equipamento{numeros.vencidos > 1 ? 's' : ''} com a troca vencida e
          ainda em uso. É o primeiro item que a fiscalização cobra.
        </div>
      )}

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <div className="field" style={{ minWidth: 150 }}>
          <label htmlFor="periodo-painel">Período</label>
          <select
            id="periodo-painel"
            value={periodo}
            onChange={(e) => setPeriodo(Number(e.target.value))}
          >
            {PERIODOS.map((p) => (
              <option key={p.dias} value={p.dias}>
                Últimos {p.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Seis numeros em tres colunas: em quatro sobrariam dois
          soltos na segunda linha. */}
      <div
        className="stats"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}
      >
        <div className="stat">
          <div className="num">{numeros.entregas}</div>
          <div className="lbl">Entregas no período</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.itens}</div>
          <div className="lbl">Equipamentos entregues</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.trabalhadores}</div>
          <div className="lbl">Trabalhadores atendidos</div>
        </div>
        <div className="stat warn">
          <div className="num">{numeros.semAssinatura}</div>
          <div className="lbl">Aguardando assinatura</div>
        </div>
        <div className="stat bad">
          <div className="num">{numeros.vencidos}</div>
          <div className="lbl">Com troca vencida</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.devolvidos}</div>
          <div className="lbl">Devolvidos no período</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 14,
        }}
      >
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Situação da troca</div>
          </div>
          <div className="panel-body">
            {carregando ? (
              <div className="empty-state">Carregando…</div>
            ) : numeros.emUso === 0 ? (
              <div className="empty-state">Nenhum equipamento em uso.</div>
            ) : (
              <Rosca
                centro={numeros.emUso}
                legendaCentro="em uso"
                fatias={[
                  { rotulo: 'Troca vencida', valor: numeros.vencidos, cor: 'var(--danger)' },
                  {
                    rotulo: `Vence em até ${DIAS_PROXIMO} dias`,
                    valor: numeros.proximos,
                    cor: 'var(--amber)',
                  },
                  { rotulo: 'Dentro do prazo', valor: numeros.tranquilos, cor: 'var(--success)' },
                ]}
              />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Entregas por mês</div>
          </div>
          <div className="panel-body">
            {carregando ? (
              <div className="empty-state">Carregando…</div>
            ) : (
              <Barras barras={numeros.porMes} vazio="Nenhuma entrega no período." />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Quem entregou</div>
          </div>
          <div className="panel-body">
            {carregando ? (
              <div className="empty-state">Carregando…</div>
            ) : (
              <Barras barras={numeros.porResponsavel} vazio="Nenhuma entrega no período." />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Equipamentos mais entregues</div>
          </div>
          <div className="panel-body">
            {carregando ? (
              <div className="empty-state">Carregando…</div>
            ) : (
              <Barras barras={numeros.porEquipamento} vazio="Nenhuma entrega no período." />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Quem mais recebeu</div>
          </div>
          <div className="panel-body">
            {carregando ? (
              <div className="empty-state">Carregando…</div>
            ) : (
              <Barras barras={numeros.porTrabalhador} vazio="Nenhuma entrega no período." />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Entregas por local</div>
          </div>
          <div className="panel-body">
            {carregando ? (
              <div className="empty-state">Carregando…</div>
            ) : (
              <Barras
                barras={numeros.porLocal}
                vazio="Nenhuma entrega no período."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
