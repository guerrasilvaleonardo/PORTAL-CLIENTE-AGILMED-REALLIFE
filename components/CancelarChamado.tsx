'use client'

import { FormEvent, useEffect, useState } from 'react'
import { MOTIVOS_CANCELAMENTO, MOTIVO_OUTRO, cancelarChamado } from '@/lib/cancelamento'

/*
 * Janela "Cancelar chamado" (só gestor/admin). Motivo da lista e
 * observação interna são obrigatórios. Usada no Quadro (ao arrastar
 * para a coluna) e na tela do chamado.
 */

type Props = {
  chamado: { id: string; numero: number; assunto: string }
  onFechar: () => void
  onCancelado: (motivo: string) => void
}

export default function CancelarChamado({ chamado, onFechar, onCancelado }: Props) {
  const [motivo, setMotivo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  const [observacao, setObservacao] = useState('')
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

    if (!motivo) return setErro('Escolha o motivo do cancelamento.')
    if (motivo === MOTIVO_OUTRO && detalhe.trim().length < 3) {
      return setErro('Descreva o motivo (mínimo de 3 caracteres).')
    }
    if (observacao.trim().length < 10) {
      return setErro('Descreva o que aconteceu (observação com no mínimo 10 caracteres).')
    }

    try {
      setSalvando(true)
      setErro('')
      await cancelarChamado(chamado.id, motivo, motivo === MOTIVO_OUTRO ? detalhe.trim() : '', observacao.trim())
      onCancelado(motivo === MOTIVO_OUTRO ? detalhe.trim() : motivo)
    } catch (falha: any) {
      setErro(falha?.message || 'Não foi possível cancelar o chamado.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancelar-titulo"
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
          <div className="section-title">Cancelamento</div>
          <h2 id="cancelar-titulo" style={{ fontSize: 19, margin: '4px 0 0' }}>
            Cancelar o chamado #{chamado.numero}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            Use quando o chamado não deve ser atendido. Ele sai do SLA e das estrelas e não pede
            avaliação. O cliente recebe o motivo por mensagem e e-mail; a observação fica só com a
            equipe. Dá para desfazer voltando a situação para Aberto ou Em atendimento.
          </p>
        </div>

        <div className="field">
          <label>Motivo *</label>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
            <option value="">Selecione</option>
            {MOTIVOS_CANCELAMENTO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={MOTIVO_OUTRO}>Outro (descrever)</option>
          </select>
        </div>

        {motivo === MOTIVO_OUTRO && (
          <div className="field">
            <label>Qual motivo? (o cliente vê) *</label>
            <input value={detalhe} maxLength={120} onChange={(e) => setDetalhe(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>Observação (só a equipe vê) *</label>
          <textarea
            value={observacao}
            maxLength={2000}
            rows={4}
            placeholder="O que aconteceu. Ex.: duplicado do chamado #210, que segue em atendimento"
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {erro && <div className="banner bad">{erro}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar} disabled={salvando}>
            Voltar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={salvando}
            style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
          >
            {salvando ? 'Cancelando…' : 'Cancelar chamado'}
          </button>
        </div>
      </form>
    </div>
  )
}
