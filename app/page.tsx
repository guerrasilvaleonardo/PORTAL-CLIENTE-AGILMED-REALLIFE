'use client'

import { useState } from 'react'

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
    value: '12',
    text: 'ASOs e exames acompanhados',
  },
  {
    icon: '📚',
    title: 'Treinamentos',
    value: '08',
    text: 'Treinamentos em andamento',
  },
  {
    icon: '📄',
    title: 'Documentos',
    value: '24',
    text: 'Documentos disponíveis',
  },
  {
    icon: '🔔',
    title: 'Pendências',
    value: '03',
    text: 'Itens que precisam de atenção',
  },
]

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="portal">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">A</div>

          <div>
            <strong>ÁgilMed</strong>
            <span>Real Life</span>
          </div>
        </div>

        <div className="menu-title">MENU PRINCIPAL</div>

        <nav>
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              className={`menu-item ${index === 0 ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
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
            <div className="support-icon">?</div>

            <div>
              <strong>Precisa de ajuda?</strong>
              <span>Fale com nossa equipe</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <div>
            <span className="breadcrumb">Portal do Cliente</span>
            <h1>Olá, seja bem-vindo! 👋</h1>
          </div>

          <div className="top-actions">
            <button className="notification" aria-label="Notificações">
              🔔
              <span>3</span>
            </button>

            <div className="profile">
              <div className="avatar">C</div>

              <div className="profile-text">
                <strong>Cliente</strong>
                <span>Minha empresa</span>
              </div>

              <span className="arrow">⌄</span>
            </div>
          </div>
        </header>

        <div className="container">
          <section className="welcome-card">
            <div>
              <span className="eyebrow">ÁGILMED | REAL LIFE</span>

              <h2>
                Segurança, saúde e gestão
                <br />
                em um só lugar.
              </h2>

              <p>
                Acompanhe documentos, exames, treinamentos,
                indicadores e pendências da sua empresa.
              </p>
            </div>

            <div className="welcome-decoration">
              <div className="circle circle-one" />
              <div className="circle circle-two" />
              <div className="shield">✓</div>
            </div>
          </section>

          <section className="company-bar">
            <div>
              <span>EMPRESA</span>
              <strong>Sua empresa</strong>
            </div>

            <div>
              <span>CNPJ</span>
              <strong>00.000.000/0001-00</strong>
            </div>

            <div>
              <span>STATUS</span>
              <strong className="status">
                <i /> Cadastro ativo
              </strong>
            </div>
          </section>

          <div className="section-heading">
            <div>
              <span className="eyebrow dark">VISÃO GERAL</span>
              <h2>Resumo da sua empresa</h2>
            </div>

            <button className="outline-button">
              Ver todos
              <span>→</span>
            </button>
          </div>

          <section className="cards-grid">
            {cards.map((card) => (
              <article className="dashboard-card" key={card.title}>
                <div className="card-top">
                  <div className="card-icon">{card.icon}</div>
                  <span className="card-arrow">→</span>
                </div>

                <h3>{card.title}</h3>

                <div className="card-value">{card.value}</div>

                <p>{card.text}</p>
              </article>
            ))}
          </section>

          <section className="lower-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow dark">ATENÇÃO</span>
                  <h2>Pendências</h2>
                </div>

                <button className="text-button">Ver todas →</button>
              </div>

              <div className="pending-item">
                <div className="pending-icon red">!</div>

                <div>
                  <strong>Documentos próximos do vencimento</strong>
                  <span>3 documentos precisam de atenção</span>
                </div>

                <span className="pending-arrow">→</span>
              </div>

              <div className="pending-item">
                <div className="pending-icon yellow">!</div>

                <div>
                  <strong>Treinamentos próximos do vencimento</strong>
                  <span>5 colaboradores precisam de renovação</span>
                </div>

                <span className="pending-arrow">→</span>
              </div>

              <div className="pending-item">
                <div className="pending-icon blue">✓</div>

                <div>
                  <strong>Exames ocupacionais</strong>
                  <span>Todos os exames estão acompanhados</span>
                </div>

                <span className="pending-arrow">→</span>
              </div>
            </article>

            <article className="panel activity-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow dark">ATIVIDADE</span>
                  <h2>Últimas atualizações</h2>
                </div>
              </div>

              <div className="activity">
                <div className="activity-dot blue" />

                <div>
                  <strong>Novo documento disponibilizado</strong>
                  <span>Hoje, 09:42</span>
                </div>
              </div>

              <div className="activity">
                <div className="activity-dot green" />

                <div>
                  <strong>Treinamento atualizado</strong>
                  <span>Ontem, 16:20</span>
                </div>
              </div>

              <div className="activity">
                <div className="activity-dot purple" />

                <div>
                  <strong>Exame ocupacional registrado</strong>
                  <span>12/09/2026</span>
                </div>
              </div>
            </article>
          </section>

          <footer className="footer">
            <span>© 2026 ÁgilMed | Real Life Engenharia</span>
            <span>Portal do Cliente</span>
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
          background: linear-gradient(135deg, #0d4f82, #1474b8);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          box-shadow: 0 8px 18px rgba(13, 79, 130, 0.2);
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

        .notification span {
          position: absolute;
          top: -5px;
          right: -7px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #e55b55;
          color: #ffffff;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #ffffff;
        }

        .profile {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar {
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

        .arrow {
          color: #8793a2;
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
          background: linear-gradient(115deg, #0d4f82 0%, #176fa9 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 15px 35px rgba(13, 79, 130, 0.16);
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
          border: 1px solid rgba(255, 255, 255, 0.18);
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
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
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
          grid-template-columns: 1.5fr 1fr 1fr;
          align-items: center;
          box-shadow: 0 8px 25px rgba(24, 44, 66, 0.06);
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

        .outline-button,
        .text-button {
          border: 0;
          background: transparent;
          color: #0d5d91;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .outline-button {
          border: 1px solid #dbe4ed;
          padding: 9px 14px;
          border-radius: 9px;
        }

        .outline-button span {
          margin-left: 8px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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
          box-shadow: 0 10px 25px rgba(24, 44, 66, 0.07);
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
          font-size: 28px;
          font-weight: 800;
        }

        .dashboard-card p {
          margin: 5px 0 0;
          color: #96a1ae;
          font-size: 10px;
        }

        .lower-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1.35fr 1fr;
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

        .pending-item {
          min-height: 62px;
          border-top: 1px solid #eef1f5;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pending-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 12px;
        }

        .pending-icon.red {
          background: #fff0ef;
          color: #d85d58;
        }

        .pending-icon.yellow {
          background: #fff8e7;
          color: #c48a25;
        }

        .pending-icon.blue {
          background: #edf5fb;
          color: #2774a7;
        }

        .pending-item div:nth-child(2) {
          flex: 1;
        }

        .pending-item strong {
          display: block;
          color: #33475b;
          font-size: 11px;
        }

        .pending-item span {
          display: block;
          margin-top: 4px;
          color: #98a3b0;
          font-size: 10px;
        }

        .pending-arrow {
          color: #9ca8b4;
        }

        .activity {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 13px 0;
          border-top: 1px solid #eef1f5;
        }

        .activity-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          margin-top: 3px;
          flex-shrink: 0;
        }

        .activity-dot.blue {
          background: #3e8ac0;
        }

        .activity-dot.green {
          background: #4fa77d;
        }

        .activity-dot.purple {
          background: #8a70b5;
        }

        .activity strong {
          display: block;
          color: #3b4c5e;
          font-size: 11px;
        }

        .activity span {
          display: block;
          margin-top: 4px;
          color: #98a3b0;
          font-size: 10px;
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
            grid-template-columns: repeat(2, 1fr);
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
          }

          .topbar {
            justify-content: flex-start;
          }

          .top-actions {
            margin-left: auto;
            gap: 10px;
          }

          .profile-text,
          .profile .arrow {
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
