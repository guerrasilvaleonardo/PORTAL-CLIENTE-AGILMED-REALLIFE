'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Progresso as BarraProgressoUi } from '@/lib/graficos'
import {
  corDoProgresso,
  CURSOS,
  ETAPAS_MANUAIS,
  formatarDataHora,
  numeroDaNr,
  percentualManual,
  progressoDoCertificado,
  ROTULO_ETAPA_MANUAL,
  type EtapaManual,
  type OrigemProgresso,
  type Progresso,
} from '@/lib/treinamentos'

type Empresa = {
  id: string
  razao_social: string
  nome_fantasia: string | null
}

type Certificado = {
  id: string
  numero: number
  empresa_id: string
  colaborador: string
  funcao: string | null
  tipo: string
  emissao: string | null
  validade: string | null
  observacoes: string | null
  link_certificado: string | null
  email_colaborador: string | null
  curso: string | null
  created_at?: string | null
  progresso_origem?: OrigemProgresso | null
  progresso_etapa?: EtapaManual | null
  progresso_manual?: number | null
  progresso_manual_em?: string | null
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
}

const COLUNAS_CERT =
  'id, numero, empresa_id, colaborador, funcao, tipo, emissao, validade, observacoes, link_certificado, email_colaborador, curso, empresas(nome_fantasia, razao_social)'

/* Colunas criadas pela migracao certificados-progresso-manual.sql. */
const COLUNAS_PROGRESSO_MANUAL =
  ', created_at, progresso_origem, progresso_etapa, progresso_manual, progresso_manual_em'

const TIPOS = [
  'NR-35 — Trabalho em Altura',
  'NR-33 — Espaços Confinados',
  'NR-10 — Segurança em Instalações Elétricas',
  'NR-12 — Segurança em Máquinas e Equipamentos',
  'NR-20 — Inflamáveis e Combustíveis',
  'NR-18 — Construção Civil',
  'NR-06 — Uso de EPI',
  'Brigada de Incêndio',
  'CIPA — Capacitação',
  'Primeiros Socorros',
  'ASO — Atestado de Saúde Ocupacional',
  'Outro',
]

/*
 * Sugere o tipo a partir do curso ("NR 33 | ESPACOS CONFINADOS" ->
 * "NR-33 — ..."). So e usado quando o tipo ainda esta vazio: nunca
 * troca uma escolha ja feita.
 */
function tipoPeloCurso(curso: string) {
  const nr = numeroDaNr(curso)

  if (nr) {
    const prefixo = 'NR-' + nr.padStart(2, '0') + ' '

    return TIPOS.find((t) => t.startsWith(prefixo)) || ''
  }

  const texto = curso.toUpperCase()

  if (texto.includes('BRIGADA')) return 'Brigada de Incêndio'
  if (texto.includes('PRIMEIROS SOCORROS')) return 'Primeiros Socorros'
  if (texto.includes('CIPA')) return 'CIPA — Capacitação'

  return ''
}

const NOMES_MES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

const SEM_DATA = 'sem-data'

/*
 * Mes de referencia do certificado: o da emissao. Sem emissao, o mes
 * em que foi cadastrado no portal. Sem nenhum dos dois, "sem data".
 */
function mesDoCertificado(c: Certificado) {
  if (c.emissao) return c.emissao.slice(0, 7)

  if (c.created_at) {
    const d = new Date(c.created_at)

    if (!Number.isNaN(d.getTime())) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    }
  }

  return SEM_DATA
}

function rotuloMes(chave: string) {
  if (chave === SEM_DATA) return 'Sem data'

  const [a, m] = chave.split('-')

  return NOMES_MES[Number(m) - 1] + '/' + a.slice(2)
}

/* Chaves "AAAA-MM" dos ultimos N meses, do mais antigo ao atual. */
function ultimosMeses(n: number) {
  const hoje = new Date()
  const lista: string[] = []

  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    lista.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
  }

  return lista
}


