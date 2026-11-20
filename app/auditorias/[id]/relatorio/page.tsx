'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../../colaboradores/colaboradores.css'
import '../../../inspecoes/inspecoes.css'
import './relatorio.css'

/*
 * Relatório da auditoria — ABNT NBR ISO 19011:2018, 6.5.
 *
 * A norma não pede "um resumo": pede um relatório que identifique a
 * auditoria, diga contra o que ela foi feita, o que foi constatado e a
 * que conclusão o auditor líder chegou. E pede o registro de para quem
 * ele foi distribuído (6.5.2), porque "eu mandei" sem data e
 * destinatário não vale nada seis meses depois.
 *
 * O QUE FALTA FICA VISÍVEL. Campo não preenchido aparece como "não
 * registrado", e não some do relatório. Esconder o que falta é o jeito
 * mais rápido de entregar um documento bonito e inútil: na certificação
 * o auditor externo pergunta justamente pelo que não está lá.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

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

function RelatorioConteudo() {
  const { id } = useParams<{ id: string }>()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [inspecao, setInspecao] = useState<Inspecao | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [ncs, setNcs] = useState<NC[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])

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
            'conclusao, relatorio_em'
        )
        .eq('id', id)
        .single()

      if (error) throw error
      setInspecao(i as unknown as Inspecao)

      const [{ data: emp }, { data: rs }, { data: ns }, { data: es }] = await Promise.all([
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
      ])

      setEmpresaNome(((emp as any)?.nome_fantasia || (emp as any)?.razao_social || '') as string)
      setRespostas((rs || []) as unknown as Resposta[])
      setNcs((ns || []) as unknown as NC[])
      setEnvios((es || []) as unknown as Envio[])
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

  const maiores = ncs.filter((n) => n.classificacao === 'maior' && n.situacao !== 'cancelada')
  const menores = ncs.filter((n) => n.classificacao === 'menor' && n.situacao !== 'cancelada')
  const semClasse = ncs.filter((n) => !n.classificacao && n.situacao !== 'cancelada')
  const abertas = ncs.filter((n) => !['encerrada', 'cancelada'].includes(n.situacao)).length

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

      <header className="rel-capa">
        <p className="eyebrow">RELATÓRIO DE AUDITORIA INTERNA</p>
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
          <Campo rotulo="Objetivo da auditoria" valor={inspecao.objetivo} />
          <Campo rotulo="Escopo" valor={inspecao.escopo} />
          <Campo rotulo="Critérios" valor={inspecao.criterios || inspecao.norma} />
          <Campo rotulo="Auditor líder" valor={inspecao.auditor_lider || inspecao.inspetor_nome} />
          <Campo rotulo="Equipe auditora" valor={inspecao.equipe} />
          <Campo rotulo="Plano e agenda" valor={inspecao.plano_agenda} />
        </div>
      </section>

      {/* 6.4.3 e 6.4.10 — as duas reuniões. */}
      <section>
        <h2>2. Reuniões</h2>
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

      <section>
        <h2>3. Resultado</h2>
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
        <h2>4. Constatações</h2>
        {ncs.length === 0 ? (
          <p className="rel-nota">
            Nenhuma constatação registrada
            {inspecao.situacao === 'concluida' ? '.' : ' até agora.'}
          </p>
        ) : (
          <>
            <p className="rel-nota">
              {maiores.length} maior{maiores.length === 1 ? '' : 'es'} · {menores.length} menor
              {menores.length === 1 ? '' : 'es'}
              {semClasse.length > 0 && ` · ${semClasse.length} sem classificação`} · {abertas} em
              aberto
            </p>
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
                {ncs.map((n) => (
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
                      {n.classificacao === 'observacao' && <span className="pill flat">Observação</span>}
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
          </>
        )}
      </section>

      {/* 6.4.9 — a conclusão é do auditor líder, e é o que o cliente lê
          primeiro. */}
      <section>
        <h2>5. Conclusões</h2>
        <div className={inspecao.conclusao ? 'rel-conclusao' : 'rel-conclusao falta'}>
          {inspecao.conclusao ||
            'Não registrado. A conclusão do auditor líder é o que diz se o sistema atende, atende com ressalvas ou não atende — sem ela o relatório é uma lista de achados.'}
        </div>
      </section>

      <section>
        <h2>6. Requisito a requisito</h2>
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

      {/* 6.5.2 — distribuição. */}
      <section>
        <h2>7. Distribuição</h2>
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
        Relatório gerado pelo portal da Real Life SSMA em{' '}
        {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Estrutura
        conforme ABNT NBR ISO 19011:2018, seção 6.5.
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
