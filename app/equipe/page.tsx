'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Mensagem = {
  id: string
  autor_id: string
  texto: string
  created_at: string
  autor_nome: string | null
  autor_email: string | null
}

function horario(iso: string) {
  const d = new Date(iso)

  return d.toLocaleString('pt-BR', {
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

export default function ChatEquipePage() {
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [meuId, setMeuId] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const fim = useRef<HTMLDivElement | null>(null)
  const primeiraCarga = useRef(true)

  async function carregar() {
    const { data, error } = await supabase
      .from('chat_equipe')
      .select('id, autor_id, texto, created_at, profiles(nome, email)')
      .order('created_at', { ascending: true })
      .limit(300)

    if (error) {
      console.error(error)
      setErro('Não foi possível carregar as mensagens.')
      return
    }

    const lista = (data || []).map((m: any) => ({
      id: m.id,
      autor_id: m.autor_id,
      texto: m.texto,
      created_at: m.created_at,
      autor_nome: m.profiles?.nome ?? null,
      autor_email: m.profiles?.email ?? null,
    })) as Mensagem[]

    setMensagens(lista)
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

      if (
        !perfil ||
        perfil.ativo !== true ||
        !PERFIS_INTERNOS.includes(perfil.perfil || '')
      ) {
        setErro('Este chat é exclusivo da equipe interna.')
        setCarregando(false)
        return
      }

      if (!vivo) return

      setMeuId(perfil.id)
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

  useEffect(() => {
    if (!fim.current) return

    fim.current.scrollIntoView({
      behavior: primeiraCarga.current ? 'auto' : 'smooth',
    })

    primeiraCarga.current = false
  }, [mensagens.length])

  async function enviar(e: FormEvent) {
    e.preventDefault()

    const conteudo = texto.trim()

    if (!conteudo || enviando) return

    setEnviando(true)
    setErro('')

    const { error } = await supabase
      .from('chat_equipe')
      .insert({ autor_id: meuId, texto: conteudo })

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
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        Carregando...
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 900,
        margin: '0 auto',
        padding: 'clamp(16px, 3vw, 32px)',
      }}
    >
      <h1 style={{ margin: '0 0 6px', fontSize: 24, color: '#0f172a' }}>
        Chat da equipe
      </h1>

      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
        Conversa interna entre atendimento, gestão e administração. Os
        clientes não veem este espaço.
      </p>

      {erro && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 14,
          }}
        >
          {erro}
        </div>
      )}

      {meuId && (
        <>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 16,
              height: '58vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {mensagens.length === 0 ? (
              <div
                style={{
                  margin: 'auto',
                  color: '#94a3b8',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                Nenhuma mensagem ainda. Comece a conversa.
              </div>
            ) : (
              mensagens.map((m) => {
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
                        background: meu ? '#2563eb' : '#e2e8f0',
                        color: meu ? '#ffffff' : '#334155',
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
                          color: '#94a3b8',
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
                          background: meu ? '#eff6ff' : '#f8fafc',
                          border:
                            '1px solid ' + (meu ? '#dbeafe' : '#e2e8f0'),
                          borderRadius: 12,
                          padding: '9px 13px',
                          fontSize: 14,
                          color: '#0f172a',
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

          <form
            onSubmit={enviar}
            style={{ display: 'flex', gap: 10, marginTop: 14 }}
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva uma mensagem para a equipe"
              style={{
                flex: 1,
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 14,
                outline: 'none',
              }}
            />

            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '11px 20px',
                background: texto.trim() ? '#2563eb' : '#cbd5e1',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                cursor: texto.trim() ? 'pointer' : 'default',
              }}
            >
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
