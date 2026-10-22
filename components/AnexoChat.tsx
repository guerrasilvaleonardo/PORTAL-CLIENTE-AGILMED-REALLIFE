'use client'

import { useEffect, useState } from 'react'
import { duracaoTexto, linkDoAnexo } from '@/lib/chatAnexos'

/* Mostra o anexo de uma mensagem do chat: player de áudio ou miniatura. */
export default function AnexoChat({
  caminho,
  tipo,
  duracao,
}: {
  caminho: string
  tipo: string | null
  duracao: number | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let vivo = true
    linkDoAnexo(caminho).then((u) => {
      if (!vivo) return
      if (u) setUrl(u)
      else setFalhou(true)
    })
    return () => {
      vivo = false
    }
  }, [caminho])

  if (falhou) {
    return <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Anexo indisponível.</span>
  }

  if (!url) {
    return <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Carregando anexo…</span>
  }

  if (tipo === 'audio') {
    return (
      <div style={{ display: 'grid', gap: 2 }}>
        <audio controls preload="metadata" src={url} style={{ maxWidth: 280, height: 36 }} />
        {duracao ? <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>🎤 {duracaoTexto(duracao)}</span> : null}
      </div>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir a imagem em tamanho real">
      <img
        src={url}
        alt="Imagem enviada na conversa"
        style={{ display: 'block', maxWidth: 260, maxHeight: 260, borderRadius: 8, objectFit: 'cover' }}
      />
    </a>
  )
}
