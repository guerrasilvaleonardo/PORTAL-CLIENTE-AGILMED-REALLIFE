'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { avisar } from '@/lib/avisar'
import { normalizarUrl, rotuloDoLink } from '@/lib/links'
import type { ChamadoLink } from '@/lib/links'
import type { Marca } from '@/lib/marca'

type Chamado = {
  id: string
  numero: number
  categoria: string
  assunto: string
  descricao: string
  prioridade: string
  status: string
  criado_por: string | null
  prazo_sla: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  avaliacao: number | null
  comentario_avaliacao: string | null
  created_at: string
  updated_at: string
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
  alta: 'Alta',
  urgente: 'Urgente',
}

const identidade = {
  agilmed: {
    principal: '#2563eb',
    fundo: '#eff6ff',
    fundoForte: '#dbeafe',
    borda: '#bfdbfe',
  },

  reallife: {
    principal: '#0f766e',
    fundo: '#f0fdfa',
    fundoForte: '#ccfbf1',
    borda: '#99f6e4',
  },
} as const

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

function nomeArquivoSeguro(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.*-]/g, '*')
}

function iconeArquivo(tipo: string | null, nome: string) {
  const extensao = nome.split('.').pop()?.toLowerCase()

  if (tipo?.includes('pdf') || extensao === 'pdf') return 'PDF'

  if (
    tipo?.includes('image') ||
    ['jpg', 'jpeg', 'png', 'webp'].includes(extensao || '')
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
    ['xls', 'xlsx', 'csv'].includes(extensao || '')
  ) {
    return 'XLS'
  }

  return 'ARQ'
}

