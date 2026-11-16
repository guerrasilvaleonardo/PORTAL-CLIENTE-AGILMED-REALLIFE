'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { marcaDoDominio, marcas, type Marca } from '@/lib/marca'

/*
 * Tela de entrada. A marca vem do endereço (portal.reallifessma.com.br ou
 * portal.agilmedocupacional.com.br): cada cliente vê só a marca que o
 * atende. Visual igual ao do EAD: faixa da cor da marca, botão em pílula.
 */
export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  /* Real Life até ler o endereço (evita trocar de marca depois de pintar). */
  const [marca, setMarca] = useState<Marca>('reallife')

  /*
   * Aviso quando a pessoa chega aqui porque o login salvo expirou
   * (ver lib/sessao.ts).
   */
  useEffect(() => {
    setMarca(marcaDoDominio())

    const params = new URLSearchParams(window.location.search)

    if (params.get('sessao') === 'expirada') {
      setErro('Sua sessão expirou. Entre novamente para continuar.')
    }
  }, [])

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setErro('')
    setCarregando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('E-mail ou senha inválidos.')
      setCarregando(false)
      return
    }

    router.push('/')
  }

  const tema = marcas[marca]
  const cores = {
    '--marca': tema.principal,
    '--marca-forte': tema.dark,
    '--acento': tema.acento,
    '--acento-hover': tema.acentoHover,
    '--no-acento': tema.noAcento,
    /*
     * Selo da faixa: na ÁgilMed o acento é o mesmo azul da faixa e o
     * círculo sumia; ali o selo fica branco com a sigla em azul.
     */
    '--selo': tema.acento === tema.principal ? '#ffffff' : tema.acento,
    '--no-selo': tema.acento === tema.principal ? tema.principal : tema.noAcento,
  } as CSSProperties

  return (
    <main className="login-page" style={cores}>
      <div className="login-card">
        <div className="login-faixa">
          <div className="login-marca">{marca === 'agilmed' ? 'AM' : 'RL'}</div>

          <div>
            <strong>{tema.nome}</strong>
            <span>Portal do Cliente</span>
          </div>
        </div>

        <div className="login-corpo">
          <h1>Entrar no portal</h1>

          <p>Chamados, treinamentos, certificados e documentos da sua empresa em um só lugar.</p>

          <form onSubmit={entrar} className="login-form">
            <label htmlFor="email">E-mail</label>

            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />

            <label htmlFor="senha">Senha</label>

            <input
              id="senha"
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              autoComplete="current-password"
            />

            {erro && (
              <div className="login-error" role="alert">
                {erro}
              </div>
            )}

            <button type="submit" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar no portal'}
            </button>
          </form>

          <p className="login-ajuda">
            Não tem acesso ou esqueceu a senha? Fale com a nossa equipe pelo mesmo contato de sempre.
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background: var(--bg);
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .login-faixa {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 22px 28px;
          background: var(--marca);
        }

        .login-marca {
          width: 46px;
          height: 46px;
          flex: none;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--selo);
          color: var(--no-selo);
          font-size: 16px;
          font-weight: 800;
        }

        .login-faixa strong {
          display: block;
          color: #ffffff;
          font-size: 17px;
          font-weight: 800;
        }

        .login-faixa span {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 13px;
          margin-top: 2px;
        }

        .login-corpo {
          padding: 28px;
        }

        .login-corpo h1 {
          margin: 0;
          color: var(--marca);
          font-size: 26px;
          line-height: 1.2;
        }

        .login-corpo > p {
          margin: 8px 0 24px;
          color: var(--ink-muted);
          font-size: 14.5px;
          line-height: 1.55;
        }

        .login-form {
          display: flex;
          flex-direction: column;
        }

        .login-form label {
          margin-bottom: 6px;
          color: var(--marca);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .login-form input {
          width: 100%;
          height: 50px;
          margin-bottom: 16px;
          padding: 0 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          outline: none;
          background: var(--surface-sunken);
          color: var(--ink);
          font-size: 15px;
          transition: border-color 0.15s ease;
        }

        .login-form input:focus {
          border-color: var(--marca);
          background: #ffffff;
        }

        .login-form button {
          width: 100%;
          min-height: 50px;
          margin-top: 6px;
          border: 0;
          border-radius: 999px;
          background: var(--acento);
          color: var(--no-acento);
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .login-form button:hover {
          background: var(--acento-hover);
        }

        .login-form button:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .login-error {
          margin: 0 0 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--danger-tint);
          color: var(--danger);
          font-size: 14px;
          font-weight: 600;
        }

        .login-ajuda {
          margin: 22px 0 0;
          padding-top: 18px;
          border-top: 1px solid var(--border);
          color: var(--ink-faint);
          font-size: 12.5px;
          line-height: 1.5;
        }

        @media (max-width: 520px) {
          .login-faixa {
            padding: 18px 20px;
          }

          .login-corpo {
            padding: 22px 20px;
          }

          .login-corpo h1 {
            font-size: 23px;
          }
        }
      `}</style>
    </main>
  )
}
