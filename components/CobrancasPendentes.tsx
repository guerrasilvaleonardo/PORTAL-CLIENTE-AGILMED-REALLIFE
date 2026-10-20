'use client'

import Link from 'next/link'
import type { CobrancaPendente } from '@/lib/cobrancasPendentes'
import './pendencias.css'

/*
 * Aviso vermelho piscando para o cliente: chamados que esperam a
 * resposta dele há mais dias que o prazo de cobrança da empresa.
 * O pulso respeita "reduzir movimento" do sistema (ver pendencias.css).
 */

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Porto_Velho',
    day: '2-digit',
    month: '2-digit',
  })
}

export default function CobrancasPendentes({ cobrancas }: { cobrancas: CobrancaPendente[] }) {
  if (cobrancas.length === 0) return null

  const total = cobrancas.length

  return (
    <section className="cobr" role="alert" aria-labelledby="cobr-titulo">
      <div className="pend-aval-head">
        <span className="cobr-ponto" aria-hidden="true" />
        <div>
          <h2 id="cobr-titulo">
            {total === 1
              ? '1 chamado aguarda a sua resposta'
              : total + ' chamados aguardam a sua resposta'}
          </h2>
          <p>
            Precisamos de um retorno seu para continuar. Enquanto não houver resposta, o
            atendimento fica parado. Basta abrir o chamado e responder por lá.
          </p>
        </div>
      </div>

      <ul className="pend-aval-lista">
        {cobrancas.map((c) => (
          <li key={c.id}>
            <Link href={'/chamados/' + c.id} className="pend-aval-item cobr-item">
              <span className="pend-aval-num mono cobr-num">#{c.numero}</span>
              <span className="pend-aval-assunto">{c.assunto}</span>
              <span className="pend-aval-prazo cobr-prazo">
                {'Aguardando desde ' + dataCurta(c.aguardandoDesde) + ' · ' + c.dias + ' dias'}
              </span>
              <span className="pend-aval-botao cobr-botao">Responder →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* Selo pequeno para linhas de lista, com o mesmo pulso vermelho. */
export function SeloCobranca({ dias }: { dias: number }) {
  return (
    <span className="cobr-selo" title={'Aguardando a sua resposta há ' + dias + ' dias'}>
      <span className="cobr-ponto pequeno" aria-hidden="true" />
      Responder
    </span>
  )
}
