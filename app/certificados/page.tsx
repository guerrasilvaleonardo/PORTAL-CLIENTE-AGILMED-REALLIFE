'use client'

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react'
import { casaBusca, normalizar, palavrasDaBusca } from '@/lib/busca'
import './certificados.css'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Progresso as BarraProgressoUi } from '@/lib/graficos'
import {
  lerProgressos,
  aguardandoCertificado,
  corDoProgresso,
  CURSOS,
  etapaDoProgresso,
  ETAPAS_MANUAIS,
  formatarDataHora,
  formatarDuracao,
  numeroDaNr,
  percentualManual,
  progressosDosCertificados,
  ROTULO_ETAPA_MANUAL,
  textoTempoPorDia,
  type EtapaManual,
  type OrigemProgresso,
  type Progresso,
} from '@/lib/treinamentos'
import { ComModulo } from '@/components/ModuloBloqueado'
import TempoEad from '@/components/TempoEad'
import { lerTudo } from '@/lib/lerTudo'
import { chaveCertificado, chavePessoa, formatarCpf, pessoasPorCpf, soDigitosCpf, substitutosHistorico } from '@/lib/historicoCertificados'
import {
  carregarDesligados,
  chaveNomeColaborador,
  desligamentoDe,
  type ColaboradorDesligado,
  type MapaDesligados,
} from '@/lib/colaboradoresDesligados'

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
  /* true = o certificado não vence (validade indeterminada). */
  sem_vencimento?: boolean | null
  /* CPF do colaborador, só dígitos (supabase/certificados-cpf.sql). */
  cpf?: string | null
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
}

const COLUNAS_CERT =
  'id, numero, empresa_id, colaborador, funcao, tipo, emissao, validade, observacoes, link_certificado, email_colaborador, curso, empresas(nome_fantasia, razao_social)'

/* Colunas criadas pela migracao certificados-progresso-manual.sql. */
const COLUNAS_PROGRESSO_MANUAL =
  ', created_at, progresso_origem, progresso_etapa, progresso_manual, progresso_manual_em'

/* Coluna criada por certificados-sem-vencimento.sql. */
const COLUNA_SEM_VENCIMENTO = ', sem_vencimento'

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
  cpf: '',
  progresso_origem: 'ead' as OrigemProgresso,
  progresso_etapa: 'agendado' as EtapaManual,
  progresso_manual: '',
  sem_vencimento: false,
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

/*
 * Situação da validade. As faixas não se sobrepõem: todo certificado cai
 * em exatamente uma (vencido, até 90 dias, em dia, sem vencimento ou
 * sem validade informada). "Sem vencimento" só quando o cadastro diz que
 * o certificado não vence; data em branco sem essa marcação é "não
 * informada".
 *
 * "historico" é a faixa do certificado substituído por um mais novo do
 * mesmo curso e da mesma pessoa (lib/historicoCertificados.ts). Ele sai
 * de todas as outras faixas: não conta como vencido nem como a vencer.
 * faixaDe() não conhece o histórico; quem decide é faixaDo() na tela.
 *
 * "desligado" é a faixa do certificado de colaborador desligado
 * (lib/colaboradoresDesligados.ts). Vale acima de todas as outras,
 * inclusive do histórico. Por padrão esses certificados nem aparecem;
 * só entram na lista e nos cartões com "Mostrar desligados".
 */
type Faixa = 'vencido' | 'ate90' | 'emdia' | 'sem_vencimento' | 'sem_validade' | 'historico' | 'desligado'

function faixaDe(c: { validade: string | null; sem_vencimento?: boolean | null }): Faixa {
  const d = diasAte(c.validade)

  if (d === null) return c.sem_vencimento ? 'sem_vencimento' : 'sem_validade'
  if (d < 0) return 'vencido'
  if (d <= 90) return 'ate90'

  return 'emdia'
}

function situacao(c: { validade: string | null; sem_vencimento?: boolean | null }) {
  const d = diasAte(c.validade)
  const faixa = faixaDe(c)

  if (faixa === 'sem_vencimento') return { texto: 'Sem vencimento', pill: 'pill neutro', icone: '∞' }
  if (faixa === 'sem_validade') return { texto: 'Não informada', pill: 'pill flat', icone: '−' }
  if (faixa === 'vencido') {
    const n = Math.abs(d as number)
    return { texto: 'Vencido há ' + n + (n === 1 ? ' dia' : ' dias'), pill: 'pill bad', icone: '!' }
  }
  if (faixa === 'ate90') {
    return {
      texto: d === 0 ? 'Vence hoje' : 'Vence em ' + d + (d === 1 ? ' dia' : ' dias'),
      pill: (d as number) <= 30 ? 'pill bad' : 'pill warn',
      icone: '◷',
    }
  }

  return { texto: 'Válido', pill: 'pill good', icone: '✓' }
}

/* Situação do certificado substituído (histórico). */
function situacaoHistorico(substituto: { emissao: string | null } | null | undefined) {
  return {
    texto: 'Substituído' + (substituto?.emissao ? ' · renovado em ' + formatarData(substituto.emissao) : ''),
    pill: 'pill flat historico',
    icone: '↺',
  }
}

/* Situação do certificado de colaborador desligado. */
function situacaoDesligado(d: ColaboradorDesligado) {
  return {
    texto: 'Desligado em ' + formatarData(d.desligado_em),
    pill: 'pill flat desligado',
    icone: '⊘',
  }
}

/* Hoje no formato AAAA-MM-DD, pelo relógio de quem está na tela. */
function hojeIso() {
  const d = new Date()

  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/)

  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/* Cor estável do avatar pelo nome. */
const CORES_AVATAR = ['#DEEEEF', '#E3E8FB', '#EDE4F7', '#FBE5DC', '#E2F1E6', '#F6E9CF']

function corAvatar(nome: string) {
  let h = 0
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0

  return CORES_AVATAR[h % CORES_AVATAR.length]
}

/* CSV com ; (abre direto no Excel em português). */
function paraCsv(linhas: (string | number | null | undefined)[][]) {
  return linhas
    .map((l) =>
      l
        .map((v) => {
          const t = String(v ?? '')
          return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
        })
        .join(';')
    )
    .join('\r\n')
}

const POR_PAGINA = 25

function formatarData(valor: string | null) {
  if (!valor) return '—'

  const [a, m, d] = valor.split('-')

  return `${d}/${m}/${a}`
}

