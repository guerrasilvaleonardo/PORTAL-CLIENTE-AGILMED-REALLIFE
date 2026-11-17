'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import CadastroAbas from '@/components/CadastroAbas'
import Icone from '@/components/Icone'
import '../colaboradores.css'

/*
 * Locais de trabalho (supabase/locais-trabalho.sql).
 *
 * O portal era plano: um nível só, o CNPJ. Mas a empresa trabalha em
 * obras, frentes e setores, e a ficha de EPI precisa dizer onde a pessoa
 * estava no dia da entrega. Aqui a própria empresa cadastra esses
 * lugares, sem passar por nós.
 *
 * Lugar não se apaga: obra que acabou vira inativa e some das listas,
 * mas continua nas fichas antigas, onde ela faz parte do registro.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const TIPOS = [
  { valor: 'obra', rotulo: 'Obra' },
  { valor: 'frente', rotulo: 'Frente de trabalho' },
  { valor: 'unidade', rotulo: 'Unidade' },
  { valor: 'setor', rotulo: 'Setor' },
]
const rotuloTipo = (v: string) => TIPOS.find((t) => t.valor === v)?.rotulo || v

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Local = {
  id: string
  empresa_id: string
  nome: string
  tipo: string
  endereco: string | null
  cidade_uf: string | null
  cno: string | null
  responsavel: string | null
  observacoes: string | null
  ativo: boolean
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
}

const formVazio = {
  id: '',
  empresa_id: '',
  nome: '',
  tipo: 'obra',
  endereco: '',
  cidade_uf: '',
  cno: '',
  responsavel: '',
  observacoes: '',
  ativo: true,
}

const nomeEmpresa = (e: { nome_fantasia: string | null; razao_social: string } | null | undefined) =>
  e ? e.nome_fantasia || e.razao_social : ''

/* CNO tem 12 dígitos; mostramos agrupado como o eSocial escreve. */
function cnoBonito(cno: string | null): string {
  if (!cno) return '—'
  const d = cno.replace(/\D/g, '')
  if (d.length !== 12) return cno
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 10)}/${d.slice(10)}`
}

export default function LocaisTrabalho() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [lista, setLista] = useState<Local[]>([])
  const [quantos, setQuantos] = useState<Record<string, number>>({})

  const [busca, setBusca] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const [painelAberto, setPainelAberto] = useState(false)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)

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

      const { data, error } = await supabase
        .from('locais_trabalho')
        .select('*, empresas(nome_fantasia, razao_social)')
        .order('nome')

      if (error) {
        /* Enquanto o SQL não rodou, a tela avisa em vez de quebrar. */
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setLista(
        ((data || []) as any[]).map((l) => ({
          ...l,
          empresas: Array.isArray(l.empresas) ? l.empresas[0] : l.empresas,
        })) as Local[]
      )

      /* Quantas pessoas em cada lugar — é o que diz se a obra ainda existe. */
      const { data: pessoas } = await supabase
        .from('colaboradores')
        .select('local_id')
        .not('local_id', 'is', null)
      const conta: Record<string, number> = {}
      for (const p of (pessoas || []) as { local_id: string }[]) {
        conta[p.local_id] = (conta[p.local_id] || 0) + 1
      }
      setQuantos(conta)
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os locais.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape' && painelAberto && !salvando) setPainelAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [painelAberto, salvando])

  const filtrados = useMemo(() => {
    const palavras = palavrasDaBusca(busca)
    return lista.filter((l) => {
      if (empresaFiltro && l.empresa_id !== empresaFiltro) return false
      if (!mostrarInativos && !l.ativo) return false
      if (!palavras.length) return true
      const alvo = [l.nome, l.endereco, l.cidade_uf, l.responsavel, l.cno].filter(Boolean).join(' ')
      return casaBusca(alvo, palavras)
    })
  }, [lista, busca, empresaFiltro, mostrarInativos])

  const numeros = useMemo(() => {
    const base = (empresaFiltro ? lista.filter((l) => l.empresa_id === empresaFiltro) : lista).filter(
      (l) => l.ativo
    )
    return {
      total: base.length,
      obras: base.filter((l) => l.tipo === 'obra').length,
      comPessoas: base.filter((l) => (quantos[l.id] || 0) > 0).length,
    }
  }, [lista, empresaFiltro, quantos])

  function abrirNovo() {
    setForm({ ...formVazio, empresa_id: interno ? empresaFiltro : minhaEmpresa })
    setAviso('')
    setPainelAberto(true)
  }

  function abrirEdicao(l: Local) {
    setForm({
      id: l.id,
      empresa_id: l.empresa_id,
      nome: l.nome,
      tipo: l.tipo,
      endereco: l.endereco || '',
      cidade_uf: l.cidade_uf || '',
      cno: l.cno || '',
      responsavel: l.responsavel || '',
      observacoes: l.observacoes || '',
      ativo: l.ativo,
    })
    setAviso('')
    setPainelAberto(true)
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    setAviso('')

    const nome = form.nome.trim()
    if (!nome) {
      setAviso('Informe o nome do local.')
      return
    }
    const empresaId = interno ? form.empresa_id : minhaEmpresa
    if (!empresaId) {
      setAviso('Escolha a empresa.')
      return
    }
    const cno = form.cno.replace(/\D/g, '')
    if (cno && cno.length !== 12) {
      setAviso('O CNO tem 12 dígitos. Confira o número ou deixe em branco.')
      return
    }

    try {
      setSalvando(true)
      const dados = {
        empresa_id: empresaId,
        nome,
        tipo: form.tipo,
        endereco: form.endereco.trim() || null,
        cidade_uf: form.cidade_uf.trim() || null,
        cno: cno || null,
        responsavel: form.responsavel.trim() || null,
        observacoes: form.observacoes.trim() || null,
        ativo: form.ativo,
      }

      const { error } = form.id
        ? await supabase.from('locais_trabalho').update(dados).eq('id', form.id)
        : await supabase.from('locais_trabalho').insert(dados)

      if (error) {
        /* O índice único por empresa + nome: o mesmo lugar não entra duas vezes. */
        if (error.code === '23505') {
          setAviso('Já existe um local com esse nome nesta empresa.')
          return
        }
        throw error
      }

      setPainelAberto(false)
      await carregar()
    } catch (e: any) {
      console.error(e)
      setAviso(e?.message || 'Não foi possível salvar o local.')
    } finally {
      setSalvando(false)
    }
  }

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          O cadastro de locais ainda não foi criado no banco. Rode{' '}
          <code>supabase/locais-trabalho.sql</code> no SQL Editor do Supabase.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <CadastroAbas />

      <div>
        <p className="eyebrow">Cadastros</p>
        <h1 className="titulo-tela">Locais de trabalho</h1>
        <p className="subtitulo-tela">
          As obras, frentes, unidades e setores da sua empresa. É o que separa a ficha de EPI por
          lugar e diz onde cada pessoa estava no dia da entrega.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{numeros.total}</div>
          <div className="lbl">Locais ativos</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.obras}</div>
          <div className="lbl">Obras</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.comPessoas}</div>
          <div className="lbl">Com gente alocada</div>
        </div>
      </div>

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <input
          type="search"
          id="busca-local"
          placeholder="Nome, endereço, cidade ou responsável"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="caixa-marcar">
          <input
            type="checkbox"
            id="locais-inativos"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
          />
          Mostrar encerrados
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={abrirNovo}>
          <Icone nome="mais" /> Novo local
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="section-title">
            {carregando ? 'Carregando…' : `${filtrados.length} local${filtrados.length === 1 ? '' : 'is'}`}
          </span>
        </div>
        <div className="table-scroll">
          <table className="tabela-colab">
            <thead>
              <tr>
                <th>Local</th>
                <th>Tipo</th>
                <th>Cidade/UF</th>
                <th>CNO</th>
                <th>Responsável</th>
                <th>Pessoas</th>
                {interno && <th>Empresa</th>}
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {!carregando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={interno ? 8 : 7} className="empty-state">
                    Nenhum local cadastrado ainda. Comece pela obra ou unidade onde a sua equipe
                    está hoje.
                  </td>
                </tr>
              )}
              {filtrados.map((l) => (
                <tr key={l.id} className={l.ativo ? '' : 'inativo'}>
                  <td className="nome">
                    {l.nome}
                    {l.endereco && <span className="complemento"> · {l.endereco}</span>}
                    {!l.ativo && <span className="pill flat"> Encerrado</span>}
                  </td>
                  <td>{rotuloTipo(l.tipo)}</td>
                  <td>{l.cidade_uf || '—'}</td>
                  <td className="mono">{cnoBonito(l.cno)}</td>
                  <td>{l.responsavel || '—'}</td>
                  <td className="mono">{quantos[l.id] || 0}</td>
                  {interno && <td>{nomeEmpresa(l.empresas)}</td>}
                  <td className="acoes">
                    <button type="button" className="btn btn-sm" onClick={() => abrirEdicao(l)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {painelAberto && (
        <div className="cortina" role="dialog" aria-modal="true" aria-label="Local de trabalho">
          <form className="painel-lateral" onSubmit={salvar}>
            <div className="painel-head">
              <h2>{form.id ? 'Editar local' : 'Novo local'}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPainelAberto(false)}
                disabled={salvando}
              >
                Fechar
              </button>
            </div>

            <div className="painel-corpo">
              {aviso && <div className="banner bad">{aviso}</div>}

              {interno && (
                <div className="field">
                  <label htmlFor="local-empresa">Empresa</label>
                  <select
                    id="local-empresa"
                    value={form.empresa_id}
                    onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
                    disabled={!!form.id}
                  >
                    <option value="">Escolha a empresa</option>
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label htmlFor="local-nome">Nome do local</label>
                <input
                  id="local-nome"
                  placeholder="Obra Jardins, Unidade Porto Velho, Frente 3…"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="field">
                <label htmlFor="local-tipo">Tipo</label>
                <select
                  id="local-tipo"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  {TIPOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="local-endereco">Endereço</label>
                <input
                  id="local-endereco"
                  placeholder="Opcional"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="local-cidade">Cidade/UF</label>
                <input
                  id="local-cidade"
                  placeholder="Porto Velho/RO"
                  value={form.cidade_uf}
                  onChange={(e) => setForm({ ...form, cidade_uf: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="local-cno">CNO</label>
                <input
                  id="local-cno"
                  inputMode="numeric"
                  placeholder="Só para canteiro de obra"
                  value={form.cno}
                  onChange={(e) => setForm({ ...form, cno: e.target.value })}
                />
                <small>
                  Cadastro Nacional de Obras, 12 dígitos. É o que liga a obra ao eSocial e à NR-18.
                </small>
              </div>

              <div className="field">
                <label htmlFor="local-responsavel">Responsável</label>
                <input
                  id="local-responsavel"
                  placeholder="Quem responde por este local"
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="local-obs">Observações</label>
                <input
                  id="local-obs"
                  placeholder="Opcional"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>

              <label className="caixa-marcar">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                Local em atividade
              </label>
              <p className="dica">
                Obra que acabou: desmarque aqui. Ela sai das listas, mas continua nas fichas antigas
                — é onde a pessoa estava no dia em que recebeu o equipamento.
              </p>
            </div>

            <div className="painel-rodape">
              <button
                type="button"
                className="btn"
                onClick={() => setPainelAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
