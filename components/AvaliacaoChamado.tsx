'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { ROTULO_NOTA, formatarDataHora } from '@/lib/estrelas'
import '@/app/estrelas/estrelas.css'

/*
 * Avaliação do atendimento pelo cliente que abriu o chamado.
 * Escala do CLIENTE: 1 = Ruim, 2 = Bom, 3 = Excelente.
 * (As estrelas do ranking da equipe são outra conta, feita no servidor.)
 *
 * - opcional, uma única resposta por chamado;
 * - só aparece para quem abriu o chamado, logado no portal;
 * - depois de enviada, fica visível no histórico e não pode ser alterada.
 */

type Situacao = {
  avaliado: boolean
  nota?: number
  comentario?: string | null
  avaliado_em?: string
  pode_avaliar: boolean
  avaliar_ate?: string | null
}

const OPCOES = [
  { nota: 1, icones: '⭐', rotulo: 'Ruim' },
  { nota: 2, icones: '⭐⭐', rotulo: 'Bom' },
  { nota: 3, icones: '⭐⭐⭐', rotulo: 'Excelente' },
]

export function NotaDesenhada({ nota }: { nota: number }) {
  return (
    <span className="estrelas-nota" aria-label={'Nota ' + nota + ' de 3: ' + ROTULO_NOTA[nota]}>
      {'★'.repeat(nota)}
      <span className="apagada">{'★'.repeat(3 - nota)}</span>
    </span>
  )
}

export default function AvaliacaoChamado({
  chamadoId,
  status,
  visaoEquipe = false,
  cardStyle,
  titleStyle,
  cor,
}: {
  chamadoId: string
  status: string
  visaoEquipe?: boolean
  cardStyle?: CSSProperties
  titleStyle?: CSSProperties
  cor?: string
}) {
  const [situacao, setSituacao] = useState<Situacao | null>(null)
  const [nota, setNota] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmado, setConfirmado] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const { data, error } = await supabase.rpc('avaliacao_situacao', { p_chamado: chamadoId })
      if (!ativo) return
      if (error) {
        /* Programa ainda não instalado no banco: não mostra nada. */
        setSituacao(null)
        return
      }
      setSituacao((data as Situacao) || null)
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [chamadoId, status])

  async function enviar() {
    if (!nota || enviando) return
    setEnviando(true)
    setErro('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const resposta = await fetch('/api/estrelas/avaliar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (session?.access_token || ''),
        },
        body: JSON.stringify({ chamado_id: chamadoId, nota, comentario }),
      })

      const corpo = await resposta.json().catch(() => ({}))

      if (!resposta.ok) {
        setErro(corpo?.erro || 'Não foi possível enviar a avaliação.')
        return
      }

      setConfirmado(true)
      setSituacao({
        avaliado: true,
        nota,
        comentario: comentario.trim() || null,
        avaliado_em: new Date().toISOString(),
        pode_avaliar: false,
      })
    } catch {
      setErro('Não foi possível enviar a avaliação. Verifique a conexão e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (!situacao) return null
  if (!situacao.avaliado && !situacao.pode_avaliar) {
    if (!visaoEquipe || !['resolvido', 'encerrado'].includes(status)) return null
  }

  const card: CSSProperties = cardStyle || {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 18,
  }

  const titulo: CSSProperties = titleStyle || { fontWeight: 800, fontSize: 16, margin: 0 }

  return (
    <section style={card} id="avaliar" aria-labelledby="avaliacao-titulo">
      <h2 id="avaliacao-titulo" style={titulo}>
        {situacao.avaliado
          ? visaoEquipe ? 'Avaliação do cliente' : 'Sua avaliação'
          : visaoEquipe ? 'Avaliação do cliente' : 'Como foi seu atendimento?'}
      </h2>

      {situacao.avaliado && situacao.nota ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {confirmado && (
            <div className="banner good" role="status">
              Obrigado! Sua avaliação foi registrada.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <NotaDesenhada nota={situacao.nota} />
            <strong>{ROTULO_NOTA[situacao.nota]}</strong>
            <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
              (nota {situacao.nota} de 3) · {formatarDataHora(situacao.avaliado_em)}
            </span>
          </div>

          {situacao.comentario && (
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14, whiteSpace: 'pre-wrap' }}>
              “{situacao.comentario}”
            </p>
          )}
        </div>
      ) : visaoEquipe ? (
        <p style={{ margin: '8px 0 0', color: 'var(--ink-faint)', fontSize: 13 }}>
          O cliente ainda não avaliou este chamado.
          {situacao.avaliar_ate ? ' Prazo para avaliar: até ' + formatarDataHora(situacao.avaliar_ate) + '.' : ''}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
          <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
            A avaliação é opcional e pode ser enviada uma única vez.
            {situacao.avaliar_ate ? ' Disponível até ' + formatarDataHora(situacao.avaliar_ate) + '.' : ''}
          </p>

          <div className="avaliacao-opcoes" role="radiogroup" aria-label="Como foi seu atendimento?">
            {OPCOES.map((o) => (
              <button
                key={o.nota}
                type="button"
                role="radio"
                aria-checked={nota === o.nota}
                className="avaliacao-opcao"
                onClick={() => setNota(o.nota)}
              >
                <span className="icones" aria-hidden="true">{o.icones}</span>
                <span className="rotulo">{o.rotulo}</span>
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            Conte como podemos melhorar ou o que você mais gostou. (opcional)
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value.slice(0, 2000))}
              rows={3}
              maxLength={2000}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                font: 'inherit',
                fontWeight: 400,
                resize: 'vertical',
              }}
            />
          </label>

          {erro && <div className="banner bad" role="alert">{erro}</div>}

          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={enviar}
              disabled={!nota || enviando}
              style={cor ? { background: cor, borderColor: cor } : undefined}
            >
              {enviando ? 'Enviando...' : 'Enviar avaliação'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
