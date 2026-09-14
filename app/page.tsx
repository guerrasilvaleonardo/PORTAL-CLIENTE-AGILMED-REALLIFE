'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
  email: string | null
  telefone: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  status: string | null
}

type Profile = {
  id: string
  nome: string | null
  email: string | null
  empresa_id: string | null
  perfil: string | null
  ativo: boolean | null
}

export default function Home() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true)
      setErro('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(
            `Erro ao verificar usuário: ${userError.message}`
          )
        }

        if (!user) {
          router.replace('/login')
          return
        }

        /*
         * BUSCA O PERFIL DO USUÁRIO
         */
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          throw new Error(
            `Erro ao carregar o perfil: ${profileError.message}`
          )
        }

        if (!profileData) {
          throw new Error(
            'Perfil do usuário não encontrado no banco de dados.'
          )
        }

        setProfile(profileData)

        /*
         * VERIFICA SE O PERFIL POSSUI EMPRESA
         */
        if (!profileData.empresa_id) {
          throw new Error(
            'O usuário está sem empresa vinculada no cadastro de perfil.'
          )
        }

        /*
         * BUSCA A EMPRESA PELO empresa_id
         */
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', profileData.empresa_id)
          .maybeSingle()

        if (empresaError) {
          throw new Error(
            `Erro ao carregar a empresa: ${empresaError.message}`
          )
        }

        if (!empresaData) {
          throw new Error(
            `Empresa não encontrada para o ID: ${profileData.empresa_id}`
          )
        }

        setEmpresa(empresaData)
      } catch (error) {
        console.error(error)

        if (error instanceof Error) {
          setErro(error.message)
        } else {
          setErro('Ocorreu um erro inesperado ao carregar o portal.')
        }
      } finally {
        setCarregando(false)
      }
    }

    carregarDados()
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (carregando) {
    return (
      <main className="loading-page">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Carregando seu portal...</h2>
          <p>Estamos buscando os dados da sua empresa.</p>
        </div>

        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f5f7fa;
          }

          .loading-card {
            width: 100%;
            max-width: 420px;
            padding: 40px 30px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }

          .loading-spinner {
            width: 42px;
            height: 42px;
            margin: 0 auto 20px;
            border: 4px solid #e5e7eb;
            border-top-color: #0f766e;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin: 0 0 8px;
            color: #172033;
            font-size: 22px;
          }

          p {
            margin: 0;
            color: #64748b;
            font-size: 15px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    )
  }

  const nomeUsuario =
    profile?.nome ||
    profile?.email ||
    'Cliente'

  const nomeEmpresa =
    empresa?.nome_fantasia ||
    empresa?.razao_social ||
    'Empresa não identificada'

  const statusEmpresa =
    empresa?.status === 'ativo'
      ? 'Cadastro ativo'
      : 'Cadastro inativo'

  const inicial =
    nomeUsuario.charAt(0).toUpperCase()

  return (
    <main className="dashboard">
      <header className="portal-header">
        <div className="portal-container header-content">
          <div className="brand-area">
            <div className="brand-logo">
              AM
            </div>

            <div>
              <strong>ÁgilMed</strong>
              <span>& Real Life</span>
            </div>
          </div>

          <div className="user-area">
            <div className="user-avatar">
              {inicial}
            </div>

            <div className="user-info">
              <strong>{nomeUsuario}</strong>
              <span>{profile?.email || 'Cliente'}</span>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={sair}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="portal-container page-content">
        <aside className="sidebar">
          <div className="sidebar-title">
            Portal do Cliente
          </div>

          <nav>
            <a href="#" className="menu-item active">
              <span>⌂</span>
              Início
            </a>

            <a href="#" className="menu-item">
              <span>✓</span>
              Segurança do Trabalho
            </a>

            <a href="#" className="menu-item">
              <span>♥</span>
              Saúde Ocupacional
            </a>

            <a href="#" className="menu-item">
              <span>▣</span>
              Treinamentos
            </a>

            <a href="#" className="menu-item">
              <span>▤</span>
              Documentos
            </a>

            <a href="#" className="menu-item">
              <span>▥</span>
              Indicadores
            </a>

            <a href="#" className="menu-item">
              <span>!</span>
              Pendências
            </a>

            <a href="#" className="menu-item">
              <span>⚙</span>
              Configurações
            </a>
          </nav>
        </aside>

        <section className="content">
          <div className="welcome-card">
            <div>
              <span className="welcome-label">
                PORTAL DO CLIENTE
              </span>

              <h1>
                Olá, {nomeUsuario.split(' ')[0]}!
              </h1>

              <p>
                Acompanhe documentos, exames, treinamentos,
                indicadores e pendências da sua empresa.
              </p>
            </div>

            <div className="welcome-icon">
              ✓
            </div>
          </div>

          {erro && (
            <div className="error-card">
              <strong>Não foi possível carregar todos os dados.</strong>

              <p>{erro}</p>

              <small>
                O login está funcionando, mas precisamos verificar
                o vínculo entre o usuário e a empresa.
              </small>
            </div>
          )}

          <div className="company-bar">
            <div>
              <span>EMPRESA</span>

              <strong>
                {nomeEmpresa}
              </strong>
            </div>

            <div>
              <span>CNPJ</span>

              <strong>
                {empresa?.cnpj || 'Não informado'}
              </strong>
            </div>

            <div>
              <span>STATUS</span>

              <strong
                className={
                  empresa?.status === 'ativo'
                    ? 'status-active'
                    : 'status-inactive'
                }
              >
                {statusEmpresa}
              </strong>
            </div>
          </div>

          <div className="section-heading">
            <div>
              <span className="section-label">
                VISÃO GERAL
              </span>

              <h2>
                Acompanhe sua empresa
              </h2>
            </div>
          </div>

          <div className="cards-grid">
            <div className="portal-card module-card">
              <div className="module-icon">
                ✓
              </div>

              <h3>
                Segurança do Trabalho
              </h3>

              <p>
                Acesse documentos, inspeções,
                ocorrências e informações de SST.
              </p>

              <button type="button">
                Acessar
              </button>
            </div>

            <div className="portal-card module-card">
              <div className="module-icon">
                ♥
              </div>

              <h3>
                Saúde Ocupacional
              </h3>

              <p>
                Consulte exames ocupacionais,
                ASOs e informações de saúde.
              </p>

              <button type="button">
                Acessar
              </button>
            </div>

            <div className="portal-card module-card">
              <div className="module-icon">
                ▣
              </div>

              <h3>
                Treinamentos
              </h3>

              <p>
                Acompanhe treinamentos, certificados
                e vencimentos.
              </p>

              <button type="button">
                Acessar
              </button>
            </div>

            <div className="portal-card module-card">
              <div className="module-icon">
                ▤
              </div>

              <h3>
                Documentos
              </h3>

              <p>
                Consulte documentos e arquivos
                disponibilizados para sua empresa.
              </p>

              <button type="button">
                Acessar
              </button>
            </div>
          </div>

          <div className="bottom-grid">
            <div className="portal-card information-card">
              <div className="card-heading">
                <div>
                  <span className="section-label">
                    EMPRESA
                  </span>

                  <h2>
                    Dados cadastrais
                  </h2>
                </div>
              </div>

              <div className="data-grid">
                <div className="data-item">
                  <span>Razão Social</span>
                  <strong>
                    {empresa?.razao_social || 'Não informado'}
                  </strong>
                </div>

                <div className="data-item">
                  <span>Nome Fantasia</span>
                  <strong>
                    {empresa?.nome_fantasia || 'Não informado'}
                  </strong>
                </div>

                <div className="data-item">
                  <span>CNPJ</span>
                  <strong>
                    {empresa?.cnpj || 'Não informado'}
                  </strong>
                </div>

                <div className="data-item">
                  <span>Telefone</span>
                  <strong>
                    {empresa?.telefone || 'Não informado'}
                  </strong>
                </div>

                <div className="data-item">
                  <span>E-mail</span>
                  <strong>
                    {empresa?.email || 'Não informado'}
                  </strong>
                </div>

                <div className="data-item">
                  <span>Cidade / Estado</span>
                  <strong>
                    {empresa?.cidade
                      ? `${empresa.cidade} / ${empresa.estado || ''}`
                      : 'Não informado'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="portal-card account-card">
              <span className="section-label">
                MINHA CONTA
              </span>

              <h2>
                {nomeUsuario}
              </h2>

              <p>
                {profile?.email || 'E-mail não informado'}
              </p>

              <div className="account-status">
                <span />
                Conta ativa
              </div>

              <button
                type="button"
                className="account-logout"
                onClick={sair}
              >
                Encerrar sessão
              </button>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: #f5f7fa;
        }

        .portal-container {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 28px;
        }

        .portal-header {
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
        }

        .header-content {
          min-height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .brand-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #0f766e;
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
        }

        .brand-area strong {
          color: #172033;
          font-size: 19px;
        }

        .brand-area span {
          color: #64748b;
          font-size: 19px;
        }

        .user-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #dff5f1;
          color: #0f766e;
          font-weight: 800;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-right: 10px;
        }

        .user-info strong {
          color: #172033;
          font-size: 14px;
        }

        .user-info span {
          color: #64748b;
          font-size: 12px;
        }

        .logout-button,
        .account-logout {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #475569;
          border-radius: 9px;
          padding: 9px 14px;
          font-weight: 700;
          transition: 0.2s ease;
        }

        .logout-button:hover,
        .account-logout:hover {
          border-color: #0f766e;
          color: #0f766e;
        }

        .page-content {
          display: grid;
          grid-template-columns: 235px minmax(0, 1fr);
          gap: 28px;
          padding-top: 28px;
          padding-bottom: 50px;
        }

        .sidebar {
          align-self: start;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 18px;
          position: sticky;
          top: 20px;
        }

        .sidebar-title {
          color: #172033;
          font-size: 14px;
          font-weight: 800;
          margin: 4px 10px 14px;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          border-radius: 10px;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          transition: 0.2s ease;
        }

        .menu-item span {
          width: 20px;
          text-align: center;
          font-weight: 800;
        }

        .menu-item:hover,
        .menu-item.active {
          background: #eaf7f5;
          color: #0f766e;
        }

        .content {
          min-width: 0;
        }

        .welcome-card {
          min-height: 190px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          padding: 34px;
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            #0f766e 0%,
            #115e59 100%
          );
          color: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 118, 110, 0.18);
        }

        .welcome-label,
        .section-label {
          display: block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .welcome-label {
          color: #b8ebe5;
          margin-bottom: 8px;
        }

        .welcome-card h1 {
          margin: 0 0 8px;
          font-size: 32px;
          line-height: 1.1;
        }

        .welcome-card p {
          max-width: 650px;
          margin: 0;
          color: #d9f5f2;
          line-height: 1.6;
          font-size: 15px;
        }

        .welcome-icon {
          width: 76px;
          height: 76px;
          flex: 0 0 76px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.12);
          font-size: 32px;
          font-weight: 800;
        }

        .error-card {
          margin-top: 20px;
          padding: 18px 20px;
          border: 1px solid #fecaca;
          border-radius: 14px;
          background: #fff7f7;
          color: #991b1b;
        }

        .error-card strong {
          display: block;
          margin-bottom: 6px;
        }

        .error-card p {
          margin: 0 0 6px;
          font-size: 14px;
        }

        .error-card small {
          color: #b91c1c;
        }

        .company-bar {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 20px;
          margin-top: 20px;
          padding: 20px 22px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
        }

        .company-bar div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .company-bar span {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .company-bar strong {
          color: #172033;
          font-size: 14px;
        }

        .status-active {
          color: #15803d !important;
        }

        .status-inactive {
          color: #b91c1c !important;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          margin: 32px 0 16px;
        }

        .section-label {
          color: #0f766e;
          margin-bottom: 5px;
        }

        .section-heading h2,
        .card-heading h2,
        .account-card h2 {
          margin: 0;
          color: #172033;
          font-size: 21px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .portal-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 5px 15px rgba(15, 23, 42, 0.05);
        }

        .module-card {
          padding: 22px;
          transition: 0.2s ease;
        }

        .module-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.09);
        }

        .module-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #eaf7f5;
          color: #0f766e;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .module-card h3 {
          margin: 0 0 8px;
          color: #172033;
          font-size: 16px;
        }

        .module-card p {
          min-height: 66px;
          margin: 0 0 18px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
        }

        .module-card button {
          width: 100%;
          border: 0;
          border-radius: 9px;
          padding: 10px;
          background: #0f766e;
          color: #ffffff;
          font-weight: 700;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
          gap: 16px;
          margin-top: 20px;
        }

        .information-card,
        .account-card {
          padding: 24px;
        }

        .card-heading {
          margin-bottom: 20px;
        }

        .data-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .data-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 13px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .data-item span {
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
        }

        .data-item strong {
          color: #334155;
          font-size: 13px;
        }

        .account-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .account-card h2 {
          margin-top: 8px;
        }

        .account-card p {
          margin: 6px 0 18px;
          color: #64748b;
          font-size: 13px;
          word-break: break-word;
        }

        .account-status {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #15803d;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 20px;
        }

        .account-status span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
        }

        @media (max-width: 1100px) {
          .cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .page-content {
            grid-template-columns: 200px minmax(0, 1fr);
          }
        }

        @media (max-width: 850px) {
          .page-content {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
          }

          nav {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }

          .company-bar,
          .bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .portal-container {
            padding-left: 16px;
            padding-right: 16px;
          }

          .header-content {
            min-height: 68px;
          }

          .user-info {
            display: none;
          }

          .welcome-card {
            padding: 26px;
          }

          .welcome-card h1 {
            font-size: 27px;
          }

          .welcome-icon {
            display: none;
          }

          .cards-grid {
            grid-template-columns: 1fr;
          }

          .data-grid {
            grid-template-columns: 1fr;
          }

          nav {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
