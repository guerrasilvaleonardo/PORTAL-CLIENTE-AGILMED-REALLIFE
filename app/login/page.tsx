'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

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

  return (
    <main className="login-page">
      <div className="login-background">
        <div className="login-card">

          <div className="login-brand">
            <div className="brand-mark">A</div>

            <div>
              <strong>ÁgilMed</strong>
              <span>& Real Life</span>
            </div>
          </div>

          <div className="login-header">
            <h1>Acesso ao Portal</h1>

            <p>
              Entre com seus dados para acessar os serviços da sua empresa.
            </p>
          </div>

          <form onSubmit={entrar} className="login-form">

            <label htmlFor="email">
              E-mail
            </label>

            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />

            <label htmlFor="senha">
              Senha
            </label>

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
              <div className="login-error">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
            >
              {carregando
                ? 'Entrando...'
                : 'Entrar no Portal'}
            </button>

          </form>

          <div className="login-footer">
            <span>Portal do Cliente</span>
            <span>ÁgilMed & Real Life</span>
          </div>

        </div>
      </div>

      <style jsx>{`

        .login-page {
          min-height: 100vh;
          background: #f4f7fb;
        }

        .login-background {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;

          background:
            radial-gradient(
              circle at top left,
              rgba(14, 165, 233, 0.12),
              transparent 35%
            ),
            radial-gradient(
              circle at bottom right,
              rgba(16, 185, 129, 0.10),
              transparent 35%
            ),
            #f4f7fb;
        }

        .login-card {
          width: 100%;
          max-width: 460px;

          background: #ffffff;

          border: 1px solid #e5e7eb;
          border-radius: 24px;

          padding: 40px;

          box-shadow:
            0 24px 70px rgba(15, 23, 42, 0.12);
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 12px;

          margin-bottom: 36px;
        }

        .brand-mark {
          width: 46px;
          height: 46px;

          border-radius: 14px;

          display: flex;
          align-items: center;
          justify-content: center;

          background:
            linear-gradient(
              135deg,
              #0f766e,
              #0ea5e9
            );

          color: #ffffff;

          font-size: 22px;
          font-weight: 800;
        }

        .login-brand strong {
          display: block;

          color: #172033;

          font-size: 18px;
        }

        .login-brand span {
          display: block;

          color: #64748b;

          font-size: 13px;

          margin-top: 2px;
        }

        .login-header h1 {
          margin: 0;

          color: #172033;

          font-size: 30px;
          line-height: 1.15;

          letter-spacing: -0.7px;
        }

        .login-header p {
          margin: 10px 0 28px;

          color: #64748b;

          font-size: 15px;
          line-height: 1.6;
        }

        .login-form {
          display: flex;
          flex-direction: column;
        }

        .login-form label {
          margin-bottom: 8px;

          color: #334155;

          font-size: 14px;
          font-weight: 700;
        }

        .login-form input {
          width: 100%;
          height: 52px;

          margin-bottom: 18px;

          padding: 0 15px;

          border: 1px solid #d7dee8;
          border-radius: 12px;

          outline: none;

          background: #ffffff;

          color: #172033;

          font-size: 15px;

          transition: 0.2s ease;
        }

        .login-form input:focus {
          border-color: #0ea5e9;

          box-shadow:
            0 0 0 4px rgba(14, 165, 233, 0.10);
        }

        .login-form button {
          width: 100%;
          height: 52px;

          margin-top: 6px;

          border: 0;
          border-radius: 12px;

          background:
            linear-gradient(
              135deg,
              #0f766e,
              #0ea5e9
            );

          color: #ffffff;

          font-size: 15px;
          font-weight: 800;

          cursor: pointer;

          transition: 0.2s ease;
        }

        .login-form button:hover {
          transform: translateY(-1px);

          box-shadow:
            0 10px 24px rgba(14, 165, 233, 0.22);
        }

        .login-form button:disabled {
          opacity: 0.7;

          cursor: wait;

          transform: none;
        }

        .login-error {
          margin: 0 0 14px;

          padding: 12px 14px;

          border-radius: 10px;

          background: #fef2f2;

          border: 1px solid #fecaca;

          color: #b91c1c;

          font-size: 14px;
        }

        .login-footer {
          display: flex;
          justify-content: space-between;

          gap: 16px;

          margin-top: 28px;
          padding-top: 20px;

          border-top: 1px solid #eef2f7;

          color: #94a3b8;

          font-size: 12px;
        }

        @media (max-width: 520px) {

          .login-card {
            padding: 28px 22px;
            border-radius: 20px;
          }

          .login-header h1 {
            font-size: 26px;
          }

          .login-footer {
            flex-direction: column;
            gap: 6px;
          }

        }

      `}</style>
    </main>
  )
}
