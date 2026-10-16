'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  avisarAtualizacao,
  carregarConfig,
  carregarRanking,
  chavePeriodoAno,
  chavePeriodoMes,
  efeitosLigados,
  hojeBrasilia,
  limitesAno,
  limitesMes,
} from '@/lib/estrelas'
import '@/app/estrelas/estrelas.css'

/*
 * Comemorações do programa de estrelas, para a equipe interna.
 * Fica no cabeçalho, presente em todas as telas.
 *
 * - Cada conquista aparece uma única vez: o servidor guarda quando
 *   ela foi mostrada (estrelas_marcar_comemorado), então atualizar a
 *   página ou abrir em outro computador não repete.
 * - Dura poucos segundos, não bloqueia nada e não toca som.
 * - "Você subiu no ranking" compara com a última posição vista.
 */

type Aviso = {
  chave: string
  tipo: 'prazo' | 'avaliacao' | 'subiu'
  titulo: string
  sub: string
}

const DURACAO_MS = 6000
const INTERVALO_MS = 60000

export default function CelebracaoEstrelas() {
  const [fila, setFila] = useState<Aviso[]>([])
  const [efeitos, setEfeitos] = useState(true)
  const verificando = useRef(false)

  useEffect(() => {
    const atualizar = () => setEfeitos(efeitosLigados())
    atualizar()
    window.addEventListener('estrelas-efeitos', atualizar)
    return () => window.removeEventListener('estrelas-efeitos', atualizar)
  }, [])

  const verificar = useCallback(async () => {
    if (verificando.current) return
    verificando.current = true

    try {
      const cfg = await carregarConfig()
      if (!cfg || !cfg.ativo) return

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const novos: Aviso[] = []

      const { data: pendentes } = await supabase.rpc('estrelas_comemoracoes_pendentes')
      const lista = (pendentes || []) as any[]

      for (const e of lista) {
        const depois = e.depois || {}
        const numero = depois.numero ? ' #' + depois.numero : ''

        if (e.comemorar === 'prazo') {
          novos.push({
            chave: 'ev' + e.id,
            tipo: 'prazo',
            titulo: 'Parabéns! Você conquistou uma estrela por resolver este chamado dentro do prazo!',
            sub: '+1 estrela pelo prazo' + numero + '.',
          })
          const bonus = Number(depois.estrelas_avaliacao || 0)
          if (bonus > 0) {
            novos.push({
              chave: 'ev' + e.id + 'b',
              tipo: 'avaliacao',
              titulo: 'Seu atendimento foi reconhecido pelo cliente! Você ganhou +' + bonus + (bonus === 1 ? ' estrela!' : ' estrelas!'),
              sub: 'Bônus pela avaliação do cliente.',
            })
          }
        } else if (e.comemorar === 'avaliacao') {
          const antes = Number(e.antes?.estrelas_avaliacao || 0)
          const ganho = Number(depois.estrelas_avaliacao || 0) - antes
          novos.push({
            chave: 'ev' + e.id,
            tipo: 'avaliacao',
            titulo: 'Seu atendimento foi reconhecido pelo cliente! Você ganhou +' + ganho + (ganho === 1 ? ' estrela!' : ' estrelas!'),
            sub: 'Bônus pela avaliação do cliente.',
          })
        }
      }

      if (lista.length > 0) {
        await supabase.rpc('estrelas_marcar_comemorado', { p_ids: lista.map((e) => e.id) })
        avisarAtualizacao()
      }

      /* Subiu no ranking? Mensal e anual, comparando com a última vista. */
      const hoje = hojeBrasilia()
      const periodos = [
        { chave: chavePeriodoMes(hoje.ano, hoje.mes), nome: 'mensal', ...limitesMes(hoje.ano, hoje.mes) },
        { chave: chavePeriodoAno(hoje.ano), nome: 'anual', ...limitesAno(hoje.ano) },
      ]

      for (const p of periodos) {
        const ranking = await carregarRanking(p.inicio, p.fim)
        const minha = ranking.find((l) => l.atendente_id === user.id)
        if (!minha) continue

        const { data: anterior } = await supabase.rpc('estrelas_registrar_posicao', {
          p_periodo: p.chave,
          p_posicao: minha.posicao,
        })

        if (typeof anterior === 'number' && minha.posicao < anterior) {
          novos.push({
            chave: p.chave + ':' + minha.posicao,
            tipo: 'subiu',
            titulo: 'Você subiu no ranking!',
            sub: 'Ranking ' + p.nome + ': do ' + anterior + 'º para o ' + minha.posicao + 'º lugar.',
          })
        }
      }

      if (novos.length > 0) setFila((f) => [...f, ...novos])
    } catch (erro) {
      console.error('Estrelas: não foi possível verificar conquistas.', erro)
    } finally {
      verificando.current = false
    }
  }, [])

  useEffect(() => {
    verificar()
    const t = window.setInterval(verificar, INTERVALO_MS)
    const aoFocar = () => verificar()
    window.addEventListener('focus', aoFocar)
    window.addEventListener('estrelas-verificar', aoFocar)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', aoFocar)
      window.removeEventListener('estrelas-verificar', aoFocar)
    }
  }, [verificar])

  const atual = fila[0]

  useEffect(() => {
    if (!atual) return
    const t = window.setTimeout(() => setFila((f) => f.slice(1)), DURACAO_MS)
    return () => window.clearTimeout(t)
  }, [atual])

  if (!atual) return null

  return (
    <div className={efeitos ? '' : 'sem-efeitos'}>
      <div className="comemoracao" role="status" aria-live="polite" key={atual.chave}>
        <div className="comemoracao-icone" aria-hidden="true">
          {atual.tipo === 'prazo' && (
            <div className="comemoracao-luzes">
              <span /><span /><span /><span /><span /><span /><span /><span />
            </div>
          )}
          <div className="comemoracao-estrela">{atual.tipo === 'subiu' ? '🏆' : '★'}</div>
        </div>

        <div className="comemoracao-texto">
          <div className="comemoracao-titulo">{atual.titulo}</div>
          <div className="comemoracao-sub">{atual.sub}</div>
          <Link href="/estrelas" className="comemoracao-sub" style={{ fontWeight: 700, color: 'var(--primary)' }}>
            Ver minhas estrelas
          </Link>
        </div>

        <button
          type="button"
          className="comemoracao-fechar"
          aria-label="Fechar aviso"
          onClick={() => setFila((f) => f.slice(1))}
        >
          ×
        </button>
      </div>
    </div>
  )
}
