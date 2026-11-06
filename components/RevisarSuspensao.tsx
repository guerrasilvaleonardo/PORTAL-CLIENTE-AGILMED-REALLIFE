'use client'

import { FormEvent, useEffect, useState } from 'react'
import { dataDoBanco, hojePortoVelho, reprogramarSuspensao } from '@/lib/suspensao'
import { situacaoRevisao, textoRevisao } from '@/lib/revisaoSuspensao'

/*
 * Janela "Revisão do suspenso": na data da próxima atualização o
 * atendente decide entre reativar o atendimento (o SLA volta a contar) ou
 * reprogramar com nova data e motivo (continua suspenso). Reprogramar fica
 * no histórico e no dashboard da equipe; não mexe nas estrelas.
 */

type Props = {
  chamado: {
    id: string
    numero: number
    assunto: string
    suspensao_motivo?: string | null
    suspensao_proxima?: string | null
  }
  onFechar: () => void
  /* Quem abriu a janela faz a troca de situação do jeito de sempre. */
  onReativar: () => Promise<void> | void
  onReprogramado: (proxima: string) => void
}

export default function RevisarSuspensao({ chamado, onFechar, onReativar, onReprogramado }: Props) {
  const [acao, setAcao] = useState<'reativar' | 'reprogramar'>('reprogramar')
  const [proxima, setProxima] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const situacao = situacaoRevisao(chamado.suspensao_proxima)

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !salvando) onFechar()
    }

    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar, salvando])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (acao === 'reativar') {
      try {
        setSalvando(true)
        await onReativar()
      } catch (falha: any) {
        setErro(falha?.message || 'Não foi possível reativar o chamado.')
      } finally {
        setSalvando(false)
      }
      return
    }

    if (!proxima || proxima < hojePortoVelho()) return setErro('A nova data precisa ser hoje ou depois.')
    if (proxima === (chamado.suspensao_proxima || '').slice(0, 10)) {
      return setErro('A nova data é igual à data atual.')
    }
    if (motivo.trim().length < 5) return setErro('Informe o motivo da reprogramação (mínimo de 5 caracteres).')

    try {
      setSalvando(true)
      await reprogramarSuspensao(chamado.id, proxima, motivo.trim())
      onReprogramado(proxima)
    } catch (falha: any) {
      setErro(falha?.message || 'Não foi possível reprogramar.')
    } finally {
      setSalvando(false)
    }
  }

  const selo =
    situacao === 'vencida'
      ? { texto: 'Revisão vencida', fundo: 'var(--danger)', cor: '#fff' }
      : situacao === 'hoje'
        ? { texto: 'Revisar hoje', fundo: '#FACC15', cor: '#3D2E00' }
        : { texto: 'Revisão futura', fundo: 'var(--surface-sunken)', cor: 'var(--ink-muted)' }

  const opcao = (ativa: boolean) => ({
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    border: ativa ? '2px solid var(--primary)' : '1px solid var(--border)',
    background: ativa ? 'var(--primary-tint)' : 'var(--surface)',
    borderRadius: 'var(--radius-m)',
    padding: 12,
    cursor: 'pointer',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revisar-titulo"
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
          maxWidth: 560,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              background: selo.fundo,
              color: selo.cor,
              padding: '3px 9px',
              borderRadius: 20,
            }}
          >
            {selo.texto}
          </span>
          <h2 id="revisar-titulo" style={{ fontSize: 19, margin: '6px 0 0' }}>
            #{chamado.numero} · {chamado.assunto}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            {chamado.suspensao_motivo ? 'Motivo da suspensão: ' + chamado.suspensao_motivo + '. ' : ''}
            {chamado.suspensao_proxima
              ? textoRevisao(chamado.suspensao_proxima) + ' (' + dataDoBanco(chamado.suspensao_proxima) + ').'
              : ''}
          </p>
        </div>

        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>O que fazer com o chamado?</legend>

          <label style={opcao(acao === 'reativar')}>
            <input
              type="radio"
              name="acao-revisao"
              checked={acao === 'reativar'}
              onChange={() => setAcao('reativar')}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ display: 'block', fontSize: 14 }}>Reativar o atendimento</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                Volta para Em andamento. O prazo é estendido pelas horas úteis suspensas e o cliente é
                avisado da retomada.
              </span>
            </span>
          </label>

          <label style={opcao(acao === 'reprogramar')}>
            <input
              type="radio"
              name="acao-revisao"
              checked={acao === 'reprogramar'}
              onChange={() => setAcao('reprogramar')}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ display: 'block', fontSize: 14 }}>Reprogramar a revisão</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                Continua suspenso, com nova data. O cliente recebe a nova data; o motivo fica só com a
                equipe.
              </span>
            </span>
          </label>
        </fieldset>

        {acao === 'reprogramar' && (
          <>
            <div className="field">
              <label htmlFor="revisao-data">Nova data de revisão *</label>
              <input
                id="revisao-data"
                type="date"
                value={proxima}
                min={hojePortoVelho()}
                onChange={(e) => setProxima(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="revisao-motivo">Motivo da reprogramação (só a equipe vê) *</label>
              <textarea
                id="revisao-motivo"
                value={motivo}
                rows={3}
                maxLength={1000}
                placeholder="Ex.: cliente confirmou a prática para a próxima semana"
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-muted)' }}>
              A reprogramação fica no histórico do chamado e aparece no dashboard da equipe. Não altera
              as estrelas.
            </p>
          </>
        )}

        {erro && <div className="banner bad">{erro}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando
              ? 'Salvando…'
              : acao === 'reativar'
                ? 'Reativar atendimento'
                : 'Confirmar reprogramação'}
          </button>
        </div>
      </form>
    </div>
  )
}
