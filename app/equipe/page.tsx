'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import './chat.css'
import AnexoChat from '@/components/AnexoChat'
import Reacoes from '@/components/Reacoes'
import { aplicarReacao, carregarReacoes, reagir, type Reacao } from '@/lib/reacoes'
import {
  AUDIO_MAX_SEGUNDOS,
  IMAGEM_MAX_BYTES,
  TIPOS_IMAGEM,
  duracaoTexto,
  enviarAnexoChat,
  formatoAudio,
} from '@/lib/chatAnexos'

/*
 * Antes este chat era uma sala unica onde todo mundo falava junto.
 * Agora existe uma lista de conversas: a sala "Equipe toda", que
 * continua sendo so da equipe interna, e uma conversa privada por
 * pessoa. O cliente tambem entra aqui, mas so enxerga a equipe.
 *
 * Quem decide o que cada um pode ver e o banco, pelas politicas de
 * acesso. A tela apenas monta a lista com o que o banco devolveu.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const GERAL = 'geral'

type Mensagem = {
  id: string
  autor_id: string
  destinatario_id: string | null
  texto: string
  created_at: string
  lido_em: string | null
  autor_nome: string | null
  autor_email: string | null
  /* Áudio ou imagem (supabase/conversas-audio-imagem.sql). */
  anexo_path?: string | null
  anexo_tipo?: string | null
  anexo_duracao?: number | null
}

/* Texto guardado junto do anexo (aparece na prévia da lista). */
const TEXTO_AUDIO = '🎤 Áudio'
const TEXTO_IMAGEM = '📷 Imagem'

type Contato = {
  id: string
  nome: string | null
  email: string | null
  perfil: string | null
  empresa_nome: string | null
}

function horario(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Porto_Velho',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function iniciais(nome: string | null, email: string | null) {
  const base = (nome || email || '?').trim()
  const partes = base.split(/\s+/).filter(Boolean)

  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase()
  }

  return base.slice(0, 2).toUpperCase()
}

function nomeDe(c: Contato) {
  return c.nome || c.email || 'Sem nome'
}

