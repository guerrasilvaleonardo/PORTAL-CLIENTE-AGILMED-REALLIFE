'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { use } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'

/*
 * Aplicar a inspeção (supabase/inspecoes.sql).
 *
 * Uma pergunta por bloco, três respostas e um campo de observação. Grava
 * a cada clique, sem botão de salvar: quem está em campo, no celular,
 * não volta para apertar "salvar".
 *
 * CONCLUIR É O QUE IMPORTA. Ao concluir, o banco conta os totais e abre
 * uma não conformidade para cada item reprovado. Antes disso a inspeção
 * é rascunho.
 */

type Resposta = {
  id: string
  ordem: number
  categoria: string | null
  pergunta: string
  resposta: string | null
  observacao: string | null
  fotos: string[]
  anexos: string[]
  item_id: string | null
  inspecao_modelo_itens?: ItemDoModelo | ItemDoModelo[] | null
}

type ItemDoModelo = {
  explicacao: string | null
  orientacao: string | null
  modelo_arquivo: string | null
  modelo_rotulo: string | null
}

type Alteracao = {
  id: number
  de: string
  para: string
  motivo: string
  por_nome: string | null
  created_at: string
}

type Inspecao = {
  id: string
  empresa_id: string
  tipo: string
  local_id: string | null
  modelo_nome: string
  norma: string | null
  local_nome: string | null
  inspetor_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  observacoes: string | null
  itens_total: number
  conformes: number
  nao_conformes: number
  nao_aplicaveis: number
  percentual: number | null
}

