'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import { rotuloDoPapel } from '@/components/PlanoDaAuditoria'
import '../../../colaboradores/colaboradores.css'
import '../../../inspecoes/inspecoes.css'
import './relatorio.css'

/*
 * Relatório da auditoria — ABNT NBR ISO 19011:2018, 6.5, no formato em
 * que o organismo certificador entrega.
 *
 * A norma não pede "um resumo": pede um relatório que identifique a
 * auditoria, diga contra o que ela foi feita, o que foi constatado e a
 * que conclusão o auditor líder chegou. E pede o registro de para quem
 * ele foi distribuído (6.5.2), porque "eu mandei" sem data e
 * destinatário não vale nada seis meses depois.
 *
 * NOVE COISAS VIERAM DO RELATÓRIO REAL. Tipo de auditoria; quem estava
 * na sala; três níveis de achado em vez de dois; pontos fortes; a
 * verificação das constatações da vez passada; as exclusões; as
 * recomendações; a ressalva de amostragem; e o cabeçalho controlado.
 * Esse último não é enfeite: um relatório sem código, revisão e
 * confidencialidade é ele mesmo uma constatação de 7.5.2 — a ferramenta
 * não pode entregar um documento que seria reprovado numa auditoria.
 *
 * O QUE FALTA FICA VISÍVEL. Campo não preenchido aparece como "não
 * registrado", e não some do relatório. Esconder o que falta é o jeito
 * mais rápido de entregar um documento bonito e inútil: na certificação
 * o auditor externo pergunta justamente pelo que não está lá.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const MODALIDADES: Record<string, string> = {
  interna: 'Auditoria interna (primeira parte)',
  fornecedor: 'Auditoria de fornecedor (segunda parte)',
  certificacao: 'Auditoria de certificação inicial',
  supervisao: 'Auditoria de supervisão / manutenção',
  recertificacao: 'Auditoria de recertificação',
  transicao: 'Auditoria de transição de versão da norma',
  diagnostico: 'Diagnóstico (pré-auditoria)',
}

type Inspecao = {
  id: string
  empresa_id: string
  tipo: string
  modelo_nome: string
  norma: string | null
  situacao: string
  iniciada_em: string
  concluida_em: string | null
  itens_total: number
  conformes: number
  nao_conformes: number
  nao_aplicaveis: number
  parciais: number
  percentual: number | null
  objetivo: string | null
  escopo: string | null
  criterios: string | null
  equipe: string | null
  auditor_lider: string | null
  inspetor_nome: string | null
  plano_agenda: string | null
  abertura_em: string | null
  abertura_participantes: string | null
  encerramento_em: string | null
  encerramento_participantes: string | null
  conclusao: string | null
  relatorio_em: string | null
  modalidade: string | null
  pontos_fortes: string | null
  recomendacoes: string | null
  exclusoes: string | null
  anterior_id: string | null
  anterior_verificacao: string | null
  doc_codigo: string | null
  doc_revisao: string | null
  confidencialidade: string | null
  amostragem: string | null
}

type Resposta = {
  id: string
  ordem: number
  categoria: string | null
  pergunta: string
  resposta: string | null
  observacao: string | null
  inspecao_modelo_itens: { requisito: string | null } | { requisito: string | null }[] | null
}

type NC = {
  id: string
  descricao: string
  classificacao: string | null
  situacao: string
  prazo: string | null
  responsavel_nome: string | null
  causa: string | null
  acao_corretiva: string | null
  eficaz: boolean | null
}

type Envio = {
  id: number
  tipo: string
  destinatarios: string
  assunto: string | null
  enviado_em: string
  enviado_por_nome: string | null
}

type LinhaAgenda = {
  id: number
  dia: string | null
  horario: string | null
  area: string
  auditor: string | null
  participantes: string | null
  requisitos: string | null
}

type Participante = {
  id: number
  nome: string
  cargo: string | null
  area: string | null
  papel: string
  abertura: boolean
  encerramento: boolean
}

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' }) : null

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null

/* Campo em branco não some: vira uma lacuna declarada. */
function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="rel-campo">
      <div className="rel-rotulo">{rotulo}</div>
      <div className={valor ? 'rel-valor' : 'rel-valor falta'}>{valor || 'não registrado'}</div>
    </div>
  )
}

