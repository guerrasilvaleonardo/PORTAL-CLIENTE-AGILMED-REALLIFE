'use client'

import { useEffect, useRef, useState } from 'react'
import { EMOJIS, type Reacao } from '@/lib/reacoes'

/*
 * Reações de uma mensagem: os emojis já usados (com contagem e quem
 * reagiu ao passar o mouse) e o botão para reagir. Clicar na própria
 * reação retira; escolher outro emoji troca.
 */
export default function Reacoes({
  reacoes,
  meuId,
  nomes,
  onReagir,
  alinharDireita = false,
}: {
  reacoes: Reacao[]
  meuId: string | null
  nomes: Record<string, string>
  onReagir: (emoji: string) => void
  alinharDireita?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const grupos = EMOJIS.map((emoji) => {
    const de = reacoes.filter((r) => r.emoji === emoji)
    return { emoji, de, meu: de.some((r) => r.usuario_id === meuId) }
  }).filter((g) => g.de.length > 0)

  const quem = (de: Reacao[]) =>
    de.map((r) => (r.usuario_id === meuId ? 'Você' : nomes[r.usuario_id] || 'Alguém')).join(', ')

  return (
    <div
      ref={caixa}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        alignItems: 'center',
        marginTop: 4,
        justifyContent: alinharDireita ? 'flex-end' : 'flex-start',
        position: 'relative',
      }}
    >
      {grupos.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => meuId && onReagir(g.emoji)}
          title={quem(g.de) + (g.meu ? ' · clique para retirar a sua' : '')}
          aria-label={`${g.emoji} ${g.de.length}: ${quem(g.de)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid ' + (g.meu ? '#0f766e' : '#e2e8f0'),
            background: g.meu ? '#ccfbf1' : '#fff',
            fontSize: 13,
            cursor: meuId ? 'pointer' : 'default',
            lineHeight: 1.4,
          }}
        >
          <span>{g.emoji}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>{g.de.length}</span>
        </button>
      ))}

      {meuId && (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          title="Reagir"
          aria-label="Reagir à mensagem"
          aria-expanded={aberto}
          style={{
            border: '1px solid #e2e8f0',
            background: '#fff',
            borderRadius: 999,
            padding: '1px 8px',
            fontSize: 13,
            color: '#64748b',
            cursor: 'pointer',
            lineHeight: 1.5,
          }}
        >
          ☺+
        </button>
      )}

      {aberto && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: '100%',
            [alinharDireita ? 'right' : 'left']: 0,
            marginBottom: 4,
            display: 'flex',
            gap: 2,
            padding: 4,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 999,
            boxShadow: '0 6px 20px rgba(15,23,42,.15)',
            zIndex: 20,
          }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false)
                onReagir(e)
              }}
              aria-label={'Reagir com ' + e}
              style={{ border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer', padding: '2px 4px', borderRadius: 999 }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
