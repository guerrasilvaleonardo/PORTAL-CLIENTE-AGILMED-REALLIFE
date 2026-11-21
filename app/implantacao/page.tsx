'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../colaboradores/colaboradores.css'
import '../inspecoes/inspecoes.css'
import './implantacao.css'

/*
 * As implantações da empresa.
 *
 * Há uma trilha por norma — 9001 e 45001 — e a empresa pode querer as
 * duas, normalmente uma depois da outra.
 *
 * POR QUE O BOTÃO DE COMEÇAR FICA SEMPRE VISÍVEL. Ele já esteve dentro
 * do "nenhuma implantação começou ainda", e com isso a segunda trilha
 * virava inalcançável: quem tinha começado a 9001 não tinha como abrir
 * a 45001 por lugar nenhum da tela. Agora as trilhas ainda não
 * iniciadas aparecem abaixo da lista, e some da oferta o que já está
 * em andamento.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Linha = {
  id: string
  empresa_id: string
  modelo_id: string
  modelo_nome: string | null
  situacao: string
  consultor_nome: string | null
  interlocutor_nome: string | null
  iniciada_em: string
}

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' }) : '—'

function ImplantacoesConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [empresas, setEmpresas] = useState<Record<string, string>>({})
  const [modelos, setModelos] = useState<{ id: string; nome: string }[]>([])
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()

      const souInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(souInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

      const [{ data: is }, { data: ms }] = await Promise.all([
        supabase
          .from('implantacoes')
          .select(
            'id, empresa_id, modelo_id, modelo_nome, situacao, consultor_nome, interlocutor_nome, iniciada_em'
          )
          .order('iniciada_em', { ascending: false }),
        supabase
          .from('implantacao_modelos')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome'),
      ])

      const lista = (is || []) as unknown as Linha[]
      setLinhas(lista)
      setModelos((ms || []) as { id: string; nome: string }[])

      if (lista.length > 0) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .in('id', [...new Set(lista.map((l) => l.empresa_id))])
        const mapa: Record<string, string> = {}
        ;(emps || []).forEach((e: any) => {
          mapa[e.id] = e.nome_fantasia || e.razao_social
        })
        setEmpresas(mapa)
      }
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar as implantações.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function comecar(modeloId: string) {
    if (criando) return
    const empresa = minhaEmpresa
    if (!empresa) {
      setErro('Escolha a empresa antes de começar — a equipe inicia pela ficha do cliente.')
      return
    }
    setCriando(true)
    setErro('')
    const modelo = modelos.find((m) => m.id === modeloId)
    const { data: nova, error } = await supabase
      .from('implantacoes')
      .insert({ empresa_id: empresa, modelo_id: modeloId, modelo_nome: modelo?.nome || null })
      .select('id')
      .single()
    setCriando(false)
    if (error) {
      setErro(error.message)
      return
    }
    window.location.href = '/implantacao/' + (nova as any).id
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  /*
   * As trilhas que esta empresa ainda não começou. A comparação é pela
   * empresa de quem está vendo, e não pela lista inteira: a equipe
   * interna vê as implantações de todos os clientes, e sem este filtro
   * a trilha sumiria da oferta porque OUTRA empresa a começou.
   */
  const jaIniciadas = new Set(
    linhas.filter((l) => l.empresa_id === minhaEmpresa).map((l) => l.modelo_id)
  )
  const naoIniciadas = minhaEmpresa ? modelos.filter((m) => !jaIniciadas.has(m.id)) : []

  return (
    <div className="app">
      <header className="page-head">
        <div>
          <p className="eyebrow">IMPLANTAÇÃO</p>
          <h1>Montar o sistema de gestão</h1>
          <p className="subtitulo">
            A trilha percorre a empresa inteira, área por área. Cada atividade traz a aula, os
            passos e o modelo — e só fecha quando a nossa equipe confere.
          </p>
        </div>
      </header>

      {erro && <div className="banner bad">{erro}</div>}

      {linhas.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <p style={{ marginTop: 0 }}>
              Nenhuma implantação começou ainda.
              {modelos.length === 0 && ' Nenhuma trilha publicada — avise a nossa equipe.'}
            </p>
          </div>
        </div>
      ) : (
        <table className="tabela-colab">
          <thead>
            <tr>
              {interno && <th>Empresa</th>}
              <th>Trilha</th>
              <th>Interlocutor</th>
              <th>Início</th>
              <th>Situação</th>
              <th className="acoes" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                {interno && <td className="nome">{empresas[l.empresa_id] || '—'}</td>}
                <td className="nome">{l.modelo_nome || '—'}</td>
                <td>{l.interlocutor_nome || '—'}</td>
                <td>{data(l.iniciada_em)}</td>
                <td>
                  {l.situacao === 'em_andamento' && <span className="pill warn">Em andamento</span>}
                  {l.situacao === 'concluida' && <span className="pill good">Concluída</span>}
                  {l.situacao === 'pausada' && <span className="pill flat">Pausada</span>}
                  {l.situacao === 'cancelada' && <span className="pill flat">Cancelada</span>}
                </td>
                <td className="acoes">
                  <Link href={'/implantacao/' + l.id} className="btn btn-sm">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {naoIniciadas.length > 0 && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-body">
            <h3 style={{ marginTop: 0 }}>
              {linhas.length === 0 ? 'Comece por aqui' : 'Outra norma'}
            </h3>
            <p className="subtitulo" style={{ marginTop: 0 }}>
              Cada norma tem a sua trilha, e elas correm em paralelo — começar a segunda não
              atrapalha a primeira.
            </p>
            {naoIniciadas.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn btn-primary"
                style={{ marginRight: 8 }}
                disabled={criando}
                onClick={() => comecar(m.id)}
              >
                {criando ? 'Começando…' : 'Começar: ' + m.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Implantacoes() {
  return (
    <ComModulo modulo="implantacao">
      <ImplantacoesConteudo />
    </ComModulo>
  )
}