/* Um bloco de texto corrido que também declara a própria ausência. */
function Bloco({ valor, vazio }: { valor: string | null; vazio: string }) {
  return <div className={valor ? 'rel-conclusao' : 'rel-conclusao falta'}>{valor || vazio}</div>
}

function RelatorioConteudo() {
  const { id } = useParams<{ id: string }>()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [inspecao, setInspecao] = useState<Inspecao | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [ncs, setNcs] = useState<NC[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [agenda, setAgenda] = useState<LinhaAgenda[]>([])
  const [pessoas, setPessoas] = useState<Participante[]>([])
  const [anterior, setAnterior] = useState<{ norma: string | null; modelo_nome: string; concluida_em: string | null } | null>(null)

  const [interno, setInterno] = useState(false)
  const [meuNome, setMeuNome] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [envio, setEnvio] = useState({ destinatarios: '', assunto: '' })

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
        .select('perfil, nome')
        .eq('id', user.id)
        .single()

      setInterno(PERFIS_INTERNOS.includes(perfil?.perfil || ''))
      setMeuNome(perfil?.nome || '')

      const { data: i, error } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, tipo, modelo_nome, norma, situacao, iniciada_em, concluida_em, ' +
            'itens_total, conformes, nao_conformes, nao_aplicaveis, parciais, percentual, ' +
            'objetivo, escopo, criterios, equipe, auditor_lider, inspetor_nome, plano_agenda, ' +
            'abertura_em, abertura_participantes, encerramento_em, encerramento_participantes, ' +
            'conclusao, relatorio_em, modalidade, pontos_fortes, recomendacoes, exclusoes, ' +
            'anterior_id, anterior_verificacao, doc_codigo, doc_revisao, confidencialidade, amostragem'
        )
        .eq('id', id)
        .single()

      if (error) throw error
      setInspecao(i as unknown as Inspecao)

      const [{ data: emp }, { data: rs }, { data: ns }, { data: es }, { data: ag }, { data: ps }] =
        await Promise.all([
          supabase
            .from('empresas')
            .select('razao_social, nome_fantasia')
            .eq('id', (i as any).empresa_id)
            .single(),
          supabase
            .from('inspecao_respostas')
            .select(
              'id, ordem, categoria, pergunta, resposta, observacao, ' +
                'inspecao_modelo_itens!item_id(requisito)'
            )
            .eq('inspecao_id', id)
            .order('ordem'),
          supabase
            .from('nao_conformidades')
            .select(
              'id, descricao, classificacao, situacao, prazo, responsavel_nome, causa, acao_corretiva, eficaz'
            )
            .eq('inspecao_id', id)
            .order('created_at'),
          supabase
            .from('auditoria_envios')
            .select('id, tipo, destinatarios, assunto, enviado_em, enviado_por_nome')
            .eq('inspecao_id', id)
            .order('enviado_em', { ascending: false }),
          supabase
            .from('auditoria_agenda')
            .select('id, dia, horario, area, auditor, participantes, requisitos')
            .eq('inspecao_id', id)
            .order('ordem')
            .order('id'),
          supabase
            .from('auditoria_participantes')
            .select('id, nome, cargo, area, papel, abertura, encerramento')
            .eq('inspecao_id', id)
            .order('papel')
            .order('nome'),
        ])

      setEmpresaNome(((emp as any)?.nome_fantasia || (emp as any)?.razao_social || '') as string)
      setRespostas((rs || []) as unknown as Resposta[])
      setNcs((ns || []) as unknown as NC[])
      setEnvios((es || []) as unknown as Envio[])
      setAgenda((ag || []) as unknown as LinhaAgenda[])
      setPessoas((ps || []) as unknown as Participante[])

      if ((i as any).anterior_id) {
        const { data: ant } = await supabase
          .from('inspecoes')
          .select('norma, modelo_nome, concluida_em')
          .eq('id', (i as any).anterior_id)
          .single()
        setAnterior((ant as any) || null)
      } else {
        setAnterior(null)
      }
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível montar o relatório.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const requisitoDe = (r: Resposta) => {
    const rel = Array.isArray(r.inspecao_modelo_itens)
      ? r.inspecao_modelo_itens[0]
      : r.inspecao_modelo_itens
    return rel?.requisito || String(r.ordem)
  }

  async function registrarEnvio() {
    if (registrando) return
    const destinatarios = envio.destinatarios.trim()
    if (!destinatarios) {
      setErro('Diga para quem o relatório foi enviado.')
      return
    }

    setRegistrando(true)
    setErro('')

    const { error } = await supabase.from('auditoria_envios').insert({
      inspecao_id: id,
      tipo: 'relatorio',
      destinatarios,
      assunto: envio.assunto.trim() || null,
      enviado_por_nome: meuNome || null,
    })

    if (!error && inspecao && !inspecao.relatorio_em) {
      await supabase.from('inspecoes').update({ relatorio_em: new Date().toISOString() }).eq('id', id)
    }

    setRegistrando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setEnvio({ destinatarios: '', assunto: '' })
    await carregar()
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Montando o relatório…</p>
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

  const viva = (n: NC) => n.situacao !== 'cancelada'
  const maiores = ncs.filter((n) => n.classificacao === 'maior' && viva(n))
  const menores = ncs.filter((n) => n.classificacao === 'menor' && viva(n))
  const observacoes = ncs.filter((n) => n.classificacao === 'observacao' && viva(n))
  const oportunidades = ncs.filter((n) => n.classificacao === 'oportunidade' && viva(n))
  const semClasse = ncs.filter((n) => !n.classificacao && viva(n))
  const abertas = ncs.filter((n) => !['encerrada', 'cancelada'].includes(n.situacao)).length

  /* As três listas do relatório da certificadora. A oportunidade de
     melhoria sai da tabela das não conformidades: misturar as duas faz a
     empresa abrir ação corretiva do que não falhou. */
  const naoConformidades = ncs.filter(
    (n) => n.classificacao !== 'oportunidade' && n.classificacao !== 'observacao'
  )

  const equipeAuditora = pessoas.filter((p) =>
    ['auditor_lider', 'auditor', 'auditor_em_treinamento', 'observador'].includes(p.papel)
  )
  const auditados = pessoas.filter(
    (p) => !['auditor_lider', 'auditor', 'auditor_em_treinamento', 'observador'].includes(p.papel)
  )

  const tituloDoRelatorio = (
    MODALIDADES[inspecao.modalidade || ''] || 'Relatório de auditoria'
  ).toUpperCase()

  const identificacao = [
    inspecao.doc_codigo && 'Documento ' + inspecao.doc_codigo,
    inspecao.doc_revisao && 'Revisão ' + inspecao.doc_revisao,
  ].filter(Boolean)

  return (
    <div className="app rel">
      <div className="nao-imprimir" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={'/auditorias/' + id} className="btn btn-sm">
          Voltar à auditoria
        </Link>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </button>
      </div>

      {erro && <div className="banner bad nao-imprimir">{erro}</div>}

      {inspecao.situacao !== 'concluida' && (
        <div className="banner nao-imprimir">
          Esta auditoria ainda está em andamento. O relatório sai do jeito que está agora — os
          números e as constatações só ficam definitivos quando ela for encerrada.
        </div>
      )}

      {/* 7.5.2 — identificação controlada do próprio relatório. */}
      <div className={identificacao.length ? 'rel-controle' : 'rel-controle falta'}>
        <span>{identificacao.length ? identificacao.join(' · ') : 'Documento sem código e revisão — preencha no plano da auditoria'}</span>
        <span>{empresaNome}</span>
      </div>

      <header className="rel-capa">
        <p className="eyebrow">{tituloDoRelatorio}</p>
        <h1>{[inspecao.norma || inspecao.modelo_nome, empresaNome].filter(Boolean).join(' — ')}</h1>
        <p className="rel-sub">
          {[
            data(inspecao.iniciada_em) && 'Início ' + data(inspecao.iniciada_em),
            inspecao.concluida_em && 'Encerramento ' + data(inspecao.concluida_em),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      {/* 6.2 e 6.3 — o que define a auditoria. */}
      <section>
        <h2>1. Identificação</h2>
        <div className="rel-campos">
          <Campo
            rotulo="Tipo de auditoria"
            valor={MODALIDADES[inspecao.modalidade || ''] || null}
          />
          <Campo rotulo="Objetivo da auditoria" valor={inspecao.objetivo} />
          <Campo rotulo="Escopo" valor={inspecao.escopo} />
          <Campo rotulo="Exclusões do escopo" valor={inspecao.exclusoes} />
          <Campo rotulo="Critérios" valor={inspecao.criterios || inspecao.norma} />
          <Campo rotulo="Auditor líder" valor={inspecao.auditor_lider || inspecao.inspetor_nome} />
          <Campo rotulo="Equipe auditora" valor={inspecao.equipe} />
        </div>
      </section>

      {/* Quem estava na sala. Seis meses depois é a única memória disso. */}
      <section>
        <h2>2. Participantes</h2>
        {pessoas.length === 0 ? (
          <p className="rel-nota falta">
            Ninguém registrado. O relatório da certificadora nomeia cada pessoa e o papel dela —
            sem isso não há a quem perguntar o que foi dito.
          </p>
        ) : (
          <table className="tabela-colab">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Área</th>
                <th>Papel</th>
                <th>Reuniões</th>
              </tr>
            </thead>
            <tbody>
              {[...equipeAuditora, ...auditados].map((p) => (
                <tr key={p.id}>
                  <td className="nome">{p.nome}</td>
                  <td>{p.cargo || '—'}</td>
                  <td>{p.area || '—'}</td>
                  <td>{rotuloDoPapel(p.papel)}</td>
                  <td>
                    {[p.abertura && 'abertura', p.encerramento && 'encerramento']
                      .filter(Boolean)
                      .join(' e ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 6.3 — o plano, do jeito que o auditado recebeu. */}
      <section>
        <h2>3. Agenda cumprida</h2>
        {agenda.length === 0 ? (
          inspecao.plano_agenda ? (
            <div className="rel-valor">{inspecao.plano_agenda}</div>
          ) : (
            <p className="rel-nota falta">
              Sem agenda registrada. É ela que prova quais processos foram efetivamente visitados.
            </p>
          )
        ) : (
          <table className="tabela-colab">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Horário</th>
                <th>Processo / Área</th>
                <th>Auditor</th>
                <th>Participantes</th>
                <th>Requisitos</th>
              </tr>
            </thead>
            <tbody>
              {agenda.map((l) => (
                <tr key={l.id}>
                  <td>{data(l.dia) || '—'}</td>
                  <td>{l.horario || '—'}</td>
                  <td className="nome">{l.area || '—'}</td>
                  <td>{l.auditor || '—'}</td>
                  <td>{l.participantes || '—'}</td>
                  <td className="rel-req">{l.requisitos || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 6.4.3 e 6.4.10 — as duas reuniões. */}
      <section>
        <h2>4. Reuniões</h2>
        <div className="rel-campos">
          <Campo
            rotulo="Reunião de abertura"
            valor={
              dataHora(inspecao.abertura_em) &&
              [dataHora(inspecao.abertura_em), inspecao.abertura_participantes]
                .filter(Boolean)
                .join(' · ')
            }
          />
          <Campo
            rotulo="Reunião de encerramento"
            valor={
              dataHora(inspecao.encerramento_em) &&
              [dataHora(inspecao.encerramento_em), inspecao.encerramento_participantes]
                .filter(Boolean)
                .join(' · ')
            }
          />
        </div>
      </section>

      {/* O que ficou da vez passada. Sem isso a mesma falha volta todo ano. */}
      <section>
        <h2>5. Verificação da auditoria anterior</h2>
        {anterior && (
          <p className="rel-nota">
            Referência:{' '}
            {[anterior.norma || anterior.modelo_nome, data(anterior.concluida_em)]
              .filter(Boolean)
              .join(' — ')}
            .
          </p>
        )}
        <Bloco
          valor={inspecao.anterior_verificacao}
          vazio={
            'Não registrado. A certificadora começa por aqui: o que foi feito das constatações da ' +
            'auditoria anterior e se a ação foi eficaz. Quando esta é a primeira auditoria, ' +
            'registre isso — a lacuna em branco parece esquecimento.'
          }
        />
      </section>

      <section>
        <h2>6. Resultado</h2>
        <div className="stats">
          <div className="stat">
            <span className="n">{inspecao.percentual === null ? '—' : inspecao.percentual + '%'}</span>
            <span className="r">conformidade</span>
          </div>
          <div className="stat">
            <span className="n">{inspecao.conformes}</span>
            <span className="r">atende</span>
          </div>
          <div className="stat">
            <span className="n">{inspecao.parciais}</span>
            <span className="r">atende em parte</span>
          </div>
          <div className="stat">
            <span className="n">{inspecao.nao_conformes}</span>
            <span className="r">não atende</span>
          </div>
          <div className="stat">
            <span className="n">{inspecao.nao_aplicaveis}</span>
            <span className="r">não aplicável</span>
          </div>
        </div>
        <p className="rel-nota">
          O percentual conta o &quot;atende em parte&quot; como meio ponto e deixa de fora o que não
          se aplica. {inspecao.itens_total} requisitos avaliados.
        </p>
      </section>

      {/* 6.4.8 — constatações, com a evidência que as sustenta. */}
      <section>
        <h2>7. Constatações</h2>
        {ncs.length === 0 ? (
          <p className="rel-nota">
            Nenhuma constatação registrada
            {inspecao.situacao === 'concluida' ? '.' : ' até agora.'}
          </p>
        ) : (
          <>
            <p className="rel-nota">
              {maiores.length} não conformidade{maiores.length === 1 ? '' : 's'} maior
              {maiores.length === 1 ? '' : 'es'} · {menores.length} menor
              {menores.length === 1 ? '' : 'es'} · {observacoes.length} observa
              {observacoes.length === 1 ? 'ção' : 'ções'} · {oportunidades.length} oportunidade
              {oportunidades.length === 1 ? '' : 's'} de melhoria
              {semClasse.length > 0 && ` · ${semClasse.length} sem classificação`} · {abertas} em
              aberto
            </p>

            {naoConformidades.length > 0 && (
              <table className="tabela-colab">
                <thead>
                  <tr>
                    <th>Constatação</th>
                    <th>Classificação</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {naoConformidades.map((n) => (
                    <tr key={n.id}>
                      <td className="nome">
                        {n.descricao}
                        {n.causa && (
                          <div className="rel-mini">
                            <strong>Causa:</strong> {n.causa}
                          </div>
                        )}
                        {n.acao_corretiva && (
                          <div className="rel-mini">
                            <strong>Ação corretiva:</strong> {n.acao_corretiva}
                          </div>
                        )}
                      </td>
                      <td>
                        {n.classificacao === 'maior' && <span className="pill bad">Maior</span>}
                        {n.classificacao === 'menor' && <span className="pill warn">Menor</span>}
                        {!n.classificacao && '—'}
                      </td>
                      <td>{n.responsavel_nome || '—'}</td>
                      <td>{data(n.prazo) || '—'}</td>
                      <td>
                        {n.situacao === 'encerrada' ? (
                          <span className="pill good">
                            Encerrada{n.eficaz === false ? ' (não eficaz)' : ''}
                          </span>
                        ) : n.situacao === 'cancelada' ? (
                          <span className="pill flat">Cancelada</span>
                        ) : (
                          <span className="pill warn">Em aberto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {observacoes.length > 0 && (
              <>
                <h3 className="rel-sub-h">Observações</h3>
                <p className="rel-nota">
                  Desvios que ainda não configuram não conformidade. Não exigem ação corretiva
                  formal, mas viram não conformidade se repetirem.
                </p>
                <ul className="rel-lista">
                  {observacoes.map((n) => (
                    <li key={n.id}>{n.descricao}</li>
                  ))}
                </ul>
              </>
            )}

            {oportunidades.length > 0 && (
              <>
                <h3 className="rel-sub-h">Oportunidades de melhoria</h3>
                <p className="rel-nota">
                  Nada aqui está em desacordo com a norma. São caminhos para o sistema ficar melhor
                  — tratá-los como defeito é desperdiçar o tempo de quem já está em dia.
                </p>
                <ul className="rel-lista">
                  {oportunidades.map((n) => (
                    <li key={n.id}>{n.descricao}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {/* O que está bem precisa aparecer, ou o relatório não é lido. */}
      <section>
        <h2>8. Pontos fortes</h2>
        <Bloco
          valor={inspecao.pontos_fortes}
          vazio={
            'Não registrado. Relatório que só lista defeito é lido como perseguição e some na ' +
            'gaveta; o que está bem é o que faz a empresa continuar investindo no sistema.'
          }
        />
      </section>

      {/* 6.4.9 — a conclusão é do auditor líder, e é o que o cliente lê
          primeiro. */}
      <section>
        <h2>9. Conclusões</h2>
        <Bloco
          valor={inspecao.conclusao}
          vazio={
            'Não registrado. A conclusão do auditor líder é o que diz se o sistema atende, atende ' +
            'com ressalvas ou não atende — sem ela o relatório é uma lista de achados.'
          }
        />
      </section>

      <section>
        <h2>10. Recomendações</h2>
        <Bloco
          valor={inspecao.recomendacoes}
          vazio={
            'Nenhuma recomendação registrada. Recomendação não obriga como uma constatação: ' +
            'orienta. É onde cabe o conselho que não vira ação corretiva.'
          }
        />
      </section>

      <section>
        <h2>11. Requisito a requisito</h2>
        <table className="tabela-colab rel-itens">
          <thead>
            <tr>
              <th>Req.</th>
              <th>Requisito avaliado</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {respostas.map((r) => (
              <tr key={r.id}>
                <td className="rel-req">{requisitoDe(r)}</td>
                <td className="nome">
                  {r.pergunta}
                  {r.observacao && <div className="rel-mini">{r.observacao}</div>}
                </td>
                <td>
                  {r.resposta === 'conforme' && <span className="pill good">Atende</span>}
                  {r.resposta === 'atende_parcial' && <span className="pill warn">Em parte</span>}
                  {r.resposta === 'nao_conforme' && <span className="pill bad">Não atende</span>}
                  {r.resposta === 'nao_aplicavel' && <span className="pill flat">N/A</span>}
                  {!r.resposta && <span className="pill flat">Sem resposta</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* A ressalva que todo relatório sério traz: o que a ausência de
          constatação significa, e o que ela não significa. */}
      <section>
        <h2>12. Ressalva de amostragem</h2>
        <Bloco
          valor={inspecao.amostragem}
          vazio={
            'Não registrado. Sem esta ressalva, o relatório dá a entender que tudo o que não foi ' +
            'apontado está garantido — e nenhuma auditoria examina tudo.'
          }
        />
      </section>

      {/* 6.5.2 — distribuição. */}
      <section>
        <h2>13. Distribuição</h2>
        {envios.length === 0 ? (
          <p className="rel-nota falta">
            Ainda não registrado. A norma pede o registro de para quem o relatório foi distribuído.
          </p>
        ) : (
          <table className="tabela-colab">
            <tbody>
              {envios.map((e) => (
                <tr key={e.id}>
                  <td className="nome">{e.destinatarios}</td>
                  <td>{e.assunto || '—'}</td>
                  <td>{dataHora(e.enviado_em)}</td>
                  <td>{e.enviado_por_nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {interno && (
          <div className="rel-envio nao-imprimir">
            <p className="rel-nota">
              Registre aqui a quem você entregou o relatório. O envio em si continua sendo feito por
              você, pelo seu e-mail — isto é o registro, que é o que a norma cobra.
            </p>
            <div className="filters">
              <input
                type="text"
                value={envio.destinatarios}
                placeholder="Para quem (nomes ou e-mails, separados por vírgula)"
                onChange={(e) => setEnvio({ ...envio, destinatarios: e.target.value })}
                style={{ minWidth: 280, flex: 1 }}
              />
              <input
                type="text"
                value={envio.assunto}
                placeholder="Assunto ou observação"
                onChange={(e) => setEnvio({ ...envio, assunto: e.target.value })}
                style={{ minWidth: 200 }}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={registrando}
                onClick={registrarEnvio}
              >
                {registrando ? 'Registrando…' : 'Registrar entrega'}
              </button>
            </div>
          </div>
        )}
      </section>

      <footer className="rel-rodape">
        <p className={inspecao.confidencialidade ? '' : 'falta'}>
          {inspecao.confidencialidade ||
            'Confidencialidade não registrada — preencha no plano da auditoria.'}
        </p>
        <p>
          {identificacao.length > 0 && identificacao.join(' · ') + '. '}
          Relatório gerado pelo portal da Real Life SSMA em{' '}
          {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
          Estrutura conforme ABNT NBR ISO 19011:2018, seção 6.5.
        </p>
        <p className="nao-imprimir">
          Para numerar as páginas no PDF, marque &quot;Cabeçalhos e rodapés&quot; na janela de
          impressão do navegador — a numeração é ele quem coloca.
        </p>
      </footer>
    </div>
  )
}

export default function RelatorioDaAuditoria() {
  return (
    <ComModulo modulo="auditoria">
      <RelatorioConteudo />
    </ComModulo>
  )
}
