'use client'

import { RefObject } from 'react'
import './escolher-foto.css'

/*
 * Tirar na hora OU anexar uma que já existe.
 *
 * O botão de foto tinha `capture="environment"`, que no celular abre a
 * câmera DIRETO e não deixa escolher mais nada: quem já tinha a foto na
 * galeria — mandada pelo encarregado no grupo, baixada do e-mail,
 * tirada antes de abrir o portal — não conseguia anexar. No computador
 * o mesmo atributo deixa o campo confuso.
 *
 * Agora são duas metades na mesma caixa:
 *
 *   CÂMERA   mantém o `capture`, que é o caminho rápido de quem está em
 *            campo com o celular na mão. Era por isso que existia, e
 *            continua sendo o de cima.
 *   ARQUIVO  sem `capture`: abre a galeria no celular e os arquivos no
 *            computador.
 *
 * A caixa herda o tamanho e a borda da tela que a usa (`classe`), então
 * ela continua do tamanho que já era em cada lugar.
 */

export default function EscolherFoto({
  classe,
  enviando = false,
  desabilitado = false,
  refCamera,
  aoEscolher,
}: {
  /* A classe da tela: .campo-add-foto, .insp-add-foto… */
  classe: string
  enviando?: boolean
  desabilitado?: boolean
  /* Algumas telas limpam o campo por fora, depois de salvar. */
  refCamera?: RefObject<HTMLInputElement | null>
  aoEscolher: (arquivo?: File) => void
}) {
  if (enviando) {
    return (
      <div className={classe + ' foto-duas foto-duas-enviando'} aria-live="polite">
        enviando…
      </div>
    )
  }

  function escolheu(e: React.ChangeEvent<HTMLInputElement>) {
    aoEscolher(e.target.files?.[0])
    /* Sem isto, escolher o MESMO arquivo de novo não dispara nada. */
    e.target.value = ''
  }

  return (
    <div className={classe + ' foto-duas'}>
      <label>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 8h3l2-2h8l2 2h3v11H3z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
        câmera
        <input
          ref={refCamera}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={desabilitado}
          onChange={escolheu}
        />
      </label>

      <label>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 16V4" />
          <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        arquivo
        <input type="file" accept="image/*" disabled={desabilitado} onChange={escolheu} />
      </label>
    </div>
  )
}