function AplicarInspecaoConteudo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [inspecao, setInspecao] = useState<Inspecao | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [concluindo, setConcluindo] = useState(false)
  /* Links assinados das fotos: o balde é privado. */
  const [links, setLinks] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState('')
  /* Nome original do arquivo enviado, para a tela não mostrar o uuid. */
  const [nomes, setNomes] = useState<Record<string, string>>({})

  /* Reabrir para corrigir, e o histórico de quem reabriu. */
  const [reabrindo, setReabrindo] = useState(false)
  const [motivoReabrir, setMotivoReabrir] = useState('')
  const [alteracoes, setAlteracoes] = useState<Alteracao[]>([])
  const [locais, setLocais] = useState<{ id: string; nome: string }[]>([])
  const [editando, setEditando] = useState(false)
  const [cabecalho, setCabecalho] = useState<{ local_id: string; observacoes: string }>({
    local_id: '',
    observacoes: '',
  })

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const { data: i, error: erroI } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, tipo, local_id, modelo_nome, norma, local_nome, inspetor_nome, iniciada_em, concluida_em, ' +
            'situacao, observacoes, itens_total, conformes, nao_conformes, nao_aplicaveis, percentual'
        )
        .eq('id', id)
        .single()

      if (erroI) throw erroI
      setInspecao(i as unknown as Inspecao)

      const { data: rs } = await supabase
        .from('inspecao_respostas')
        .select('id, ordem, categoria, pergunta, resposta, observacao, fotos, anexos, item_id, ' +
          'inspecao_modelo_itens!item_id(explicacao, orientacao, modelo_arquivo, modelo_rotulo)')
        .eq('inspecao_id', id)
        .order('ordem')
      setRespostas((rs || []) as unknown as Resposta[])

      setCabecalho({
        local_id: (i as any).local_id || '',
        observacoes: (i as any).observacoes || '',
      })

      const [{ data: as }, { data: ls }] = await Promise.all([
        supabase
          .from('inspecoes_alteracoes')
          .select('id, de, para, motivo, por_nome, created_at')
          .eq('inspecao_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('locais_trabalho')
          .select('id, nome')
          .eq('empresa_id', (i as any).empresa_id)
          .order('nome'),
      ])
      setAlteracoes((as || []) as unknown as Alteracao[])
      setLocais((ls || []) as { id: string; nome: string }[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível abrir a inspeção.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const auditoria = inspecao?.tipo === 'auditoria'

  /* O PostgREST devolve a relação ora como objeto, ora como lista de um. */
  function itemDe(r: Resposta) {
    const rel = Array.isArray(r.inspecao_modelo_itens)
      ? r.inspecao_modelo_itens[0]
      : r.inspecao_modelo_itens
    return rel || null
  }

  const nomeDoArquivo = (caminho: string) => caminho.split('/').pop() || caminho

  /*
   * Evidência é documento do cliente — PDF, planilha, foto da ata. Fica
   * num balde privado por empresa, e a avaliação é do ITEM, não de cada
   * arquivo: julgar arquivo por arquivo dividiria a mesma decisão em
   * duas e deixaria as duas pela metade.
   */
  async function enviarEvidencia(rid: string, arquivo: File | undefined) {
    if (!arquivo || !inspecao || fechada || enviando) return

    const r = respostas.find((x) => x.id === rid)
    if (!r) return
    if ((r.anexos || []).length >= 10) {
      setErro('Dez arquivos por item já é bastante.')
      return
    }

    setEnviando(rid)
    setErro('')

    try {
      const extensao = (arquivo.name.split('.').pop() || 'dat').toLowerCase().slice(0, 8)
      const caminho = `${inspecao.empresa_id}/${crypto.randomUUID()}.${extensao}`

      const { error: erroUp } = await supabase.storage
        .from('inspecao-evidencias')
        .upload(caminho, arquivo, { upsert: false })
      if (erroUp) throw erroUp

      const anexos = [...(r.anexos || []), caminho]
      const { error } = await supabase
        .from('inspecao_respostas')
        .update({ anexos })
        .eq('id', rid)
      if (error) throw error

      setRespostas((lista) => lista.map((x) => (x.id === rid ? { ...x, anexos } : x)))
      setNomes((n) => ({ ...n, [caminho]: arquivo.name }))
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível enviar a evidência.')
    } finally {
      setEnviando('')
    }
  }

  async function tirarEvidencia(rid: string, caminho: string) {
    if (fechada) return
    const r = respostas.find((x) => x.id === rid)
    if (!r) return

    const anexos = (r.anexos || []).filter((a) => a !== caminho)
    const { error } = await supabase.from('inspecao_respostas').update({ anexos }).eq('id', rid)
    if (error) {
      setErro(error.message)
      return
    }

    setRespostas((lista) => lista.map((x) => (x.id === rid ? { ...x, anexos } : x)))
    await supabase.storage.from('inspecao-evidencias').remove([caminho])
  }

  async function abrirArquivo(balde: string, caminho: string) {
    const { data, error } = await supabase.storage.from(balde).createSignedUrl(caminho, 300)
    if (error || !data?.signedUrl) {
      setErro(error?.message || 'Não foi possível abrir o arquivo.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noreferrer')
  }

  /* As fotos ficam num balde privado: cada uma precisa de link assinado. */
  useEffect(() => {
    let vivo = true

    async function assinar() {
      const caminhos = respostas.flatMap((r) => r.fotos || []).filter(Boolean)
      const faltando = [...new Set(caminhos)].filter((c) => !links[c])
      if (!faltando.length) return

      const { data } = await supabase.storage
        .from('inspecao-fotos')
        .createSignedUrls(faltando, 3600)

      if (!vivo || !data) return

      const novos: Record<string, string> = {}
      for (const l of data) if (l.path && l.signedUrl) novos[l.path] = l.signedUrl
      setLinks((atual) => ({ ...atual, ...novos }))
    }

    assinar()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respostas])

  const fechada = inspecao?.situacao !== 'em_andamento'

  /*
   * Encolhe a foto antes de subir. Celular novo tira foto de 8 MB; o
   * balde aceita 5, e no canteiro a internet é a que der. 1600px de
   * lado resolve qualquer coisa que se queira provar numa inspeção.
   */
  async function encolher(arquivo: File): Promise<Blob> {
    const bitmap = await createImageBitmap(arquivo)
    const maior = Math.max(bitmap.width, bitmap.height)
    const escala = maior > 1600 ? 1600 / maior : 1
    const tela = document.createElement('canvas')
    tela.width = Math.round(bitmap.width * escala)
    tela.height = Math.round(bitmap.height * escala)
    tela.getContext('2d')?.drawImage(bitmap, 0, 0, tela.width, tela.height)
    return new Promise((ok) => tela.toBlob((b) => ok(b as Blob), 'image/jpeg', 0.8))
  }

  async function enviarFoto(rid: string, arquivo: File | undefined) {
    if (!arquivo || !inspecao || fechada || enviando) return

    const r = respostas.find((x) => x.id === rid)
    if (!r) return
    if ((r.fotos || []).length >= 3) {
      setErro('Três fotos por item já é bastante para provar o achado.')
      return
    }

    setEnviando(rid)
    setErro('')

    try {
      const blob = await encolher(arquivo)
      const caminho = `${inspecao.empresa_id}/${crypto.randomUUID()}.jpg`

      const { error: erroUp } = await supabase.storage
        .from('inspecao-fotos')
        .upload(caminho, blob, { contentType: 'image/jpeg', upsert: false })
      if (erroUp) throw erroUp

      const fotos = [...(r.fotos || []), caminho]
      const { error } = await supabase
        .from('inspecao_respostas')
        .update({ fotos, foto_path: fotos[0] })
        .eq('id', rid)
      if (error) throw error

      setRespostas((lista) => lista.map((x) => (x.id === rid ? { ...x, fotos } : x)))
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível enviar a foto.')
    } finally {
      setEnviando('')
    }
  }

  async function tirarFoto(rid: string, caminho: string) {
    if (fechada) return
    const r = respostas.find((x) => x.id === rid)
    if (!r) return

    const fotos = (r.fotos || []).filter((f) => f !== caminho)
    const { error } = await supabase
      .from('inspecao_respostas')
      .update({ fotos, foto_path: fotos[0] || null })
      .eq('id', rid)

    if (error) {
      setErro(error.message)
      return
    }

    setRespostas((lista) => lista.map((x) => (x.id === rid ? { ...x, fotos } : x)))
    await supabase.storage.from('inspecao-fotos').remove([caminho])
  }

  async function responder(rid: string, valor: string) {
    if (fechada) return
    const anterior = respostas.find((r) => r.id === rid)?.resposta || null
    /* Clicar de novo na mesma resposta desmarca. */
    const nova = anterior === valor ? null : valor

    setRespostas((lista) => lista.map((r) => (r.id === rid ? { ...r, resposta: nova } : r)))

    const { error } = await supabase.from('inspecao_respostas').update({ resposta: nova }).eq('id', rid)
    if (error) {
      setErro(error.message)
      setRespostas((lista) => lista.map((r) => (r.id === rid ? { ...r, resposta: anterior } : r)))
    }
  }

  async function anotar(rid: string, texto: string) {
    if (fechada) return
    setRespostas((lista) => lista.map((r) => (r.id === rid ? { ...r, observacao: texto } : r)))
    await supabase.from('inspecao_respostas').update({ observacao: texto || null }).eq('id', rid)
  }

  /*
   * Reabrir não é desfazer: a conclusão anterior fica no histórico, com
   * quem reabriu e por quê. O que protege o documento não é impedir a
   * correção — é deixar claro o que foi corrigido.
   */
  async function reabrir() {
    if (motivoReabrir.trim().length < 5) {
      setErro('Diga por que está reabrindo (ao menos algumas palavras).')
      return
    }

    setErro('')
    const { error } = await supabase
      .from('inspecoes')
      .update({ situacao: 'em_andamento', motivo_reabertura: motivoReabrir.trim() })
      .eq('id', id)

    if (error) {
      setErro(error.message)
      return
    }

    setReabrindo(false)
    setMotivoReabrir('')
    await carregar()
  }

  async function salvarCabecalho() {
    const local = locais.find((l) => l.id === cabecalho.local_id) || null

    const { error } = await supabase
      .from('inspecoes')
      .update({
        local_id: local?.id || null,
        local_nome: local?.nome || null,
        observacoes: cabecalho.observacoes || null,
      })
      .eq('id', id)

    if (error) {
      setErro(error.message)
      return
    }

    setEditando(false)
    await carregar()
  }

  async function concluir() {
    if (concluindo || fechada) return

    const semResposta = respostas.filter((r) => !r.resposta).length
    if (semResposta > 0) {
      const segue = window.confirm(
        semResposta +
          (semResposta === 1 ? ' pergunta ficou' : ' perguntas ficaram') +
          ' sem resposta e não entram na conta. Concluir mesmo assim?'
      )
      if (!segue) return
    }

    setConcluindo(true)
    setErro('')

    const { error } = await supabase.from('inspecoes').update({ situacao: 'concluida' }).eq('id', id)
    setConcluindo(false)

    if (error) {
      setErro(error.message)
      return
    }

    await carregar()
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  if (!inspecao) {
    return (
      <div className="app">
        <div className="banner bad">{erro || 'Inspeção não encontrada.'}</div>
      </div>
    )
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">{inspecao.modelo_nome}</h1>
        <p className="subtitulo-tela">
          {[inspecao.norma, inspecao.local_nome, inspecao.inspetor_nome].filter(Boolean).join(' · ')}
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {fechada && (
        <div className="banner">
          Inspeção concluída. {inspecao.conformes} conforme{inspecao.conformes === 1 ? '' : 's'},{' '}
          {inspecao.nao_conformes} não conforme{inspecao.nao_conformes === 1 ? '' : 's'},{' '}
          {inspecao.nao_aplicaveis} não aplicável
          {inspecao.percentual !== null ? ` — ${inspecao.percentual}% de conformidade` : ''}.{' '}
          <Link href="/inspecoes/nc" className="btn btn-sm">
            Ver as não conformidades
          </Link>
        </div>
      )}

      <div className="filters">
        <Link href="/inspecoes" className="btn btn-sm">
          ← Voltar
        </Link>
        {!fechada && (
          <button type="button" className="btn btn-sm" onClick={() => setEditando((e) => !e)}>
            {editando ? 'Fechar' : 'Editar local e observações'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {fechada && inspecao.situacao === 'concluida' && (
          <button type="button" className="btn btn-sm" onClick={() => setReabrindo((r) => !r)}>
            {reabrindo ? 'Deixar como está' : 'Reabrir para corrigir'}
          </button>
        )}
        {!fechada && (
          <button type="button" className="btn btn-primary" disabled={concluindo} onClick={concluir}>
            {concluindo ? 'Concluindo…' : 'Concluir inspeção'}
          </button>
        )}
      </div>

      {reabrindo && (
        <div className="panel">
          <div className="panel-body insp-ficha">
            <label>
              Por que está reabrindo?
              <input
                type="text"
                value={motivoReabrir}
                onChange={(e) => setMotivoReabrir(e.target.value)}
                placeholder="Ex.: marquei conforme por engano no item 7"
              />
            </label>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
              Fica registrado com o seu nome e a data. Ao concluir de novo, o item que deixar de
              ser não conforme tem a não conformidade dele cancelada — as já encerradas não são
              tocadas.
            </p>
            <button type="button" className="btn btn-primary" onClick={reabrir}>
              Reabrir
            </button>
          </div>
        </div>
      )}

      {editando && (
        <div className="panel">
          <div className="panel-body insp-ficha">
            <label>
              Local
              <select
                value={cabecalho.local_id}
                onChange={(e) => setCabecalho({ ...cabecalho, local_id: e.target.value })}
              >
                <option value="">Sem local</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observações da inspeção
              <textarea
                value={cabecalho.observacoes}
                onChange={(e) => setCabecalho({ ...cabecalho, observacoes: e.target.value })}
                placeholder="O que vale dizer sobre a visita como um todo"
              />
            </label>
            <button type="button" className="btn btn-primary" onClick={salvarCabecalho}>
              Salvar
            </button>
          </div>
        </div>
      )}

      {alteracoes.length > 0 && (
        <div className="panel nao-imprimir">
          <div className="panel-head">
            <div className="section-title">Reaberturas</div>
          </div>
          <div className="panel-body">
            {alteracoes.map((a) => (
              <div key={a.id} style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                {new Date(a.created_at).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}{' '}
                · {a.por_nome || 'alguém'} reabriu: {a.motivo}
              </div>
            ))}
          </div>
        </div>
      )}

      {respostas.length === 0 ? (
        <p className="empty-state">
          Este modelo não tinha pergunta nenhuma quando a inspeção foi aberta.
        </p>
      ) : (
        <div>
          {respostas.map((r, n) => (
            <div key={r.id} className={'insp-item respondido-' + (r.resposta || 'nenhum')}>
              <div className="pergunta">
                {n + 1}. {r.pergunta}
              </div>
              {r.categoria && <div className="orientacao">{r.categoria}</div>}

              {/* Em auditoria, o que se pede para ver. É a evidência
                  objetiva da ISO 19011 — sem isso o auditor julga
                  impressão. */}
              {(itemDe(r)?.explicacao || itemDe(r)?.orientacao) && (
                <div className="insp-explicacao">
                  {itemDe(r)?.explicacao || itemDe(r)?.orientacao}
                </div>
              )}

              {/* Em auditoria o meio-termo é real: o programa existe mas
                  não cobre tudo. Forçar atende/não atende empurra o
                  auditor para o lado generoso e a constatação perde
                  valor. Em inspeção de campo não existe meio extintor
                  desobstruído, então a opção não aparece. */}
              <div className="insp-respostas">
                {(auditoria
                  ? ([
                      ['conforme', 'sim', 'Atende'],
                      ['atende_parcial', 'meio', 'Atende parcialmente'],
                      ['nao_conforme', 'nao', 'Não atende'],
                      ['nao_aplicavel', 'na', 'Não se aplica'],
                    ] as const)
                  : ([
                      ['conforme', 'sim', 'Conforme'],
                      ['nao_conforme', 'nao', 'Não conforme'],
                      ['nao_aplicavel', 'na', 'Não se aplica'],
                    ] as const)
                ).map(([valor, classe, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    className={classe + (r.resposta === valor ? ' ativo' : '')}
                    disabled={fechada}
                    onClick={() => responder(r.id, valor)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {(r.resposta === 'nao_conforme' || r.observacao) && (
                <input
                  type="text"
                  value={r.observacao || ''}
                  disabled={fechada}
                  placeholder="O que foi encontrado (entra na não conformidade)"
                  onChange={(e) => anotar(r.id, e.target.value)}
                />
              )}

              {/* A foto é o que separa um relatório que se discute de um
                  que não se discute: "material empilhado fora do lugar"
                  é opinião; a foto da pilha não é. */}
              <div className="insp-fotos">
                {(r.fotos || []).map((f) => (
                  <div key={f} className="insp-foto">
                    {links[f] ? (
                      <a href={links[f]} target="_blank" rel="noreferrer">
                        <img src={links[f]} alt="Foto do item" />
                      </a>
                    ) : (
                      <span className="carregando">…</span>
                    )}
                    {!fechada && (
                      <button type="button" onClick={() => tirarFoto(r.id, f)} title="Tirar a foto">
                        ×
                      </button>
                    )}
                  </div>
                ))}

                {!fechada && (r.fotos || []).length < 3 && (
                  <label className="insp-add-foto">
                    {enviando === r.id ? 'Enviando…' : '+ Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={!!enviando}
                      onChange={(e) => {
                        enviarFoto(r.id, e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Auditoria: o modelo para baixar e a evidência para
                  enviar. Baixar o modelo transforma "você está
                  reprovado" em "aqui está como resolver". */}
              {auditoria && (
                <div className="insp-evidencia">
                  {itemDe(r)?.modelo_arquivo && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => abrirArquivo('inspecao-modelos', itemDe(r)!.modelo_arquivo!)}
                    >
                      Baixar {itemDe(r)?.modelo_rotulo || 'modelo'}
                    </button>
                  )}

                  {!fechada && (r.anexos || []).length < 10 && (
                    <label className="btn btn-sm insp-add-arquivo">
                      {enviando === r.id ? 'Enviando…' : 'Enviar evidência'}
                      <input
                        type="file"
                        disabled={!!enviando}
                        onChange={(e) => {
                          enviarEvidencia(r.id, e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}

                  {(r.anexos || []).map((a) => (
                    <span key={a} className="insp-arquivo">
                      <button
                        type="button"
                        className="nome"
                        onClick={() => abrirArquivo('inspecao-evidencias', a)}
                        title="Abrir"
                      >
                        {nomes[a] || nomeDoArquivo(a)}
                      </button>
                      {!fechada && (
                        <button type="button" onClick={() => tirarEvidencia(r.id, a)} title="Tirar">
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function AplicarInspecao({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ComModulo modulo="inspecoes">
      <AplicarInspecaoConteudo params={params} />
    </ComModulo>
  )
}
