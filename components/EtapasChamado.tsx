'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Sublista de etapas do chamado, com % de conclusão.
 *
 * - Equipe (editavel): cria, marca, renomeia, reordena, define se o
 *   cliente vê e remove etapas. O % mostrado é sobre TODAS as etapas.
 * - Cliente: só lê. A RLS já entrega apenas as etapas visíveis, então
 *   o % dele é sobre as etapas que ele enxerga. Sem etapas visíveis,
 *   o cartão não aparece.
 *
 * Tabela: chamado_etapas (supabase/chamados-etapas-e-encerramento-automatico.sql)
 */

export type Etapa = {
  id: number
  titulo: string
  ordem: number
  concluida: boolean
  visivel_cliente: boolean
  concluida_em: string | null
}

type Props = {
  chamadoId: string
  editavel: boolean
  cor?: string
  cardStyle?: React.CSSProperties
  titleStyle?: React.CSSProperties
  /* Bloqueia edição (ex.: chamado encerrado). */
  somenteLeitura?: boolean
}

export function percentualDe(etapas: { concluida: boolean }[]) {
  if (!etapas.length) return 0

  return Math.round(
    (100 * etapas.filter((e) => e.concluida).length) / etapas.length
  )
}

export function BarraProgresso({
  percentual,
  cor = '#0f766e',
  altura = 8,
}: {
  percentual: number
  cor?: string
  altura?: number
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percentual}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: '100%',
        height: altura,
        background: '#e2e8f0',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: percentual + '%',
          height: '100%',
          background: percentual === 100 ? '#16a34a' : cor,
          transition: 'width .3s ease',
        }}
      />
    </div>
  )
}

