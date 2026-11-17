'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import { formatarCpf, soDigitosCpf, normalizarTexto } from '@/lib/historicoCertificados'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import Icone from '@/components/Icone'
import './colaboradores.css'

/*
 * Cadastro de colaboradores da empresa (supabase/colaboradores.sql).
 *
 * Até aqui o portal não tinha pessoas: o nome era digitado em cada
 * certificado. Esta tela é o cadastro que faltava — a mesma pessoa em
 * todos os lugares, com CPF, matrícula e função. É o que a entrega de
 * EPI vai usar para montar a ficha da NR-06.
 *
 * Quem saiu da empresa continua sendo marcado em Certificados, na tabela
 * colaboradores_desligados. Aqui a pessoa aparece com o selo "Desligado",
 * lido de lá; esta tela não desliga ninguém, para não existirem duas
 * respostas para a mesma pergunta.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Colaborador = {
  id: string
  empresa_id: string
  nome: string
  nome_chave: string
  cpf: string | null
  matricula: string | null
  funcao: string | null
  local_trabalho: string | null
  admissao: string | null
  situacao: 'ativo' | 'afastado'
  email: string | null
  telefone: string | null
  observacoes: string | null
  origem: string
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
}

const formVazio = {
  id: '',
  empresa_id: '',
  nome: '',
  cpf: '',
  matricula: '',
  funcao: '',
  local_trabalho: '',
  admissao: '',
  situacao: 'ativo' as 'ativo' | 'afastado',
  email: '',
  telefone: '',
  observacoes: '',
}

const nomeEmpresa = (e: { nome_fantasia: string | null; razao_social: string } | null | undefined) =>
  e ? e.nome_fantasia || e.razao_social : ''

/*
 * Dígito verificador do CPF, sobre os 11 dígitos que soDigitosCpf já
 * devolveu. Evita guardar número impossível no cadastro — um CPF errado
 * aqui junta ou separa a pessoa errada nos certificados.
 */
