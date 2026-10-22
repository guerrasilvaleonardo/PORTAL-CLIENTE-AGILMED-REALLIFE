'use client'

import { useState } from 'react'
import { trocarEmpresaAtiva, useMinhasEmpresas } from '@/lib/minhasEmpresas'

/*
 * Seletor de empresa ativa no topo, só para quem atende mais de uma
 * empresa. Ao trocar, o portal volta ao Início já com a outra empresa.
 */
export default function SeletorEmpresa() {
  const lista = useMinhasEmpresas(true)
  const [trocando, setTrocando] = useState(false)

  if (lista.length < 2) return null

  const ativa = lista.find((e) => e.ativa)

  async function trocar(id: string) {
    if (!id || id === ativa?.id) return
    try {
      setTrocando(true)
      await trocarEmpresaAtiva(id)
      window.location.href = '/'
    } catch (e: any) {
      window.alert(e?.message || 'Não foi possível trocar de empresa.')
      setTrocando(false)
    }
  }

  return (
    <label
      title="Você atende mais de uma empresa. O portal mostra os dados da empresa escolhida aqui."
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-muted)', fontWeight: 600 }}
    >
      Empresa
      <select
        value={ativa?.id || ''}
        disabled={trocando}
        onChange={(e) => trocar(e.target.value)}
        aria-label="Empresa ativa"
        style={{ maxWidth: 240, fontSize: 13, padding: '5px 8px' }}
      >
        {lista.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
