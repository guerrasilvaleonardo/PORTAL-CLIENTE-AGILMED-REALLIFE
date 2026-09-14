export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7fa',
        fontFamily: 'Arial, sans-serif',
        color: '#172033',
      }}
    >
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '18px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong
            style={{
              fontSize: '22px',
              color: '#0f4c81',
            }}
          >
            ÁgilMed
          </strong>

          <span
            style={{
              marginLeft: '8px',
              color: '#64748b',
              fontSize: '14px',
            }}
          >
            • Real Life
          </span>
        </div>

        <div
          style={{
            fontSize: '14px',
            color: '#64748b',
          }}
        >
          Portal do Cliente
        </div>
      </header>

      <section
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '55px 25px',
        }}
      >
        <div
          style={{
            background:
              'linear-gradient(135deg, #0f4c81 0%, #1769aa 100%)',
            borderRadius: '24px',
            padding: '45px',
            color: '#ffffff',
            marginBottom: '35px',
            boxShadow: '0 15px 35px rgba(15, 76, 129, 0.18)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              opacity: 0.85,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
            }}
          >
            Portal do Cliente
          </p>

          <h1
            style={{
              fontSize: '38px',
              margin: '12px 0',
              lineHeight: 1.15,
            }}
          >
            Segurança, saúde e gestão em um só lugar.
          </h1>

          <p
            style={{
              maxWidth: '700px',
              fontSize: '17px',
              lineHeight: 1.7,
              opacity: 0.92,
              marginBottom: '28px',
            }}
          >
            Acesse documentos, serviços, treinamentos, informações
            ocupacionais e indicadores da sua empresa através do Portal
            do Cliente ÁgilMed | Real Life.
          </p>

          <button
            style={{
              border: 'none',
              borderRadius: '10px',
              padding: '14px 24px',
              background: '#ffffff',
              color: '#0f4c81',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Acessar minha empresa
          </button>
        </div>

        <div
          style={{
            marginBottom: '25px',
          }}
        >
          <h2
            style={{
              marginBottom: '8px',
              fontSize: '25px',
            }}
          >
            Soluções do Portal
          </h2>

          <p
            style={{
              color: '#64748b',
              marginTop: 0,
            }}
          >
            Tudo o que sua empresa precisa para acompanhar sua gestão.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          <Card
            icon="🦺"
            title="Segurança do Trabalho"
            description="Documentos, programas, inspeções e controles de SST."
          />

          <Card
            icon="🩺"
            title="Saúde Ocupacional"
            description="ASO, exames ocupacionais e acompanhamento da saúde."
          />

          <Card
            icon="📚"
            title="Treinamentos"
            description="Cursos, certificados, validade e histórico dos treinamentos."
          />

          <Card
            icon="📄"
            title="Documentos"
            description="Acesse documentos e informações da sua empresa."
          />

          <Card
            icon="📊"
            title="Indicadores"
            description="Acompanhe indicadores de segurança, saúde e desempenho."
          />

          <Card
            icon="🔔"
            title="Pendências"
            description="Visualize documentos, exames e treinamentos próximos do vencimento."
          />
        </div>
      </section>

      <footer
        style={{
          borderTop: '1px solid #e5e7eb',
          background: '#ffffff',
          padding: '25px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '13px',
        }}
      >
        ÁgilMed | Real Life Engenharia • Portal do Cliente
      </footer>
    </main>
  )
}

function Card({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '18px',
        padding: '25px',
        minHeight: '150px',
        boxShadow: '0 5px 15px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div
        style={{
          fontSize: '30px',
          marginBottom: '15px',
        }}
      >
        {icon}
      </div>

      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '18px',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: '#64748b',
          fontSize: '14px',
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </div>
  )
}
