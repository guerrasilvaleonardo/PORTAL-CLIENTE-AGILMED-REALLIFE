/*
 * Gera e grava o relatório mensal (servidor). Primeiro grava os dados
 * congelados; depois escreve a análise. Se a função for interrompida no
 * meio da análise, o relatório já existe e a tela oferece "Gerar análise".
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { analisePorRegras, type DadosRelatorio } from '@/lib/relatorioDesempenho'
import { analisarComIA, iaConfigurada, modeloIA } from '@/lib/relatorioDesempenhoIA'
import { coletarDadosRelatorio, limitesDoMes } from '@/lib/relatorioDesempenhoServidor'

export async function gerarRelatorio(db: SupabaseClient, mes: string, geradoPor: string | null) {
  const dados = await coletarDadosRelatorio(db, mes)

  const { data: ultima } = await db
    .from('relatorios_desempenho')
    .select('versao')
    .eq('mes', mes + '-01')
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  const versao = ((ultima as any)?.versao || 0) + 1

  const { data: criado, error } = await db
    .from('relatorios_desempenho')
    .insert({
      mes: mes + '-01',
      versao,
      periodo_ini: dados.periodo.ini,
      periodo_fim: dados.periodo.fim,
      parcial: dados.parcial,
      gerado_por: geradoPor,
      dados,
    })
    .select('id')
    .single()

  if (error) throw error

  const id = (criado as any).id as number

  if (geradoPor) {
    await db.from('relatorios_desempenho_acessos').insert({ relatorio_id: id, usuario_id: geradoPor, acao: 'gerou' })
  }

  await escreverAnalise(db, id, dados)

  return { id, versao }
}

export async function escreverAnalise(db: SupabaseClient, id: number, dados?: DadosRelatorio) {
  if (!dados) {
    const { data, error } = await db.from('relatorios_desempenho').select('dados').eq('id', id).single()
    if (error) throw error
    dados = (data as any).dados as DadosRelatorio
  }

  const regras = analisePorRegras(dados)
  let analise = regras
  let origem: 'ia' | 'regras' = 'regras'
  let modelo: string | null = null
  let erro: string | null = iaConfigurada() ? null : 'Chave da IA (ANTHROPIC_API_KEY) não configurada: análise feita por regras.'

  if (iaConfigurada()) {
    try {
      const r = await analisarComIA(dados, regras)
      analise = r.analise
      origem = 'ia'
      modelo = modeloIA()
      if (r.erros.length) erro = 'Partes feitas por regras porque a IA falhou: ' + r.erros.join(' | ')
    } catch (e: any) {
      erro = 'IA indisponível, análise feita por regras: ' + (e?.message || 'erro')
    }
  }

  const { error } = await db
    .from('relatorios_desempenho')
    .update({ analise, analise_origem: origem, analise_modelo: modelo, analise_erro: erro, analise_em: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error

  return { origem, erro }
}

export { limitesDoMes }
