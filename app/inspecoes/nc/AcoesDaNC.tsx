'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Ajuda from '@/components/Ajuda'

/*
 * As ações de uma não conformidade (supabase/planos-de-acao.sql).
 *
 * POR QUE AQUI DENTRO. Ação nasce colada na causa que a justifica. Uma
 * tela separada de "nova ação" produziria, em pouco tempo, uma lista
 * de tarefas sem desvio nenhum atrás — e tarefa sem porquê é a
 * primeira a ser empurrada para o mês seguinte.
 *
 * O CAMPO ANTIGO CONTINUA LOGO ACIMA. A "ação corretiva" em texto é o
 * resumo de uma linha que o relatório já imprime e que as NCs antigas
 * têm preenchido; as ações daqui são o plano com dono e prazo. Quem
 * quiser seguir só com o texto, segue — o que não dá é cobrar prazo de
 * uma frase.
 */

const TIPOS: { chave: string; rotulo: string; explica: string }[] = [
  {
    chave: 'correcao',
    rotulo: 'Correção',
    explica: 'Resolve o que está na frente, agora. Isolar a área, trocar o EPI, parar o serviço.',
  },
  {
    chave: 'corretiva',
    rotulo: 'Corretiva',
    explica: 'Ataca a causa-raiz desta não conformidade, para ela não voltar.',
  },
  {
    chave: 'preventiva',
    rotulo: 'Preventiva',
    explica: 'Estende a lição para onde o mesmo problema ainda não aconteceu.',
  },
  {
    chave: 'verificacao',
    rotulo: 'Verificação',
    explica: 'Confere, numa data marcada, se o que foi feito funcionou mesmo.',
  },
]