function formatarData(valor: string | null) {
  if (!valor) return ''

  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function EtapasChamado({
  chamadoId,
  editavel,
  cor = '#0f766e',
  cardStyle,
  titleStyle,
  somenteLeitura = false,
}: Props) {
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaInterna, setNovaInterna] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [textoEdicao, setTextoEdicao] = useState('')

  const podeEditar = editavel && !somenteLeitura

  async function carregar() {
    const { data, error } = await supabase
      .from('chamado_etapas')
      .select('id, titulo, ordem, concluida, visivel_cliente, concluida_em')
      .eq('chamado_id', chamadoId)
      .order('ordem')
      .order('id')

    if (error) {
      /* Tabela ainda não criada no banco: esconde o recurso sem quebrar a página. */
      console.error('Etapas do chamado:', error)
      setIndisponivel(true)
    } else {
      setEtapas((data || []) as Etapa[])
    }

    setCarregando(false)
  }

  useEffect(() => {
    if (chamadoId) carregar()
  }, [chamadoId])

  async function adicionar(event: React.FormEvent) {
    event.preventDefault()

    const titulo = novoTitulo.trim()

    if (!titulo) return

    setSalvando(true)
    setErro('')

    const ordem = etapas.length ? Math.max(...etapas.map((e) => e.ordem)) + 1 : 1

    const { data, error } = await supabase
      .from('chamado_etapas')
      .insert({
        chamado_id: chamadoId,
        titulo,
        ordem,
        visivel_cliente: !novaInterna,
      })
      .select('id, titulo, ordem, concluida, visivel_cliente, concluida_em')
      .single()

    if (error) {
      console.error(error)
      setErro('Não foi possível adicionar a etapa.')
    } else if (data) {
      setEtapas((atual) => [...atual, data as Etapa])
      setNovoTitulo('')
      setNovaInterna(false)
    }

    setSalvando(false)
  }

  async function atualizar(id: number, campos: Partial<Etapa>) {
    setErro('')

    const anterior = etapas

    setEtapas((atual) =>
      atual.map((e) => (e.id === id ? { ...e, ...campos } : e))
    )

    const { data, error } = await supabase
      .from('chamado_etapas')
      .update(campos)
      .eq('id', id)
      .select('id, titulo, ordem, concluida, visivel_cliente, concluida_em')
      .single()

    if (error) {
      console.error(error)
      setErro('Não foi possível salvar a alteração.')
      setEtapas(anterior)
      return
    }

    setEtapas((atual) =>
      atual.map((e) => (e.id === id ? (data as Etapa) : e))
    )
  }

  async function remover(etapa: Etapa) {
    if (!window.confirm('Remover a etapa "' + etapa.titulo + '"?')) return

    setErro('')

    const { error } = await supabase
      .from('chamado_etapas')
      .delete()
      .eq('id', etapa.id)

    if (error) {
      console.error(error)
      setErro('Não foi possível remover a etapa.')
      return
    }

    setEtapas((atual) => atual.filter((e) => e.id !== etapa.id))
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao

    if (alvo < 0 || alvo >= etapas.length) return

    const a = etapas[indice]
    const b = etapas[alvo]

    /* Troca as posições; renumera para evitar ordens repetidas. */
    const nova = [...etapas]
    nova[indice] = b
    nova[alvo] = a

    const renumerada = nova.map((e, i) => ({ ...e, ordem: i + 1 }))

    setEtapas(renumerada)

    const mudaram = renumerada.filter(
      (e) => etapas.find((x) => x.id === e.id)?.ordem !== e.ordem
    )

    const resultados = await Promise.all(
      mudaram.map((e) =>
        supabase.from('chamado_etapas').update({ ordem: e.ordem }).eq('id', e.id)
      )
    )

    if (resultados.some((r) => r.error)) {
      setErro('Não foi possível reordenar. Recarregue a página.')
    }
  }

  async function salvarTitulo(etapa: Etapa) {
    const titulo = textoEdicao.trim()

    setEditandoId(null)

    if (!titulo || titulo === etapa.titulo) return

    await atualizar(etapa.id, { titulo })
  }

  if (carregando || indisponivel) return null

  /* Cliente sem etapas visíveis: nada a mostrar. */
  if (!editavel && etapas.length === 0) return null

  const percentual = percentualDe(etapas)
  const concluidas = etapas.filter((e) => e.concluida).length
  const visiveis = etapas.filter((e) => e.visivel_cliente)
  const percentualCliente = percentualDe(visiveis)
  const temInternas = visiveis.length !== etapas.length

  return (
    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={titleStyle}>Etapas do atendimento</h2>

        {etapas.length > 0 && (
          <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            {percentual}%
          </span>
        )}
      </div>

      {etapas.length > 0 && (
        <>
          <BarraProgresso percentual={percentual} cor={cor} />

          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              margin: '8px 0 14px',
            }}
          >
            {concluidas} de {etapas.length} etapa(s) concluída(s)
            {editavel && temInternas && (
              <>
                {' · '}o cliente vê {percentualCliente}% (só etapas visíveis)
              </>
            )}
          </div>
        </>
      )}

      {editavel && etapas.length === 0 && (
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
          Divida o atendimento em etapas para acompanhar o percentual de
          conclusão. Prefira etapas de tamanho parecido: o % é calculado
          pela quantidade de etapas concluídas.
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {etapas.map((etapa, i) => (
          <li
            key={etapa.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              background: etapa.concluida ? '#f8fafc' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={etapa.concluida}
              disabled={!podeEditar}
              onChange={(e) => atualizar(etapa.id, { concluida: e.target.checked })}
              aria-label={'Concluir ' + etapa.titulo}
              style={{ width: 18, height: 18, accentColor: cor, flexShrink: 0 }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              {editandoId === etapa.id ? (
                <input
                  autoFocus
                  value={textoEdicao}
                  maxLength={200}
                  onChange={(e) => setTextoEdicao(e.target.value)}
                  onBlur={() => salvarTitulo(etapa)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarTitulo(etapa)
                    if (e.key === 'Escape') setEditandoId(null)
                  }}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 6px',
                    fontSize: 14,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={() => {
                    if (!podeEditar) return
                    setEditandoId(etapa.id)
                    setTextoEdicao(etapa.titulo)
                  }}
                  title={podeEditar ? 'Duplo clique para renomear' : undefined}
                  style={{
                    fontSize: 14,
                    color: etapa.concluida ? '#64748b' : '#0f172a',
                    textDecoration: etapa.concluida ? 'line-through' : 'none',
                    wordBreak: 'break-word',
                  }}
                >
                  {etapa.titulo}
                </span>
              )}

              {(etapa.concluida_em || (editavel && !etapa.visivel_cliente)) && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {etapa.concluida_em && 'Concluída em ' + formatarData(etapa.concluida_em)}
                  {etapa.concluida_em && editavel && !etapa.visivel_cliente && ' · '}
                  {editavel && !etapa.visivel_cliente && 'Só equipe'}
                </div>
              )}
            </div>

            {podeEditar && (
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <BotaoIcone
                  titulo={etapa.visivel_cliente ? 'Ocultar do cliente' : 'Mostrar ao cliente'}
                  onClick={() =>
                    atualizar(etapa.id, { visivel_cliente: !etapa.visivel_cliente })
                  }
                >
                  {etapa.visivel_cliente ? '👁' : '🔒'}
                </BotaoIcone>
                <BotaoIcone titulo="Subir" onClick={() => mover(i, -1)} desativado={i === 0}>
                  ↑
                </BotaoIcone>
                <BotaoIcone
                  titulo="Descer"
                  onClick={() => mover(i, 1)}
                  desativado={i === etapas.length - 1}
                >
                  ↓
                </BotaoIcone>
                <BotaoIcone titulo="Remover" onClick={() => remover(etapa)}>
                  ✕
                </BotaoIcone>
              </div>
            )}
          </li>
        ))}
      </ul>

      {podeEditar && (
        <form
          onSubmit={adicionar}
          style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            placeholder="Nova etapa (ex.: Visita técnica, Emissão do laudo)"
            maxLength={200}
            style={{
              flex: '1 1 220px',
              border: '1px solid #cbd5e1',
              borderRadius: 9,
              padding: '9px 12px',
              fontSize: 14,
            }}
          />

          <label style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={novaInterna}
              onChange={(e) => setNovaInterna(e.target.checked)}
            />
            Só equipe
          </label>

          <button
            type="submit"
            disabled={salvando || !novoTitulo.trim()}
            style={{
              background: cor,
              color: '#ffffff',
              border: 0,
              borderRadius: 9,
              padding: '9px 14px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              opacity: salvando || !novoTitulo.trim() ? 0.6 : 1,
            }}
          >
            Adicionar
          </button>
        </form>
      )}

      {erro && (
        <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 10 }}>{erro}</div>
      )}
    </section>
  )
}

function BotaoIcone({
  children,
  titulo,
  onClick,
  desativado,
}: {
  children: React.ReactNode
  titulo: string
  onClick: () => void
  desativado?: boolean
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={desativado}
      style={{
        border: 0,
        background: 'transparent',
        cursor: desativado ? 'default' : 'pointer',
        opacity: desativado ? 0.3 : 0.75,
        fontSize: 13,
        padding: '4px 6px',
        borderRadius: 6,
      }}
    >
      {children}
    </button>
  )
}
