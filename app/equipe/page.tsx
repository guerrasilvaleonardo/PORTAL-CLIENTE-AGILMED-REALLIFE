'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import './chat.css'

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
}

type Contato = {
  id: string
  nome: string | null
  email: string | null
  perfil: string | null
  empresa_nome: string | null
}

function horario(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
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
    const { data, error } = await supabase
      .from('chat_equipe')
      .select(
        'id, autor_id, destinatario_id, texto, created_at, lido_em, profiles!chat_equipe_autor_id_fkey(nome, email)'
      )
      .order('created_at', { ascending: true })
      .limit(600)

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

  const equipe = filtrados.filter((c) =>
    PERFIS_INTERNOS.includes(c.perfil || '')
  )

  const clientes = filtrados.filter(
    (c) => !PERFIS_INTERNOS.includes(c.perfil || '')
  )

  const escolhido = contatos.find((c) => c.id === conversa) || null

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
        ? escolhido.empresa_nome
          ? 'Cliente · ' + escolhido.empresa_nome
          : 'Conversa privada, só entre vocês dois'
        : ''

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
      setErro('Não foi possível enviar a mensagem.')
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
              color: 'var(--ink-faint)',
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
                            {iniciais(m.autor_nome, m.autor_email)}
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
                              {(m.autor_nome || m.autor_email || 'Equipe') +
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
                              {m.texto}
                            </div>
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
                style={{ display: 'flex', gap: 10, marginTop: 14 }}
              >
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
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
                  }}
                />

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={enviando || !texto.trim() || !conversa}
                >
                  {enviando ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
