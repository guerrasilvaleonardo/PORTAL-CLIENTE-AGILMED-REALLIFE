'use client'

import './portal-header.css'

/* Selo "N nova(s)" ao lado do assunto de um chamado com mensagem não lida. */
export default function SeloMensagemNova({ quantidade }: { quantidade?: number }) {
  if (!quantidade) return null

  return (
    <span className="selo-msg-nova" title="Mensagem nova neste chamado">
      {quantidade === 1 ? '1 nova' : quantidade + ' novas'}
    </span>
  )
}
