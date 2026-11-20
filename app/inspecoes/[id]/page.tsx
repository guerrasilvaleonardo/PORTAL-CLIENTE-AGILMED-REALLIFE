'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { use } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'
import '../auditoria.css'
import '../conversa.css'

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
  anexos_estado: Record<string, 'aceita' | 'recusada'> | null
  aprovado_em: string | null
  aprovado_nome: string | null
  item_id: string | null
  inspecao_modelo_itens?: ItemDoModelo | ItemDoModelo[] | null
}

type Mensagem = {
  id: number
  resposta_id: string
  texto: string
  autor_nome: string | null
  autor_papel: string
  created_at: string
}

type ItemDoModelo = {
  requisito: string | null
  prescricao: string | null
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
  auditor_lider: string | null
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

  /* O plano e as reuniões, que a ISO 19011 pede em 6.2, 6.3, 6.4.3,
     6.4.9 e 6.4.10. Guardados na própria auditoria. */
  const [verPlano, setVerPlano] = useState(false)
  const [plano, setPlano] = useState<Record<string, string>>({})
  const [salvandoPlano, setSalvandoPlano] = useState(false)

  /* Reabrir para corrigir, e o histórico de quem reabriu. */
  const [reabrindo, setReabrindo] = useState(false)
  const [motivoReabrir, setMotivoReabrir] = useState('')
  const [alteracoes, setAlteracoes] = useState<Alteracao[]>([])
  const [locais, setLocais] = useState<{ id: string; nome: string }[]>([])
  const [empresaNome, setEmpresaNome] = useState('')
  const [recolhidas, setRecolhidas] = useState<Record<string, boolean>>({})
  const [interno, setInterno] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [rascunhoMsg, setRascunhoMsg] = useState<Record<string, string>>({})
  const [enviandoMsg, setEnviandoMsg] = useState('')
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
            'objetivo, escopo, criterios, equipe, auditor_lider, plano_agenda, abertura_em, ' +
            'abertura_participantes, encerramento_em, encerramento_participantes, conclusao, ' +
            'situacao, observacoes, itens_total, conformes, nao_conformes, nao_aplicaveis, percentual'
        )
        .eq('id', id)
        .single()

      if (erroI) throw erroI
      setInspecao(i as unknown as Inspecao)

      const { data: rs } = await supabase
        .from('inspecao_respostas')
        .select('id, ordem, categoria, pergunta, resposta, observacao, fotos, anexos, anexos_estado, ' +
          'aprovado_em, aprovado_nome, item_id, ' +
          'inspecao_modelo_itens!item_id(requisito, prescricao, explicacao, orientacao, modelo_arquivo, modelo_rotulo)')
        .eq('inspecao_id', id)
        .order('ordem')
      const listaR = (rs || []) as unknown as Resposta[]
      setRespostas(listaR)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('perfil')
          .eq('id', user.id)
          .single()
        setInterno(['atendimento', 'gestor', 'admin'].includes(perfil?.perfil || ''))
      }

      /* A conversa de todos os itens numa consulta só: trinta consultas
       * separadas deixariam a tela abrindo aos pedaços. */
      if (listaR.length > 0) {
        const { data: msgs } = await supabase
          .from('inspecao_resposta_mensagens')
          .select('id, resposta_id, texto, autor_nome, autor_papel, created_at')
          .in(
            'resposta_id',
            listaR.map((r) => r.id)
          )
          .order('created_at')
        setMensagens((msgs || []) as unknown as Mensagem[])
      }

      const i2 = i as any
      setPlano({
        objetivo: i2.objetivo || '',
        escopo: i2.escopo || '',
        criterios: i2.criterios || '',
        auditor_lider: i2.auditor_lider || '',
        equipe: i2.equipe || '',
        plano_agenda: i2.plano_agenda || '',
        abertura_em: (i2.abertura_em || '').slice(0, 16),
        abertura_participantes: i2.abertura_participantes || '',
        encerramento_em: (i2.encerramento_em || '').slice(0, 16),
        encerramento_participantes: i2.encerramento_participantes || '',
        conclusao: i2.conclusao || '',
      })

      setCabecalho({
        local_id: (i as any).local_id || '',
        observacoes: (i as any).observacoes || '',
      })

      const [{ data: as }, { data: ls }, { data: emp }] = await Promise.all([
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
        /* O relatório de auditoria é da EMPRESA auditada: o nome dela
         * fica no título, não escondido num campo lá embaixo. */
        supabase
          .from('empresas')
          .select('razao_social, nome_fantasia')
          .eq('id', (i as any).empresa_id)
          .single(),
      ])
      setAlteracoes((as || []) as unknown as Alteracao[])
      setLocais((ls || []) as { id: string; nome: string }[])
      setEmpresaNome(((emp as any)?.nome_fantasia || (emp as any)?.razao_social || '') as string)
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

  const respondidas = respostas.filter((r) => r.resposta).length

  /* Conformidade de tudo o que já foi avaliado — a mesma conta que o
   * banco faz no fechamento, para o número na tela não brigar com o
   * número do relatório. */
  const conformidade = (() => {
    const conf = respostas.filter((r) => r.resposta === 'conforme').length
    const parc = respostas.filter((r) => r.resposta === 'atende_parcial').length
    const nao = respostas.filter((r) => r.resposta === 'nao_conforme').length
    const base = conf + parc + nao
    return base > 0 ? Math.round((100 * (conf + 0.5 * parc)) / base) : null
  })()

  /* Agrupa pela seção da norma, na ordem em que as perguntas vieram do
   * modelo. Auditoria se conduz seção a seção — "agora vamos ao 9" — e
   * uma lista corrida de 30 itens perde o fio. A numeração continua
   * global para o relatório poder citar "item 18". */
  const secoes = respostas.reduce<{ titulo: string; itens: { r: Resposta; n: number }[] }[]>(
    (acc, r, i) => {
      const titulo = r.categoria || ''
      const ultima = acc[acc.length - 1]
      if (ultima && ultima.titulo === titulo) ultima.itens.push({ r, n: i + 1 })
      else acc.push({ titulo, itens: [{ r, n: i + 1 }] })
      return acc
    },
    []
  )

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

  /* Aceitar ou recusar um arquivo como evidência. Clicar de novo no
   * mesmo estado desfaz: errar a marcação é comum e desmarcar não pode
   * exigir recarregar a página. */
  async function avaliarAnexo(rid: string, caminho: string, estado: 'aceita' | 'recusada' | null) {
    const r = respostas.find((x) => x.id === rid)
    if (!r) return

    const atual = { ...(r.anexos_estado || {}) }
    if (estado) atual[caminho] = estado
    else delete atual[caminho]

    const { error } = await supabase
      .from('inspecao_respostas')
      .update({ anexos_estado: atual })
      .eq('id', rid)

    if (error) {
      setErro(error.message)
      return
    }

    setRespostas((lista) => lista.map((x) => (x.id === rid ? { ...x, anexos_estado: atual } : x)))
  }

  /* A conversa do requisito. Mensagem entra e não se mexe mais: registro
   * que pode ser reescrito depois não serve como evidência. */
  async function mandarMensagem(rid: string) {
    const texto = (rascunhoMsg[rid] || '').trim()
    if (texto.length < 2 || enviandoMsg) return

    setEnviandoMsg(rid)
    const { data, error } = await supabase
      .from('inspecao_resposta_mensagens')
      .insert({ resposta_id: rid, texto })
      .select('id, resposta_id, texto, autor_nome, autor_papel, created_at')
      .single()
    setEnviandoMsg('')

    if (error) {
      setErro(error.message)
      return
    }

    setMensagens((l) => [...l, data as unknown as Mensagem])
    setRascunhoMsg((d) => ({ ...d, [rid]: '' }))
  }

  /* Aprovar é do auditor, e é o que encerra o item. Depois de aprovar,
   * a tela leva para o próximo requisito que ainda não foi avaliado —
   * é assim que a auditoria anda sem ninguém procurar onde parou. */
  async function aprovar(rid: string, desfazer = false) {
    const { error } = await supabase
      .from('inspecao_respostas')
      .update({ aprovado_em: desfazer ? null : new Date().toISOString() })
      .eq('id', rid)

    if (error) {
      setErro(error.message)
      return
    }

    setRespostas((l) =>
      l.map((x) =>
        x.id === rid
          ? { ...x, aprovado_em: desfazer ? null : new Date().toISOString(), aprovado_nome: null }
          : x
      )
    )

    if (desfazer) return

    const i = respostas.findIndex((x) => x.id === rid)
    const proximo = respostas.slice(i + 1).find((x) => !x.resposta || !x.aprovado_em)
    if (proximo) {
      const secao = proximo.categoria || 'sem-secao'
      setRecolhidas((d) => ({ ...d, [secao]: false }))
      setTimeout(() => {
        document.getElementById('item-' + proximo.id)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 80)
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

  async function salvarPlano() {
    if (salvandoPlano) return
    setSalvandoPlano(true)
    setErro('')

    const { error } = await supabase
      .from('inspecoes')
      .update({
        objetivo: plano.objetivo || null,
        escopo: plano.escopo || null,
        criterios: plano.criterios || null,
        auditor_lider: plano.auditor_lider || null,
        equipe: plano.equipe || null,
        plano_agenda: plano.plano_agenda || null,
        abertura_em: plano.abertura_em ? new Date(plano.abertura_em).toISOString() : null,
        abertura_participantes: plano.abertura_participantes || null,
        encerramento_em: plano.encerramento_em ? new Date(plano.encerramento_em).toISOString() : null,
        encerramento_participantes: plano.encerramento_participantes || null,
        conclusao: plano.conclusao || null,
      })
      .eq('id', id)

    setSalvandoPlano(false)

    if (error) {
      setErro(error.message)
      return
    }

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
      {/* Em auditoria o título é a norma e a empresa auditada — é assim
       * que o documento vai ser citado depois. Em inspeção de campo o
       * que identifica é o checklist e o local. */}
      <div className="insp-cabeca">
        <div>
          <p className="eyebrow">{auditoria ? 'AUDITORIA INTERNA' : 'INSPEÇÕES'}</p>
          <h1 className="titulo-tela">
            {auditoria
              ? [inspecao.norma || inspecao.modelo_nome, empresaNome].filter(Boolean).join(' — ')
              : inspecao.modelo_nome}
          </h1>
          <p className="subtitulo-tela">
            {(auditoria
              ? [inspecao.auditor_lider || inspecao.inspetor_nome, inspecao.local_nome]
              : [inspecao.norma, inspecao.local_nome, inspecao.inspetor_nome]
            )
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="insp-cabeca-acoes nao-imprimir">
          {/* Quem está no meio de uma auditoria de 30 requisitos precisa
           * saber quanto falta sem contar na mão. */}
          {respostas.length > 0 && (
            <span className="insp-contagem">
              {respondidas} de {respostas.length} respondidos ·{' '}
              {Math.round((100 * respondidas) / respostas.length)}% concluído
              {conformidade !== null && ' · ' + conformidade + '% de conformidade'}
            </span>
          )}

          {auditoria && (
            <Link href={'/auditorias/' + inspecao.id + '/relatorio'} className="btn btn-sm">
              Emitir relatório
            </Link>
          )}
        </div>
      </div>

      {respostas.length > 0 && (
        <div className="insp-barra" aria-hidden="true">
          <span style={{ width: Math.round((respondidas / respostas.length) * 100) + '%' }} />
        </div>
      )}

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
            {editando ? 'Fechar' : auditoria ? 'Editar dados da auditoria' : 'Editar local e observações'}
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
            {concluindo ? 'Concluindo…' : auditoria ? 'Encerrar auditoria' : 'Concluir inspeção'}
          </button>
        )}
      </div>

      {/* O plano, as reuniões e as conclusões — os ritos que a ISO 19011
          pede em 6.2, 6.3, 6.4.3, 6.4.9 e 6.4.10. Só em auditoria. */}
      {auditoria && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Plano da auditoria e reuniões</div>
            <button type="button" className="btn btn-sm" onClick={() => setVerPlano((v) => !v)}>
              {verPlano ? 'Fechar' : 'Abrir'}
            </button>
          </div>

          {verPlano && (
            <div className="panel-body insp-ficha">
              <div className="duas">
                <label>
                  Objetivo da auditoria
                  <textarea
                    value={plano.objetivo || ''}
                    onChange={(e) => setPlano({ ...plano, objetivo: e.target.value })}
                    placeholder="Para que esta auditoria está sendo feita"
                  />
                </label>
                <label>
                  Escopo
                  <textarea
                    value={plano.escopo || ''}
                    onChange={(e) => setPlano({ ...plano, escopo: e.target.value })}
                    placeholder="Processos, áreas e unidades cobertos"
                  />
                </label>
              </div>

              <label>
                Critérios
                <textarea
                  value={plano.criterios || ''}
                  onChange={(e) => setPlano({ ...plano, criterios: e.target.value })}
                  placeholder="Contra o que se audita: a norma, o PGR, os procedimentos da empresa"
                />
              </label>

              <div className="duas">
                <label>
                  Auditor líder
                  <input
                    type="text"
                    value={plano.auditor_lider || ''}
                    onChange={(e) => setPlano({ ...plano, auditor_lider: e.target.value })}
                  />
                </label>
                <label>
                  Equipe auditora
                  <input
                    type="text"
                    value={plano.equipe || ''}
                    onChange={(e) => setPlano({ ...plano, equipe: e.target.value })}
                    placeholder="Quem mais participa, e em quê"
                  />
                </label>
              </div>

              <label>
                Agenda
                <textarea
                  value={plano.plano_agenda || ''}
                  onChange={(e) => setPlano({ ...plano, plano_agenda: e.target.value })}
                  placeholder="Horário por área, para o auditado saber quando é a vez dele"
                />
              </label>

              <div className="duas">
                <label>
                  Reunião de abertura
                  <input
                    type="datetime-local"
                    value={plano.abertura_em || ''}
                    onChange={(e) => setPlano({ ...plano, abertura_em: e.target.value })}
                  />
                </label>
                <label>
                  Quem participou da abertura
                  <input
                    type="text"
                    value={plano.abertura_participantes || ''}
                    onChange={(e) => setPlano({ ...plano, abertura_participantes: e.target.value })}
                  />
                </label>
              </div>

              <div className="duas">
                <label>
                  Reunião de encerramento
                  <input
                    type="datetime-local"
                    value={plano.encerramento_em || ''}
                    onChange={(e) => setPlano({ ...plano, encerramento_em: e.target.value })}
                  />
                </label>
                <label>
                  Quem participou do encerramento
                  <input
                    type="text"
                    value={plano.encerramento_participantes || ''}
                    onChange={(e) =>
                      setPlano({ ...plano, encerramento_participantes: e.target.value })
                    }
                  />
                </label>
              </div>

              <label>
                Conclusões da auditoria
                <textarea
                  value={plano.conclusao || ''}
                  onChange={(e) => setPlano({ ...plano, conclusao: e.target.value })}
                  placeholder="O parecer do auditor líder sobre o sistema, não a lista de achados"
                />
              </label>

              <button
                type="button"
                className="btn btn-primary"
                disabled={salvandoPlano}
                onClick={salvarPlano}
              >
                {salvandoPlano ? 'Salvando…' : 'Salvar plano'}
              </button>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
                Nada aqui é obrigatório para concluir: auditoria que começa e termina no mesmo dia
                não tem plano escrito de véspera, e travar por isso só faria inventar texto. O
                relatório mostra o que ficou em branco.
              </p>
            </div>
          )}
        </div>
      )}

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
        <div className={auditoria ? 'insp-auditoria' : undefined}>
          {secoes.map((secao) => {
            const chave = secao.titulo || 'sem-secao'
            const recolhida = !!recolhidas[chave]
            const feitos = secao.itens.filter(({ r }) => r.resposta).length
            const completa = feitos === secao.itens.length

            /* Conformidade da seção: o parcial vale meio ponto e o "não
             * se aplica" sai da conta, igual ao que o banco faz no
             * fechamento. Dois números diferentes para a mesma coisa é
             * o jeito mais rápido de perder a confiança no indicador. */
            const conf = secao.itens.filter(({ r }) => r.resposta === 'conforme').length
            const parc = secao.itens.filter(({ r }) => r.resposta === 'atende_parcial').length
            const naoConf = secao.itens.filter(({ r }) => r.resposta === 'nao_conforme').length
            const base = conf + parc + naoConf
            const pct = base > 0 ? Math.round((100 * (conf + 0.5 * parc)) / base) : null

            /* Andamento é outra coisa de conformidade, e é a que serve
             * para gerenciar: quanto da auditoria já foi percorrido.
             * Aparece desde o zero — indicador que só nasce depois da
             * primeira resposta não ajuda quem precisa planejar. */
            const andamento = Math.round((100 * feitos) / secao.itens.length)

            return (
            <div key={chave} className={'insp-grupo' + (recolhida ? ' recolhido' : '')}>
              {/* Agrupado como planilha: a seção recolhe, e o contador
                  da direita diz o que falta nela sem precisar abrir.
                  Auditoria de 30 requisitos em sete seções não se lê
                  numa rolagem só. */}
              {secao.titulo && (
                <button
                  type="button"
                  className="insp-grupo-cabeca"
                  aria-expanded={!recolhida}
                  onClick={() => setRecolhidas((d) => ({ ...d, [chave]: !d[chave] }))}
                >
                  <span className="sinal" aria-hidden="true">
                    {recolhida ? '+' : '−'}
                  </span>
                  <span className="titulo">{secao.titulo}</span>
                  {/* Barrinha de andamento da seção: dá para ler de
                      relance quanto falta em cada capítulo da norma. */}
                  <span className="insp-mini-barra" aria-hidden="true">
                    <span style={{ width: andamento + '%' }} />
                  </span>
                  <span className="insp-pct andamento">{andamento}%</span>
                  {pct !== null && (
                    <span
                      className={
                        'insp-pct ' + (pct >= 90 ? 'bom' : pct >= 70 ? 'medio' : 'ruim')
                      }
                      title="Conformidade do que já foi avaliado"
                    >
                      {pct}% conf.
                    </span>
                  )}
                  <span className={'conta' + (completa ? ' completa' : '')}>
                    {feitos} de {secao.itens.length}
                  </span>
                </button>
              )}

              <div className="insp-grupo-corpo">
              {secao.itens.map(({ r, n }) => (
            <div
              key={r.id}
              id={'item-' + r.id}
              className={
                'insp-item respondido-' +
                (r.resposta || 'nenhum') +
                (r.aprovado_em ? ' aprovado' : '')
              }
            >
              {/* Constatação se escreve contra um requisito, não contra
                  uma impressão: "não atende ao 9.3" é auditável; "a
                  direção não acompanha" é conversa. */}
              <div className="pergunta">
                {itemDe(r)?.requisito ? (
                  <span className="insp-requisito">{itemDe(r)!.requisito}</span>
                ) : (
                  <span className="insp-requisito vazio">{n}</span>
                )}
                {r.pergunta}
              </div>

              {/* Em auditoria, o que se pede para ver. É a evidência
                  objetiva da ISO 19011 — sem isso o auditor julga
                  impressão. */}
              {(itemDe(r)?.explicacao || itemDe(r)?.orientacao) && (
                <div className="insp-explicacao">
                  {itemDe(r)?.explicacao || itemDe(r)?.orientacao}
                </div>
              )}

              {/* A prescrição é aula, não cola: vem fechada para não
                  atrapalhar quem já sabe, e abre para quem precisa. São
                  dois leitores no mesmo item — o auditor olha a linha
                  acima de relance; a empresa lê isto com calma antes. */}
              {auditoria && itemDe(r)?.prescricao && (
                <details className="insp-prescricao">
                  <summary>Como atender este requisito</summary>
                  <div>{itemDe(r)!.prescricao}</div>
                </details>
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

              {/* Em auditoria, dizer na hora o que aquela marcação vai
                  custar. O auditor que só descobre no fim que abriu oito
                  constatações maiores tende a voltar atrás no atacado —
                  e aí a auditoria vira negociação. */}
              {auditoria && (r.resposta === 'nao_conforme' || r.resposta === 'atende_parcial') && (
                <div className={'insp-aviso-nc ' + (r.resposta === 'nao_conforme' ? 'maior' : 'menor')}>
                  <strong>
                    {r.resposta === 'nao_conforme'
                      ? 'Não conformidade maior'
                      : 'Não conformidade menor'}
                  </strong>{' '}
                  — abre tratamento com causa, ação e verificação da eficácia ao encerrar a
                  auditoria. Escreva abaixo a evidência que sustenta a constatação.
                </div>
              )}

              {(r.resposta === 'nao_conforme' ||
                (auditoria && r.resposta === 'atende_parcial') ||
                r.observacao) && (
                <input
                  type="text"
                  value={r.observacao || ''}
                  disabled={fechada}
                  placeholder={
                    auditoria
                      ? 'A evidência objetiva: o que foi visto, em que documento, com que data'
                      : 'O que foi encontrado (entra na não conformidade)'
                  }
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

                  {/* O estado do arquivo responde outra pergunta que a
                      do requisito: "o documento que você mandou serve
                      como evidência?". Recusar e pedir outro acontece
                      antes de fechar o item, e sem registro disso o
                      cliente reenvia o mesmo PDF três vezes. */}
                  {(r.anexos || []).map((a) => {
                    const estado = (r.anexos_estado || {})[a]
                    return (
                    <span key={a} className={'insp-arquivo' + (estado ? ' ' + estado : '')}>
                      <button
                        type="button"
                        className="nome"
                        onClick={() => abrirArquivo('inspecao-evidencias', a)}
                        title="Abrir"
                      >
                        {nomes[a] || nomeDoArquivo(a)}
                      </button>

                      {estado && (
                        <span className={'pill ' + (estado === 'aceita' ? 'good' : 'bad')}>
                          {estado}
                        </span>
                      )}

                      {auditoria && !fechada && (
                        <>
                          <button
                            type="button"
                            className="avaliar"
                            title="Aceitar como evidência"
                            onClick={() => avaliarAnexo(r.id, a, estado === 'aceita' ? null : 'aceita')}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="avaliar"
                            title="Recusar: pedir outro documento"
                            onClick={() =>
                              avaliarAnexo(r.id, a, estado === 'recusada' ? null : 'recusada')
                            }
                          >
                            !
                          </button>
                        </>
                      )}

                      {!fechada && (
                        <button type="button" onClick={() => tirarEvidencia(r.id, a)} title="Tirar">
                          ×
                        </button>
                      )}
                    </span>
                    )
                  })}
                </div>
              )}

              {/* A conversa do requisito, como chamado: o cliente
                  pergunta, o auditor responde, tudo datado e com autor.
                  Antes isso acontecia por WhatsApp e sumia — e numa
                  certificação o auditor externo pergunta exatamente
                  como cada achado foi tratado. */}
              {auditoria && (
                <div className="insp-conversa">
                  {(mensagens.filter((m) => m.resposta_id === r.id) || []).map((m) => (
                    <div key={m.id} className={'insp-msg ' + m.autor_papel}>
                      <div className="quem">
                        {m.autor_nome || (m.autor_papel === 'equipe' ? 'Auditor' : 'Empresa')}
                        <span className="quando">
                          {new Date(m.created_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="texto">{m.texto}</div>
                    </div>
                  ))}

                  {!fechada && !r.aprovado_em && (
                    <div className="insp-msg-nova">
                      <input
                        type="text"
                        value={rascunhoMsg[r.id] || ''}
                        placeholder={
                          interno
                            ? 'Responder ao cliente ou pedir outro documento'
                            : 'Comentar ou perguntar ao auditor'
                        }
                        onChange={(e) =>
                          setRascunhoMsg((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') mandarMensagem(r.id)
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={enviandoMsg === r.id || (rascunhoMsg[r.id] || '').trim().length < 2}
                        onClick={() => mandarMensagem(r.id)}
                      >
                        {enviandoMsg === r.id ? 'Enviando…' : 'Enviar'}
                      </button>
                    </div>
                  )}

                  {r.aprovado_em ? (
                    <div className="insp-aprovado">
                      <strong>Requisito aprovado</strong>
                      {r.aprovado_nome ? ' por ' + r.aprovado_nome : ''} em{' '}
                      {new Date(r.aprovado_em).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      .
                      {interno && !fechada && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => aprovar(r.id, true)}
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  ) : (
                    interno &&
                    !fechada &&
                    r.resposta && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => aprovar(r.id)}
                      >
                        Aprovar e ir para o próximo
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
              ))}
              </div>
            </div>
            )
          })}
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
