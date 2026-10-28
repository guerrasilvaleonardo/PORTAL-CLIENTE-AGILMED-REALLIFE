'use client'

import {
  diasDeEstudo,
  formatarDia,
  formatarDuracao,
  type Progresso,
} from '@/lib/treinamentos'

/*
 * Tempo de estudo do colaborador no EAD (Maestrus): total e por dia.
 * Fechado, mostra o total e o dia mais recente; aberto, a lista de dias.
 * Presencial (manual) e matricula sem tempo lido nao mostram nada.
 *
 * O Maestrus registra o tempo por aula, nao por acesso: cada aula conta
 * no dia em que foi finalizada (a aula em andamento, no dia da ultima
 * atividade). Ver app/api/cron/treinamentos/route.ts.
 */
export default function TempoEad({ progresso }: { progresso: Progresso | null }) {
  if (!progresso || progresso.origem === 'manual') return null

  const dias = diasDeEstudo(progresso)
  const total =
    typeof progresso.tempo_total_seg === 'number' && progresso.tempo_total_seg > 0
      ? progresso.tempo_total_seg
      : dias.reduce((s, d) => s + d.segundos, 0)

  if (total <= 0) return null

  const ultimo = dias[0]

  return (
    <details style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink-faint)' }}>
      <summary
        style={{ cursor: 'pointer', listStylePosition: 'inside', whiteSpace: 'nowrap' }}
        title="Tempo nas aulas online do EAD. Clique para ver por dia."
      >
        ⏱ {formatarDuracao(total)} no EAD
        {ultimo ? ' · ' + formatarDia(ultimo.dia).slice(0, 5) + ': ' + formatarDuracao(ultimo.segundos) : ''}
      </summary>

      {dias.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
          {dias.map((d) => (
            <li
              key={d.dia}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--ink)' }}
            >
              <span>{formatarDia(d.dia)}</span>
              <strong style={{ fontWeight: 600 }}>{formatarDuracao(d.segundos)}</strong>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 4 }}>
        Cada aula conta no dia em que foi finalizada.
      </div>
    </details>
  )
}
