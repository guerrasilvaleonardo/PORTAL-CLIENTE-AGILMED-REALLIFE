'use client'

import { useEffect, useRef, useState } from 'react'

/*
 * As situações do chamado moram aqui, num lugar só, com o rótulo e a
 * explicação lado a lado. Antes cada tela tinha a sua cópia da lista e
 * ninguém explicava o que cada uma queria dizer — o cliente via
 * "Aguardando cliente" e não sabia que a bola estava com ele.
 */

export type Situacao =
  | 'aberto'
  | 'em_atendimento'
  | 'aguardando_cliente'
  | 'resolvido'
  | 'encerrado'

export const ORDEM_SITUACOES: Situacao[] = [
  'aberto',
  'em_atendimento',
  'aguardando_cliente',
  'resolvido',
  'encerrado',
]

export const ROTULO_SITUACAO: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
}

export const COR_SITUACAO: Record<string, string> = {
  aberto: 'var(--primary)',
  em_atendimento: 'var(--amber)',
  aguardando_cliente: 'var(--ink-faint)',
  resolvido: 'var(--success)',
  encerrado: 'var(--success)',
}

export const PILL_SITUACAO: Record<string, string> = {
  aberto: 'pill',
  em_atendimento: 'pill warn',
  aguardando_cliente: 'pill flat',
  resolvido: 'pill good',
  encerrado: 'pill flat',
}

/*
 * Duas explicações para cada situação: a do cliente fala do que ele
 * precisa fazer; a da equipe fala do que o quadro espera de quem
 * atende. O prazo só corre em horário comercial, 8 horas por dia, de
 * segunda a sexta — por isso a menção aparece nas duas versões.
 */
export const EXPLICACAO_CLIENTE: Record<string, string> = {
  aberto:
    'O chamado chegou até nós e ainda não foi assumido por um atendente. O prazo já está correndo.',
  em_atendimento:
    'Um atendente assumiu o chamado e está trabalhando nele. Você não precisa fazer nada por enquanto.',
  aguardando_cliente:
    'A bola está com você: precisamos de uma resposta, um documento ou uma confirmação para seguir. Enquanto isso, o prazo fica pausado.',
  resolvido:
    'A solução foi entregue e o chamado aguarda a sua conferência. Se ainda não estiver certo, é só responder que ele volta para atendimento.',
  encerrado:
    'O chamado foi finalizado e não recebe mais movimentação. Se o assunto voltar, abra um novo chamado.',
}

export const EXPLICACAO_EQUIPE: Record<string, string> = {
  aberto:
    'Chegou na fila e ninguém assumiu ainda. O prazo já conta — é daqui que sai o indicador de primeira resposta.',
  em_atendimento:
    'Alguém assumiu e está tocando o atendimento. O prazo continua correndo em horas úteis.',
  aguardando_cliente:
    'Depende de um retorno do cliente. Enquanto estiver assim, o prazo fica pausado e não conta como atraso.',
  resolvido:
    'A solução foi entregue e está em conferência pelo cliente. Ainda pode voltar para atendimento se ele responder.',
  encerrado:
    'Finalizado, sem mais movimentação. Entra na contagem de resolvidos do período.',
}

/*
 * O prazo em si também confunde, então explicamos junto: 8 horas por
 * dia, de segunda a sexta, sem contar noite nem fim de semana.
 */
export const NOTA_PRAZO =
  'Os prazos contam apenas horas úteis: 8 horas por dia, de segunda a sexta-feira. Um chamado aberto na sexta à tarde tem o prazo retomado na segunda de manhã.'

type Props = {
  /* 'cliente' usa a linguagem do portal do cliente; 'equipe', a do quadro. */
  publico?: 'cliente' | 'equipe'
  /* Texto do botão que abre o balão. */
  rotulo?: string
  /* Alinhamento do balão em relação ao botão. */
  alinhamento?: 'esquerda' | 'direita'
}

export function AjudaSituacoes({
  publico = 'cliente',
  rotulo = 'O que significa cada situação?',
  alinhamento = 'direita',
}: Props) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement | null>(null)

  /* Clicar fora ou apertar Esc fecha o balão. */
  useEffect(() => {
    if (!aberto) return

    function foraDaCaixa(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }

    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', foraDaCaixa)
    document.addEventListener('keydown', esc)

    return () => {
      document.removeEventListener('mousedown', foraDaCaixa)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const explicacoes =
    publico === 'equipe' ? EXPLICACAO_EQUIPE : EXPLICACAO_CLIENTE

  return (
    <div
      ref={caixa}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        title={rotulo}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          border: '1px solid var(--border)',
          background: aberto ? 'var(--primary-tint)' : 'var(--surface)',
          color: aberto ? 'var(--primary-strong)' : 'var(--ink-muted)',
          borderRadius: 20,
          padding: '3px 9px 3px 6px',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 15,
            height: 15,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          ?
        </span>
        {rotulo}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Significado de cada situação"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [alinhamento === 'direita' ? 'right' : 'left']: 0,
            zIndex: 60,
            width: 'min(370px, calc(100vw - 32px))',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-m)',
            boxShadow: 'var(--shadow)',
            padding: 14,
            textAlign: 'left',
          } as React.CSSProperties}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: 'var(--ink)',
              marginBottom: 10,
            }}
          >
            O que significa cada situação
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {ORDEM_SITUACOES.map((s) => (
              <div key={s} style={{ display: 'grid', gap: 3 }}>
                <span
                  className={PILL_SITUACAO[s]}
                  style={{ fontSize: 10.5 }}
                >
                  {ROTULO_SITUACAO[s]}
                </span>

                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {explicacoes[s]}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
              fontSize: 11.5,
              color: 'var(--ink-faint)',
              lineHeight: 1.5,
            }}
          >
            {NOTA_PRAZO}
          </div>
        </div>
      )}
    </div>
  )
}