export default function DetalhesChamadoPage() {
  const params = useParams()
  const router = useRouter()

  const chamadoId = Array.isArray(params.id) ? params.id[0] : params.id

  const [chamado, setChamado] = useState<Chamado | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [links, setLinks] = useState<ChamadoLink[]>([])
  const [solicitante, setSolicitante] = useState<{
    nome: string | null
    email: string | null
  } | null>(null)
  const [editandoLink, setEditandoLink] = useState<string | null>(null)

  const [usuarioId, setUsuarioId] = useState('')

  const [novoLinkTitulo, setNovoLinkTitulo] = useState('')
  const [novoLinkUrl, setNovoLinkUrl] = useState('')
  const [salvandoLink, setSalvandoLink] = useState(false)
  const [erroLink, setErroLink] = useState('')

  const [novaMensagem, setNovaMensagem] = useState('')

  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)

  const [abrindoAnexo, setAbrindoAnexo] = useState<string | null>(null)

  const [erro, setErro] = useState('')
  const [erroAnexo, setErroAnexo] = useState('')

  const [marca, setMarca] = useState<Marca | null>(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro('')

      const marcaEmpresa = await obterMarcaDaEmpresa()
      setMarca(marcaEmpresa)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUsuarioId(user.id)

      const { data: chamadoData, error: chamadoError } = await supabase
        .from('chamados')
        .select(
          'id, numero, categoria, assunto, descricao, prioridade, status, criado_por, prazo_sla, resolvido_em, encerrado_em, avaliacao, comentario_avaliacao, created_at, updated_at'
        )
        .eq('id', chamadoId)
        .single()

      if (chamadoError) {
        console.error(chamadoError)
        setErro('Não foi possível carregar o chamado.')
        setLoading(false)
        return
      }

      setChamado(chamadoData as Chamado)

      const { data: mensagensData, error: mensagensError } =
        await supabase
          .from('chamado_mensagens')
          .select('id, chamado_id, autor_id, mensagem, created_at')
          .eq('chamado_id', chamadoId)
          .order('created_at', { ascending: true })

      if (mensagensError) {
        console.error(mensagensError)
        setErro(
          'O chamado foi carregado, mas não foi possível carregar as mensagens.'
        )
      } else {
        const mensagensBase = mensagensData ?? []

        if (mensagensBase.length > 0) {
          const autorIds = [
            ...new Set(
              mensagensBase.map((item) => item.autor_id).filter(Boolean)
            ),
          ]

          const { data: perfisData, error: perfisError } = await supabase
            .from('profiles')
            .select('id, nome, perfil')
            .in('id', autorIds)

          if (perfisError) {
            console.error(perfisError)
          }

          const perfis = perfisData ?? []

          const mensagensFormatadas: Mensagem[] = mensagensBase.map(
            (item) => {
              const perfil = perfis.find(
                (p) => p.id === item.autor_id
              )

              return {
                id: item.id,
                chamado_id: item.chamado_id,
                autor_id: item.autor_id,
                mensagem: item.mensagem,
                created_at: item.created_at,
                autor_nome: perfil?.nome || 'Usuário',
                autor_perfil: perfil?.perfil || 'cliente',
              }
            }
          )

          setMensagens(mensagensFormatadas)
        } else {
          setMensagens([])
        }
      }

      const { data: anexosData, error: anexosError } = await supabase
        .from('chamado_anexos')
        .select(
          'id, chamado_id, enviado_por, nome_arquivo, caminho_arquivo, tipo_arquivo, tamanho_bytes, created_at'
        )
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: true })

      if (anexosError) {
        console.error(anexosError)
        setErroAnexo(
          'Não foi possível carregar os anexos deste chamado.'
        )
        setAnexos([])
      } else {
        setAnexos((anexosData ?? []) as Anexo[])
      }

      const { data: linksData, error: linksError } = await supabase
        .from('chamado_links')
        .select('id, chamado_id, criado_por, titulo, url, created_at')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: true })

      if (linksError) {
        console.error(linksError)
        setLinks([])
      } else {
        setLinks((linksData ?? []) as ChamadoLink[])
      }

      /* Quem abriu o chamado, com nome e e-mail. */
      if (chamadoData?.criado_por) {
        const { data: autorData } = await supabase
          .from('profiles')
          .select('nome, email')
          .eq('id', chamadoData.criado_por)
          .maybeSingle()

        setSolicitante(
          (autorData || null) as {
            nome: string | null
            email: string | null
          } | null
        )
      } else {
        setSolicitante(null)
      }

      setLoading(false)
    }

    if (chamadoId) {
      carregar()
    }
  }, [chamadoId, router])

  async function enviarMensagem(event: React.FormEvent) {
    event.preventDefault()

    if (!novaMensagem.trim()) return

    setEnviando(true)
    setErro('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('chamado_mensagens')
      .insert({
        chamado_id: chamadoId,
        autor_id: user.id,
        mensagem: novaMensagem.trim(),
      })
      .select('id, chamado_id, autor_id, mensagem, created_at')
      .single()

    if (error) {
      console.error(error)
      setErro('Não foi possível enviar a mensagem.')
      setEnviando(false)
      return
    }

    const { data: perfil } = await supabase
      .from('profiles')
      .select('nome, perfil')
      .eq('id', user.id)
      .single()

    const mensagemFormatada: Mensagem = {
      id: data.id,
      chamado_id: data.chamado_id,
      autor_id: data.autor_id,
      mensagem: data.mensagem,
      created_at: data.created_at,
      autor_nome: perfil?.nome || 'Você',
      autor_perfil: perfil?.perfil || 'cliente',
    }

    setMensagens((atual) => [...atual, mensagemFormatada])

    avisar('mensagem_nova', String(chamadoId), {
      mensagem: data.mensagem,
    })

    setNovaMensagem('')
    setEnviando(false)
  }

  async function enviarAnexo(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const arquivo = event.target.files?.[0]

    event.target.value = ''

    if (!arquivo) return

    setErroAnexo('')

    const limite = 10 * 1024 * 1024

    if (arquivo.size > limite) {
      setErroAnexo(
        'O arquivo é muito grande. O tamanho máximo permitido é 10 MB.'
      )
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setEnviandoAnexo(true)

    try {
      const nomeSeguro = nomeArquivoSeguro(arquivo.name)

      const caminho = `${chamadoId}/${user.id}/${Date.now()}-${nomeSeguro}`

      const { error: uploadError } = await supabase.storage
        .from('chamados-anexos')
        .upload(caminho, arquivo, {
          cacheControl: '3600',
          upsert: false,
          contentType: arquivo.type || 'application/octet-stream',
        })

      if (uploadError) {
        console.error(uploadError)
        setErroAnexo(
          'Não foi possível enviar o arquivo. Tente novamente.'
        )
        return
      }

      const { data: anexoData, error: anexoError } = await supabase
        .from('chamado_anexos')
        .insert({
          chamado_id: chamadoId,
          enviado_por: user.id,
          nome_arquivo: arquivo.name,
          caminho_arquivo: caminho,
          tipo_arquivo:
            arquivo.type || 'application/octet-stream',
          tamanho_bytes: arquivo.size,
        })
        .select(
          'id, chamado_id, enviado_por, nome_arquivo, caminho_arquivo, tipo_arquivo, tamanho_bytes, created_at'
        )
        .single()

      if (anexoError) {
        console.error(anexoError)

        await supabase.storage
          .from('chamados-anexos')
          .remove([caminho])

        setErroAnexo(
          'O arquivo não pôde ser registrado no chamado.'
        )

        return
      }

      setAnexos((atual) => [...atual, anexoData as Anexo])
    } catch (error) {
      console.error(error)
      setErroAnexo(
        'Ocorreu um erro ao enviar o arquivo.'
      )
    } finally {
      setEnviandoAnexo(false)
    }
  }

  async function adicionarLink(event: React.FormEvent) {
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
          chamado_id: chamadoId,
          criado_por: usuarioId,
        })

    const { data, error } = await consulta
      .select('id, chamado_id, criado_por, titulo, url, created_at')
      .single()

    setSalvandoLink(false)

    if (error) {
      console.error(error)
      setErroLink('Não foi possível salvar o link. Tente novamente.')
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

  async function abrirAnexo(anexo: Anexo) {
    setAbrindoAnexo(anexo.id)
    setErroAnexo('')

    try {
      const { data, error } = await supabase.storage
        .from('chamados-anexos')
        .createSignedUrl(anexo.caminho_arquivo, 300)

      if (error || !data?.signedUrl) {
        console.error(error)
        setErroAnexo(
          'Não foi possível abrir este arquivo.'
        )
        return
      }

      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      )
    } catch (error) {
      console.error(error)
      setErroAnexo(
        'Não foi possível abrir este arquivo.'
      )
    } finally {
      setAbrindoAnexo(null)
    }
  }

  if (!marca) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loading}>
            <div style={styles.loadingSpinner} />
            Carregando...
          </div>
        </div>
      </main>
    )
  }

  const tema = identidade[marca]

  if (loading) {
    return (
      <main
        style={{
          ...styles.page,
          background: `linear-gradient(180deg, ${tema.fundo} 0%, #f5f7fa 38%)`,
        }}
      >
        <div style={styles.container}>
          <div style={styles.loading}>
            <div
              style={{
                ...styles.loadingSpinner,
                borderColor: tema.borda,
                borderTopColor: tema.principal,
              }}
            />
            Carregando chamado...
          </div>
        </div>
      </main>
    )
  }

  if (!chamado) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.errorCard}>
            <h1 style={styles.errorTitle}>
              Chamado não encontrado
            </h1>

            <p style={styles.errorText}>
              {erro ||
                'Não foi possível localizar este chamado.'}
            </p>

            <Link
              href="/chamados"
              style={{
                ...styles.primaryButton,
                background: tema.principal,
              }}
            >
              Voltar para chamados
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        ...styles.page,
        background: `linear-gradient(180deg, ${tema.fundo} 0%, #f5f7fa 34%)`,
      }}
    >
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div>
            <Link
              href="/chamados"
              style={styles.backLink}
            >
              ← Voltar para chamados
            </Link>

            <div
              style={{
                ...styles.eyebrow,
                color: tema.principal,
              }}
            >
              CHAMADO #{chamado.numero}
            </div>

            <h1 style={styles.title}>
              {chamado.assunto}
            </h1>

            <p style={styles.subtitle}>
              Acompanhe o andamento e converse com nossa
              equipe.
            </p>
          </div>

          <Link
            href="/chamados/novo"
            style={{
              ...styles.primaryButton,
              background: tema.principal,
            }}
          >
            + Novo chamado
          </Link>
        </div>

        {erro && (
          <div style={styles.warning}>
            {erro}
          </div>
        )}

        <section style={styles.grid}>
          <div style={styles.mainColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  Detalhes do chamado
                </h2>

                <span
                  style={{
                    ...styles.statusBadge,
                    ...statusStyle(chamado.status),
                  }}
                >
                  {statusLabels[chamado.status] ||
                    chamado.status}
                </span>
              </div>

              <div style={styles.infoGrid}>
                <Info
                  label="Categoria"
                  value={chamado.categoria}
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
                  label="Prioridade"
                  value={
                    prioridadeLabels[
                      chamado.prioridade
                    ] || chamado.prioridade
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

              <div style={styles.descriptionBox}>
                <div style={styles.label}>
                  Descrição
                </div>

                <p style={styles.description}>
                  {chamado.descricao}
                </p>
              </div>

              {chamado.avaliacao && (
                <div style={styles.evaluationBox}>
                  <div style={styles.label}>
                    Avaliação
                  </div>

                  <div style={styles.stars}>
                    {'★'.repeat(chamado.avaliacao)}
                    {'☆'.repeat(
                      5 - chamado.avaliacao
                    )}
                  </div>

                  {chamado.comentario_avaliacao && (
                    <p style={styles.description}>
                      {chamado.comentario_avaliacao}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  Anexos
                </h2>

                <span style={styles.messageCount}>
                  {anexos.length}{' '}
                  {anexos.length === 1
                    ? 'arquivo'
                    : 'arquivos'}
                </span>
              </div>

              <div
                style={{
                  ...styles.uploadArea,
                  borderColor: tema.borda,
                  background: tema.fundo,
                }}
              >
                <div
                  style={{
                    ...styles.uploadIcon,
                    background: tema.fundoForte,
                    color: tema.principal,
                  }}
                >
                  ↑
                </div>

                <div style={styles.uploadContent}>
                  <strong style={styles.uploadTitle}>
                    Enviar arquivo
                  </strong>

                  <p style={styles.uploadText}>
                    Anexe documentos, imagens ou outros
                    arquivos relacionados ao chamado.
                  </p>

                  <p style={styles.uploadLimit}>
                    Tamanho máximo: 10 MB por arquivo.
                  </p>

                  <label
                    htmlFor="arquivo-chamado"
                    style={{
                      ...styles.uploadButton,
                      background: tema.principal,
                      ...(enviandoAnexo
                        ? styles.disabledButton
                        : {}),
                    }}
                  >
                    {enviandoAnexo
                      ? 'Enviando arquivo...'
                      : 'Selecionar arquivo'}
                  </label>

                  <input
                    id="arquivo-chamado"
                    type="file"
                    onChange={enviarAnexo}
                    disabled={enviandoAnexo}
                    style={styles.hiddenInput}
                  />
                </div>
              </div>

              {erroAnexo && (
                <div style={styles.attachmentError}>
                  {erroAnexo}
                </div>
              )}

              {anexos.length === 0 ? (
                <div style={styles.emptyAttachments}>
                  Ainda não existem arquivos anexados a este
                  chamado.
                </div>
              ) : (
                <div style={styles.attachmentList}>
                  {anexos.map((anexo) => (
                    <div
                      key={anexo.id}
                      style={styles.attachmentItem}
                    >
                      <div style={styles.fileIcon}>
                        {iconeArquivo(
                          anexo.tipo_arquivo,
                          anexo.nome_arquivo
                        )}
                      </div>

                      <div style={styles.fileInfo}>
                        <strong style={styles.fileName}>
                          {anexo.nome_arquivo}
                        </strong>

                        <span style={styles.fileMeta}>
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
                          abrirAnexo(anexo)
                        }
                        disabled={
                          abrindoAnexo === anexo.id
                        }
                        style={{
                          ...styles.openFileButton,
                          borderColor: tema.borda,
                          color: tema.principal,
                          ...(abrindoAnexo ===
                          anexo.id
                            ? styles.disabledButton
                            : {}),
                        }}
                      >
                        {abrindoAnexo === anexo.id
                          ? 'Abrindo...'
                          : 'Abrir'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  Links de acesso
                </h2>

                <span style={styles.messageCount}>
                  {links.length}{' '}
                  {links.length === 1 ? 'link' : 'links'}
                </span>
              </div>

              <p style={styles.uploadText}>
                Endereços de pastas compartilhadas, sistemas ou
                sites relacionados ao chamado. Campo opcional.
              </p>

              <form
                onSubmit={adicionarLink}
                style={styles.linkForm}
              >
                <input
                  type="text"
                  value={novoLinkTitulo}
                  onChange={(event) =>
                    setNovoLinkTitulo(event.target.value)
                  }
                  placeholder="Nome do link (opcional)"
                  maxLength={120}
                  style={styles.linkInput}
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
                  style={styles.linkInput}
                />

                <button
                  type="submit"
                  disabled={salvandoLink || !novoLinkUrl.trim()}
                  style={{
                    ...styles.linkButton,
                    background: tema.principal,
                    ...(salvandoLink || !novoLinkUrl.trim()
                      ? styles.disabledButton
                      : {}),
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
                <div style={styles.attachmentError}>
                  {erroLink}
                </div>
              )}

              {links.length === 0 ? (
                <div style={styles.emptyAttachments}>
                  Nenhum link cadastrado neste chamado.
                </div>
              ) : (
                <div style={styles.attachmentList}>
                  {links.map((link) => (
                    <div
                      key={link.id}
                      style={styles.attachmentItem}
                    >
                      <div style={styles.fileIcon}>⛓</div>

                      <div style={styles.fileInfo}>
                        <strong style={styles.fileName}>
                          {rotuloDoLink(link)}
                        </strong>

                        <span style={styles.fileMeta}>
                          {formatarData(link.created_at)}
                        </span>
                      </div>

                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{
                          ...styles.openFileButton,
                          borderColor: tema.borda,
                          color: tema.principal,
                          textDecoration: 'none',
                        }}
                      >
                        Abrir
                      </a>

                      <button
                        type="button"
                        onClick={() => editarLink(link)}
                        style={{
                          ...styles.openFileButton,
                          borderColor: '#e2e8f0',
                          color: '#0f172a',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => removerLink(link)}
                        style={{
                          ...styles.openFileButton,
                          borderColor: '#fecaca',
                          color: '#b91c1c',
                          cursor: 'pointer',
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  Conversas
                </h2>

                <span style={styles.messageCount}>
                  {mensagens.length}{' '}
                  {mensagens.length === 1
                    ? 'mensagem'
                    : 'mensagens'}
                </span>
              </div>

              {mensagens.length === 0 ? (
                <div style={styles.emptyMessages}>
                  Ainda não existem mensagens neste chamado.
                </div>
              ) : (
                <div style={styles.messageList}>
                  {mensagens.map((mensagem) => (
                    <div
                      key={mensagem.id}
                      style={styles.messageItem}
                    >
                      <div
                        style={{
                          ...styles.messageAvatar,
                          background: tema.fundoForte,
                          color: tema.principal,
                        }}
                      >
                        {mensagem.autor_nome
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div style={styles.messageContent}>
                        <div style={styles.messageMeta}>
                          <strong>
                            {mensagem.autor_nome}
                          </strong>

                          <span
                            style={styles.profileTag}
                          >
                            {mensagem.autor_perfil ===
                            'cliente'
                              ? 'Cliente'
                              : 'Equipe'}
                          </span>

                          <span
                            style={styles.messageDate}
                          >
                            {formatarData(
                              mensagem.created_at
                            )}
                          </span>
                        </div>

                        <div
                          style={{
                            ...styles.messageBubble,
                            background: tema.fundo,
                          }}
                        >
                          {mensagem.mensagem}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={enviarMensagem}
                style={styles.messageForm}
              >
                <textarea
                  value={novaMensagem}
                  onChange={(event) =>
                    setNovaMensagem(
                      event.target.value
                    )
                  }
                  placeholder="Digite sua mensagem..."
                  rows={4}
                  style={styles.textarea}
                />

                <div style={styles.formFooter}>
                  <span style={styles.helper}>
                    Envie uma mensagem para continuar
                    o atendimento.
                  </span>

                  <button
                    type="submit"
                    disabled={
                      enviando ||
                      !novaMensagem.trim()
                    }
                    style={{
                      ...styles.primaryButton,
                      background: tema.principal,
                      ...(enviando ||
                      !novaMensagem.trim()
                        ? styles.disabledButton
                        : {}),
                    }}
                  >
                    {enviando
                      ? 'Enviando...'
                      : 'Enviar mensagem'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <aside style={styles.sideColumn}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                Andamento
              </h2>

              <div style={styles.timeline}>
                <TimelineItem
                  title="Chamado aberto"
                  date={formatarData(
                    chamado.created_at
                  )}
                  active
                  tema={tema}
                />

                <TimelineItem
                  title="Em atendimento"
                  active={
                    chamado.status ===
                      'em_atendimento' ||
                    chamado.status ===
                      'aguardando_cliente' ||
                    chamado.status ===
                      'resolvido' ||
                    chamado.status === 'encerrado'
                  }
                  tema={tema}
                />

                <TimelineItem
                  title="Resolvido"
                  date={formatarData(
                    chamado.resolvido_em
                  )}
                  active={
                    chamado.status ===
                      'resolvido' ||
                    chamado.status === 'encerrado'
                  }
                  tema={tema}
                />

                <TimelineItem
                  title="Encerrado"
                  date={formatarData(
                    chamado.encerrado_em
                  )}
                  active={
                    chamado.status === 'encerrado'
                  }
                  last
                  tema={tema}
                />
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                Próximos passos
              </h2>

              <p style={styles.sideText}>
                Nossa equipe acompanhará este chamado
                e responderá diretamente por aqui.
              </p>

              <Link
                href="/chamados"
                style={{
                  ...styles.secondaryButton,
                  color: tema.principal,
                  borderColor: tema.borda,
                }}
              >
                Ver meus chamados
              </Link>
            </div>
          </aside>
        </section>
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
      <div style={styles.label}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
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

function TimelineItem({
  title,
  date,
  active,
  last,
  tema,
}: {
  title: string
  date?: string
  active: boolean
  last?: boolean
  tema: (typeof identidade)[Marca]
}) {
  return (
    <div style={styles.timelineItem}>
      <div style={styles.timelineRail}>
        <div
          style={{
            ...styles.timelineDot,
            ...(active
              ? {
                  background: tema.principal,
                  boxShadow: `0 0 0 4px ${tema.fundoForte}`,
                }
              : {}),
          }}
        />

        {!last && (
          <div style={styles.timelineLine} />
        )}
      </div>

      <div style={styles.timelineContent}>
        <strong
          style={{
            color: active
              ? '#172033'
              : '#94a3b8',
          }}
        >
          {title}
        </strong>

        {date && (
          <span style={styles.timelineDate}>
            {date}
          </span>
        )}
      </div>
    </div>
  )
}

function statusStyle(status: string) {
  const stylesByStatus: Record<
    string,
    React.CSSProperties
  > = {
    aberto: {
      background: '#eff6ff',
      color: '#1d4ed8',
    },

    em_atendimento: {
      background: '#fff7ed',
      color: '#c2410c',
    },

    aguardando_cliente: {
      background: '#fefce8',
      color: '#a16207',
    },

    resolvido: {
      background: '#f0fdf4',
      color: '#15803d',
    },

    encerrado: {
      background: '#f1f5f9',
      color: '#475569',
    },
  }

  return (
    stylesByStatus[status] ||
    stylesByStatus.aberto
  )
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: '100vh',
    padding: '32px 20px 60px',
  },

  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '24px',
    marginBottom: '28px',
  },

  backLink: {
    display: 'inline-block',
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '18px',
    textDecoration: 'none',
  },

  eyebrow: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    marginBottom: '8px',
  },

  title: {
    margin: 0,
    color: '#172033',
    fontSize: '32px',
    lineHeight: 1.15,
  },

  subtitle: {
    margin: '10px 0 0',
    color: '#64748b',
    fontSize: '15px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1fr) 320px',
    gap: '24px',
    alignItems: 'start',
  },

  mainColumn: {
    display: 'grid',
    gap: '24px',
  },

  sideColumn: {
    display: 'grid',
    gap: '24px',
  },

  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '24px',
    boxShadow:
      '0 5px 15px rgba(15, 23, 42, 0.05)',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '22px',
  },

  cardTitle: {
    margin: 0,
    color: '#172033',
    fontSize: '19px',
  },

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(0, 1fr))',
    gap: '22px',
    paddingBottom: '22px',
    borderBottom:
      '1px solid #eef0f3',
  },

  label: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '7px',
  },

  infoValue: {
    color: '#172033',
    fontSize: '14px',
    fontWeight: 600,
  },

  descriptionBox: {
    paddingTop: '22px',
  },

  description: {
    margin: 0,
    color: '#475569',
    fontSize: '15px',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
  },

  evaluationBox: {
    marginTop: '22px',
    paddingTop: '22px',
    borderTop:
      '1px solid #eef0f3',
  },

  stars: {
    color: '#f59e0b',
    fontSize: '22px',
    letterSpacing: '2px',
    marginBottom: '8px',
  },

  messageCount: {
    color: '#64748b',
    fontSize: '13px',
  },

  emptyMessages: {
    padding: '24px',
    textAlign: 'center',
    border:
      '1px dashed #cbd5e1',
    borderRadius: '12px',
    color: '#64748b',
    fontSize: '14px',
  },

  uploadArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '18px',
    border:
      '1px dashed #bfdbfe',
    borderRadius: '14px',
  },

  uploadIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 800,
    flexShrink: 0,
  },

  uploadContent: {
    flex: 1,
    minWidth: 0,
  },

  uploadTitle: {
    display: 'block',
    color: '#172033',
    fontSize: '14px',
  },

  uploadText: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.5,
  },

  uploadLimit: {
    margin: '3px 0 10px',
    color: '#94a3b8',
    fontSize: '11px',
  },

  uploadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderRadius: '9px',
    padding: '9px 13px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  hiddenInput: {
    display: 'none',
  },

  attachmentError: {
    marginTop: '12px',
    padding: '11px 13px',
    background: '#fef2f2',
    border:
      '1px solid #fecaca',
    color: '#991b1b',
    borderRadius: '10px',
    fontSize: '12px',
    lineHeight: 1.5,
  },

  emptyAttachments: {
    marginTop: '16px',
    padding: '20px',
    textAlign: 'center',
    border:
      '1px dashed #cbd5e1',
    borderRadius: '12px',
    color: '#64748b',
    fontSize: '13px',
  },

  linkForm: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr) auto',
    gap: '8px',
    margin: '14px 0',
  },

  linkInput: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#0f172a',
    outline: 'none',
    background: '#ffffff',
    width: '100%',
  },

  linkButton: {
    border: 'none',
    borderRadius: '10px',
    padding: '10px 18px',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  attachmentList: {
    display: 'grid',
    gap: '10px',
    marginTop: '16px',
  },

  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    border:
      '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#ffffff',
  },

  fileIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    background: '#f1f5f9',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 900,
    flexShrink: 0,
  },

  fileInfo: {
    minWidth: 0,
    flex: 1,
  },

  fileName: {
    display: 'block',
    color: '#172033',
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  fileMeta: {
    display: 'block',
    marginTop: '4px',
    color: '#94a3b8',
    fontSize: '10px',
  },

  openFileButton: {
    border:
      '1px solid #bfdbfe',
    background: '#ffffff',
    borderRadius: '9px',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0,
  },

  messageList: {
    display: 'grid',
    gap: '18px',
  },

  messageItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },

  messageAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    flexShrink: 0,
  },

  messageContent: {
    minWidth: 0,
    flex: 1,
  },

  messageMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '7px',
    color: '#172033',
    fontSize: '13px',
  },

  profileTag: {
    background: '#f1f5f9',
    color: '#64748b',
    borderRadius: '999px',
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 700,
  },

  messageDate: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 500,
  },

  messageBubble: {
    padding: '13px 15px',
    borderRadius: '12px',
    color: '#334155',
    fontSize: '14px',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },

  messageForm: {
    marginTop: '24px',
    paddingTop: '22px',
    borderTop:
      '1px solid #eef0f3',
  },

  textarea: {
    width: '100%',
    minHeight: '110px',
    resize: 'vertical',
    border:
      '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '13px 14px',
    outline: 'none',
    color: '#172033',
    background: '#ffffff',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },

  formFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginTop: '12px',
  },

  helper: {
    color: '#94a3b8',
    fontSize: '12px',
  },

  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    border: 0,
    borderRadius: '10px',
    padding: '11px 16px',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },

  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    border:
      '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '11px 16px',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: '16px',
  },

  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  timeline: {
    marginTop: '22px',
  },

  timelineItem: {
    display: 'flex',
    gap: '12px',
    minHeight: '62px',
  },

  timelineRail: {
    width: '18px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  timelineDot: {
    width: '11px',
    height: '11px',
    borderRadius: '50%',
    background: '#cbd5e1',
    marginTop: '3px',
    flexShrink: 0,
  },

  timelineLine: {
    width: '2px',
    flex: 1,
    background: '#e2e8f0',
    marginTop: '5px',
  },

  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingBottom: '18px',
    fontSize: '13px',
  },

  timelineDate: {
    color: '#94a3b8',
    fontSize: '11px',
  },

  sideText: {
    margin: '12px 0 0',
    color: '#64748b',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  loading: {
    background: '#ffffff',
    borderRadius: '18px',
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },

  loadingSpinner: {
    width: '24px',
    height: '24px',
    border: '3px solid',
    borderRadius: '50%',
  },

  errorCard: {
    background: '#ffffff',
    border:
      '1px solid #fecaca',
    borderRadius: '18px',
    padding: '32px',
    textAlign: 'center',
  },

  errorTitle: {
    margin: '0 0 10px',
    color: '#991b1b',
  },

  errorText: {
    color: '#64748b',
    marginBottom: '24px',
  },

  warning: {
    background: '#fff7ed',
    border:
      '1px solid #fed7aa',
    color: '#9a3412',
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '20px',
    fontSize: '13px',
  },
}
