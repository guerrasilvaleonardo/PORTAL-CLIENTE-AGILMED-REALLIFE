'use client'

import { supabase } from '@/lib/supabase'

/*
 * Atendimento suspenso (supabase/chamados-cobranca-e-suspensao.sql).
 *
 * O único caminho para a situação 'suspenso' é a função
 * suspender_chamado, que exige motivo, observação e próxima
 * atualização. Sair da suspensão é uma mudança de status comum: o banco
 * estende o prazo pelas horas úteis suspensas e manda a extensão para a
 * decisão do gestor nas estrelas.
 *
 * "Retorno do cliente" não está na lista de motivos de propósito: para
 * isso já existe "Aguardando cliente", que pausa o prazo sem depender do
 * gestor.
 */

export const MOTIVOS_SUSPENSAO = [
  'Indisponibilidade de sistema',
  'Falha de software',
  'Dependência de fornecedor',
  'Dependência de terceiros (órgão/concessionária)',
  'Aguardando aprovação interna',
] as const

export type DadosSuspensao = {
  suspenso_em: string | null
  suspensao_motivo: string | null
  suspensao_proxima: string | null
}

export type RegistroSuspensao = {
  id: number
  motivo: string
  observacao: string
  proxima_atualizacao: string
  status_anterior: string
  inicio: string
  fim: string | null
  horas_uteis: number | null
}

export async function suspenderChamado(
  chamadoId: string,
  motivo: string,
  observacao: string,
  proxima: string
) {
  const { error } = await supabase.rpc('suspender_chamado', {
    p_chamado: chamadoId,
    p_motivo: motivo,
    p_observacao: observacao,
    p_proxima: proxima,
  })

  if (error) {
    const msg = error.message || ''

    if (/suspender_chamado|function .* does not exist|schema cache/i.test(msg)) {
      throw new Error('O recurso de suspensão ainda não foi ativado no banco (rodar o SQL de suspensão).')
    }

    throw new Error(msg || 'Não foi possível suspender o chamado.')
  }
}

/*
 * Dados da suspensão em andamento (motivo e próxima atualização), lidos à
 * parte para a tela não quebrar se o SQL ainda não tiver rodado.
 */
export async function carregarSuspensos(ids?: string[]) {
  const mapa: Record<string, DadosSuspensao> = {}

  try {
    let consulta = supabase
      .from('chamados')
      .select('id, suspenso_em, suspensao_motivo, suspensao_proxima')
      .eq('status', 'suspenso')

    if (ids && ids.length) consulta = consulta.in('id', ids)

    const { data, error } = await consulta

    if (error) return mapa

    for (const c of (data || []) as any[]) {
      mapa[c.id] = {
        suspenso_em: c.suspenso_em,
        suspensao_motivo: c.suspensao_motivo,
        suspensao_proxima: c.suspensao_proxima,
      }
    }
  } catch {
    /* Recurso opcional. */
  }

  return mapa
}

/* Histórico de suspensões do chamado (só a equipe enxerga). */
export async function carregarHistoricoSuspensoes(chamadoId: string) {
  try {
    const { data, error } = await supabase
      .from('chamado_suspensoes')
      .select('id, motivo, observacao, proxima_atualizacao, status_anterior, inicio, fim, horas_uteis')
      .eq('chamado_id', chamadoId)
      .order('inicio', { ascending: false })

    if (error) return [] as RegistroSuspensao[]

    return (data || []) as RegistroSuspensao[]
  } catch {
    return [] as RegistroSuspensao[]
  }
}

/* "2026-10-21" -> "21/10/2026" sem passar por fuso horário. */
export function dataDoBanco(valor: string | null | undefined) {
  if (!valor) return '—'

  const [a, m, d] = valor.slice(0, 10).split('-')

  return d && m && a ? d + '/' + m + '/' + a : valor
}

/* Hoje em Porto Velho, no formato do campo de data. */
export function hojePortoVelho() {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
