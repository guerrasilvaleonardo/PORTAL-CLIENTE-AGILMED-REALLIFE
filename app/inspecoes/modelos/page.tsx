'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'

/*
 * Modelos de checklist (supabase/inspecoes.sql).
 *
 * O modelo é a folha que o técnico leva para campo: um nome, a norma de
 * referência e as perguntas. Quem aplica responde, não escreve.
 *
 * MODELO DA CASA x MODELO DA EMPRESA. O modelo sem empresa é da Real
 * Life e serve para qualquer cliente — a equipe monta uma vez o
 * "Inspeção de canteiro NR-18" e todo cliente usa. O modelo com empresa
 * é dela, para o que é só dela.
 *
 * A NORMA É REFERÊNCIA, NÃO CÓPIA. Escreva "NR-18" ou "ISO 45001:2024 —
 * 9.2" no campo da norma e a pergunta com as palavras de vocês. O texto
 * das normas é vendido pela ABNT e não entra aqui.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Modelo = {
  id: string
  empresa_id: string | null
  nome: string
  descricao: string | null
  norma: string | null
  ativo: boolean
}

type Item = {
  id: string
  modelo_id: string
  ordem: number
  categoria: string | null
  pergunta: string
  orientacao: string | null
  peso: number
  exige_foto: boolean
  ativo: boolean
}

function ModelosDeInspecaoConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [escolhido, setEscolhido] = useState('')

  const [novoNome, setNovoNome] = useState('')
  const [novaNorma, setNovaNorma] = useState('')
  const [daCasa, setDaCasa] = useState(true)
  const [novaPergunta, setNovaPergunta] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('')
  const [salvando, setSalvando] = useState(false)

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
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const { data: ms, error: erroM } = await supabase
        .from('inspecao_modelos')
        .select('id, empresa_id, nome, descricao, norma, ativo')
        .order('nome')

      if (erroM) {
        if (erroM.code === '42P01' || /does not exist|schema cache/i.test(erroM.message || '')) {
          setSemTabela(true)
          return
        }
        throw erroM
      }

      setModelos((ms || []) as Modelo[])

      const { data: is } = await supabase
        .from('inspecao_modelo_itens')
        .select('id, modelo_id, ordem, categoria, pergunta, orientacao, peso, exige_foto, ativo')
        .order('ordem')
      setItens((is || []) as Item[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os modelos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  /* O cliente vê os modelos da casa mais os dele. */
  const visiveis = useMemo(
    () => modelos.filter((m) => m.empresa_id === null || !empresaAtual || m.empresa_id === empresaAtual),
    [modelos, empresaAtual]
  )

  const modelo = visiveis.find((m) => m.id === escolhido) || null
  const itensDoModelo = itens.filter((i) => i.modelo_id === escolhido && i.ativo)

  async function criarModelo() {
    const nome = novoNome.trim()
    if (!nome || salvando) return
    /* Modelo da casa só a equipe cria; o cliente cria o dele. */
    const empresa = interno && daCasa ? null : empresaAtual || minhaEmpresa
    if (!empresa && !(interno && daCasa)) {
      setErro('Escolha a empresa antes de criar o modelo.')
      return
    }

    setSalvando(true)
    const { data, error } = await supabase
      .from('inspecao_modelos')
      .insert({ nome, norma: novaNorma.trim() || null, empresa_id: empresa })
      .select('id, empresa_id, nome, descricao, norma, ativo')
      .single()
    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setModelos((m) => [...m, data as Modelo])
    setEscolhido((data as Modelo).id)
    setNovoNome('')
    setNovaNorma('')
  }

  async function adicionarItem() {
    const pergunta = novaPergunta.trim()
    if (!pergunta || !escolhido || salvando) return

    setSalvando(true)
    const { data, error } = await supabase
      .from('inspecao_modelo_itens')
      .insert({
        modelo_id: escolhido,
        pergunta,
        categoria: novaCategoria.trim() || null,
        ordem: (itensDoModelo[itensDoModelo.length - 1]?.ordem || 0) + 1,
      })
      .select('id, modelo_id, ordem, categoria, pergunta, orientacao, peso, exige_foto, ativo')
      .single()
    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setItens((i) => [...i, data as Item])
    setNovaPergunta('')
  }

  /* Tirar o item não apaga: a inspeção antiga guarda a pergunta dela. */
  async function tirarItem(id: string) {
    const { error } = await supabase.from('inspecao_modelo_itens').update({ ativo: false }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    setItens((lista) => lista.map((i) => (i.id === id ? { ...i, ativo: false } : i)))
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
        <h1 className="titulo-tela">Modelos de checklist</h1>
        <p className="subtitulo-tela">
          A folha que o técnico leva para campo. Escreva a pergunta com as suas palavras e use o
          campo da norma só como referência — &quot;NR-18&quot;, &quot;ISO 45001:2024 — 9.2&quot;.
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
      </div>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : (
        <div className="insp-duas">
          <div>
            <div className="section-title">Modelos</div>
            <div className="insp-lista">
              {visiveis.length === 0 && (
                <p className="empty-state">Nenhum modelo ainda.</p>
              )}
              {visiveis.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={m.id === escolhido ? 'ativo' : ''}
                  onClick={() => setEscolhido(m.id)}
                >
                  {m.nome}
                  <span className="sub">
                    {m.empresa_id === null ? 'Modelo da Real Life' : 'Modelo da empresa'}
                    {m.norma ? ' · ' + m.norma : ''}
                  </span>
                </button>
              ))}
            </div>

            <div className="section-title" style={{ marginTop: 16 }}>
              Novo modelo
            </div>
            <div className="insp-ficha">
              <label>
                Nome
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex.: Inspeção de canteiro"
                />
              </label>
              <label>
                Norma de referência
                <input
                  type="text"
                  value={novaNorma}
                  onChange={(e) => setNovaNorma(e.target.value)}
                  placeholder="Ex.: NR-18"
                />
              </label>
              {interno && (
                <label className="caixa-marcar" style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <input type="checkbox" checked={daCasa} onChange={(e) => setDaCasa(e.target.checked)} />
                  Modelo da Real Life (serve para qualquer cliente)
                </label>
              )}
              <button type="button" className="btn btn-primary" disabled={salvando} onClick={criarModelo}>
                Criar modelo
              </button>
            </div>
          </div>

          <div>
            {!modelo ? (
              <p className="empty-state">Escolha um modelo para ver as perguntas.</p>
            ) : (
              <>
                <div className="section-title">
                  {modelo.nome}
                  {modelo.norma ? ' · ' + modelo.norma : ''} — {itensDoModelo.length} pergunta
                  {itensDoModelo.length === 1 ? '' : 's'}
                </div>

                <table className="tabela-colab">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Pergunta</th>
                      <th>Categoria</th>
                      <th className="acoes" />
                    </tr>
                  </thead>
                  <tbody>
                    {itensDoModelo.length === 0 && (
                      <tr>
                        <td colSpan={4}>Nenhuma pergunta ainda.</td>
                      </tr>
                    )}
                    {itensDoModelo.map((i, n) => (
                      <tr key={i.id}>
                        <td>{n + 1}</td>
                        <td className="nome">{i.pergunta}</td>
                        <td>{i.categoria || '—'}</td>
                        <td className="acoes">
                          <button type="button" className="btn btn-sm" onClick={() => tirarItem(i.id)}>
                            Tirar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="insp-ficha" style={{ marginTop: 12 }}>
                  <div className="duas">
                    <label>
                      Pergunta
                      <input
                        type="text"
                        value={novaPergunta}
                        onChange={(e) => setNovaPergunta(e.target.value)}
                        placeholder="Ex.: Extintor sinalizado e desobstruído?"
                      />
                    </label>
                    <label>
                      Categoria
                      <input
                        type="text"
                        value={novaCategoria}
                        onChange={(e) => setNovaCategoria(e.target.value)}
                        placeholder="Ex.: Proteção contra incêndio"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={salvando}
                    onClick={adicionarItem}
                  >
                    Acrescentar pergunta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function ModelosDeInspecao() {
  return (
    <ComModulo modulo="inspecoes">
      <ModelosDeInspecaoConteudo />
    </ComModulo>
  )
}
