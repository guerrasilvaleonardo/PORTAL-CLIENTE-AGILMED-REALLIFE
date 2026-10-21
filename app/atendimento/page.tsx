'use client'

import { DragEvent, useEffect, useMemo, useState } from 'react'
import SuspenderChamado from '@/components/SuspenderChamado'
import CancelarChamado from '@/components/CancelarChamado'
import { carregarSuspensos, dataDoBanco } from '@/lib/suspensao'
import { casaBusca, padraoSemAcento, palavrasDaBusca } from '@/lib/busca'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { carregarFeriados } from '@/lib/feriados'
import { avisar } from '@/lib/avisar'
import { ALERTA_ATRASO_HORAS, prestesAAtrasar, situacaoSla } from '@/lib/prazo'
import { carregarAlertaPrazoHoras } from '@/lib/estrelas'
import { AjudaSituacoes, EXPLICACAO_EQUIPE } from '@/lib/situacoes'
import './quadro.css'
import SeloMensagemNova from '@/components/SeloMensagemNova'
import { useChamadosNaoLidos } from '@/lib/chamadosNaoLidos'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const COLUNAS = [
  { id: 'aberto', rotulo: 'Aberto' },
  { id: 'em_atendimento', rotulo: 'Em andamento' },
  { id: 'aguardando_cliente', rotulo: 'Aguardando cliente' },
  { id: 'suspenso', rotulo: 'Atendimento suspenso' },
  { id: 'resolvido', rotulo: 'Resolvido' },
  { id: 'encerrado', rotulo: 'Encerrado' },
  { id: 'cancelado', rotulo: 'Cancelado' },
]

const EM_ABERTO = ['aberto', 'em_atendimento', 'aguardando_cliente', 'suspenso']

type Chamado = {
  id: string
  numero: number
  empresa_id: string
  categoria: string
  assunto: string
  descricao?: string | null
  prioridade: string
  status: string
  created_at: string
  prazo_sla: string | null
  sla_pausado_em: string | null
  suspenso_em?: string | null
  suspensao_motivo?: string | null
  suspensao_proxima?: string | null
  resolvido_em: string | null
  encerrado_em: string | null
  responsavel_id: string | null
  empresas?: { nome_fantasia: string | null; razao_social: string; marca: string | null } | null
  responsavel?: { nome: string | null } | null
}