function cpfValido(digitos: string): boolean {
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false
  const conta = (ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i += 1) soma += Number(digitos[i]) * (ate + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return conta(9) === Number(digitos[9]) && conta(10) === Number(digitos[10])
}

export default function Colaboradores() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [lista, setLista] = useState<Colaborador[]>([])
  const [desligados, setDesligados] = useState<Set<string>>(new Set())

  const [busca, setBusca] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [situacaoFiltro, setSituacaoFiltro] = useState('')

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
        .from('colaboradores')
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
        ((data || []) as any[]).map((c) => ({
          ...c,
          empresas: Array.isArray(c.empresas) ? c.empresas[0] : c.empresas,
        })) as Colaborador[]
      )

      /* Quem está desligado continua vindo de Certificados. */
      const { data: desl } = await supabase
        .from('colaboradores_desligados')
        .select('empresa_id, nome_chave')
        .is('reativado_em', null)
      setDesligados(new Set(((desl || []) as any[]).map((d) => `${d.empresa_id}|${d.nome_chave}`)))
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os colaboradores.')
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

  const estaDesligado = (c: Colaborador) => desligados.has(`${c.empresa_id}|${c.nome_chave}`)

  const filtrados = useMemo(() => {
    const palavras = palavrasDaBusca(busca)
    return lista.filter((c) => {
      if (empresaFiltro && c.empresa_id !== empresaFiltro) return false
      if (situacaoFiltro === 'desligado' && !estaDesligado(c)) return false
      if (situacaoFiltro === 'ativo' && (estaDesligado(c) || c.situacao !== 'ativo')) return false
      if (situacaoFiltro === 'afastado' && (estaDesligado(c) || c.situacao !== 'afastado')) return false
      if (!palavras.length) return true
      const alvo = [c.nome, c.matricula, c.funcao, c.local_trabalho, formatarCpf(c.cpf)].filter(Boolean).join(' ')
      return casaBusca(alvo, palavras)
    })
  }, [lista, busca, empresaFiltro, situacaoFiltro, desligados])

  const numeros = useMemo(() => {
    const base = empresaFiltro ? lista.filter((c) => c.empresa_id === empresaFiltro) : lista
    const fora = base.filter(estaDesligado).length
    return {
      total: base.length,
      semCpf: base.filter((c) => !c.cpf).length,
      afastados: base.filter((c) => c.situacao === 'afastado' && !estaDesligado(c)).length,
      desligados: fora,
    }
  }, [lista, empresaFiltro, desligados])

  function abrirNovo() {
    setForm({ ...formVazio, empresa_id: interno ? empresaFiltro : minhaEmpresa })
    setAviso('')
    setPainelAberto(true)
  }

  function abrirEdicao(c: Colaborador) {
    setForm({
      id: c.id,
      empresa_id: c.empresa_id,
      nome: c.nome,
      cpf: formatarCpf(c.cpf),
      matricula: c.matricula || '',
      funcao: c.funcao || '',
      local_trabalho: c.local_trabalho || '',
      admissao: c.admissao || '',
      situacao: c.situacao,
      email: c.email || '',
      telefone: c.telefone || '',
      observacoes: c.observacoes || '',
    })
    setAviso('')
    setPainelAberto(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setAviso('')

    const nome = form.nome.trim()
    if (!nome) {
      setAviso('Informe o nome do colaborador.')
      return
    }
    const empresaId = interno ? form.empresa_id : minhaEmpresa
    if (!empresaId) {
      setAviso('Escolha a empresa.')
      return
    }
    const cpf = soDigitosCpf(form.cpf)
    if (form.cpf.trim() && (!cpf || !cpfValido(cpf))) {
      setAviso('Esse CPF não confere. Veja se faltou algum número.')
      return
    }

    /* Mesma pessoa duas vezes na mesma empresa trava no banco; avisamos antes. */
    const chave = normalizarTexto(nome)
    const repetido = lista.find(
      (c) =>
        c.id !== form.id &&
        c.empresa_id === empresaId &&
        (c.nome_chave === chave || (!!cpf && c.cpf === cpf))
    )
    if (repetido) {
      setAviso(`${repetido.nome} já está cadastrado nesta empresa.`)
      return
    }

    try {
      setSalvando(true)
      const dados = {
        empresa_id: empresaId,
        nome,
        nome_chave: chave,
        cpf: cpf || null,
        matricula: form.matricula.trim() || null,
        funcao: form.funcao.trim() || null,
        local_trabalho: form.local_trabalho.trim() || null,
        admissao: form.admissao || null,
        situacao: form.situacao,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        observacoes: form.observacoes.trim() || null,
      }

      const { error } = form.id
        ? await supabase.from('colaboradores').update(dados).eq('id', form.id)
        : await supabase.from('colaboradores').insert(dados)

      if (error) throw error

      setPainelAberto(false)
      await carregar()
    } catch (e: any) {
      console.error(e)
      setAviso(e?.message || 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          O cadastro de colaboradores ainda não foi criado no banco. Rode{' '}
          <code>supabase/colaboradores.sql</code> no SQL Editor do Supabase.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">Cadastro</p>
        <h1 className="titulo-tela">Colaboradores</h1>
        <p className="subtitulo-tela">
          As pessoas de cada empresa, com CPF, matrícula e função. É este cadastro que liga os
          certificados da mesma pessoa e que a entrega de EPI usa na ficha.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{numeros.total}</div>
          <div className="lbl">Cadastrados</div>
        </div>
        <div className="stat warn">
          <div className="num">{numeros.semCpf}</div>
          <div className="lbl">Sem CPF</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.afastados}</div>
          <div className="lbl">Afastados</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.desligados}</div>
          <div className="lbl">Desligados</div>
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
          id="busca-colaborador"
          placeholder="Nome, CPF, matrícula ou função"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          id="situacao-colaborador"
          value={situacaoFiltro}
          onChange={(e) => setSituacaoFiltro(e.target.value)}
        >
          <option value="">Todas as situações</option>
          <option value="ativo">Ativos</option>
          <option value="afastado">Afastados</option>
          <option value="desligado">Desligados</option>
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={abrirNovo}>
          <Icone nome="mais" /> Novo colaborador
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="section-title">
            {carregando ? 'Carregando…' : `${filtrados.length} pessoa${filtrados.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="table-scroll">
          <table className="tabela-colab">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Matrícula</th>
                <th>Função</th>
                <th>Local</th>
                {interno && <th>Empresa</th>}
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {!carregando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={interno ? 8 : 7} className="empty-state">
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              )}
              {filtrados.map((c) => {
                const fora = estaDesligado(c)
                return (
                  <tr key={c.id} className={fora ? 'inativo' : ''}>
                    <td className="nome">{c.nome}</td>
                    <td className="mono">{formatarCpf(c.cpf) || '—'}</td>
                    <td className="mono">{c.matricula || '—'}</td>
                    <td>{c.funcao || '—'}</td>
                    <td>{c.local_trabalho || '—'}</td>
                    {interno && <td>{nomeEmpresa(c.empresas)}</td>}
                    <td>
                      {fora ? (
                        <span className="pill flat">Desligado</span>
                      ) : c.situacao === 'afastado' ? (
                        <span className="pill warn">Afastado</span>
                      ) : (
                        <span className="pill good">Ativo</span>
                      )}
                    </td>
                    <td className="acoes">
                      <button type="button" className="btn btn-sm" onClick={() => abrirEdicao(c)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {painelAberto && (
        <div className="cortina" role="dialog" aria-modal="true" aria-label="Colaborador">
          <form className="painel-lateral" onSubmit={salvar}>
            <div className="painel-head">
              <h2>{form.id ? 'Editar colaborador' : 'Novo colaborador'}</h2>
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
                  <label htmlFor="colab-empresa">Empresa</label>
                  <select
                    id="colab-empresa"
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
                <label htmlFor="colab-nome">Nome completo</label>
                <input
                  id="colab-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="colab-cpf">CPF</label>
                  <input
                    id="colab-cpf"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    onBlur={(e) => setForm({ ...form, cpf: formatarCpf(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="colab-matricula">Matrícula</label>
                  <input
                    id="colab-matricula"
                    value={form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="colab-funcao">Função</label>
                  <input
                    id="colab-funcao"
                    placeholder="Pedreiro, auxiliar de produção…"
                    value={form.funcao}
                    onChange={(e) => setForm({ ...form, funcao: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="colab-local">Local de trabalho</label>
                  <input
                    id="colab-local"
                    placeholder="Obra, setor ou frente"
                    value={form.local_trabalho}
                    onChange={(e) => setForm({ ...form, local_trabalho: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="colab-admissao">Admissão</label>
                  <input
                    id="colab-admissao"
                    type="date"
                    value={form.admissao}
                    onChange={(e) => setForm({ ...form, admissao: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="colab-situacao">Situação</label>
                  <select
                    id="colab-situacao"
                    value={form.situacao}
                    onChange={(e) => setForm({ ...form, situacao: e.target.value as 'ativo' | 'afastado' })}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="afastado">Afastado</option>
                  </select>
                </div>
              </div>

              <p className="dica">
                Para registrar quem saiu da empresa, use “Desligar” em Certificados. O desligamento
                vale para o portal inteiro e aparece aqui automaticamente.
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="colab-email">E-mail</label>
                  <input
                    id="colab-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="colab-telefone">Telefone</label>
                  <input
                    id="colab-telefone"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="colab-obs">Observações</label>
                <textarea
                  id="colab-obs"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
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
