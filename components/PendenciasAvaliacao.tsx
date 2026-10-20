'use client'

import Link from 'next/link'
import type { AvaliacaoPendente } from '@/lib/avaliacoesPendentes'
import './pendencias.css'

/*
 * Lembrete de avaliação para o cliente, com pulso de atenção.
 * O pulso respeita "reduzir movimento" do sistema (ver pendencias.css).
 */

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Porto_Velho',
    day: '2-digit',
    month: '2-digit',
  })
}

export default function PendenciasAvaliacao({ pendentes }: { pendentes: AvaliacaoPendente[] }) {
  if (pendentes.length === 0) return null

  const total = pendentes.length

  return (
    <section className="pend-aval" aria-live="polite" aria-labelledby="pend-aval-titulo">
      <div className="pend-aval-head">
        <span className="pend-aval-ponto" aria-hidden="true" />
        <div>
          <h2 id="pend-aval-titulo">
            {total === 1
              ? 'Você tem 1 chamado para avaliar'
              : 'Você tem ' + total + ' chamados para avaliar'}
          </h2>
          <p>
            Leva menos de 1 minuto: escolha Ruim, Bom ou Excelente. Sua avaliação ajuda a
            melhorar o atendimento e só pode ser enviada dentro do prazo.
          </p>
        </div>
      </div>

      <ul className="pend-aval-lista">
        {pendentes.map((p) => (
          <li key={p.id}>
            <Link href={'/chamados/' + p.id + '#avaliar'} className="pend-aval-item">
              <span className="pend-aval-num mono">#{p.numero}</span>
              <span className="pend-aval-assunto">{p.assunto}</span>
              <span className="pend-aval-prazo">
                {p.avaliarAte ? 'Avalie até ' + dataCurta(p.avaliarAte) : 'Sem prazo'}
              </span>
              <span className="pend-aval-botao">Avaliar agora →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* Selo pequeno para linhas de lista ("Avaliar"), com o mesmo pulso. */
export function SeloAvaliar() {
  return (
    <span className="pend-aval-selo" title="Este chamado aguarda a sua avaliação">
      <span className="pend-aval-ponto pequeno" aria-hidden="true" />
      Avaliar
    </span>
  )
}
