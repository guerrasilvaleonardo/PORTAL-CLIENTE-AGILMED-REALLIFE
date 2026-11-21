'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../colaboradores/colaboradores.css'
import './inspecoes.css'

/*
 * Inspeções aplicadas (supabase/inspecoes.sql).
 *
 * A lista do que já foi a campo e o botão para começar uma nova. Ao
 * começar, as perguntas do modelo são COPIADAS para a inspeção: mudar o
 * modelo amanhã não reescreve o que foi inspecionado hoje.
 *
 * Quem aplica: o técnico da Real Life no cliente, e o próprio cliente
 * nas inspeções dele. O banco decide quem pode (pode_gerir_inspecoes).
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Local = { id: string; empresa_id: string; nome: string }
type Modelo = { id: string; empresa_id: string | null; nome: string; norma: string | null; ativo: boolean }

type Inspecao = {
  id: string
  empresa_id: string
  modelo_nome: string
  norma: string | null
  local_nome: string | null
  inspetor_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  itens_total: number
  nao_conformes: number
  percentual: number | null
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function InspecoesConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [meuNome, setMeuNome] = useState('')
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [locais, setLocais] = useState<Local[]>([])
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([])

  const [modeloEscolhido, setModeloEscolhido] = useState('')
  /* Os checklists desta inspeção. Vazio = nenhum escolhido ainda. */
  const [extras, setExtras] = useState<string[]>([])
  const [localEscolhido, setLocalEscolhido] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

  async function carregar() {
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
        .select('perfil, empresa_id, nome')
        .eq('id', user.id)
        .single()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')
      setMeuNome(perfil?.nome || '')

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const { data: lista, error: erroI } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, modelo_nome, norma, local_nome, inspetor_nome, iniciada_em, ' +
            'concluida_em, situacao, itens_total, nao_conformes, percentual'
        )
        /* Auditoria de sistema de gestão é outro processo e tem tela
         * própria. Misturar as duas aqui faria o canteiro e o requisito
         * 9.3 da ISO disputarem a mesma lista. */
        .neq('tipo', 'auditoria')
        .order('iniciada_em', { ascending: false })
        .limit(300)

      if (erroI) {
        if (erroI.code === '42P01' || /does not exist|schema cache/i.test(erroI.message || '')) {
          setSemTabela(true)
          return
        }
        throw erroI
      }

      setInspecoes((lista || []) as unknown as Inspecao[])

      const [{ data: ms }, { data: ls }] = await Promise.all([
        /* Os checklists de auditoria ficam na tela de Auditorias. */
        supabase
          .from('inspecao_modelos')
          .select('id, empresa_id, nome, norma, ativo')
          .neq('tipo', 'auditoria')
          .order('nome'),
        supabase.from('locais_trabalho').select('id, empresa_id, nome').order('nome'),
      ])
      setModelos((ms || []) as Modelo[])
      setLocais((ls || []) as Local[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar as inspeções.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const visiveis = useMemo(
    () => inspecoes.filter((i) => !empresaAtual || i.empresa_id === empresaAtual),
    [inspecoes, empresaAtual]
  )

  const modelosDisponiveis = modelos.filter(
    (m) => m.ativo && (m.empresa_id === null || m.empresa_id === empresaAtual)
  )
  const locaisDaEmpresa = locais.filter((l) => l.empresa_id === empresaAtual)

  async function comecar() {
    if (abrindo) return
    if (!empresaAtual) {
      setErro('Escolha a empresa antes de começar.')
      return
    }
    const escolhidos = extras.length
      ? extras
      : modeloEscolhido
        ? [modeloEscolhido]
        : []

    if (!escolhidos.length) {
      setErro('Escolha pelo menos um checklist.')
      return
    }

    setAbrindo(true)
    setErro('')

    const local = locaisDaEmpresa.find((l) => l.id === localEscolhido) || null

    /*
     * MAIS DE UM CHECKLIST VIRA UMA VISITA.
     *
     * Cada `inspecoes` guarda um modelo só — é o que permite o
     * percentual de conformidade ser daquela norma, e não uma média
     * sem sentido entre NR-18 e NR-35. Para juntar vários na mesma ida
     * ao cliente, o que agrupa é a visita: um documento, um código, e
     * dentro dele o resultado de cada checklist.
     */
    if (escolhidos.length > 1) {
      const { data: visita, error: erroVisita } = await supabase
        .from('inspecao_visitas')
        .insert({
          empresa_id: empresaAtual,
          local_id: local?.id || null,
          local_nome: local?.nome || null,
          responsavel_nome: meuNome || null,
        })
        .select('id')
        .single()

      if (erroVisita || !visita) {
        setAbrindo(false)
        setErro(erroVisita?.message || 'Não foi possível abrir a visita.')
        return
      }

      for (const id of escolhidos) {
        const m = modelosDisponiveis.find((x) => x.id === id)
        if (!m) continue

        const { data: insp } = await supabase
          .from('inspecoes')
          .insert({
            empresa_id: empresaAtual,
            visita_id: (visita as any).id,
            modelo_id: m.id,
            modelo_nome: m.nome,
            norma: m.norma,
            local_id: local?.id || null,
            local_nome: local?.nome || null,
            inspetor_nome: meuNome || null,
          })
          .select('id')
          .single()
        if (!insp) continue

        const { data: itens } = await supabase
          .from('inspecao_modelo_itens')
          .select('id, ordem, categoria, pergunta, peso')
          .eq('modelo_id', m.id)
          .eq('ativo', true)
          .order('ordem')

        if (itens && itens.length) {
          await supabase.from('inspecao_respostas').insert(
            (itens as any[]).map((i) => ({
              inspecao_id: (insp as any).id,
              item_id: i.id,
              ordem: i.ordem,
              categoria: i.categoria,
              pergunta: i.pergunta,
              peso: i.peso,
            }))
          )
        }
      }

      window.location.href = '/inspecoes/campo?visita=' + (visita as any).id
      return
    }

    const modelo = modelosDisponiveis.find((m) => m.id === escolhidos[0])
    if (!modelo) {
      setAbrindo(false)
      setErro('Escolha o modelo de checklist.')
      return
    }

    const { data: nova, error } = await supabase
      .from('inspecoes')
      .insert({
        empresa_id: empresaAtual,
        modelo_id: modelo.id,
        modelo_nome: modelo.nome,
        norma: modelo.norma,
        local_id: local?.id || null,
        local_nome: local?.nome || null,
        inspetor_nome: meuNome || null,
      })
      .select('id')
      .single()

    if (error || !nova) {
      setAbrindo(false)
      setErro(error?.message || 'Não foi possível começar a inspeção.')
      return
    }

    /* As perguntas são copiadas agora: a inspeção é documento do dia. */
    const { data: itens } = await supabase
      .from('inspecao_modelo_itens')
      .select('id, ordem, categoria, pergunta, peso')
      .eq('modelo_id', modelo.id)
      .eq('ativo', true)
      .order('ordem')

    if (itens && itens.length) {
      const { error: erroResp } = await supabase.from('inspecao_respostas').insert(
        (itens as any[]).map((i) => ({
          inspecao_id: (nova as any).id,
          item_id: i.id,
          ordem: i.ordem,
          categoria: i.categoria,
          pergunta: i.pergunta,
          peso: i.peso,
        }))
      )
      if (erroResp) {
        setAbrindo(false)
        setErro('A inspeção foi aberta, mas as perguntas não entraram: ' + erroResp.message)
        return
      }
    }

    window.location.href = '/inspecoes/' + (nova as any).id
  }

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          As inspeções ainda não foram criadas no banco. Rode <code>supabase/inspecoes.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">Inspeções</h1>
        <p className="subtitulo-tela">
          O que foi a campo, o que estava conforme e o que virou não conformidade. Cada item
          reprovado abre uma não conformidade quando a inspeção é concluída.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={(v) => {
              setEmpresaFiltro(v)
              setModeloEscolhido('')
              setLocalEscolhido('')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        {/* Vários de uma vez: uma visita ao cliente raramente cabe num
            checklist só, e obrigar a abrir uma inspeção por norma
            fazia a mesma visita virar três registros sem nada ligando
            — e três relatórios para o cliente. */}
        <select
          value={modeloEscolhido}
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            setExtras((x) => (x.includes(id) ? x : [...x, id]))
            setModeloEscolhido('')
          }}
        >
          <option value="">
            {extras.length ? 'Adicionar outro checklist…' : 'Modelo de checklist…'}
          </option>
          {modelosDisponiveis
            .filter((m) => !extras.includes(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {m.norma ? ' · ' + m.norma : ''}
              </option>
            ))}
        </select>
        <select value={localEscolhido} onChange={(e) => setLocalEscolhido(e.target.value)}>
          <option value="">Local (opcional)…</option>
          {locaisDaEmpresa.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" disabled={abrindo} onClick={comecar}>
          {abrindo
            ? 'Abrindo…'
            : extras.length > 1
              ? `Nova inspeção · ${extras.length} checklists`
              : 'Nova inspeção'}
        </button>
        <span style={{ flex: 1 }} />
        <Link href="/inspecoes/modelos" className="btn btn-sm">
          Modelos
        </Link>
      </div>

      {extras.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-body">
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-muted)' }}>
              {extras.length === 1
                ? 'Um checklist nesta inspeção.'
                : `${extras.length} checklists nesta visita — um documento só, com o resultado de cada um.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {extras.map((id) => {
                const m = modelosDisponiveis.find((x) => x.id === id)
                return (
                  <button
                    key={id}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setExtras((x) => x.filter((v) => v !== id))}
                  >
                    {m?.nome || 'checklist'} ✕
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="empty-state">
          {interno && !empresaFiltro
            ? 'Escolha a empresa para ver as inspeções.'
            : 'Nenhuma inspeção ainda.'}
        </p>
      ) : (
        <table className="tabela-colab">
          <thead>
            <tr>
              <th>Checklist</th>
              <th>Local</th>
              <th>Inspetor</th>
              <th>Quando</th>
              <th>Situação</th>
              <th>Conformidade</th>
              <th className="acoes" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i) => (
              <tr key={i.id}>
                <td className="nome">
                  {i.modelo_nome}
                  {i.norma ? ' · ' + i.norma : ''}
                </td>
                <td>{i.local_nome || '—'}</td>
                <td>{i.inspetor_nome || '—'}</td>
                <td>{dataHora(i.concluida_em || i.iniciada_em)}</td>
                <td>
                  {i.situacao === 'em_andamento' && <span className="pill warn">Em andamento</span>}
                  {i.situacao === 'concluida' && <span className="pill good">Concluída</span>}
                  {i.situacao === 'cancelada' && <span className="pill flat">Cancelada</span>}
                </td>
                <td>
                  {i.percentual === null ? (
                    '—'
                  ) : (
                    <>
                      {i.percentual}%
                      {i.nao_conformes > 0 && (
                        <span className="pill bad"> {i.nao_conformes} NC</span>
                      )}
                    </>
                  )}
                </td>
                <td className="acoes">
                  <Link href={'/inspecoes/' + i.id} className="btn btn-sm">
                    {i.situacao === 'em_andamento' ? 'Continuar' : 'Abrir'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function Inspecoes() {
  return (
    <ComModulo modulo="inspecoes">
      <InspecoesConteudo />
    </ComModulo>
  )
}
