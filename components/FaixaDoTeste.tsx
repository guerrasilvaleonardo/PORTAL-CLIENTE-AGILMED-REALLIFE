'use client'

import Link from 'next/link'
import {
  DIAS_DE_TESTE,
  MODULOS,
  linkContratacaoAposTeste,
  type Modulo,
  type Teste,
} from '@/lib/modulos'
import './faixa-do-teste.css'

/*
 * A faixa do teste de 7 dias, dentro da própria ferramenta.
 *
 * POR QUE ELA EXISTE. Teste sem relógio visível parece armadilha: o
 * cliente registra uma semana de trabalho e um dia a tela fecha sem
 * aviso. A faixa diz, todo dia, quanto falta e — o que mais importa —
 * O QUE ACONTECE NO DIA 8: a ferramenta fecha, o que ele registrou
 * continua ali.
 *
 * São dois estados, e o segundo é o que vende:
 *
 *  - ANDAMENTO: escura, discreta, com o contador. Não atrapalha quem
 *    está trabalhando.
 *  - ENCERRADO: clara, com os NÚMEROS DELE. Não é texto de venda, é o
 *    trabalho que ele já fez e teria de refazer em outro lugar. O
 *    chamado não abre sozinho — abre quando ele clica.
 */

export type NumeroDoTeste = { valor: number | string; rotulo: string }

export default function FaixaDoTeste({
  modulo,
  teste,
  numeros = [],
}: {
  modulo: Modulo
  teste: Teste
  /* O que a empresa registrou no teste. Vazio na fase de andamento. */
  numeros?: NumeroDoTeste[]
}) {
  if (teste.estado === 'nenhum') return null

  const info = MODULOS[modulo]

  const dataFim = teste.terminaEm
    ? teste.terminaEm.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
    : ''

  /* ---------- Durante os 7 dias ---------- */
  if (teste.estado === 'andamento') {
    const faltam = teste.diasRestantes
    const corridos = Math.min(DIAS_DE_TESTE, Math.max(1, DIAS_DE_TESTE - faltam + 1))
    const pct = Math.round((corridos / DIAS_DE_TESTE) * 100)

    return (
      <section className="teste-faixa" aria-label={'Teste de ' + info.rotulo}>
        <div className="teste-contador" aria-hidden="true">
          <strong>{corridos}</strong>
          <span>de {DIAS_DE_TESTE}</span>
        </div>

        <div className="teste-texto">
          <div className="teste-titulo">
            Você está testando o {info.rotulo}.{' '}
            {faltam === 0 ? 'Termina hoje.' : faltam === 1 ? 'Falta 1 dia.' : 'Faltam ' + faltam + ' dias.'}
          </div>
          <p>
            {dataFim ? (
              <>
                Em <strong>{dataFim}</strong> a ferramenta fecha.
              </>
            ) : (
              'Quando o teste acabar, a ferramenta fecha.'
            )}{' '}
            O que você registrou continua aqui para ver e imprimir — você só não registra mais.
          </p>
          <div className="teste-barra">
            <span style={{ width: pct + '%' }} />
          </div>
        </div>

        <a href={linkContratacaoAposTeste(modulo, '(teste ainda em andamento)')} className="btn btn-sm teste-cta">
          Já quero contratar
        </a>
      </section>
    )
  }

  /* ---------- Dia 8: fechou, mas não sumiu ---------- */
  return (
    <section className="teste-fim" aria-label={'Teste de ' + info.rotulo + ' encerrado'}>
      <div className="teste-fim-esq">
        <div className="section-title">
          {dataFim ? 'Seu teste terminou em ' + dataFim : 'Seu teste terminou'}
        </div>
        <h2>Em {DIAS_DE_TESTE} dias, a sua equipe registrou isto aqui</h2>

        {numeros.length > 0 && (
          <div className="teste-numeros">
            {numeros.map((n) => (
              <div key={n.rotulo}>
                <strong>{n.valor}</strong>
                <span>{n.rotulo}</span>
              </div>
            ))}
          </div>
        )}

        <p>
          <strong>Nada disso foi apagado.</strong> Você continua vendo e imprimindo tudo o que
          registrou — a ferramenta só parou de aceitar registro novo.
        </p>
      </div>

      <div className="teste-fim-dir">
        <div className="teste-fim-chamada">Quer continuar de onde parou?</div>
        <p>
          A gente abre um chamado com esses números já escritos. Você diz quantos colaboradores e a
          proposta chega pelo portal.
        </p>
        <a
          href={linkContratacaoAposTeste(
            modulo,
            numeros.length > 0
              ? numeros.map((n) => '- ' + n.valor + ' ' + n.rotulo.toLowerCase()).join('\n')
              : '- (sem registro no período)',
          )}
          className="btn btn-primary btn-sm"
        >
          Quero contratar o {info.rotulo}
        </a>
        <Link href="/contratar" className="teste-fim-depois">
          Agora não
        </Link>
      </div>
    </section>
  )
}
