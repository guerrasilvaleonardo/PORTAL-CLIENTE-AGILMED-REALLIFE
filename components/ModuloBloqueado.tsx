'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { MODULOS, linkContratacao, useModulos, type Modulo } from '@/lib/modulos'
import Icone from '@/components/Icone'
import '@/app/vitrine.css'

/*
 * Envolve a página de uma ferramenta cobrada à parte. Cliente sem a
 * ferramenta contratada vê a vitrine dela e o botão para pedir a
 * proposta por chamado; quem tem acesso (ou a equipe) vê a página.
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

const PASSOS = ['Peça a proposta', 'Receba o valor pelo chamado', 'Aprovou, liberamos para todos da empresa']

/*
 * Vitrine da ferramenta não contratada: o que ela resolve, o que entrega
 * e como contratar. O botão abre um chamado já preenchido (linkContratacao).
 */
export function ModuloBloqueado({ modulo }: { modulo: Modulo }) {
  const info = MODULOS[modulo]

  return (
    <div className="app">
      <div className="panel vitrine" style={{ maxWidth: 820, width: '100%', margin: '12px auto' }}>
        <div className="panel-body" style={{ gap: 20, padding: 'clamp(18px, 4vw, 32px)' }}>
          <span className="mod-selo">
            <Icone nome="cadeado" tamanho={13} /> Disponível para contratar
          </span>

          <div className="vitrine-topo">
            <span className="mod-icone" style={{ width: 56, height: 56 }}>
              <Icone nome={modulo} tamanho={28} />
            </span>
            <div>
              <div className="section-title">{info.rotulo}</div>
              <h1 style={{ fontSize: 'clamp(22px, 3vw, 28px)', lineHeight: 1.25, marginTop: 4 }}>{info.chamada}</h1>
            </div>
          </div>

          <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 15 }}>{info.resumo}</p>

          <div className="vitrine-beneficios">
            {info.beneficios.map((b) => (
              <div key={b} className="vitrine-beneficio">
                <span className="vitrine-marca" aria-hidden="true">
                  <Icone nome="feito" tamanho={20} />
                </span>
                <span>{b}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>Como contratar</div>
            <ol className="vitrine-passos">
              {PASSOS.map((p, i) => (
                <li key={p}>
                  <span className="vitrine-num">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          </div>

          <div className="vitrine-acao">
            <a className="btn btn-primary" href={linkContratacao(modulo)}>
              Quero uma proposta
            </a>
            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              Sem compromisso. Já incluso em alguns contratos: pergunte.
            </span>
          </div>

          <Link href="/contratar" className="mod-go" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Ver tudo o que dá para contratar <Icone nome="seta" tamanho={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
