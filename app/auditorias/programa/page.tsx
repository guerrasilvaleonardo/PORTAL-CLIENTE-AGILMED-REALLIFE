'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import '../../inspecoes/inspecoes.css'

/*
 * Programa de auditoria do ano (ABNT NBR ISO 19011:2018, seção 5).
 *
 * A norma não pede auditorias: pede um PROGRAMA — o que será auditado
 * no ano, com que objetivo, contra que critério e com que riscos. É a
 * primeira coisa que o auditor externo pede, e a que mais falta nas
 * empresas pequenas, que auditam quando sobra tempo.
 *
 * O programa não trava nada: a auditoria pode nascer fora dele. Mas
 * quando nasce dentro, fica claro o que foi planejado e o que foi
 * cumprido.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Programa = {
  id: string
  empresa_id: string
  ano: number
  norma: string | null
  objetivos: string | null
  riscos: string | null
  responsavel_nome: string | null
  situacao: string
}

type Auditoria = {
  id: string
  programa_id: string | null
  modelo_nome: string
  situacao: string
  concluida_em: string | null
  percentual: number | null
}

function ProgramaConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [meuNome, setMeuNome] = useState('')
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [programas, setProgramas] = useState<Programa[]>([])
  const [auditorias, setAuditorias] = useState<Auditoria[]>([])
  const [escolhido, setEscolhido] = useState('')
  const [rascunho, setRascunho] = useState<Partial<Programa>>({})
  const [salvando, setSalvando] = useState(false)

  const [novo, setNovo] = useState({ ano: String(new Date().getFullYear()), norma: '' })

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
        .from('auditoria_programas')
        .select('id, empresa_id, ano, norma, objetivos, riscos, responsavel_nome, situacao')
        .order('ano', { ascending: false })

      if (error) {
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setProgramas((data || []) as unknown as Programa[])

      const { data: as } = await supabase
        .from('inspecoes')
        .select('id, programa_id, modelo_nome, situacao, concluida_em, percentual')
        .eq('tipo', 'auditoria')
        .not('programa_id', 'is', null)
      setAuditorias((as || []) as unknown as Auditoria[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar o programa.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const visiveis = useMemo(
    () => programas.filter((p) => !empresaAtual || p.empresa_id === empresaAtual),
    [programas, empresaAtual]
  )

  const atual = visiveis.find((p) => p.id === escolhido) || null
  const doPrograma = auditorias.filter((a) => a.programa_id === escolhido)

  async function criar() {
    if (salvando) return
    if (!empresaAtual) {
      setErro('Escolha a empresa antes de criar o programa.')
      return
    }

    setSalvando(true)
    const { data, error } = await supabase
      .from('auditoria_programas')
      .insert({
        empresa_id: empresaAtual,
        ano: Number(novo.ano),
        norma: novo.norma.trim() || null,
        responsavel_nome: meuNome || null,
      })
      .select('id, empresa_id, ano, norma, objetivos, riscos, responsavel_nome, situacao')
      .single()
    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setProgramas((p) => [data as unknown as Programa, ...p])
    setEscolhido((data as any).id)
    setNovo({ ano: String(new Date().getFullYear()), norma: '' })
  }

  async function salvar() {
    if (!atual || salvando) return
    setSalvando(true)

    const { error } = await supabase
      .from('auditoria_programas')
      .update({
        norma: rascunho.norma || null,
        objetivos: rascunho.objetivos || null,
        riscos: rascunho.riscos || null,
        situacao: rascunho.situacao || 'ativo',
      })
      .eq('id', atual.id)

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    await carregar()
  }

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          O programa de auditoria ainda não foi criado no banco. Rode{' '}
          <code>supabase/auditoria-ritos.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">AUDITORIAS</p>
        <h1 className="titulo-tela">Programa do ano</h1>
        <p className="subtitulo-tela">
          A ISO 19011 não pede auditorias soltas: pede um programa — o que será auditado no ano,
          com que objetivo e contra que critério. É a primeira coisa que o auditor externo pede.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={(v) => {
              setEmpresaFiltro(v)
              setEscolhido('')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <input
          type="number"
          min={2020}
          max={2100}
          value={novo.ano}
          onChange={(e) => setNovo({ ...novo, ano: e.target.value })}
          style={{ width: 110 }}
        />
        <input
          type="text"
          value={novo.norma}
          onChange={(e) => setNovo({ ...novo, norma: e.target.value })}
          placeholder="Norma (ex.: ISO 45001)"
        />
        <button type="button" className="btn btn-primary" disabled={salvando} onClick={criar}>
          Criar programa
        </button>
      </div>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="empty-state">
          {interno && !empresaFiltro
            ? 'Escolha a empresa para ver o programa.'
            : 'Nenhum programa ainda.'}
        </p>
      ) : (
        <div className="insp-duas">
          <div className="insp-lista">
            {visiveis.map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === escolhido ? 'ativo' : ''}
                onClick={() => {
                  setEscolhido(p.id)
                  setRascunho({
                    norma: p.norma,
                    objetivos: p.objetivos,
                    riscos: p.riscos,
                    situacao: p.situacao,
                  })
                }}
              >
                Programa {p.ano}
                <span className="sub">
                  {p.norma || 'sem norma definida'} ·{' '}
                  {p.situacao === 'ativo' ? 'ativo' : 'encerrado'}
                </span>
              </button>
            ))}
          </div>

          <div>
            {!atual ? (
              <p className="empty-state">Escolha um programa.</p>
            ) : (
              <>
                <div className="insp-ficha">
                  <label>
                    Norma de referência
                    <input
                      type="text"
                      value={rascunho.norma || ''}
                      onChange={(e) => setRascunho({ ...rascunho, norma: e.target.value })}
                    />
                  </label>
                  <label>
                    Objetivos do programa
                    <textarea
                      value={rascunho.objetivos || ''}
                      onChange={(e) => setRascunho({ ...rascunho, objetivos: e.target.value })}
                      placeholder="O que este programa quer alcançar no ano"
                    />
                  </label>
                  <label>
                    Riscos e oportunidades do programa
                    <textarea
                      value={rascunho.riscos || ''}
                      onChange={(e) => setRascunho({ ...rascunho, riscos: e.target.value })}
                      placeholder="O que pode fazer o programa falhar: agenda, competência, acesso"
                    />
                  </label>
                  <label>
                    Situação
                    <select
                      value={rascunho.situacao || 'ativo'}
                      onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="encerrado">Encerrado</option>
                    </select>
                  </label>
                  <button type="button" className="btn btn-primary" disabled={salvando} onClick={salvar}>
                    Salvar
                  </button>
                </div>

                <div className="section-title" style={{ marginTop: 16 }}>
                  Auditorias deste programa — {doPrograma.length}
                </div>
                <table className="tabela-colab">
                  <tbody>
                    {doPrograma.length === 0 && (
                      <tr>
                        <td>Nenhuma auditoria vinculada a este programa ainda.</td>
                      </tr>
                    )}
                    {doPrograma.map((a) => (
                      <tr key={a.id}>
                        <td className="nome">{a.modelo_nome}</td>
                        <td>{a.situacao === 'concluida' ? 'Concluída' : 'Em andamento'}</td>
                        <td>{a.percentual === null ? '—' : a.percentual + '%'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProgramaDeAuditoria() {
  return (
    <ComModulo modulo="auditoria">
      <ProgramaConteudo />
    </ComModulo>
  )
}
