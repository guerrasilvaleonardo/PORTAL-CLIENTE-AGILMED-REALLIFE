'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  nome: string
  email: string | null
  empresa_id: string | null
  perfil: string
  ativo: boolean
}

type Empresa = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  email: string | null
  telefone: string | null
  cidade: string | null
  estado: string | null
  status: string
}

export default function HomePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)

  useEffect(() => {
    async function carregarDados() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !profileData) {
        console.error('Erro ao carregar perfil:', profileError)
        setLoading(false)
        return
      }

      setProfile(profileData)

      if (profileData.empresa_id) {
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', profileData.empresa_id)
          .single()

        if (empresaError) {
          console.error('Erro ao carregar empresa:', empresaError)
        } else {
          setEmpresa(empresaData)
        }
      }

      setLoading(false)
    }

    carregarDados()
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="loading-page">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <h2>Carregando portal...</h2>
          <p>Aguarde enquanto buscamos seus dados.</p>
        </div>

        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f7fa;
            padding: 24px;
          }

          .loading-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }

          .loading-spinner {
            width: 42px;
            height: 42px;
            margin: 0 auto 20px;
            border: 4px solid #dbe4e8;
            border-top-color: #0f766e;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          h2 {
            margin: 0 0 8px;
            color: #172033;
          }

          p {
            margin: 0;
            color: #64748b;
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

  return (
    <div className="portal-page">
      <header className="portal-header">
        <div className="header-inner">
          <div className="brand-area">
            <div className="brand-logo">
              AM
            </div>

            <div>
              <h1>ÁgilMed & Real Life</h1>
              <span>Portal do Cliente</span>
            </div>
          </div>

          <div className="header-user">
            <div className="user-info">
              <strong>{profile?.nome || 'Cliente'}</strong>
              <span>{profile?.email || ''}</span>
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

      <div className="portal-layout">
        <aside className="sidebar">
          <div className="sidebar-title">
            <span>MENU</span>
          </div>

          <nav className="menu">
            <Link
              href="/"
              className="menu-item active"
            >
              <span className="menu-icon">⌂</span>
              <span>Início</span>
            </Link>

            <Link
              href="/seguranca-do-trabalho"
              className="menu-item"
            >
              <span className="menu-icon">✓</span>
              <span>Segurança do Trabalho</span>
            </Link>

            <a
              href="#"
              className="menu-item"
            >
              <span className="menu-icon">♥</span>
              <span>Saúde Ocupacional</span>
            </a>

            <a
              href="#"
              className="menu-item"
            >
              <span className="menu-icon">▣</span>
              <span>Treinamentos</span>
            </a>

            <a
              href="#"
              className="menu-item"
            >
              <span className="menu-icon">▤</span>
              <span>Documentos</span>
            </a>

            <a
              href="#"
              className="menu-item"
            >
              <span className="menu-icon">▥</span>
              <span>Indicadores</span>
            </a>

            <a
              href="#"
              className="menu-item"
            >
              <span className="menu-icon">!</span>
              <span>Pendências</span>
            </a>

            <a
              href="#"
              className="menu-item"
            >
              <span className="menu-icon">⚙</span>
              <span>Configurações</span>
            </a>
          </nav>

          <div className="sidebar-footer">
            <div className="support-box">
              <strong>Precisa de ajuda?</strong>
              <span>Entre em contato com nossa equipe.</span>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <section className="welcome-section">
            <div>
              <span className="eyebrow">
                PORTAL DO CLIENTE
              </span>

              <h2>
                Olá, {profile?.nome?.split(' ')[0] || 'Cliente'}!
              </h2>

              <p>
                Bem-vindo ao seu ambiente exclusivo de gestão
                ÁgilMed & Real Life.
              </p>
            </div>

            <div className="welcome-status">
              <span className="status-dot"></span>
              Portal conectado
            </div>
          </section>

          <section className="company-bar">
            <div className="company-main">
              <div className="company-icon">
                {empresa?.nome_fantasia?.charAt(0) || 'E'}
              </div>

              <div>
                <span className="company-label">
                  EMPRESA
                </span>

                <strong>
                  {empresa?.nome_fantasia ||
                    empresa?.razao_social ||
                    'Empresa não cadastrada'}
                </strong>

                {empresa?.razao_social &&
                  empresa?.nome_fantasia &&
                  empresa.razao_social !== empresa.nome_fantasia && (
                    <small>
                      {empresa.razao_social}
                    </small>
                  )}
              </div>
            </div>

            <div className="company-status">
              <span
                className={
                  empresa?.status === 'ativo'
                    ? 'status-badge active'
                    : 'status-badge inactive'
                }
              >
                {empresa?.status === 'ativo'
                  ? 'Empresa ativa'
                  : 'Empresa inativa'}
              </span>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  VISÃO GERAL
                </span>

                <h3>
                  Acesso rápido
                </h3>
              </div>
            </div>

            <div className="modules-grid">
              <Link
                href="/seguranca-do-trabalho"
                className="module-card security-card"
              >
                <div className="module-top">
                  <div className="module-icon security">
                    ✓
                  </div>

                  <span className="module-arrow">
                    →
                  </span>
                </div>

                <h4>
                  Segurança do Trabalho
                </h4>

                <p>
                  Acesse documentos, inspeções,
                  ocorrências, planos de ação,
                  indicadores e informações de SST.
                </p>

                <span className="module-button">
                  Acessar módulo
                </span>
              </Link>

              <a
                href="#"
                className="module-card"
              >
                <div className="module-top">
                  <div className="module-icon health">
                    ♥
                  </div>

                  <span className="module-arrow">
                    →
                  </span>
                </div>

                <h4>
                  Saúde Ocupacional
                </h4>

                <p>
                  Acompanhe exames ocupacionais,
                  ASOs, programas médicos e
                  informações de saúde.
                </p>

                <span className="module-button disabled">
                  Em breve
                </span>
              </a>

              <a
                href="#"
                className="module-card"
              >
                <div className="module-top">
                  <div className="module-icon training">
                    ▣
                  </div>

                  <span className="module-arrow">
                    →
                  </span>
                </div>

                <h4>
                  Treinamentos
                </h4>

                <p>
                  Consulte treinamentos,
                  certificados, participantes
                  e vencimentos.
                </p>

                <span className="module-button disabled">
                  Em breve
                </span>
              </a>

              <a
                href="#"
                className="module-card"
              >
                <div className="module-top">
                  <div className="module-icon documents">
                    ▤
                  </div>

                  <span className="module-arrow">
                    →
                  </span>
                </div>

                <h4>
                  Documentos
                </h4>

                <p>
                  Consulte documentos,
                  laudos, procedimentos,
                  relatórios e registros.
                </p>

                <span className="module-button disabled">
                  Em breve
                </span>
              </a>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  EMPRESA
                </span>

                <h3>
                  Dados cadastrais
                </h3>
              </div>
            </div>

            <div className="company-details portal-card">
              <div className="detail-item">
                <span>Razão Social</span>
                <strong>
                  {empresa?.razao_social || 'Não informado'}
                </strong>
              </div>

              <div className="detail-item">
                <span>Nome Fantasia</span>
                <strong>
                  {empresa?.nome_fantasia || 'Não informado'}
                </strong>
              </div>

              <div className="detail-item">
                <span>CNPJ</span>
                <strong>
                  {empresa?.cnpj || 'Não informado'}
                </strong>
              </div>

              <div className="detail-item">
                <span>Telefone</span>
                <strong>
                  {empresa?.telefone || 'Não informado'}
                </strong>
              </div>

              <div className="detail-item">
                <span>E-mail</span>
                <strong>
                  {empresa?.email || 'Não informado'}
                </strong>
              </div>

              <div className="detail-item">
                <span>Localização</span>
                <strong>
                  {empresa?.cidade && empresa?.estado
                    ? `${empresa.cidade} - ${empresa.estado}`
                    : 'Não informado'}
                </strong>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  SUA CONTA
                </span>

                <h3>
                  Informações do usuário
                </h3>
              </div>
            </div>

            <div className="account-card portal-card">
              <div className="account-avatar">
                {profile?.nome?.charAt(0)?.toUpperCase() || 'C'}
              </div>

              <div className="account-info">
                <strong>
                  {profile?.nome || 'Cliente'}
                </strong>

                <span>
                  {profile?.email || 'E-mail não informado'}
                </span>

                <div className="account-tags">
                  <span>
                    Perfil: {profile?.perfil || 'cliente'}
                  </span>

                  <span>
                    {profile?.ativo
                      ? 'Usuário ativo'
                      : 'Usuário inativo'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <footer className="portal-footer">
            <span>
              ÁgilMed & Real Life
            </span>

            <span>
              Portal do Cliente
            </span>
          </footer>
        </main>
      </div>

      <style jsx>{`
        .portal-page {
          min-height: 100vh;
          background: #f5f7fa;
          color: #172033;
        }

        .portal-header {
          height: 76px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .header-inner {
          max-width: 1440px;
          height: 100%;
          margin: 0 auto;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand-area {
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
          letter-spacing: -0.5px;
        }

        .brand-area h1 {
          margin: 0;
          font-size: 16px;
          line-height: 1.2;
          color: #172033;
        }

        .brand-area span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .header-user {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          text-align: right;
        }

        .user-info strong {
          font-size: 14px;
          color: #172033;
        }

        .user-info span {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }

        .logout-button {
          border: 1px solid #d7dde5;
          background: #ffffff;
          color: #475569;
          border-radius: 9px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 700;
        }

        .logout-button:hover {
          border-color: #0f766e;
          color: #0f766e;
        }

        .portal-layout {
          max-width: 1440px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 250px minmax(0, 1fr);
          min-height: calc(100vh - 76px);
        }

        .sidebar {
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          padding: 28px 18px;
          display: flex;
          flex-direction: column;
        }

        .sidebar-title {
          padding: 0 12px 12px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
          color: #94a3b8;
        }

        .menu {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .menu-item {
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          transition: 0.2s ease;
        }

        .menu-item:hover {
          background: #f1f7f6;
          color: #0f766e;
        }

        .menu-item.active {
          background: #e9f5f3;
          color: #0f766e;
        }

        .menu-icon {
          width: 20px;
          text-align: center;
          font-size: 16px;
          font-weight: 800;
        }

        .sidebar-footer {
          margin-top: auto;
          padding-top: 24px;
        }

        .support-box {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
        }

        .support-box strong {
          display: block;
          font-size: 12px;
          color: #334155;
          margin-bottom: 5px;
        }

        .support-box span {
          display: block;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        .main-content {
          padding: 38px 42px 50px;
          min-width: 0;
        }

        .welcome-section {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.3px;
          color: #0f766e;
          margin-bottom: 8px;
        }

        .welcome-section h2 {
          margin: 0;
          font-size: 30px;
          line-height: 1.15;
          letter-spacing: -0.8px;
          color: #172033;
        }

        .welcome-section p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .welcome-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #dce9e6;
          background: #ffffff;
          color: #0f766e;
          padding: 9px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          background: #16a34a;
          border-radius: 50%;
        }

        .company-bar {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 34px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
        }

        .company-main {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .company-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          border-radius: 12px;
          background: #e9f5f3;
          color: #0f766e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
        }

        .company-label {
          display: block;
          font-size: 9px;
          letter-spacing: 1px;
          color: #94a3b8;
          font-weight: 800;
          margin-bottom: 3px;
        }

        .company-main strong {
          display: block;
          font-size: 15px;
          color: #172033;
        }

        .company-main small {
          display: block;
          color: #64748b;
          margin-top: 3px;
          font-size: 11px;
        }

        .status-badge {
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-badge.active {
          background: #eaf8ef;
          color: #15803d;
        }

        .status-badge.inactive {
          background: #fef2f2;
          color: #b91c1c;
        }

        .section {
          margin-bottom: 34px;
        }

        .section-heading {
          margin-bottom: 16px;
        }

        .section-heading h3 {
          margin: 0;
          font-size: 19px;
          color: #172033;
        }

        .modules-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .module-card {
          display: block;
          min-width: 0;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .module-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.09);
          border-color: #cbd5e1;
        }

        .security-card:hover {
          border-color: #8dd4ca;
        }

        .module-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .module-icon {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 17px;
        }

        .module-icon.security {
          background: #e9f5f3;
          color: #0f766e;
        }

        .module-icon.health {
          background: #fceef1;
          color: #be123c;
        }

        .module-icon.training {
          background: #eef2ff;
          color: #4f46e5;
        }

        .module-icon.documents {
          background: #fff7ed;
          color: #c2410c;
        }

        .module-arrow {
          color: #94a3b8;
          font-size: 18px;
        }

        .module-card h4 {
          margin: 0 0 8px;
          font-size: 15px;
          color: #172033;
        }

        .module-card p {
          min-height: 66px;
          margin: 0 0 18px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.6;
        }

        .module-button {
          display: block;
          width: 100%;
          padding: 10px 12px;
          border-radius: 9px;
          background: #0f766e;
          color: #ffffff;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
        }

        .module-button.disabled {
          background: #f1f5f9;
          color: #94a3b8;
        }

        .portal-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
        }

        .company-details {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          overflow: hidden;
        }

        .detail-item {
          padding: 18px 20px;
          border-right: 1px solid #eef2f7;
          border-bottom: 1px solid #eef2f7;
        }

        .detail-item span {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.6px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .detail-item strong {
          display: block;
          color: #334155;
          font-size: 13px;
          word-break: break-word;
        }

        .account-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
        }

        .account-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #0f766e;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
          flex: 0 0 50px;
        }

        .account-info strong {
          display: block;
          color: #172033;
          font-size: 15px;
        }

        .account-info > span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .account-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }

        .account-tags span {
          background: #f1f5f9;
          color: #64748b;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 700;
        }

        .portal-footer {
          padding-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #94a3b8;
          font-size: 11px;
        }

        @media (max-width: 1100px) {
          .modules-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .company-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .portal-layout {
            grid-template-columns: 220px minmax(0, 1fr);
          }

          .main-content {
            padding: 32px 28px 44px;
          }
        }

        @media (max-width: 800px) {
          .portal-header {
            height: auto;
          }

          .header-inner {
            padding: 14px 18px;
            gap: 15px;
          }

          .header-user {
            gap: 8px;
          }

          .user-info {
            display: none;
          }

          .portal-layout {
            display: block;
          }

          .sidebar {
            border-right: 0;
            border-bottom: 1px solid #e5e7eb;
            padding: 12px;
          }

          .sidebar-title,
          .sidebar-footer {
            display: none;
          }

          .menu {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .main-content {
            padding: 26px 18px 38px;
          }

          .welcome-section {
            display: block;
          }

          .welcome-status {
            margin-top: 16px;
          }

          .company-bar {
            align-items: flex-start;
            flex-direction: column;
          }

          .company-status {
            padding-left: 57px;
          }
        }

        @media (max-width: 600px) {
          .brand-area h1 {
            font-size: 14px;
          }

          .brand-area span {
            font-size: 10px;
          }

          .brand-logo {
            width: 38px;
            height: 38px;
          }

          .welcome-section h2 {
            font-size: 25px;
          }

          .modules-grid {
            grid-template-columns: 1fr;
          }

          .company-details {
            grid-template-columns: 1fr;
          }

          .detail-item {
            border-right: 0;
          }

          .portal-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }
        }
      `}</style>
    </div>
  )
}
