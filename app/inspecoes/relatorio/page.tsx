'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import {
  porLocal as calcPorLocal,
  reincidencia as calcReincidencia,
  totais as calcTotais,
  eficacia as calcEficacia,
  incidentes as calcIncidentes,
  oportunidades as calcOportunidades,
  conformidades as calcConformidades,
  ehNaoConformidade,
  dia,
  hoje,
  TIPO_INCIDENTE,
  type InspecaoIndicador,
  type RespostaIndicador,
  type NcIndicador,
} from '@/lib/indicadoresInspecao'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'
/* Mesmo formato de documento do relatório de auditoria e do de cada
   inspeção: capa, seções numeradas, lacuna declarada e regras de
   impressão. Uma folha só para os três. */
import '../../auditorias/[id]/relatorio/relatorio.css'
import '../[id]/relatorio/relatorio.css'
import './consolidado.css'

/*
 * Relatório consolidado das inspeções de um período.
 *
 * POR QUE ELE EXISTE, JÁ HAVENDO O PAINEL. O painel é para olhar: tem
 * filtro, muda quando o dado muda e vive na tela. Este é para
 * entregar: congela um período, sai em PDF e vai para a reunião mensal,
 * para o cliente ou para a pasta do PGR. São usos diferentes do mesmo
 * número — e é por isso que a conta mora em lib/indicadoresInspecao.ts,
 * chamada pelos dois. Tela e documento discordando destrói a confiança
 * no portal inteiro.
 *
 * NÃO É O RELATÓRIO DE UMA INSPEÇÃO. Aquele prova o que foi visto num
 * local, num dia. Este responde outra pergunta: a empresa está
 * melhorando? Por isso o que manda aqui é reincidência e eficácia, e
 * não a lista de itens.
 *
 * A REINCIDÊNCIA VEM ANTES DA CONFORMIDADE, DE PROPÓSITO. Noventa e
 * cinco por cento de conformidade com o mesmo item reprovando todo mês
 * não é um bom resultado: é um controle que não existe. Quem lê o
 * relatório de cima para baixo precisa topar com isso antes do número
 * que agrada.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null; cnpj?: string | null }

const dataBr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' }) : null

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const soData = (d: string) => d.split('-').reverse().join('/')

/*
 * Mês corrente, do dia 1 até hoje.
 *
 * O recorte da reunião mensal é o mês FECHADO, e esse foi o primeiro
 * padrão que escrevi. Mas quem abre a tela no meio do mês veria o
 * relatório vazio, com as inspeções desta semana fora da conta — e
 * relatório que abre vazio parece quebrado, não parece filtrado. O mês
 * corrente mostra trabalho desde o primeiro clique, e trocar as datas
 * para fechar o mês anterior é um ajuste de dois campos.
 */
function mesCorrente() {
  const agora = new Date()
  const ini = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
  return { de: ini.toISOString().slice(0, 10), ate: agora.toISOString().slice(0, 10) }
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="rel-campo">
      <span className="rel-rotulo">{rotulo}</span>
      <span className={'rel-valor' + (valor ? '' : ' falta')}>{valor || 'não registrado'}</span>
    </div>
  )
}

function ConsolidadoConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [inspecoes, setInspecoes] = useState<InspecaoIndicador[]>([])
  const [respostas, setRespostas] = useState<RespostaIndicador[]>([])
  const [ncs, setNcs] = useState<NcIndicador[]>([])

  const inicial = mesCorrente()
  const [de, setDe] = useState(inicial.de)
  const [ate, setAte] = useState(inicial.ate)
  const [emitidoEm] = useState(() => new Date().toISOString())

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

  const carregar = useCallback(async () => {
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

      const souInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(souInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

      if (souInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia, cnpj')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      } else if (perfil?.empresa_id) {
        const { data: emp } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia, cnpj')
          .eq('id', perfil.empresa_id)
          .maybeSingle()
        if (emp) setEmpresas([emp as Empresa])
      }

      /* Só inspeção: a auditoria divide a mesma tabela e tem relatório
         próprio, com outro formato e outra pergunta. */
      const [{ data: insp }, { data: resp }, { data: nc }] = await Promise.all([
        supabase
          .from('inspecoes')
          .select(
            'id, empresa_id, modelo_nome, local_nome, iniciada_em, concluida_em, situacao, ' +
              'itens_total, conformes, nao_conformes, nao_aplicaveis, percentual'
          )
          .eq('tipo', 'inspecao')
          .order('concluida_em', { ascending: false }),
        supabase
          .from('inspecao_respostas')
          .select('id, inspecao_id, pergunta, resposta')
          .limit(20000),
        supabase
          .from('nao_conformidades')
          .select(
            'id, empresa_id, origem, classificacao, gravidade, resposta_id, local_nome, risco, situacao, ' +
              'prazo, ocorrido_em, tipo_incidente, afastamento_dias, created_at, encerrada_em'
          ),
      ])

      setInspecoes((insp || []) as unknown as InspecaoIndicador[])
      setRespostas((resp || []) as unknown as RespostaIndicador[])
      setNcs((nc || []) as unknown as NcIndicador[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível montar o relatório.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const noPeriodo = useCallback(
    (iso: string | null) => {
      const d = dia(iso)
      if (!d) return false
      if (de && d < de) return false
      if (ate && d > ate) return false
      return true
    },
    [de, ate]
  )

  const concluidas = useMemo(
    () =>
      inspecoes
        .filter((i) => !empresaAtual || i.empresa_id === empresaAtual)
        .filter((i) => i.situacao === 'concluida')
        .filter((i) => noPeriodo(i.concluida_em || i.iniciada_em)),
    [inspecoes, empresaAtual, noPeriodo]
  )

  const ncsVisiveis = useMemo(
    () =>
      ncs
        .filter((n) => !empresaAtual || n.empresa_id === empresaAtual)
        .filter((n) => noPeriodo(n.ocorrido_em || n.created_at)),
    [ncs, empresaAtual, noPeriodo]
  )

  const porLocal = useMemo(() => calcPorLocal(concluidas), [concluidas])
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

  const abertas = useMemo(
    () =>
      ncsVisiveis
        .filter(ehNaoConformidade)
        .filter((n) => !['encerrada', 'cancelada'].includes(n.situacao))
        .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999')),
    [ncsVisiveis]
  )

  /* Listadas à parte: nada está errado, e misturá-las com as não
     conformidades faria a direção ler sugestão como problema. */
  const melhorias = useMemo(() => calcOportunidades(ncsVisiveis), [ncsVisiveis])

  /* O que foi olhado e estava certo. É a amostra do período: sem ele,
     "duas não conformidades" não diz se foram olhados dois itens ou
     duzentos. */
  const conformes = useMemo(() => calcConformidades(ncsVisiveis), [ncsVisiveis])

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  const empresa = empresas.find((e) => e.id === empresaAtual)
  const empresaNome = empresa ? empresa.nome_fantasia || empresa.razao_social : null

  return (
    <div className="app rel">
      <div className="nao-imprimir cons-controles">
        <Link href="/inspecoes/painel" className="btn btn-sm">
          Voltar à visão geral
        </Link>
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <label className="cons-data">
          De
          <input type="date" value={de} max={ate || hoje()} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="cons-data">
          Até
          <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
        </label>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </button>
      </div>

      {erro && <div className="banner bad nao-imprimir">{erro}</div>}

      {interno && !empresaAtual && (
        <div className="banner nao-imprimir">
          Nenhuma empresa escolhida: o relatório está somando todos os clientes. Para entregar a
          um deles, escolha a empresa acima.
        </div>
      )}

      <div className="rel-capa">
        <p className="eyebrow">RELATÓRIO DE INSPEÇÕES</p>
        <h1>
          {de && ate ? `${soData(de)} a ${soData(ate)}` : 'Período completo'}
        </h1>
        <p className="rel-sub">
          {empresaNome || (interno ? 'Todas as empresas' : 'Empresa não identificada')} ·{' '}
          {totais.aplicadas} inspeção{totais.aplicadas === 1 ? '' : 'ões'} concluída
          {totais.aplicadas === 1 ? '' : 's'}
        </p>
      </div>

      <div className="rel-controle">
        <span>
          <strong>Emitido em:</strong> {dataHora(emitidoEm)}
        </span>
        <span>
          <strong>Base:</strong> inspeções concluídas no período
        </span>
      </div>

      <section>
        <h2>1. Identificação</h2>
        <div className="rel-campos">
          <Campo rotulo="Empresa" valor={empresa?.razao_social} />
          <Campo rotulo="CNPJ" valor={empresa?.cnpj} />
          <Campo rotulo="Período" valor={de && ate ? `${soData(de)} a ${soData(ate)}` : null} />
          <Campo rotulo="Inspeções concluídas" valor={String(totais.aplicadas)} />
        </div>
      </section>

      {totais.aplicadas === 0 ? (
        <section>
          <h2>2. Resultado</h2>
          <p className="rel-valor falta">
            Nenhuma inspeção foi concluída neste período. Sem inspeção não há o que relatar — e,
            se o programa previa visitas, a ausência delas é o achado.
          </p>
        </section>
      ) : (
        <>
          <section>
            <h2>2. O que se repete</h2>
            <p className="rel-nota">
              Esta seção vem antes do percentual de propósito. Conformidade alta com o mesmo item
              reprovando mês após mês não é bom resultado: é controle que não existe.
            </p>
            {reincidencia.length === 0 ? (
              <p className="rel-valor">
                Nenhum item reprovou no período. Se houve inspeção, é resultado; se foram poucas,
                é amostra pequena.
              </p>
            ) : (
              <table className="tabela-colab rel-itens">
                <thead>
                  <tr>
                    <th>Item verificado</th>
                    <th style={{ width: 110 }}>Avaliado</th>
                    <th style={{ width: 110 }}>Reprovou</th>
                    <th style={{ width: 110 }}>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {reincidencia.map((r, i) => (
                    <tr key={i}>
                      <td>{r.pergunta}</td>
                      <td className="mono">{r.avaliada}×</td>
                      <td className="mono">{r.reprovada}×</td>
                      <td>
                        <span className={'pill ' + (r.taxa >= 50 ? 'bad' : 'warn')}>{r.taxa}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>3. Eficácia do que foi tratado</h2>
            <p className="rel-nota">
              Encerrar uma não conformidade não prova nada; prova é ela não voltar. Para cada uma
              encerrada, o mesmo item é procurado no mesmo local nas inspeções dos 90 dias
              seguintes. É a verificação de eficácia que o 10.2 pede — aqui como número, não como
              campo de texto.
            </p>
            <div className="stats">
              <div className="stat">
                <div className="num">{eficacia.encerradas}</div>
                <div className="rot">encerradas no período</div>
              </div>
              <div className={'stat' + (eficacia.reincidiu ? ' bad' : '')}>
                <div className="num">{eficacia.reincidiu}</div>
                <div className="rot">voltaram a reprovar</div>
              </div>
              <div className="stat">
                <div className="num">{eficacia.taxa !== null ? eficacia.taxa + '%' : '—'}</div>
                <div className="rot">eficácia</div>
              </div>
              <div className="stat">
                <div className="num">{totais.mediaDias !== null ? totais.mediaDias : '—'}</div>
                <div className="rot">dias para encerrar, em média</div>
              </div>
            </div>
            {eficacia.encerradas === 0 && (
              <p className="rel-valor falta">
                Nenhuma não conformidade foi encerrada no período, então não há eficácia a medir.
              </p>
            )}
          </section>

          <section>
            <h2>4. Conformidade por local</h2>
            <p className="rel-nota">
              Ordenado do pior para o melhor: é a fila de onde ir primeiro. O que foi marcado como
              não aplicável fica fora da conta.
            </p>
            <table className="tabela-colab rel-itens">
              <thead>
                <tr>
                  <th>Local</th>
                  <th style={{ width: 110 }}>Inspeções</th>
                  <th style={{ width: 110 }}>Itens</th>
                  <th style={{ width: 130 }}>Não conformes</th>
                  <th style={{ width: 130 }}>Conformidade</th>
                </tr>
              </thead>
              <tbody>
                {porLocal.map((l, i) => (
                  <tr key={i}>
                    <td className={l.local === 'Sem local' ? 'rel-valor falta' : 'nome'}>
                      {l.local === 'Sem local' ? 'local não registrado' : l.local}
                    </td>
                    <td className="mono">{l.aplicadas}</td>
                    <td className="mono">{l.itens}</td>
                    <td className="mono">{l.nc}</td>
                    <td>
                      <strong>{l.percentual !== null ? l.percentual + '%' : '—'}</strong>
                    </td>
                  </tr>
                ))}
                <tr className="cons-total">
                  <td>
                    <strong>Geral</strong>
                  </td>
                  <td className="mono">{totais.aplicadas}</td>
                  <td className="mono">{concluidas.reduce((s, i) => s + i.itens_total, 0)}</td>
                  <td className="mono">{concluidas.reduce((s, i) => s + i.nao_conformes, 0)}</td>
                  <td>
                    <strong>
                      {totais.conformidade !== null ? totais.conformidade + '%' : '—'}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}

      <section>
        <h2>5. Não conformidades em aberto</h2>
        {abertas.length === 0 ? (
          <p className="rel-valor">Nenhuma não conformidade em aberto no período.</p>
        ) : (
          <>
            {/* Separar o parcial muda como o cliente lê: "três não
                atendem e dois atendem em parte" é uma empresa que está
                trabalhando; "cinco não atendem" é uma empresa que
                desistiu — e quem lê a segunda frase para de ler. */}
            {totais.parciais > 0 && (
              <p className="rel-nota">
                Dos {abertas.length} em aberto, {totais.parciais} atende
                {totais.parciais === 1 ? '' : 'm'} em parte: o trabalho começou e não terminou.
                Entram na mesma fila porque têm prazo e dono, mas não são o mesmo caso de quem
                não fez nada.
              </p>
            )}
            {totais.vencidas > 0 && (
              <p className="rel-conclusao falta">
                {totais.vencidas} com prazo vencido. Prazo vencido sem repactuação registrada é a
                constatação mais fácil de um auditor externo encontrar.
              </p>
            )}
            <table className="tabela-colab rel-itens">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Prazo</th>
                  <th style={{ width: 120 }}>Conclusão</th>
                  <th style={{ width: 100 }}>Gravidade</th>
                  <th>Local</th>
                  <th style={{ width: 140 }}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {abertas.map((n) => {
                  const vencida = n.prazo && n.prazo < hoje()
                  return (
                    <tr key={n.id}>
                      <td className="mono">
                        {n.prazo ? (
                          <span className={vencida ? 'pill bad' : ''}>{soData(n.prazo)}</span>
                        ) : (
                          <span className="rel-valor falta">sem prazo</span>
                        )}
                      </td>
                      <td>
                        {n.classificacao === 'insuficiente' ? (
                          <span className="pill warn">Atende em parte</span>
                        ) : (
                          <span className="pill bad">Não atende</span>
                        )}
                      </td>
                      <td>{n.gravidade}</td>
                      <td>{n.local_nome || <span className="rel-valor falta">não registrado</span>}</td>
                      <td>{n.situacao}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="rel-nota nao-imprimir">
              O detalhe de cada uma — causa, ação e verificação — está em{' '}
              <Link href="/inspecoes/nc">Não conformidades</Link>.
            </p>
          </>
        )}
      </section>

      <section>
        <h2>6. O que foi verificado e estava conforme</h2>
        <p className="rel-nota">
          É a amostra do período. Sem ela, &ldquo;duas não conformidades&rdquo; não diz se foram
          olhados dois itens ou duzentos — e um relatório só de defeito descreve a empresa pior
          do que ela é.
        </p>
        {conformes.length === 0 ? (
          <p className="rel-valor falta">
            Nenhum item foi registrado como conforme no período. Vale registrar: é o que sustenta
            o controle que deu certo quando o supervisor muda.
          </p>
        ) : (
          <table className="tabela-colab rel-itens">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Registrado</th>
                <th>Local</th>
              </tr>
            </thead>
            <tbody>
              {conformes.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{soData(dia(c.ocorrido_em || c.created_at))}</td>
                  <td>{c.local_nome || <span className="rel-valor falta">não registrado</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>7. Oportunidades de melhoria</h2>
        <p className="rel-nota">
          Aqui nada está errado: dá para ser melhor. Elas aparecem separadas das não
          conformidades de propósito — tratar sugestão como defeito abre ação corretiva do que
          não falhou, e ensina a equipe a parar de sugerir.
        </p>
        {melhorias.length === 0 ? (
          <p className="rel-valor">Nenhuma oportunidade registrada no período.</p>
        ) : (
          <table className="tabela-colab rel-itens">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Registrada</th>
                <th>Local</th>
                <th style={{ width: 140 }}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {melhorias.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{soData(dia(m.ocorrido_em || m.created_at))}</td>
                  <td>{m.local_nome || <span className="rel-valor falta">não registrado</span>}</td>
                  <td>{m.situacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>8. Incidentes do período</h2>
        {incidentes.total === 0 ? (
          <p className="rel-valor">
            Nenhum incidente registrado. Vale uma pergunta honesta à equipe: não houve, ou não foi
            reportado? Quase-acidente que não chega é o aviso que a empresa perdeu.
          </p>
        ) : (
          <>
            <div className="stats">
              <div className="stat">
                <div className="num">{incidentes.total}</div>
                <div className="rot">registrados</div>
              </div>
              <div className={'stat' + (incidentes.afastamento ? ' bad' : '')}>
                <div className="num">{incidentes.afastamento}</div>
                <div className="rot">dias de afastamento</div>
              </div>
            </div>
            <table className="tabela-colab rel-itens">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th style={{ width: 110 }}>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {incidentes.porTipo.map(([tipo, qtd]) => (
                  <tr key={tipo}>
                    <td>{TIPO_INCIDENTE[tipo] || tipo}</td>
                    <td className="mono">{qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {concluidas.length > 0 && (
        <section>
          <h2>9. Inspeções do período</h2>
          <table className="tabela-colab rel-itens">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Conclusão</th>
                <th>Checklist</th>
                <th>Local</th>
                <th style={{ width: 120 }}>Conformidade</th>
                <th className="nao-imprimir" />
              </tr>
            </thead>
            <tbody>
              {concluidas.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{dataBr(i.concluida_em)}</td>
                  <td className="nome">{i.modelo_nome}</td>
                  <td>{i.local_nome || <span className="rel-valor falta">não registrado</span>}</td>
                  <td>{i.percentual !== null ? i.percentual + '%' : '—'}</td>
                  <td className="nao-imprimir">
                    <Link href={'/inspecoes/' + i.id + '/relatorio'} className="btn btn-sm">
                      Relatório
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rel-rodape">
        <h2>10. Ressalva e encerramento</h2>
        <p className="rel-nota">
          Os números vêm das inspeções concluídas no período, com os totais congelados no
          encerramento de cada uma. A inspeção é verificação por amostragem: ausência de registro
          de um problema não prova que ele não exista — prova que não foi observado nas visitas
          deste período.
        </p>
        <div className="rel-assinaturas">
          <div>
            <span className="rel-linha-ass" />
            <p>Responsável pela segurança</p>
            <p className="rel-mini">Elaboração</p>
          </div>
          <div>
            <span className="rel-linha-ass" />
            <p>Direção</p>
            <p className="rel-mini">Ciente dos resultados e dos prazos</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function RelatorioConsolidado() {
  return (
    <ComModulo modulo="inspecoes">
      <ConsolidadoConteudo />
    </ComModulo>
  )
}
