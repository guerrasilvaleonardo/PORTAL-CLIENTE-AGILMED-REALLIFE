'use client'

import { FormEvent, use, useEffect, useRef, useState } from 'react'
import './assinar.css'

/*
 * Recebimento de EPI — a tela do trabalhador.
 *
 * Aberta pelo QR que aparece no celular de quem entrega, ou pelo link
 * que chega por e-mail. Não exige login: quem abre é o trabalhador, que
 * não tem conta no portal. Todo o acesso ao banco passa pela rota
 * /api/publico/assinatura-epi, que confere o CPF antes de assinar.
 */

type Item = {
  nome: string
  ca: string | null
  complemento: string | null
  quantidade: number
  troca_em: string
}

type Recebimento = {
  empresa: string
  trabalhador: string
  funcao: string
  entregue_em: string
  entregue_por: string
  itens: Item[]
  termo: string[]
  assinado: boolean
  cancelada: boolean
  cpf_dica: string | null
}

const dataHoraBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const dataBr = (iso: string) => iso.split('-').reverse().join('/')

/* 000.000.000-00 enquanto digita. */
function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function AssinarEpi({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [dados, setDados] = useState<Recebimento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [cpf, setCpf] = useState('')
  const [assinando, setAssinando] = useState(false)
  const [pronto, setPronto] = useState(false)

  /* O quadro onde a pessoa assina com o dedo. */
  const quadro = useRef<HTMLCanvasElement | null>(null)
  const desenhando = useRef(false)
  const [vazio, setVazio] = useState(true)

  useEffect(() => {
    let vivo = true

    async function carregar() {
      try {
        const r = await fetch(`/api/publico/assinatura-epi?token=${encodeURIComponent(token)}`)
        const j = await r.json()
        if (!vivo) return
        if (!r.ok) {
          setErro(j?.erro || 'Não foi possível abrir o recebimento.')
          return
        }
        setDados(j as Recebimento)
        if (j.assinado) setPronto(true)
      } catch {
        if (vivo) setErro('Não foi possível abrir o recebimento. Verifique a conexão.')
      } finally {
        if (vivo) setCarregando(false)
      }
    }

    carregar()
    return () => {
      vivo = false
    }
  }, [token])

  /* O canvas precisa de tamanho em pixels de verdade, senão o traço
   * sai borrado e deslocado no celular. Acerta quando a tela aparece e
   * a cada giro do aparelho. */
  useEffect(() => {
    const tela = quadro.current
    if (!tela || pronto || !dados) return

    function ajustar() {
      const tela = quadro.current
      if (!tela) return
      const caixa = tela.getBoundingClientRect()
      const escala = window.devicePixelRatio || 1
      tela.width = Math.round(caixa.width * escala)
      tela.height = Math.round(caixa.height * escala)
      const ctx = tela.getContext('2d')
      if (!ctx) return
      ctx.scale(escala, escala)
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#111827'
    }

    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [pronto, dados])

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const caixa = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - caixa.left, y: e.clientY - caixa.top }
  }

  function comecarTraco(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = quadro.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    desenhando.current = true
    const { x, y } = ponto(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setVazio(false)
  }

  function seguirTraco(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const ctx = quadro.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = ponto(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function terminarTraco() {
    desenhando.current = false
  }

  function limparTraco() {
    const tela = quadro.current
    const ctx = tela?.getContext('2d')
    if (!tela || !ctx) return
    ctx.clearRect(0, 0, tela.width, tela.height)
    setVazio(true)
  }

  async function assinar(e: FormEvent) {
    e.preventDefault()
    setAviso('')

    if (cpf.replace(/\D/g, '').length !== 11) {
      setAviso('Digite os 11 números do seu CPF.')
      return
    }
    if (vazio) {
      setAviso('Assine no quadro antes de confirmar.')
      return
    }

    try {
      setAssinando(true)
      const r = await fetch('/api/publico/assinatura-epi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          cpf,
          assinatura: quadro.current?.toDataURL('image/png'),
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setAviso(j?.erro || 'Não foi possível assinar.')
        return
      }
      setPronto(true)
    } catch {
      setAviso('Não foi possível assinar. Verifique a conexão e tente de novo.')
    } finally {
      setAssinando(false)
    }
  }

  if (carregando) {
    return (
      <main className="assinar">
        <p className="assinar-espera">Abrindo o recebimento…</p>
      </main>
    )
  }

  if (erro || !dados) {
    return (
      <main className="assinar">
        <div className="assinar-cartao">
          <h1>Recebimento de EPI</h1>
          <p className="assinar-erro">{erro || 'Recebimento não encontrado.'}</p>
          <p className="assinar-ajuda">Peça um link novo para quem entregou o equipamento.</p>
        </div>
      </main>
    )
  }

  if (dados.cancelada) {
    return (
      <main className="assinar">
        <div className="assinar-cartao">
          <h1>Entrega cancelada</h1>
          <p className="assinar-ajuda">
            Esta entrega foi cancelada pela empresa e não precisa ser assinada.
          </p>
        </div>
      </main>
    )
  }

  if (pronto) {
    return (
      <main className="assinar">
        <div className="assinar-cartao">
          <div className="assinar-feito" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1>Recebimento assinado</h1>
          <p className="assinar-ajuda">
            Pronto, {dados.trabalhador}. O seu recebimento foi registrado e já está na ficha da
            empresa. Pode fechar esta página.
          </p>
          <ul className="assinar-itens">
            {dados.itens.map((i, n) => (
              <li key={n}>
                <strong>{i.nome}{i.complemento ? ` · ${i.complemento}` : ''}</strong>
                <span>
                  {i.ca ? `CA ${i.ca} · ` : ''}trocar até {dataBr(i.troca_em)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    )
  }

  return (
    <main className="assinar">
      <form className="assinar-cartao" onSubmit={assinar}>
        <p className="assinar-sobre">{dados.empresa}</p>
        <h1>Recebimento de EPI</h1>
        <p className="assinar-ajuda">
          {dados.trabalhador}
          {dados.funcao ? ` · ${dados.funcao}` : ''} — entrega de {dataHoraBr(dados.entregue_em)}
          {dados.entregue_por ? `, por ${dados.entregue_por}` : ''}.
        </p>

        <h2>O que você está recebendo</h2>
        <ul className="assinar-itens">
          {dados.itens.map((i, n) => (
            <li key={n}>
              <strong>
                {i.quantidade > 1 ? `${i.quantidade}× ` : ''}
                {i.nome}
                {i.complemento ? ` · ${i.complemento}` : ''}
              </strong>
              <span>
                {i.ca ? `CA ${i.ca} · ` : ''}trocar até {dataBr(i.troca_em)}
              </span>
            </li>
          ))}
        </ul>

        <h2>Ao assinar, você declara</h2>
        <div className="assinar-termo">
          {dados.termo.map((p, n) => (
            <p key={n}>{p}</p>
          ))}
        </div>

        <label className="assinar-campo" htmlFor="cpf">
          Digite o seu CPF para assinar
          {dados.cpf_dica && <span className="assinar-dica">termina em {dados.cpf_dica.slice(-5)}</span>}
        </label>
        <input
          id="cpf"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(mascaraCpf(e.target.value))}
        />

        {/* O traço da pessoa é o que vai para a ficha. Por isso o quadro
            fica alto o bastante para assinar com o dedo, e não some da
            tela depois do campo do CPF. */}
        <label className="assinar-campo" htmlFor="assinatura">
          Assine aqui com o dedo
        </label>
        <div className="assinar-quadro">
          <canvas
            id="assinatura"
            ref={quadro}
            className="assinar-canvas"
            onPointerDown={comecarTraco}
            onPointerMove={seguirTraco}
            onPointerUp={terminarTraco}
            onPointerLeave={terminarTraco}
          />
          {vazio && <span className="assinar-marca-dagua">assine neste espaço</span>}
        </div>
        <button type="button" className="assinar-limpar" onClick={limparTraco}>
          Limpar e assinar de novo
        </button>

        {aviso && <p className="assinar-erro">{aviso}</p>}

        <button type="submit" className="assinar-botao" disabled={assinando}>
          {assinando ? 'Assinando…' : 'Assinar o recebimento'}
        </button>
        <p className="assinar-rodape">
          Ficam registrados o seu traço, a data, a hora e o aparelho de onde você assinou.
        </p>
      </form>
    </main>
  )
}
