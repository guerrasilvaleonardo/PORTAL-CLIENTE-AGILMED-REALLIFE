'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import {
  ALERTAS_PADRAO,
  DIAS_CHAMADO_AUTOMATICO,
  dataBr,
  diasAteData,
  faixaVencimento,
  nomeDoTipo,
  proximoPrazo,
  revisaoPendente,
  type DocumentoSst,
  type FaixaVencimento,
  type TipoDocumento,
} from '@/lib/documentosSst'
import '../certificados/certificados.css'
import './documentos.css'
import { ComModulo } from '@/components/ModuloBloqueado'

/*
 * Documentos SST (supabase/documentos-sst.sql). A equipe cadastra,
 * renova e edita; o cliente vê os documentos da própria empresa, abre
 * a versão assinada e pede a renovação por chamado.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const POR_PAGINA = 25
const MARCOS = [90, 60, 30, 15, 7]

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Pessoa = { id: string; nome: string | null }

type Documento = DocumentoSst & {
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
}

const formVazio = {
  id: '',
  empresa_id: '',
  unidade: '',
  tipo_id: '',
  titulo: '',
  emissao: '',
  vencimento: '',
  sem_vencimento: false,
  proxima_revisao: '',
  revisao_pendente: false,
  motivo_revisao: '',
  responsavel_id: '',
  responsavel_tecnico: '',
  link_assinado: '',
  versao: '',
  observacoes: '',
  alertas: [...ALERTAS_PADRAO] as number[],
  substitui_id: '',
  chamado_automatico: true,
}

type Form = typeof formVazio

const ROTULO_FAIXA: Record<FaixaVencimento, { texto: string; pill: string }> = {
  vencido: { texto: 'Vencido', pill: 'pill bad' },
  ate30: { texto: 'Vence em até 30 dias', pill: 'pill bad' },
  ate60: { texto: 'Vence em 31 a 60 dias', pill: 'pill warn' },
  ate90: { texto: 'Vence em 61 a 90 dias', pill: 'pill warn' },
  emdia: { texto: 'No prazo', pill: 'pill good' },
  sem_venc: { texto: 'Sem vencimento fixo', pill: 'pill neutro' },
  sem_data: { texto: 'Vencimento não informado', pill: 'pill flat' },
}

function nomeEmpresa(e?: { nome_fantasia: string | null; razao_social: string } | null) {
  return e?.nome_fantasia || e?.razao_social || ''
}

function paraCsv(linhas: (string | number | null | undefined)[][]) {
  return linhas
    .map((l) => l.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';'))
    .join('\r\n')
}

function textoSituacao(d: Documento) {
  const f = faixaVencimento(d)
  if (!d.vencimento) return ROTULO_FAIXA[f].texto
  const dias = diasAteData(d.vencimento) as number
  if (dias < 0) return 'Vencido há ' + Math.abs(dias) + (Math.abs(dias) === 1 ? ' dia' : ' dias')
  if (dias === 0) return 'Vence hoje'
  if (dias <= 90) return 'Vence em ' + dias + (dias === 1 ? ' dia' : ' dias')
  return ROTULO_FAIXA[f].texto
}

function textoRevisao(d: Documento): { texto: string; pill: string } | null {
  if (d.revisao_pendente) return { texto: 'Revisão pendente', pill: 'pill bad' }
  const dias = diasAteData(d.proxima_revisao)
  if (dias !== null) {
    if (dias < 0) return { texto: 'Revisão atrasada há ' + Math.abs(dias) + ' d', pill: 'pill bad' }
    if (dias <= 30) return { texto: 'Revisão em ' + dias + ' d', pill: 'pill warn' }
    return null
  }
  if (!d.vencimento) return { texto: 'Revisão a programar', pill: 'pill flat' }
  return null
}

function DocumentosSstPageConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [interno, setInterno] = useState(false)

  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [equipe, setEquipe] = useState<Pessoa[]>([])

  const [busca, setBusca] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')
  const [pagina, setPagina] = useState(1)

  const [form, setForm] = useState<Form>(formVazio)
  const [painelAberto, setPainelAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null)
  const [historicoDe, setHistoricoDe] = useState<Documento | null>(null)
  /* Chamados de renovação ligados a cada documento (chamados.documento_sst_id). */
  const [chamadosDoc, setChamadosDoc] = useState<Map<string, { id: string; numero: number; status: string }>>(new Map())
  const [tiposAberto, setTiposAberto] = useState(false)
  const [novoTipo, setNovoTipo] = useState({ nome: '', sigla: '' })

  const tipoPorId = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos])
  const pessoaPorId = useMemo(() => new Map(equipe.map((p) => [p.id, p.nome || ''])), [equipe])

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

      if (ehInterno) {
        const [{ data: emps }, { data: pessoas }] = await Promise.all([
          supabase.from('empresas').select('id, razao_social, nome_fantasia').order('razao_social'),
          supabase.from('profiles').select('id, nome').in('perfil', PERFIS_INTERNOS).eq('ativo', true).order('nome'),
        ])
        setEmpresas(emps || [])
        setEquipe(pessoas || [])
      }

      const [{ data: tps, error: erroTipos }, { data: docs, error: erroDocs }] = await Promise.all([
        supabase.from('documentos_sst_tipos').select('id, nome, sigla, ordem, ativo').order('ordem').order('nome'),
        supabase
          .from('documentos_sst')
          .select('*, empresas(nome_fantasia, razao_social)')
          .order('created_at', { ascending: false }),
      ])

      if (erroTipos || erroDocs) {
        const e = erroTipos || erroDocs
        if (e?.code === '42P01' || /does not exist|schema cache/i.test(e?.message || '')) {
          setSemTabela(true)
          return
        }
        throw e
      }

      /* Sem a coluna (SQL antigo) só não mostra os chamados ligados. */
      const { data: chs } = await supabase
        .from('chamados')
        .select('id, numero, status, documento_sst_id, created_at')
        .not('documento_sst_id', 'is', null)
        .order('created_at', { ascending: false })
      const mapa = new Map<string, { id: string; numero: number; status: string }>()
      for (const c of (chs || []) as any[]) if (!mapa.has(c.documento_sst_id)) mapa.set(c.documento_sst_id, c)
      setChamadosDoc(mapa)

      setTipos((tps || []) as TipoDocumento[])
      setDocumentos(
        ((docs || []) as any[]).map((d) => ({ ...d, empresas: Array.isArray(d.empresas) ? d.empresas[0] : d.empresas }))
      )
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os documentos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (painelAberto) fecharPainel()
      else if (historicoDe) setHistoricoDe(null)
      else if (tiposAberto) setTiposAberto(false)
      setMenuAberto(null)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  const vigentes = useMemo(() => documentos.filter((d) => d.situacao === 'vigente'), [documentos])

  /* Unidades já usadas (para sugerir no cadastro e filtrar). */
  function unidadesDe(empresaId: string) {
    return [...new Set(documentos.filter((d) => !empresaId || d.empresa_id === empresaId).map((d) => d.unidade || '').filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR')
    )
  }

  function casaSituacao(d: Documento, chave: string) {
    if (!chave) return true
    if (chave === 'sem_link') return !d.link_assinado
    if (chave === 'revisao') return revisaoPendente(d)
    return faixaVencimento(d) === chave
  }

  const base = useMemo(
    () => vigentes.filter((d) => !filtroEmpresa || d.empresa_id === filtroEmpresa),
    [vigentes, filtroEmpresa]
  )

  const indicadores = useMemo(() => {
    const conta = (f: (d: Documento) => boolean) => base.filter(f).length
    return {
      total: base.length,
      vencido: conta((d) => faixaVencimento(d) === 'vencido'),
      ate30: conta((d) => faixaVencimento(d) === 'ate30'),
      ate60: conta((d) => faixaVencimento(d) === 'ate60'),
      ate90: conta((d) => faixaVencimento(d) === 'ate90'),
      semLink: conta((d) => !d.link_assinado),
      revisao: conta((d) => revisaoPendente(d)),
    }
  }, [base])

  const filtrados = useMemo(() => {
    const palavras = palavrasDaBusca(busca)

    return base
      .filter((d) => !filtroUnidade || (d.unidade || '') === filtroUnidade)
      .filter((d) => !filtroTipo || d.tipo_id === filtroTipo)
      .filter((d) => !filtroResponsavel || (filtroResponsavel === '_sem' ? !d.responsavel_id : d.responsavel_id === filtroResponsavel))
      .filter((d) => casaSituacao(d, filtroSituacao))
      .filter((d) => {
        if (!palavras.length) return true
        const t = tipoPorId.get(d.tipo_id)
        return casaBusca(
          [nomeEmpresa(d.empresas), d.unidade, t?.nome, t?.sigla, d.titulo, d.versao, d.responsavel_tecnico, pessoaPorId.get(d.responsavel_id || ''), d.observacoes].join(' '),
          palavras
        )
      })
      .sort((a, b) => {
        const pa = proximoPrazo(a)?.data || '9999'
        const pb = proximoPrazo(b)?.data || '9999'
        return pa.localeCompare(pb)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, busca, filtroUnidade, filtroTipo, filtroResponsavel, filtroSituacao, tipoPorId, pessoaPorId])

  useEffect(() => {
    setPagina(1)
  }, [busca, filtroEmpresa, filtroUnidade, filtroTipo, filtroResponsavel, filtroSituacao])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * POR_PAGINA
  const linhasPagina = filtrados.slice(inicio, inicio + POR_PAGINA)
  const temFiltro = Boolean(busca || filtroEmpresa || filtroUnidade || filtroTipo || filtroResponsavel || filtroSituacao)

  function limparFiltros() {
    setBusca('')
    setFiltroEmpresa('')
    setFiltroUnidade('')
    setFiltroTipo('')
    setFiltroResponsavel('')
    setFiltroSituacao('')
  }

  /* ---------- Formulário ---------- */

  function alterar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function novoDocumento() {
    setErro('')
    setForm({ ...formVazio, empresa_id: filtroEmpresa })
    setPainelAberto(true)
  }

  function paraForm(d: Documento): Form {
    return {
      id: d.id,
      empresa_id: d.empresa_id,
      unidade: d.unidade || '',
      tipo_id: d.tipo_id,
      titulo: d.titulo || '',
      emissao: d.emissao || '',
      vencimento: d.vencimento || '',
      sem_vencimento: d.sem_vencimento,
      proxima_revisao: d.proxima_revisao || '',
      revisao_pendente: d.revisao_pendente,
      motivo_revisao: d.motivo_revisao || '',
      responsavel_id: d.responsavel_id || '',
      responsavel_tecnico: d.responsavel_tecnico || '',
      link_assinado: d.link_assinado || '',
      versao: d.versao || '',
      observacoes: d.observacoes || '',
      alertas: d.alertas ? [...d.alertas] : [...ALERTAS_PADRAO],
      substitui_id: d.substitui_id || '',
      chamado_automatico: d.chamado_automatico !== false,
    }
  }

  function editar(d: Documento) {
    setErro('')
    setMenuAberto(null)
    setForm(paraForm(d))
    setPainelAberto(true)
  }

  /* Nova revisão: copia o cadastro, limpa datas, link e pendência. */
  function renovar(d: Documento) {
    setErro('')
    setMenuAberto(null)
    setForm({
      ...paraForm(d),
      id: '',
      emissao: '',
      vencimento: '',
      proxima_revisao: '',
      revisao_pendente: false,
      motivo_revisao: '',
      link_assinado: '',
      versao: '',
      observacoes: '',
      substitui_id: d.id,
    })
    setPainelAberto(true)
  }

  function fecharPainel() {
    setPainelAberto(false)
    setForm(formVazio)
  }

  const editando = form.id !== ''
  const renovando = !editando && form.substitui_id !== ''
  const anterior = renovando ? documentos.find((d) => d.id === form.substitui_id) : undefined

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (salvando) return

    if (!form.empresa_id) return setErro('Escolha a empresa.')
    if (!form.tipo_id) return setErro('Escolha o tipo do documento.')
    if (form.vencimento && form.emissao && form.vencimento < form.emissao)
      return setErro('O vencimento está antes da emissão. Confira as datas.')

    const link = form.link_assinado.trim()
    if (link && !/^https?:\/\//i.test(link)) return setErro('O link precisa começar com http:// ou https://.')

    const dados = {
      empresa_id: form.empresa_id,
      unidade: form.unidade.trim() || null,
      tipo_id: form.tipo_id,
      titulo: form.titulo.trim() || null,
      emissao: form.emissao || null,
      vencimento: form.sem_vencimento ? null : form.vencimento || null,
      sem_vencimento: form.sem_vencimento,
      proxima_revisao: form.proxima_revisao || null,
      revisao_pendente: form.revisao_pendente,
      motivo_revisao: form.revisao_pendente ? form.motivo_revisao.trim() || null : null,
      responsavel_id: form.responsavel_id || null,
      responsavel_tecnico: form.responsavel_tecnico.trim() || null,
      link_assinado: link || null,
      versao: form.versao.trim() || null,
      observacoes: form.observacoes.trim() || null,
      alertas: [...form.alertas].sort((a, b) => b - a),
      chamado_automatico: form.chamado_automatico,
    }

    setSalvando(true)
    setErro('')

    const { error } = editando
      ? await supabase.from('documentos_sst').update(dados).eq('id', form.id)
      : await supabase.from('documentos_sst').insert({ ...dados, substitui_id: form.substitui_id || null })

    setSalvando(false)

    if (error) {
      console.error(error)
      setErro('Não foi possível salvar: ' + error.message)
      return
    }

    setMensagem(
      editando
        ? 'Documento atualizado.'
        : renovando
          ? 'Nova revisão registrada. A anterior foi para o histórico, com o link preservado.'
          : 'Documento cadastrado.'
    )
    fecharPainel()
    carregar()
  }

  async function remover(d: Documento) {
    setConfirmarRemocao(null)
    setMenuAberto(null)
    const { error } = await supabase.from('documentos_sst').delete().eq('id', d.id)
    if (error) {
      setErro('Não foi possível remover: ' + error.message)
      return
    }
    setMensagem('Documento removido.')
    carregar()
  }

  /* ---------- Tipos ---------- */

  async function criarTipo(e: FormEvent) {
    e.preventDefault()
    const nome = novoTipo.nome.trim()
    if (!nome) return
    const { data, error } = await supabase
      .from('documentos_sst_tipos')
      .insert({ nome, sigla: novoTipo.sigla.trim().toUpperCase() || null, ordem: 500 })
      .select('id, nome, sigla, ordem, ativo')
      .single()
    if (error) {
      setErro(error.code === '23505' ? 'Já existe um tipo com esse nome.' : 'Não foi possível criar o tipo: ' + error.message)
      return
    }
    setTipos((atual) => [...atual, data as TipoDocumento])
    setNovoTipo({ nome: '', sigla: '' })
    if (painelAberto && !form.tipo_id) alterar('tipo_id', (data as TipoDocumento).id)
    setMensagem('Tipo "' + nome + '" criado.')
  }

  async function alternarTipo(t: TipoDocumento) {
    const { error } = await supabase.from('documentos_sst_tipos').update({ ativo: !t.ativo }).eq('id', t.id)
    if (error) return setErro('Não foi possível alterar o tipo: ' + error.message)
    setTipos((atual) => atual.map((x) => (x.id === t.id ? { ...x, ativo: !t.ativo } : x)))
  }

  /* ---------- Histórico ---------- */

  function historico(d: Documento) {
    const lista: Documento[] = [d]
    const porId = new Map(documentos.map((x) => [x.id, x]))
    let atual = d
    const vistos = new Set([d.id])
    while (atual.substitui_id && porId.has(atual.substitui_id) && !vistos.has(atual.substitui_id)) {
      atual = porId.get(atual.substitui_id) as Documento
      vistos.add(atual.id)
      lista.push(atual)
    }
    return lista
  }

  function solicitarRenovacao(d: Documento) {
    const t = tipoPorId.get(d.tipo_id)
    const nome = nomeDoTipo(t) + (d.unidade ? ' — ' + d.unidade : '')
    const prazo = proximoPrazo(d)
    const descricao =
      'Solicito a renovação/revisão do documento ' +
      nome +
      (d.versao ? ' (' + d.versao + ')' : '') +
      (d.titulo ? ' — ' + d.titulo : '') +
      '.' +
      (prazo ? '\nPróximo prazo no portal: ' + dataBr(prazo.data) + ' (' + (prazo.tipo === 'vencimento' ? 'vencimento' : 'revisão') + ').' : '') +
      '\n\nAlterações desde a última versão (processos, funções, ambientes, número de trabalhadores): '
    const q = new URLSearchParams({ categoria: 'Documentos', assunto: 'Renovação: ' + nome, descricao, documento: d.id })
    window.location.href = '/chamados/novo?' + q.toString()
  }

  function exportar() {
    const linhas = [
      ['Empresa', 'Unidade', 'Tipo', 'Título', 'Versão', 'Emissão', 'Vencimento', 'Próxima revisão', 'Situação', 'Revisão', 'Responsável', 'Responsável técnico', 'Link assinado', 'Observações'],
      ...filtrados.map((d) => [
        nomeEmpresa(d.empresas),
        d.unidade,
        tipoPorId.get(d.tipo_id)?.nome,
        d.titulo,
        d.versao,
        dataBr(d.emissao),
        d.sem_vencimento ? 'Sem vencimento fixo' : dataBr(d.vencimento),
        dataBr(d.proxima_revisao),
        textoSituacao(d),
        textoRevisao(d)?.texto || '',
        pessoaPorId.get(d.responsavel_id || ''),
        d.responsavel_tecnico,
        d.link_assinado,
        d.observacoes,
      ]),
    ]
    const blob = new Blob(['﻿' + paraCsv(linhas)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'documentos-sst-' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ---------- Render ---------- */

  function cartao(chave: string, numero: number, rotulo: string, tom: string, icone: string) {
    const ativo = chave !== '' && filtroSituacao === chave
    return (
      <button
        type="button"
        className={'cert-ind tom-' + tom + (ativo ? ' ativo' : '')}
        aria-pressed={ativo}
        onClick={() => setFiltroSituacao(ativo ? '' : chave)}
        title={ativo ? 'Clique para tirar este filtro' : 'Clique para ver só estes documentos'}
      >
        <span className="cert-ind-icone" aria-hidden="true">{icone}</span>
        <span>
          <span className="cert-ind-num">{carregando ? '—' : numero}</span>
          <span className="cert-ind-lbl">{rotulo}</span>
        </span>
      </button>
    )
  }

  function paginador() {
    if (totalPaginas <= 1) return null
    const ir = (n: number) => {
      setPagina(n)
      document.getElementById('lista-documentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
              <button type="button" className={n === paginaAtual ? 'ativo' : ''} onClick={() => ir(n)}>
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

  function linha(d: Documento) {
    const t = tipoPorId.get(d.tipo_id)
    const prazo = proximoPrazo(d)
    const f = faixaVencimento(d)
    const rev = textoRevisao(d)
    const resp = pessoaPorId.get(d.responsavel_id || '')

    return (
      <div key={d.id} className="cert-linha doc-linha">
        <span style={{ minWidth: 0 }}>
          <span className="cert-nome">{nomeEmpresa(d.empresas) || '—'}</span>
          <span className="cert-sub">{d.unidade || 'Unidade não informada'}</span>
        </span>

        <span style={{ minWidth: 0 }}>
          <span className="cert-curso" title={t?.nome}>
            {nomeDoTipo(t)}
            {d.versao ? ' · ' + d.versao : ''}
          </span>
          <span className="cert-sub" title={d.titulo || t?.nome}>
            {d.titulo || t?.nome}
            {interno && resp ? ' · Acomp.: ' + resp : ''}
          </span>
        </span>

        <span>
          {prazo ? (
            <>
              <span className="cert-data">{dataBr(prazo.data)}</span>
              <span className="cert-sub">{prazo.tipo === 'vencimento' ? 'Vencimento' : 'Revisão programada'}</span>
            </>
          ) : (
            <span className="cert-sub">Não definido</span>
          )}
        </span>

        <span className="cert-validade">
          {chamadosDoc.get(d.id) && (
            <a
              className="pill neutro cert-pill doc-chamado"
              href={(interno ? '/atendimento/' : '/chamados/') + chamadosDoc.get(d.id)!.id}
              title="Chamado de renovação ligado a este documento"
            >
              Chamado #{chamadosDoc.get(d.id)!.numero}
            </a>
          )}
          {!d.vencimento && !d.sem_vencimento && d.proxima_revisao ? (
            /* Controlado só pela revisão: o aviso de revisão já diz a situação. */
            !rev && <span className="pill neutro cert-pill">Revisão programada</span>
          ) : (
            <span className={ROTULO_FAIXA[f].pill + ' cert-pill'}>{textoSituacao(d)}</span>
          )}
          {rev && (
            <span className={rev.pill + ' cert-pill'} title={d.motivo_revisao || undefined}>
              {rev.texto}
            </span>
          )}
        </span>

        <span>
          {d.link_assinado ? (
            <a className="btn btn-sm cert-ver" href={d.link_assinado} target="_blank" rel="noreferrer">
              Abrir assinado
            </a>
          ) : interno ? (
            <button type="button" className="btn btn-sm doc-sem-link" onClick={() => editar(d)}>
              + Inserir link
            </button>
          ) : (
            <span className="cert-sub">Sem versão assinada</span>
          )}
        </span>

        <span className="cert-acoes">
          <button
            type="button"
            className="cert-mais"
            aria-label={'Ações do documento ' + nomeDoTipo(t)}
            aria-expanded={menuAberto === d.id}
            onClick={(e) => {
              e.stopPropagation()
              setConfirmarRemocao(null)
              setMenuAberto(menuAberto === d.id ? null : d.id)
            }}
          >
            ⋯
          </button>

          {menuAberto === d.id && (
            <span className="cert-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              {interno ? (
                <>
                  <button type="button" role="menuitem" onClick={() => editar(d)}>
                    Editar
                  </button>
                  <button type="button" role="menuitem" onClick={() => renovar(d)}>
                    Renovar / Nova revisão
                  </button>
                </>
              ) : null}
              {chamadosDoc.get(d.id) ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => (window.location.href = (interno ? '/atendimento/' : '/chamados/') + chamadosDoc.get(d.id)!.id)}
                >
                  Ver chamado de renovação #{chamadosDoc.get(d.id)!.numero}
                </button>
              ) : (
                <button type="button" role="menuitem" onClick={() => solicitarRenovacao(d)}>
                  {interno ? 'Abrir chamado de renovação' : 'Solicitar renovação'}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAberto(null)
                  setHistoricoDe(d)
                }}
              >
                Histórico de revisões
              </button>
              {interno &&
                (confirmarRemocao === d.id ? (
                  <>
                    <span className="cert-menu-aviso">Remover este documento do portal? O arquivo no SharePoint/Drive não é apagado.</span>
                    <button type="button" role="menuitem" className="perigo" onClick={() => remover(d)}>
                      Confirmar remoção
                    </button>
                    <button type="button" role="menuitem" onClick={() => setConfirmarRemocao(null)}>
                      Manter
                    </button>
                  </>
                ) : (
                  <button type="button" role="menuitem" className="perigo" onClick={() => setConfirmarRemocao(d.id)}>
                    Remover
                  </button>
                ))}
            </span>
          )}
        </span>
      </div>
    )
  }

  if (semTabela) {
    return (
      <div className="app">
        <h1 style={{ fontSize: 30 }}>Documentos SST</h1>
        <div className="banner bad" style={{ marginTop: 16 }}>
          Esta área ainda não está ativa: falta rodar o script supabase/documentos-sst.sql no Supabase.
        </div>
      </div>
    )
  }

  const unidadesFiltro = unidadesDe(filtroEmpresa)
  const tiposAtivos = tipos.filter((t) => t.ativo || t.id === form.tipo_id)

  return (
    <div className="app" onClick={() => menuAberto && setMenuAberto(null)}>
      <div className="cert-topo">
        <div>
          <div className="section-title">{interno ? 'Todos os clientes' : 'Sua empresa'}</div>
          <h1 style={{ fontSize: 30, marginTop: 6 }}>Documentos SST</h1>
          <p className="cert-subtitulo">PGR, PCMSO, laudos e programas: prazos, revisões e versões assinadas.</p>
        </div>

        <div className="cert-topo-acoes">
          <button type="button" className="btn" onClick={exportar} disabled={carregando || filtrados.length === 0}>
            ⤓ Exportar
          </button>
          {interno && (
            <>
              <button type="button" className="btn" onClick={() => setTiposAberto(true)}>
                + Novo tipo de documento
              </button>
              <button type="button" className="btn btn-primary" onClick={novoDocumento}>
                + Novo documento
              </button>
            </>
          )}
        </div>
      </div>

      {erro && !painelAberto && <div className="banner bad">{erro}</div>}
      {mensagem && <div className="banner good">{mensagem}</div>}

      <div className="cert-ind-grupo">
        <div className="cert-ind-titulo">
          Prazos
          <span>
            {interno && filtroEmpresa ? 'empresa filtrada · ' : ''}
            {indicadores.total} documentos vigentes
          </span>
        </div>
        <div className="cert-inds">
          {cartao('', indicadores.total, 'Cadastrados', 'neutro', '▤')}
          {cartao('vencido', indicadores.vencido, 'Vencidos', 'ruim', '⏱')}
          {cartao('ate30', indicadores.ate30, 'A vencer em até 30 dias', 'ruim', '!')}
          {cartao('ate60', indicadores.ate60, 'A vencer em 31 a 60 dias', 'alerta', '⚠')}
          {cartao('ate90', indicadores.ate90, 'A vencer em 61 a 90 dias', 'alerta', '◷')}
        </div>
      </div>

      <div className="cert-ind-grupo">
        <div className="cert-ind-titulo">
          Assinatura e revisão
          <span>controle separado do prazo</span>
        </div>
        <div className="cert-inds">
          {cartao('sem_link', indicadores.semLink, 'Sem link assinado', 'cinza', '✎')}
          {cartao('revisao', indicadores.revisao, 'Revisões pendentes', 'alerta', '↻')}
        </div>
      </div>

      <div className="cert-filtros">
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, unidade, documento, versão ou responsável..." />

        {interno && (
          <select
            value={filtroEmpresa}
            onChange={(e) => {
              setFiltroEmpresa(e.target.value)
              setFiltroUnidade('')
            }}
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome_fantasia || e.razao_social}
              </option>
            ))}
          </select>
        )}

        <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}>
          <option value="">Todas as unidades</option>
          {unidadesFiltro.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.sigla ? t.sigla + ' — ' + t.nome : t.nome}
            </option>
          ))}
        </select>

        {interno && (
          <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            <option value="_sem">Sem responsável</option>
            {equipe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome || 'Sem nome'}
              </option>
            ))}
          </select>
        )}

        <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}>
          <option value="">Todas as situações</option>
          <option value="vencido">Vencidos</option>
          <option value="ate30">A vencer em até 30 dias</option>
          <option value="ate60">A vencer em 31 a 60 dias</option>
          <option value="ate90">A vencer em 61 a 90 dias</option>
          <option value="emdia">No prazo (mais de 90 dias)</option>
          <option value="sem_venc">Sem vencimento fixo</option>
          <option value="sem_data">Vencimento não informado</option>
          <option value="sem_link">Sem link assinado</option>
          <option value="revisao">Revisão pendente</option>
        </select>

        {temFiltro && (
          <button type="button" className="btn btn-ghost" onClick={limparFiltros}>
            Limpar
          </button>
        )}
      </div>

      <div className="panel" id="lista-documentos">
        <div className="panel-head cert-lista-topo">
          <h2 className="cert-lista-titulo">Documentos</h2>
          <span className="cert-sub">
            {filtrados.length} de {vigentes.length} documentos vigentes
          </span>
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
          <div className="cert-linha cert-cab doc-linha">
            <span>Empresa / Unidade</span>
            <span>Documento</span>
            <span>Próximo prazo</span>
            <span>Situação</span>
            <span>Arquivo</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>

          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">
              {vigentes.length === 0
                ? interno
                  ? 'Nenhum documento cadastrado ainda. Use "+ Novo documento".'
                  : 'Nenhum documento cadastrado para a sua empresa ainda.'
                : 'Nenhum documento com esses filtros.'}
            </div>
          ) : (
            linhasPagina.map(linha)
          )}
        </div>

        {!carregando && filtrados.length > 0 && (
          <div className="cert-rodape">
            <span className="cert-sub">
              Exibindo {inicio + 1}–{Math.min(inicio + POR_PAGINA, filtrados.length)} de {filtrados.length}
            </span>
            {paginador()}
          </div>
        )}
      </div>

      <p className="footnote">
        Prazo e assinatura são controles separados: um documento pode estar no prazo e ainda sem a versão assinada. A data
        cadastrada não garante que o conteúdo continua atualizado — mudanças de processo, função, ambiente ou número de
        trabalhadores podem exigir revisão antes do prazo.
      </p>

      {/* Formulário lateral */}
      {interno && painelAberto && (
        <div className="cert-fundo" onMouseDown={(e) => e.target === e.currentTarget && fecharPainel()}>
          <aside className="cert-lateral" role="dialog" aria-modal="true" aria-labelledby="doc-form-titulo">
            <div className="cert-lateral-topo">
              <div>
                <div className="section-title">Documentos SST</div>
                <h2 id="doc-form-titulo">{editando ? 'Editar documento' : renovando ? 'Nova revisão' : 'Novo documento'}</h2>
              </div>
              <button type="button" className="btn btn-ghost" onClick={fecharPainel} aria-label="Fechar">
                ✕
              </button>
            </div>

            <form onSubmit={salvar} className="cert-form">
              {erro && <div className="banner bad">{erro}</div>}

              {renovando && anterior && (
                <div className="banner doc-aviso">
                  A versão atual ({nomeDoTipo(tipoPorId.get(anterior.tipo_id))}
                  {anterior.versao ? ' · ' + anterior.versao : ''}) vai para o histórico, com o link preservado. Preencha as
                  datas, a versão e o link da nova revisão.
                </div>
              )}

              <div className="field">
                <label>Empresa *</label>
                <select value={form.empresa_id} onChange={(e) => alterar('empresa_id', e.target.value)} disabled={renovando}>
                  <option value="">Selecione</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Unidade / contrato / estabelecimento</label>
                <input list="doc-unidades" value={form.unidade} onChange={(e) => alterar('unidade', e.target.value)} placeholder="Ex.: Matriz, Obra Hospital, Contrato 045/2026" />
                <datalist id="doc-unidades">
                  {unidadesDe(form.empresa_id).map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Tipo *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={form.tipo_id} onChange={(e) => alterar('tipo_id', e.target.value)} disabled={renovando} style={{ flex: 1 }}>
                      <option value="">Selecione</option>
                      {tiposAtivos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.sigla ? t.sigla + ' — ' + t.nome : t.nome}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm" onClick={() => setTiposAberto(true)} title="Novo tipo de documento">
                      +
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>Versão / revisão</label>
                  <input value={form.versao} onChange={(e) => alterar('versao', e.target.value)} placeholder={anterior?.versao ? 'Anterior: ' + anterior.versao : 'Ex.: Rev. 02'} />
                </div>
              </div>

              <div className="field">
                <label>Título</label>
                <input value={form.titulo} onChange={(e) => alterar('titulo', e.target.value)} placeholder="Ex.: PGR — Unidade Porto Velho" />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Data de emissão</label>
                  <input type="date" value={form.emissao} onChange={(e) => alterar('emissao', e.target.value)} />
                </div>
                <div className="field">
                  <label>Data de vencimento</label>
                  <input type="date" value={form.vencimento} disabled={form.sem_vencimento} onChange={(e) => alterar('vencimento', e.target.value)} />
                </div>
              </div>

              <label className="cert-check">
                <input
                  type="checkbox"
                  checked={form.sem_vencimento}
                  onChange={(e) => setForm((a) => ({ ...a, sem_vencimento: e.target.checked, vencimento: e.target.checked ? '' : a.vencimento }))}
                />
                Não possui vencimento fixo (controlar pela revisão programada)
              </label>

              <div className="field">
                <label>Data da próxima revisão</label>
                <input type="date" value={form.proxima_revisao} onChange={(e) => alterar('proxima_revisao', e.target.value)} />
                <span className="cert-sub">Atualização programada, independente do vencimento.</span>
              </div>

              <label className="cert-check">
                <input type="checkbox" checked={form.revisao_pendente} onChange={(e) => alterar('revisao_pendente', e.target.checked)} />
                Revisão pendente por alteração das condições
              </label>
              {form.revisao_pendente && (
                <div className="field">
                  <label>O que mudou</label>
                  <input value={form.motivo_revisao} onChange={(e) => alterar('motivo_revisao', e.target.value)} placeholder="Ex.: novo setor de pintura, mudança de layout, nova função" />
                </div>
              )}

              <div className="field-row">
                <div className="field">
                  <label>Responsável pelo acompanhamento</label>
                  <select value={form.responsavel_id} onChange={(e) => alterar('responsavel_id', e.target.value)}>
                    <option value="">Sem responsável</option>
                    {equipe.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome || 'Sem nome'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Responsável técnico</label>
                  <input value={form.responsavel_tecnico} onChange={(e) => alterar('responsavel_tecnico', e.target.value)} placeholder="Nome e registro (CREA/CRM)" />
                </div>
              </div>

              <div className="field">
                <label>Link do documento assinado</label>
                <input value={form.link_assinado} onChange={(e) => alterar('link_assinado', e.target.value)} placeholder="https://... (SharePoint, Drive ou outro local)" />
              </div>

              <div className="field">
                <label>Alertas antes do prazo</label>
                <div className="doc-marcos">
                  {MARCOS.map((m) => (
                    <label key={m} className="cert-check">
                      <input
                        type="checkbox"
                        checked={form.alertas.includes(m)}
                        onChange={(e) =>
                          alterar('alertas', e.target.checked ? [...form.alertas, m] : form.alertas.filter((x) => x !== m))
                        }
                      />
                      {m} dias
                    </label>
                  ))}
                </div>
                <span className="cert-sub">
                  Vale para o vencimento e para a revisão programada. O e-mail sai no dia útil em que o prazo chega a cada marco
                  e quando vence. Sem nenhum marco, avisa só no vencimento.
                </span>
              </div>

              <label className="cert-check">
                <input type="checkbox" checked={form.chamado_automatico} onChange={(e) => alterar('chamado_automatico', e.target.checked)} />
                Abrir chamado de renovação automaticamente a {DIAS_CHAMADO_AUTOMATICO} dias do prazo, se ninguém tiver pedido
              </label>

              <div className="field">
                <label>Observações</label>
                <textarea value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} rows={3} placeholder="Pendências e condições de atualização" />
              </div>

              <div className="cert-form-acoes">
                <button type="button" className="btn" onClick={fecharPainel} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : renovando ? 'Registrar nova revisão' : 'Cadastrar documento'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* Histórico */}
      {historicoDe && (
        <div className="cert-fundo" onMouseDown={(e) => e.target === e.currentTarget && setHistoricoDe(null)}>
          <aside className="cert-lateral" role="dialog" aria-modal="true" aria-labelledby="doc-hist-titulo">
            <div className="cert-lateral-topo">
              <div>
                <div className="section-title">
                  {nomeEmpresa(historicoDe.empresas)}
                  {historicoDe.unidade ? ' · ' + historicoDe.unidade : ''}
                </div>
                <h2 id="doc-hist-titulo">Histórico — {nomeDoTipo(tipoPorId.get(historicoDe.tipo_id))}</h2>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setHistoricoDe(null)} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="cert-form">
              {historico(historicoDe).map((d, i) => (
                <div key={d.id} className="doc-hist">
                  <div className="doc-hist-cab">
                    <strong>{d.versao || 'Sem versão informada'}</strong>
                    <span className={'pill ' + (i === 0 ? 'good' : 'flat')}>{i === 0 ? 'Vigente' : 'Substituído'}</span>
                  </div>
                  <span className="cert-sub">
                    Emissão: {dataBr(d.emissao) || '—'} · Vencimento: {d.sem_vencimento ? 'sem vencimento fixo' : dataBr(d.vencimento) || '—'}
                    {d.proxima_revisao ? ' · Revisão: ' + dataBr(d.proxima_revisao) : ''}
                  </span>
                  {d.responsavel_tecnico && <span className="cert-sub">RT: {d.responsavel_tecnico}</span>}
                  {d.observacoes && <span className="cert-sub">{d.observacoes}</span>}
                  {d.link_assinado ? (
                    <a className="btn btn-sm cert-ver" href={d.link_assinado} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
                      Abrir assinado
                    </a>
                  ) : (
                    <span className="cert-sub">Sem versão assinada</span>
                  )}
                </div>
              ))}
              {!interno && !chamadosDoc.get(historicoDe.id) && (
                <button type="button" className="btn btn-primary" onClick={() => solicitarRenovacao(historicoDe)}>
                  Solicitar renovação
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Tipos de documento */}
      {interno && tiposAberto && (
        <div className="cert-fundo doc-fundo-tipos" onMouseDown={(e) => e.target === e.currentTarget && setTiposAberto(false)}>
          <aside className="cert-lateral" role="dialog" aria-modal="true" aria-labelledby="doc-tipos-titulo">
            <div className="cert-lateral-topo">
              <div>
                <div className="section-title">Documentos SST</div>
                <h2 id="doc-tipos-titulo">Tipos de documento</h2>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setTiposAberto(false)} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="cert-form">
              <form onSubmit={criarTipo} className="doc-tipo-novo">
                <div className="field">
                  <label>Nome do novo tipo *</label>
                  <input value={novoTipo.nome} onChange={(e) => setNovoTipo((a) => ({ ...a, nome: e.target.value }))} placeholder="Ex.: Laudo de SPDA" />
                </div>
                <div className="field" style={{ maxWidth: 140, minWidth: 100 }}>
                  <label>Sigla</label>
                  <input value={novoTipo.sigla} onChange={(e) => setNovoTipo((a) => ({ ...a, sigla: e.target.value }))} placeholder="Ex.: SPDA" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={!novoTipo.nome.trim()}>
                  Adicionar
                </button>
              </form>

              {tipos.map((t) => (
                <div key={t.id} className={'doc-tipo' + (t.ativo ? '' : ' inativo')}>
                  <span style={{ minWidth: 0 }}>
                    <span className="cert-nome">{t.sigla || t.nome}</span>
                    {t.sigla && <span className="cert-sub">{t.nome}</span>}
                  </span>
                  <span className="cert-sub">{documentos.filter((d) => d.tipo_id === t.id && d.situacao === 'vigente').length} vigentes</span>
                  <button type="button" className="btn btn-sm" onClick={() => alternarTipo(t)}>
                    {t.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              ))}
              <span className="cert-sub">
                Tipo desativado some da lista de cadastro, mas os documentos dele continuam no portal.
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

/* Ferramenta cobrada à parte: cliente sem contratação vê o cadeado (lib/modulos.ts). */
export default function DocumentosSstPage() {
  return (
    <ComModulo modulo="documentos">
      <DocumentosSstPageConteudo />
    </ComModulo>
  )
}