const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const formVazio = {
  id: '',
  empresa_id: '',
  colaborador: '',
  email_colaborador: '',
  curso: '',
  funcao: '',
  tipo: '',
  emissao: '',
  validade: '',
  observacoes: '',
  link_certificado: '',
  progresso_origem: 'ead' as OrigemProgresso,
  progresso_etapa: 'agendado' as EtapaManual,
  progresso_manual: '',
}

/*
 * O link chega de varias formas. Guardamos sempre com http(s) na
 * frente para o navegador abrir em vez de tratar como caminho interno.
 */
function normalizarLink(texto: string) {
  const limpo = (texto || '').trim()

  if (!limpo) return null

  return /^https?:\/\//i.test(limpo) ? limpo : 'https://' + limpo
}

function diasAte(validade: string | null) {
  if (!validade) return null

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const alvo = new Date(validade + 'T00:00:00')

  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

function situacao(validade: string | null) {
  const d = diasAte(validade)

  if (d === null) return { texto: 'Sem validade', pill: 'pill flat' }
  if (d < 0) return { texto: 'Vencido há ' + Math.abs(d) + 'd', pill: 'pill bad' }
  if (d <= 30) return { texto: 'Vence em ' + d + 'd', pill: 'pill bad' }
  if (d <= 90) return { texto: 'Vence em ' + d + 'd', pill: 'pill warn' }

  return { texto: 'Válido', pill: 'pill good' }
}

function formatarData(valor: string | null) {
  if (!valor) return '—'

  const [a, m, d] = valor.split('-')

  return `${d}/${m}/${a}`
}

export default function CertificadosPage() {
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [progressos, setProgressos] = useState<Progresso[]>([])
  const [atualizandoEad, setAtualizandoEad] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [periodo, setPeriodo] = useState('12')

  /* false enquanto a migracao do progresso manual nao tiver rodado. */
  const [suportaManual, setSuportaManual] = useState(true)

  const [form, setForm] = useState(formVazio)
  const editando = form.id !== ''

  function alterar(campo: keyof typeof formVazio, valor: string) {
    /*
     * O curso e sempre gravado em MAIUSCULAS, mesmo quando digitado
     * a mao. O e-mail e sempre em minusculas, para casar com o EAD.
     */
    const tratado =
      campo === 'curso'
        ? valor.toUpperCase()
        : campo === 'email_colaborador'
          ? valor.toLowerCase().trim()
          : valor

    setForm((atual) => {
      const novo = { ...atual, [campo]: tratado }

      if (campo === 'curso' && !atual.tipo) {
        novo.tipo = tipoPeloCurso(tratado)
      }

      return novo
    })
  }

  function escolherOrigem(origem: OrigemProgresso) {
    setForm((atual) => ({
      ...atual,
      progresso_origem: origem,
      progresso_etapa: atual.progresso_etapa || 'agendado',
    }))
  }

  function escolherEtapa(etapa: EtapaManual) {
    setForm((atual) => ({
      ...atual,
      progresso_etapa: etapa,
      progresso_manual: etapa === 'concluido' ? '100' : atual.progresso_manual,
    }))
  }

  /* A mesma regra usada no relatorio de Treinamentos. */
  function progressoDe(c: Certificado) {
    return progressoDoCertificado(c, progressos)
  }

  async function atualizarEad() {
    if (atualizandoEad) return

    setErro('')
    setMensagem('')
    setAtualizandoEad(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const resposta = await fetch('/api/cron/treinamentos', {
        headers: { Authorization: 'Bearer ' + (session?.access_token || '') },
      })

      const corpo = await resposta.json()

      if (!resposta.ok || corpo?.sucesso === false) {
        setErro(corpo?.erro || 'Não foi possível ler a plataforma de ensino.')
        return
      }

      const semCadastro: string[] = corpo?.sem_cadastro_no_ead || []

      setMensagem(
        'Progresso atualizado: ' +
          (corpo?.registros ?? 0) +
          ' matrícula(s).' +
          (semCadastro.length
            ? ' Sem matrícula no EAD: ' + semCadastro.join(', ') + '.'
            : '')
      )

      await carregar()
    } catch (e: any) {
      console.error(e)
      setErro('Não foi possível falar com a plataforma de ensino.')
    } finally {
      setAtualizandoEad(false)
    }
  }

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
        const { data: empresasData } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')

        setEmpresas(empresasData || [])
      }

      /*
       * Tenta ler ja com o progresso manual. Se a migracao ainda nao
       * rodou (coluna inexistente, 42703), le do jeito antigo e esconde
       * a opcao de lancamento manual, em vez de quebrar a tela.
       */
      let { data, error } = await supabase
        .from('certificados')
        .select(COLUNAS_CERT + COLUNAS_PROGRESSO_MANUAL)
        .order('validade', { ascending: true, nullsFirst: false })

      if (error && error.code === '42703') {
        const antiga = await supabase
          .from('certificados')
          .select(COLUNAS_CERT)
          .order('validade', { ascending: true, nullsFirst: false })

        data = antiga.data as typeof data
        error = antiga.error
        setSuportaManual(false)
      } else {
        setSuportaManual(true)
      }

      if (error) throw error

      setCertificados(
        (data || []).map((item: any) => ({
          ...item,
          empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas,
        }))
      )

      const { data: progressoData } = await supabase
        .from('treinamentos_progresso')
        .select('email, curso, progresso, situacao, atualizado_em')

      setProgressos((progressoData || []) as Progresso[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os certificados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(event: FormEvent) {
    event.preventDefault()

    if (salvando) return

    setErro('')
    setMensagem('')

    if (!form.empresa_id) {
      setErro('Selecione a empresa.')
      return
    }

    if (!form.colaborador.trim()) {
      setErro('Informe o nome do colaborador.')
      return
    }

    if (!form.tipo) {
      setErro('Selecione o tipo de certificado.')
      return
    }

    const manual = suportaManual && form.progresso_origem === 'manual'
    const textoPct = String(form.progresso_manual).trim()
    const pct = textoPct === '' ? null : Number(textoPct)

    if (manual && pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      setErro('O progresso manual deve ficar entre 0 e 100%.')
      return
    }

    try {
      setSalvando(true)

      const registro = {
        empresa_id: form.empresa_id,
        colaborador: form.colaborador.trim(),
        email_colaborador: form.email_colaborador.trim().toLowerCase() || null,
        curso: form.curso.trim().toUpperCase() || null,
        funcao: form.funcao.trim() || null,
        tipo: form.tipo,
        emissao: form.emissao || null,
        validade: form.validade || null,
        observacoes: form.observacoes.trim() || null,
        link_certificado: normalizarLink(form.link_certificado),
        ...(suportaManual
          ? manual
            ? {
                progresso_origem: 'manual' as OrigemProgresso,
                progresso_etapa: form.progresso_etapa,
                progresso_manual: percentualManual(
                  form.progresso_etapa,
                  pct === null ? null : Math.round(pct)
                ),
              }
            : {
                progresso_origem: 'ead' as OrigemProgresso,
                progresso_etapa: null,
                progresso_manual: null,
              }
          : {}),
      }

      if (editando) {
        const { error } = await supabase
          .from('certificados')
          .update(registro)
          .eq('id', form.id)

        if (error) throw error

        setMensagem('Certificado atualizado.')
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { error } = await supabase
          .from('certificados')
          .insert({ ...registro, criado_por: user?.id || null })

        if (error) throw error

        setMensagem('Certificado registrado.')
      }

      setForm(formVazio)
      await carregar()
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível salvar o certificado.')
    } finally {
      setSalvando(false)
    }
  }

  function editar(c: Certificado) {
    setErro('')
    setMensagem('')
    setForm({
      id: c.id,
      empresa_id: c.empresa_id,
      colaborador: c.colaborador,
      email_colaborador: c.email_colaborador || '',
      curso: c.curso || '',
      funcao: c.funcao || '',
      tipo: c.tipo,
      emissao: c.emissao || '',
      validade: c.validade || '',
      observacoes: c.observacoes || '',
      link_certificado: c.link_certificado || '',
      progresso_origem: c.progresso_origem === 'manual' ? 'manual' : 'ead',
      progresso_etapa: c.progresso_etapa || 'agendado',
      progresso_manual:
        typeof c.progresso_manual === 'number' ? String(c.progresso_manual) : '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remover(c: Certificado) {
    setErro('')
    setMensagem('')

    const { error } = await supabase.from('certificados').delete().eq('id', c.id)

    if (error) {
      setErro('Não foi possível remover o certificado.')
      return
    }

    setMensagem(`Certificado de ${c.colaborador} removido.`)
    await carregar()
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return certificados.filter((c) => {
      if (filtroEmpresa && c.empresa_id !== filtroEmpresa) return false
      if (filtroTipo && c.tipo !== filtroTipo) return false
      if (filtroMes && mesDoCertificado(c) !== filtroMes) return false

      if (filtroOrigem) {
        const origem = c.progresso_origem === 'manual' ? 'manual' : 'ead'

        if (origem !== filtroOrigem) return false
      }

      if (filtroSituacao) {
        const d = diasAte(c.validade)

        if (filtroSituacao === 'vencidos' && !(d !== null && d < 0)) return false
        if (filtroSituacao === '30' && !(d !== null && d >= 0 && d <= 30)) return false
        if (filtroSituacao === '90' && !(d !== null && d >= 0 && d <= 90)) return false
        if (filtroSituacao === 'validos' && !(d !== null && d > 90)) return false
      }

      if (!termo) return true

      return [
        c.colaborador,
        c.email_colaborador,
        c.curso,
        c.funcao,
        c.tipo,
        c.empresas?.nome_fantasia,
        c.empresas?.razao_social,
      ]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
  }, [
    certificados,
    busca,
    filtroEmpresa,
    filtroTipo,
    filtroSituacao,
    filtroMes,
    filtroOrigem,
  ])

  /*
   * Painel tipo x mes. Respeita empresa e origem; tipo e mes NAO
   * entram, porque sao justamente o que o painel ajuda a escolher.
   */
  const painel = useMemo(() => {
    const base = certificados.filter((c) => {
      if (filtroEmpresa && c.empresa_id !== filtroEmpresa) return false

      if (filtroOrigem) {
        const origem = c.progresso_origem === 'manual' ? 'manual' : 'ead'

        if (origem !== filtroOrigem) return false
      }

      return true
    })

    const mesesComDado = [...new Set(base.map(mesDoCertificado))]
      .filter((m) => m !== SEM_DATA)
      .sort()

    let meses: string[]

    if (periodo === 'tudo') {
      meses = mesesComDado
    } else if (periodo === 'ano') {
      const ano = String(new Date().getFullYear())
      meses = ultimosMeses(new Date().getMonth() + 1).filter((m) =>
        m.startsWith(ano)
      )
    } else {
      meses = ultimosMeses(Number(periodo))
    }

    const semData = base.filter((c) => mesDoCertificado(c) === SEM_DATA)

    if (semData.length > 0 && periodo === 'tudo') meses = [...meses, SEM_DATA]

    const noPeriodo = base.filter((c) => meses.includes(mesDoCertificado(c)))

    const tipos = [...new Set(noPeriodo.map((c) => c.tipo))].sort(
      (a, b) => TIPOS.indexOf(a) - TIPOS.indexOf(b) || a.localeCompare(b)
    )

    const celula: Record<string, number> = {}
    const porTipo: Record<string, number> = {}
    const porMes: Record<string, number> = {}

    let concluidos = 0
    let presenciais = 0
    let semEmissao = 0

    for (const c of noPeriodo) {
      const m = mesDoCertificado(c)
      const chave = c.tipo + '|' + m

      celula[chave] = (celula[chave] || 0) + 1
      porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1
      porMes[m] = (porMes[m] || 0) + 1

      if ((progressoDoCertificado(c, progressos)?.progresso ?? 0) >= 100) {
        concluidos += 1
      }

      if (c.progresso_origem === 'manual') presenciais += 1
      if (!c.emissao) semEmissao += 1
    }

    const maior = Object.values(celula).reduce((a, b) => Math.max(a, b), 0)

    return {
      meses,
      tipos,
      celula,
      porTipo,
      porMes,
      maior,
      total: noPeriodo.length,
      concluidos,
      presenciais,
      semEmissao,
      semDataFora: periodo === 'tudo' ? 0 : semData.length,
    }
  }, [certificados, progressos, filtroEmpresa, filtroOrigem, periodo])

  function focarCelula(tipo: string, mes: string) {
    setFiltroTipo(tipo)
    setFiltroMes(mes === SEM_DATA ? SEM_DATA : mes)
    document
      .getElementById('lista-certificados')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* Meses que aparecem no filtro: os que tem certificado. */
  const mesesDoFiltro = useMemo(
    () =>
      [...new Set(certificados.map(mesDoCertificado))].sort().reverse(),
    [certificados]
  )

  const indicadores = useMemo(() => {
    let vencidos = 0
    let em30 = 0
    let em90 = 0
    let validos = 0

    for (const c of certificados) {
      const d = diasAte(c.validade)

      if (d === null) continue
      if (d < 0) vencidos += 1
      else if (d <= 30) em30 += 1
      else if (d <= 90) em90 += 1
      else validos += 1
    }

    return { vencidos, em30, em90, validos }
  }, [certificados])


  const grade = interno ? GRADE_CERT_INTERNO : GRADE_CERT_CLIENTE

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">
            {interno ? 'Todos os clientes' : 'Sua empresa'}
          </div>

          <h1 style={{ fontSize: 30, marginTop: 6 }}>Certificados</h1>

          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--ink-muted)',
              fontSize: 14,
            }}
          >
            Treinamentos e exames por colaborador, com o que vence primeiro
            no topo.
          </p>
        </div>

        <div className="topbar-spacer" />

        <Link href="/treinamentos" className="btn">
          Relatório de treinamentos
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {mensagem && <div className="banner good">{mensagem}</div>}

      <div className="stats">
        <div
          className={'stat' + (indicadores.vencidos > 0 ? ' bad' : '')}
        >
          <div className="num">
            {carregando ? '—' : indicadores.vencidos}
          </div>
          <div className="lbl">Vencidos</div>
        </div>

        <div className={'stat' + (indicadores.em30 > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : indicadores.em30}</div>
          <div className="lbl">Vencem em 30 dias</div>
        </div>

        <div className={'stat' + (indicadores.em90 > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : indicadores.em90}</div>
          <div className="lbl">Vencem em 90 dias</div>
        </div>

        <div className="stat good">
          <div className="num">
            {carregando ? '—' : indicadores.validos}
          </div>
          <div className="lbl">Em dia</div>
        </div>
      </div>

      {interno && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">
              {editando ? 'Editar certificado' : 'Novo certificado'}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={atualizarEad}
                disabled={atualizandoEad}
              >
                {atualizandoEad
                  ? 'Atualizando...'
                  : 'Atualizar progresso do EAD'}
              </button>

              {editando && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setForm(formVazio)
                    setErro('')
                    setMensagem('')
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </div>

          <form onSubmit={salvar} className="panel-body">
            <div className="field-row">
              <div className="field">
                <label>Empresa *</label>
                <select
                  value={form.empresa_id}
                  onChange={(e) => alterar('empresa_id', e.target.value)}
                >
                  <option value="">Selecione</option>

                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Colaborador *</label>
                <input
                  value={form.colaborador}
                  onChange={(e) => alterar('colaborador', e.target.value)}
                  placeholder="Nome de quem fez o treinamento"
                />
              </div>

              <div className="field">
                <label>Função</label>
                <input
                  value={form.funcao}
                  onChange={(e) => alterar('funcao', e.target.value)}
                  placeholder="Cargo na empresa"
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>E-mail do colaborador</label>
                <input
                  type="email"
                  value={form.email_colaborador}
                  onChange={(e) =>
                    alterar('email_colaborador', e.target.value)
                  }
                  placeholder="É por ele que buscamos o progresso no EAD"
                />
              </div>

              <div className="field">
                <label>Curso no EAD</label>
                <input
                  list="lista-cursos"
                  value={form.curso}
                  onChange={(e) => alterar('curso', e.target.value)}
                  placeholder="Escolha ou digite — grava em MAIÚSCULAS"
                />

                <datalist id="lista-cursos">
                  {CURSOS.map((curso) => (
                    <option key={curso} value={curso} />
                  ))}
                </datalist>
              </div>
            </div>

            {suportaManual ? (
              <div className="field-row">
                <div className="field">
                  <label>Origem do progresso *</label>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={
                        'btn btn-sm' +
                        (form.progresso_origem === 'ead' ? ' btn-primary' : '')
                      }
                      aria-pressed={form.progresso_origem === 'ead'}
                      onClick={() => escolherOrigem('ead')}
                    >
                      Plataforma (EAD)
                    </button>

                    <button
                      type="button"
                      className={
                        'btn btn-sm' +
                        (form.progresso_origem === 'manual' ? ' btn-primary' : '')
                      }
                      aria-pressed={form.progresso_origem === 'manual'}
                      onClick={() => escolherOrigem('manual')}
                    >
                      Presencial (manual)
                    </button>
                  </div>

                  <span style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                    {form.progresso_origem === 'ead'
                      ? 'Atualiza sozinho todo dia às 06h, pelo e-mail do colaborador no EAD.'
                      : 'A leitura do EAD não mexe neste certificado. Quem salvar fica registrado.'}
                  </span>
                </div>

                {form.progresso_origem === 'manual' && (
                  <>
                    <div className="field">
                      <label>Etapa</label>
                      <select
                        value={form.progresso_etapa}
                        onChange={(e) =>
                          escolherEtapa(e.target.value as EtapaManual)
                        }
                      >
                        {ETAPAS_MANUAIS.map((etapa) => (
                          <option key={etapa} value={etapa}>
                            {ROTULO_ETAPA_MANUAL[etapa]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Progresso (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={form.progresso_manual}
                        disabled={form.progresso_etapa === 'concluido'}
                        onChange={(e) =>
                          setForm((atual) => ({
                            ...atual,
                            progresso_manual: e.target.value,
                          }))
                        }
                        placeholder="Opcional — 0 a 100"
                      />

                      {form.progresso_etapa === 'concluido' && !form.emissao && (
                        <span style={{ fontSize: 11.5, color: 'var(--amber)' }}>
                          Concluído sem data de emissão: no painel, entra no
                          mês de cadastro.
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-muted)',
                  padding: '4px 0',
                }}
              >
                Lançamento manual (presencial) indisponível: falta rodar a
                migração do progresso no Supabase.
              </div>
            )}

            <div className="field-row">
              <div className="field">
                <label>Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => alterar('tipo', e.target.value)}
                >
                  <option value="">Selecione</option>

                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Emissão</label>
                <input
                  type="date"
                  value={form.emissao}
                  onChange={(e) => alterar('emissao', e.target.value)}
                />
              </div>

              <div className="field">
                <label>Validade</label>
                <input
                  type="date"
                  value={form.validade}
                  onChange={(e) => alterar('validade', e.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Observações</label>
                <input
                  value={form.observacoes}
                  onChange={(e) => alterar('observacoes', e.target.value)}
                  placeholder="Anotação livre"
                />
              </div>

              <div className="field">
                <label>Link do certificado</label>
                <input
                  value={form.link_certificado}
                  onChange={(e) =>
                    alterar('link_certificado', e.target.value)
                  }
                  placeholder="Endereço do arquivo, se houver"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={salvando}
              >
                {salvando
                  ? 'Salvando...'
                  : editando
                    ? 'Salvar alterações'
                    : 'Registrar certificado'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Painel por tipo e mês</div>

          <div className="filters">
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="6">Últimos 6 meses</option>
              <option value="12">Últimos 12 meses</option>
              <option value="ano">Ano atual</option>
              <option value="tudo">Todo o período</option>
            </select>
          </div>
        </div>

        <div className="panel-body">
          <div className="stats" style={{ marginBottom: 14 }}>
            <div className="stat">
              <div className="num">{carregando ? '—' : painel.total}</div>
              <div className="lbl">Lançados no período</div>
            </div>

            <div className="stat good">
              <div className="num">{carregando ? '—' : painel.concluidos}</div>
              <div className="lbl">Com progresso 100%</div>
            </div>

            <div className="stat">
              <div className="num">{carregando ? '—' : painel.presenciais}</div>
              <div className="lbl">Presenciais (manual)</div>
            </div>

            <div className={'stat' + (painel.semEmissao > 0 ? ' warn' : '')}>
              <div className="num">{carregando ? '—' : painel.semEmissao}</div>
              <div className="lbl">Sem data de emissão</div>
            </div>
          </div>

          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : painel.total === 0 ? (
            <div className="empty-state">Nenhum certificado no período.</div>
          ) : (
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="matriz">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      {painel.meses.map((m) => (
                        <th key={m}>{rotuloMes(m)}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {painel.tipos.map((t) => (
                      <tr key={t}>
                        <th scope="row">{t}</th>

                        {painel.meses.map((m) => {
                          const n = painel.celula[t + '|' + m] || 0
                          const forca = painel.maior ? n / painel.maior : 0

                          return (
                            <td key={m}>
                              {n > 0 ? (
                                <button
                                  type="button"
                                  className="matriz-cel"
                                  title={`${t} · ${rotuloMes(m)}: ${n} — ver na lista`}
                                  onClick={() => focarCelula(t, m)}
                                  style={{
                                    background: `color-mix(in srgb, var(--primary) ${Math.round(12 + forca * 70)}%, var(--surface))`,
                                    color: forca > 0.5 ? '#fff' : 'var(--ink)',
                                  }}
                                >
                                  {n}
                                </button>
                              ) : (
                                <span className="matriz-zero">·</span>
                              )}
                            </td>
                          )
                        })}

                        <td className="matriz-total">{painel.porTipo[t] || 0}</td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr>
                      <th scope="row">Total</th>
                      {painel.meses.map((m) => (
                        <td key={m} className="matriz-total">
                          {painel.porMes[m] || 0}
                        </td>
                      ))}
                      <td className="matriz-total">{painel.total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <p className="footnote" style={{ marginTop: 10 }}>
            Mês pela data de emissão; sem emissão, pelo mês de cadastro.
            Clique num número para ver esses certificados na lista.
            {painel.semDataFora > 0 &&
              ` ${painel.semDataFora} certificado(s) sem nenhuma data aparecem só em "Todo o período".`}
          </p>
        </div>
      </div>

      <div className="panel" id="lista-certificados">
        <div className="panel-head">
          <div className="section-title">Certificados</div>

          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            {filtrados.length} de {certificados.length}
          </span>
        </div>

        <div className="panel-body">
          <div className="filters">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar colaborador, função ou curso"
            />

            {interno && (
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
              >
                <option value="">Todas as empresas</option>

                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos os tipos</option>

              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
            >
              <option value="">Todas as situações</option>
              <option value="vencidos">Vencidos</option>
              <option value="30">Vencem em 30 dias</option>
              <option value="90">Vencem em 90 dias</option>
              <option value="validos">Em dia</option>
            </select>

            {suportaManual && (
              <select
                value={filtroOrigem}
                onChange={(e) => setFiltroOrigem(e.target.value)}
              >
                <option value="">Todas as origens</option>
                <option value="ead">Plataforma (EAD)</option>
                <option value="manual">Presencial (manual)</option>
              </select>
            )}

            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
            >
              <option value="">Todos os meses</option>

              {mesesDoFiltro.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </select>

            {(filtroTipo || filtroMes || filtroOrigem || filtroSituacao || busca) && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setBusca('')
                  setFiltroTipo('')
                  setFiltroMes('')
                  setFiltroOrigem('')
                  setFiltroSituacao('')
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div className="table-wrap">
            <div className="table-scroll">
              <div
                className="trow thead"
                style={{ gridTemplateColumns: grade }}
              >
                <span>Colaborador</span>
                {interno && <span>Empresa</span>}
                <span>Tipo</span>
                <span>Curso no EAD</span>
                <span>Progresso</span>
                <span>Validade</span>
                <span>Situação</span>
                {interno && <span />}
              </div>

              {carregando ? (
                <div className="empty-state">Carregando...</div>
              ) : filtrados.length === 0 ? (
                <div className="empty-state">
                  {certificados.length === 0
                    ? 'Nenhum certificado cadastrado ainda.'
                    : 'Nenhum certificado com esses filtros.'}
                </div>
              ) : (
                filtrados.map((c) => {
                  const s = situacao(c.validade)
                  const registro = progressoDe(c)

                  return (
                    <div
                      key={c.id}
                      className="trow"
                      style={{ gridTemplateColumns: grade }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span className="tname">{c.colaborador}</span>

                        {c.funcao && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11.5,
                              color: 'var(--ink-muted)',
                            }}
                          >
                            {c.funcao}
                          </span>
                        )}

                        {c.email_colaborador && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11.5,
                              color: 'var(--ink-faint)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.email_colaborador}
                          </span>
                        )}

                        {c.link_certificado && (
                          <a
                            href={c.link_certificado}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-block',
                              marginTop: 3,
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: 'var(--primary)',
                            }}
                          >
                            Abrir certificado
                          </a>
                        )}
                      </span>

                      {interno && (
                        <span className="tmuted" style={{ minWidth: 0 }}>
                          {c.empresas?.nome_fantasia ||
                            c.empresas?.razao_social ||
                            '—'}
                        </span>
                      )}

                      <span className="tmuted" style={{ minWidth: 0 }}>
                        {c.tipo}
                      </span>

                      <span style={{ minWidth: 0 }}>
                        {c.curso ? (
                          <span style={{ display: 'block' }}>{c.curso}</span>
                        ) : (
                          <span style={{ color: 'var(--ink-faint)' }}>—</span>
                        )}

                        {registro && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11,
                              color: 'var(--ink-faint)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: registro.origem === 'manual' ? 'normal' : 'nowrap',
                            }}
                          >
                            {registro.origem === 'manual'
                              ? 'Presencial · ' +
                                registro.situacao +
                                (registro.atualizado_em
                                  ? ' · ' + formatarDataHora(registro.atualizado_em)
                                  : '')
                              : formatarDataHora(registro.atualizado_em)}
                          </span>
                        )}
                      </span>

                      <span>
                        {registro ? (
                          <BarraProgressoUi
                            valor={registro.progresso}
                            cor={corDoProgresso(registro.progresso)}
                            largura={70}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--ink-faint)',
                            }}
                          >
                            sem dados
                          </span>
                        )}
                      </span>

                      <span className="tmuted">
                        {formatarData(c.validade)}
                      </span>

                      <span>
                        <span className={s.pill}>{s.texto}</span>
                      </span>

                      {interno && (
                        <span className="trow-actions">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => editar(c)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => remover(c)}
                            style={{
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            Remover
                          </button>
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/*
 * O cliente nao ve a coluna de empresa nem os botoes de acao, entao
 * a grade precisa ter exatamente as colunas que foram renderizadas —
 * senao a tabela desalinha do cabecalho.
 */
const GRADE_CERT_INTERNO =
  'minmax(180px,1.4fr) minmax(120px,1fr) minmax(140px,1.1fr) minmax(130px,1.1fr) 130px 100px 120px 150px'

const GRADE_CERT_CLIENTE =
  'minmax(180px,1.4fr) minmax(140px,1.1fr) minmax(130px,1.1fr) 130px 100px 120px'
