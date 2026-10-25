/*
 * Colaboradores desligados (supabase/colaboradores-desligados.sql).
 *
 * Não existe cadastro de colaboradores: a pessoa é a mesma do histórico
 * de certificados, empresa + nome normalizado (chavePessoa em
 * lib/historicoCertificados.ts). Uma linha ativa (reativado_em vazio)
 * em colaboradores_desligados tira os certificados dessa pessoa da
 * lista padrão, dos cartões, do painel, do Boletim de Antecedência e
 * dos avisos de treinamento.
 *
 * Falha aberta: se a tabela ainda não existe (SQL não rodou) ou a
 * leitura falha, ninguém é tratado como desligado e tudo continua como
 * antes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { lerTudo } from '@/lib/lerTudo'
import { chavePessoa, normalizarTexto } from '@/lib/historicoCertificados'

export type ColaboradorDesligado = {
  id: string
  empresa_id: string
  nome: string
  nome_chave: string
  desligado_em: string
  motivo: string | null
  criado_por: string | null
  created_at: string | null
}

/* Chave da pessoa -> desligamento ativo. */
export type MapaDesligados = Map<string, ColaboradorDesligado>

const COLUNAS = 'id, empresa_id, nome, nome_chave, desligado_em, motivo, criado_por, created_at'

/* Tabela ou coluna ainda inexistente: o SQL não rodou. */
export function faltaTabelaDesligados(error: any) {
  const codigo = String(error?.code || '')

  return (
    codigo === '42P01' ||
    codigo === '42703' ||
    codigo === 'PGRST205' ||
    codigo === 'PGRST204' ||
    /does not exist|schema cache/i.test(String(error?.message || ''))
  )
}

/* Mesmo texto de chave que o banco guarda em nome_chave. */
export function chaveNomeColaborador(nome: string | null | undefined) {
  return normalizarTexto(nome)
}

/* Mesma chave de chavePessoa(), montada a partir da linha de desligamento. */
function chaveDaLinha(d: Pick<ColaboradorDesligado, 'empresa_id' | 'nome_chave' | 'nome'>) {
  return chavePessoa({ empresa_id: d.empresa_id, colaborador: d.nome_chave || d.nome })
}

/*
 * Lê os desligamentos ativos visíveis para quem consulta (o RLS limita o
 * cliente às empresas dele; a chave de serviço lê todos).
 * `suportado` = a tabela existe e foi lida; serve para mostrar ou
 * esconder os botões na tela.
 */
export async function carregarDesligados(
  db: SupabaseClient
): Promise<{ suportado: boolean; mapa: MapaDesligados }> {
  const mapa: MapaDesligados = new Map()

  try {
    const { data, error } = await lerTudo<ColaboradorDesligado>(() =>
      db
        .from('colaboradores_desligados')
        .select(COLUNAS)
        .is('reativado_em', null)
        .order('id')
    )

    if (error) {
      if (!faltaTabelaDesligados(error)) console.error('Falha ao ler colaboradores desligados:', error)
      return { suportado: false, mapa }
    }

    for (const d of data || []) {
      const chave = chaveDaLinha(d)
      if (chave) mapa.set(chave, d)
    }

    return { suportado: true, mapa }
  } catch (e) {
    console.error('Falha ao ler colaboradores desligados:', e)
    return { suportado: false, mapa }
  }
}

/* Desligamento ativo da pessoa do certificado (ou null). */
export function desligamentoDe(
  mapa: MapaDesligados,
  c: { empresa_id: string; colaborador: string | null }
): ColaboradorDesligado | null {
  if (!mapa.size) return null

  const chave = chavePessoa(c)

  return chave ? mapa.get(chave) ?? null : null
}

export function estaDesligado(mapa: MapaDesligados, c: { empresa_id: string; colaborador: string | null }) {
  return desligamentoDe(mapa, c) !== null
}
