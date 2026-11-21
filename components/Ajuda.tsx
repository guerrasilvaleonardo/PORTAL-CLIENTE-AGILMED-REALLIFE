'use client'

import { useEffect, useId, useRef, useState } from 'react'
import './ajuda.css'

/*
 * Balão de ajuda: o "?" que explica o item ao lado.
 *
 * POR QUE AQUI E NÃO NUM MANUAL. Manual é lido uma vez, no dia do
 * treinamento, e esquecido antes da primeira visita de verdade. A
 * dúvida aparece na frente do campo — "o que conta como atende em
 * parte?" —, e é ali que a resposta precisa estar.
 *
 * ABRE NO TOQUE, NÃO NO PASSAR DO MOUSE. A tela de campo é de celular,
 * onde não existe passar o mouse: ajuda que depende disso é ajuda que
 * metade da equipe nunca vê. No computador funciona igual, com clique.
 *
 * FECHA SOZINHO ao clicar fora ou apertar Esc, e só um fica aberto por
 * vez — balão que exige procurar o X para fechar atrapalha mais do que
 * ajuda em tela pequena.
 *
 * O TEXTO É CURTO DE PROPÓSITO. Duas ou três frases. Quem está de
 * capacete não lê parágrafo; se precisa de mais que isso, o problema é
 * da tela, não da explicação.
 */
export default function Ajuda({ texto, titulo }: { texto: string; titulo?: string }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  const caixa = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!aberto) return

    const foraDaCaixa = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', foraDaCaixa)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  return (
    <span className="ajuda" ref={caixa}>
      <button
        type="button"
        className={'ajuda-botao' + (aberto ? ' aberto' : '')}
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={titulo ? 'O que é ' + titulo : 'Explicação deste item'}
        onClick={(e) => {
          /* Sem isto, o clique chega ao rótulo em volta e foca o
             campo, fechando o balão que acabou de abrir. */
          e.preventDefault()
          e.stopPropagation()
          setAberto((a) => !a)
        }}
      >
        ?
      </button>

      {aberto && (
        <span className="ajuda-balao" id={id} role="note">
          {titulo && <strong>{titulo}</strong>}
          {texto}
        </span>
      )}
    </span>
  )
}
