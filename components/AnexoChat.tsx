'use client'

import { useEffect, useState } from 'react'
import { duracaoTexto, extensaoDoNome, linkDoAnexo, tamanhoTexto } from '@/lib/chatAnexos'

/*
 * Mostra o anexo de uma mensagem do chat: player de áudio, miniatura de
 * imagem ou cartão de arquivo. Imagem e arquivo têm "Baixar" (salva com o
 * nome original); o link é temporário e só funciona para quem participa
 * da conversa.
 */
export default function AnexoChat({
  caminho,
  tipo,
  duracao,
  nome,
  tamanho,
}: {
  caminho: string
  tipo: string | null
  duracao: number | null
  nome?: string | null
  tamanho?: number | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [baixando, setBaixando] = useState(false)

  const extensao = extensaoDoNome(caminho) || 'arquivo'
  const nomeArquivo = nome || (tipo === 'imagem' ? 'imagem.' + extensao : 'arquivo.' + extensao)

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

  /* Gera o link de download na hora do clique (com o nome original). */
  async function baixar() {
    try {
      setBaixando(true)
      const u = await linkDoAnexo(caminho, nomeArquivo)
      if (u) window.location.href = u
      else setFalhou(true)
    } finally {
      setBaixando(false)
    }
  }

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

  const botaoBaixar = (
    <button
      type="button"
      className="btn btn-sm"
      onClick={baixar}
      disabled={baixando}
      aria-label={'Baixar ' + nomeArquivo}
    >
      {baixando ? 'Baixando…' : 'Baixar'}
    </button>
  )

  if (tipo === 'arquivo') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '8px 10px',
          maxWidth: 320,
          whiteSpace: 'normal',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flex: 'none',
            fontSize: 10.5,
            fontWeight: 800,
            textTransform: 'uppercase',
            background: 'var(--surface-sunken)',
            color: 'var(--ink-muted)',
            borderRadius: 6,
            padding: '8px 6px',
            minWidth: 38,
            textAlign: 'center',
          }}
        >
          {extensao}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            title={nomeArquivo}
            style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {nomeArquivo}
          </span>
          {tamanho ? <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{tamanhoTexto(tamanho)}</span> : null}
        </span>
        <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <a className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer">
            Abrir
          </a>
          {botaoBaixar}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
      <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir a imagem em tamanho real">
        <img
          src={url}
          alt="Imagem enviada na conversa"
          style={{ display: 'block', maxWidth: 260, maxHeight: 260, borderRadius: 8, objectFit: 'cover' }}
        />
      </a>
      {botaoBaixar}
    </div>
  )
}
