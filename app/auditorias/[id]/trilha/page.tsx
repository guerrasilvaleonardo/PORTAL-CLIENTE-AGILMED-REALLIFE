'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../../colaboradores/colaboradores.css'
import '../../../inspecoes/inspecoes.css'
import './trilha.css'

/*
 * A trilha da auditoria: onde a empresa está e o que vem depois.
 *
 * POR QUE ESTA TELA EXISTE. Quem nunca conduziu uma auditoria abre o
 * checklist com 53 perguntas e trava — não porque as perguntas sejam
 * difíceis, mas porque ninguém disse em que ordem as coisas acontecem.
 * O concorrente resolve isso com uma jornada guiada, e está certo: o
 * valor não é o formulário, é saber que existe um caminho e que você
 * está no meio dele.
 *
 * O ESTADO É CALCULADO, NÃO DECLARADO. Nenhuma etapa tem botão de
 * "marcar como feita". Cada uma olha o dado que a prova: a agenda está
 * feita se há linha na agenda; a abertura aconteceu se tem data. Etapa
 * que se marca sozinha vira teatro — a empresa marca tudo e a auditoria
 * segue vazia por baixo.
 *
 * AS ÁREAS VÊM DO CHECKLIST. O progresso por área sai da categoria de
 * cada pergunta, que é o capítulo da norma. Não há cadastro de área
 * para manter: a norma já organizou isso.
 */

type Inspecao = {
  id: string
  tipo: string
  modelo_nome: string
  norma: string | null
  situacao: string
  iniciada_em: string
  concluida_em: string | null
  objetivo: string | null
  escopo: string | null
  criterios: string | null
  auditor_lider: string | null
  inspetor_nome: string | null
  abertura_em: string | null
  encerramento_em: string | null
  conclusao: string | null
  relatorio_em: string | null
  itens_total: number
  percentual: number | null
}

type Resposta = {
  id: string
  categoria: string | null
  resposta: string | null
  aprovado_em: string | null
}

type NC = { id: string; classificacao: string | null; situacao: string }

type Estado = 'feito' | 'fazendo' | 'espera'

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' }) : null

function Etapa({
  n,
  estado,
  titulo,
  porque,
  situacao,
  acao,
}: {
  n: number
  estado: Estado
  titulo: string
  porque: string
  situacao: string
  acao?: { rotulo: string; href: string }
}) {
  return (
    <li className={'trilha-etapa ' + estado}>
      <div className="trilha-bolinha">{estado === 'feito' ? '✓' : n}</div>
      <div className="trilha-corpo">
        <h3>{titulo}</h3>
        <p className="trilha-porque">{porque}</p>
        <p className="trilha-situacao">{situacao}</p>
        {acao && estado !== 'feito' && (
          <Link href={acao.href} className="btn btn-sm btn-primary">
            {acao.rotulo}
          </Link>
        )}
      </div>
    </li>
  )
}

