'use client'

/*
 * Graficos em SVG puro, sem biblioteca externa.
 *
 * O portal e um app pequeno e uma biblioteca de grafico pesaria mais
 * que o resto da pagina. Como sao poucos formatos — rosca, barras e
 * uma barra de progresso — vale desenhar a mao e manter as cores nos
 * tokens do sistema visual.
 */

export type Fatia = {
  rotulo: string
  valor: number
  cor: string
}

function total(fatias: Fatia[]) {
  return fatias.reduce((s, f) => s + f.valor, 0)
}

/*
 * Rosca. Desenhada com um circulo por fatia usando stroke-dasharray:
 * cada fatia ocupa um pedaco do perimetro e comeca onde a anterior
 * parou. Bem mais leve que calcular caminhos em arco.
 */
export function Rosca({
  fatias,
  tamanho = 168,
  centro,
  legendaCentro,
}: {
  fatias: Fatia[]
  tamanho?: number
  centro?: string | number
  legendaCentro?: string
}) {
  const soma = total(fatias)
  const raio = 54
  const perimetro = 2 * Math.PI * raio

  let percorrido = 0

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ position: 'relative', width: tamanho, height: tamanho }}>
        <svg
          viewBox="0 0 140 140"
          width={tamanho}
          height={tamanho}
          style={{ transform: 'rotate(-90deg)' }}
          role="img"
          aria-label={fatias
            .map((f) => f.rotulo + ': ' + f.valor)
            .join(', ')}
        >
          <circle
            cx="70"
            cy="70"
            r={raio}
            fill="none"
            stroke="var(--surface-sunken)"
            strokeWidth="18"
          />

          {soma > 0 &&
            fatias.map((f) => {
              if (f.valor <= 0) return null

              const parte = (f.valor / soma) * perimetro
              const deslocamento = -percorrido

              percorrido += parte

              return (
                <circle
                  key={f.rotulo}
                  cx="70"
                  cy="70"
                  r={raio}
                  fill="none"
                  stroke={f.cor}
                  strokeWidth="18"
                  strokeDasharray={parte + ' ' + (perimetro - parte)}
                  strokeDashoffset={deslocamento}
                />
              )
            })}
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            pointerEvents: 'none',
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}
          >
            {centro ?? soma}
          </span>

          {legendaCentro && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--ink-muted)',
                fontWeight: 600,
              }}
            >
              {legendaCentro}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 140,
        }}
      >
        {fatias.map((f) => (
          <div
            key={f.rotulo}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: f.cor,
                flex: 'none',
              }}
            />

            <span style={{ fontSize: 13, flex: 1 }}>{f.rotulo}</span>

            <span
              className="mono"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {f.valor}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export type Barra = {
  rotulo: string
  valor: number
  detalhe?: string
  cor?: string
}

/* Barras horizontais, proporcionais ao maior valor da lista. */
export function Barras({
  barras,
  sufixo = '',
  vazio = 'Sem dados.',
}: {
  barras: Barra[]
  sufixo?: string
  vazio?: string
}) {
  if (barras.length === 0) {
    return <div className="empty-state">{vazio}</div>
  }

  const maior = barras.reduce((m, b) => Math.max(m, b.valor), 0) || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {barras.map((b) => (
        <div key={b.rotulo}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {b.rotulo}
            </span>

            {b.detalhe && (
              <span style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                {b.detalhe}
              </span>
            )}

            <span
              className="mono"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {b.valor}
              {sufixo}
            </span>
          </div>

          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: 'var(--surface-sunken)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: Math.round((b.valor / maior) * 100) + '%',
                background: b.cor || 'var(--primary)',
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* Barra de progresso de um curso, com o numero ao lado. */
export function Progresso({
  valor,
  cor,
  largura = 84,
}: {
  valor: number
  cor?: string
  largura?: number
}) {
  const seguro = Math.max(0, Math.min(100, Math.round(valor)))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: largura,
          height: 7,
          borderRadius: 999,
          background: 'var(--surface-sunken)',
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        <div
          style={{
            height: '100%',
            width: seguro + '%',
            background: cor || 'var(--primary)',
            borderRadius: 999,
          }}
        />
      </div>

      <span
        className="mono"
        style={{ fontSize: 12, fontWeight: 600, minWidth: 34 }}
      >
        {seguro}%
      </span>
    </div>
  )
}
