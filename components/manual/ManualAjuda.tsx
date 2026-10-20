'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Capitulo, Manual } from '@/lib/manual/tipos'
import TelaIlustrada from './TelaIlustrada'
import './manual.css'

/*
 * Botão "?" do cabeçalho + manual em slides.
 *
 * - Cliente vê o Manual do Cliente; equipe interna vê o Manual do Time.
 * - Abre no capítulo da tela em que a pessoa está.
 * - Só visualização: não há botão de baixar nem imprimir, e o manual
 *   bloqueia impressão, cópia, menu do botão direito e arrastar.
 *   Isso desestimula a cópia, mas não impede um print da tela; por
 *   isso cada slide leva o e-mail de quem está vendo como marca d'água.
 */

function capituloDaRota(capitulos: Capitulo[], rota: string) {
  let melhor = 0
  let tamanho = -1

  capitulos.forEach((cap, i) => {
    for (const r of cap.rotas || []) {
      const prefixo = r.endsWith('*')
      const base = prefixo ? r.slice(0, -1) : r
      const casa = prefixo ? rota.startsWith(base) : rota === base

      if (casa && base.length > tamanho) {
        melhor = i
        tamanho = base.length
      }
    }
  })

  return melhor
}

export default function ManualAjuda({ interno }: { interno: boolean }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [manual, setManual] = useState<Manual | null>(null)
  const [cap, setCap] = useState(0)
  const [slide, setSlide] = useState(0)
  const [email, setEmail] = useState('')
  const [indiceAberto, setIndiceAberto] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const dialogoRef = useRef<HTMLDivElement>(null)

  const abrir = useCallback(async () => {
    const mod = interno ? await import('@/lib/manual/interno') : await import('@/lib/manual/cliente')
    const m = mod.default

    setManual(m)
    setCap(capituloDaRota(m.capitulos, pathname || '/'))
    setSlide(0)
    setIndiceAberto(false)
    setAberto(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    setEmail(user?.email || '')
  }, [interno, pathname])

  const fechar = useCallback(() => {
    setAberto(false)
    botaoRef.current?.focus()
  }, [])

  const capitulo = manual?.capitulos[cap]
  const total = useMemo(
    () => (manual ? manual.capitulos.reduce((s, c) => s + c.slides.length, 0) : 0),
    [manual]
  )
  const posicao = useMemo(() => {
    if (!manual) return 0
    let p = 0
    for (let i = 0; i < cap; i++) p += manual.capitulos[i].slides.length
    return p + slide + 1
  }, [manual, cap, slide])

  const proximo = useCallback(() => {
    if (!manual || !capitulo) return
    if (slide < capitulo.slides.length - 1) setSlide(slide + 1)
    else if (cap < manual.capitulos.length - 1) {
      setCap(cap + 1)
      setSlide(0)
    }
  }, [manual, capitulo, cap, slide])

  const anterior = useCallback(() => {
    if (!manual) return
    if (slide > 0) setSlide(slide - 1)
    else if (cap > 0) {
      setCap(cap - 1)
      setSlide(manual.capitulos[cap - 1].slides.length - 1)
    }
  }, [manual, cap, slide])

  /* Teclado: setas navegam, Esc fecha, Ctrl/Cmd+P e +S ficam bloqueados. */
  useEffect(() => {
    if (!aberto) return

    function tecla(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()

      if (ctrl && (k === 'p' || k === 's' || k === 'c')) {
        e.preventDefault()
        return
      }
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') proximo()
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') anterior()
    }

    document.addEventListener('keydown', tecla)
    document.body.classList.add('manual-aberto')
    dialogoRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.classList.remove('manual-aberto')
    }
  }, [aberto, fechar, proximo, anterior])

  const atual = capitulo?.slides[slide]
  const bloquear = (e: { preventDefault: () => void }) => e.preventDefault()

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className="manual-botao"
        onClick={abrir}
        title="Ajuda: manual do portal"
        aria-label="Abrir o manual do portal"
      >
        ?
      </button>

      {aberto && manual && capitulo && atual && (
        <div className="manual-fundo" onClick={fechar}>
          <div
            ref={dialogoRef}
            className="manual"
            role="dialog"
            aria-modal="true"
            aria-label={manual.titulo}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={bloquear}
            onCopy={bloquear}
            onCut={bloquear}
            onDragStart={bloquear}
          >
            <header className="manual-cab">
              <div>
                <div className="manual-publico">{manual.publico}</div>
                <h2>{manual.titulo}</h2>
              </div>
              <div className="manual-cab-acoes">
                <button
                  type="button"
                  className="btn btn-sm manual-indice-btn"
                  onClick={() => setIndiceAberto(!indiceAberto)}
                  aria-expanded={indiceAberto}
                >
                  {indiceAberto ? 'Fechar índice' : 'Índice'}
                </button>
                <button type="button" className="manual-fechar" onClick={fechar} aria-label="Fechar o manual">
                  ×
                </button>
              </div>
            </header>

            <div className="manual-corpo">
              <nav className={'manual-indice' + (indiceAberto ? ' aberto' : '')} aria-label="Capítulos">
                <ol>
                  {manual.capitulos.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={i === cap ? 'ativo' : ''}
                        onClick={() => {
                          setCap(i)
                          setSlide(0)
                          setIndiceAberto(false)
                        }}
                      >
                        <span className="manual-indice-num">{i + 1}</span>
                        {c.titulo}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>

              <section className="manual-palco" aria-live="polite">
                <div className="manual-marca-dagua" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i}>{email || manual.publico}</span>
                  ))}
                </div>

                <div className="manual-cap-rotulo">
                  Capítulo {cap + 1} · {capitulo.titulo} · slide {slide + 1} de {capitulo.slides.length}
                </div>
                <h3 className="manual-slide-titulo">{atual.titulo}</h3>
                {atual.texto && <p className="manual-slide-texto">{atual.texto}</p>}

                <div className={'manual-slide' + (atual.tela ? '' : ' sem-tela')}>
                  {atual.tela && (
                    <div className="manual-slide-tela">
                      <TelaIlustrada tela={atual.tela} />
                      <div className="manual-ficticio">Ilustração com dados fictícios</div>
                    </div>
                  )}

                  {(atual.passos || atual.dica || atual.atencao || atual.link) && (
                    <div className="manual-slide-lado">
                      {atual.passos && (
                        <ol className="manual-passos">
                          {atual.passos.map((p, i) => (
                            <li key={i}>
                              <span className="mn-marca">{i + 1}</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {atual.dica && (
                        <div className="manual-dica">
                          <strong>Dica</strong>
                          {atual.dica}
                        </div>
                      )}
                      {atual.atencao && (
                        <div className="manual-atencao">
                          <strong>Atenção</strong>
                          {atual.atencao}
                        </div>
                      )}
                      {atual.link && (
                        <Link href={atual.link.href} className="btn btn-primary btn-sm" onClick={fechar}>
                          {atual.link.rotulo}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <footer className="manual-rodape">
              <button type="button" className="btn" onClick={anterior} disabled={posicao <= 1}>
                ← Anterior
              </button>
              <div className="manual-progresso" aria-label={'Slide ' + posicao + ' de ' + total}>
                <div>
                  <i style={{ width: (posicao / total) * 100 + '%' }} />
                </div>
                <span>
                  {posicao} de {total}
                </span>
              </div>
              <button type="button" className="btn btn-primary" onClick={proximo} disabled={posicao >= total}>
                Próximo →
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