function iniciais(nome?: string | null) {
  if (!nome) return '--'

  const p = nome.trim().split(/\s+/)

  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/*
 * O prazo conta apenas horas úteis: 8 por dia, de segunda a sexta.
 * O relógio para quando o chamado é resolvido e fica pausado enquanto
 * aguarda o cliente (ver situacaoSla em lib/prazo).
 */

export default function AtendimentoPage() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [progresso, setProgresso] = useState<
    Map<string, { total: number; concluidas: number; percentual: number }>
  >(new Map())
  const [carregando, setCarregando] = useState(true)
  /* Chamados meus (responsável, abri ou solicitei) com mensagem nova. */
  const mensagensNovas = useChamadosNaoLidos(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [alertaHoras, setAlertaHoras] = useState(ALERTA_ATRASO_HORAS)

  useEffect(() => {
    carregarAlertaPrazoHoras().then(setAlertaHoras)
  }, [])
  const [tv, setTv] = useState(false)
  /* Chamado arrastado para "Atendimento suspenso", aguardando os dados. */
  const [suspendendo, setSuspendendo] = useState<Chamado | null>(null)
  /* Chamado arrastado para "Cancelado" (só gestor/admin). */
  const [cancelando, setCancelando] = useState<Chamado | null>(null)
  const [ehGestor, setEhGestor] = useState(false)

  const [busca, setBusca] = useState('')
  /* Chamados cuja conversa contém a busca: id -> trecho da mensagem. */
  const [achadosConversa, setAchadosConversa] = useState<Record<string, string>>({})
  const palavras = useMemo(() => palavrasDaBusca(busca), [busca])

  /*
   * A busca também olha as mensagens (o cliente às vezes escreve o nome
   * só na conversa). Espera a pessoa parar de digitar e consulta pela
   * palavra mais longa; o filtro fino (todas as palavras, sem acento) é
   * feito aqui.
   */
  useEffect(() => {
    /* As palavras com mais letras "fixas" (sem vogal/ç) filtram melhor no banco. */
    const fixas = (p: string) => p.replace(/[aeiouc]/g, '').length
    const chaves = [...palavras]
      .filter((p) => p.length >= 3)
      .sort((a, b) => fixas(b) - fixas(a) || b.length - a.length)
      .slice(0, 2)
    const chave = chaves[0]

    if (!chave) {
      setAchadosConversa({})
      return
    }

    let vivo = true
    const espera = setTimeout(async () => {
      let consulta = supabase
        .from('chamado_mensagens')
        .select('chamado_id, mensagem')
        .ilike('mensagem', padraoSemAcento(chave))

      if (chaves[1]) consulta = consulta.ilike('mensagem', padraoSemAcento(chaves[1]))

      const { data, error } = await consulta
        .order('created_at', { ascending: false })
        .limit(1000)

      if (!vivo || error) return

      const mapa: Record<string, string> = {}

      for (const m of (data || []) as { chamado_id: string; mensagem: string }[]) {
        if (!mapa[m.chamado_id] && casaBusca(m.mensagem, palavras)) {
          mapa[m.chamado_id] = m.mensagem
        }
      }

      setAchadosConversa(mapa)
    }, 400)

    return () => {
      vivo = false
      clearTimeout(espera)
    }
  }, [palavras])
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')

  const [meuId, setMeuId] = useState('')
  const [agentes, setAgentes] = useState<{ id: string; nome: string }[]>([])

  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      /* Feriados do calendário do SLA (não contam hora útil). */
      await carregarFeriados(supabase)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil')
        .eq('id', user.id)
        .single()

      if (!PERFIS_INTERNOS.includes(perfil?.perfil || '')) {
        window.location.href = '/'
        return
      }

      setEhGestor(['gestor', 'admin'].includes(perfil?.perfil || ''))
      setMeuId(user.id)

      const { data: equipe } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('perfil', PERFIS_INTERNOS)
        .eq('ativo', true)
        .order('nome')

      setAgentes(
        ((equipe || []) as any[]).map((p) => ({
          id: p.id,
          nome: p.nome || 'Sem nome',
        }))
      )

      const { data, error } = await supabase
        .from('chamados')
        .select(
          'id, numero, empresa_id, categoria, assunto, descricao, prioridade, status, created_at, prazo_sla, sla_pausado_em, resolvido_em, encerrado_em, responsavel_id, empresas(nome_fantasia, razao_social, marca), responsavel:profiles!chamados_responsavel_id_fkey(nome)'
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      /*
       * % de etapas concluídas. Consulta à parte e tolerante a erro:
       * se a view ainda não existir, o quadro carrega normalmente.
       */
      const { data: progressoData } = await supabase
        .from('v_chamados_progresso')
        .select('chamado_id, total, concluidas, percentual')

      setProgresso(
        new Map(
          ((progressoData || []) as any[]).map((p) => [String(p.chamado_id), p])
        )
      )

      /* Motivo e próxima atualização dos suspensos (consulta tolerante). */
      const suspensos = await carregarSuspensos()

      setChamados(
        (data || []).map((item: any) => ({
          ...item,
          ...(suspensos[item.id] || {}),
          empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas,
          responsavel: Array.isArray(item.responsavel) ? item.responsavel[0] : item.responsavel,
        }))
      )
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os chamados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    /*
     * O painel manda para cá com ?responsavel=meus ou o id de alguém,
     * então o atalho do dashboard já cai no quadro filtrado.
     */
    const alvo = new URLSearchParams(window.location.search).get(
      'responsavel'
    )

    if (alvo) {
      setFiltroResponsavel(alvo)
    }

    carregar()
  }, [])

  /* Modo TV recarrega sozinho: fica num telão, ninguém vai apertar F5. */
  useEffect(() => {
    if (!tv) return

    const id = window.setInterval(carregar, 60000)

    return () => window.clearInterval(id)
  }, [tv])

  const empresas = useMemo(() => {
    const mapa = new Map<string, string>()

    for (const c of chamados) {
      if (c.empresa_id && !mapa.has(c.empresa_id)) {
        mapa.set(c.empresa_id, c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa')
      }
    }

    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [chamados])

  /* Onde a busca encontrou o chamado, quando não foi no título. */
  const ondeAchou = useMemo(() => {
    const mapa: Record<string, string> = {}

    if (!palavras.length) return mapa

    for (const c of chamados) {
      const noTitulo = casaBusca(
        [c.numero, c.assunto, c.categoria, c.empresas?.nome_fantasia, c.empresas?.razao_social].join(' '),
        palavras
      )

      if (noTitulo) continue
      if (casaBusca(c.descricao || '', palavras)) mapa[c.id] = 'na descrição'
      else if (achadosConversa[c.id]) mapa[c.id] = 'na conversa'
    }

    return mapa
  }, [chamados, palavras, achadosConversa])

  const filtrados = useMemo(() => {

    return chamados.filter((c) => {
      if (filtroEmpresa && c.empresa_id !== filtroEmpresa) return false
      if (filtroPrioridade && c.prioridade !== filtroPrioridade) return false

      if (filtroResponsavel === 'meus' && c.responsavel_id !== meuId) return false
      if (filtroResponsavel === 'sem' && c.responsavel_id) return false

      if (
        filtroResponsavel &&
        filtroResponsavel !== 'meus' &&
        filtroResponsavel !== 'sem' &&
        c.responsavel_id !== filtroResponsavel
      ) {
        return false
      }
      if (!palavras.length) return true

      /* Título, número, categoria, empresa, descrição ou conversa. */
      return (
        casaBusca(
          [c.numero, c.assunto, c.categoria, c.empresas?.nome_fantasia, c.empresas?.razao_social, c.descricao].join(' '),
          palavras
        ) || !!achadosConversa[c.id]
      )
    })
  }, [chamados, palavras, achadosConversa, filtroEmpresa, filtroPrioridade, filtroResponsavel, meuId])

  const indicadores = useMemo(() => {
    const abertos = chamados.filter((c) => EM_ABERTO.includes(c.status))

    return {
      total: chamados.length,
      abertos: abertos.length,
      atrasados: abertos.filter((c) => situacaoSla(c).atrasado).length,
      urgentes: abertos.filter((c) => c.prioridade === 'urgente').length,
    }
  }, [chamados])

  async function mover(id: string, novoStatus: string) {
    const atual = chamados.find((c) => c.id === id)

    if (!atual || atual.status === novoStatus) return

    /* Suspender exige motivo, observação e próxima atualização. */
    if (novoStatus === 'suspenso') {
      setSuspendendo(atual)
      return
    }

    /* Cancelar: só gestor/admin, com motivo e observação. */
    if (novoStatus === 'cancelado') {
      if (!ehGestor) {
        setErro('Somente gestor ou administrador pode cancelar um chamado.')
        return
      }
      if (!EM_ABERTO.includes(atual.status)) {
        setErro('Só é possível cancelar chamado em aberto. Resolvido ou encerrado não se cancela.')
        return
      }
      setCancelando(atual)
      return
    }

    /* Desfazer cancelamento: só gestor/admin, de volta para atendimento. */
    if (atual.status === 'cancelado') {
      if (!ehGestor) {
        setErro('Somente gestor ou administrador pode desfazer um cancelamento.')
        return
      }
      if (!['aberto', 'em_atendimento'].includes(novoStatus)) {
        setErro('Para desfazer o cancelamento, arraste para Aberto ou Em andamento.')
        return
      }
      if (!window.confirm('Desfazer o cancelamento do chamado #' + atual.numero + '? O cliente será avisado.')) {
        return
      }
    }

    /* Move na tela primeiro; se o banco recusar, volta. */
    setChamados((lista) =>
      lista.map((c) => (c.id === id ? { ...c, status: novoStatus } : c))
    )
    setAviso('')

    const campos: Record<string, any> = { status: novoStatus }

    if (novoStatus === 'resolvido') campos.resolvido_em = new Date().toISOString()
    if (novoStatus === 'encerrado') campos.encerrado_em = new Date().toISOString()

    const { error } = await supabase.from('chamados').update(campos).eq('id', id)

    if (error) {
      console.error(error)
      setChamados((lista) =>
        lista.map((c) => (c.id === id ? { ...c, status: atual.status } : c))
      )
      setErro(error.message || 'Não foi possível mover o chamado.')
      return
    }

    avisar('status_alterado', id)

    /* Saindo da suspensão o banco estende o prazo: relê o chamado. */
    if (atual.status === 'suspenso') {
      const { data: novo } = await supabase
        .from('chamados')
        .select('prazo_sla, sla_pausado_em')
        .eq('id', id)
        .maybeSingle()

      setChamados((lista) =>
        lista.map((c) =>
          c.id === id
            ? { ...c, ...(novo || {}), suspenso_em: null, suspensao_motivo: null, suspensao_proxima: null }
            : c
        )
      )
    }

    setAviso(
      'Chamado #' +
        atual.numero +
        ' movido para ' +
        (COLUNAS.find((k) => k.id === novoStatus)?.rotulo || novoStatus) +
        '.'
    )
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>, coluna: string) {
    e.preventDefault()
    setSobre(null)

    const id = arrastando || e.dataTransfer.getData('text/plain')

    setArrastando(null)

    if (id) mover(id, coluna)
  }

  return (
    <div className={'app' + (tv ? ' tv' : '')}>
      {suspendendo && (
        <SuspenderChamado
          chamado={suspendendo}
          onFechar={() => setSuspendendo(null)}
          onSuspenso={({ motivo, proxima }) => {
            const alvo = suspendendo
            setSuspendendo(null)
            setChamados((lista) =>
              lista.map((c) =>
                c.id === alvo.id
                  ? {
                      ...c,
                      status: 'suspenso',
                      suspenso_em: new Date().toISOString(),
                      suspensao_motivo: motivo,
                      suspensao_proxima: proxima,
                    }
                  : c
              )
            )
            avisar('status_alterado', alvo.id)
            setAviso('Chamado #' + alvo.numero + ' suspenso. O SLA está pausado.')
          }}
        />
      )}

      {cancelando && (
        <CancelarChamado
          chamado={cancelando}
          onFechar={() => setCancelando(null)}
          onCancelado={() => {
            const alvo = cancelando
            setCancelando(null)
            setChamados((lista) =>
              lista.map((c) => (c.id === alvo.id ? { ...c, status: 'cancelado' } : c))
            )
            avisar('status_alterado', alvo.id)
            setAviso('Chamado #' + alvo.numero + ' cancelado. Ele fica fora do SLA e das estrelas.')
          }}
        />
      )}

      <div className="topbar">
        <div>
          <div className="section-title">Atendimento</div>
          <h1 style={{ fontSize: 26, marginTop: 6 }}>Quadro de chamados</h1>
        </div>

        <div className="topbar-spacer" />

        {!tv && <AjudaSituacoes publico="equipe" rotulo="Legenda das colunas" />}

        {!tv && (
          <Link href="/atendimento/prioridades" className="btn btn-sm">
            Prioridades
          </Link>
        )}

        {!tv && (
          <Link href="/atendimento/agenda" className="btn btn-sm">
            Agenda
          </Link>
        )}

        {!tv && (
          <Link href="/estrelas" className="btn btn-sm">
            ★ Estrelas
          </Link>
        )}

        <button
          type="button"
          className={'btn btn-sm' + (tv ? ' btn-primary' : '')}
          onClick={() => setTv((v) => !v)}
        >
          {tv ? 'Sair do Modo TV' : 'Modo TV'}
        </button>

        <button type="button" className="btn btn-sm" onClick={carregar}>
          Atualizar
        </button>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {aviso && <div className="banner good">{aviso}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : indicadores.abertos}</div>
          <div className="lbl">Em aberto</div>
        </div>

        <div className={'stat' + (indicadores.atrasados > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : indicadores.atrasados}</div>
          <div className="lbl">SLA atrasado</div>
        </div>

        <div className={'stat' + (indicadores.urgentes > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : indicadores.urgentes}</div>
          <div className="lbl">Urgentes</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : indicadores.total}</div>
          <div className="lbl">Total no período</div>
        </div>
      </div>

      <div className="filters">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome, assunto, nº, descrição ou conversa"
          title="Procura no título, número, empresa, descrição e mensagens do chamado. Acentos e ordem das palavras não importam."
        />

        <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>

        <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
          <option value="">Todas as prioridades</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
          <option value="baixa">Baixa</option>
        </select>

        <select
          value={filtroResponsavel}
          onChange={(e) => setFiltroResponsavel(e.target.value)}
        >
          <option value="">Todos os responsáveis</option>
          <option value="meus">Meus atendimentos</option>
          <option value="sem">Sem responsável</option>

          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="board">
        {COLUNAS.map((coluna) => {
          const daColuna = filtrados.filter((c) => c.status === coluna.id)

          return (
            <div
              key={coluna.id}
              className={'col' + (sobre === coluna.id ? ' dragover' : '')}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(coluna.id)
              }}
              onDragLeave={() => setSobre((s) => (s === coluna.id ? null : s))}
              onDrop={(e) => aoSoltar(e, coluna.id)}
            >
              <div
                className="col-head"
                title={EXPLICACAO_EQUIPE[coluna.id] || coluna.rotulo}
              >
                <h3>{coluna.rotulo}</h3>
                <span className="col-count">{daColuna.length}</span>
              </div>

              <div className="col-cards">
                {daColuna.length === 0 ? (
                  <div className="empty-col">vazio</div>
                ) : (
                  daColuna.map((c) => {
                    const prazo = situacaoSla(c)
                    const prog = progresso.get(String(c.id))
                    const atrasado = prazo.atrasado
                    const alerta = !atrasado && prestesAAtrasar(prazo, alertaHoras)

                    return (
                      <Link
                        key={c.id}
                        href={'/atendimento/' + c.id}
                        className={
                          'qcard pri-' +
                          c.prioridade +
                          (atrasado ? ' atrasado' : alerta ? ' alerta' : '')
                        }
                        draggable={!tv}
                        onDragStart={(e) => {
                          setArrastando(c.id)
                          e.dataTransfer.setData('text/plain', c.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setArrastando(null)
                          setSobre(null)
                        }}
                      >
                        <div className="card-top">
                          <span className="card-code">#{c.numero}</span>
                          {atrasado && <span className="badge-atraso">FORA DO PRAZO</span>}
                          {alerta && <span className="badge-alerta">PRÓXIMO DO PRAZO</span>}
                          <SeloMensagemNova quantidade={mensagensNovas[c.id]} />
                        </div>

                        <div className="card-title">{c.assunto}</div>

                        <div className="card-client">
                          {c.empresas?.nome_fantasia || c.empresas?.razao_social || 'Empresa'}
                          {' · '}
                          {c.categoria}
                        </div>

                        {ondeAchou[c.id] && (
                          <div className="card-achado">Encontrado {ondeAchou[c.id]}</div>
                        )}

                        {c.status === 'suspenso' && c.suspensao_motivo && (
                          <div className="card-suspensao">
                            {c.suspensao_motivo}
                            {c.suspensao_proxima &&
                              ' · próx. atualização ' + dataDoBanco(c.suspensao_proxima)}
                          </div>
                        )}

                        {prog && (
                          <div
                            className="card-progresso"
                            title={
                              prog.concluidas +
                              ' de ' +
                              prog.total +
                              ' etapa(s) concluída(s)'
                            }
                          >
                            <div className="barra">
                              <div
                                className={
                                  'preenchido' +
                                  (prog.percentual === 100 ? ' completo' : '')
                                }
                                style={{ width: prog.percentual + '%' }}
                              />
                            </div>
                            <span>{prog.percentual}%</span>
                          </div>
                        )}

                        <div className="card-meta">
                          <span className={'due' + (atrasado ? ' bad' : '')}>
                            {prazo.texto}
                          </span>

                          <span className="avatar" title={c.responsavel?.nome || 'Sem responsável'}>
                            {iniciais(c.responsavel?.nome)}
                          </span>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="footnote">
        Arraste o cartão entre as colunas para mudar o status. Clique para abrir o chamado.
      </div>
    </div>
  )
}
