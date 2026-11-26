'use client'

import { useEffect, useRef, useState } from 'react'
import { VIDEO_BOAS_VINDAS } from '@/lib/videoBoasVindas'

/*
 * Janela do vídeo de boas-vindas (o Lif explicando o portal).
 *
 * obrigatorio = true (primeiro acesso):
 *   - não tem botão de fechar, Esc não fecha, clicar fora não fecha;
 *   - não dá para avançar a barra além do que já foi assistido
 *     (voltar pode) nem acelerar acima de 1x;
 *   - ao terminar, aparece "Começar a usar o portal" e onConcluir roda.
 * obrigatorio = false (botão na tela Início): fecha quando quiser.
 * Se o vídeo não carregar, libera o fechamento e avisa por onFalhou.
 */
export default function VideoBoasVindas({
  obrigatorio,
  onConcluir,
  onFechar,
  onFalhou,
}: {
  obrigatorio: boolean
  onConcluir: () => void
  onFechar: () => void
  /* Vídeo não carregou (a pessoa pode seguir; reabre em outra sessão). */
  onFalhou?: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const assistido = useRef(0)
  const [terminou, setTerminou] = useState(false)
  const [falta, setFalta] = useState<number | null>(null)
  const [erro, setErro] = useState(false)

  const podeFechar = !obrigatorio || terminou || erro

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && podeFechar) onFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', tecla)
    }
  }, [podeFechar, onFechar])

  function aoAtualizar() {
    const v = video.current
    if (!v) return
    if (v.currentTime > assistido.current && v.currentTime - assistido.current < 1.5) {
      assistido.current = v.currentTime
    }
    if (v.duration) setFalta(Math.max(0, Math.ceil(v.duration - assistido.current)))
  }

  function aoBuscar() {
    const v = video.current
    if (!v || !obrigatorio || terminou) return
    if (v.currentTime > assistido.current + 1) v.currentTime = assistido.current
  }

  function aoMudarVelocidade() {
    const v = video.current
    if (v && obrigatorio && !terminou && v.playbackRate > 1) v.playbackRate = 1
  }

  function aoTerminar() {
    setTerminou(true)
    setFalta(0)
    onConcluir()
  }

  const mmss = (s: number) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-boas-vindas-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget && podeFechar) onFechar()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(20, 26, 69, 0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: 'min(960px, 100%)',
          maxHeight: '100%',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-l)',
          boxShadow: 'var(--shadow)',
          padding: '18px 18px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span className="section-title">Boas-vindas</span>
            <h2 id="video-boas-vindas-titulo" style={{ margin: '2px 0 0', fontSize: 20 }}>
              Como usar o Portal do Cliente
            </h2>
            {obrigatorio && !terminou && (
              <p style={{ margin: '4px 0 0', color: 'var(--ink-muted)', fontSize: 14 }}>
                Antes de começar, assista a este vídeo de 3 minutos. Depois ele fica disponível na tela Início para rever
                quando quiser.
              </p>
            )}
          </div>
          {podeFechar && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar} aria-label="Fechar vídeo">
              Fechar ✕
            </button>
          )}
        </div>

        {erro ? (
          <div className="banner bad">
            Não foi possível carregar o vídeo agora. Você já pode usar o portal; o vídeo continua no botão da tela Início.
          </div>
        ) : (
          <video
            ref={video}
            src={VIDEO_BOAS_VINDAS.src}
            poster={VIDEO_BOAS_VINDAS.capa}
            controls
            autoPlay
            playsInline
            preload="auto"
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onTimeUpdate={aoAtualizar}
            onSeeking={aoBuscar}
            onRateChange={aoMudarVelocidade}
            onEnded={aoTerminar}
            onError={() => {
              setErro(true)
              onFalhou?.()
            }}
            style={{ width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 'var(--radius-m)' }}
          >
            <track kind="captions" src={VIDEO_BOAS_VINDAS.legendas} srcLang="pt-BR" label="Português" default />
          </video>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>
            Telas ilustrativas com dados fictícios. As legendas podem ser ligadas no botão CC do vídeo.
          </span>
          {obrigatorio && !terminou && !erro ? (
            <span className="pill flat">{falta === null ? 'Assista até o fim para continuar' : 'Faltam ' + mmss(falta)}</span>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onFechar}>
              {obrigatorio ? 'Começar a usar o portal' : 'Fechar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
