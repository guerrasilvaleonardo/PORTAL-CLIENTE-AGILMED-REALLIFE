'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import Icone from '@/components/Icone'
import '../colaboradores/colaboradores.css'
import './epi.css'

/*
 * EPI — cadastro dos equipamentos (supabase/epis.sql).
 *
 * Primeira tela do módulo. Aqui ficam os equipamentos com CA, validade
 * do CA e vida útil; na entrega, escolher o equipamento já traz o CA e
 * calcula a data da próxima troca, em vez de alguém digitar o número na
 * pressa do almoxarifado.
 *
 * Controle de estoque e kit por função ficam para depois, de propósito.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
/* O MTE dá prazo de validade ao CA; 60 dias é tempo de providenciar a troca. */
const DIAS_AVISO_CA = 60

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Epi = {
  id: string
  empresa_id: string
  nome: string
  tipo: 'epi' | 'outros'
  ca: string | null
  validade_ca: string | null
  vida_util_dias: number
  complemento: string | null
  fabricante: string | null
  codigo_externo: string | null
  observacoes: string | null
  ativo: boolean
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
}

const formVazio = {
  id: '',
  empresa_id: '',
  nome: '',
  tipo: 'epi' as 'epi' | 'outros',
  ca: '',
  validade_ca: '',
  vida_util_dias: '90',
  complemento: '',
  fabricante: '',
  codigo_externo: '',
  observacoes: '',
  ativo: true,
}

const nomeEmpresa = (e: { nome_fantasia: string | null; razao_social: string } | null | undefined) =>
  e ? e.nome_fantasia || e.razao_social : ''

const dataBr = (iso: string | null) =>
  iso ? iso.split('-').reverse().join('/') : ''