function semAcento(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function ChatEquipePage() {
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [meuId, setMeuId] = useState('')
  const [interno, setInterno] = useState(false)

  const [contatos, setContatos] = useState<Contato[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  /* Reações com emoji (supabase/nomes-e-reacoes.sql), das 200 mensagens mais recentes. */
  const [reacoes, setReacoes] = useState<Reacao[]>([])

  /* 'geral' = sala da equipe; qualquer outro valor = id da pessoa. */
  const [conversa, setConversa] = useState<string>(GERAL)
  const [busca, setBusca] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)

  const fim = useRef<HTMLDivElement | null>(null)
  const conversaAtual = useRef<string>(GERAL)
  const trocouDeConversa = useRef(true)

  conversaAtual.current = conversa

  /*
   * Uma consulta so traz tudo o que este usuario pode ver: a sala geral
   * e todas as conversas privadas dele. Assim a contagem de nao lidas
   * de cada conversa sai sem uma consulta por pessoa.
   */
  async function carregar() {
    /*
     * As 600 mais recentes (antes vinham as 600 mais antigas, e mensagens
     * novas deixariam de aparecer quando o histórico passasse disso).
     */
    const campos =
      'id, autor_id, destinatario_id, texto, created_at, lido_em, profiles!chat_equipe_autor_id_fkey(nome, email)'
    let { data, error }: { data: any[] | null; error: any } = await supabase
      .from('chat_equipe')
      .select(campos + ', anexo_path, anexo_tipo, anexo_duracao')
      .order('created_at', { ascending: false })
      .limit(600)

    /* Sem o SQL de anexos ainda: carrega só o texto. */
    if (error && /anexo_/i.test(error.message || '')) {
      ;({ data, error } = await supabase
        .from('chat_equipe')
        .select(campos)
        .order('created_at', { ascending: false })
        .limit(600))
    }

    carregarReacoes('chat_reacoes', (data || []).slice(0, 200).map((m: any) => m.id)).then(setReacoes)

    data = (data || []).slice().reverse()

    if (error) {
      console.error(error)
      setErro('Não foi possível carregar as mensagens.')
      return
    }

    setMensagens(
      (data || []).map((m: any) => ({
        id: m.id,
        autor_id: m.autor_id,
        destinatario_id: m.destinatario_id ?? null,
        texto: m.texto,
        created_at: m.created_at,
        lido_em: m.lido_em ?? null,
        autor_nome: m.profiles?.nome ?? null,
        autor_email: m.profiles?.email ?? null,
        anexo_path: m.anexo_path ?? null,
        anexo_tipo: m.anexo_tipo ?? null,
        anexo_duracao: m.anexo_duracao ?? null,
      })) as Mensagem[]
    )
  }

  useEffect(() => {
    let vivo = true
    let relogio: ReturnType<typeof setInterval> | null = null

    async function iniciar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('id, perfil, ativo')
        .eq('id', user.id)
        .maybeSingle()

      if (!perfil || perfil.ativo !== true) {
        setErro('Seu acesso ao portal está inativo.')
        setCarregando(false)
        return
      }

      if (!vivo) return

      const ehInterno = PERFIS_INTERNOS.includes(perfil.perfil || '')

      setMeuId(perfil.id)
      setInterno(ehInterno)

      /* O cliente não tem sala geral: começa na conversa com a equipe. */
      if (!ehInterno) {
        setConversa('')
      }

      const { data: lista, error: erroLista } = await supabase.rpc(
        'contatos_do_chat'
      )

      if (erroLista) {
        console.error(erroLista)
        setErro(
          'Não foi possível carregar a lista de pessoas. Verifique se o SQL do chat já foi aplicado.'
        )
      } else {
        const pessoas = (lista || []) as Contato[]

        setContatos(pessoas)

        /* O cliente cai direto no primeiro atendente da lista. */
        if (!ehInterno && pessoas.length > 0) {
          setConversa(pessoas[0].id)
        }
      }

      await carregar()
      setCarregando(false)

      /*
       * Uma consulta a cada 8 segundos mantem a conversa viva sem
       * depender de canal em tempo real, que exige configuracao extra.
       */
      relogio = setInterval(carregar, 8000)
    }

    iniciar()

    return () => {
      vivo = false
      if (relogio) clearInterval(relogio)
    }
  }, [router])

  /* Nomes para "quem reagiu": contatos + autores das mensagens. */
  const nomesReacao = useMemo(() => {
    const n: Record<string, string> = {}
    for (const c of contatos as any[]) if (c.id && c.nome) n[c.id] = c.nome
    for (const m of mensagens) if (m.autor_id && m.autor_nome) n[m.autor_id] = m.autor_nome
    return n
  }, [contatos, mensagens])

  /* Mensagens da conversa aberta agora. */
  const visiveis = useMemo(() => {
    if (!meuId) return []

    if (conversa === GERAL) {
      return mensagens.filter((m) => m.destinatario_id === null)
    }

    return mensagens.filter(
      (m) =>
        m.destinatario_id !== null &&
        ((m.autor_id === meuId && m.destinatario_id === conversa) ||
          (m.autor_id === conversa && m.destinatario_id === meuId))
    )
  }, [mensagens, conversa, meuId])

  /* Quantas mensagens ainda nao lidas cada pessoa me mandou. */
  const naoLidas = useMemo(() => {
    const conta: Record<string, number> = {}

    for (const m of mensagens) {
      if (m.destinatario_id === meuId && !m.lido_em) {
        conta[m.autor_id] = (conta[m.autor_id] || 0) + 1
      }
    }

    return conta
  }, [mensagens, meuId])

  /* Ultima mensagem de cada conversa, para a previa na lista. */
  const previa = useMemo(() => {
    const mapa: Record<string, Mensagem> = {}

    for (const m of mensagens) {
      const chave =
        m.destinatario_id === null
          ? GERAL
          : m.autor_id === meuId
            ? m.destinatario_id
            : m.autor_id

      mapa[chave] = m
    }

    return mapa
  }, [mensagens, meuId])

  /* Ao abrir uma conversa, marca como lidas as que sao para mim. */
  useEffect(() => {
    if (!meuId || conversa === GERAL || !conversa) return

    const pendentes = mensagens
      .filter(
        (m) =>
          m.autor_id === conversa && m.destinatario_id === meuId && !m.lido_em
      )
      .map((m) => m.id)

    if (pendentes.length === 0) return

    const agora = new Date().toISOString()

    setMensagens((atual) =>
      atual.map((m) =>
        pendentes.includes(m.id) ? { ...m, lido_em: agora } : m
      )
    )

    supabase
      .from('chat_equipe')
      .update({ lido_em: agora })
      .in('id', pendentes)
      .then(({ error }) => {
        if (error) console.error('Erro ao marcar como lida:', error)
        /* Avisa o cabeçalho para atualizar o balão de não lidas. */
        window.dispatchEvent(new Event('conversas-lidas'))
      })
  }, [conversa, mensagens, meuId])

  /* Rolar para o fim: seco ao trocar de conversa, suave ao chegar msg. */
  useEffect(() => {
    if (!fim.current) return

    fim.current.scrollIntoView({
      behavior: trocouDeConversa.current ? 'auto' : 'smooth',
    })

    trocouDeConversa.current = false
  }, [visiveis.length])

  useEffect(() => {
    trocouDeConversa.current = true
  }, [conversa])

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim())

    if (!termo) return contatos

    return contatos.filter((c) =>
      semAcento(
        [c.nome, c.email, c.empresa_nome].filter(Boolean).join(' ')
      ).includes(termo)
    )
  }, [contatos, busca])

  /*
   * Quem mandou mensagem nova sobe para o topo ("Novas mensagens"), da
   * mais recente para a mais antiga, piscando até a conversa ser aberta.
   * Nas demais seções, conversas mais recentes primeiro.
   */
  const ultimaNaoLida = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const m of mensagens) {
      if (m.destinatario_id === meuId && !m.lido_em) {
        if (!mapa[m.autor_id] || m.created_at > mapa[m.autor_id]) mapa[m.autor_id] = m.created_at
      }
    }
    return mapa
  }, [mensagens, meuId])

  const recente = (id: string) => previa[id]?.created_at || ''
  const porRecente = (a: Contato, b: Contato) => recente(b.id).localeCompare(recente(a.id))

  const novas = filtrados
    .filter((c) => naoLidas[c.id] && c.id !== conversa)
    .sort((a, b) => (ultimaNaoLida[b.id] || '').localeCompare(ultimaNaoLida[a.id] || ''))
  const idsNovas = new Set(novas.map((c) => c.id))

  const equipe = filtrados
    .filter((c) => PERFIS_INTERNOS.includes(c.perfil || '') && !idsNovas.has(c.id))
    .sort(porRecente)

  const clientes = filtrados
    .filter((c) => !PERFIS_INTERNOS.includes(c.perfil || '') && !idsNovas.has(c.id))
    .sort(porRecente)

  const escolhido = contatos.find((c) => c.id === conversa) || null

  /*
   * O cliente não lê o perfil da equipe direto (regra de acesso), então o
   * nome do autor vem da lista de contatos quando a consulta não traz.
   */
  const autorNome = (m: Mensagem) => m.autor_nome || contatos.find((c) => c.id === m.autor_id)?.nome || null
  const autorEmail = (m: Mensagem) => m.autor_email || contatos.find((c) => c.id === m.autor_id)?.email || null

  const tituloConversa =
    conversa === GERAL
      ? 'Equipe toda'
      : escolhido
        ? nomeDe(escolhido)
        : 'Escolha com quem falar'

  const subtituloConversa =
    conversa === GERAL
      ? 'Todos da equipe interna leem esta sala'
      : escolhido
        ? escolhido.empresa_nome && !PERFIS_INTERNOS.includes(escolhido.perfil || '')
          ? 'Cliente · ' + escolhido.empresa_nome
          : 'Conversa privada, só entre vocês dois'
        : ''

  /* Campo de mensagem que cresce com o texto. */
  const campoTexto = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = campoTexto.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight + 2, 200) + 'px'
  }, [texto])

  /* ---------- Áudio e imagem ---------- */
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const gravador = useRef<MediaRecorder | null>(null)
  const pedacos = useRef<Blob[]>([])
  const inicioGravacao = useRef(0)
  const descartar = useRef(false)
  const relogioGravacao = useRef<ReturnType<typeof setInterval> | null>(null)
  const seletorImagem = useRef<HTMLInputElement | null>(null)

  async function enviarComAnexo(arquivo: Blob, tipo: 'audio' | 'imagem', duracao?: number) {
    if (!conversa || !meuId) return
    try {
      setEnviando(true)
      setErro('')
      const caminho = await enviarAnexoChat(meuId, arquivo)
      const legenda = texto.trim()
      const { error } = await supabase.from('chat_equipe').insert({
        autor_id: meuId,
        destinatario_id: conversa === GERAL ? null : conversa,
        texto: tipo === 'imagem' && legenda ? legenda : tipo === 'audio' ? TEXTO_AUDIO : TEXTO_IMAGEM,
        anexo_path: caminho,
        anexo_tipo: tipo,
        anexo_duracao: tipo === 'audio' ? Math.round(duracao || 0) : null,
      })
      if (error) throw error
      if (tipo === 'imagem') setTexto('')
      await carregar()
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível enviar o arquivo.')
    } finally {
      setEnviando(false)
    }
  }

  function escolherImagem(arquivo: File | null | undefined) {
    if (!arquivo) return
    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      setErro('Envie imagem JPG, PNG ou WEBP.')
      return
    }
    if (arquivo.size > IMAGEM_MAX_BYTES) {
      setErro('A imagem passa de 10 MB.')
      return
    }
    enviarComAnexo(arquivo, 'imagem')
  }

  function pararRelogio() {
    if (relogioGravacao.current) clearInterval(relogioGravacao.current)
    relogioGravacao.current = null
  }

  async function iniciarGravacao() {
    const formato = formatoAudio()
    if (formato === null || !navigator.mediaDevices?.getUserMedia) {
      setErro('Este navegador não grava áudio. Use o Chrome, Edge, Firefox ou Safari atualizado.')
      return
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = formato ? new MediaRecorder(fluxo, { mimeType: formato }) : new MediaRecorder(fluxo)
      pedacos.current = []
      descartar.current = false
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) pedacos.current.push(ev.data)
      }
      rec.onstop = () => {
        fluxo.getTracks().forEach((t) => t.stop())
        pararRelogio()
        setGravando(false)
        const duracao = (Date.now() - inicioGravacao.current) / 1000
        if (descartar.current || pedacos.current.length === 0 || duracao < 1) return
        const blob = new Blob(pedacos.current, { type: rec.mimeType || formato || 'audio/webm' })
        enviarComAnexo(blob, 'audio', Math.min(duracao, AUDIO_MAX_SEGUNDOS))
      }
      gravador.current = rec
      inicioGravacao.current = Date.now()
      setSegundos(0)
      setGravando(true)
      setErro('')
      rec.start(250)
      relogioGravacao.current = setInterval(() => {
        const s = Math.floor((Date.now() - inicioGravacao.current) / 1000)
        setSegundos(s)
        if (s >= AUDIO_MAX_SEGUNDOS && gravador.current?.state === 'recording') gravador.current.stop()
      }, 250)
    } catch (e: any) {
      setErro(
        /denied|permission|NotAllowed/i.test(String(e?.name || e?.message))
          ? 'O navegador bloqueou o microfone. Libere o microfone para este site (ícone ao lado do endereço) e tente de novo.'
          : 'Não foi possível acessar o microfone.'
      )
    }
  }

  function finalizarGravacao(enviarAudio: boolean) {
    descartar.current = !enviarAudio
    if (gravador.current?.state === 'recording') gravador.current.stop()
  }

  /* Sair da conversa ou da tela no meio da gravação descarta o áudio. */
  useEffect(() => {
    return () => {
      descartar.current = true
      if (gravador.current?.state === 'recording') gravador.current.stop()
      pararRelogio()
    }
  }, [conversa])

  async function enviar(e: FormEvent) {
    e.preventDefault()

    const conteudo = texto.trim()

    if (!conteudo || enviando || !conversa) return

    setEnviando(true)
    setErro('')

    const { error } = await supabase.from('chat_equipe').insert({
      autor_id: meuId,
      destinatario_id: conversa === GERAL ? null : conversa,
      texto: conteudo,
    })

    setEnviando(false)

    if (error) {
      console.error(error)
      setErro(
        /row-level security|violates/i.test(error.message || '')
          ? 'Não foi possível enviar a mensagem: sem permissão para falar com esta pessoa.'
          : 'Não foi possível enviar a mensagem.'
      )
      return
    }

    setTexto('')
    await carregar()
  }

  if (carregando) {
    return (
      <div className="app">
        <div className="empty-state">Carregando...</div>
      </div>
    )
  }

  function ItemConversa({
    id,
    titulo,
    detalhe,
    marcador,
  }: {
    id: string
    titulo: string
    detalhe: string
    marcador?: number
  }) {
    const ativo = conversa === id
    const ultima = previa[id]

    return (
      <button
        type="button"
        className={marcador && !ativo ? 'conversa-nova' : undefined}
        onClick={() => {
          setConversa(id)
          setListaAberta(false)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          textAlign: 'left',
          border: '1px solid ' + (ativo ? 'var(--primary)' : 'transparent'),
          background: ativo ? 'var(--primary-tint)' : 'transparent',
          borderRadius: 10,
          padding: '8px 10px',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            flexShrink: 0,
            background:
              id === GERAL ? 'var(--primary)' : 'var(--surface-sunken)',
            color: id === GERAL ? '#fff' : 'var(--ink-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {id === GERAL ? '#' : iniciais(titulo, null)}
        </span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: marcador ? 800 : 600,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {titulo}
          </span>

          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              color: marcador ? 'var(--ink)' : 'var(--ink-faint)',
              fontWeight: marcador ? 700 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {ultima ? ultima.texto : detalhe}
          </span>
        </span>

        {marcador ? (
          <span
            style={{
              flexShrink: 0,
              minWidth: 19,
              height: 19,
              borderRadius: 10,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
            }}
          >
            {marcador > 99 ? '99+' : marcador}
          </span>
        ) : null}
      </button>
    )
  }

  const listaConversas = (
    <>
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar pessoa ou empresa"
        style={{
          width: '100%',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '8px 11px',
          fontSize: 13,
          background: 'var(--surface)',
          color: 'var(--ink)',
          marginBottom: 10,
        }}
      />

      <div style={{ display: 'grid', gap: 3 }}>
        {novas.length > 0 && (
          <>
            <div className="section-title" style={{ padding: '4px 10px', color: 'var(--danger)' }}>
              Novas mensagens ({novas.length})
            </div>

            {novas.map((c) => (
              <ItemConversa
                key={c.id}
                id={c.id}
                titulo={nomeDe(c)}
                detalhe={c.empresa_nome || c.email || ''}
                marcador={naoLidas[c.id]}
              />
            ))}
          </>
        )}

        {interno && !busca.trim() && (
          <>
            <div className="section-title" style={{ padding: '4px 10px' }}>
              Sala aberta
            </div>

            <ItemConversa
              id={GERAL}
              titulo="Equipe toda"
              detalhe="Todos da equipe leem"
            />
          </>
        )}

        {equipe.length > 0 && (
          <div
            className="section-title"
            style={{ padding: '10px 10px 4px' }}
          >
            Equipe interna
          </div>
        )}

        {equipe.map((c) => (
          <ItemConversa
            key={c.id}
            id={c.id}
            titulo={nomeDe(c)}
            detalhe={c.email || ''}
            marcador={naoLidas[c.id]}
          />
        ))}

        {clientes.length > 0 && (
          <div
            className="section-title"
            style={{ padding: '10px 10px 4px' }}
          >
            Clientes
          </div>
        )}

        {clientes.map((c) => (
          <ItemConversa
            key={c.id}
            id={c.id}
            titulo={nomeDe(c)}
            detalhe={c.empresa_nome || c.email || ''}
            marcador={naoLidas[c.id]}
          />
        ))}

        {filtrados.length === 0 && (
          <div
            style={{
              padding: '16px 10px',
              fontSize: 12.5,
              color: 'var(--ink-faint)',
            }}
          >
            Ninguém encontrado com esse termo.
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="app" style={{ maxWidth: 1180, margin: '0 auto', width: '100%' }}>
      <div>
        <div className="section-title">
          {interno ? 'Uso interno' : 'Fale com a gente'}
        </div>

        <h1 style={{ fontSize: 30, marginTop: 6 }}>Conversas</h1>

        <p
          style={{
            margin: '8px 0 0',
            color: 'var(--ink-muted)',
            fontSize: 14,
          }}
        >
          {interno
            ? 'Escolha com quem falar na lista ao lado. A sala "Equipe toda" é lida por toda a equipe interna; as demais são conversas privadas, só entre vocês dois.'
            : 'Escolha quem da equipe você quer chamar. A conversa é privada. Para assuntos que precisam ficar registrados, use um chamado.'}
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {meuId && (
        <>
          {/* No celular a lista vira um botão que abre a seleção. */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setListaAberta((v) => !v)}
            style={{ marginTop: 14 }}
            data-chat-alternar
          >
            {listaAberta ? 'Fechar a lista' : 'Trocar de conversa'}
          </button>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(230px, 290px) 1fr',
              gap: 14,
              marginTop: 14,
              alignItems: 'start',
            }}
            data-chat-grade
          >
            <div
              className={'panel' + (listaAberta ? ' aberta' : '')}
              style={{
                padding: 12,
                maxHeight: '68vh',
                overflowY: 'auto',
              }}
              data-chat-lista
            >
              {listaConversas}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                className="panel"
                style={{ padding: 0, display: 'flex', flexDirection: 'column' }}
              >
                <div
                  className="panel-head"
                  style={{ alignItems: 'center', gap: 10 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: 'var(--ink)',
                      }}
                    >
                      {tituloConversa}
                    </div>

                    {subtituloConversa && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--ink-faint)',
                          marginTop: 2,
                        }}
                      >
                        {subtituloConversa}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: 16,
                    height: '56vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {!conversa ? (
                    <div
                      style={{
                        margin: 'auto',
                        color: 'var(--ink-faint)',
                        fontSize: 14,
                        textAlign: 'center',
                      }}
                    >
                      Escolha na lista com quem você quer falar.
                    </div>
                  ) : visiveis.length === 0 ? (
                    <div
                      style={{
                        margin: 'auto',
                        color: 'var(--ink-faint)',
                        fontSize: 14,
                        textAlign: 'center',
                      }}
                    >
                      {conversa === GERAL
                        ? 'Nenhuma mensagem na sala ainda. Comece a conversa.'
                        : 'Nenhuma mensagem com ' +
                          tituloConversa +
                          ' ainda. Diga um oi.'}
                    </div>
                  ) : (
                    visiveis.map((m) => {
                      const meu = m.autor_id === meuId

                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            gap: 10,
                            flexDirection: meu ? 'row-reverse' : 'row',
                            alignItems: 'flex-end',
                          }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: meu
                                ? 'var(--primary)'
                                : 'var(--surface-sunken)',
                              color: meu ? '#ffffff' : 'var(--ink-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {iniciais(autorNome(m), autorEmail(m))}
                          </div>

                          <div style={{ maxWidth: '76%' }}>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--ink-faint)',
                                marginBottom: 3,
                                textAlign: meu ? 'right' : 'left',
                              }}
                            >
                              {(autorNome(m) || autorEmail(m) || 'Equipe') +
                                ' · ' +
                                horario(m.created_at)}
                            </div>

                            <div
                              style={{
                                background: meu
                                  ? 'var(--primary-tint)'
                                  : 'var(--surface-sunken)',
                                border: '1px solid var(--border)',
                                borderRadius: 12,
                                padding: '9px 13px',
                                fontSize: 14,
                                color: 'var(--ink)',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              {m.anexo_path ? (
                                <>
                                  <AnexoChat caminho={m.anexo_path} tipo={m.anexo_tipo || null} duracao={m.anexo_duracao ?? null} />
                                  {m.texto && m.texto !== TEXTO_AUDIO && m.texto !== TEXTO_IMAGEM && (
                                    <div style={{ marginTop: 6 }}>{m.texto}</div>
                                  )}
                                </>
                              ) : (
                                m.texto
                              )}
                            </div>

                            {/*
                             * Confirmação de leitura (só em conversa privada,
                             * nas mensagens que eu enviei): ✓ cinza = entregue;
                             * ✓✓ verde = a pessoa abriu a conversa e leu.
                             */}
                            {meu && m.destinatario_id && (
                              <div
                                title={
                                  m.lido_em
                                    ? 'Lida em ' + horario(m.lido_em)
                                    : 'Entregue. Ainda não lida.'
                                }
                                aria-label={m.lido_em ? 'Lida' : 'Entregue, não lida'}
                                style={{
                                  textAlign: 'right',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  letterSpacing: -3,
                                  paddingRight: 3,
                                  marginTop: 2,
                                  color: m.lido_em ? 'var(--success)' : 'var(--ink-faint)',
                                }}
                              >
                                {m.lido_em ? '✓✓' : '✓'}
                              </div>
                            )}

                            <Reacoes
                              reacoes={reacoes.filter((r) => r.mensagem_id === m.id)}
                              meuId={meuId || null}
                              nomes={nomesReacao}
                              alinharDireita={meu}
                              onReagir={async (emoji) => {
                                const atual = reacoes.find((r) => r.mensagem_id === m.id && r.usuario_id === meuId)?.emoji || null
                                try {
                                  const novo = await reagir('chat_reacoes', m.id, meuId, emoji, atual)
                                  setReacoes((lista) => aplicarReacao(lista, m.id, meuId, novo))
                                } catch (e) {
                                  console.error(e)
                                }
                              }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}

                  <div ref={fim} />
                </div>
              </div>

              <form
                onSubmit={enviar}
                style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'flex-end' }}
              >
                {/*
                 * Campo cresce com o texto (até ~8 linhas, depois rola).
                 * Enter envia; Shift+Enter quebra a linha.
                 */}
                {gravando ? (
                  <div
                    role="status"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: '1px solid var(--danger)',
                      borderRadius: 12,
                      padding: '11px 14px',
                      fontSize: 14,
                      background: 'var(--surface)',
                      minHeight: 44,
                    }}
                  >
                    <span className="gravando-ponto" aria-hidden="true" />
                    Gravando {duracaoTexto(segundos)} / {duracaoTexto(AUDIO_MAX_SEGUNDOS)}
                    <span style={{ flex: 1 }} />
                    <button type="button" className="btn btn-sm" onClick={() => finalizarGravacao(false)}>
                      Descartar
                    </button>
                  </div>
                ) : (
                <textarea
                  ref={campoTexto}
                  onPaste={(e) => {
                    const img = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith('image/'))
                    if (img) {
                      e.preventDefault()
                      escolherImagem(img)
                    }
                  }}
                  rows={1}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      e.currentTarget.form?.requestSubmit()
                    }
                  }}
                  title="Enter envia · Shift+Enter quebra a linha"
                  disabled={!conversa}
                  placeholder={
                    !conversa
                      ? 'Escolha uma conversa para começar'
                      : conversa === GERAL
                        ? 'Escreva para toda a equipe'
                        : 'Escreva para ' + tituloConversa
                  }
                  style={{
                    flex: 1,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '11px 14px',
                    fontSize: 14,
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    font: 'inherit',
                    lineHeight: 1.45,
                    resize: 'none',
                    minHeight: 44,
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                />
                )}

                <input
                  ref={seletorImagem}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    escolherImagem(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />

                {!gravando && (
                  <button
                    type="button"
                    className="btn"
                    title="Enviar imagem (também dá para colar com Ctrl+V)"
                    aria-label="Enviar imagem"
                    disabled={enviando || !conversa}
                    onClick={() => seletorImagem.current?.click()}
                  >
                    📷
                  </button>
                )}

                {gravando ? (
                  <button type="button" className="btn btn-primary" onClick={() => finalizarGravacao(true)}>
                    Enviar áudio
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    title={'Gravar áudio (até ' + AUDIO_MAX_SEGUNDOS / 60 + ' minutos)'}
                    aria-label="Gravar áudio"
                    disabled={enviando || !conversa}
                    onClick={iniciarGravacao}
                  >
                    🎤
                  </button>
                )}

                {!gravando && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={enviando || !texto.trim() || !conversa}
                  >
                    {enviando ? 'Enviando...' : 'Enviar'}
                  </button>
                )}
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
