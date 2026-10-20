'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { avisarAtualizacao, formatarDataHora } from '@/lib/estrelas'
import '@/app/estrelas/estrelas.css'

/*
 * Estrelas deste chamado, na tela da equipe.
 * - Atendente vê as estrelas quando o chamado é dele (RLS no banco).
 * - Gestor vê sempre e pode estornar/restabelecer e decidir
 *   alterações de prazo, sempre com justificativa (auditado).
 */

type Lancamento = {
  atendente_id: string
  resolvido_em: string
  prazo_referencia: string | null
  dentro_prazo: boolean | null
  estrelas_prazo: number
  nota: number | null
  estrelas_avaliacao: number
  situacao: 'valida' | 'suspensa' | 'estornada'
  motivo: string | null
  profiles?: { nome: string | null } | null
}

type Alteracao = {
  id: number
  prazo_anterior: string
  prazo_novo: string
  origem: string
  alterado_em: string
  autorizado: boolean | null
  justificativa: string | null
}

const ROTULO_SITUACAO = {
  valida: 'Válida',
  suspensa: 'Suspensa (chamado reaberto)',
  estornada: 'Estornada',
}

export default function EstrelasDoChamado({
  chamadoId,
  status,
  ehGestor,
  cardStyle,
  titleStyle,
}: {
  chamadoId: string
  status: string
  ehGestor: boolean
  cardStyle?: CSSProperties
  titleStyle?: CSSProperties
}) {
  const [lanc, setLanc] = useState<Lancamento | null>(null)
  const [alteracoes, setAlteracoes] = useState<Alteracao[]>([])
  const [instalado, setInstalado] = useState(true)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('estrelas_lancamentos')
      .select('atendente_id, resolvido_em, prazo_referencia, dentro_prazo, estrelas_prazo, nota, estrelas_avaliacao, situacao, motivo, profiles:atendente_id(nome)')
      .eq('chamado_id', chamadoId)
      .maybeSingle()

    if (error) {
      setInstalado(false)
      return
    }

    setInstalado(true)
    setLanc((data as any) || null)

    const { data: alt } = await supabase
      .from('estrelas_prazo_alteracoes')
      .select('id, prazo_anterior, prazo_novo, origem, alterado_em, autorizado, justificativa')
      .eq('chamado_id', chamadoId)
      .order('alterado_em')

    setAlteracoes(((alt || []) as Alteracao[]).filter((a) => new Date(a.prazo_novo) > new Date(a.prazo_anterior)))
  }, [chamadoId])

  useEffect(() => {
    carregar()
  }, [carregar, status])

  async function acao(rpc: string, args: Record<string, unknown>) {
    if (salvando) return
    if (motivo.trim().length < 5) {
      setErro('Informe a justificativa (mínimo de 5 caracteres).')
      return
    }
    setSalvando(true)
    setErro('')
    const { error } = await supabase.rpc(rpc, args)
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setMotivo('')
    await carregar()
    avisarAtualizacao()
  }

  if (!instalado) return null
  if (!lanc && alteracoes.length === 0) return null

  const card: CSSProperties = cardStyle || {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 18,
  }
  const titulo: CSSProperties = titleStyle || { fontWeight: 800, fontSize: 16, margin: 0 }
  const pendentes = alteracoes.filter((a) => a.autorizado === null)

  return (
    <section style={card} aria-labelledby="estrelas-chamado-titulo">
      <h2 id="estrelas-chamado-titulo" style={titulo}>
        <span className="estrela-ouro" aria-hidden="true">★</span> Estrelas deste chamado
      </h2>

      {lanc ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, fontSize: 14 }}>
          <div>
            <strong>Atendente:</strong> {lanc.profiles?.nome || '—'} ·{' '}
            <span className={'pill ' + (lanc.situacao === 'valida' ? 'good' : lanc.situacao === 'suspensa' ? 'warn' : 'bad')}>
              {ROTULO_SITUACAO[lanc.situacao]}
            </span>
          </div>
          <div>
            <strong>Prazo:</strong>{' '}
            {lanc.dentro_prazo === null
              ? 'chamado sem prazo de SLA'
              : lanc.dentro_prazo
                ? 'resolvido dentro do prazo'
                : 'resolvido fora do prazo'}{' '}
            → <strong>{lanc.estrelas_prazo}</strong> estrela(s)
          </div>
          <div>
            <strong>Avaliação do cliente:</strong>{' '}
            {lanc.nota ? 'nota ' + lanc.nota + ' de 3' : 'sem avaliação'} →{' '}
            <strong>+{lanc.estrelas_avaliacao}</strong> estrela(s)
          </div>
          <div>
            <strong>Total:</strong>{' '}
            <span className="estrela-ouro" style={{ fontWeight: 800 }}>
              {lanc.situacao === 'valida' ? lanc.estrelas_prazo + lanc.estrelas_avaliacao : 0} ★
            </span>
            <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
              {' '}· resolução válida em {formatarDataHora(lanc.resolvido_em)}
            </span>
          </div>
          {lanc.motivo && (
            <div style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
              <strong>Motivo:</strong> {lanc.motivo}
            </div>
          )}
        </div>
      ) : (
        <p style={{ margin: '8px 0 0', color: 'var(--ink-faint)', fontSize: 13 }}>
          Sem estrelas lançadas para este chamado.
        </p>
      )}

      {alteracoes.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="section-title">Extensões de prazo (para as estrelas)</div>
          {alteracoes.map((a) => (
            <div key={a.id} style={{ fontSize: 13, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>
                {formatarDataHora(a.prazo_anterior)} → {formatarDataHora(a.prazo_novo)} (
                {a.origem === 'prioridade' ? 'troca de prioridade, em ' : a.origem === 'suspensao' ? 'atendimento suspenso, iniciado em ' : 'alteração manual, em '}{formatarDataHora(a.alterado_em)})
              </span>
              <span className={'pill ' + (a.autorizado === null ? 'warn' : a.autorizado ? 'good' : 'bad')}>
                {a.autorizado === null ? 'Aguardando gestor' : a.autorizado ? 'Autorizada' : 'Recusada'}
              </span>
              {ehGestor && a.autorizado === null && (
                <>
                  <button type="button" className="btn btn-sm" disabled={salvando}
                    onClick={() => acao('estrelas_decidir_prazo', { p_alteracao: a.id, p_autorizar: true, p_justificativa: motivo })}>
                    Autorizar
                  </button>
                  <button type="button" className="btn btn-sm" disabled={salvando}
                    onClick={() => acao('estrelas_decidir_prazo', { p_alteracao: a.id, p_autorizar: false, p_justificativa: motivo })}>
                    Recusar
                  </button>
                </>
              )}
            </div>
          ))}
          {pendentes.length > 0 && !ehGestor && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
              Enquanto o gestor não autorizar, a estrela usa o prazo anterior. O SLA do chamado não muda.
            </p>
          )}
        </div>
      )}

      {ehGestor && (lanc || pendentes.length > 0) && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Justificativa do gestor (obrigatória para qualquer ajuste)
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: chamado aberto em duplicidade"
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', font: 'inherit', fontWeight: 400 }}
            />
          </label>
          {lanc && (
            <div>
              {lanc.situacao === 'estornada' ? (
                <button type="button" className="btn btn-sm" disabled={salvando}
                  onClick={() => acao('estrelas_restabelecer', { p_chamado: chamadoId, p_motivo: motivo })}>
                  Restabelecer estrelas
                </button>
              ) : (
                <button type="button" className="btn btn-sm" disabled={salvando}
                  onClick={() => acao('estrelas_estornar', { p_chamado: chamadoId, p_motivo: motivo })}>
                  Estornar estrelas deste chamado
                </button>
              )}
            </div>
          )}
          {erro && <div className="banner bad" role="alert">{erro}</div>}
        </div>
      )}
    </section>
  )
}
