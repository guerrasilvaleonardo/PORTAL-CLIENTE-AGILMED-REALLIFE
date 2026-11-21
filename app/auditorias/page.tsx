'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../colaboradores/colaboradores.css'
import '../inspecoes/inspecoes.css'

/*
 * Auditorias do sistema de gestão.
 *
 * Mesmo banco das inspeções — a auditoria é uma linha de inspecoes com
 * tipo = 'auditoria' — e tela própria, porque é outro serviço, com
 * outro preço e outro público. Quem contratou só inspeção não vê isto,
 * e o banco garante: a política de leitura olha o tipo.
 *
 * A auditoria pode nascer solta ou dentro do programa do ano, que é o
 * que a ISO 19011 pede na seção 5.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Modelo = { id: string; empresa_id: string | null; nome: string; norma: string | null; ativo: boolean; tipo: string }
type Programa = { id: string; empresa_id: string; ano: number; norma: string | null }

type Auditoria = {
  id: string
  empresa_id: string
  modelo_nome: string
  norma: string | null
  auditor_lider: string | null
  inspetor_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  itens_total: number
  nao_conformes: number
  parciais: number
  percentual: number | null
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function AuditoriasConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [meuNome, setMeuNome] = useState('')
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [programas, setProgramas] = useState<Programa[]>([])
  const [lista, setLista] = useState<Auditoria[]>([])

  const [modeloEscolhido, setModeloEscolhido] = useState('')
  const [programaEscolhido, setProgramaEscolhido] = useState('')
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

      const { data, error } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, modelo_nome, norma, auditor_lider, inspetor_nome, iniciada_em, ' +
            'concluida_em, situacao, itens_total, nao_conformes, parciais, percentual'
        )
        .eq('tipo', 'auditoria')
        .order('iniciada_em', { ascending: false })
        .limit(300)

      if (error) {
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setLista((data || []) as unknown as Auditoria[])

      const [{ data: ms }, { data: ps }] = await Promise.all([
        supabase
          .from('inspecao_modelos')
          .select('id, empresa_id, nome, norma, ativo, tipo')
          .eq('tipo', 'auditoria')
          .order('nome'),
        supabase.from('auditoria_programas').select('id, empresa_id, ano, norma').order('ano', { ascending: false }),
      ])
      setModelos((ms || []) as unknown as Modelo[])
      setProgramas((ps || []) as unknown as Programa[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar as auditorias.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const visiveis = useMemo(
    () => lista.filter((a) => !empresaAtual || a.empresa_id === empresaAtual),
    [lista, empresaAtual]
  )

  const modelosDisponiveis = modelos.filter(
    (m) => m.ativo && (m.empresa_id === null || m.empresa_id === empresaAtual)
  )
  const programasDaEmpresa = programas.filter((p) => p.empresa_id === empresaAtual)

  async function comecar() {
    if (abrindo) return
    if (!empresaAtual) {
      setErro('Escolha a empresa antes de começar.')
      return
    }
    const modelo = modelosDisponiveis.find((m) => m.id === modeloEscolhido)
    if (!modelo) {
      setErro('Escolha o checklist da auditoria.')
      return
    }

    setAbrindo(true)
    setErro('')

    const { data: nova, error } = await supabase
      .from('inspecoes')
      .insert({
        empresa_id: empresaAtual,
        tipo: 'auditoria',
        modelo_id: modelo.id,
        modelo_nome: modelo.nome,
        norma: modelo.norma,
        programa_id: programaEscolhido || null,
        inspetor_nome: meuNome || null,
        auditor_lider: meuNome || null,
        criterios: modelo.norma,
      })
      .select('id')
      .single()

    if (error || !nova) {
      setAbrindo(false)
      setErro(error?.message || 'Não foi possível abrir a auditoria.')
      return
    }

    /* As perguntas são copiadas agora: a auditoria é documento do dia. */
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
        setErro('A auditoria foi aberta, mas os requisitos não entraram: ' + erroResp.message)
        return
      }
    }

    window.location.href = '/auditorias/' + (nova as any).id
  }

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          As auditorias ainda não foram criadas no banco. Rode <code>supabase/inspecoes.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">AUDITORIAS</p>
        <h1 className="titulo-tela">Auditorias do sistema de gestão</h1>
        <p className="subtitulo-tela">
          Requisito por requisito da norma, com o que pedir para ver, modelo para baixar e
          evidência enviada pelo cliente. Cada achado vira constatação com prazo e dono.
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
              setProgramaEscolhido('')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <select value={modeloEscolhido} onChange={(e) => setModeloEscolhido(e.target.value)}>
          <option value="">Checklist da auditoria…</option>
          {modelosDisponiveis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <select value={programaEscolhido} onChange={(e) => setProgramaEscolhido(e.target.value)}>
          <option value="">Fora do programa…</option>
          {programasDaEmpresa.map((p) => (
            <option key={p.id} value={p.id}>
              Programa {p.ano}
              {p.norma ? ' · ' + p.norma : ''}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" disabled={abrindo} onClick={comecar}>
          {abrindo ? 'Abrindo…' : 'Nova auditoria'}
        </button>
      </div>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="empty-state">
          {interno && !empresaFiltro
            ? 'Escolha a empresa para ver as auditorias.'
            : 'Nenhuma auditoria ainda.'}
        </p>
      ) : (
        <table className="tabela-colab">
          <thead>
            <tr>
              <th>Norma</th>
              <th>Auditor líder</th>
              <th>Quando</th>
              <th>Situação</th>
              <th>Conformidade</th>
              <th className="acoes" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((a) => (
              <tr key={a.id}>
                <td className="nome">
                  {a.modelo_nome}
                  {a.norma ? ' · ' + a.norma : ''}
                </td>
                <td>{a.auditor_lider || a.inspetor_nome || '—'}</td>
                <td>{dataHora(a.concluida_em || a.iniciada_em)}</td>
                <td>
                  {a.situacao === 'em_andamento' && <span className="pill warn">Em andamento</span>}
                  {a.situacao === 'concluida' && <span className="pill good">Concluída</span>}
                  {a.situacao === 'cancelada' && <span className="pill flat">Cancelada</span>}
                </td>
                <td>
                  {a.percentual === null ? (
                    '—'
                  ) : (
                    <>
                      {a.percentual}%
                      {a.nao_conformes > 0 && <span className="pill bad"> {a.nao_conformes} maior</span>}
                      {a.parciais > 0 && <span className="pill warn"> {a.parciais} menor</span>}
                    </>
                  )}
                </td>
                <td className="acoes">
                  {/* A trilha vem antes do checklist: quem está no meio
                      de uma auditoria precisa primeiro saber onde parou. */}
                  <Link href={'/auditorias/' + a.id + '/trilha'} className="btn btn-sm">
                    Trilha
                  </Link>{' '}
                  <Link href={'/auditorias/' + a.id} className="btn btn-sm">
                    {a.situacao === 'em_andamento' ? 'Continuar' : 'Abrir'}
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

export default function Auditorias() {
  return (
    <ComModulo modulo="auditoria">
      <AuditoriasConteudo />
    </ComModulo>
  )
}
