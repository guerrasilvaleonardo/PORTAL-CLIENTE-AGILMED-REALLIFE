'use client'

import type { ReactNode } from 'react'
import { MODULOS, linkContratacao, useModulos, type Modulo } from '@/lib/modulos'

/*
 * Envolve a página de uma ferramenta cobrada à parte. Cliente sem a
 * ferramenta contratada vê a apresentação dela e o botão para pedir a
 * contratação por chamado; quem tem acesso (ou a equipe) vê a página.
 */
export function ComModulo({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const acesso = useModulos()

  if (acesso.carregando) {
    return (
      <div className="app">
        <div className="empty-state">Carregando...</div>
      </div>
    )
  }

  if (!acesso.liberado(modulo)) return <ModuloBloqueado modulo={modulo} />

  return <>{children}</>
}

export function ModuloBloqueado({ modulo }: { modulo: Modulo }) {
  const info = MODULOS[modulo]

  return (
    <div className="app">
      <div className="panel" style={{ maxWidth: 720, margin: '24px auto' }}>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 28 }}>
          <div className="section-title">Ferramenta não contratada</div>
          <h1 style={{ fontSize: 28 }}>
            <span aria-hidden="true">🔒 </span>
            {info.rotulo}
          </h1>
          <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 15 }}>{info.resumo}</p>

          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', fontSize: 14, lineHeight: 1.7 }}>
            {info.beneficios.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 13.5 }}>
            Esta ferramenta é contratada à parte. Peça a contratação por chamado: nossa equipe envia a proposta e, aprovada,
            libera o acesso para todos os usuários da sua empresa.
          </p>

          <div>
            <a className="btn btn-primary" href={linkContratacao(modulo)}>
              Solicitar contratação
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
