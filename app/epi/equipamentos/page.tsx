'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import ImportarPlanilha from './ImportarPlanilha'
import Icone from '@/components/Icone'
import '../../colaboradores/colaboradores.css'
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
  estoque: number
  estoque_minimo: number
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
  estoque: '0',
  estoque_minimo: '0',
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
  /* Os filtros de estoque da tela dele. */
  const [filtroEstoque, setFiltroEstoque] = useState<'todos' | 'com' | 'zerado'>('todos')
  /* Marcação da empresa: impedir entrega quando a prateleira zerou. */
  const [bloquear, setBloquear] = useState(false)
  const [salvandoLinha, setSalvandoLinha] = useState('')
  const [buscandoCa, setBuscandoCa] = useState(false)
  const [achadoCa, setAchadoCa] = useState('')
  /* Se o que foi achado é um aviso e não uma boa notícia. Muda só a cor:
   * um alerta em cinza miúdo é um alerta que ninguém lê. */
  const [caComAviso, setCaComAviso] = useState(false)

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

      /* A marcação de bloqueio é da empresa, não do equipamento. */
      const alvo = ehInterno ? empresaFiltro || null : perfil?.empresa_id || null
      if (alvo) {
        const { data: emp } = await supabase
          .from('empresas')
          .select('epi_bloquear_sem_estoque')
          .eq('id', alvo)
          .maybeSingle()
        setBloquear(Boolean(emp?.epi_bloquear_sem_estoque))
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
      if (filtroEstoque === 'com' && e.estoque <= 0) return false
      if (filtroEstoque === 'zerado' && e.estoque > 0) return false
      if (!palavras.length) return true
      const alvo = [e.nome, e.complemento, e.ca, e.fabricante, e.codigo_externo].filter(Boolean).join(' ')
      return casaBusca(alvo, palavras)
    })
  }, [lista, busca, empresaFiltro, mostrarInativos, filtroEstoque])

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

  /* Edição na linha, como na tela dele: o número que muda toda semana
   * — estoque, mínimo, vida útil — não merece abrir um painel. Grava ao
   * sair do campo, e só quando mudou de verdade. */
  async function salvarCampo(e: Epi, campo: string, bruto: string | boolean) {
    const valor =
      typeof bruto === 'boolean'
        ? bruto
        : campo === 'complemento' || campo === 'codigo_externo'
          ? bruto.trim() || null
          : Math.trunc(Number(bruto))

    if (typeof valor === 'number' && !Number.isFinite(valor)) return
    if ((e as unknown as Record<string, unknown>)[campo] === valor) return

    try {
      setSalvandoLinha(e.id)
      const { error } = await supabase.from('epis').update({ [campo]: valor }).eq('id', e.id)
      if (error) throw error
      setLista((atual) =>
        atual.map((x) => (x.id === e.id ? ({ ...x, [campo]: valor } as Epi) : x))
      )
    } catch (err: any) {
      console.error(err)
      setErro(err?.message || 'Não foi possível salvar.')
    } finally {
      setSalvandoLinha('')
    }
  }

  async function alternarBloqueio(ligado: boolean) {
    const alvo = interno ? empresaFiltro : minhaEmpresa
    if (!alvo) {
      setErro('Escolha a empresa antes de mudar essa marcação.')
      return
    }
    setBloquear(ligado)
    const { error } = await supabase
      .from('empresas')
      .update({ epi_bloquear_sem_estoque: ligado })
      .eq('id', alvo)
    if (error) {
      console.error(error)
      setErro('Não foi possível salvar a marcação.')
      setBloquear(!ligado)
    }
  }

  /* Busca o número na cópia da base do MTE e preenche o cadastro.
   * O que a pessoa já escreveu não é sobrescrito — menos a validade e
   * a descrição, que vêm do certificado e valem mais que o palpite de
   * quem digitou. */
  async function buscarCa() {
    const numero = form.ca.replace(/\D/g, '')
    if (!numero) return
    setBuscandoCa(true)
    setAchadoCa('')
    setCaComAviso(false)
    try {
      const { data, error } = await supabase
        .from('caepi')
        .select('ca, validade, situacao, razao_social, nome_equipamento, descricao')
        .eq('ca', numero)
        .maybeSingle()

      if (error) {
        /* Base ainda não importada: a tela segue servindo para digitar
           à mão, que é como era antes. */
        setCaComAviso(true)
        setAchadoCa('A base de CAs ainda não foi importada neste portal. Preencha à mão.')
        return
      }
      if (!data) {
        setCaComAviso(true)
        setAchadoCa(`O CA ${numero} não está na base do MTE. Confira o número ou preencha à mão.`)
        return
      }

      setForm((atual) => ({
        ...atual,
        ca: numero,
        nome: atual.nome.trim() || data.nome_equipamento || '',
        fabricante: atual.fabricante.trim() || data.razao_social || '',
        validade_ca: data.validade || atual.validade_ca,
        observacoes: data.descricao || atual.observacoes,
      }))
      /* Duas coisas diferentes podem estar erradas, e uma não implica a
       * outra: o CA 43377 está VÁLIDO na base do MTE e mesmo assim tem
       * validade de 29/08/2024, já vencida. Por isso os dois avisos são
       * checados separadamente. Datas comparadas como texto aaaa-mm-dd,
       * que ordena certo e não passa pelo fuso. */
      const hoje = new Date()
      const hojeTexto = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

      const avisos: string[] = []
      if (data.situacao && data.situacao.toUpperCase() !== 'VÁLIDO') {
        avisos.push(`na base do MTE este CA está ${data.situacao.toLowerCase()}`)
      }
      if (data.validade && data.validade < hojeTexto) {
        const [a, m, d] = data.validade.split('-')
        avisos.push(`o CA venceu em ${d}/${m}/${a}`)
      }

      setCaComAviso(avisos.length > 0)
      setAchadoCa(
        avisos.length
          ? `Atenção: ${avisos.join('; ')}. Preenchi assim mesmo, confira antes de salvar.`
          : 'Preenchido com os dados do certificado.'
      )
    } finally {
      setBuscandoCa(false)
    }
  }

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
      estoque: String(e.estoque ?? 0),
      estoque_minimo: String(e.estoque_minimo ?? 0),
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
        estoque: Math.trunc(Number(form.estoque)) || 0,
        estoque_minimo: Math.max(0, Math.trunc(Number(form.estoque_minimo)) || 0),
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
        <h1 className="titulo-tela">Configuração de EPI's</h1>
        <p className="subtitulo-tela">
          Os equipamentos que a sua empresa entrega, com CA, validade, prazo de troca e estoque. Na
          entrega, escolher o equipamento já traz o CA e calcula a próxima troca.
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
        <div className="field" style={{ minWidth: 150 }}>
          <label htmlFor="filtro-estoque">Estoque</label>
          <select
            id="filtro-estoque"
            value={filtroEstoque}
            onChange={(e) => setFiltroEstoque(e.target.value as 'todos' | 'com' | 'zerado')}
          >
            <option value="todos">Todos</option>
            <option value="com">Só com estoque</option>
            <option value="zerado">Só com estoque zerado</option>
          </select>
        </div>
        <span style={{ flex: 1 }} />
        {(interno ? empresaFiltro : minhaEmpresa) && (
          <ImportarPlanilha
            empresaId={interno ? empresaFiltro : minhaEmpresa}
            nomeEmpresa={
              empresas.find((e) => e.id === (interno ? empresaFiltro : minhaEmpresa))?.nome_fantasia ||
              empresas.find((e) => e.id === (interno ? empresaFiltro : minhaEmpresa))?.razao_social ||
              'esta empresa'
            }
            epis={lista}
            aoTerminar={carregar}
          />
        )}
        <button type="button" className="btn btn-primary" onClick={abrirNovo}>
          <Icone nome="mais" /> Novo equipamento
        </button>
      </div>

      {/* A marcação da empresa, no alto da tela, como na dele. */}
      <label className="caixa-marcar linha-bloqueio">
        <input
          type="checkbox"
          checked={bloquear}
          onChange={(e) => alternarBloqueio(e.target.checked)}
        />
        Bloquear entrega de EPI sem estoque
        <small>
          Com isto ligado, a entrega é recusada quando a prateleira não tem a quantidade pedida.
          Desligado, a entrega passa e o estoque fica negativo — a ficha vale mais que o número.
        </small>
      </label>

      <div className="panel">
        <div className="panel-head">
          <span className="section-title">
            {carregando
              ? 'Carregando…'
              : `${filtrados.length} equipamento${filtrados.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="table-scroll">
          <table className="tabela-colab tabela-epis">
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>Complemento</th>
                <th>Vida útil (dias)</th>
                <th>Estoque</th>
                <th>Estoque mínimo</th>
                <th>Código externo</th>
                <th>É EPI</th>
                {interno && <th>Empresa</th>}
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {!carregando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={interno ? 9 : 8} className="empty-state">
                    Nenhum equipamento cadastrado ainda.
                  </td>
                </tr>
              )}
              {filtrados.map((e) => (
                <tr key={e.id} className={e.ativo ? '' : 'inativo'}>
                  {/* Nome, CA, validade e descrição no mesmo bloco, como
                      na ficha e na tela dele. */}
                  <td className="celula-epi">
                    <strong>
                      {e.ca ? `${e.ca} - ` : ''}
                      {e.nome.toUpperCase()}
                    </strong>
                    {e.validade_ca && (
                      <span className="epi-mini">
                        Validade do C.A.: {dataBr(e.validade_ca)} {seloCa(e)}
                      </span>
                    )}
                    {!e.ativo && <span className="pill flat">Fora de linha</span>}
                    {e.observacoes && <span className="epi-mini">{e.observacoes}</span>}
                  </td>
                  <td>
                    <input
                      className="campo-linha"
                      defaultValue={e.complemento || ''}
                      placeholder="Digite"
                      onBlur={(ev) => salvarCampo(e, 'complemento', ev.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="campo-linha numero"
                      type="number"
                      min={1}
                      max={3650}
                      defaultValue={e.vida_util_dias}
                      onBlur={(ev) => salvarCampo(e, 'vida_util_dias', ev.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className={`campo-linha numero ${e.estoque <= e.estoque_minimo ? 'baixo' : ''}`}
                      type="number"
                      defaultValue={e.estoque}
                      onBlur={(ev) => salvarCampo(e, 'estoque', ev.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="campo-linha numero"
                      type="number"
                      min={0}
                      defaultValue={e.estoque_minimo}
                      onBlur={(ev) => salvarCampo(e, 'estoque_minimo', ev.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="campo-linha"
                      defaultValue={e.codigo_externo || ''}
                      placeholder="Digite"
                      onBlur={(ev) => salvarCampo(e, 'codigo_externo', ev.target.value)}
                    />
                  </td>
                  <td className="centro">
                    <input
                      type="checkbox"
                      aria-label="Considerar como EPI"
                      checked={e.tipo === 'epi'}
                      onChange={(ev) =>
                        salvarCampo(e, 'tipo', ev.target.checked ? 'epi' : 'outros')
                      }
                    />
                  </td>
                  {interno && <td>{nomeEmpresa(e.empresas)}</td>}
                  <td className="acoes">
                    {salvandoLinha === e.id && <span className="epi-mini">salvando…</span>}
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
                  <div className="linha-ca">
                    <input
                      id="epi-ca"
                      inputMode="numeric"
                      placeholder="41385"
                      value={form.ca}
                      onChange={(e) => setForm({ ...form, ca: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          buscarCa()
                        }
                      }}
                      disabled={form.tipo === 'outros'}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={buscarCa}
                      disabled={buscandoCa || form.tipo === 'outros' || !form.ca.trim()}
                    >
                      {buscandoCa ? 'Buscando…' : 'Buscar no CAEPI'}
                    </button>
                  </div>
                  {achadoCa && <p className={caComAviso ? 'dica bad' : 'dica'}>{achadoCa}</p>}
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
                  <label htmlFor="epi-estoque">Estoque</label>
                  <input
                    id="epi-estoque"
                    type="number"
                    value={form.estoque}
                    onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-estoque-min">Estoque mínimo</label>
                  <input
                    id="epi-estoque-min"
                    type="number"
                    min={0}
                    value={form.estoque_minimo}
                    onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
                  />
                </div>
              </div>
              <p className="dica">
                Cada entrega desconta do estoque; a entrega cancelada devolve. Devolução não volta
                para a prateleira — a bota que voltou do pé de alguém não é bota nova. Quando o
                estoque chega ao mínimo, o número fica vermelho na lista.
              </p>

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
