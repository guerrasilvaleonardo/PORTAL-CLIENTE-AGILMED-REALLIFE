'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Pessoa do cliente ligada a várias empresas (supabase/usuarios-varias-empresas.sql).
 * profiles.empresa_id é a EMPRESA ATIVA: tudo o que o portal mostra é da
 * empresa ativa. Trocar de empresa passa pela função do banco, que só
 * aceita empresas da lista da pessoa.
 */

export type MinhaEmpresa = { id: string; nome: string; razao_social: string | null; ativa: boolean }

export function useMinhasEmpresas(ligado = true) {
  const [lista, setLista] = useState<MinhaEmpresa[]>([])

  useEffect(() => {
    if (!ligado) return
    let vivo = true
    supabase.rpc('minhas_empresas').then(({ data, error }) => {
      /* Sem o SQL ainda: segue como antes, com uma empresa só. */
      if (vivo && !error) setLista((data || []) as MinhaEmpresa[])
    })
    return () => {
      vivo = false
    }
  }, [ligado])

  return lista
}

export async function trocarEmpresaAtiva(empresaId: string) {
  const { error } = await supabase.rpc('trocar_empresa_ativa', { p_empresa: empresaId })
  if (error) throw new Error(error.message || 'Não foi possível trocar de empresa.')
}

/*
 * Link de e-mail para chamado de outra empresa da pessoa: troca para a
 * empresa do chamado. Devolve true se trocou (a tela deve recarregar).
 */
export async function trocarParaEmpresaDoChamado(chamadoId: string) {
  const { error } = await supabase.rpc('trocar_para_empresa_do_chamado', { p_chamado: chamadoId })
  return !error
}
