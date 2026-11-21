'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'
import '../visual.css'
import {
  porLocal as calcPorLocal,
  reincidencia as calcReincidencia,
  totais as calcTotais,
  eficacia as calcEficacia,
  incidentes as calcIncidentes,
  pareto as calcPareto,
  potencialFatalEmAberto,
  type InspecaoIndicador,
  type RespostaIndicador,
  type NcIndicador,
} from '@/lib/indicadoresInspecao'
import { rotuloCausa } from '@/lib/vocabularioNC'

/*
 * Painel das inspeções.
 *
 * Os dois relatórios que o Checklist Fácil tem e que fazem falta aqui:
 * INDICADORES, que é o resultado por local, e REINCIDÊNCIA, que é a
 * pergunta que falha de novo. Mais o que a 45001 cobra e eles não
 * mostram: a fila de não conformidades e os incidentes do período.
 *
 * POR QUE A REINCIDÊNCIA É O NÚMERO QUE IMPORTA. Uma inspeção com 95%
 * de conformidade parece ótima até se ver que o mesmo item reprova
 * todo mês: isso não é um achado, é um controle que não existe. O
 * percentual sozinho esconde exatamente o que precisa de ação.
 *
 * O período filtra a data da inspeção e a do incidente. Vazio = tudo.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const TIPO_INCIDENTE: Record<string, string> = {
  acidente_com_afastamento: 'Acidente com afastamento',
  acidente_sem_afastamento: 'Acidente sem afastamento',
  quase_acidente: 'Quase-acidente',
  doenca_ocupacional: 'Doença ocupacional',
  primeiros_socorros: 'Primeiros socorros',
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Acao = { id: string; empresa_id: string; prazo: string | null; situacao: string }

type Inspecao = InspecaoIndicador
type Resposta = RespostaIndicador
type NC = NcIndicador

/* Os tipos da tela são os da biblioteca de indicadores: um campo que
   mudar de um lado quebra o outro na compilação, em vez de divergir
   calado.

   A função de data fica aqui porque o filtro de período é da tela; a
   de "hoje" saiu junto com os cálculos, que agora a trazem de lá. */
const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

function PainelInspecoesConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [inspecoes, setInspecoes] = useState<Inspecao[]>([])
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [ncs, setNcs] = useState<NC[]>([])
  /* Só o que o painel precisa saber de um plano: de quem é, para
     quando, e se ainda está vivo. */
  const [acoes, setAcoes] = useState<Acao[]>([])

  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const { data: insp, error } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, modelo_nome, local_nome, iniciada_em, concluida_em, situacao, ' +
            'itens_total, conformes, nao_conformes, nao_aplicaveis, percentual'
        )
        /* Indicador de inspeção de campo não soma auditoria de sistema
         * de gestão: a conta de "conformidade" quer dizer coisas
         * diferentes nos dois, e somar as duas não significa nada. */
        .neq('tipo', 'auditoria')
        .order('iniciada_em', { ascending: false })
        .limit(1000)

      if (error) {
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setInspecoes((insp || []) as unknown as Inspecao[])

      /*
       * Os planos entram no painel por um motivo só: plano atrasado é
       * o indicador que o cliente cobra na reunião. Conformidade alta
       * com plano vencido é tratamento que parou no meio, e só este
       * número mostra isso.
       */
      const [{ data: rs }, { data: ns }, { data: as }] = await Promise.all([
        supabase.from('inspecao_respostas').select('id, inspecao_id, pergunta, resposta').limit(20000),
        supabase
          .from('nao_conformidades')
          .select(
            'id, empresa_id, origem, classificacao, titulo, gravidade, situacao, prazo, ocorrido_em, resposta_id, ' +
              'tipologia, causa_classe, potencial_fatal, ' +
              'local_nome, risco, tipo_incidente, afastamento_dias, created_at, encerrada_em'
          )
          .eq('tipo', 'inspecao')
          .limit(2000),
        supabase
          .from('nc_acoes')
          .select('id, empresa_id, prazo, situacao')
          .limit(4000),
      ])

      setRespostas((rs || []) as unknown as Resposta[])
      setNcs((ns || []) as unknown as NC[])
      setAcoes((as || []) as unknown as Acao[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível montar o painel.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const noPeriodo = (data: string | null) => {
    const d = dia(data)
    if (!d) return false
    if (de && d < de) return false
    if (ate && d > ate) return false
    return true
  }

  /* Só inspeção concluída entra na conta: rascunho não é resultado. */
  const concluidas = useMemo(
    () =>
      inspecoes
        .filter((i) => !empresaAtual || i.empresa_id === empresaAtual)
        .filter((i) => i.situacao === 'concluida')
        .filter((i) => noPeriodo(i.concluida_em || i.iniciada_em)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inspecoes, empresaAtual, de, ate]
  )

  const ncsVisiveis = useMemo(
    () =>
      ncs
        .filter((n) => !empresaAtual || n.empresa_id === empresaAtual)
        .filter((n) => noPeriodo(n.ocorrido_em || n.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ncs, empresaAtual, de, ate]
  )

  /*
   * Os cálculos moram em lib/indicadoresInspecao.ts, porque o
   * relatório consolidado mostra os mesmos números. Duas cópias da
   * conta divergem no primeiro ajuste, e tela e documento discordando
   * destrói a confiança no portal inteiro.
   */
  const porLocal = useMemo(() => calcPorLocal(concluidas), [concluidas])

  const pareto = useMemo(() => calcPareto(ncsVisiveis), [ncsVisiveis])
  const fatais = useMemo(() => potencialFatalEmAberto(ncsVisiveis), [ncsVisiveis])

  /*
   * Plano atrasado é o número que o cliente cobra na reunião:
   * conformidade alta com plano vencido é tratamento que parou no
   * meio. O filtro de período não vale aqui de propósito — atraso não
   * tem data de validade, e esconder o antigo seria o mesmo que
   * perdoá-lo.
   */
  const planosAtrasados = useMemo(() => {
    const limite = new Date().toISOString().slice(0, 10)
    return acoes.filter(
      (a) =>
        (!empresaAtual || a.empresa_id === empresaAtual) &&
        !!a.prazo &&
        a.prazo < limite &&
        !['encerrada', 'cancelada'].includes(a.situacao)
    ).length
  }, [acoes, empresaAtual])

  /*
   * Quantos dias a empresa leva para encerrar uma não conformidade.
   *
   * Conta só as encerradas, porque as abertas ainda não têm fim para
   * medir — incluí-las com a data de hoje faria o número melhorar
   * sozinho a cada dia de atraso, que é o oposto do que ele serve.
   */
  const prazoMedio = useMemo(() => {
    const fechadas = ncsVisiveis.filter((n) => n.situacao === 'encerrada' && n.encerrada_em)
    if (fechadas.length === 0) return null
    const dias = fechadas.map((n) => {
      const inicio = new Date(n.created_at).getTime()
      const fim = new Date(n.encerrada_em as string).getTime()
      return Math.max(0, Math.round((fim - inicio) / 86400000))
    })
    return Math.round(dias.reduce((s, d) => s + d, 0) / dias.length)
  }, [ncsVisiveis])

  const reincidencia = useMemo(
    () => calcReincidencia(concluidas, respostas),
    [concluidas, respostas]
  )

  const totais = useMemo(() => calcTotais(concluidas, ncsVisiveis), [concluidas, ncsVisiveis])

  const eficacia = useMemo(
    () => calcEficacia(ncsVisiveis, respostas, inspecoes),
    [ncsVisiveis, respostas, inspecoes]
  )

  const incidentes = useMemo(() => calcIncidentes(ncsVisiveis), [ncsVisiveis])

  if (semTabela) {
    return (
      <div className="app insp-v2">
        <div className="banner bad">
          As inspeções ainda não foram criadas no banco. Rode <code>supabase/inspecoes.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app insp-v2">
      <div>
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">Painel</h1>
        <p className="subtitulo-tela">
          O resultado por local, a pergunta que falha de novo e o que ainda falta tratar. Só
          inspeção concluída entra na conta — rascunho não é resultado.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <label className="caixa-marcar">
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="caixa-marcar">
          até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
        {/* Quem está olhando os números é quem precisa entregá-los. O
            relatório usa exatamente estes cálculos, de lib/indicadores
            Inspecao.ts, e congela o período num documento. */}
        <Link href="/inspecoes/relatorio" className="btn btn-sm">
          Emitir relatório do período
        </Link>
      </div>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="num">{totais.aplicadas}</div>
              <div className="lbl">Inspeções concluídas</div>
            </div>
            <div className="stat">
              <div className="num">{totais.conformidade === null ? '—' : totais.conformidade + '%'}</div>
              <div className="lbl">Conformidade</div>
            </div>
            <div className={'stat' + (totais.abertas ? ' warn' : '')}>
              <div className="num">{totais.abertas}</div>
              <div className="lbl">Não conformidades abertas</div>
            </div>
            <div className={'stat' + (totais.vencidas ? ' bad' : '')}>
              <div className="num">{totais.vencidas}</div>
              <div className="lbl">Com prazo vencido</div>
            </div>
            {/* Os dois que faltavam para o painel responder a reunião
                inteira: o que parou no meio, e quanto tempo leva para
                terminar o que não para. */}
            <div className={'stat' + (planosAtrasados ? ' bad' : '')}>
              <div className="num">{planosAtrasados}</div>
              <div className="lbl">Planos de ação atrasados</div>
              <div className="dica">de todo o histórico, não só do período</div>
            </div>
            <div className="stat">
              <div className="num">
                {prazoMedio === null ? '—' : prazoMedio}
                {prazoMedio === null ? '' : <span className="unidade"> dias</span>}
              </div>
              <div className="lbl">Prazo médio de tratamento</div>
              <div className="dica">
                {prazoMedio === null
                  ? 'nenhuma encerrada ainda'
                  : 'da abertura até encerrar, só as encerradas'}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">
                Eficácia — a ação resolveu, ou o problema voltou?
              </div>
            </div>
            <div className="panel-body">
              {eficacia.encerradas === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhuma não conformidade de inspeção encerrada no período.
                </p>
              ) : (
                <div className="stats">
                  <div className="stat good">
                    <div className="num">{eficacia.taxa}%</div>
                    <div className="lbl">Não voltaram em 90 dias</div>
                  </div>
                  <div className="stat">
                    <div className="num">{eficacia.encerradas}</div>
                    <div className="lbl">Encerradas no período</div>
                  </div>
                  <div className={'stat' + (eficacia.reincidiu ? ' bad' : '')}>
                    <div className="num">{eficacia.reincidiu}</div>
                    <div className="lbl">Voltaram a reprovar</div>
                  </div>
                </div>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>
                Encerrar não prova nada — prova é não voltar. Para cada não conformidade
                encerrada, o portal procura a mesma pergunta reprovando de novo no mesmo local
                nos 90 dias seguintes. É a verificação da eficácia que o item 10.2 pede,
                virada em número.
              </p>
            </div>
          </div>

          {/*
            * PRIMEIRO O QUE AINDA PODE MATAR.
            *
            * É a única lista do painel que fala do acidente que não
            * aconteceu. Vem antes dos gráficos porque quem tem três
            * destas na mão não precisa de gráfico: precisa de nome,
            * prazo e telefone.
            */}
          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Potencial fatal em aberto</div>
            </div>
            <div className="panel-body">
              {fatais.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhuma em aberto no período. A marca é dada em campo, pelo que poderia ter
                  acontecido — não pela gravidade do que aconteceu.
                </p>
              ) : (
                /*
                 * Cartão, e não linha de tabela.
                 *
                 * Tabela é para comparar muitas coisas parecidas. Aqui
                 * são poucas e nenhuma é parecida com outra: cada uma é
                 * um acidente que não aconteceu. O cartão tinto de
                 * vermelho é lido de longe, de pé, na reunião — que é
                 * onde esta lista costuma ser aberta.
                 */
                <ul className="insp-fatais">
                  {fatais.map((n) => {
                    const vencido = n.prazo && n.prazo < new Date().toISOString().slice(0, 10)
                    return (
                      <li key={n.id}>
                        <p className="insp-fatal-tit">{n.titulo || 'Sem título'}</p>
                        <p className="insp-fatal-pe">
                          {n.local_nome || 'local não informado'}
                          {' · gravidade '}
                          {n.gravidade}
                          {' · '}
                          {n.prazo ? (
                            <b className={vencido ? 'vencido' : undefined}>
                              {vencido ? 'prazo vencido em ' : 'vence em '}
                              {n.prazo.split('-').reverse().join('/')}
                            </b>
                          ) : (
                            <b className="vencido">sem prazo definido</b>
                          )}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Os dois lados da mesma pergunta, lado a lado: o que mais
              produz não conformidade e o que volta a falhar no mesmo
              lugar. Separados por uma tela de rolagem, ninguém os lia
              junto. */}
          <div className="insp-duas">

          {/*
            * O Pareto das causas.
            *
            * A pergunta que ele responde não é "qual é a maior" — é
            * "quantas eu preciso atacar para resolver a maior parte".
            * Por isso a coluna do acumulado existe.
            */}
          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Causas-raiz — o que mais produz não conformidade</div>
            </div>
            <div className="panel-body">
              {pareto.linhas.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhuma não conformidade com causa classificada no período. A classificação é
                  feita na ficha da NC, na aba de investigação — é ela que monta este gráfico.
                </p>
              ) : (
                <table className="tabela-colab">
                  <thead>
                    <tr>
                      <th>Causa</th>
                      <th style={{ width: '38%' }}>Peso</th>
                      <th>Quantas</th>
                      <th>Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pareto.linhas.map((l) => (
                      <tr key={l.causa}>
                        <td className="nome">{rotuloCausa(l.causa) || l.causa}</td>
                        <td>
                          <span className="pareto-trilho">
                            <span className="pareto-barra" style={{ width: l.percentual + '%' }} />
                          </span>
                        </td>
                        <td>
                          {l.quantas} <span style={{ color: 'var(--ink-faint)' }}>({l.percentual}%)</span>
                        </td>
                        <td>{l.acumulado}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {pareto.semCausa > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>
                  {pareto.semCausa}{' '}
                  {pareto.semCausa === 1
                    ? 'não conformidade ainda não tem causa classificada e ficou de fora'
                    : 'não conformidades ainda não têm causa classificada e ficaram de fora'}
                  . Elas não viram &quot;outros&quot;: contá-las como categoria mentiria sobre o
                  tamanho das demais.
                </p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Reincidência — a pergunta que falha de novo</div>
            </div>
            <div className="panel-body">
              {reincidencia.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhum item reprovado no período.
                </p>
              ) : (
                /*
                 * Lista, e não tabela de quatro colunas.
                 *
                 * A pergunta aqui é uma só — "o que falha de novo?" —,
                 * e a resposta cabe em duas informações: qual item e
                 * quantas vezes. Avaliada e taxa viraram a letra miúda
                 * da mesma linha: continuam disponíveis para quem
                 * precisa conferir, sem ocupar uma coluna cada.
                 */
                <ul className="insp-repete">
                  {reincidencia.map((r) => (
                    <li key={r.pergunta}>
                      <span className="insp-repete-item">{r.pergunta}</span>
                      <span className="insp-repete-conta">
                        <b className={r.reprovada > 1 ? 'muitas' : undefined}>{r.reprovada}×</b>
                        <em>
                          em {r.avaliada} · {r.taxa}%
                        </em>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>
                Item que reprova mais de uma vez não é achado: é controle que não existe. O
                percentual de conformidade sozinho esconde justamente isso.
              </p>
            </div>
          </div>

          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Resultado por local</div>
            </div>
            <div className="panel-body">
              {porLocal.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhuma inspeção concluída no período.
                </p>
              ) : (
                <table className="tabela-colab">
                  <thead>
                    <tr>
                      <th>Local</th>
                      <th>Inspeções</th>
                      <th>Itens</th>
                      <th>Não conformes</th>
                      <th>Conformidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porLocal.map((l) => (
                      <tr key={l.local}>
                        <td className="nome">{l.local}</td>
                        <td>{l.aplicadas}</td>
                        <td>{l.itens}</td>
                        <td>{l.nc}</td>
                        <td>
                          {l.percentual === null ? (
                            '—'
                          ) : l.percentual < 80 ? (
                            <span className="pill warn">{l.percentual}%</span>
                          ) : (
                            l.percentual + '%'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="section-title">Incidentes no período</div>
            </div>
            <div className="panel-body">
              {incidentes.total === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  Nenhum incidente lançado no período.
                </p>
              ) : (
                <>
                  <div className="stats">
                    <div className="stat">
                      <div className="num">{incidentes.total}</div>
                      <div className="lbl">Incidentes</div>
                    </div>
                    <div className={'stat' + (incidentes.afastamento ? ' bad' : '')}>
                      <div className="num">{incidentes.afastamento}</div>
                      <div className="lbl">Dias de afastamento</div>
                    </div>
                    <div className="stat">
                      <div className="num">{totais.mediaDias === null ? '—' : totais.mediaDias}</div>
                      <div className="lbl">Dias médios até encerrar</div>
                    </div>
                  </div>
                  <table className="tabela-colab" style={{ marginTop: 10 }}>
                    <tbody>
                      {incidentes.porTipo.map(([tipo, n]) => (
                        <tr key={tipo}>
                          <td className="nome">{TIPO_INCIDENTE[tipo] || tipo}</td>
                          <td>{n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>
                O quase-acidente conta junto de propósito: é o aviso que chega antes do acidente, e
                empresa que não registra nenhum normalmente não está sem risco, está sem registro.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function PainelInspecoes() {
  return (
    <ComModulo modulo="inspecoes">
      <PainelInspecoesConteudo />
    </ComModulo>
  )
}
