'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import {
  agrupar,
  gerarBatEstrutura,
  PASTAS_FIXAS,
  type ItemDaNorma,
} from '@/lib/estruturaSgi'
import { gerarDocx, type Bloco } from '@/lib/word'
import '../../colaboradores/colaboradores.css'
import '../../inspecoes/inspecoes.css'
import './preparar.css'

/*
 * O passo antes do primeiro requisito.
 *
 * Auditoria trava quando a empresa sabe que tem o documento mas não
 * sabe onde. O tempo da auditoria vira tempo de procurar arquivo, e o
 * que não aparece em dez minutos vira constatação por falta de
 * evidência — mesmo quando a evidência existe.
 *
 * A ESTRUTURA SAI DO PRÓPRIO CHECKLIST: uma pasta por requisito, na
 * ordem da norma. Mudou a pergunta, muda a pasta. Lista escrita à mão
 * numa segunda lista é lista que desatualiza.
 */

type Modelo = { id: string; nome: string; norma: string | null }

function baixar(conteudo: Blob, nome: string) {
  const url = URL.createObjectURL(conteudo)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const PASSOS = [
  {
    titulo: 'Escolha onde vai morar',
    texto:
      'Um lugar só, que a equipe inteira acessa: SharePoint, OneDrive, Google Drive ou pasta de rede. Documento de sistema de gestão espalhado em computador pessoal não sobrevive à primeira troca de funcionário.',
  },
  {
    titulo: 'Crie a estrutura',
    texto:
      'Baixe o criador de pastas e clique duas vezes. Ele cria uma pasta por requisito da norma, com um LEIA-ME dentro dizendo o que guardar ali. Não apaga nada do que já existir.',
  },
  {
    titulo: 'Mova o que já existe',
    texto:
      'Não comece documento novo. Pegue o que a empresa já tem e ponha no requisito que ele responde. O vencido vai para 99 - Arquivo e legado, não para o lixo: o auditor pode querer ver o histórico.',
  },
  {
    titulo: 'Documento que serve a dois requisitos fica em um lugar só',
    texto:
      'A ata da análise crítica responde ao 9.3 e alimenta o 10.1. Deixe o arquivo em um, e no LEIA-ME do outro anote onde ele está. Cópia em duas pastas vira duas versões diferentes em três meses.',
  },
  {
    titulo: 'Olhe as pastas vazias',
    texto:
      'Pasta vazia é requisito sem evidência. Essa lista já é o seu plano de ação, antes de a auditoria começar.',
  },
]

function PrepararConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [escolhido, setEscolhido] = useState('')
  const [itens, setItens] = useState<ItemDaNorma[]>([])
  const [raiz, setRaiz] = useState('C:\\SGI')

  async function carregar() {
    try {
      const { data, error } = await supabase
        .from('inspecao_modelos')
        .select('id, nome, norma')
        .eq('tipo', 'auditoria')
        .is('empresa_id', null)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      const lista = (data || []) as unknown as Modelo[]
      setModelos(lista)
      if (lista.length) await carregarItens(lista[0].id)
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os checklists.')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarItens(modeloId: string) {
    setEscolhido(modeloId)
    const { data, error } = await supabase
      .from('inspecao_modelo_itens')
      .select('requisito, categoria, pergunta, orientacao, explicacao')
      .eq('modelo_id', modeloId)
      .eq('ativo', true)
      .order('ordem')

    if (error) {
      setErro(error.message)
      return
    }

    setItens(
      ((data || []) as any[])
        .filter((i) => i.requisito && i.categoria)
        .map((i) => ({
          requisito: i.requisito,
          categoria: i.categoria,
          pergunta: i.pergunta,
          orientacao: i.explicacao || i.orientacao,
        }))
    )
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grupos = useMemo(() => agrupar(itens), [itens])
  const modelo = modelos.find((m) => m.id === escolhido)
  const norma = modelo?.norma || modelo?.nome || 'norma'
  const total = PASTAS_FIXAS.length + grupos.length + itens.length

  function baixarBat() {
    baixar(
      new Blob([gerarBatEstrutura(raiz.trim() || 'C:\\SGI', norma, grupos)], {
        type: 'application/octet-stream',
      }),
      'criar-pastas-' + (norma.includes('45001') ? '45001' : '9001') + '.bat'
    )
  }

  function baixarGuia() {
    const blocos: Bloco[] = [
      { tipo: 'titulo', texto: 'Como organizar os documentos antes da auditoria' },
      { tipo: 'subtitulo', texto: norma + ' · guia da Real Life SSMA' },
      {
        tipo: 'texto',
        texto:
          'Uma pasta por requisito da norma, na ordem da norma. Quando o auditor pedir o 8.5.4, é um clique — e pasta vazia já diz qual requisito está sem evidência.',
      },
      { tipo: 'secao', texto: 'Como usar' },
      ...PASSOS.map((p): Bloco => ({ tipo: 'texto', texto: p.titulo + ' — ' + p.texto })),
    ]

    blocos.push({ tipo: 'secao', texto: 'Pastas que toda auditoria usa' })
    blocos.push({
      tipo: 'tabela',
      colunas: ['Pasta', 'O que guardar'],
      exemplos: PASTAS_FIXAS.map((f) => [f.nome, f.oque]),
      linhas: 0,
    })

    for (const g of grupos) {
      blocos.push({ tipo: 'secao', texto: g.pasta })
      blocos.push({
        tipo: 'tabela',
        colunas: ['Pasta', 'A evidência que responde a'],
        exemplos: g.itens.map((i) => [i.requisito, i.perguntas.join(" / ")]),
        linhas: 0,
      })
    }

    baixar(gerarDocx(blocos), 'guia-pastas-' + (norma.includes('45001') ? '45001' : '9001') + '.docx')
  }

  return (
    <div className="app">
      <div>
        <p className="eyebrow">AUDITORIAS</p>
        <h1 className="titulo-tela">Antes de começar</h1>
        <p className="subtitulo-tela">
          Uma pasta por requisito da norma, na ordem da norma. Quando o auditor pedir o 8.5.4, é um
          clique — e pasta vazia já diz qual requisito está sem evidência.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="panel">
        <div className="panel-body">
          <ol className="prep-passos">
            {PASSOS.map((p, i) => (
              <li key={p.titulo}>
                <span className="prep-num">{i + 1}</span>
                <div>
                  <strong>{p.titulo}</strong>
                  <div>{p.texto}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="filters">
        <select value={escolhido} onChange={(e) => carregarItens(e.target.value)}>
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.norma || m.nome}
            </option>
          ))}
        </select>
        <label className="prep-campo">
          Onde criar
          <input
            type="text"
            value={raiz}
            onChange={(e) => setRaiz(e.target.value)}
            placeholder="C:\SGI"
          />
        </label>
        <button type="button" className="btn btn-primary" disabled={!itens.length} onClick={baixarBat}>
          Baixar o criador de pastas
        </button>
        <button type="button" className="btn" disabled={!itens.length} onClick={baixarGuia}>
          Baixar o guia em Word
        </button>
      </div>

      <p className="prep-aviso">
        O criador é um arquivo <code>.bat</code>: salve, clique duas vezes e confirme. Cria{' '}
        {total} pastas e não apaga nada — rodar de novo mantém o que já existe. O nome da pasta é só
        o número do requisito; o que guardar nela está no LEIA-ME dentro dela.
      </p>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : (
        <>
          <div className="section-title" style={{ marginTop: 18 }}>
            A estrutura — {norma}
          </div>

          <div className="prep-arvore">
            {PASTAS_FIXAS.slice(0, 1).map((f) => (
              <div key={f.nome} className="prep-pasta nivel-0">
                <div className="prep-linha">
                  <span className="prep-nome">{f.nome}</span>
                </div>
                <div className="prep-oque">{f.oque}</div>
              </div>
            ))}

            {grupos.map((g) => (
              <div key={g.pasta} className="prep-pasta nivel-0">
                <div className="prep-linha">
                  <span className="prep-nome">{g.pasta}</span>
                  <span className="prep-req">{g.itens.length} requisitos</span>
                </div>
                {g.itens.map((i) => (
                  <div key={i.requisito} className="prep-pasta nivel-1">
                    <div className="prep-linha">
                      <span className="prep-nome">{i.requisito}</span>
                    </div>
                    <div className="prep-oque">{i.perguntas.join(" · ")}</div>
                  </div>
                ))}
              </div>
            ))}

            {PASTAS_FIXAS.slice(1).map((f) => (
              <div key={f.nome} className="prep-pasta nivel-0">
                <div className="prep-linha">
                  <span className="prep-nome">{f.nome}</span>
                </div>
                <div className="prep-oque">{f.oque}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ marginTop: 18 }}>
            <div className="panel-body">
              <div className="section-title">Organizou? Então comece</div>
              <p style={{ margin: '6px 0 12px', color: 'var(--ink-muted)', fontSize: 14 }}>
                As pastas que ficaram vazias já são a sua lista do que falta.
              </p>
              <Link href="/auditorias" className="btn btn-primary">
                Ir para as auditorias
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function PrepararAuditoria() {
  return (
    <ComModulo modulo="auditoria">
      <PrepararConteudo />
    </ComModulo>
  )
}
