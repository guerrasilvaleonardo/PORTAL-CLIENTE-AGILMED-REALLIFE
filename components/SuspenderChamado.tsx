'use client'

import { FormEvent, useEffect, useState } from 'react'
import { MOTIVOS_SUSPENSAO, hojePortoVelho, suspenderChamado } from '@/lib/suspensao'

/*
 * Janela "Suspender atendimento": motivo, observação e próxima
 * atualização são obrigatórios. Usada no Quadro (ao arrastar para a
 * coluna) e na tela do chamado.
 */

type Props = {
  chamado: { id: string; numero: number; assunto: string }
  onFechar: () => void
  onSuspenso: (dados: { motivo: string; proxima: string }) => void
}

const OUTRO = '__outro__'

export default function SuspenderChamado({ chamado, onFechar, onSuspenso }: Props) {
  const [motivo, setMotivo] = useState('')
  const [outro, setOutro] = useState('')
  const [observacao, setObservacao] = useState('')
  const [proxima, setProxima] = useState(hojePortoVelho())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !salvando) onFechar()
    }

    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar, salvando])

  async function enviar(e: FormEvent) {
    e.preventDefault()

    const motivoFinal = (motivo === OUTRO ? outro : motivo).trim()

    if (motivoFinal.length < 3) return setErro('Escolha ou descreva o motivo.')
    if (observacao.trim().length < 10) {
      return setErro('Descreva o problema e a condição para retomar (mínimo de 10 caracteres).')
    }
    if (!proxima || proxima < hojePortoVelho()) {
      return setErro('Informe a data prevista da próxima atualização (hoje ou depois).')
    }

    try {
      setSalvando(true)
      setErro('')
      await suspenderChamado(chamado.id, motivoFinal, observacao.trim(), proxima)
      onSuspenso({ motivo: motivoFinal, proxima })
    } catch (falha: any) {
      setErro(falha?.message || 'Não foi possível suspender o chamado.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspender-titulo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, .45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
    >
      <form
        onSubmit={enviar}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-l)',
          boxShadow: 'var(--shadow)',
          width: '100%',
          maxWidth: 520,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div>
          <div className="section-title">Atendimento suspenso</div>
          <h2 id="suspender-titulo" style={{ fontSize: 19, margin: '4px 0 0' }}>
            Suspender o chamado #{chamado.numero}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            Use para impedimento fora do seu controle. O SLA pausa na hora. Para as estrelas, o
            tempo suspenso só é descontado se o gestor autorizar. O cliente vê o motivo e a próxima
            atualização; a observação fica só com a equipe.
          </p>
        </div>

        <div className="field">
          <label>Motivo *</label>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
            <option value="">Selecione</option>
            {MOTIVOS_SUSPENSAO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={OUTRO}>Outro (descrever)</option>
          </select>
        </div>

        {motivo === OUTRO && (
          <div className="field">
            <label>Qual motivo? *</label>
            <input value={outro} maxLength={120} onChange={(e) => setOutro(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>Observação (só a equipe vê) *</label>
          <textarea
            value={observacao}
            maxLength={2000}
            rows={4}
            placeholder="Descrição do problema e da condição necessária para retomar"
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Próxima atualização *</label>
          <input
            type="date"
            value={proxima}
            min={hojePortoVelho()}
            onChange={(e) => setProxima(e.target.value)}
          />
        </div>

        {erro && <div className="banner bad">{erro}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Suspendendo…' : 'Suspender atendimento'}
          </button>
        </div>
      </form>
    </div>
  )
}
