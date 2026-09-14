'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const categorias = [
  'Saúde Ocupacional',
  'Segurança do Trabalho',
  'Exames',
  'Treinamentos',
  'Documentos',
  'eSocial',
  'Atendimento administrativo',
  'Financeiro',
  'Outros',
]

const prioridades = [
  {
    value: 'baixa',
    label: 'Baixa',
    description: 'Pode ser tratado normalmente.',
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Atendimento dentro do prazo padrão.',
  },
  {
    value: 'alta',
    label: 'Alta',
    description: 'Necessita de atenção prioritária.',
  },
  {
    value: 'urgente',
    label: 'Urgente',
    description: 'Situação que precisa de atendimento imediato.',
  },
]

export default function NovoChamadoPage() {
  const router = useRouter()

  const [categoria, setCategoria] = useState('')
  const [assunto, setAssunto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState('normal')

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function abrirChamado(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setErro('')

    if (!categoria) {
      setErro('Selecione uma categoria.')
      return
    }

    if (!assunto.trim()) {
      setErro('Informe o assunto do chamado.')
      return
    }

    if (!descricao.trim()) {
      setErro('Descreva o que você precisa.')
      return
    }

    setEnviando(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, empresa_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        throw new Error(
          'Não foi possível identificar o perfil do usuário.',
        )
      }

      if (!profile.empresa_id) {
        throw new Error(
          'Seu usuário não está vinculado a uma empresa.',
        )
      }

      const { data: chamado, error: chamadoError } = await supabase
        .from('chamados')
        .insert({
          empresa_id: profile.empresa_id,
          criado_por: user.id,
          categoria,
          assunto: assunto.trim(),
          descricao: descricao.trim(),
          prioridade,
          status: 'aberto',
        })
        .select('id')
        .single()

      if (chamadoError || !chamado) {
        console.error('Erro ao criar chamado:', chamadoError)

        throw new Error(
          chamadoError?.message ||
            'Não foi possível abrir o chamado.',
        )
      }

      router.push(`/chamados/${chamado.id}`)
    } catch (error) {
      console.error(error)

      if (error instanceof Error) {
        setErro(error.message)
      } else {
        setErro('Não foi possível abrir o chamado.')
      }

      setEnviando(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <div className="brand-logo">AM</div>

            <div>
              <strong>ÁgilMed & Real Life</strong>
              <span>Portal do Cliente</span>
            </div>
          </Link>

          <Link href="/chamados" className="back-link">
            ← Meus chamados
          </Link>
        </div>
      </header>

      <main className="container">
        <div className="page-heading">
          <span className="eyebrow">ATENDIMENTO</span>

          <h1>Novo chamado</h1>

          <p>
            Descreva sua solicitação e nossa equipe entrará em contato
            pelo portal.
          </p>
        </div>

        <form onSubmit={abrirChamado} className="form-card">
          <div className="form-section">
            <div className="section-title">
              <span className="section-number">01</span>

              <div>
                <h2>Sobre o chamado</h2>
                <p>Informe o assunto da sua solicitação.</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="categoria">
                Categoria <span>*</span>
              </label>

              <select
                id="categoria"
                value={categoria}
                onChange={(event) => setCategoria(event.target.value)}
                disabled={enviando}
              >
                <option value="">Selecione uma categoria</option>

                {categorias.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="assunto">
                Assunto <span>*</span>
              </label>

              <input
                id="assunto"
                type="text"
                value={assunto}
                onChange={(event) => setAssunto(event.target.value)}
                placeholder="Ex.: Preciso agendar exame ocupacional"
                maxLength={150}
                disabled={enviando}
              />

              <small>
                Seja objetivo para facilitar a identificação da
                solicitação.
              </small>
            </div>

            <div className="field">
              <label htmlFor="descricao">
                Descrição <span>*</span>
              </label>

              <textarea
                id="descricao"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                placeholder="Descreva detalhadamente o que você precisa, incluindo informações importantes para nossa equipe."
                rows={7}
                maxLength={3000}
                disabled={enviando}
              />

              <small>
                {descricao.length}/3000 caracteres
              </small>
            </div>
          </div>

          <div className="divider" />

          <div className="form-section">
            <div className="section-title">
              <span className="section-number">02</span>

              <div>
                <h2>Prioridade</h2>
                <p>
                  Informe o nível de prioridade desta solicitação.
                </p>
              </div>
            </div>

            <div className="priority-grid">
              {prioridades.map((item) => (
                <label
                  key={item.value}
                  className={`priority-option ${
                    prioridade === item.value ? 'selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="prioridade"
                    value={item.value}
                    checked={prioridade === item.value}
                    onChange={(event) =>
                      setPrioridade(event.target.value)
                    }
                    disabled={enviando}
                  />

                  <span className="radio-mark" />

                  <span className="priority-content">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="divider" />

          <div className="attachment-info">
            <div className="attachment-icon">📎</div>

            <div>
              <strong>Anexos</strong>

              <p>
                Os anexos poderão ser adicionados ao chamado após sua
                abertura.
              </p>
            </div>
          </div>

          {erro && (
            <div className="error-message">
              <strong>Não foi possível abrir o chamado.</strong>
              <span>{erro}</span>
            </div>
          )}

          <div className="form-actions">
            <Link
              href="/chamados"
              className={`cancel-button ${
                enviando ? 'disabled-link' : ''
              }`}
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="submit-button"
              disabled={enviando}
            >
              {enviando ? 'Abrindo chamado...' : 'Abrir chamado'}
            </button>
          </div>
        </form>

        <div className="security-note">
          <span>🔒</span>

          <p>
            As informações enviadas são vinculadas à sua empresa e
            ficam disponíveis apenas para os usuários autorizados.
          </p>
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f5f7fa;
          color: #172033;
        }

        .header {
          height: 76px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
        }

        .header-inner {
          max-width: 1100px;
          height: 100%;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: #0f766e;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
        }

        .brand strong {
          display: block;
          font-size: 15px;
        }

        .brand span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .back-link {
          color: #0f766e;
          font-size: 13px;
          font-weight: 700;
        }

        .container {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 42px 24px 60px;
        }

        .page-heading {
          margin-bottom: 28px;
        }

        .eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #0f766e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        .page-heading h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.7px;
        }

        .page-heading p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }

        .form-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 5px 18px rgba(15, 23, 42, 0.05);
          overflow: hidden;
        }

        .form-section {
          padding: 28px;
        }

        .section-title {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-bottom: 25px;
        }

        .section-number {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border-radius: 9px;
          background: #e9f5f3;
          color: #0f766e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
        }

        .section-title h2 {
          margin: 0;
          font-size: 17px;
        }

        .section-title p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .field {
          margin-bottom: 21px;
        }

        .field:last-child {
          margin-bottom: 0;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .field label span {
          color: #dc2626;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          border: 1px solid #d7dde5;
          border-radius: 9px;
          background: #ffffff;
          color: #172033;
          outline: none;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .field input,
        .field select {
          height: 44px;
          padding: 0 13px;
          font-size: 13px;
        }

        .field textarea {
          min-height: 150px;
          padding: 12px 13px;
          resize: vertical;
          font-size: 13px;
          line-height: 1.6;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
        }

        .field input::placeholder,
        .field textarea::placeholder {
          color: #a1aab8;
        }

        .field small {
          display: block;
          margin-top: 6px;
          color: #94a3b8;
          font-size: 10px;
        }

        .divider {
          height: 1px;
          background: #eef2f7;
        }

        .priority-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .priority-option {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .priority-option:hover {
          border-color: #a7d5cf;
          background: #f8fcfb;
        }

        .priority-option.selected {
          border-color: #0f766e;
          background: #f1faf8;
        }

        .priority-option input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .radio-mark {
          width: 16px;
          height: 16px;
          flex: 0 0 16px;
          margin-top: 2px;
          border: 1px solid #cbd5e1;
          border-radius: 50%;
          position: relative;
        }

        .priority-option.selected .radio-mark {
          border-color: #0f766e;
        }

        .priority-option.selected .radio-mark::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #0f766e;
          top: 3px;
          left: 3px;
        }

        .priority-content strong {
          display: block;
          color: #334155;
          font-size: 12px;
        }

        .priority-content small {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.4;
        }

        .attachment-info {
          margin: 22px 28px 0;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px dashed #cbd5e1;
          border-radius: 11px;
          background: #f8fafc;
        }

        .attachment-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }

        .attachment-info strong {
          display: block;
          color: #334155;
          font-size: 12px;
        }

        .attachment-info p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 10px;
        }

        .error-message {
          margin: 22px 28px 0;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
        }

        .error-message strong {
          display: block;
          font-size: 12px;
        }

        .error-message span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
        }

        .form-actions {
          margin-top: 26px;
          padding: 20px 28px;
          border-top: 1px solid #eef2f7;
          background: #fafbfc;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .cancel-button,
        .submit-button {
          min-height: 42px;
          border-radius: 9px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .cancel-button {
          border: 1px solid #d7dde5;
          background: #ffffff;
          color: #475569;
        }

        .submit-button {
          border: 0;
          background: #0f766e;
          color: #ffffff;
          cursor: pointer;
        }

        .submit-button:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .disabled-link {
          pointer-events: none;
          opacity: 0.5;
        }

        .security-note {
          margin-top: 15px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 0 5px;
          color: #94a3b8;
        }

        .security-note span {
          font-size: 12px;
        }

        .security-note p {
          margin: 0;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 750px) {
          .priority-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .header {
            height: auto;
          }

          .header-inner {
            padding: 14px 18px;
          }

          .container {
            padding: 28px 16px 40px;
          }

          .page-heading h1 {
            font-size: 25px;
          }

          .form-section {
            padding: 22px 18px;
          }

          .attachment-info {
            margin-left: 18px;
            margin-right: 18px;
          }

          .form-actions {
            padding: 18px;
          }

          .priority-grid {
            grid-template-columns: 1fr;
          }

          .back-link {
            font-size: 11px;
          }

          .brand strong {
            font-size: 13px;
          }
        }
      `}
      </style>
    </div>
  )
}