/* Dias entre hoje e a data, pelo horário de Brasília. */
function diasAte(iso: string | null): number | null {
  if (!iso) return null
  const hoje = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) + 'T12:00:00')
  const alvo = new Date(iso + 'T12:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

/* Vida útil em dias, escrita como as pessoas falam. */
function prazoTexto(dias: number): string {
  if (dias % 365 === 0 && dias >= 365) {
    const anos = dias / 365
    return `${anos} ano${anos > 1 ? 's' : ''}`
  }
  if (dias % 30 === 0 && dias >= 30) {
    const meses = dias / 30
    return `${meses} ${meses > 1 ? 'meses' : 'mês'}`
  }
  return `${dias} dias`
}

export default function PainelEpi() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [lista, setLista] = useState<Epi[]>([])

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
        .from('epis')
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
        ((data || []) as any[]).map((e) => ({
          ...e,
          empresas: Array.isArray(e.empresas) ? e.empresas[0] : e.empresas,
        })) as Epi[]
      )
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os equipamentos.')
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
    return lista.filter((e) => {
      if (empresaFiltro && e.empresa_id !== empresaFiltro) return false
      if (!mostrarInativos && !e.ativo) return false
      if (!palavras.length) return true
      const alvo = [e.nome, e.complemento, e.ca, e.fabricante, e.codigo_externo].filter(Boolean).join(' ')
      return casaBusca(alvo, palavras)
    })
  }, [lista, busca, empresaFiltro, mostrarInativos])

  const numeros = useMemo(() => {
    const base = (empresaFiltro ? lista.filter((e) => e.empresa_id === empresaFiltro) : lista).filter((e) => e.ativo)
    const dias = base.map((e) => ({ e, d: diasAte(e.validade_ca) }))
    return {
      total: base.length,
      vencido: dias.filter((x) => x.d !== null && x.d < 0).length,
      aVencer: dias.filter((x) => x.d !== null && x.d >= 0 && x.d <= DIAS_AVISO_CA).length,
      semCa: base.filter((e) => e.tipo === 'epi' && !e.ca).length,
    }
  }, [lista, empresaFiltro])

  function abrirNovo() {
    setForm({ ...formVazio, empresa_id: interno ? empresaFiltro : minhaEmpresa })
    setAviso('')
    setPainelAberto(true)
  }

  function abrirEdicao(e: Epi) {
    setForm({
      id: e.id,
      empresa_id: e.empresa_id,
      nome: e.nome,
      tipo: e.tipo,
      ca: e.ca || '',
      validade_ca: e.validade_ca || '',
      vida_util_dias: String(e.vida_util_dias),
      complemento: e.complemento || '',
      fabricante: e.fabricante || '',
      codigo_externo: e.codigo_externo || '',
      observacoes: e.observacoes || '',
      ativo: e.ativo,
    })
    setAviso('')
    setPainelAberto(true)
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    setAviso('')

    const nome = form.nome.trim()
    if (!nome) {
      setAviso('Informe o nome do equipamento.')
      return
    }
    const empresaId = interno ? form.empresa_id : minhaEmpresa
    if (!empresaId) {
      setAviso('Escolha a empresa.')
      return
    }
    const vida = Number(form.vida_util_dias)
    if (!Number.isFinite(vida) || vida < 1 || vida > 3650) {
      setAviso('A vida útil deve ficar entre 1 dia e 10 anos.')
      return
    }
    const ca = form.ca.replace(/\D/g, '')
    if (form.tipo === 'epi' && !ca) {
      setAviso('EPI sem CA não pode ser entregue. Informe o número do CA ou mude o tipo para "Outros".')
      return
    }

    try {
      setSalvando(true)
      const dados = {
        empresa_id: empresaId,
        nome,
        tipo: form.tipo,
        ca: ca || null,
        validade_ca: form.validade_ca || null,
        vida_util_dias: vida,
        complemento: form.complemento.trim() || null,
        fabricante: form.fabricante.trim() || null,
        codigo_externo: form.codigo_externo.trim() || null,
        observacoes: form.observacoes.trim() || null,
        ativo: form.ativo,
      }

      const { error } = form.id
        ? await supabase.from('epis').update(dados).eq('id', form.id)
        : await supabase.from('epis').insert(dados)

      if (error) {
        if (error.code === '23505') {
          setAviso('Este equipamento já está cadastrado nesta empresa, com o mesmo complemento e CA.')
          return
        }
        throw error
      }

      setPainelAberto(false)
      await carregar()
    } catch (e: any) {
      console.error(e)
      setAviso(e?.message || 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  function seloCa(e: Epi) {
    if (e.tipo === 'outros') return <span className="pill flat">Sem CA</span>
    if (!e.ca) return <span className="pill bad">Falta o CA</span>
    const d = diasAte(e.validade_ca)
    if (d === null) return <span className="pill flat">Sem validade</span>
    if (d < 0) return <span className="pill bad">CA vencido</span>
    if (d <= DIAS_AVISO_CA) return <span className="pill warn">Vence em {d} d</span>
    return <span className="pill good">No prazo</span>
  }

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          O cadastro de EPIs ainda não foi criado no banco. Rode <code>supabase/epis.sql</code> no
          SQL Editor do Supabase.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">EPI</p>
        <h1 className="titulo-tela">Equipamentos</h1>
        <p className="subtitulo-tela">
          Os equipamentos que a sua empresa entrega, com CA, validade e prazo de troca. Na entrega,
          escolher o equipamento já traz o CA e calcula a próxima troca.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {numeros.vencido > 0 && (
        <div className="banner bad">
          {numeros.vencido} equipamento{numeros.vencido > 1 ? 's' : ''} com CA vencido. EPI com CA
          vencido não pode ser entregue.
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="num">{numeros.total}</div>
          <div className="lbl">Cadastrados</div>
        </div>
        <div className="stat bad">
          <div className="num">{numeros.vencido}</div>
          <div className="lbl">CA vencido</div>
        </div>
        <div className="stat warn">
          <div className="num">{numeros.aVencer}</div>
          <div className="lbl">CA vence em {DIAS_AVISO_CA} dias</div>
        </div>
        <div className="stat">
          <div className="num">{numeros.semCa}</div>
          <div className="lbl">Sem CA</div>
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
          id="busca-epi"
          placeholder="Nome, CA, fabricante ou código"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="caixa-marcar">
          <input
            type="checkbox"
            id="epi-inativos"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
          />
          Mostrar fora de linha
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={abrirNovo}>
          <Icone nome="mais" /> Novo equipamento
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="section-title">
            {carregando
              ? 'Carregando…'
              : `${filtrados.length} equipamento${filtrados.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="table-scroll">
          <table className="tabela-colab">
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>CA</th>
                <th>Validade do CA</th>
                <th>Troca a cada</th>
                <th>Fabricante</th>
                {interno && <th>Empresa</th>}
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {!carregando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={interno ? 8 : 7} className="empty-state">
                    Nenhum equipamento cadastrado ainda.
                  </td>
                </tr>
              )}
              {filtrados.map((e) => (
                <tr key={e.id} className={e.ativo ? '' : 'inativo'}>
                  <td className="nome">
                    {e.nome}
                    {e.complemento && <span className="complemento"> · {e.complemento}</span>}
                    {!e.ativo && <span className="pill flat"> Fora de linha</span>}
                  </td>
                  <td className="mono">{e.ca || '—'}</td>
                  <td className="mono">{dataBr(e.validade_ca) || '—'}</td>
                  <td>{prazoTexto(e.vida_util_dias)}</td>
                  <td>{e.fabricante || '—'}</td>
                  {interno && <td>{nomeEmpresa(e.empresas)}</td>}
                  <td>{seloCa(e)}</td>
                  <td className="acoes">
                    <button type="button" className="btn btn-sm" onClick={() => abrirEdicao(e)}>
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
        <div className="cortina" role="dialog" aria-modal="true" aria-label="Equipamento">
          <form className="painel-lateral" onSubmit={salvar}>
            <div className="painel-head">
              <h2>{form.id ? 'Editar equipamento' : 'Novo equipamento'}</h2>
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
                  <label htmlFor="epi-empresa">Empresa</label>
                  <select
                    id="epi-empresa"
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
                <label htmlFor="epi-nome">Nome do equipamento</label>
                <input
                  id="epi-nome"
                  placeholder="Luva de vaqueta, óculos de proteção…"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="epi-complemento">Tamanho ou cor</label>
                  <input
                    id="epi-complemento"
                    placeholder="P, M, G, 42…"
                    value={form.complemento}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-tipo">Tipo</label>
                  <select
                    id="epi-tipo"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as 'epi' | 'outros' })}
                  >
                    <option value="epi">EPI (tem CA)</option>
                    <option value="outros">Outros (fardamento, uniforme)</option>
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="epi-ca">Número do CA</label>
                  <input
                    id="epi-ca"
                    inputMode="numeric"
                    placeholder="41385"
                    value={form.ca}
                    onChange={(e) => setForm({ ...form, ca: e.target.value })}
                    disabled={form.tipo === 'outros'}
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-validade">Validade do CA</label>
                  <input
                    id="epi-validade"
                    type="date"
                    value={form.validade_ca}
                    onChange={(e) => setForm({ ...form, validade_ca: e.target.value })}
                    disabled={form.tipo === 'outros'}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="epi-vida">Trocar a cada (dias)</label>
                <input
                  id="epi-vida"
                  type="number"
                  min={1}
                  max={3650}
                  value={form.vida_util_dias}
                  onChange={(e) => setForm({ ...form, vida_util_dias: e.target.value })}
                />
                <p className="dica">
                  É o prazo que o portal usa para marcar a próxima troca na entrega. Vale a
                  recomendação do fabricante ou o que a sua empresa pratica.
                </p>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="epi-fabricante">Fabricante</label>
                  <input
                    id="epi-fabricante"
                    value={form.fabricante}
                    onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-codigo">Código interno</label>
                  <input
                    id="epi-codigo"
                    placeholder="Código do seu almoxarifado"
                    value={form.codigo_externo}
                    onChange={(e) => setForm({ ...form, codigo_externo: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="epi-obs">Observações</label>
                <textarea
                  id="epi-obs"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>

              {form.id && (
                <label className="caixa-marcar">
                  <input
                    type="checkbox"
                    id="epi-ativo"
                    checked={!form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: !e.target.checked })}
                  />
                  Fora de linha — não aparece mais para entregar
                </label>
              )}
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
