'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { avisar } from '@/lib/avisar'
import { normalizarUrl, rotuloDoLink } from '@/lib/links'
import type { ChamadoLink } from '@/lib/links'
import { HORAS_SLA, prazoEmHorasUteis } from '@/lib/prazo'

type Chamado = {
  id: string
  numero: number | null
  empresa_id: string
  categoria: string
  assunto: string
  descricao: string
  prioridade: string
  status: string
  criado_por: string | null
  responsavel_id: string | null
  prazo_sla: string | null
  sla_pausado_em: string | null
  sla_pausa_total: string | null
  primeira_resposta_em: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  created_at: string
  updated_at: string
}

type Evento = {
  id: string
  tipo: string
  de: string | null
  para: string | null
  observacao: string | null
  created_at: string
  autor?: { nome: string | null } | null
}

const rotuloStatus: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

/* O Postgres devolve interval como "1 day 02:30:00". */
function horasDoIntervalo(valor: string | null) {
  if (!valor) return 0

  const dias = /(\d+)\s+day/.exec(valor)
  const hora = /(\d+):(\d+):/.exec(valor)

  return (
    (dias ? Number(dias[1]) * 24 : 0) +
    (hora ? Number(hora[1]) + Number(hora[2]) / 60 : 0)
  )
}

function duracao(de: string | null, ate: string | null) {
  if (!de || !ate) return null

  const h = (new Date(ate).getTime() - new Date(de).getTime()) / 3600000

  if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min'
  if (h < 48) return h.toFixed(1).replace('.0', '') + ' h'

  return Math.round(h / 24) + ' dias'
}

function descreverEvento(e: Evento) {
  if (e.tipo === 'abertura') return 'Chamado aberto'

  if (e.tipo === 'status') {
    return (
      'Situação: ' +
      (e.de ? (rotuloStatus[e.de] || e.de) + ' → ' : '') +
      (rotuloStatus[e.para || ''] || e.para)
    )
  }

  if (e.tipo === 'prioridade') {
    return 'Prioridade: ' + (e.de || '—') + ' → ' + (e.para || '—')
  }

  if (e.tipo === 'responsavel') {
    return 'Responsável: ' + (e.de || '—') + ' → ' + (e.para || '—')
  }

  if (e.tipo === 'sla') {
    return e.para === 'pausado'
      ? 'SLA pausado'
      : 'SLA retomado'
  }

  return e.tipo
}

type Agente = {
  id: string
  nome: string | null
  perfil: string
}

type Solicitante = {
  nome: string | null
  email: string | null
}

type Empresa = {
  id: string
  nome_fantasia: string
  marca: string | null
}

type Mensagem = {
  id: string
  chamado_id: string
  autor_id: string
  mensagem: string
  created_at: string
  autor_nome: string
  autor_perfil: string
}

type Anexo = {
  id: string
  chamado_id: string
  enviado_por: string
  nome_arquivo: string
  caminho_arquivo: string
  tipo_arquivo: string | null
  tamanho_bytes: number | null
  created_at: string
}

const statusLabels: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

const prioridadeLabels: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

function formatarData(data: string | null) {
  if (!data) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(data))
}

