'use client'

import { FormEvent, use, useEffect, useState } from 'react'
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

  async function assinar(e: FormEvent) {
    e.preventDefault()
    setAviso('')

    if (cpf.replace(/\D/g, '').length !== 11) {
      setAviso('Digite os 11 números do seu CPF.')
      return
    }

    try {
      setAssinando(true)
      const r = await fetch('/api/publico/assinatura-epi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf }),
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

        {aviso && <p className="assinar-erro">{aviso}</p>}

        <button type="submit" className="assinar-botao" disabled={assinando}>
          {assinando ? 'Assinando…' : 'Assinar o recebimento'}
        </button>
        <p className="assinar-rodape">
          Ficam registrados a data, a hora e o aparelho de onde você assinou.
        </p>
      </form>
    </main>
  )
}
