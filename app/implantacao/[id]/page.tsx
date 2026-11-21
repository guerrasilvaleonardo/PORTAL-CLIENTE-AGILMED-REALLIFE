'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../colaboradores/colaboradores.css'
import '../../inspecoes/inspecoes.css'
import '../implantacao.css'

/*
 * A trilha de implantação: cronograma à esquerda, atividade à direita.
 *
 * POR QUE O CRONOGRAMA FICA SEMPRE NA TELA. É ele que responde a
 * pergunta que a empresa faz toda semana: "onde a gente parou?". Numa
 * lista que rola, essa resposta exige procurar. Numa coluna fixa, ela
 * está sempre visível — e o cadeado nas etapas de baixo diz, sem
 * texto, que existe uma ordem.
 *
 * POR QUE A ETAPA SEGUINTE FICA TRAVADA. Quem implanta fora de ordem
 * escreve a política da qualidade antes de saber o escopo, e refaz. A
 * trava é a consultoria embutida no produto — e é o que o concorrente
 * faz também.
 *
 * POR QUE ENVIAR NÃO É CONCLUIR. A atividade enviada fica amarela até
 * alguém da Real Life aprovar. Se o próprio cliente pudesse dar por
 * encerrado, a trilha viraria uma lista de caixinhas marcadas e o
 * documento sairia errado do mesmo jeito — que é exatamente o que ele
 * contratou alguém para evitar.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Etapa = {
  etapa_id: string
  ordem: number
  nome: string
  resumo: string | null
  requisitos: string | null
  livre: boolean
  atividades: number
  aprovadas: number
  aguardando: number
  devolvidas: number
  fechada: boolean
  liberada: boolean
}

type Atividade = {
  id: string
  etapa_id: string
  ordem: number
  titulo: string
  tipo: string
  aula: string | null
  passos: string[]
  requisito: string | null
  modelo_arquivo: string | null
  modelo_rotulo: string | null
  video_url: string | null
  upload_obrigatorio: boolean
  aprovacao_obrigatoria: boolean
}

type Progresso = {
  id: string
  atividade_id: string
  situacao: string
  anexos: string[]
  comentario: string | null
  enviado_em: string | null
  enviado_por_nome: string | null
  aprovado_em: string | null
  aprovado_por_nome: string | null
  devolvido_motivo: string | null
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null

function TrilhaConteudo() {
  const { id } = useParams<{ id: string }>()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [implantacao, setImplantacao] = useState<any>(null)
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [progresso, setProgresso] = useState<Record<string, Progresso>>({})
  const [interno, setInterno] = useState(false)

  const [etapaAberta, setEtapaAberta] = useState<string>('')
  const [atividadeAberta, setAtividadeAberta] = useState<string>('')
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [recolhido, setRecolhido] = useState(false)

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
        .select('perfil')
        .eq('id', user.id)
        .single()
      setInterno(PERFIS_INTERNOS.includes(perfil?.perfil || ''))

      const { data: imp, error } = await supabase
        .from('implantacoes')
        .select('id, empresa_id, modelo_id, modelo_nome, situacao, consultor_nome, interlocutor_nome, iniciada_em')
        .eq('id', id)
        .single()
      if (error) throw error
      setImplantacao(imp)

      const [{ data: es }, { data: ats }, { data: ps }] = await Promise.all([
        supabase
          .from('implantacao_etapas_estado')
          .select('*')
          .eq('implantacao_id', id)
          .order('ordem'),
        supabase
          .from('implantacao_atividades')
          .select(
            'id, etapa_id, ordem, titulo, tipo, aula, passos, requisito, ' +
              'modelo_arquivo, modelo_rotulo, video_url, upload_obrigatorio, aprovacao_obrigatoria'
          )
          .order('ordem'),
        supabase
          .from('implantacao_progresso')
          .select(
            'id, atividade_id, situacao, anexos, comentario, enviado_em, enviado_por_nome, ' +
              'aprovado_em, aprovado_por_nome, devolvido_motivo'
          )
          .eq('implantacao_id', id),
      ])

      const listaE = (es || []) as unknown as Etapa[]
      setEtapas(listaE)
      setAtividades((ats || []) as unknown as Atividade[])

      const mapa: Record<string, Progresso> = {}
      ;(ps || []).forEach((p: any) => {
        mapa[p.atividade_id] = p as Progresso
      })
      setProgresso(mapa)

      /* Abre sozinho na primeira etapa que ainda não fechou: é onde a
       * pessoa parou, e é o que ela quer ver ao entrar. */
      setEtapaAberta((atual) => {
        if (atual) return atual
        const pendente = listaE.find((e) => e.liberada && !e.fechada)
        return (pendente || listaE[0])?.etapa_id || ''
      })
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível abrir a trilha.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const etapa = etapas.find((e) => e.etapa_id === etapaAberta) || null
  const daEtapa = useMemo(
    () => atividades.filter((a) => a.etapa_id === etapaAberta),
    [atividades, etapaAberta]
  )
  const atividade = daEtapa.find((a) => a.id === atividadeAberta) || daEtapa[0] || null
  const meu = atividade ? progresso[atividade.id] : undefined

  useEffect(() => {
    setRascunho(meu?.comentario || '')
  }, [meu?.id, meu?.comentario])

  const totalAtiv = etapas.reduce((s, e) => s + e.atividades, 0)
  const totalOk = etapas.reduce((s, e) => s + e.aprovadas, 0)
  const pctGeral = totalAtiv ? Math.round((totalOk / totalAtiv) * 100) : 0

  async function gravar(situacao: string, extra: Record<string, any> = {}) {
    if (!atividade) return
    setErro('')
    const corpo = {
      implantacao_id: id,
      atividade_id: atividade.id,
      situacao,
      comentario: rascunho || null,
      ...extra,
    }
    const { error } = await supabase
      .from('implantacao_progresso')
      .upsert(corpo, { onConflict: 'implantacao_id,atividade_id' })
    if (error) {
      setErro(error.message)
      return false
    }
    await carregar()
    return true
  }

  async function salvarRascunho() {
    if (salvando) return
    setSalvando(true)
    await gravar(meu?.situacao === 'aprovado' ? 'aprovado' : 'pendente')
    setSalvando(false)
  }

  async function enviar() {
    if (enviando || !atividade) return
    if (atividade.upload_obrigatorio && !(meu?.anexos || []).length) {
      setErro('Esta atividade pede o arquivo preenchido. Envie o documento antes de concluir.')
      return
    }
    setEnviando(true)
    await gravar('enviado')
    setEnviando(false)
  }

  async function subirArquivo(arquivo: File) {
    if (!atividade) return
    setErro('')
    const caminho = `${id}/${atividade.id}/${Date.now()}-${arquivo.name}`
    const { error } = await supabase.storage
      .from('implantacao-entregas')
      .upload(caminho, arquivo, { upsert: false })
    if (error) {
      setErro(error.message)
      return
    }
    const atuais = meu?.anexos || []
    await gravar(meu?.situacao === 'aprovado' ? 'aprovado' : 'pendente', {
      anexos: [...atuais, caminho],
    })
  }

  async function abrirAnexo(caminho: string) {
    const { data, error } = await supabase.storage
      .from('implantacao-entregas')
      .createSignedUrl(caminho, 60)
    if (error || !data) {
      setErro(error?.message || 'Não consegui abrir o arquivo.')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function baixarModelo(nome: string) {
    const { data, error } = await supabase.storage
      .from('implantacao-modelos')
      .createSignedUrl(nome, 60)
    if (error || !data) {
      setErro('O modelo ainda não foi publicado. Avise a nossa equipe.')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Abrindo a trilha…</p>
      </div>
    )
  }

  if (!implantacao) {
    return (
      <div className="app">
        <div className="banner bad">{erro || 'Implantação não encontrada.'}</div>
      </div>
    )
  }

  const situacaoDa = (a: Atividade) => progresso[a.id]?.situacao || 'pendente'

  return (
    <div className="app impl">
      <div className="impl-topo">
        <div>
          <p className="eyebrow">IMPLANTAÇÃO</p>
          <h1>{implantacao.modelo_nome || 'Sistema de gestão'}</h1>
        </div>
        <Link href="/implantacao" className="btn btn-sm">
          Todas as implantações
        </Link>
      </div>

      <div className="impl-barra" aria-hidden>
        <div style={{ width: pctGeral + '%' }} />
      </div>
      <p className="impl-pct">
        {pctGeral}% concluído · {totalOk} de {totalAtiv} atividades aprovadas
      </p>

      {erro && <div className="banner bad">{erro}</div>}

      <div className={'impl-grade' + (recolhido ? ' recolhida' : '')}>
        {/* ---------- Cronograma ---------- */}
        <aside className="impl-cronograma">
          <div className="impl-cronograma-topo">
            <span>CRONOGRAMA</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setRecolhido((v) => !v)}
              aria-label={recolhido ? 'Abrir o cronograma' : 'Recolher o cronograma'}
            >
              {recolhido ? '›' : '‹'}
            </button>
          </div>

          <ul>
            {etapas.map((e) => {
              const estado = !e.liberada
                ? 'travada'
                : e.fechada
                  ? 'fechada'
                  : e.aguardando > 0
                    ? 'aguardando'
                    : 'andando'
              return (
                <li key={e.etapa_id}>
                  <button
                    type="button"
                    className={
                      'impl-etapa ' + estado + (e.etapa_id === etapaAberta ? ' aberta' : '')
                    }
                    onClick={() => {
                      setEtapaAberta(e.etapa_id)
                      setAtividadeAberta('')
                    }}
                  >
                    <span className="nome">{e.nome}</span>
                    <span className="sinal">
                      {e.devolvidas > 0 && <span className="bolha">{e.devolvidas}</span>}
                      {estado === 'travada' && '🔒'}
                      {estado === 'fechada' && '✓'}
                      {estado === 'aguardando' && '⏳'}
                      {estado === 'andando' && '▶'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* ---------- A atividade ---------- */}
        <section className="impl-painel">
          {!etapa ? (
            <p className="empty-state">Escolha uma etapa no cronograma.</p>
          ) : !etapa.liberada ? (
            <div className="impl-travada">
              <h2>{etapa.nome}</h2>
              <p>
                Esta etapa abre quando a anterior fechar. Não é burocracia: quem monta o sistema
                fora de ordem escreve a política da qualidade antes de saber o escopo — e refaz
                tudo depois.
              </p>
              {etapa.requisitos && (
                <p className="impl-req">Vai cobrir os requisitos {etapa.requisitos}.</p>
              )}
            </div>
          ) : (
            <>
              <header className="impl-cabecalho">
                <h2>
                  {etapa.ordem}. {etapa.nome}
                </h2>
                {etapa.resumo && <p className="impl-resumo">{etapa.resumo}</p>}
                {etapa.requisitos && (
                  <p className="impl-req">Requisitos da norma: {etapa.requisitos}</p>
                )}
              </header>

              {daEtapa.length === 0 ? (
                <p className="empty-state">
                  As atividades desta etapa ainda estão sendo escritas pela nossa equipe.
                </p>
              ) : (
                <>
                  <nav className="impl-abas">
                    {daEtapa.map((a) => {
                      const s = situacaoDa(a)
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={
                            'impl-aba ' + s + (atividade?.id === a.id ? ' ativa' : '')
                          }
                          onClick={() => setAtividadeAberta(a.id)}
                        >
                          {s === 'aprovado' ? '✓' : s === 'enviado' ? '⏳' : s === 'devolvido' ? '!' : '○'}{' '}
                          {a.titulo}
                        </button>
                      )
                    })}
                  </nav>

                  {atividade && (
                    <article className="impl-atividade">
                      <h3>
                        {atividade.titulo}
                        {atividade.requisito && (
                          <span className="impl-tag">{atividade.requisito}</span>
                        )}
                      </h3>

                      {atividade.aula && <div className="impl-aula">{atividade.aula}</div>}

                      {atividade.passos.length > 0 && (
                        <div className="impl-passos">
                          <h4>
                            {atividade.tipo === 'feedback'
                              ? 'O que fazer'
                              : atividade.tipo === 'revisao'
                                ? 'A conferência'
                                : 'Atividade'}
                          </h4>
                          <ol>
                            {atividade.passos.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {atividade.modelo_arquivo && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => baixarModelo(atividade.modelo_arquivo as string)}
                        >
                          Baixar {atividade.modelo_rotulo || 'o modelo'}
                        </button>
                      )}

                      {atividade.video_url && (
                        <div className="impl-video">
                          <a href={atividade.video_url} target="_blank" rel="noreferrer">
                            Assistir ao vídeo desta atividade
                          </a>
                        </div>
                      )}

                      {/* ---- O que a empresa entrega ---- */}
                      <div className="impl-entrega">
                        <h4>Sua entrega</h4>

                        {meu?.situacao === 'devolvido' && (
                          <div className="banner bad">
                            Devolvido pela nossa equipe
                            {meu.devolvido_motivo ? ': ' + meu.devolvido_motivo : '.'}
                          </div>
                        )}
                        {meu?.situacao === 'enviado' && (
                          <div className="banner">
                            Enviado em {dataHora(meu.enviado_em)}
                            {meu.enviado_por_nome ? ' por ' + meu.enviado_por_nome : ''}. Aguardando
                            a conferência da Real Life.
                          </div>
                        )}
                        {meu?.situacao === 'aprovado' && (
                          <div className="banner good">
                            Aprovado em {dataHora(meu.aprovado_em)}
                            {meu.aprovado_por_nome ? ' por ' + meu.aprovado_por_nome : ''}.
                          </div>
                        )}

                        {(meu?.anexos || []).length > 0 && (
                          <ul className="impl-anexos">
                            {(meu?.anexos || []).map((caminho) => (
                              <li key={caminho}>
                                <button type="button" onClick={() => abrirAnexo(caminho)}>
                                  {caminho.split('/').pop()}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <label className="impl-upload">
                          {atividade.upload_obrigatorio
                            ? 'Envie o arquivo preenchido (obrigatório)'
                            : 'Envie um arquivo, se houver'}
                          <input
                            type="file"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) subirArquivo(f)
                              e.target.value = ''
                            }}
                          />
                        </label>

                        <label>
                          Comentário
                          <textarea
                            value={rascunho}
                            onChange={(e) => setRascunho(e.target.value)}
                            placeholder="O que você quer registrar ou perguntar sobre esta atividade"
                          />
                        </label>

                        <div className="impl-acoes">
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={salvando}
                            onClick={salvarRascunho}
                          >
                            {salvando ? 'Salvando…' : 'Salvar'}
                          </button>

                          {meu?.situacao !== 'aprovado' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={enviando}
                              onClick={enviar}
                            >
                              {enviando ? 'Enviando…' : 'Concluir e enviar para conferência'}
                            </button>
                          )}

                          {/* A aprovação é nossa. O banco recusa se não for. */}
                          {interno && meu?.situacao === 'enviado' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => gravar('aprovado')}
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => {
                                  const motivo = window.prompt('Por que está devolvendo?')
                                  if (motivo) gravar('devolvido', { devolvido_motivo: motivo })
                                }}
                              >
                                Devolver
                              </button>
                            </>
                          )}
                        </div>

                        <p className="impl-nota">
                          Enviar não é concluir: a atividade só fecha quando a nossa equipe
                          confere. É essa conferência que você contratou.
                        </p>
                      </div>
                    </article>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default function TrilhaDeImplantacao() {
  return (
    <ComModulo modulo="implantacao">
      <TrilhaConteudo />
    </ComModulo>
  )
}