function formatarTamanho(bytes: number | null) {
  if (!bytes) return '—'

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function corStatus(status: string) {
  switch (status) {
    case 'aberto':
      return {
        background: '#dbeafe',
        color: '#1d4ed8',
      }

    case 'em_atendimento':
      return {
        background: '#fef3c7',
        color: '#b45309',
      }

    case 'aguardando_cliente':
      return {
        background: '#f3e8ff',
        color: '#7e22ce',
      }

    case 'resolvido':
      return {
        background: '#dcfce7',
        color: '#15803d',
      }

    case 'encerrado':
      return {
        background: '#e5e7eb',
        color: '#374151',
      }

    default:
      return {
        background: '#f1f5f9',
        color: '#475569',
      }
  }
}

function corPrioridade(prioridade: string) {
  switch (prioridade) {
    case 'urgente':
      return {
        background: '#fee2e2',
        color: '#b91c1c',
      }

    case 'alta':
      return {
        background: '#ffedd5',
        color: '#c2410c',
      }

    case 'media':
      return {
        background: '#fef3c7',
        color: '#a16207',
      }

    default:
      return {
        background: '#dcfce7',
        color: '#15803d',
      }
  }
}

function iconeArquivo(
  tipo: string | null,
  nome: string
) {
  const extensao = nome
    .split('.')
    .pop()
    ?.toLowerCase()

  if (
    tipo?.includes('pdf') ||
    extensao === 'pdf'
  ) {
    return 'PDF'
  }

  if (
    tipo?.includes('image') ||
    ['jpg', 'jpeg', 'png', 'webp'].includes(
      extensao || ''
    )
  ) {
    return 'IMG'
  }

  if (
    tipo?.includes('word') ||
    ['doc', 'docx'].includes(extensao || '')
  ) {
    return 'DOC'
  }

  if (
    tipo?.includes('excel') ||
    tipo?.includes('spreadsheet') ||
    ['xls', 'xlsx', 'csv'].includes(
      extensao || ''
    )
  ) {
    return 'XLS'
  }

  return 'ARQ'
}

export default function AtendimentoChamadoPage() {
  const params = useParams()
  const router = useRouter()

  const chamadoId = Array.isArray(params.id)
    ? params.id[0]
    : params.id

  const [chamado, setChamado] =
    useState<Chamado | null>(null)

  const [empresa, setEmpresa] =
    useState<Empresa | null>(null)

  const [solicitante, setSolicitante] =
    useState<Solicitante | null>(null)

  const [mensagens, setMensagens] =
    useState<Mensagem[]>([])

  const [anexos, setAnexos] =
    useState<Anexo[]>([])

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] = useState('')

  const [agentes, setAgentes] =
    useState<Agente[]>([])

  const [eventos, setEventos] = useState<Evento[]>([])

  const [novoResponsavel, setNovoResponsavel] =
    useState('')

  const [salvandoResponsavel, setSalvandoResponsavel] =
    useState(false)

  const [novaMensagem, setNovaMensagem] =
    useState('')

  const [enviando, setEnviando] =
    useState(false)

  const [novoStatus, setNovoStatus] =
    useState('')

  const [novaPrioridade, setNovaPrioridade] =
    useState('')

  const [salvandoStatus, setSalvandoStatus] =
    useState(false)

  const [salvandoPrioridade, setSalvandoPrioridade] =
    useState(false)

  const [enviandoAnexo, setEnviandoAnexo] =
    useState(false)

  const [abrindoAnexo, setAbrindoAnexo] =
    useState<string | null>(null)

  const [erroAnexo, setErroAnexo] =
    useState('')

  const [links, setLinks] = useState<ChamadoLink[]>([])

  const [meuId, setMeuId] = useState('')

  const [novoLinkTitulo, setNovoLinkTitulo] = useState('')
  const [novoLinkUrl, setNovoLinkUrl] = useState('')
  const [salvandoLink, setSalvandoLink] = useState(false)
  const [erroLink, setErroLink] = useState('')
  const [editandoLink, setEditandoLink] = useState<string | null>(null)

  useEffect(() => {
    if (!chamadoId) return

    carregarChamado()
  }, [chamadoId])

  async function carregarChamado() {
    try {
      setLoading(true)
      setErro('')

      const {
        data: { user },
        error: usuarioError,
      } = await supabase.auth.getUser()

      if (usuarioError) {
        throw usuarioError
      }

      if (!user) {
        router.push('/login')
        return
      }

      setMeuId(user.id)

      const {
        data: chamadoData,
        error: chamadoError,
      } = await supabase
        .from('chamados')
        .select(`
          id,
          numero,
          empresa_id,
          categoria,
          assunto,
          descricao,
          prioridade,
          status,
          responsavel_id,
          prazo_sla,
          sla_pausado_em,
          sla_pausa_total,
          primeira_resposta_em,
          resolvido_em,
          encerrado_em,
          created_at,
          updated_at
        `)
        .eq('id', chamadoId)
        .single()

      if (chamadoError) {
        console.error(
          'Erro ao carregar chamado:',
          chamadoError
        )

        throw chamadoError
      }

      const chamadoAtual =
        chamadoData as Chamado

      setChamado(chamadoAtual)

      setNovoStatus(
        chamadoAtual.status
      )

      setNovaPrioridade(
        chamadoAtual.prioridade
      )

      setNovoResponsavel(
        chamadoAtual.responsavel_id || ''
      )

      /*
       * Lista de quem pode receber o chamado: a equipe interna
       * ativa. É por aqui que o administrador transfere o
       * atendimento de uma pessoa para outra.
       */
      const { data: agentesData } = await supabase
        .from('profiles')
        .select('id, nome, perfil')
        .in('perfil', ['atendimento', 'gestor', 'admin'])
        .eq('ativo', true)
        .order('nome')

      setAgentes((agentesData || []) as Agente[])

      const { data: eventosData } = await supabase
        .from('chamado_eventos')
        .select(
          'id, tipo, de, para, observacao, created_at, autor:profiles(nome)'
        )
        .eq('chamado_id', chamadoId)
        .order('created_at')

      setEventos(
        ((eventosData || []) as any[]).map((e) => ({
          ...e,
          autor: Array.isArray(e.autor) ? e.autor[0] : e.autor,
        })) as Evento[]
      )

      const {
        data: empresaData,
        error: empresaError,
      } = await supabase
        .from('empresas')
        .select(`
          id,
          nome_fantasia,
          marca
        `)
        .eq(
          'id',
          chamadoAtual.empresa_id
        )
        .single()

      if (empresaError) {
        console.error(
          'Erro ao carregar empresa:',
          empresaError
        )
      } else {
        setEmpresa(
          empresaData as Empresa
        )
      }

      /* Quem abriu o chamado, para aparecer com nome e e-mail. */
      if (chamadoAtual.criado_por) {
        const { data: autorData } = await supabase
          .from('profiles')
          .select('nome, email')
          .eq('id', chamadoAtual.criado_por)
          .maybeSingle()

        setSolicitante((autorData || null) as Solicitante | null)
      } else {
        setSolicitante(null)
      }

      const {
        data: mensagensData,
        error: mensagensError,
      } = await supabase
        .from('chamado_mensagens')
        .select(`
          id,
          chamado_id,
          autor_id,
          mensagem,
          created_at
        `)
        .eq(
          'chamado_id',
          chamadoId
        )
        .order('created_at', {
          ascending: true,
        })

      if (mensagensError) {
        console.error(
          'Erro ao carregar mensagens:',
          mensagensError
        )
      } else {
        const mensagensBase =
          mensagensData || []

        if (mensagensBase.length > 0) {
          const autorIds =
            Array.from(
              new Set(
                mensagensBase
                  .map(
                    (item) =>
                      item.autor_id
                  )
                  .filter(Boolean)
              )
            )

          const {
            data: perfisData,
            error: perfisError,
          } = await supabase
            .from('profiles')
            .select(
              'id, nome, perfil'
            )
            .in(
              'id',
              autorIds
            )

          if (perfisError) {
            console.error(
              'Erro ao carregar perfis:',
              perfisError
            )
          }

          const perfis =
            perfisData || []

          const mensagensFormatadas =
            mensagensBase.map(
              (item) => {
                const perfil =
                  perfis.find(
                    (p) =>
                      p.id ===
                      item.autor_id
                  )

                return {
                  id: item.id,
                  chamado_id:
                    item.chamado_id,
                  autor_id:
                    item.autor_id,
                  mensagem:
                    item.mensagem,
                  created_at:
                    item.created_at,
                  autor_nome:
                    perfil?.nome ||
                    'Usuário',
                  autor_perfil:
                    perfil?.perfil ||
                    'cliente',
                }
              }
            )

          setMensagens(
            mensagensFormatadas
          )
        } else {
          setMensagens([])
        }
      }

      const {
        data: anexosData,
        error: anexosError,
      } = await supabase
        .from('chamado_anexos')
        .select(`
          id,
          chamado_id,
          enviado_por,
          nome_arquivo,
          caminho_arquivo,
          tipo_arquivo,
          tamanho_bytes,
          created_at
        `)
        .eq(
          'chamado_id',
          chamadoId
        )
        .order('created_at', {
          ascending: true,
        })

      if (anexosError) {
        console.error(
          'Erro ao carregar anexos:',
          anexosError
        )
      } else {
        setAnexos(
          (anexosData || []) as Anexo[]
        )
      }

      const {
        data: linksData,
        error: linksError,
      } = await supabase
        .from('chamado_links')
        .select(
          'id, chamado_id, criado_por, titulo, url, created_at'
        )
        .eq('chamado_id', chamadoId)
        .order('created_at', {
          ascending: true,
        })

      if (linksError) {
        console.error(
          'Erro ao carregar links:',
          linksError
        )
      } else {
        setLinks((linksData || []) as ChamadoLink[])
      }
    } catch (error) {
      console.error(
        'Erro na Central de Atendimento:',
        error
      )

      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o chamado.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function adicionarLink(
    event: React.FormEvent
  ) {
    event.preventDefault()

    setErroLink('')

    const url = normalizarUrl(novoLinkUrl)

    if (!url) {
      setErroLink(
        'Informe um endereço válido. Exemplo: https://exemplo.com.br/pasta'
      )
      return
    }

    setSalvandoLink(true)

    const campos = {
      titulo: novoLinkTitulo.trim() || null,
      url,
    }

    const consulta = editandoLink
      ? supabase
          .from('chamado_links')
          .update(campos)
          .eq('id', editandoLink)
      : supabase.from('chamado_links').insert({
          ...campos,
          chamado_id: String(chamadoId),
          criado_por: meuId,
        })

    const { data, error } = await consulta
      .select(
        'id, chamado_id, criado_por, titulo, url, created_at'
      )
      .single()

    setSalvandoLink(false)

    if (error) {
      console.error(error)
      setErroLink(
        'Não foi possível salvar o link. Tente novamente.'
      )
      return
    }

    const salvo = data as ChamadoLink

    setLinks((atual) =>
      editandoLink
        ? atual.map((l) => (l.id === salvo.id ? salvo : l))
        : [...atual, salvo]
    )

    setEditandoLink(null)
    setNovoLinkTitulo('')
    setNovoLinkUrl('')
  }

  function editarLink(link: ChamadoLink) {
    setErroLink('')
    setEditandoLink(link.id)
    setNovoLinkTitulo(link.titulo || '')
    setNovoLinkUrl(link.url)
  }

  function cancelarEdicaoLink() {
    setEditandoLink(null)
    setNovoLinkTitulo('')
    setNovoLinkUrl('')
    setErroLink('')
  }

  async function removerLink(link: ChamadoLink) {
    setErroLink('')

    const { error } = await supabase
      .from('chamado_links')
      .delete()
      .eq('id', link.id)

    if (error) {
      console.error(error)
      setErroLink('Não foi possível remover o link.')
      return
    }

    setLinks((atual) => atual.filter((l) => l.id !== link.id))

    if (editandoLink === link.id) cancelarEdicaoLink()
  }

  async function salvarStatus() {
    if (!chamado) return

    if (
      novoStatus ===
      chamado.status
    ) {
      return
    }

    try {
      setSalvandoStatus(true)
      setErro('')

      const dadosAtualizacao: Record<
        string,
        string | null
      > = {
        status: novoStatus,
      }

      if (
        novoStatus === 'resolvido'
      ) {
        dadosAtualizacao.resolvido_em =
          new Date().toISOString()
      }

      if (
        novoStatus === 'encerrado'
      ) {
        dadosAtualizacao.encerrado_em =
          new Date().toISOString()
      }

      const {
        data,
        error,
      } = await supabase
        .from('chamados')
        .update(
          dadosAtualizacao
        )
        .eq(
          'id',
          chamado.id
        )
        .select(`
          id,
          numero,
          empresa_id,
          categoria,
          assunto,
          descricao,
          prioridade,
          status,
          responsavel_id,
          prazo_sla,
          sla_pausado_em,
          sla_pausa_total,
          primeira_resposta_em,
          resolvido_em,
          encerrado_em,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        console.error(
          'Erro ao alterar status:',
          error
        )

        throw error
      }

      setChamado(
        data as Chamado
      )

      setNovoStatus(
        data.status
      )

      avisar('status_alterado', chamado.id)
    } catch (error) {
      console.error(error)

      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar o status.'
      )

      setNovoStatus(
        chamado.status
      )
    } finally {
      setSalvandoStatus(false)
    }
  }

  async function salvarPrioridade() {
    if (!chamado) return

    if (
      novaPrioridade ===
      chamado.prioridade
    ) {
      return
    }

    try {
      setSalvandoPrioridade(true)
      setErro('')

      /*
       * Trocar a prioridade refaz o prazo, contado em horas uteis a
       * partir da abertura do chamado: 8 horas por dia, de segunda a
       * sexta.
       */
      const prazoRefeito = prazoEmHorasUteis(
        HORAS_SLA[novaPrioridade] ??
          HORAS_SLA.normal,
        new Date(chamado.created_at)
      ).toISOString()

      const {
        data,
        error,
      } = await supabase
        .from('chamados')
        .update({
          prioridade:
            novaPrioridade,
          prazo_sla: prazoRefeito,
        })
        .eq(
          'id',
          chamado.id
        )
        .select(`
          id,
          numero,
          empresa_id,
          categoria,
          assunto,
          descricao,
          prioridade,
          status,
          responsavel_id,
          prazo_sla,
          sla_pausado_em,
          sla_pausa_total,
          primeira_resposta_em,
          resolvido_em,
          encerrado_em,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        console.error(
          'Erro ao alterar prioridade:',
          error
        )

        throw error
      }

      setChamado(
        data as Chamado
      )

      setNovaPrioridade(
        data.prioridade
      )
    } catch (error) {
      console.error(error)

      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar a prioridade.'
      )

      setNovaPrioridade(
        chamado.prioridade
      )
    } finally {
      setSalvandoPrioridade(
        false
      )
    }
  }

  async function salvarResponsavel() {
    if (!chamado) return

    if (
      (novoResponsavel || null) ===
      (chamado.responsavel_id || null)
    ) {
      return
    }

    try {
      setSalvandoResponsavel(true)
      setErro('')

      const { data, error } = await supabase
        .from('chamados')
        .update({
          responsavel_id: novoResponsavel || null,
        })
        .eq('id', chamado.id)
        .select(`
          id,
          numero,
          empresa_id,
          categoria,
          assunto,
          descricao,
          prioridade,
          status,
          responsavel_id,
          prazo_sla,
          sla_pausado_em,
          sla_pausa_total,
          primeira_resposta_em,
          resolvido_em,
          encerrado_em,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        throw error
      }

      setChamado(data as Chamado)

      setNovoResponsavel(
        (data as Chamado).responsavel_id || ''
      )

      avisar('chamado_transferido', chamado.id)
    } catch (error) {
      console.error(error)

      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível transferir o chamado.'
      )

      setNovoResponsavel(
        chamado.responsavel_id || ''
      )
    } finally {
      setSalvandoResponsavel(false)
    }
  }

  async function enviarMensagem(
    event: React.FormEvent
  ) {
    event.preventDefault()

    if (
      !novaMensagem.trim()
    ) {
      return
    }

    try {
      setEnviando(true)
      setErro('')

      const texto = novaMensagem.trim()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          'chamado_mensagens'
        )
        .insert({
          chamado_id:
            chamadoId,
          autor_id:
            user.id,
          mensagem:
            novaMensagem.trim(),
        })
        .select(`
          id,
          chamado_id,
          autor_id,
          mensagem,
          created_at
        `)
        .single()

      if (error) {
        throw error
      }

      const {
        data: perfil,
      } = await supabase
        .from('profiles')
        .select(
          'nome, perfil'
        )
        .eq(
          'id',
          user.id
        )
        .single()

      setMensagens(
        (atual) => [
          ...atual,
          {
            id: data.id,
            chamado_id:
              data.chamado_id,
            autor_id:
              data.autor_id,
            mensagem:
              data.mensagem,
            created_at:
              data.created_at,
            autor_nome:
              perfil?.nome ||
              'Atendimento',
            autor_perfil:
              perfil?.perfil ||
              'atendimento',
          },
        ]
      )

      setNovaMensagem('')

      avisar('mensagem_nova', String(chamadoId), {
        mensagem: texto,
      })

      /*
       * Se o chamado ainda estiver aberto,
       * ao responder pelo atendimento ele passa
       * automaticamente para "Em atendimento".
       */
      if (
        chamado &&
        chamado.status === 'aberto'
      ) {
        const {
          data: chamadoAtualizado,
        } = await supabase
          .from('chamados')
          .update({
            status:
              'em_atendimento',
          })
          .eq(
            'id',
            chamado.id
          )
          .select(`
            id,
            numero,
            empresa_id,
            categoria,
            assunto,
            descricao,
            prioridade,
            status,
            prazo_sla,
            resolvido_em,
            encerrado_em,
            created_at,
            updated_at
          `)
          .single()

        if (
          chamadoAtualizado
        ) {
          setChamado(
            chamadoAtualizado as Chamado
          )

          setNovoStatus(
            chamadoAtualizado.status
          )
        }
      }
    } catch (error) {
      console.error(
        'Erro ao enviar mensagem:',
        error
      )

      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a mensagem.'
      )
    } finally {
      setEnviando(false)
    }
  }

  async function abrirAnexo(
    anexo: Anexo
  ) {
    try {
      setAbrindoAnexo(
        anexo.id
      )
      setErroAnexo('')

      const {
        data,
        error,
      } = await supabase.storage
        .from(
          'chamados-anexos'
        )
        .createSignedUrl(
          anexo.caminho_arquivo,
          300
        )

      if (
        error ||
        !data?.signedUrl
      ) {
        throw new Error(
          'Não foi possível gerar o acesso ao arquivo.'
        )
      }

      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      )
    } catch (error) {
      console.error(error)

      setErroAnexo(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o arquivo.'
      )
    } finally {
      setAbrindoAnexo(null)
    }
  }

  async function enviarAnexo(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const arquivo =
      event.target.files?.[0]

    event.target.value = ''

    if (!arquivo) {
      return
    }

    const limite =
      10 * 1024 * 1024

    if (
      arquivo.size >
      limite
    ) {
      setErroAnexo(
        'O arquivo é muito grande. O limite é 10 MB.'
      )
      return
    }

    try {
      setEnviandoAnexo(true)
      setErroAnexo('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const nomeSeguro =
        arquivo.name
          .normalize('NFD')
          .replace(
            /[\u0300-\u036f]/g,
            ''
          )
          .replace(
            /[^a-zA-Z0-9.*-]/g,
            '_'
          )

      const caminho =
        `${chamadoId}/${user.id}/${Date.now()}-${nomeSeguro}`

      const {
        error: uploadError,
      } = await supabase.storage
        .from(
          'chamados-anexos'
        )
        .upload(
          caminho,
          arquivo,
          {
            cacheControl:
              '3600',
            upsert: false,
            contentType:
              arquivo.type ||
              'application/octet-stream',
          }
        )

      if (uploadError) {
        throw uploadError
      }

      const {
        data: anexoData,
        error: anexoError,
      } = await supabase
        .from(
          'chamado_anexos'
        )
        .insert({
          chamado_id:
            chamadoId,
          enviado_por:
            user.id,
          nome_arquivo:
            arquivo.name,
          caminho_arquivo:
            caminho,
          tipo_arquivo:
            arquivo.type ||
            'application/octet-stream',
          tamanho_bytes:
            arquivo.size,
        })
        .select(`
          id,
          chamado_id,
          enviado_por,
          nome_arquivo,
          caminho_arquivo,
          tipo_arquivo,
          tamanho_bytes,
          created_at
        `)
        .single()

      if (anexoError) {
        await supabase.storage
          .from(
            'chamados-anexos'
          )
          .remove([
            caminho,
          ])

        throw anexoError
      }

      setAnexos(
        (atual) => [
          ...atual,
          anexoData as Anexo,
        ]
      )
    } catch (error) {
      console.error(
        'Erro ao enviar anexo:',
        error
      )

      setErroAnexo(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o arquivo.'
      )
    } finally {
      setEnviandoAnexo(
        false
      )
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight:
            'calc(100vh - 70px)',
          background:
            '#f8fafc',
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth:
              '1200px',
            margin:
              '0 auto',
            background:
              '#ffffff',
            border:
              '1px solid #e2e8f0',
            borderRadius:
              '14px',
            padding:
              '60px',
            textAlign:
              'center',
            color:
              '#64748b',
          }}
        >
          Carregando chamado...
        </div>
      </main>
    )
  }

  if (!chamado) {
    return (
      <main
        style={{
          minHeight:
            'calc(100vh - 70px)',
          background:
            '#f8fafc',
          padding:
            '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth:
              '700px',
            margin:
              '0 auto',
            background:
              '#ffffff',
            border:
              '1px solid #e2e8f0',
            borderRadius:
              '14px',
            padding:
              '40px',
          }}
        >
          <h1
            style={{
              marginTop: 0,
              color:
                '#0f172a',
            }}
          >
            Chamado não encontrado
          </h1>

          <p
            style={{
              color:
                '#64748b',
            }}
          >
            {erro ||
              'Não foi possível localizar este chamado.'}
          </p>

          <Link
            href="/atendimento"
            style={{
              display:
                'inline-block',
              background:
                '#0f766e',
              color:
                '#ffffff',
              textDecoration:
                'none',
              padding:
                '10px 16px',
              borderRadius:
                '9px',
              fontWeight:
                700,
            }}
          >
            Voltar para Central
          </Link>
        </div>
      </main>
    )
  }

  const statusStyle =
    corStatus(
      chamado.status
    )

  const prioridadeStyle =
    corPrioridade(
      chamado.prioridade
    )

  return (
    <main
      style={{
        minHeight:
          'calc(100vh - 70px)',
        background:
          'linear-gradient(180deg, #f0fdfa 0%, #f8fafc 35%)',
        padding:
          '32px 24px 60px',
      }}
    >
      <div
        style={{
          maxWidth:
            '1200px',
          margin:
            '0 auto',
        }}
      >
        <div
          style={{
            display:
              'flex',
            justifyContent:
              'space-between',
            alignItems:
              'flex-start',
            gap:
              '20px',
            marginBottom:
              '24px',
            flexWrap:
              'wrap',
          }}
        >
          <div>
            <Link
              href="/atendimento"
              style={{
                color:
                  '#0f766e',
                textDecoration:
                  'none',
                fontWeight:
                  700,
                fontSize:
                  '14px',
              }}
            >
              ← Voltar para Central
            </Link>

            <div
              style={{
                marginTop:
                  '16px',
                color:
                  '#0f766e',
                fontSize:
                  '13px',
                fontWeight:
                  800,
                textTransform:
                  'uppercase',
                letterSpacing:
                  '0.06em',
              }}
            >
              Atendimento interno
            </div>

            <h1
              style={{
                margin:
                  '6px 0 0',
                color:
                  '#0f172a',
                fontSize:
                  '30px',
                lineHeight:
                  1.2,
              }}
            >
              #{chamado.numero || '—'}{' '}
              — {chamado.assunto}
            </h1>

            <p
              style={{
                margin:
                  '8px 0 0',
                color:
                  '#64748b',
              }}
            >
              {empresa?.nome_fantasia ||
                'Empresa não identificada'}
            </p>
          </div>

          <div
            style={{
              display:
                'flex',
              gap:
                '10px',
              alignItems:
                'center',
              flexWrap:
                'wrap',
            }}
          >
            <span
              style={{
                padding:
                  '7px 12px',
                borderRadius:
                  '999px',
                background:
                  statusStyle.background,
                color:
                  statusStyle.color,
                fontWeight:
                  800,
                fontSize:
                  '13px',
              }}
            >
              {statusLabels[
                chamado.status
              ] || chamado.status}
            </span>

            <span
              style={{
                padding:
                  '7px 12px',
                borderRadius:
                  '999px',
                background:
                  prioridadeStyle.background,
                color:
                  prioridadeStyle.color,
                fontWeight:
                  800,
                fontSize:
                  '13px',
              }}
            >
              {prioridadeLabels[
                chamado.prioridade
              ] || chamado.prioridade}
            </span>
          </div>
        </div>

        {erro && (
          <div
            style={{
              background:
                '#fef2f2',
              border:
                '1px solid #fecaca',
              color:
                '#b91c1c',
              borderRadius:
                '12px',
              padding:
                '14px',
              marginBottom:
                '20px',
            }}
          >
            {erro}
          </div>
        )}

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'minmax(0, 1fr) 320px',
            gap:
              '20px',
            alignItems:
              'start',
          }}
        >
          <div
            style={{
              display:
                'grid',
              gap:
                '20px',
            }}
          >
            <section
              style={cardStyle}
            >
              <div
                style={cardHeaderStyle}
              >
                <h2
                  style={cardTitleStyle}
                >
                  Detalhes do chamado
                </h2>
              </div>

              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(150px, 1fr))',
                  gap:
                    '14px',
                  marginBottom:
                    '22px',
                }}
              >
                <Info
                  label="Empresa"
                  value={
                    empresa?.nome_fantasia ||
                    '—'
                  }
                />

                <Info
                  label="Aberto por"
                  value={
                    solicitante?.nome ||
                    solicitante?.email ||
                    '—'
                  }
                  detalhe={
                    solicitante?.nome
                      ? solicitante?.email || undefined
                      : undefined
                  }
                />

                <Info
                  label="Categoria"
                  value={
                    chamado.categoria
                  }
                />

                <Info
                  label="Abertura"
                  value={formatarData(
                    chamado.created_at
                  )}
                />

                <Info
                  label="Atualização"
                  value={formatarData(
                    chamado.updated_at
                  )}
                />

                <Info
                  label="Prazo SLA"
                  value={formatarData(
                    chamado.prazo_sla
                  )}
                />

                <Info
                  label="Encerramento"
                  value={formatarData(
                    chamado.encerrado_em
                  )}
                />
              </div>

              <div
                style={{
                  background:
                    '#f8fafc',
                  border:
                    '1px solid #e2e8f0',
                  borderRadius:
                    '10px',
                  padding:
                    '18px',
                }}
              >
                <div
                  style={{
                    color:
                      '#64748b',
                    fontSize:
                      '12px',
                    fontWeight:
                      800,
                    textTransform:
                      'uppercase',
                    marginBottom:
                      '8px',
                  }}
                >
                  Descrição
                </div>

                <p
                  style={{
                    margin:
                      0,
                    color:
                      '#334155',
                    whiteSpace:
                      'pre-wrap',
                    lineHeight:
                      1.6,
                  }}
                >
                  {chamado.descricao}
                </p>
              </div>
            </section>

            <section
              style={cardStyle}
            >
              <div
                style={cardHeaderStyle}
              >
                <h2
                  style={cardTitleStyle}
                >
                  Conversas
                </h2>

                <span
                  style={{
                    color:
                      '#64748b',
                    fontSize:
                      '13px',
                  }}
                >
                  {mensagens.length}{' '}
                  {mensagens.length === 1
                    ? 'mensagem'
                    : 'mensagens'}
                </span>
              </div>

              {mensagens.length === 0 ? (
                <div
                  style={{
                    padding:
                      '30px 0',
                    color:
                      '#64748b',
                    textAlign:
                      'center',
                  }}
                >
                  Ainda não existem mensagens neste chamado.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      'grid',
                    gap:
                      '16px',
                    marginBottom:
                      '20px',
                  }}
                >
                  {mensagens.map(
                    (mensagem) => {
                      const equipe =
                        mensagem.autor_perfil !==
                        'cliente'

                      return (
                        <div
                          key={
                            mensagem.id
                          }
                          style={{
                            display:
                              'flex',
                            gap:
                              '12px',
                            alignItems:
                              'flex-start',
                          }}
                        >
                          <div
                            style={{
                              width:
                                '38px',
                              height:
                                '38px',
                              borderRadius:
                                '50%',
                              background:
                                equipe
                                  ? '#ccfbf1'
                                  : '#dbeafe',
                              color:
                                equipe
                                  ? '#0f766e'
                                  : '#1d4ed8',
                              display:
                                'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              fontWeight:
                                800,
                              flexShrink:
                                0,
                            }}
                          >
                            {mensagem.autor_nome
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </div>

                          <div
                            style={{
                              flex:
                                1,
                            }}
                          >
                            <div
                              style={{
                                display:
                                  'flex',
                                gap:
                                  '8px',
                                alignItems:
                                  'center',
                                flexWrap:
                                  'wrap',
                                marginBottom:
                                  '6px',
                              }}
                            >
                              <strong
                                style={{
                                  color:
                                    '#0f172a',
                                }}
                              >
                                {
                                  mensagem.autor_nome
                                }
                              </strong>

                              <span
                                style={{
                                  padding:
                                    '3px 7px',
                                  borderRadius:
                                    '999px',
                                  background:
                                    equipe
                                      ? '#ccfbf1'
                                      : '#dbeafe',
                                  color:
                                    equipe
                                      ? '#0f766e'
                                      : '#1d4ed8',
                                  fontSize:
                                    '11px',
                                  fontWeight:
                                    800,
                                }}
                              >
                                {equipe
                                  ? 'Equipe'
                                  : 'Cliente'}
                              </span>

                              <span
                                style={{
                                  color:
                                    '#94a3b8',
                                  fontSize:
                                    '12px',
                                }}
                              >
                                {formatarData(
                                  mensagem.created_at
                                )}
                              </span>
                            </div>

                            <div
                              style={{
                                background:
                                  equipe
                                    ? '#f0fdfa'
                                    : '#f8fafc',
                                border:
                                  '1px solid #e2e8f0',
                                borderRadius:
                                  '10px',
                                padding:
                                  '13px 15px',
                                color:
                                  '#334155',
                                lineHeight:
                                  1.55,
                                whiteSpace:
                                  'pre-wrap',
                              }}
                            >
                              {
                                mensagem.mensagem
                              }
                            </div>
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              )}

              <form
                onSubmit={
                  enviarMensagem
                }
                style={{
                  borderTop:
                    '1px solid #e2e8f0',
                  paddingTop:
                    '18px',
                }}
              >
                <textarea
                  value={
                    novaMensagem
                  }
                  onChange={(
                    event
                  ) =>
                    setNovaMensagem(
                      event.target
                        .value
                    )
                  }
                  placeholder="Digite a resposta para o cliente..."
                  rows={4}
                  style={{
                    width:
                      '100%',
                    boxSizing:
                      'border-box',
                    resize:
                      'vertical',
                    border:
                      '1px solid #cbd5e1',
                    borderRadius:
                      '10px',
                    padding:
                      '12px',
                    fontSize:
                      '14px',
                    outline:
                      'none',
                  }}
                />

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'flex-end',
                    marginTop:
                      '10px',
                  }}
                >
                  <button
                    type="submit"
                    disabled={
                      enviando ||
                      !novaMensagem.trim()
                    }
                    style={{
                      border:
                        'none',
                      background:
                        enviando ||
                        !novaMensagem.trim()
                          ? '#94a3b8'
                          : '#0f766e',
                      color:
                        '#ffffff',
                      borderRadius:
                        '9px',
                      padding:
                        '10px 16px',
                      fontWeight:
                        800,
                      cursor:
                        enviando ||
                        !novaMensagem.trim()
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {enviando
                      ? 'Enviando...'
                      : 'Responder cliente'}
                  </button>
                </div>
              </form>
            </section>

            <section
              style={cardStyle}
            >
              <div
                style={cardHeaderStyle}
              >
                <h2
                  style={cardTitleStyle}
                >
                  Anexos
                </h2>

                <span
                  style={{
                    color:
                      '#64748b',
                    fontSize:
                      '13px',
                  }}
                >
                  {anexos.length}{' '}
                  arquivo(s)
                </span>
              </div>

              <div
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap:
                    '15px',
                  flexWrap:
                    'wrap',
                  background:
                    '#f0fdfa',
                  border:
                    '1px dashed #99f6e4',
                  borderRadius:
                    '10px',
                  padding:
                    '16px',
                  marginBottom:
                    '15px',
                }}
              >
                <div>
                  <strong
                    style={{
                      color:
                        '#0f172a',
                    }}
                  >
                    Adicionar arquivo
                  </strong>

                  <div
                    style={{
                      marginTop:
                        '4px',
                      color:
                        '#64748b',
                      fontSize:
                        '13px',
                    }}
                  >
                    Limite de 10 MB por arquivo.
                  </div>
                </div>

                <label
                  htmlFor="arquivo-atendimento"
                  style={{
                    display:
                      'inline-block',
                    background:
                      enviandoAnexo
                        ? '#94a3b8'
                        : '#0f766e',
                    color:
                      '#ffffff',
                    padding:
                      '9px 14px',
                    borderRadius:
                      '8px',
                    fontWeight:
                      700,
                    cursor:
                      enviandoAnexo
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {enviandoAnexo
                    ? 'Enviando...'
                    : 'Selecionar arquivo'}
                </label>

                <input
                  id="arquivo-atendimento"
                  type="file"
                  onChange={
                    enviarAnexo
                  }
                  disabled={
                    enviandoAnexo
                  }
                  style={{
                    display:
                      'none',
                  }}
                />
              </div>

              {erroAnexo && (
                <div
                  style={{
                    background:
                      '#fef2f2',
                    color:
                      '#b91c1c',
                    border:
                      '1px solid #fecaca',
                    borderRadius:
                      '9px',
                    padding:
                      '12px',
                    marginBottom:
                      '15px',
                  }}
                >
                  {erroAnexo}
                </div>
              )}

              {anexos.length === 0 ? (
                <div
                  style={{
                    padding:
                      '20px 0',
                    color:
                      '#64748b',
                  }}
                >
                  Nenhum arquivo anexado.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      'grid',
                    gap:
                      '10px',
                  }}
                >
                  {anexos.map(
                    (anexo) => (
                      <div
                        key={
                          anexo.id
                        }
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap:
                            '12px',
                          border:
                            '1px solid #e2e8f0',
                          borderRadius:
                            '10px',
                          padding:
                            '12px',
                        }}
                      >
                        <div
                          style={{
                            width:
                              '42px',
                            height:
                              '42px',
                            borderRadius:
                              '8px',
                            background:
                              '#f1f5f9',
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            fontSize:
                              '11px',
                            fontWeight:
                              800,
                            color:
                              '#475569',
                          }}
                        >
                          {iconeArquivo(
                            anexo.tipo_arquivo,
                            anexo.nome_arquivo
                          )}
                        </div>

                        <div
                          style={{
                            flex:
                              1,
                            minWidth:
                              0,
                          }}
                        >
                          <strong
                            style={{
                              display:
                                'block',
                              color:
                                '#0f172a',
                              overflow:
                                'hidden',
                              textOverflow:
                                'ellipsis',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {
                              anexo.nome_arquivo
                            }
                          </strong>

                          <span
                            style={{
                              color:
                                '#64748b',
                              fontSize:
                                '12px',
                            }}
                          >
                            {formatarTamanho(
                              anexo.tamanho_bytes
                            )}{' '}
                            •{' '}
                            {formatarData(
                              anexo.created_at
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            abrirAnexo(
                              anexo
                            )
                          }
                          disabled={
                            abrindoAnexo ===
                            anexo.id
                          }
                          style={{
                            border:
                              '1px solid #99f6e4',
                            background:
                              '#ffffff',
                            color:
                              '#0f766e',
                            borderRadius:
                              '8px',
                            padding:
                              '8px 12px',
                            cursor:
                              'pointer',
                            fontWeight:
                              700,
                          }}
                        >
                          {abrindoAnexo ===
                          anexo.id
                            ? 'Abrindo...'
                            : 'Abrir'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h2 style={cardTitleStyle}>
                  Links de acesso
                </h2>

                <span
                  style={{
                    color: '#64748b',
                    fontSize: '13px',
                  }}
                >
                  {links.length} link(s)
                </span>
              </div>

              <p
                style={{
                  color: '#64748b',
                  fontSize: '13px',
                  margin: '4px 0 14px',
                }}
              >
                Pastas compartilhadas, sistemas ou sites
                ligados a este chamado. Campo opcional.
              </p>

              <form
                onSubmit={adicionarLink}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(0,1fr) minmax(0,1.3fr) auto',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <input
                  type="text"
                  value={novoLinkTitulo}
                  onChange={(event) =>
                    setNovoLinkTitulo(event.target.value)
                  }
                  placeholder="Nome do link (opcional)"
                  maxLength={120}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                    color: '#0f172a',
                    outline: 'none',
                    width: '100%',
                  }}
                />

                <input
                  type="text"
                  value={novoLinkUrl}
                  onChange={(event) =>
                    setNovoLinkUrl(event.target.value)
                  }
                  placeholder="https://..."
                  maxLength={500}
                  inputMode="url"
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                    color: '#0f172a',
                    outline: 'none',
                    width: '100%',
                  }}
                />

                <button
                  type="submit"
                  disabled={
                    salvandoLink || !novoLinkUrl.trim()
                  }
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 18px',
                    background: '#0f766e',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    opacity:
                      salvandoLink || !novoLinkUrl.trim()
                        ? 0.6
                        : 1,
                    cursor:
                      salvandoLink || !novoLinkUrl.trim()
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {salvandoLink
                    ? 'Salvando...'
                    : editandoLink
                      ? 'Salvar'
                      : 'Adicionar'}
                </button>
              </form>

              {editandoLink && (
                <button
                  type="button"
                  onClick={cancelarEdicaoLink}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#64748b',
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: 12,
                  }}
                >
                  Cancelar edição
                </button>
              )}

              {erroLink && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  {erroLink}
                </div>
              )}

              {links.length === 0 ? (
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 14,
                    padding: '12px 0',
                  }}
                >
                  Nenhum link cadastrado neste chamado.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  {links.map((link) => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '10px 12px',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>
                        ⛓
                      </span>

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            display: 'block',
                            fontSize: 14,
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {rotuloDoLink(link)}
                        </strong>

                        <span
                          style={{
                            fontSize: 12,
                            color: '#64748b',
                          }}
                        >
                          {new Date(
                            link.created_at
                          ).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{
                          border: '1px solid #99f6e4',
                          background: '#ffffff',
                          color: '#0f766e',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontWeight: 700,
                          fontSize: 13,
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Abrir
                      </a>

                      <button
                        type="button"
                        onClick={() => editarLink(link)}
                        style={{
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#0f172a',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => removerLink(link)}
                        style={{
                          border: '1px solid #fecaca',
                          background: '#ffffff',
                          color: '#b91c1c',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={cardStyle}>
              <h2 style={cardTitleStyle}>Histórico e SLA</h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(150px,1fr))',
                  gap: 12,
                  margin: '16px 0 22px',
                }}
              >
                <BlocoSla
                  rotulo="Primeira resposta"
                  valor={
                    duracao(
                      chamado.created_at,
                      chamado.primeira_resposta_em
                    ) || 'ainda não'
                  }
                  alerta={!chamado.primeira_resposta_em}
                />

                <BlocoSla
                  rotulo="Tempo até resolver"
                  valor={
                    duracao(
                      chamado.created_at,
                      chamado.resolvido_em || chamado.encerrado_em
                    ) || 'em andamento'
                  }
                />

                <BlocoSla
                  rotulo="Espera do cliente"
                  valor={
                    horasDoIntervalo(chamado.sla_pausa_total) > 0
                      ? horasDoIntervalo(chamado.sla_pausa_total)
                          .toFixed(1)
                          .replace('.0', '') + ' h'
                      : '—'
                  }
                />

                <BlocoSla
                  rotulo="Prazo"
                  valor={
                    chamado.sla_pausado_em
                      ? 'pausado'
                      : chamado.prazo_sla
                        ? new Date(chamado.prazo_sla).toLocaleString('pt-BR')
                        : 'sem SLA'
                  }
                  alerta={
                    !chamado.sla_pausado_em &&
                    Boolean(chamado.prazo_sla) &&
                    new Date(chamado.prazo_sla as string).getTime() <
                      Date.now() &&
                    !chamado.resolvido_em &&
                    !chamado.encerrado_em
                  }
                />
              </div>

              {eventos.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                  Nenhum movimento registrado ainda.
                </p>
              ) : (
                <div
                  style={{
                    borderLeft: '2px solid #e2e8f0',
                    paddingLeft: 16,
                    display: 'grid',
                    gap: 14,
                  }}
                >
                  {eventos.map((e) => (
                    <div key={e.id} style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: -22,
                          top: 5,
                          width: 9,
                          height: 9,
                          borderRadius: 999,
                          background:
                            e.tipo === 'sla' ? '#b45309' : '#0f766e',
                        }}
                      />

                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        {descreverEvento(e)}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginTop: 2,
                        }}
                      >
                        {new Date(e.created_at).toLocaleString('pt-BR')}
                        {e.autor?.nome ? ' · ' + e.autor.nome : ''}
                      </div>

                      {e.observacao && (
                        <div
                          style={{
                            fontSize: 13,
                            color: '#475569',
                            marginTop: 3,
                          }}
                        >
                          {e.observacao}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside
            style={{
              display:
                'grid',
              gap:
                '20px',
            }}
          >
            <section
              style={cardStyle}
            >
              <h2
                style={{
                  ...cardTitleStyle,
                  marginBottom:
                    '18px',
                }}
              >
                Gestão do chamado
              </h2>

              <label
                style={labelStyle}
              >
                Status
              </label>

              <select
                value={
                  novoStatus
                }
                onChange={(
                  event
                ) =>
                  setNovoStatus(
                    event.target
                      .value
                  )
                }
                style={
                  selectStyle
                }
              >
                <option value="aberto">
                  Aberto
                </option>

                <option value="em_atendimento">
                  Em atendimento
                </option>

                <option value="aguardando_cliente">
                  Aguardando cliente
                </option>

                <option value="resolvido">
                  Resolvido
                </option>

                <option value="encerrado">
                  Encerrado
                </option>
              </select>

              <button
                type="button"
                onClick={
                  salvarStatus
                }
                disabled={
                  salvandoStatus ||
                  novoStatus ===
                    chamado.status
                }
                style={{
                  ...saveButtonStyle,
                  opacity:
                    salvandoStatus ||
                    novoStatus ===
                      chamado.status
                      ? 0.55
                      : 1,
                }}
              >
                {salvandoStatus
                  ? 'Salvando...'
                  : 'Salvar status'}
              </button>

              <div
                style={{
                  height:
                    '1px',
                  background:
                    '#e2e8f0',
                  margin:
                    '20px 0',
                }}
              />

              <label
                style={
                  labelStyle
                }
              >
                Prioridade
              </label>

              <select
                value={
                  novaPrioridade
                }
                onChange={(
                  event
                ) =>
                  setNovaPrioridade(
                    event.target
                      .value
                  )
                }
                style={
                  selectStyle
                }
              >
                <option value="baixa">
                  Baixa
                </option>

                <option value="normal">
                  Normal
                </option>

                <option value="media">
                  Média
                </option>

                <option value="alta">
                  Alta
                </option>

                <option value="urgente">
                  Urgente
                </option>
              </select>

              <button
                type="button"
                onClick={
                  salvarPrioridade
                }
                disabled={
                  salvandoPrioridade ||
                  novaPrioridade ===
                    chamado.prioridade
                }
                style={{
                  ...saveButtonStyle,
                  opacity:
                    salvandoPrioridade ||
                    novaPrioridade ===
                      chamado.prioridade
                      ? 0.55
                      : 1,
                }}
              >
                {salvandoPrioridade
                  ? 'Salvando...'
                  : 'Salvar prioridade'}
              </button>

              <div
                style={{
                  height: '1px',
                  background: '#e2e8f0',
                  margin: '20px 0',
                }}
              />

              <label style={labelStyle}>
                Responsável
              </label>

              <select
                value={novoResponsavel}
                onChange={(event) =>
                  setNovoResponsavel(
                    event.target.value
                  )
                }
                style={selectStyle}
              >
                <option value="">
                  Sem responsável
                </option>

                {agentes.map((agente) => (
                  <option
                    key={agente.id}
                    value={agente.id}
                  >
                    {agente.nome || 'Sem nome'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={salvarResponsavel}
                disabled={
                  salvandoResponsavel ||
                  (novoResponsavel || null) ===
                    (chamado.responsavel_id || null)
                }
                style={{
                  ...saveButtonStyle,
                  opacity:
                    salvandoResponsavel ||
                    (novoResponsavel || null) ===
                      (chamado.responsavel_id || null)
                      ? 0.55
                      : 1,
                }}
              >
                {salvandoResponsavel
                  ? 'Transferindo...'
                  : 'Transferir chamado'}
              </button>
            </section>

            <section
              style={cardStyle}
            >
              <h2
                style={{
                  ...cardTitleStyle,
                  marginBottom:
                    '18px',
                }}
              >
                Resumo
              </h2>

              <Info
                label="Número"
                value={
                  chamado.numero
                    ? `#${chamado.numero}`
                    : '—'
                }
              />

              <div
                style={{
                  height:
                    '12px',
                }}
              />

              <Info
                label="Empresa"
                value={
                  empresa?.nome_fantasia ||
                  '—'
                }
              />

              <div
                style={{
                  height:
                    '12px',
                }}
              />

              <Info
                label="Marca"
                value={
                  empresa?.marca ||
                  '—'
                }
              />

              <div
                style={{
                  height:
                    '12px',
                }}
              />

              <Info
                label="Categoria"
                value={
                  chamado.categoria
                }
              />

              <div
                style={{
                  height:
                    '12px',
                }}
              />

              <Info
                label="Prazo SLA"
                value={formatarData(
                  chamado.prazo_sla
                )}
              />
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function Info({
  label,
  value,
  detalhe,
}: {
  label: string
  value: string
  detalhe?: string
}) {
  return (
    <div>
      <div
        style={{
          color:
            '#64748b',
          fontSize:
            '11px',
          fontWeight:
            800,
          textTransform:
            'uppercase',
          letterSpacing:
            '0.04em',
          marginBottom:
            '4px',
        }}
      >
        {label}
      </div>

      <div
        style={{
          color:
            '#0f172a',
          fontSize:
            '14px',
          fontWeight:
            600,
        }}
      >
        {value}
      </div>

      {detalhe && (
        <div
          style={{
            color: '#64748b',
            fontSize: '12px',
            marginTop: '2px',
            wordBreak: 'break-all',
          }}
        >
          {detalhe}
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background:
    '#ffffff',
  border:
    '1px solid #e2e8f0',
  borderRadius:
    '14px',
  padding:
    '20px',
  boxShadow:
    '0 1px 2px rgba(15, 23, 42, 0.04)',
}

const cardHeaderStyle: React.CSSProperties = {
  display:
    'flex',
  justifyContent:
    'space-between',
  alignItems:
    'center',
  gap:
    '12px',
  marginBottom:
    '18px',
}

const cardTitleStyle: React.CSSProperties = {
  margin:
    0,
  color:
    '#0f172a',
  fontSize:
    '18px',
}

const labelStyle: React.CSSProperties = {
  display:
    'block',
  color:
    '#475569',
  fontSize:
    '12px',
  fontWeight:
    800,
  marginBottom:
    '7px',
}

const selectStyle: React.CSSProperties = {
  width:
    '100%',
  boxSizing:
    'border-box',
  border:
    '1px solid #cbd5e1',
  borderRadius:
    '9px',
  padding:
    '10px 12px',
  fontSize:
    '14px',
  color:
    '#0f172a',
  background:
    '#ffffff',
}

const saveButtonStyle: React.CSSProperties = {
  width:
    '100%',
  border:
    'none',
  background:
    '#0f766e',
  color:
    '#ffffff',
  borderRadius:
    '9px',
  padding:
    '10px 12px',
  fontWeight:
    800,
  cursor:
    'pointer',
  marginTop:
    '9px',
}

function BlocoSla({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string
  valor: string
  alerta?: boolean
}) {
  return (
    <div
      style={{
        border: '1px solid ' + (alerta ? '#fecaca' : '#e2e8f0'),
        background: alerta ? '#fef2f2' : '#f8fafc',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: '#64748b',
          fontWeight: 700,
        }}
      >
        {rotulo}
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: alerta ? '#b91c1c' : '#0f172a',
          marginTop: 4,
        }}
      >
        {valor}
      </div>
    </div>
  )
}