function CertificadosPageConteudo() {
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
  /* false enquanto certificados-sem-vencimento.sql nao tiver rodado. */
  const [suportaSemVencimento, setSuportaSemVencimento] = useState(true)
  /* Coluna cpf (supabase/certificados-cpf.sql). Sem ela, o campo some. */
  const [suportaCpf, setSuportaCpf] = useState(false)

  /* Organização da tela. */
  const [aba, setAba] = useState<'lista' | 'analise'>('lista')
  const [visao, setVisao] = useState<'certificado' | 'colaborador'>('certificado')
  const [pagina, setPagina] = useState(1)
  const [maisFiltros, setMaisFiltros] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  /* Linha com o histórico aberto logo abaixo (certificados anteriores). */
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null)
  /* Lançamento de renovação: id do certificado que vai para o histórico. */
  const [renovandoDe, setRenovandoDe] = useState<string | null>(null)

  const [form, setForm] = useState(formVazio)

  /*
   * Colaboradores desligados (supabase/colaboradores-desligados.sql).
   * suportaDesligados = a tabela existe; sem ela, botões escondidos e
   * ninguém é tratado como desligado.
   */
  const [desligados, setDesligados] = useState<MapaDesligados>(new Map())
  const [suportaDesligados, setSuportaDesligados] = useState(false)
  const [mostrarDesligados, setMostrarDesligados] = useState(false)
  const [desligar, setDesligar] = useState<{ empresa_id: string; nome: string; empresa: string } | null>(null)
  const [formDesligar, setFormDesligar] = useState({ data: '', motivo: '' })
  const [salvandoDesligar, setSalvandoDesligar] = useState(false)
  /* Reativação em dois cliques: guarda o id do desligamento a confirmar. */
  const [confirmarReativar, setConfirmarReativar] = useState<string | null>(null)

  const [sugerirPessoa, setSugerirPessoa] = useState(false)

  /*
   * Colaboradores já cadastrados na empresa escolhida no formulário.
   * Mesmo nome (sem acento/maiúsculas) e mesmo e-mail viram uma pessoa;
   * função e e-mail vêm do cadastro mais recente que os tem.
   */
  const pessoasDaEmpresa = useMemo(() => {
    if (!form.empresa_id) return []

    const mapa = new Map<string, { nome: string; funcao: string; email: string; cpf: string; cursos: number; recente: string }>()

    for (const c of certificados) {
      if (c.empresa_id !== form.empresa_id || !c.colaborador) continue

      /* Mesmo CPF = mesma pessoa, mesmo com o nome escrito diferente. */
      const cpf = soDigitosCpf(c.cpf)
      const chave = cpf
        ? 'CPF ' + cpf
        : normalizar(c.colaborador).replace(/\s+/g, ' ').trim() + '|' + (c.email_colaborador || '').toLowerCase().trim()
      const data = c.created_at || c.emissao || ''
      const atual = mapa.get(chave)

      if (!atual) {
        mapa.set(chave, { nome: c.colaborador, funcao: c.funcao || '', email: c.email_colaborador || '', cpf: cpf || '', cursos: 1, recente: data })
        continue
      }

      atual.cursos += 1
      if (!atual.email && c.email_colaborador) atual.email = c.email_colaborador
      if (data >= atual.recente) {
        atual.recente = data
        atual.nome = c.colaborador
        if (c.funcao) atual.funcao = c.funcao
      } else if (!atual.funcao && c.funcao) {
        atual.funcao = c.funcao
      }
    }

    return [...mapa.values()]
  }, [certificados, form.empresa_id])

  const sugestoesPessoa = useMemo(() => {
    const termo = form.colaborador.trim()
    if (termo.length < 2) return []

    const palavras = palavrasDaBusca(termo)

    return pessoasDaEmpresa
      .filter((p) => casaBusca(p.nome + ' ' + p.email + ' ' + p.funcao + ' ' + p.cpf, palavras))
      .filter((p) => !(p.nome === form.colaborador && p.email === form.email_colaborador))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 6)
  }, [pessoasDaEmpresa, form.colaborador, form.email_colaborador])

  function escolherPessoa(p: { nome: string; funcao: string; email: string; cpf: string }) {
    setForm((atual) => ({
      ...atual,
      cpf: p.cpf ? formatarCpf(p.cpf) : atual.cpf,
      colaborador: p.nome,
      funcao: p.funcao || atual.funcao,
      email_colaborador: p.email || atual.email_colaborador,
    }))
    setSugerirPessoa(false)
  }

  const editando = form.id !== ''

  function alterar(campo: Exclude<keyof typeof formVazio, 'sem_vencimento'>, valor: string) {
    /*
     * O curso e sempre gravado em MAIUSCULAS, mesmo quando digitado
     * a mao. O e-mail e sempre em minusculas, para casar com o EAD.
     */
    const tratado =
      campo === 'cpf'
        ? valor.replace(/[^\d.\-\s]/g, '').slice(0, 14)
        : campo === 'curso'
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

  /*
   * A mesma regra usada no relatorio de Treinamentos: cada matricula do
   * EAD vai para um unico certificado (curso repetido em anos
   * diferentes nao divide mais o mesmo percentual).
   */
  const progressoPorId = useMemo(() => {
    const mapa = new Map<string, Progresso | null>()

    progressosDosCertificados(certificados, progressos).forEach((p, c) => {
      mapa.set(c.id, p)
    })

    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificados, progressos])

  function progressoDe(c: Certificado): Progresso | null {
    return progressoPorId.get(c.id) ?? null
  }

  /*
   * Certificados substituídos por um mais novo do mesmo curso e da mesma
   * pessoa (lib/historicoCertificados.ts). Calculado sobre TODOS os
   * certificados carregados, antes de qualquer filtro, para o filtro da
   * tela não mudar o que é histórico.
   */
  const substitutos = useMemo(() => substitutosHistorico(certificados), [certificados])

  /*
   * Cadastro de cada certificado (mesma pessoa + mesmo curso), do mais
   * novo para o mais antigo. O mais novo é o atual; os anteriores são o
   * histórico, mostrado dentro do cadastro e não como linhas da lista.
   */
  /*
   * Colaborador de cada certificado: pelo CPF quando houver (nomes
   * diferentes da mesma pessoa viram um só), senão pelo nome.
   */
  const pessoaPorId = useMemo(() => pessoasPorCpf(certificados), [certificados])

  function pessoaDe(c: Pick<Certificado, 'id' | 'empresa_id' | 'colaborador'>) {
    return pessoaPorId.get(c.id) ?? chavePessoa(c)
  }

  const porCadastro = useMemo(() => {
    const mapa = new Map<string, Certificado[]>()

    for (const c of certificados) {
      const chave = chaveCertificado(c, pessoaDe(c))

      if (!chave) continue

      const g = mapa.get(chave)

      if (g) g.push(c)
      else mapa.set(chave, [c])
    }

    const data = (c: Certificado) => c.emissao || c.validade || ''

    for (const g of mapa.values()) {
      g.sort((a, b) => data(b).localeCompare(data(a)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
    }

    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificados, pessoaPorId])

  /* Certificados anteriores (histórico) do cadastro deste certificado. */
  function anterioresDe(c: Pick<Certificado, 'id' | 'empresa_id' | 'colaborador' | 'tipo' | 'curso'>) {
    const chave = chaveCertificado(c, pessoaDe(c))

    if (!chave) return []

    return (porCadastro.get(chave) || []).filter((o) => o.id !== c.id && substitutos.has(o.id))
  }

  function ehHistorico(c: Certificado) {
    return substitutos.has(c.id)
  }

  /*
   * Desligamento vale para o colaborador inteiro: marcado em qualquer
   * grafia do nome (mesmo CPF), vale para todos os certificados dele.
   */
  const desligadoPorPessoa = useMemo(() => {
    const mapa = new Map<string, ColaboradorDesligado>()

    if (!desligados.size) return mapa

    for (const c of certificados) {
      const d = desligamentoDe(desligados, c)
      const p = pessoaPorId.get(c.id)

      if (d && p && !mapa.has(p)) mapa.set(p, d)
    }

    return mapa
  }, [certificados, desligados, pessoaPorId])

  function desligamentoDo(c: Certificado) {
    const p = pessoaPorId.get(c.id)

    return desligamentoDe(desligados, c) || (p ? desligadoPorPessoa.get(p) ?? null : null)
  }

  /*
   * Faixa considerando desligamento e histórico: desligado vale acima de
   * tudo; substituído não é vencido nem a vencer.
   */
  function faixaDo(c: Certificado): Faixa {
    if (desligamentoDo(c)) return 'desligado'

    return ehHistorico(c) ? 'historico' : faixaDe(c)
  }

  /*
   * Concluiu 100% no EAD e o certificado ainda não foi atualizado
   * (lib/treinamentos.ts). Desligado e histórico ficam de fora.
   */
  function aguardaDo(c: Certificado) {
    if (desligamentoDo(c) || ehHistorico(c)) return false

    return aguardandoCertificado(c, progressoDe(c))
  }

  function situacaoDo(c: Certificado) {
    const d = desligamentoDo(c)

    if (d) return situacaoDesligado(d)

    return ehHistorico(c) ? situacaoHistorico(substitutos.get(c.id)) : situacao(c)
  }

  /*
   * Base de todas as contas da tela: sem os desligados, a não ser que
   * "Mostrar desligados" esteja marcado. O histórico (substitutos) é
   * calculado sobre todos os certificados, para não mudar com isso.
   */
  const qtdDesligados = useMemo(
    () => (desligados.size ? certificados.filter((c) => desligamentoDe(desligados, c)).length : 0),
    [certificados, desligados]
  )

  const visiveis = useMemo(
    () => (mostrarDesligados || !qtdDesligados ? certificados : certificados.filter((c) => !desligamentoDe(desligados, c))),
    [certificados, desligados, mostrarDesligados, qtdDesligados]
  )

  async function recarregarDesligados() {
    const r = await carregarDesligados(supabase)

    setDesligados(r.mapa)
    setSuportaDesligados(r.suportado)
  }

  function abrirDesligar(empresa_id: string, nome: string, empresa: string) {
    setErro('')
    setMensagem('')
    setMenuAberto(null)
    setConfirmarReativar(null)
    setFormDesligar({ data: hojeIso(), motivo: '' })
    setDesligar({ empresa_id, nome, empresa })
  }

  function fecharDesligar() {
    if (salvandoDesligar) return
    setDesligar(null)
  }

  async function confirmarDesligamento(event: FormEvent) {
    event.preventDefault()

    if (!desligar || salvandoDesligar) return

    if (!formDesligar.data) {
      setErro('Informe a data do desligamento.')
      return
    }

    try {
      setSalvandoDesligar(true)
      setErro('')

      const { error } = await supabase.from('colaboradores_desligados').insert({
        empresa_id: desligar.empresa_id,
        nome: desligar.nome.trim(),
        nome_chave: chaveNomeColaborador(desligar.nome),
        desligado_em: formDesligar.data,
        motivo: formDesligar.motivo.trim() || null,
      })

      if (error) {
        if (error.code === '23505') throw new Error(desligar.nome + ' já está marcado como desligado.')
        throw error
      }

      setMensagem(
        desligar.nome +
          ' marcado como desligado em ' +
          formatarData(formDesligar.data) +
          '. Os certificados dessa pessoa saem da lista, dos cartões e dos avisos.'
      )
      setDesligar(null)
      await recarregarDesligados()
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível marcar como desligado.')
    } finally {
      setSalvandoDesligar(false)
    }
  }

  async function reativar(d: ColaboradorDesligado) {
    setConfirmarReativar(null)
    setMenuAberto(null)
    setErro('')
    setMensagem('')

    const { data, error } = await supabase
      .from('colaboradores_desligados')
      .update({ reativado_em: new Date().toISOString() })
      .eq('id', d.id)
      .select('id')

    if (error || !data?.length) {
      if (error) console.error(error)
      setErro('Não foi possível reativar ' + d.nome + '.')
      return
    }

    setMensagem(d.nome + ' reativado. Os certificados dessa pessoa voltam a contar normalmente.')
    await recarregarDesligados()
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

      const resposta = await fetch('/api/cron/treinamentos' + (filtroEmpresa ? '?empresa=' + encodeURIComponent(filtroEmpresa) : ''), {
        headers: { Authorization: 'Bearer ' + (session?.access_token || '') },
      })

      const corpo = await resposta.json()

      if (!resposta.ok || corpo?.sucesso === false) {
        setErro(corpo?.erro || 'Não foi possível ler a plataforma de ensino.')
        return
      }

      /* Leitura recente: o servidor nao leu o EAD de novo, so avisou. */
      if (corpo?.recente) {
        setMensagem(corpo?.aviso || 'O progresso já foi atualizado há pouco.')
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
      let { data, error } = await lerTudo<any>(() =>
        supabase
          .from('certificados')
          .select(COLUNAS_CERT + COLUNAS_PROGRESSO_MANUAL + COLUNA_SEM_VENCIMENTO)
          .order('validade', { ascending: true, nullsFirst: false })
          .order('id')
      )

      setSuportaSemVencimento(!(error && error.code === '42703'))

      if (error && error.code === '42703') {
        const semColuna = await lerTudo<any>(() =>
          supabase
            .from('certificados')
            .select(COLUNAS_CERT + COLUNAS_PROGRESSO_MANUAL)
            .order('validade', { ascending: true, nullsFirst: false })
            .order('id')
        )

        data = semColuna.data as typeof data
        error = semColuna.error
      }

      if (error && error.code === '42703') {
        const antiga = await lerTudo<any>(() =>
          supabase
            .from('certificados')
            .select(COLUNAS_CERT)
            .order('validade', { ascending: true, nullsFirst: false })
            .order('id')
        )

        data = antiga.data as typeof data
        error = antiga.error
        setSuportaManual(false)
      } else {
        setSuportaManual(true)
      }

      if (error) throw error

      /*
       * CPF em consulta separada: sem a coluna (SQL não rodou, 42703) a
       * tela segue como antes, só sem o campo CPF.
       */
      const cpfs = await lerTudo<{ id: string; cpf: string | null }>(() =>
        supabase.from('certificados').select('id, cpf').not('cpf', 'is', null).order('id')
      )
      const cpfPorId = new Map<string, string>()

      if (cpfs.error) {
        setSuportaCpf(false)
      } else {
        setSuportaCpf(true)
        for (const r of cpfs.data || []) if (r.cpf) cpfPorId.set(r.id, r.cpf)
      }

      /* Falha aberta: sem a tabela, ninguém é desligado e os botões somem. */
      const desl = await carregarDesligados(supabase)

      setDesligados(desl.mapa)
      setSuportaDesligados(desl.suportado)

      setCertificados(
        (data || []).map((item: any) => ({
          ...item,
          cpf: cpfPorId.get(item.id) || null,
          empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas,
        }))
      )

      /* "inicio" separa matriculas repetidas do mesmo curso. */
      /* Todas as matrículas, sem o corte de 1000 linhas do Supabase. */
      const { data: progressoData } = await lerProgressos(supabase)

      setProgressos(progressoData)
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

    /* Sem data, o novo não substitui o anterior: ficariam os dois como atuais. */
    if (renovandoDe && !form.emissao && !form.validade) {
      setErro('Informe a emissão do novo certificado para o anterior ir para o histórico.')
      return
    }

    const cpfDigitos = soDigitosCpf(form.cpf)

    if (suportaCpf && form.cpf.trim() && !cpfDigitos) {
      setErro('CPF incompleto: informe os 11 números ou deixe em branco.')
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
        ...(suportaSemVencimento ? { sem_vencimento: !form.validade && form.sem_vencimento } : {}),
        observacoes: form.observacoes.trim() || null,
        link_certificado: normalizarLink(form.link_certificado),
        ...(suportaCpf ? { cpf: cpfDigitos } : {}),
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

        setMensagem(
          renovandoDe
            ? 'Novo certificado lançado. O anterior ficou no histórico do cadastro.'
            : 'Certificado registrado.'
        )
      }

      setRenovandoDe(null)
      setForm(formVazio)
      setPainelAberto(false)
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
    setRenovandoDe(null)
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
      cpf: formatarCpf(c.cpf),
      progresso_origem: c.progresso_origem === 'manual' ? 'manual' : 'ead',
      progresso_etapa: c.progresso_etapa || 'agendado',
      progresso_manual:
        typeof c.progresso_manual === 'number' ? String(c.progresso_manual) : '',
      sem_vencimento: !!c.sem_vencimento,
    })
    setMenuAberto(null)
    setPainelAberto(true)
  }

  /*
   * Renovação: abre um certificado NOVO com a mesma pessoa e o mesmo
   * curso. Ao salvar, ele vira o atual e o que estava aberto vai para o
   * histórico do cadastro (lib/historicoCertificados.ts). Nada é apagado.
   */
  function lancarRenovacao() {
    setErro('')
    setMensagem('')
    setRenovandoDe(form.id)
    setForm((atual) => ({
      ...atual,
      id: '',
      emissao: '',
      validade: '',
      sem_vencimento: false,
      link_certificado: '',
      observacoes: '',
      progresso_etapa: 'agendado',
      progresso_manual: '',
    }))
  }

  function novoCertificado() {
    setErro('')
    setMensagem('')
    setRenovandoDe(null)
    setForm({ ...formVazio, empresa_id: filtroEmpresa || '' })
    setPainelAberto(true)
  }

  function fecharPainel() {
    if (salvando) return
    setRenovandoDe(null)
    setPainelAberto(false)
    setForm(formVazio)
  }

  /* Esc fecha o painel lateral e o menu de ações. */
  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setMenuAberto(null)
      if (desligar) fecharDesligar()
      else if (painelAberto) fecharPainel()
    }

    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  })

  /* Remoção em dois cliques: o primeiro pede confirmação na própria linha. */
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null)

  async function remover(c: Certificado) {
    setConfirmarRemocao(null)
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
    const palavras = palavrasDaBusca(busca)

    const lista = visiveis.filter((c) => {
      /* Histórico fica dentro do cadastro do atual; só aparece na lista com o filtro "Histórico". */
      if (ehHistorico(c) && filtroSituacao !== 'historico') return false
      if (filtroEmpresa && c.empresa_id !== filtroEmpresa) return false
      if (filtroTipo && c.tipo !== filtroTipo) return false
      if (filtroMes && mesDoCertificado(c) !== filtroMes) return false

      if (filtroOrigem) {
        const origem = c.progresso_origem === 'manual' ? 'manual' : 'ead'

        if (origem !== filtroOrigem) return false
      }

      if (filtroSituacao) {
        const d = diasAte(c.validade)
        const faixa = faixaDo(c)

        if (filtroSituacao === 'aguardando') {
          if (!aguardaDo(c)) return false
        } else if (filtroSituacao === '30') {
          if (faixa === 'historico' || faixa === 'desligado' || !(d !== null && d >= 0 && d <= 30)) return false
        } else if (filtroSituacao.startsWith('etapa:')) {
          if (etapaDoProgresso(progressoDe(c)) !== filtroSituacao.slice(6)) return false
        } else if (faixa !== filtroSituacao) {
          return false
        }
      }

      if (!palavras.length) return true

      /* Sem acento e em qualquer ordem. */
      return casaBusca(
        [
          c.colaborador,
          c.email_colaborador,
          c.curso,
          c.funcao,
          c.tipo,
          c.empresas?.nome_fantasia,
          c.empresas?.razao_social,
          /* CPF (só a equipe vê o campo; com ou sem pontuação). */
          interno && c.cpf ? c.cpf + ' ' + formatarCpf(c.cpf) : '',
        ].join(' '),
        palavras
      )
    })

    /*
     * Histórico vai para o fim, mantendo a ordem de validade entre os
     * atuais e entre os substituídos. Assim o que vence primeiro continua
     * no topo e, em "Por colaborador", o histórico fica depois dos atuais.
     */
    /* Desligados (quando mostrados) vão para o fim, depois do histórico. */
    /* Concluídos no EAD aguardando certificado vão para o topo, piscando. */
    const ordem = (c: Certificado) => (desligamentoDo(c) ? 2 : ehHistorico(c) ? 1 : aguardaDo(c) ? -1 : 0)

    return [-1, 0, 1, 2].flatMap((n) => lista.filter((c) => ordem(c) === n))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visiveis,
    desligados,
    busca,
    filtroEmpresa,
    filtroTipo,
    filtroSituacao,
    filtroMes,
    filtroOrigem,
    progressoPorId,
    substitutos,
  ])

  /* Volta para a primeira página sempre que o filtro muda. */
  useEffect(() => {
    setPagina(1)
  }, [busca, filtroEmpresa, filtroTipo, filtroSituacao, filtroMes, filtroOrigem, visao, mostrarDesligados])

  /*
   * Painel tipo x mes. Respeita empresa e origem; tipo e mes NAO
   * entram, porque sao justamente o que o painel ajuda a escolher.
   */
  const painel = useMemo(() => {
    const base = visiveis.filter((c) => {
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

      if ((progressoDe(c)?.progresso ?? 0) >= 100) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis, progressos, filtroEmpresa, filtroOrigem, periodo])

  /* Clique na matriz: abre a lista já filtrada por tipo e mês. */
  function focarCelula(tipo: string, mes: string) {
    setFiltroTipo(tipo)
    setFiltroMes(mes === SEM_DATA ? SEM_DATA : mes)
    setFiltroSituacao('')
    setMaisFiltros(true)
    setAba('lista')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* Meses que aparecem no filtro: os que tem certificado. */
  const mesesDoFiltro = useMemo(
    () =>
      [...new Set(visiveis.map(mesDoCertificado))].sort().reverse(),
    [visiveis]
  )

  /*
   * Indicadores do topo. Respeitam o filtro de empresa (para o cliente,
   * já é só a empresa dele). Dois grupos que NÃO se misturam:
   *  - validade: vencido + até 90 dias + em dia + sem vencimento + não
   *    informada + histórico = total (cada certificado em uma faixa só;
   *    o substituído conta só em histórico);
   *  - treinamento: concluído + em andamento + não iniciado + sem dados
   *    de progresso = total.
   */
  const indicadores = useMemo(() => {
    const base = filtroEmpresa
      ? visiveis.filter((c) => c.empresa_id === filtroEmpresa)
      : visiveis

    const faixa: Record<Faixa, number> = {
      vencido: 0,
      ate90: 0,
      emdia: 0,
      sem_vencimento: 0,
      sem_validade: 0,
      historico: 0,
      desligado: 0,
    }
    const etapa = { concluido: 0, andamento: 0, nao_iniciado: 0, sem_dados: 0 }
    let em30 = 0
    let presenciais = 0
    let aguardando = 0

    for (const c of base) {
      const f = faixaDo(c)
      faixa[f] += 1

      const d = diasAte(c.validade)
      if (f !== 'historico' && f !== 'desligado' && d !== null && d >= 0 && d <= 30) em30 += 1

      etapa[etapaDoProgresso(progressoDe(c))] += 1
      if (c.progresso_origem === 'manual') presenciais += 1
      if (aguardaDo(c)) aguardando += 1
    }

    return { total: base.length, faixa, etapa, em30, presenciais, aguardando, ead: base.length - presenciais }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis, progressoPorId, filtroEmpresa, substitutos, desligados])

  /* Por colaborador: agrupa os cursos de cada pessoa (nome + empresa). */
  const grupos = useMemo(() => {
    const mapa = new Map<string, { chave: string; nome: string; empresa_id: string; empresa: string; itens: Certificado[] }>()

    for (const c of filtrados) {
      const chave = pessoaDe(c) || c.colaborador.trim().toLowerCase() + '|' + c.empresa_id
      const existente = mapa.get(chave)

      /* Mesmo CPF com grafias diferentes: mostra o nome mais completo. */
      if (existente && c.colaborador.trim().split(/\s+/).length > existente.nome.trim().split(/\s+/).length) {
        existente.nome = c.colaborador
      }

      const g = existente || {
        chave,
        nome: c.colaborador,
        empresa_id: c.empresa_id,
        empresa: c.empresas?.nome_fantasia || c.empresas?.razao_social || '',
        itens: [],
      }

      g.itens.push(c)
      mapa.set(chave, g)
    }

    /* Quem tem certificado aguardando atualização vem primeiro. */
    const aguarda = (g: { itens: Certificado[] }) => (g.itens.some(aguardaDo) ? 0 : 1)

    return [...mapa.values()].sort((a, b) => aguarda(a) - aguarda(b) || a.nome.localeCompare(b.nome, 'pt-BR'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, pessoaPorId])

  const totalItens = visao === 'certificado' ? filtrados.length : grupos.length
  const totalPaginas = Math.max(1, Math.ceil(totalItens / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * POR_PAGINA

  const temFiltro = !!(busca || filtroTipo || filtroMes || filtroOrigem || filtroSituacao || (interno && filtroEmpresa))

  function limparFiltros() {
    setBusca('')
    setFiltroTipo('')
    setFiltroMes('')
    setFiltroOrigem('')
    setFiltroSituacao('')
    if (interno) setFiltroEmpresa('')
  }

  /* Exporta exatamente o que está filtrado na lista. */
  function exportar() {
    const linhas: (string | number | null | undefined)[][] = [
      ['Colaborador', 'Função', 'E-mail', 'Empresa', 'Tipo', 'Curso', 'Modalidade', 'Progresso (%)', 'Tempo no EAD', 'Tempo por dia no EAD', 'Emissão', 'Validade', 'Situação', 'Link'],
    ]

    for (const c of filtrados) {
      const p = progressoDe(c)

      linhas.push([
        c.colaborador,
        c.funcao,
        c.email_colaborador,
        c.empresas?.nome_fantasia || c.empresas?.razao_social,
        c.tipo,
        c.curso,
        c.progresso_origem === 'manual' ? 'Presencial' : 'EAD',
        p ? Math.round(p.progresso) : '',
        p && p.origem !== 'manual' && p.tempo_total_seg ? formatarDuracao(p.tempo_total_seg) : '',
        p && p.origem !== 'manual' ? textoTempoPorDia(p) : '',
        formatarData(c.emissao),
        formatarData(c.validade),
        desligamentoDo(c)
          ? situacaoDo(c).texto + ' (' + situacao(c).texto.toLowerCase() + ')'
          : ehHistorico(c)
            ? 'Histórico — ' + situacaoDo(c).texto.toLowerCase()
            : situacao(c).texto,
        c.link_certificado,
      ])
    }

    const blob = new Blob(['\uFEFF' + paraCsv(linhas)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'certificados-' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  /* Mês corrente (destaque na matriz). */
  const mesAtual = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0')



  const linhasPagina = filtrados.slice(inicio, inicio + POR_PAGINA)
  const gruposPagina = grupos.slice(inicio, inicio + POR_PAGINA)

  function cartaoIndicador(
    chave: string,
    numero: number,
    rotulo: string,
    tom: 'neutro' | 'ruim' | 'alerta' | 'bom' | 'cinza',
    icone: string,
    detalhe?: string
  ) {
    const ativo = filtroSituacao === chave

    return (
      <button
        type="button"
        className={'cert-ind tom-' + tom + (ativo ? ' ativo' : '')}
        aria-pressed={ativo}
        title={ativo ? 'Clique para tirar este filtro' : 'Clique para ver só estes certificados'}
        onClick={() => {
          setFiltroSituacao(ativo ? '' : chave)
          setAba('lista')
        }}
      >
        <span className="cert-ind-icone" aria-hidden="true">{icone}</span>
        <span>
          <span className="cert-ind-num">{carregando ? '—' : numero}</span>
          <span className="cert-ind-lbl">{rotulo}</span>
          {detalhe && <span className="cert-ind-det">{detalhe}</span>}
        </span>
      </button>
    )
  }

  function celulaProgresso(c: Certificado) {
    const p = progressoDe(c)
    const etapa = etapaDoProgresso(p)

    if (!p || etapa === 'sem_dados') {
      return <span className="cert-prog cinza">− Não informado</span>
    }

    if (etapa === 'concluido') {
      if (aguardaDo(c)) {
        return (
          <span
            className="cert-prog aguardando"
            title="Concluiu 100% no EAD. Emita o certificado e atualize emissão, validade e arquivo; o alerta some sozinho."
          >
            ✓ Concluído · atualizar certificado
          </span>
        )
      }

      return <span className="cert-prog ok">✓ Concluído</span>
    }

    return (
      <span title={p.atualizado_em ? 'Atualizado em ' + formatarDataHora(p.atualizado_em) : undefined}>
        <BarraProgressoUi valor={p.progresso} cor={corDoProgresso(p.progresso)} largura={90} />
      </span>
    )
  }

  /*
   * Ações sobre a pessoa (desligar/reativar). Só aparecem com a tabela
   * criada. `emMenu` = dentro do menu ⋯ da linha (itens de menu); senão,
   * botões pequenos no cabeçalho do grupo "Por colaborador".
   */
  function acoesPessoa(empresa_id: string, nome: string, empresa: string, d: ColaboradorDesligado | null, emMenu: boolean) {
    if (!suportaDesligados) return null

    const classe = emMenu ? undefined : 'btn btn-sm'
    const papel = emMenu ? 'menuitem' : undefined

    if (!d) {
      return (
        <button type="button" role={papel} className={classe} onClick={() => abrirDesligar(empresa_id, nome, empresa)}>
          Marcar como desligado
        </button>
      )
    }

    if (confirmarReativar === d.id) {
      return (
        <>
          <span className={emMenu ? 'cert-menu-aviso' : 'cert-sub'}>Reativar {d.nome}? Os certificados voltam a contar.</span>
          <button type="button" role={papel} className={classe} onClick={() => reativar(d)}>
            Confirmar reativação
          </button>
          <button type="button" role={papel} className={emMenu ? undefined : 'btn btn-sm btn-ghost'} onClick={() => setConfirmarReativar(null)}>
            Manter desligado
          </button>
        </>
      )
    }

    return (
      <button type="button" role={papel} className={classe} onClick={() => setConfirmarReativar(d.id)}>
        Reativar
      </button>
    )
  }

  /* A coluna "Ações" aparece para a equipe e, com a tabela criada, para o cliente. */
  const comAcoes = interno || suportaDesligados

  function menuAcoes(c: Certificado) {
    if (!comAcoes) return null

    const empresa = c.empresas?.nome_fantasia || c.empresas?.razao_social || ''

    return (
      <span className="cert-acoes">
        <button
          type="button"
          className="cert-mais"
          aria-label={'Ações do certificado de ' + c.colaborador}
          aria-expanded={menuAberto === c.id}
          onClick={(e) => {
            e.stopPropagation()
            setConfirmarRemocao(null)
            setConfirmarReativar(null)
            setMenuAberto(menuAberto === c.id ? null : c.id)
          }}
        >
          ⋯
        </button>

        {menuAberto === c.id && (
          <span className="cert-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            {interno && (
              <button type="button" role="menuitem" onClick={() => editar(c)}>
                Editar
              </button>
            )}

            {acoesPessoa(c.empresa_id, c.colaborador, empresa, desligamentoDo(c), true)}

            {!interno ? null : confirmarRemocao === c.id ? (
              <>
                <span className="cert-menu-aviso">Remover o certificado de {c.colaborador}?</span>
                <button type="button" role="menuitem" className="perigo" onClick={() => { setMenuAberto(null); remover(c) }}>
                  Confirmar remoção
                </button>
                <button type="button" role="menuitem" onClick={() => setConfirmarRemocao(null)}>
                  Manter
                </button>
              </>
            ) : (
              <button type="button" role="menuitem" className="perigo" onClick={() => setConfirmarRemocao(c.id)}>
                Remover
              </button>
            )}
          </span>
        )}
      </span>
    )
  }

  function paginador() {
    if (totalPaginas <= 1) return null

    const ir = (n: number) => {
      setPagina(n)
      document.getElementById('lista-certificados')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
      <span className="cert-paginas">
        <button type="button" className="cert-pag-seta" disabled={paginaAtual === 1} onClick={() => ir(paginaAtual - 1)}>
          ‹ Anterior
        </button>
        {Array.from({ length: totalPaginas }, (_, i) => i + 1)
          .filter((n) => n === 1 || n === totalPaginas || Math.abs(n - paginaAtual) <= 2)
          .map((n, i, lista) => (
            <span key={n} style={{ display: 'contents' }}>
              {i > 0 && n - lista[i - 1] > 1 && <span className="cert-sub">…</span>}
              <button type="button" className={n === paginaAtual ? 'ativo' : ''} aria-current={n === paginaAtual ? 'page' : undefined} onClick={() => ir(n)}>
                {n}
              </button>
            </span>
          ))}
        <button type="button" className="cert-pag-seta" disabled={paginaAtual === totalPaginas} onClick={() => ir(paginaAtual + 1)}>
          Próxima ›
        </button>
      </span>
    )
  }

  /* Certificado aberto no painel já emitido (tem emissão, validade ou arquivo). */
  const emitidoNoForm = Boolean(
    certificados.find((c) => c.id === form.id && (c.emissao || c.validade || c.link_certificado))
  )

  /*
   * Histórico mostrado no painel: os outros certificados do mesmo
   * cadastro (pessoa + curso do formulário). Editando o atual, são os
   * anteriores; editando um antigo, aparecem os demais (inclusive o
   * atual); na renovação, todos os que existem hoje.
   */
  const historicoNoForm = (() => {
    if (!painelAberto || !form.empresa_id || !form.colaborador.trim()) return []

    const doForm = { id: form.id, empresa_id: form.empresa_id, colaborador: form.colaborador, tipo: form.tipo, curso: form.curso }
    const cpfForm = soDigitosCpf(form.cpf)
    const chave = chaveCertificado(
      doForm,
      form.id ? pessoaDe(doForm) : cpfForm ? form.empresa_id + '|CPF ' + cpfForm : null
    )

    return chave ? (porCadastro.get(chave) || []).filter((c) => c.id !== form.id) : []
  })()

  function linhaCertificado(c: Certificado, comPessoa: boolean) {
    const s = situacaoDo(c)
    const deslig = desligamentoDo(c)
    const historico = !deslig && ehHistorico(c)
    const empresa = c.empresas?.nome_fantasia || c.empresas?.razao_social || ''

    const dica = deslig
      ? 'Colaborador desligado' +
        (deslig.motivo ? ' (' + deslig.motivo + ')' : '') +
        '. Situação do certificado: ' +
        (ehHistorico(c) ? 'substituído por um mais novo' : situacao(c).texto.toLowerCase()) +
        '. Não entra nos cartões nem nos avisos.'
      : historico
        ? 'Histórico: já existe um certificado mais novo deste curso para esta pessoa. Não conta como vencido.'
        : undefined

    /* Anteriores do mesmo cadastro (só na linha do certificado atual). */
    const anteriores = historico ? [] : anterioresDe(c)
    const abertoHist = historicoAberto === c.id

    return (
      <Fragment key={c.id}>
      <div
        className={
          'cert-linha' +
          (comAcoes ? '' : ' cliente') +
          (comPessoa ? '' : ' sem-pessoa') +
          (historico ? ' historico' : '') +
          (deslig ? ' desligado' : '') +
          (aguardaDo(c) ? ' aguardando' : '')
        }
      >
        {comPessoa && (
          <span className="cert-pessoa">
            <span className="cert-avatar" style={{ background: corAvatar(c.colaborador) }} aria-hidden="true">
              {iniciais(c.colaborador)}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="cert-nome">{c.colaborador}</span>
              <span className="cert-sub">
                {deslig ? 'Desligado · ' : ''}
                {interno ? empresa : c.funcao || c.email_colaborador || ''}
              </span>
            </span>
          </span>
        )}

        <span style={{ minWidth: 0 }}>
          <span className="cert-curso">{c.tipo}</span>
          <span className="cert-sub" title={c.curso || undefined}>
            {c.progresso_origem === 'manual' ? 'Presencial' : 'EAD'}
            {c.curso ? ' · ' + c.curso : ''}
          </span>
          {anteriores.length > 0 && (
            <button
              type="button"
              className="cert-hist-botao"
              aria-expanded={abertoHist}
              onClick={(e) => {
                e.stopPropagation()
                setHistoricoAberto(abertoHist ? null : c.id)
              }}
            >
              ↺ {anteriores.length} {anteriores.length === 1 ? 'anterior' : 'anteriores'} {abertoHist ? '▴' : '▾'}
            </button>
          )}
        </span>

        <span>
          {celulaProgresso(c)}
          <span onClick={(e) => e.stopPropagation()}>
            <TempoEad progresso={progressoDe(c)} />
          </span>
        </span>

        <span className="cert-validade">
          <span className="cert-data">{c.validade ? formatarData(c.validade) : ''}</span>
          <span className={s.pill + ' cert-pill'} title={dica}>
            <span aria-hidden="true">{s.icone}</span> {s.texto}
          </span>
        </span>

        <span>
          {c.link_certificado ? (
            <a className="btn btn-sm cert-ver" href={c.link_certificado} target="_blank" rel="noreferrer">
              Ver certificado
            </a>
          ) : (
            <span className="cert-sub">Sem arquivo</span>
          )}
        </span>

        {comAcoes && menuAcoes(c)}
      </div>
      {abertoHist && anteriores.length > 0 && listaHistorico(anteriores, comPessoa ? '' : ' sem-pessoa')}
      </Fragment>
    )
  }

  /*
   * Histórico de um cadastro: certificados anteriores do mesmo curso e da
   * mesma pessoa, do mais novo para o mais antigo. Usado abaixo da linha
   * da lista e dentro do painel de edição.
   */
  function listaHistorico(itens: Certificado[], extra = '', noPainel = false) {
    return (
      <div className={'cert-hist' + extra + (noPainel ? ' no-painel' : '')}>
        {itens.map((h) => (
          <div key={h.id} className="cert-hist-item">
            <span>
              <span className="cert-hist-datas">
                Emissão {h.emissao ? formatarData(h.emissao) : '—'} · Validade{' '}
                {h.validade ? formatarData(h.validade) : h.sem_vencimento ? 'sem vencimento' : '—'}
              </span>
              <span className="cert-sub">
                {h.tipo}
                {h.curso ? ' · ' + h.curso : ''}
                {substitutos.get(h.id)?.emissao ? ' · substituído em ' + formatarData(substitutos.get(h.id)!.emissao) : ''}
              </span>
              {!substitutos.has(h.id) && <span className="pill good cert-pill">Atual</span>}
            </span>
            <span className="cert-hist-acoes">
              {h.link_certificado ? (
                <a className="btn btn-sm" href={h.link_certificado} target="_blank" rel="noreferrer">
                  Ver certificado
                </a>
              ) : (
                <span className="cert-sub">Sem arquivo</span>
              )}
              {interno && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => editar(h)}>
                  Abrir
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="app" onClick={() => menuAberto && setMenuAberto(null)}>
      {/* 1. Cabeçalho */}
      <div className="cert-topo">
        <div>
          <div className="section-title">{interno ? 'Todos os clientes' : 'Sua empresa'}</div>
          <h1 style={{ fontSize: 30, marginTop: 6 }}>Certificados</h1>
          <p className="cert-subtitulo">Treinamentos e validades por colaborador.</p>
        </div>

        <div className="cert-topo-acoes">
          <Link href="/treinamentos" className="btn">
            Relatório de treinamentos
          </Link>
          <button type="button" className="btn" onClick={atualizarEad} disabled={atualizandoEad}>
            {atualizandoEad ? 'Atualizando...' : 'Atualizar progresso do EAD'}
          </button>
          <button type="button" className="btn" onClick={exportar} disabled={carregando || filtrados.length === 0}>
            ⤓ Exportar
          </button>
          {interno && (
            <button type="button" className="btn btn-primary" onClick={novoCertificado}>
              + Novo certificado
            </button>
          )}
        </div>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {mensagem && <div className="banner good">{mensagem}</div>}

      {/* 2. Indicadores: validade (faixas que somam o total) e treinamento */}
      <div className="cert-ind-grupo">
        <div className="cert-ind-titulo">
          Validade dos certificados
          <span>
            {interno && filtroEmpresa ? 'empresa filtrada · ' : ''}
            {indicadores.total} cadastrados, cada um em uma faixa
            {!mostrarDesligados && qtdDesligados > 0 ? ' · ' + qtdDesligados + ' de desligados fora da conta' : ''}
          </span>
        </div>
        <div className="cert-inds">
          {cartaoIndicador('vencido', indicadores.faixa.vencido, 'Vencidos', 'ruim', '⏱')}
          {cartaoIndicador(
            'ate90',
            indicadores.faixa.ate90,
            'Vencem em até 90 dias',
            'alerta',
            '⚠',
            indicadores.em30 ? indicadores.em30 + ' em até 30 dias' : undefined
          )}
          {cartaoIndicador('emdia', indicadores.faixa.emdia, 'Em dia (mais de 90 dias)', 'bom', '✓')}
          {suportaSemVencimento &&
            cartaoIndicador('sem_vencimento', indicadores.faixa.sem_vencimento, 'Sem vencimento', 'neutro', '∞')}
          {cartaoIndicador('sem_validade', indicadores.faixa.sem_validade, 'Validade não informada', 'cinza', '?')}
          {(indicadores.faixa.historico > 0 || filtroSituacao === 'historico') &&
            cartaoIndicador(
              'historico',
              indicadores.faixa.historico,
              'Histórico (substituído)',
              'cinza',
              '↺',
              'já renovados; não contam como vencidos'
            )}
          {mostrarDesligados &&
            (indicadores.faixa.desligado > 0 || filtroSituacao === 'desligado') &&
            cartaoIndicador(
              'desligado',
              indicadores.faixa.desligado,
              'De desligados',
              'cinza',
              '⊘',
              'não contam como vencidos nem entram nos avisos'
            )}
        </div>
      </div>

      <div className="cert-trein">
        <span className="cert-ind-titulo" style={{ margin: 0 }}>Treinamento</span>
        {(
          [
            ['aguardando', 'concluídos no EAD aguardando certificado', indicadores.aguardando],
            ['etapa:concluido', 'concluídos (100%)', indicadores.etapa.concluido],
            ['etapa:andamento', 'em andamento', indicadores.etapa.andamento],
            ['etapa:nao_iniciado', 'não iniciados', indicadores.etapa.nao_iniciado],
            ['etapa:sem_dados', 'sem dados de progresso', indicadores.etapa.sem_dados],
          ] as [string, string, number][]
        ).map(([chave, rotulo, n]) => (
          <button
            key={chave}
            type="button"
            className={
              'cert-chip' +
              (filtroSituacao === chave ? ' ativo' : '') +
              (chave === 'aguardando' && n > 0 ? ' aguardando' : '')
            }
            onClick={() => {
              setFiltroSituacao(filtroSituacao === chave ? '' : chave)
              setAba('lista')
            }}
          >
            <strong>{carregando ? '—' : n}</strong> {rotulo}
          </button>
        ))}
        <span className="cert-sub" style={{ marginLeft: 'auto' }}>
          Modalidade: {indicadores.ead} EAD · {indicadores.presenciais} presenciais
        </span>
      </div>

      {/* 3. Abas */}
      <div className="cert-abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'lista'} className={aba === 'lista' ? 'ativa' : ''} onClick={() => setAba('lista')}>
          Certificados
        </button>
        <button type="button" role="tab" aria-selected={aba === 'analise'} className={aba === 'analise' ? 'ativa' : ''} onClick={() => setAba('analise')}>
          Análise mensal
        </button>
      </div>

      {aba === 'lista' && (
        <>
          {/* 4. Busca e filtros */}
          <div className="cert-filtros">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar colaborador, função, e-mail ou curso..."
            />

            {interno && (
              <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
                <option value="">Todas as empresas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </option>
                ))}
              </select>
            )}

            <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}>
              <option value="">Todas as situações</option>
              <option value="vencido">Vencidos</option>
              <option value="30">Vencem em até 30 dias</option>
              <option value="ate90">Vencem em até 90 dias</option>
              <option value="emdia">Em dia (mais de 90 dias)</option>
              {suportaSemVencimento && <option value="sem_vencimento">Sem vencimento</option>}
              <option value="sem_validade">Validade não informada</option>
              <option value="historico">Histórico (substituídos)</option>
              {mostrarDesligados && <option value="desligado">De colaboradores desligados</option>}
              <option value="aguardando">Concluído no EAD, aguardando certificado</option>
              <option value="etapa:concluido">Treinamento concluído</option>
              <option value="etapa:andamento">Treinamento em andamento</option>
              <option value="etapa:nao_iniciado">Treinamento não iniciado</option>
              <option value="etapa:sem_dados">Sem dados de progresso</option>
            </select>

            <button
              type="button"
              className={'btn' + (maisFiltros || filtroTipo || filtroMes || filtroOrigem ? ' cert-filtro-ativo' : '')}
              aria-expanded={maisFiltros}
              onClick={() => setMaisFiltros((v) => !v)}
            >
              ☰ Mais filtros
            </button>

            {suportaDesligados && (qtdDesligados > 0 || mostrarDesligados) && (
              <label className="cert-check" title="Certificados de quem saiu da empresa ficam escondidos e fora das contas.">
                <input
                  type="checkbox"
                  checked={mostrarDesligados}
                  onChange={(e) => {
                    setMostrarDesligados(e.target.checked)
                    if (!e.target.checked && filtroSituacao === 'desligado') setFiltroSituacao('')
                  }}
                />
                Mostrar desligados ({qtdDesligados})
              </label>
            )}

            {temFiltro && (
              <button type="button" className="btn btn-ghost" onClick={limparFiltros}>
                Limpar
              </button>
            )}

            {maisFiltros && (
              <div className="cert-mais-filtros">
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                {suportaManual && (
                  <select value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}>
                    <option value="">EAD e presencial</option>
                    <option value="ead">Só EAD</option>
                    <option value="manual">Só presencial</option>
                  </select>
                )}

                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
                  <option value="">Todos os meses</option>
                  {mesesDoFiltro.map((m) => (
                    <option key={m} value={m}>
                      {rotuloMes(m)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 5. Lista */}
          <div className="panel" id="lista-certificados">
            <div className="panel-head cert-lista-topo">
              <h2 className="cert-lista-titulo">Lista de certificados</h2>
              <div className="cert-lista-dir">
                <span className="cert-sub">
                  {filtrados.length} de {visiveis.length} certificados
                  {visao === 'colaborador' ? ' · ' + grupos.length + ' colaboradores' : ''}
                </span>
                <div className="cert-alternar" role="group" aria-label="Organizar a lista">
                  <button type="button" className={visao === 'certificado' ? 'ativo' : ''} onClick={() => setVisao('certificado')}>
                    Por certificado
                  </button>
                  <button type="button" className={visao === 'colaborador' ? 'ativo' : ''} onClick={() => setVisao('colaborador')}>
                    Por colaborador
                  </button>
                </div>
              </div>
            </div>

            {!carregando && totalPaginas > 1 && (
              <div className="cert-rodape cert-rodape-topo">
                <span className="cert-sub">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                {paginador()}
              </div>
            )}

            <div className="cert-tabela">
              <div className={'cert-linha cert-cab' + (comAcoes ? '' : ' cliente') + (visao === 'colaborador' ? ' sem-pessoa' : '')}>
                {visao === 'certificado' && <span>{interno ? 'Colaborador / Empresa' : 'Colaborador'}</span>}
                <span>Curso / Modalidade</span>
                <span>Progresso</span>
                <span>Validade / Situação</span>
                <span>Certificado</span>
                {comAcoes && <span style={{ textAlign: 'right' }}>Ações</span>}
              </div>

              {carregando ? (
                <div className="empty-state">Carregando...</div>
              ) : filtrados.length === 0 ? (
                <div className="empty-state">
                  {certificados.length === 0
                    ? 'Nenhum certificado cadastrado ainda.'
                    : visiveis.length === 0
                      ? 'Todos os certificados são de colaboradores desligados. Marque "Mostrar desligados" para vê-los.'
                      : 'Nenhum certificado com esses filtros.'}
                </div>
              ) : visao === 'certificado' ? (
                linhasPagina.map((c) => linhaCertificado(c, true))
              ) : (
                gruposPagina.map((g) => {
                  const dg = desligamentoDe(desligados, { empresa_id: g.empresa_id, colaborador: g.nome })

                  return (
                  <div key={g.chave} className={'cert-grupo' + (dg ? ' desligado' : '')}>
                    <div className="cert-grupo-cab">
                      <span className="cert-avatar" style={{ background: corAvatar(g.nome) }} aria-hidden="true">
                        {iniciais(g.nome)}
                      </span>
                      <span>
                        <span className="cert-nome">{g.nome}</span>
                        <span className="cert-sub">
                          {interno && g.empresa ? g.empresa + ' · ' : ''}
                          {g.itens.length} {g.itens.length === 1 ? 'curso' : 'cursos'}
                          {(() => {
                            const v = g.itens.filter((c) => faixaDo(c) === 'vencido').length
                            const a = g.itens.filter((c) => faixaDo(c) === 'ate90').length
                            const h =
                              filtroSituacao === 'historico'
                                ? g.itens.filter((c) => faixaDo(c) === 'historico').length
                                : g.itens.reduce((n, c) => n + (ehHistorico(c) ? 0 : anterioresDe(c).length), 0)
                            const ag = g.itens.filter(aguardaDo).length
                            return (
                              (ag ? ' · ' + ag + ' aguardando certificado' : '') +
                              (v ? ' · ' + v + ' vencido(s)' : '') +
                              (a ? ' · ' + a + ' vencendo em até 90 dias' : '') +
                              (h ? ' · ' + h + ' anterior(es) no histórico' : '')
                            )
                          })()}
                        </span>
                        {dg && (
                          <span className="pill flat desligado cert-pill" title={dg.motivo ? 'Motivo: ' + dg.motivo : undefined} style={{ marginTop: 4 }}>
                            <span aria-hidden="true">⊘</span> Desligado em {formatarData(dg.desligado_em)}
                          </span>
                        )}
                      </span>
                      {suportaDesligados && (
                        <span className="cert-grupo-acoes">
                          {acoesPessoa(g.empresa_id, g.nome, g.empresa, dg, false)}
                        </span>
                      )}
                    </div>
                    {g.itens.map((c) => linhaCertificado(c, false))}
                  </div>
                  )
                })
              )}
            </div>

            {!carregando && totalItens > 0 && (
              <div className="cert-rodape">
                <span className="cert-sub">
                  Exibindo {inicio + 1}–{Math.min(inicio + POR_PAGINA, totalItens)} de {totalItens}
                  {visao === 'colaborador' ? ' colaboradores' : ''}
                </span>
                {paginador()}
              </div>
            )}
          </div>
        </>
      )}

      {aba === 'analise' && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Painel por tipo e mês</div>

            <div className="filters">
              {interno && (
                <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
                  <option value="">Todas as empresas</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </option>
                  ))}
                </select>
              )}
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                <option value="6">Últimos 6 meses</option>
                <option value="12">Últimos 12 meses</option>
                <option value="ano">Ano atual</option>
                <option value="tudo">Todo o período</option>
              </select>
            </div>
          </div>

          <div className="panel-body">
            <div className="stats" style={{ marginBottom: 4 }}>
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

            <p className="cert-sub" style={{ margin: 0 }}>
              Os três últimos números são partes dos lançados no período e podem se sobrepor (um presencial
              pode estar com 100% e sem emissão ao mesmo tempo). &quot;Sem data de emissão&quot; não é o mesmo
              que validade não informada.
            </p>

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
                          <th key={m} className={m === mesAtual ? 'cert-mes-atual' : ''}>
                            {rotuloMes(m)}
                            {m === mesAtual && <span className="cert-mes-tag">atual</span>}
                          </th>
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
                              <td key={m} className={m === mesAtual ? 'cert-mes-atual' : ''}>
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
                          <td key={m} className={'matriz-total' + (m === mesAtual ? ' cert-mes-atual' : '')}>
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

            <p className="footnote" style={{ marginTop: 6 }}>
              Mês pela data de emissão; sem emissão, pelo mês de cadastro. Cor mais forte = mais certificados.
              Clique num número para abrir a lista com esses certificados.
              {painel.semDataFora > 0 &&
                ` ${painel.semDataFora} certificado(s) sem nenhuma data aparecem só em "Todo o período".`}
            </p>
          </div>
        </div>
      )}

      {/* Marcar colaborador como desligado (confirmação com data e motivo) */}
      {desligar && (
        <div className="cert-fundo" onMouseDown={(e) => e.target === e.currentTarget && fecharDesligar()}>
          <aside className="cert-lateral" role="dialog" aria-modal="true" aria-labelledby="cert-desligar-titulo">
            <div className="cert-lateral-topo">
              <div>
                <div className="section-title">Certificados</div>
                <h2 id="cert-desligar-titulo">Marcar como desligado</h2>
              </div>
              <button type="button" className="btn btn-ghost" onClick={fecharDesligar} aria-label="Fechar">
                ✕
              </button>
            </div>

            <form onSubmit={confirmarDesligamento} className="cert-form">
              {erro && <div className="banner bad">{erro}</div>}

              <p style={{ margin: 0, fontSize: 14 }}>
                <strong>{desligar.nome}</strong>
                {desligar.empresa ? ' · ' + desligar.empresa : ''}
              </p>

              <p className="cert-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
                Os certificados desta pessoa saem da lista, dos cartões, do painel, do Boletim de Antecedência e
                dos avisos de treinamento. Nada é apagado: dá para ver com &quot;Mostrar desligados&quot; e
                reativar quando quiser.
              </p>

              <div className="field">
                <label>Data do desligamento *</label>
                <input
                  type="date"
                  value={formDesligar.data}
                  onChange={(e) => setFormDesligar((atual) => ({ ...atual, data: e.target.value }))}
                  required
                />
              </div>

              <div className="field">
                <label>Motivo (opcional)</label>
                <textarea
                  value={formDesligar.motivo}
                  onChange={(e) => setFormDesligar((atual) => ({ ...atual, motivo: e.target.value }))}
                  placeholder="Ex.: pediu demissão, fim de contrato, transferido"
                  rows={3}
                />
              </div>

              <div className="cert-form-acoes">
                <button type="button" className="btn" onClick={fecharDesligar} disabled={salvandoDesligar}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvandoDesligar}>
                  {salvandoDesligar ? 'Salvando...' : 'Confirmar desligamento'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* Formulário lateral: Novo certificado / Editar */}
      {interno && painelAberto && (
        <div className="cert-fundo" onMouseDown={(e) => e.target === e.currentTarget && fecharPainel()}>
          <aside className="cert-lateral" role="dialog" aria-modal="true" aria-labelledby="cert-form-titulo">
            <div className="cert-lateral-topo">
              <div>
                <div className="section-title">Certificados</div>
                <h2 id="cert-form-titulo">
                  {editando ? 'Editar certificado' : renovandoDe ? 'Novo certificado (renovação)' : 'Novo certificado'}
                </h2>
              </div>
              <button type="button" className="btn btn-ghost" onClick={fecharPainel} aria-label="Fechar">
                ✕
              </button>
            </div>

            <form onSubmit={salvar} className="cert-form">
              {erro && <div className="banner bad">{erro}</div>}

              {editando && emitidoNoForm && (
                <div className="cert-renovar">
                  <span>
                    Fez a reciclagem? Lance o novo certificado: ele vira o atual e este vai para o histórico, sem apagar nada.
                  </span>
                  <button type="button" className="btn btn-sm btn-primary" onClick={lancarRenovacao} disabled={salvando}>
                    + Lançar novo certificado
                  </button>
                </div>
              )}

              {renovandoDe && (
                <div className="banner">
                  Renovação: mesma pessoa e mesmo curso já preenchidos. Informe emissão, validade e link do novo certificado.
                </div>
              )}

              <div className="field">
                <label>Empresa *</label>
                <select value={form.empresa_id} onChange={(e) => alterar('empresa_id', e.target.value)}>
                  <option value="">Selecione</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Colaborador *</label>
                  <div className="cert-sugestao-wrap">
                    <input
                      value={form.colaborador}
                      onChange={(e) => {
                        alterar('colaborador', e.target.value)
                        setSugerirPessoa(true)
                      }}
                      onFocus={() => setSugerirPessoa(true)}
                      onBlur={() => setTimeout(() => setSugerirPessoa(false), 150)}
                      onKeyDown={(e) => e.key === 'Escape' && sugerirPessoa && sugestoesPessoa.length > 0 && (e.stopPropagation(), setSugerirPessoa(false))}
                      placeholder={form.empresa_id ? 'Digite o nome: mostramos quem já tem cadastro' : 'Nome de quem fez o treinamento'}
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={sugerirPessoa && sugestoesPessoa.length > 0}
                      aria-controls="cert-sugestoes-pessoa"
                    />
                    {sugerirPessoa && sugestoesPessoa.length > 0 && (
                      <div className="cert-sugestoes" id="cert-sugestoes-pessoa" role="listbox">
                        <div className="cert-sugestoes-titulo">Já cadastrados nesta empresa</div>
                        {sugestoesPessoa.map((p) => (
                          <button
                            key={p.nome + '|' + p.email}
                            type="button"
                            role="option"
                            aria-selected={false}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => escolherPessoa(p)}
                          >
                            <span className="cert-nome">{p.nome}</span>
                            <span className="cert-sub">
                              {[p.cpf ? 'CPF ' + formatarCpf(p.cpf) : '', p.funcao, p.email, p.cursos + (p.cursos === 1 ? ' certificado' : ' certificados')].filter(Boolean).join(' · ')}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label>Função</label>
                  <input value={form.funcao} onChange={(e) => alterar('funcao', e.target.value)} placeholder="Cargo na empresa" />
                </div>
              </div>

              {suportaCpf && (
                <div className="field">
                  <label>CPF do colaborador</label>
                  <input
                    value={form.cpf}
                    onChange={(e) => alterar('cpf', e.target.value)}
                    onBlur={() => soDigitosCpf(form.cpf) && setForm((atual) => ({ ...atual, cpf: formatarCpf(atual.cpf) }))}
                    placeholder="000.000.000-00 — liga os certificados da mesma pessoa"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="field">
                <label>E-mail do colaborador</label>
                <input type="email" value={form.email_colaborador} onChange={(e) => alterar('email_colaborador', e.target.value)} placeholder="É por ele que buscamos o progresso no EAD" />
              </div>

              <div className="field">
                <label>Curso no EAD</label>
                <input list="lista-cursos" value={form.curso} onChange={(e) => alterar('curso', e.target.value)} placeholder="Escolha ou digite — grava em MAIÚSCULAS" />
                <datalist id="lista-cursos">
                  {CURSOS.map((curso) => (
                    <option key={curso} value={curso} />
                  ))}
                </datalist>
              </div>

              {suportaManual ? (
                <div className="field">
                  <label>Modalidade / origem do progresso *</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className={'btn btn-sm' + (form.progresso_origem === 'ead' ? ' btn-primary' : '')} aria-pressed={form.progresso_origem === 'ead'} onClick={() => escolherOrigem('ead')}>
                      Plataforma (EAD)
                    </button>
                    <button type="button" className={'btn btn-sm' + (form.progresso_origem === 'manual' ? ' btn-primary' : '')} aria-pressed={form.progresso_origem === 'manual'} onClick={() => escolherOrigem('manual')}>
                      Presencial (manual)
                    </button>
                  </div>
                  <span className="cert-sub">
                    {form.progresso_origem === 'ead'
                      ? 'Atualiza sozinho todo dia às 06h, pelo e-mail do colaborador no EAD.'
                      : 'A leitura do EAD não mexe neste certificado. Quem salvar fica registrado.'}
                  </span>
                </div>
              ) : (
                <div className="cert-sub">Lançamento manual (presencial) indisponível: falta rodar a migração do progresso no Supabase.</div>
              )}

              {suportaManual && form.progresso_origem === 'manual' && (
                <div className="field-row">
                  <div className="field">
                    <label>Etapa</label>
                    <select value={form.progresso_etapa} onChange={(e) => escolherEtapa(e.target.value as EtapaManual)}>
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
                      onChange={(e) => setForm((atual) => ({ ...atual, progresso_manual: e.target.value }))}
                      placeholder="Opcional — 0 a 100"
                    />
                    {form.progresso_etapa === 'concluido' && !form.emissao && (
                      <span style={{ fontSize: 11.5, color: 'var(--amber)' }}>
                        Concluído sem data de emissão: na análise mensal, entra no mês de cadastro.
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="field">
                <label>Tipo *</label>
                <select value={form.tipo} onChange={(e) => alterar('tipo', e.target.value)}>
                  <option value="">Selecione</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Emissão</label>
                  <input type="date" value={form.emissao} onChange={(e) => alterar('emissao', e.target.value)} />
                </div>
                <div className="field">
                  <label>Validade</label>
                  <input type="date" value={form.validade} disabled={form.sem_vencimento} onChange={(e) => alterar('validade', e.target.value)} />
                </div>
              </div>

              {suportaSemVencimento && (
                <label className="cert-check">
                  <input
                    type="checkbox"
                    checked={form.sem_vencimento}
                    onChange={(e) =>
                      setForm((atual) => ({ ...atual, sem_vencimento: e.target.checked, validade: e.target.checked ? '' : atual.validade }))
                    }
                  />
                  Este certificado não vence (validade indeterminada)
                </label>
              )}
              <span className="cert-sub" style={{ marginTop: -6 }}>
                Sem data de validade e sem essa marcação, o certificado aparece como &quot;Validade não informada&quot;.
              </span>

              <div className="field">
                <label>Link do certificado</label>
                <input value={form.link_certificado} onChange={(e) => alterar('link_certificado', e.target.value)} placeholder="Endereço do arquivo, se houver" />
              </div>

              <div className="field">
                <label>Observações</label>
                <textarea value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} placeholder="Anotação livre" rows={3} />
              </div>

              {historicoNoForm.length > 0 && (
                <div className="cert-hist-painel">
                  <div className="cert-hist-titulo">
                    {renovandoDe ? 'Vão para o histórico ao salvar' : 'Histórico deste certificado'} ({historicoNoForm.length})
                  </div>
                  {listaHistorico(historicoNoForm, '', true)}
                </div>
              )}

              <div className="cert-form-acoes">
                <button type="button" className="btn" onClick={fecharPainel} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Registrar certificado'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  )
}

/* Ferramenta cobrada à parte: cliente sem contratação vê o cadeado (lib/modulos.ts). */
export default function CertificadosPage() {
  return (
    <ComModulo modulo="certificados">
      <CertificadosPageConteudo />
    </ComModulo>
  )
}
