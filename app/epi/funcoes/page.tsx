'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import { chaveDaFuncao } from '@/lib/funcao'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import './funcoes.css'

/*
 * EPI por função (supabase/epi-por-funcao.sql).
 *
 * A tela "Entrega de EPI por Ocupação/Função" do OnSafety: a empresa diz
 * uma vez o que cada função recebe, e a entrega para de depender de
 * alguém lembrar, no almoxarifado, que o eletricista também leva luva
 * isolante.
 *
 * As funções não são cadastradas aqui. Elas vêm do campo "função" dos
 * trabalhadores — é o mesmo texto que sai na ficha, e inventar um
 * segundo cadastro de cargos só criaria duas listas para divergirem.
 *
 * Grava a cada clique, sem botão de salvar, como o estoque na tela de
 * configuração: é uma marcação, não um formulário.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Epi = {
  id: string
  empresa_id: string
  nome: string
  complemento: string | null
  ca: string | null
  tipo: 'epi' | 'outros'
  ativo: boolean
}

type Trabalhador = { id: string; empresa_id: string; funcao: string | null }

type LinhaFuncao = {
  id: string
  empresa_id: string
  funcao: string
  funcao_chave: string
  epi_id: string
  quantidade: number
}

const nomeDoEpi = (e: Epi) =>
  [e.ca ? `${e.ca} -` : '', e.nome, e.complemento ? `· ${e.complemento}` : '']
    .filter(Boolean)
    .join(' ')

export default function EpiPorFuncao() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [epis, setEpis] = useState<Epi[]>([])
  const [trabalhadores, setTrabalhadores] = useState<Trabalhador[]>([])
  const [linhas, setLinhas] = useState<LinhaFuncao[]>([])

  const [escolhida, setEscolhida] = useState('')
  const [busca, setBusca] = useState('')
  const [salvandoEpi, setSalvandoEpi] = useState('')

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

      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()
      if (perfilError) throw perfilError

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

      const [{ data: listaEpis }, { data: listaPessoas }, porFuncao] = await Promise.all([
        supabase.from('epis').select('id, empresa_id, nome, complemento, ca, tipo, ativo').order('nome'),
        supabase.from('colaboradores').select('id, empresa_id, funcao'),
        supabase.from('epi_funcoes').select('id, empresa_id, funcao, funcao_chave, epi_id, quantidade'),
      ])

      if (porFuncao.error) {
        /* Enquanto o SQL não rodou, a tela avisa em vez de quebrar. */
        if (
          porFuncao.error.code === '42P01' ||
          /does not exist|schema cache/i.test(porFuncao.error.message || '')
        ) {
          setSemTabela(true)
          return
        }
        throw porFuncao.error
      }

      setEpis((listaEpis || []) as Epi[])
      setTrabalhadores((listaPessoas || []) as Trabalhador[])
      setLinhas((porFuncao.data || []) as LinhaFuncao[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar as funções.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  /* As funções que existem: as do cadastro de trabalhadores, mais as que
   * já têm lista montada — uma função pode ter sido configurada antes de
   * alguém ser contratado para ela. */
  const funcoes = useMemo(() => {
    const mapa = new Map<string, { chave: string; rotulo: string; pessoas: number; itens: number }>()

    for (const t of trabalhadores) {
      if (empresaAtual && t.empresa_id !== empresaAtual) continue
      const chave = chaveDaFuncao(t.funcao)
      if (!chave) continue
      const atual = mapa.get(chave)
      if (atual) atual.pessoas += 1
      else mapa.set(chave, { chave, rotulo: (t.funcao || '').trim(), pessoas: 1, itens: 0 })
    }

    for (const l of linhas) {
      if (empresaAtual && l.empresa_id !== empresaAtual) continue
      const atual = mapa.get(l.funcao_chave)
      if (atual) atual.itens += 1
      else mapa.set(l.funcao_chave, { chave: l.funcao_chave, rotulo: l.funcao, pessoas: 0, itens: 1 })
    }

    const palavras = palavrasDaBusca(busca)
    return [...mapa.values()]
      .filter((f) => !palavras.length || casaBusca(f.rotulo, palavras))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  }, [trabalhadores, linhas, empresaAtual, busca])

  const funcaoAberta = useMemo(
    () => funcoes.find((f) => f.chave === escolhida) || null,
    [funcoes, escolhida]
  )

  /* Os equipamentos que a empresa pode colocar numa função. Fora de
   * linha não aparece: não faz sentido mandar entregar o que a empresa
   * parou de comprar. */
  const episDaEmpresa = useMemo(
    () => epis.filter((e) => e.ativo && (!empresaAtual || e.empresa_id === empresaAtual)),
    [epis, empresaAtual]
  )

  const daFuncao = useMemo(() => {
    const mapa = new Map<string, LinhaFuncao>()
    for (const l of linhas) {
      if (l.funcao_chave !== escolhida) continue
      if (empresaAtual && l.empresa_id !== empresaAtual) continue
      mapa.set(l.epi_id, l)
    }
    return mapa
  }, [linhas, escolhida, empresaAtual])

  async function alternar(epi: Epi) {
    if (!empresaAtual || !funcaoAberta) return
    const jaTem = daFuncao.get(epi.id)
    setSalvandoEpi(epi.id)
    setAviso('')
    try {
      if (jaTem) {
        const { error } = await supabase.from('epi_funcoes').delete().eq('id', jaTem.id)
        if (error) throw error
        setLinhas((atual) => atual.filter((l) => l.id !== jaTem.id))
      } else {
        const { data, error } = await supabase
          .from('epi_funcoes')
          .insert({
            empresa_id: empresaAtual,
            funcao: funcaoAberta.rotulo,
            funcao_chave: funcaoAberta.chave,
            epi_id: epi.id,
            quantidade: 1,
          })
          .select('id, empresa_id, funcao, funcao_chave, epi_id, quantidade')
          .single()
        if (error) throw error
        setLinhas((atual) => [...atual, data as LinhaFuncao])
      }
    } catch (e: any) {
      console.error(e)
      setAviso(e?.message || 'Não foi possível salvar.')
    } finally {
      setSalvandoEpi('')
    }
  }

  async function mudarQuantidade(linha: LinhaFuncao, valor: string) {
    const qtd = Math.max(1, Math.min(999, Number(valor) || 1))
    if (qtd === linha.quantidade) return
    setSalvandoEpi(linha.epi_id)
    setAviso('')
    try {
      const { error } = await supabase
        .from('epi_funcoes')
        .update({ quantidade: qtd })
        .eq('id', linha.id)
      if (error) throw error
      setLinhas((atual) => atual.map((l) => (l.id === linha.id ? { ...l, quantidade: qtd } : l)))
    } catch (e: any) {
      console.error(e)
      setAviso(e?.message || 'Não foi possível salvar a quantidade.')
    } finally {
      setSalvandoEpi('')
    }
  }

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          O EPI por função ainda não foi criado no banco. Rode{' '}
          <code>supabase/epi-por-funcao.sql</code> no SQL Editor do Supabase.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">EPI</p>
        <h1 className="titulo-tela">EPI por função</h1>
        <p className="subtitulo-tela">
          O que cada função recebe. Na entrega, escolher o trabalhador já marca os equipamentos da
          função dele — quem entrega confere e desmarca o que não for o caso.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {aviso && <div className="banner bad">{aviso}</div>}

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={(id) => {
              setEmpresaFiltro(id)
              setEscolhida('')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <input
          type="search"
          placeholder="Procurar função"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {interno && !empresaAtual ? (
        <div className="banner">Escolha a empresa para ver as funções.</div>
      ) : carregando ? (
        <div className="banner">Carregando…</div>
      ) : (
        <div className="duas-colunas">
          <div className="panel">
            <div className="panel-head">
              <h2>
                {funcoes.length} funç{funcoes.length === 1 ? 'ão' : 'ões'}
              </h2>
            </div>
            {funcoes.length === 0 ? (
              <p className="dica" style={{ margin: 16 }}>
                Nenhuma função no cadastro desta empresa. A função vem da ficha de cada trabalhador,
                em Colaboradores.
              </p>
            ) : (
              <ul className="lista-funcoes">
                {funcoes.map((f) => (
                  <li key={f.chave}>
                    <button
                      type="button"
                      className={f.chave === escolhida ? 'ativa' : ''}
                      onClick={() => setEscolhida(f.chave)}
                    >
                      <span className="rotulo">{f.rotulo}</span>
                      <span className="contas">
                        {f.pessoas} {f.pessoas === 1 ? 'pessoa' : 'pessoas'}
                        {' · '}
                        {f.itens === 0 ? 'sem lista' : `${f.itens} ${f.itens === 1 ? 'item' : 'itens'}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{funcaoAberta ? funcaoAberta.rotulo : 'Escolha uma função'}</h2>
            </div>

            {!funcaoAberta ? (
              <p className="dica" style={{ margin: 16 }}>
                Escolha uma função à esquerda para montar a lista dela.
              </p>
            ) : episDaEmpresa.length === 0 ? (
              <p className="dica" style={{ margin: 16 }}>
                Esta empresa ainda não tem equipamentos cadastrados. Cadastre em Configuração de
                EPI&apos;s.
              </p>
            ) : (
              <ul className="lista-epis">
                {episDaEmpresa.map((e) => {
                  const linha = daFuncao.get(e.id)
                  return (
                    <li key={e.id} className={linha ? 'marcado' : ''}>
                      <label className="caixa-marcar">
                        <input
                          type="checkbox"
                          checked={Boolean(linha)}
                          disabled={salvandoEpi === e.id}
                          onChange={() => alternar(e)}
                        />
                        {nomeDoEpi(e)}
                      </label>
                      {linha && (
                        <span className="qtd">
                          <label htmlFor={`qtd-${e.id}`}>Qtde.</label>
                          <input
                            id={`qtd-${e.id}`}
                            type="number"
                            min={1}
                            max={999}
                            defaultValue={linha.quantidade}
                            disabled={salvandoEpi === e.id}
                            onBlur={(ev) => mudarQuantidade(linha, ev.target.value)}
                          />
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