const SITUACOES: Record<string, string> = {
  aberta: 'A fazer',
  execucao: 'Em execução',
  verificacao: 'Em verificação',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

type Acao = {
  id: string
  ordem: number
  tipo: string
  descricao: string
  responsavel_nome: string | null
  prazo: string | null
  situacao: string
  eficaz: boolean | null
}

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const hoje = () => new Date().toISOString().slice(0, 10)

export default function AcoesDaNC({
  ncId,
  empresaId,
  aoContar,
  textoParaAproveitar,
  aoAproveitarTexto,
}: {
  ncId: string
  empresaId: string
  /* A ficha precisa saber quantas ações existem para escrever o número
     na aba e para cobrar plano antes de encerrar. Sem isto, a contagem
     ficaria trancada aqui dentro. */
  aoContar?: (quantas: number) => void
  /* O resumo de uma linha que já estava escrito. Serve para a ponte:
     virar uma ação de verdade com um toque, em vez de ser digitado de
     novo. */
  textoParaAproveitar?: string
  aoAproveitarTexto?: () => void
}) {
  const [lista, setLista] = useState<Acao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [nova, setNova] = useState({
    tipo: 'corretiva',
    descricao: '',
    responsavel_nome: '',
    prazo: '',
  })

  async function carregar() {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase
      .from('nc_acoes')
      .select('id, ordem, tipo, descricao, responsavel_nome, prazo, situacao, eficaz')
      .eq('nc_id', ncId)
      .order('ordem')

    setCarregando(false)

    if (error) {
      if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
        setSemTabela(true)
        return
      }
      setErro(error.message)
      return
    }

    const linhas = (data || []) as Acao[]
    setLista(linhas)
    aoContar?.(linhas.length)
  }

  useEffect(() => {
    carregar()
    /* Trocar de não conformidade sem recarregar deixaria as ações da
       anterior na tela. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ncId])

  async function adicionar() {
    if (salvando) return

    if (!nova.descricao.trim()) {
      setErro('Escreva o que será feito.')
      return
    }

    setSalvando(true)
    setErro('')

    const { data, error } = await supabase
      .from('nc_acoes')
      .insert({
        empresa_id: empresaId,
        nc_id: ncId,
        ordem: (lista[lista.length - 1]?.ordem || 0) + 1,
        tipo: nova.tipo,
        descricao: nova.descricao.trim(),
        responsavel_nome: nova.responsavel_nome.trim() || null,
        prazo: nova.prazo || null,
      })
      .select('id, ordem, tipo, descricao, responsavel_nome, prazo, situacao, eficaz')
      .single()

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setLista((l) => {
      const comANova = [...l, data as Acao]
      aoContar?.(comANova.length)
      return comANova
    })
    setNova({ tipo: 'corretiva', descricao: '', responsavel_nome: '', prazo: '' })
  }

  async function apagar(a: Acao) {
    if (salvando) return
    if (!confirm('Apagar a ação "' + a.descricao + '"?')) return

    setSalvando(true)
    const { error } = await supabase.from('nc_acoes').delete().eq('id', a.id)
    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setLista((l) => {
      const sobrou = l.filter((x) => x.id !== a.id)
      aoContar?.(sobrou.length)
      return sobrou
    })
  }

  if (semTabela) {
    return (
      <div className="banner">
        Para usar o plano de ação com dono e prazo, rode{' '}
        <code>supabase/planos-de-acao.sql</code> no Supabase.
      </div>
    )
  }

  return (
    <div className="nc-acoes">
      {/*
        * O AVISO QUE FALTAVA.
        *
        * Sem ele, quem escrevia a frase da ação corretiva e salvava ia
        * embora achando que tinha feito um plano. O texto entra no
        * relatório, mas não tem dono, não tem prazo, não aparece em
        * Planos de ação e ninguém é cobrado por ele. O aviso diz isso
        * com todas as letras — e oferece o atalho de transformar a
        * frase numa ação de verdade, em vez de mandar digitar de novo.
        */}
      {!carregando && lista.length === 0 && (
        <div className="banner" style={{ marginBottom: 12 }}>
          <div>
            <strong>Esta não conformidade ainda não tem plano.</strong>
            <div style={{ fontWeight: 500, marginTop: 4 }}>
              O resumo escrito abaixo entra no relatório, mas não tem dono nem prazo: não aparece
              em Planos de ação e ninguém é cobrado por ele.
            </div>
          </div>
          {textoParaAproveitar?.trim() && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={salvando}
              onClick={async () => {
                setNova((n) => ({ ...n, descricao: textoParaAproveitar.trim() }))
                aoAproveitarTexto?.()
              }}
            >
              Usar o resumo como primeira ação
            </button>
          )}
        </div>
      )}

      <div className="section-title" style={{ marginBottom: 6 }}>
        Ações desta não conformidade
        <Ajuda
          titulo="Por que mais de uma"
          texto="Um desvio sério quase nunca se resolve com uma ação só: uma apaga o incêndio de hoje, outra muda o procedimento, outra estende a lição. Cada uma tem dono e prazo próprios."
        />
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {carregando ? (
        <p className="ajuda-linha">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="ajuda-linha">Nenhuma ação ainda. A primeira costuma ser a correção.</p>
      ) : (
        <table className="tabela-colab">
          <thead>
            <tr>
              <th>#</th>
              <th>O que será feito</th>
              <th>Tipo</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => {
              const atrasada =
                !!a.prazo && a.prazo < hoje() && !['encerrada', 'cancelada'].includes(a.situacao)

              return (
                <tr key={a.id}>
                  <td className="mono">{a.ordem}</td>
                  <td>{a.descricao}</td>
                  <td>
                    <span
                      className={
                        'pill ' +
                        (a.tipo === 'correcao' ? 'warn' : a.tipo === 'preventiva' ? 'good' : 'flat')
                      }
                    >
                      {TIPOS.find((t) => t.chave === a.tipo)?.rotulo || a.tipo}
                    </span>
                  </td>
                  <td>{a.responsavel_nome || '—'}</td>
                  <td className={atrasada ? 'prazo-vencido' : 'mono'}>
                    {dataBr(a.prazo)}
                    {atrasada && ' · venceu'}
                  </td>
                  <td>
                    {SITUACOES[a.situacao] || a.situacao}
                    {a.situacao === 'encerrada' && (
                      <span className={'pill ' + (a.eficaz ? 'good' : 'bad')} style={{ marginLeft: 6 }}>
                        {a.eficaz ? 'funcionou' : 'não resolveu'}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={salvando}
                      onClick={() => apagar(a)}
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div className="nc-acao-nova">
        <label>
          O que será feito
          <input
            type="text"
            value={nova.descricao}
            placeholder="Ex.: instalar linha de vida no trecho leste do mezanino"
            onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
          />
        </label>

        <div className="duas">
          <label>
            Tipo
            <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}>
              {TIPOS.map((t) => (
                <option key={t.chave} value={t.chave}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label>
            Prazo
            <input
              type="date"
              value={nova.prazo}
              onChange={(e) => setNova({ ...nova, prazo: e.target.value })}
            />
          </label>
        </div>

        <label>
          Responsável
          <input
            type="text"
            value={nova.responsavel_nome}
            placeholder="Quem faz, não quem cobra"
            onChange={(e) => setNova({ ...nova, responsavel_nome: e.target.value })}
          />
        </label>

        <p className="ajuda-linha">{TIPOS.find((t) => t.chave === nova.tipo)?.explica}</p>

        <button type="button" className="btn btn-sm btn-primary" disabled={salvando} onClick={adicionar}>
          Juntar ação
        </button>
      </div>
    </div>
  )
}