function TrilhaConteudo() {
  const { id } = useParams<{ id: string }>()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [inspecao, setInspecao] = useState<Inspecao | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [ncs, setNcs] = useState<NC[]>([])
  const [agenda, setAgenda] = useState(0)
  const [pessoas, setPessoas] = useState(0)
  const [envios, setEnvios] = useState(0)

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const { data: i, error } = await supabase
        .from('inspecoes')
        .select(
          'id, tipo, modelo_nome, norma, situacao, iniciada_em, concluida_em, objetivo, escopo, ' +
            'criterios, auditor_lider, inspetor_nome, abertura_em, encerramento_em, conclusao, ' +
            'relatorio_em, itens_total, percentual'
        )
        .eq('id', id)
        .single()

      if (error) throw error
      setInspecao(i as unknown as Inspecao)

      const [{ data: rs }, { data: ns }, ag, ps, es] = await Promise.all([
        supabase
          .from('inspecao_respostas')
          .select('id, categoria, resposta, aprovado_em')
          .eq('inspecao_id', id)
          .order('ordem'),
        supabase
          .from('nao_conformidades')
          .select('id, classificacao, situacao')
          .eq('inspecao_id', id),
        supabase
          .from('auditoria_agenda')
          .select('id', { count: 'exact', head: true })
          .eq('inspecao_id', id),
        supabase
          .from('auditoria_participantes')
          .select('id', { count: 'exact', head: true })
          .eq('inspecao_id', id),
        supabase
          .from('auditoria_envios')
          .select('id', { count: 'exact', head: true })
          .eq('inspecao_id', id),
      ])

      setRespostas((rs || []) as unknown as Resposta[])
      setNcs((ns || []) as unknown as NC[])
      setAgenda(ag.count || 0)
      setPessoas(ps.count || 0)
      setEnvios(es.count || 0)
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível montar a trilha.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Vendo onde você está…</p>
      </div>
    )
  }

  if (!inspecao) {
    return (
      <div className="app">
        <div className="banner bad">{erro || 'Auditoria não encontrada.'}</div>
      </div>
    )
  }

  const respondidas = respostas.filter((r) => r.resposta).length
  const total = respostas.length || inspecao.itens_total || 0
  const pctRespondido = total ? Math.round((respondidas / total) * 100) : 0

  /* Uma linha por capítulo da norma, com o que falta responder nele.
     É aqui que a empresa descobre que parou no capítulo 8 e nunca
     chegou no 9 — coisa que a lista corrida de 53 perguntas esconde. */
  const areas = (() => {
    const mapa = new Map<string, { total: number; feitas: number; aprovadas: number }>()
    respostas.forEach((r) => {
      const chave = r.categoria || 'Sem capítulo'
      const atual = mapa.get(chave) || { total: 0, feitas: 0, aprovadas: 0 }
      atual.total += 1
      if (r.resposta) atual.feitas += 1
      if (r.aprovado_em) atual.aprovadas += 1
      mapa.set(chave, atual)
    })
    return [...mapa.entries()].map(([nome, v]) => ({ nome, ...v }))
  })()

  const planoPronto = Boolean(
    inspecao.objetivo &&
      inspecao.escopo &&
      (inspecao.criterios || inspecao.norma) &&
      (inspecao.auditor_lider || inspecao.inspetor_nome)
  )
  const semClasse = ncs.filter(
    (n) => !n.classificacao && n.situacao !== 'cancelada'
  ).length
  const encerrada = inspecao.situacao === 'concluida'

  /* A primeira etapa não feita é a que está acontecendo agora. */
  const feitos = [
    true, // preparar: sempre disponível, não dá para provar pelo banco
    planoPronto && agenda > 0 && pessoas > 0,
    Boolean(inspecao.abertura_em),
    total > 0 && respondidas === total,
    ncs.length === 0 || semClasse === 0,
    encerrada && Boolean(inspecao.conclusao),
    envios > 0,
  ]
  const atual = feitos.findIndex((f) => !f)
  const estadoDe = (i: number): Estado =>
    feitos[i] ? 'feito' : i === atual ? 'fazendo' : 'espera'

  const concluidas = feitos.filter(Boolean).length

  return (
    <div className="app trilha">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/auditorias" className="btn btn-sm">
          Todas as auditorias
        </Link>
        <Link href={'/auditorias/' + id} className="btn btn-sm">
          Abrir o checklist
        </Link>
        <Link href={'/auditorias/' + id + '/relatorio'} className="btn btn-sm">
          Relatório
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <header className="page-head" style={{ marginTop: 14 }}>
        <div>
          <p className="eyebrow">TRILHA DA AUDITORIA</p>
          <h1>{inspecao.norma || inspecao.modelo_nome}</h1>
          <p className="subtitulo">
            {concluidas} de 7 etapas concluídas · iniciada em {data(inspecao.iniciada_em)}
            {encerrada && inspecao.concluida_em && ' · encerrada em ' + data(inspecao.concluida_em)}
          </p>
        </div>
      </header>

      <div className="trilha-barra" aria-hidden>
        <div style={{ width: Math.round((concluidas / 7) * 100) + '%' }} />
      </div>

      <ol className="trilha-lista">
        <Etapa
          n={1}
          estado={estadoDe(0)}
          titulo="Organizar os documentos antes de começar"
          porque="Quem começa a responder sem ter onde guardar a evidência responde duas vezes: uma para o checklist e outra para achar o arquivo depois."
          situacao="A estrutura de pastas sai pronta, uma pasta por requisito da norma."
          acao={{ rotulo: 'Ver o passo a passo', href: '/auditorias/preparar' }}
        />

        <Etapa
          n={2}
          estado={estadoDe(1)}
          titulo="Planejar"
          porque="Objetivo, escopo, critérios e agenda são o que o auditado recebe antes. Sem isso a auditoria vira visita surpresa, e visita surpresa não gera cooperação."
          situacao={
            [
              planoPronto ? 'plano preenchido' : 'falta objetivo, escopo, critérios ou auditor líder',
              agenda > 0 ? agenda + ' janela(s) na agenda' : 'agenda vazia',
              pessoas > 0 ? pessoas + ' participante(s)' : 'ninguém na lista de participantes',
            ].join(' · ')
          }
          acao={{ rotulo: 'Preencher o plano', href: '/auditorias/' + id }}
        />

        <Etapa
          n={3}
          estado={estadoDe(2)}
          titulo="Reunião de abertura"
          porque="É onde se combina o método, o horário e quem acompanha. Pular a abertura é a causa mais comum de a auditoria terminar em discussão sobre o que valia como evidência."
          situacao={
            inspecao.abertura_em
              ? 'realizada em ' + data(inspecao.abertura_em)
              : 'ainda não registrada'
          }
          acao={{ rotulo: 'Registrar a abertura', href: '/auditorias/' + id }}
        />

        <Etapa
          n={4}
          estado={estadoDe(3)}
          titulo="Auditar, requisito a requisito"
          porque="Cada item tem a prescrição explicando o que fazer, por que a norma pede e o que entregar. A evidência sobe junto da resposta."
          situacao={respondidas + ' de ' + total + ' requisitos respondidos (' + pctRespondido + '%)'}
          acao={{ rotulo: 'Continuar de onde parou', href: '/auditorias/' + id }}
        />

        <Etapa
          n={5}
          estado={estadoDe(4)}
          titulo="Classificar os achados"
          porque="Maior trava a certificação, menor pede ação corretiva, observação é alerta e oportunidade de melhoria não pede nada. Tratar tudo igual faz a empresa gastar com o que não falhou."
          situacao={
            ncs.length === 0
              ? 'nenhuma constatação até agora'
              : semClasse === 0
                ? ncs.length + ' constatação(ões), todas classificadas'
                : semClasse + ' de ' + ncs.length + ' ainda sem classificação'
          }
          acao={{ rotulo: 'Ver as constatações', href: '/auditorias/nc' }}
        />

        <Etapa
          n={6}
          estado={estadoDe(5)}
          titulo="Encerrar e concluir"
          porque="A conclusão do auditor líder é o que diz se o sistema atende, atende com ressalvas ou não atende. Sem ela o relatório é uma lista de achados."
          situacao={
            [
              encerrada ? 'auditoria encerrada' : 'auditoria em andamento',
              inspecao.conclusao ? 'conclusão escrita' : 'conclusão em branco',
              inspecao.percentual === null ? null : inspecao.percentual + '% de conformidade',
            ]
              .filter(Boolean)
              .join(' · ')
          }
          acao={{ rotulo: 'Ir para a auditoria', href: '/auditorias/' + id }}
        />

        <Etapa
          n={7}
          estado={estadoDe(6)}
          titulo="Emitir e distribuir o relatório"
          porque="A ISO 19011 6.5.2 pede o registro de para quem o relatório foi distribuído. 'Eu mandei', sem data e destinatário, não vale nada seis meses depois."
          situacao={
            envios > 0
              ? envios + ' entrega(s) registrada(s)'
              : inspecao.relatorio_em
                ? 'relatório emitido, entrega não registrada'
                : 'relatório ainda não distribuído'
          }
          acao={{ rotulo: 'Abrir o relatório', href: '/auditorias/' + id + '/relatorio' }}
        />
      </ol>

      {/* O progresso por capítulo. É aqui que se vê o que ficou para trás. */}
      {areas.length > 0 && (
        <section className="trilha-areas">
          <h2>Por capítulo da norma</h2>
          <p className="trilha-porque">
            Aprovado é o requisito cuja evidência já foi aceita por quem conduz a auditoria —
            responder não é o mesmo que estar aceito.
          </p>
          <table className="tabela-colab">
            <thead>
              <tr>
                <th>Capítulo</th>
                <th style={{ width: 170 }}>Respondido</th>
                <th style={{ width: 110 }}>Aprovados</th>
                <th style={{ width: 90 }}>Falta</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => {
                const pct = a.total ? Math.round((a.feitas / a.total) * 100) : 0
                return (
                  <tr key={a.nome}>
                    <td className="nome">{a.nome}</td>
                    <td>
                      <div className="trilha-mini">
                        <div style={{ width: pct + '%' }} />
                      </div>
                      <span className="trilha-pct">
                        {a.feitas}/{a.total} · {pct}%
                      </span>
                    </td>
                    <td>{a.aprovadas}</td>
                    <td>
                      {a.total - a.feitas === 0 ? (
                        <span className="pill good">—</span>
                      ) : (
                        <span className="pill warn">{a.total - a.feitas}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

export default function TrilhaDaAuditoria() {
  return (
    <ComModulo modulo="auditoria">
      <TrilhaConteudo />
    </ComModulo>
  )
}
