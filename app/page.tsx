'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const menuItems = [
  { icon: '🏠', label: 'Início' },
  { icon: '🦺', label: 'Segurança do Trabalho' },
  { icon: '🩺', label: 'Saúde Ocupacional' },
  { icon: '📚', label: 'Treinamentos' },
  { icon: '📄', label: 'Documentos' },
  { icon: '📊', label: 'Indicadores' },
  { icon: '🔔', label: 'Pendências' },
]

const cards = [
  {
    icon: '🩺',
    title: 'Saúde Ocupacional',
    text: 'Acompanhe ASOs, exames e informações ocupacionais.',
  },
  {
    icon: '📚',
    title: 'Treinamentos',
    text: 'Consulte treinamentos, validade e certificados.',
  },
  {
    icon: '📄',
    title: 'Documentos',
    text: 'Acesse os documentos disponibilizados para sua empresa.',
  },
  {
    icon: '🔔',
    title: 'Pendências',
    text: 'Acompanhe itens que precisam da atenção da empresa.',
  },
]

type Empresa = {
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  status: string
}

type Profile = {
  nome: string
  email: string | null
  perfil: string
  empresa_id: string | null
}

export default function Home() {
  const router = useRouter()

  const [menuOpen, setMenuOpen] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true)
      setErro('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select('nome, email, perfil, empresa_id')
          .eq('id', user.id)
          .single()

      if (profileError) {
        console.error(profileError)

        setErro(
          'Não foi possível carregar o perfil do usuário.'
        )

        setCarregando(false)
        return
      }

      setProfile(profileData)

      if (profileData.empresa_id) {
        const { data: empresaData, error: empresaError } =
          await supabase
            .from('empresas')
            .select(
              'razao_social, nome_fantasia, cnpj, status'
            )
            .eq('id', profileData.empresa_id)
            .single()

        if (empresaError) {
          console.error(empresaError)

          setErro(
            'Não foi possível carregar os dados da empresa.'
          )
        } else {
          setEmpresa(empresaData)
        }
      }

      setCarregando(false)
    }

    carregarDados()
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const nomeUsuario =
    profile?.nome ||
    'Cliente'

  const primeiraLetra =
    nomeUsuario
      .trim()
      .charAt(0)
      .toUpperCase() || 'C'

  const nomeEmpresa =
    empresa?.nome_fantasia ||
    empresa?.razao_social ||
    'Empresa não identificada'

  const statusEmpresa =
    empresa?.status === 'ativo'
      ? 'Cadastro ativo'
      : 'Cadastro inativo'

  return (
    <main className="portal">

      <aside
        className={`sidebar ${
          menuOpen ? 'open' : ''
        }`}
      >

        <div className="brand">

          <div className="brand-mark">
            A
          </div>

          <div>
            <strong>ÁgilMed</strong>
            <span>Real Life</span>
          </div>

        </div>

        <div className="menu-title">
          MENU PRINCIPAL
        </div>

        <nav>
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              className={`menu-item ${
                index === 0 ? 'active' : ''
              }`}
              onClick={() =>
                setMenuOpen(false)
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">

          <button className="menu-item">
            <span>⚙️</span>
            <span>Configurações</span>
          </button>

          <div className="support">

            <div className="support-icon">
              ?
            </div>

            <div>
              <strong>
                Precisa de ajuda?
              </strong>

              <span>
                Fale com nossa equipe
              </span>
            </div>

          </div>

        </div>

      </aside>

      <section className="content">

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() =>
              setMenuOpen(!menuOpen)
            }
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <div>

            <span className="breadcrumb">
              Portal do Cliente
            </span>

            <h1>
              {carregando
                ? 'Carregando...'
                : `Olá, ${nomeUsuario}! 👋`}
            </h1>

          </div>

          <div className="top-actions">

            <button
              className="notification"
              aria-label="Notificações"
            >
              🔔
            </button>

            <div className="profile">

              <div className="avatar">
                {primeiraLetra}
              </div>

              <div className="profile-text">

                <strong>
                  {nomeUsuario}
                </strong>

                <span>
                  {empresa
                    ? nomeEmpresa
                    : 'Minha empresa'}
                </span>

              </div>

              <button
                className="logout-button"
                onClick={sair}
                title="Sair"
              >
                ↪
              </button>

            </div>

          </div>

        </header>

        <div className="container">

          <section className="welcome-card">

            <div>

              <span className="eyebrow">
                ÁGILMED | REAL LIFE
              </span>

              <h2>
                Segurança, saúde e gestão
                <br />
                em um só lugar.
              </h2>

              <p>
                Acompanhe documentos, exames,
                treinamentos, indicadores e
                pendências da sua empresa.
              </p>

            </div>

            <div className="welcome-decoration">

              <div className="circle circle-one" />

              <div className="circle circle-two" />

              <div className="shield">
                ✓
              </div>

            </div>

          </section>

          {erro && (

            <div className="error-box">
              ⚠️ {erro}
            </div>

          )}

          <section className="company-bar">

            <div>

              <span>EMPRESA</span>

              <strong>
                {carregando
                  ? 'Carregando...'
                  : nomeEmpresa}
              </strong>

            </div>

            <div>

              <span>CNPJ</span>

              <strong>
                {carregando
                  ? 'Carregando...'
                  : empresa?.cnpj || 'Não informado'}
              </strong>

            </div>

            <div>

              <span>STATUS</span>

              <strong className="status">

                <i />

                {carregando
                  ? 'Carregando...'
                  : statusEmpresa}

              </strong>

            </div>

          </section>

          <div className="section-heading">

            <div>

              <span className="eyebrow dark">
                VISÃO GERAL
              </span>

              <h2>
                Serviços da sua empresa
              </h2>

            </div>

          </div>

          <section className="cards-grid">

            {cards.map((card) => (

              <article
                className="dashboard-card"
                key={card.title}
              >

                <div className="card-top">

                  <div className="card-icon">
                    {card.icon}
                  </div>

                  <span className="card-arrow">
                    →
                  </span>

                </div>

                <h3>
                  {card.title}
                </h3>

                <div className="card-value">
                  <span className="available">
                    Acessar
                  </span>
                </div>

                <p>
                  {card.text}
                </p>

              </article>

            ))}

          </section>

          <section className="lower-grid">

            <article className="panel">

              <div className="panel-header">

                <div>

                  <span className="eyebrow dark">
                    EMPRESA
                  </span>

                  <h2>
                    Dados cadastrais
                  </h2>

                </div>

              </div>

              <div className="company-details">

                <div>
                  <span>
                    Razão Social
                  </span>

                  <strong>
                    {empresa?.razao_social ||
                      'Não informado'}
                  </strong>
                </div>

                <div>
                  <span>
                    Nome Fantasia
                  </span>

                  <strong>
                    {empresa?.nome_fantasia ||
                      'Não informado'}
                  </strong>
                </div>

                <div>
                  <span>
                    CNPJ
                  </span>

                  <strong>
                    {empresa?.cnpj ||
                      'Não informado'}
                  </strong>
                </div>

              </div>

            </article>

            <article className="panel activity-panel">

              <div className="panel-header">

                <div>

                  <span className="eyebrow dark">
                    ACESSO
                  </span>

                  <h2>
                    Minha conta
                  </h2>

                </div>

              </div>

              <div className="account-info">

                <div className="account-avatar">
                  {primeiraLetra}
                </div>

                <div>

                  <strong>
                    {nomeUsuario}
                  </strong>

                  <span>
                    {profile?.email ||
                      'E-mail não informado'}
                  </span>

                  <span>
                    Perfil: {profile?.perfil ||
                      'cliente'}
                  </span>

                </div>

              </div>

              <button
                className="logout-large"
                onClick={sair}
              >
                Sair do Portal
              </button>

            </article>

          </section>

          <footer className="footer">

            <span>
              © 2026 ÁgilMed | Real Life Engenharia
            </span>

            <span>
              Portal do Cliente
            </span>

          </footer>

        </div>

      </section>

      <style jsx>{`

        .portal {
          min-height: 100vh;
          background: #f4f7fb;
          color: #172033;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          display: flex;
        }

        .sidebar {
          width: 265px;
          min-height: 100vh;
          background: #ffffff;
          border-right: 1px solid #e5eaf1;
          padding: 28px 18px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px 32px;
        }

        .brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background:
            linear-gradient(
              135deg,
              #0d4f82,
              #1474b8
            );
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          box-shadow:
            0 8px 18px
            rgba(13, 79, 130, 0.2);
        }

        .brand strong {
          display: block;
          font-size: 19px;
          color: #123f68;
        }

        .brand span {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: #7b8798;
        }

        .menu-title {
          padding: 0 13px 10px;
          font-size: 10px;
          font-weight: 700;
          color: #9aa5b4;
          letter-spacing: 1.2px;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .menu-item {
          width: 100%;
          border: 0;
          background: transparent;
          color: #667387;
          border-radius: 11px;
          padding: 12px 13px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .menu-item span:first-child {
          width: 23px;
          text-align: center;
          font-size: 17px;
        }

        .menu-item:hover {
          background: #f0f5fa;
          color: #0d4f82;
        }

        .menu-item.active {
          background: #eaf3fa;
          color: #0d4f82;
          font-weight: 700;
        }

        .sidebar-bottom {
          margin-top: auto;
        }

        .support {
          margin-top: 22px;
          padding: 14px;
          background: #f4f8fc;
          border-radius: 14px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .support-icon {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #0d4f82;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .support strong {
          display: block;
          font-size: 11px;
          color: #26384e;
        }

        .support span {
          display: block;
          margin-top: 3px;
          font-size: 10px;
          color: #8490a0;
        }

        .content {
          flex: 1;
          min-width: 0;
        }

        .topbar {
          height: 86px;
          background: #ffffff;
          border-bottom: 1px solid #e5eaf1;
          padding: 0 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .breadcrumb {
          color: #8490a0;
          font-size: 11px;
        }

        .topbar h1 {
          margin: 5px 0 0;
          font-size: 21px;
          color: #172c42;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .notification {
          position: relative;
          border: 0;
          background: transparent;
          font-size: 19px;
          cursor: pointer;
        }

        .profile {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar,
        .account-avatar {
          width: 37px;
          height: 37px;
          border-radius: 50%;
          background: #e7f1f8;
          color: #0d4f82;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .profile-text strong {
          display: block;
          font-size: 12px;
        }

        .profile-text span {
          display: block;
          margin-top: 3px;
          color: #8793a2;
          font-size: 10px;
        }

        .logout-button {
          border: 0;
          background: transparent;
          color: #8793a2;
          font-size: 19px;
          cursor: pointer;
        }

        .mobile-menu {
          display: none;
        }

        .container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 30px 38px 20px;
        }

        .welcome-card {
          min-height: 220px;
          border-radius: 22px;
          padding: 34px 38px;
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(
              115deg,
              #0d4f82 0%,
              #176fa9 100%
            );
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow:
            0 15px 35px
            rgba(13, 79, 130, 0.16);
        }

        .eyebrow {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.4px;
          opacity: 0.78;
        }

        .eyebrow.dark {
          color: #8090a2;
          opacity: 1;
        }

        .welcome-card h2 {
          margin: 12px 0 10px;
          font-size: 30px;
          line-height: 1.16;
        }

        .welcome-card p {
          max-width: 600px;
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          opacity: 0.88;
        }

        .welcome-decoration {
          width: 270px;
          height: 170px;
          position: relative;
        }

        .circle {
          position: absolute;
          border-radius: 50%;
          border: 1px solid
            rgba(255, 255, 255, 0.18);
        }

        .circle-one {
          width: 180px;
          height: 180px;
          right: 10px;
          top: -5px;
        }

        .circle-two {
          width: 125px;
          height: 125px;
          right: 38px;
          top: 23px;
        }

        .shield {
          position: absolute;
          right: 80px;
          top: 58px;
          width: 65px;
          height: 75px;
          background:
            rgba(255, 255, 255, 0.15);
          border: 1px solid
            rgba(255, 255, 255, 0.3);
          clip-path: polygon(
            50% 0%,
            92% 14%,
            88% 67%,
            50% 100%,
            12% 67%,
            8% 14%
          );
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
        }

        .company-bar {
          margin: -25px 25px 32px;
          position: relative;
          min-height: 74px;
          background: #ffffff;
          border: 1px solid #e7ebf1;
          border-radius: 16px;
          padding: 16px 25px;
          display: grid;
          grid-template-columns:
            1.5fr 1fr 1fr;
          align-items: center;
          box-shadow:
            0 8px 25px
            rgba(24, 44, 66, 0.06);
        }

        .company-bar span {
          display: block;
          color: #98a3b1;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .company-bar strong {
          display: block;
          margin-top: 5px;
          font-size: 12px;
          color: #293b4e;
        }

        .status {
          color: #3b8665 !important;
        }

        .status i {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4caf7d;
          margin-right: 5px;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .section-heading h2,
        .panel-header h2 {
          margin: 5px 0 0;
          font-size: 19px;
          color: #23384e;
        }

        .cards-grid {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 16px;
        }

        .dashboard-card {
          background: #ffffff;
          border: 1px solid #e6ebf1;
          border-radius: 16px;
          padding: 20px;
          transition: 0.2s ease;
        }

        .dashboard-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 10px 25px
            rgba(24, 44, 66, 0.07);
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #edf5fa;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .card-arrow {
          color: #a4afbc;
          font-size: 15px;
        }

        .dashboard-card h3 {
          margin: 16px 0 8px;
          color: #5e6d7e;
          font-size: 12px;
          font-weight: 600;
        }

        .card-value {
          color: #172f47;
          font-size: 20px;
          font-weight: 800;
        }

        .available {
          color: #0d5d91;
        }

        .dashboard-card p {
          margin: 8px 0 0;
          color: #96a1ae;
          font-size: 10px;
          line-height: 1.5;
        }

        .lower-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns:
            1.35fr 1fr;
          gap: 20px;
        }

        .panel {
          background: #ffffff;
          border: 1px solid #e6ebf1;
          border-radius: 16px;
          padding: 22px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .company-details {
          display: grid;
          gap: 18px;
        }

        .company-details div {
          padding-bottom: 14px;
          border-bottom: 1px solid #eef1f5;
        }

        .company-details div:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .company-details span {
          display: block;
          color: #98a3b0;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .company-details strong {
          display: block;
          color: #33475b;
          font-size: 12px;
        }

        .account-info {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 14px 0;
        }

        .account-avatar {
          width: 46px;
          height: 46px;
        }

        .account-info strong {
          display: block;
          color: #33475b;
          font-size: 12px;
        }

        .account-info span {
          display: block;
          margin-top: 4px;
          color: #98a3b0;
          font-size: 10px;
        }

        .logout-large {
          width: 100%;
          border: 1px solid #e0e6ed;
          background: #ffffff;
          color: #0d5d91;
          border-radius: 10px;
          padding: 11px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .logout-large:hover {
          background: #f4f8fc;
        }

        .error-box {
          margin: -10px 0 24px;
          padding: 13px 16px;
          border-radius: 10px;
          background: #fff4f3;
          border: 1px solid #f1c5c1;
          color: #b44d48;
          font-size: 12px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          padding: 28px 2px 10px;
          color: #9aa5b2;
          font-size: 10px;
        }

        @media (max-width: 1100px) {

          .sidebar {
            width: 220px;
          }

          .cards-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .lower-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 768px) {

          .sidebar {
            position: fixed;
            left: -280px;
            top: 0;
            z-index: 20;
            transition: 0.25s ease;
          }

          .sidebar.open {
            left: 0;
          }

          .mobile-menu {
            display: block;
            border: 0;
            background: transparent;
            font-size: 22px;
            margin-right: 12px;
          }

          .topbar {
            padding: 0 18px;
            justify-content: flex-start;
          }

          .top-actions {
            margin-left: auto;
            gap: 10px;
          }

          .profile-text {
            display: none;
          }

          .container {
            padding: 20px 16px;
          }

          .welcome-card {
            min-height: 260px;
            padding: 25px;
          }

          .welcome-card h2 {
            font-size: 24px;
          }

          .welcome-decoration {
            display: none;
          }

          .company-bar {
            margin: -18px 10px 25px;
            grid-template-columns: 1fr;
            gap: 13px;
            padding: 18px;
          }

          .cards-grid {
            grid-template-columns: 1fr;
          }

          .section-heading {
            align-items: center;
          }

          .footer {
            flex-direction: column;
            gap: 7px;
          }

        }

      `}</style>

    </main>
  )
}
