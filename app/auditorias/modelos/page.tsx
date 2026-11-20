'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { gerarDocx } from '@/lib/word'
import { minutaDoRequisito } from '@/lib/minutasAuditoria'
import '../../colaboradores/colaboradores.css'
import '../../inspecoes/inspecoes.css'

/*
 * Bancada da equipe: o que pedir em cada requisito e qual minuta o
 * cliente baixa.
 *
 * Sem esta tela o botão "Baixar modelo" nunca aparece, porque ninguém
 * tem como subir arquivo nenhum — e a explicação de cada item só existe
 * se alguém escrever.
 *
 * É da CASA, não do cliente: o balde inspecao-modelos é de leitura para
 * todo autenticado e de escrita só para a equipe. Não há dado de
 * cliente ali — é a minuta de ata, o programa em branco.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Modelo = { id: string; nome: string; norma: string | null; tipo: string }

type Item = {
  id: string
  ordem: number
  categoria: string | null
  requisito: string | null
  pergunta: string
  explicacao: string | null
  orientacao: string | null
  modelo_arquivo: string | null
  modelo_rotulo: string | null
}

const nomeDoArquivo = (caminho: string) => caminho.split('/').pop() || caminho

export default function ModelosDeAuditoria() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [interno, setInterno] = useState(false)

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [escolhido, setEscolhido] = useState('')
  const [itens, setItens] = useState<Item[]>([])
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState('')
  const [enviando, setEnviando] = useState('')

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
        .select('perfil')
        .eq('id', user.id)
        .single()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      if (!ehInterno) return

      const { data, error } = await supabase
        .from('inspecao_modelos')
        .select('id, nome, norma, tipo')
        .eq('tipo', 'auditoria')
        .is('empresa_id', null)
        .order('nome')

      if (error) throw error
      setModelos((data || []) as unknown as Modelo[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os modelos.')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarItens(modeloId: string) {
    setEscolhido(modeloId)
    setItens([])
    setRascunho({})
    if (!modeloId) return

    const { data, error } = await supabase
      .from('inspecao_modelo_itens')
      .select(
        'id, ordem, categoria, requisito, pergunta, explicacao, orientacao, modelo_arquivo, modelo_rotulo'
      )
      .eq('modelo_id', modeloId)
      .order('ordem')

    if (error) {
      setErro(error.message)
      return
    }

    const lista = (data || []) as unknown as Item[]
    setItens(lista)
    setRascunho(
      Object.fromEntries(lista.map((i) => [i.id, i.explicacao || i.orientacao || '']))
    )
  }

  useEffect(() => {
    carregar()
  }, [])

  /* Mesma leitura da tela de aplicar: seção a seção. */
  const secoes = useMemo(
    () =>
      itens.reduce<{ titulo: string; itens: Item[] }[]>((acc, i) => {
        const titulo = i.categoria || ''
        const ultima = acc[acc.length - 1]
        if (ultima && ultima.titulo === titulo) ultima.itens.push(i)
        else acc.push({ titulo, itens: [i] })
        return acc
      }, []),
    [itens]
  )

  async function salvarExplicacao(item: Item) {
    const texto = (rascunho[item.id] || '').trim()
    if (texto === (item.explicacao || '')) return

    setSalvando(item.id)
    const { error } = await supabase
      .from('inspecao_modelo_itens')
      .update({ explicacao: texto || null })
      .eq('id', item.id)
    setSalvando('')

    if (error) {
      setErro(error.message)
      return
    }

    setItens((l) => l.map((i) => (i.id === item.id ? { ...i, explicacao: texto || null } : i)))
    setAviso('Explicação salva.')
    setTimeout(() => setAviso(''), 2500)
  }

  async function enviarModelo(item: Item, arquivo: File | undefined) {
    if (!arquivo) return
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro('O modelo precisa ter no máximo 10 MB.')
      return
    }

    setEnviando(item.id)
    setErro('')

    const extensao = (arquivo.name.split('.').pop() || 'bin').toLowerCase()
    const caminho = `${escolhido}/${crypto.randomUUID()}.${extensao}`

    const { error: erroUp } = await supabase.storage
      .from('inspecao-modelos')
      .upload(caminho, arquivo, { contentType: arquivo.type || undefined })

    if (erroUp) {
      setEnviando('')
      setErro('Não foi possível enviar: ' + erroUp.message)
      return
    }

    /* O rótulo é o que o cliente lê no botão: "Baixar modelo de
     * programa" diz mais do que "Baixar anexo". Se ninguém escrever,
     * vale o nome do arquivo. */
    const rotulo = item.modelo_rotulo || 'modelo'

    const { error } = await supabase
      .from('inspecao_modelo_itens')
      .update({ modelo_arquivo: caminho, modelo_rotulo: rotulo })
      .eq('id', item.id)

    setEnviando('')

    if (error) {
      setErro(error.message)
      return
    }

    setItens((l) =>
      l.map((i) => (i.id === item.id ? { ...i, modelo_arquivo: caminho, modelo_rotulo: rotulo } : i))
    )
  }

  /* Gera a minuta em Word e já deixa pendurada no requisito.
   *
   * O documento sai como FORMULÁRIO, não preenchido: minuta pronta é a
   * forma mais rápida de produzir evidência falsa — a empresa assina um
   * papel que não descreve o que ela faz, e o auditor externo percebe
   * na primeira pergunta. O que entregamos é a estrutura certa. */
  async function gerarMinuta(item: Item) {
    setEnviando(item.id)
    setErro('')

    try {
      const modelo = modelos.find((m) => m.id === escolhido)
      const { blocos, rotulo } = minutaDoRequisito({
        requisito: item.requisito,
        norma: modelo?.norma || null,
        pergunta: item.pergunta,
        explicacao: item.explicacao || item.orientacao,
      })

      const arquivo = gerarDocx(blocos)
      const base = (item.requisito || String(item.ordem)).replace(/[^0-9a-zA-Z.]/g, '-')
      const caminho = `${escolhido}/${base}-${crypto.randomUUID().slice(0, 8)}.docx`

      const { error: erroUp } = await supabase.storage
        .from('inspecao-modelos')
        .upload(caminho, arquivo, {
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })

      if (erroUp) throw erroUp

      const { error } = await supabase
        .from('inspecao_modelo_itens')
        .update({ modelo_arquivo: caminho, modelo_rotulo: rotulo })
        .eq('id', item.id)

      if (error) throw error

      setItens((l) =>
        l.map((i) =>
          i.id === item.id ? { ...i, modelo_arquivo: caminho, modelo_rotulo: rotulo } : i
        )
      )
      setAviso('Minuta gerada.')
      setTimeout(() => setAviso(''), 2500)
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível gerar a minuta.')
    } finally {
      setEnviando('')
    }
  }

  /* Gera o que ainda não tem, de uma vez. Trinta requisitos, um a um,
   * ninguém faz. */
  async function gerarTudo() {
    const faltando = itens.filter((i) => !i.modelo_arquivo)
    if (faltando.length === 0) return
    if (!confirm(`Gerar a minuta de ${faltando.length} requisito(s) que ainda não têm?`)) return

    for (const item of faltando) {
      await gerarMinuta(item)
    }
  }

  async function tirarModelo(item: Item) {
    if (!item.modelo_arquivo) return
    if (!confirm('Tirar o modelo deste requisito? O cliente deixa de ver o botão de baixar.')) return

    const { error } = await supabase
      .from('inspecao_modelo_itens')
      .update({ modelo_arquivo: null })
      .eq('id', item.id)

    if (error) {
      setErro(error.message)
      return
    }

    /* O arquivo fica no balde de propósito: outra pergunta pode estar
     * apontando para ele, e apagar por engano custa mais do que o
     * espaço guardado. */
    setItens((l) => l.map((i) => (i.id === item.id ? { ...i, modelo_arquivo: null } : i)))
  }

  async function salvarRotulo(item: Item, rotulo: string) {
    const limpo = rotulo.trim()
    if (limpo === (item.modelo_rotulo || '')) return

    const { error } = await supabase
      .from('inspecao_modelo_itens')
      .update({ modelo_rotulo: limpo || null })
      .eq('id', item.id)

    if (error) {
      setErro(error.message)
      return
    }

    setItens((l) => l.map((i) => (i.id === item.id ? { ...i, modelo_rotulo: limpo || null } : i)))
  }

  async function abrirModelo(caminho: string) {
    const { data, error } = await supabase.storage
      .from('inspecao-modelos')
      .createSignedUrl(caminho, 300)

    if (error || !data?.signedUrl) {
      setErro('Não foi possível abrir o arquivo.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener')
  }

  if (!carregando && !interno) {
    return (
      <div className="app">
        <div className="banner">
          Esta bancada é da equipe Real Life: é daqui que saem as explicações e as minutas que o
          cliente baixa durante a auditoria.
        </div>
      </div>
    )
  }

  const comExplicacao = itens.filter((i) => (i.explicacao || '').trim()).length
  const comModelo = itens.filter((i) => i.modelo_arquivo).length

  return (
    <div className="app">
      <div>
        <p className="eyebrow">AUDITORIAS</p>
        <h1 className="titulo-tela">Modelos e explicações</h1>
        <p className="subtitulo-tela">
          O que pedir para ver em cada requisito, e a minuta que o cliente baixa para preencher.
          Enquanto o requisito não tiver arquivo, o botão de baixar não aparece para ele.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {aviso && <div className="banner good">{aviso}</div>}

      <div className="filters">
        <select value={escolhido} onChange={(e) => carregarItens(e.target.value)}>
          <option value="">Escolha o checklist…</option>
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
              {m.norma ? ' · ' + m.norma : ''}
            </option>
          ))}
        </select>
        {itens.length > 0 && (
          <>
            <span className="insp-contagem">
              {comExplicacao} de {itens.length} explicados · {comModelo} com modelo
            </span>
            {comModelo < itens.length && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!!enviando}
                onClick={gerarTudo}
              >
                {enviando ? 'Gerando…' : `Gerar as ${itens.length - comModelo} que faltam`}
              </button>
            )}
          </>
        )}
      </div>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : !escolhido ? (
        <p className="empty-state">Escolha um checklist para trabalhar nele.</p>
      ) : (
        <div>
          {secoes.map((secao) => (
            <div key={secao.titulo || 'sem-secao'}>
              {secao.titulo && <div className="insp-secao">{secao.titulo}</div>}
              {secao.itens.map((item) => (
                <div key={item.id} className="insp-item">
                  <div className="pergunta">
                    <span className="insp-requisito">{item.requisito || item.ordem}</span>
                    {item.pergunta}
                  </div>

                  <textarea
                    value={rascunho[item.id] ?? ''}
                    placeholder="O que pedir para ver: o documento, o registro, a pergunta a fazer"
                    onChange={(e) => setRascunho((d) => ({ ...d, [item.id]: e.target.value }))}
                    onBlur={() => salvarExplicacao(item)}
                    rows={2}
                  />
                  {salvando === item.id && <span className="insp-salvando">salvando…</span>}

                  <div className="insp-evidencia">
                    {item.modelo_arquivo ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => abrirModelo(item.modelo_arquivo!)}
                        >
                          {nomeDoArquivo(item.modelo_arquivo)}
                        </button>
                        <input
                          type="text"
                          defaultValue={item.modelo_rotulo || ''}
                          placeholder="Rótulo do botão (ex.: modelo de programa)"
                          onBlur={(e) => salvarRotulo(item, e.target.value)}
                          style={{ maxWidth: 260 }}
                        />
                        <button type="button" className="btn btn-sm" onClick={() => tirarModelo(item)}>
                          Tirar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={!!enviando}
                          onClick={() => gerarMinuta(item)}
                        >
                          {enviando === item.id ? 'Gerando…' : 'Gerar minuta em Word'}
                        </button>
                        <label className="btn btn-sm insp-add-arquivo">
                          Subir o meu
                          <input
                            type="file"
                            disabled={!!enviando}
                            onChange={(e) => {
                              enviarModelo(item, e.target.files?.[0])
                              e.target.value = ''
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
