'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ComModulo } from '@/components/ModuloBloqueado'
import { ESTRUTURA_SGI, gerarBatEstrutura, type Pasta } from '@/lib/estruturaSgi'
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
 * Por isso esta tela vem ANTES na ordem do menu: organizar não é
 * burocracia, é o que faz a auditoria durar um dia em vez de uma
 * semana.
 */

function baixar(conteudo: Blob, nome: string) {
  const url = URL.createObjectURL(conteudo)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function blocosDoGuia(): Bloco[] {
  const blocos: Bloco[] = [
    { tipo: 'titulo', texto: 'Como organizar os documentos antes da auditoria' },
    { tipo: 'subtitulo', texto: 'Guia da Real Life SSMA · ISO 45001 e ISO 9001' },
    {
      tipo: 'texto',
      texto:
        'Auditoria trava quando a empresa sabe que tem o documento mas não sabe onde. O que não é encontrado em dez minutos vira constatação por falta de evidência, mesmo quando a evidência existe. Organizar antes é o que faz a auditoria durar um dia em vez de uma semana.',
    },
    { tipo: 'secao', texto: 'Quatro regras que resolvem a maior parte' },
    {
      tipo: 'texto',
      texto:
        '1. Uma pasta por assunto, e o assunto é o requisito da norma — não o mês nem o nome de quem fez.',
    },
    {
      tipo: 'texto',
      texto:
        '2. A versão vigente fica na pasta; a antiga vai para 99 - Arquivo e legado. Duas versões no mesmo lugar é o jeito mais rápido de o auditor achar a errada.',
    },
    {
      tipo: 'texto',
      texto:
        '3. O nome do arquivo começa pela data no formato AAAA-MM-DD. Assim ele se ordena sozinho e ninguém discute qual é o mais recente.',
    },
    {
      tipo: 'texto',
      texto:
        '4. Documento de saúde fica em pasta com acesso restrito. Isso não é organização: é obrigação legal, e o auditor confere quem tem acesso.',
    },
    { tipo: 'secao', texto: 'A estrutura' },
    {
      tipo: 'texto',
      texto:
        'Esta é a estrutura que a Real Life usa no sistema de gestão de um cliente real. Cada pasta indica os requisitos da norma que costumam ser respondidos com o que mora nela.',
    },
  ]

  for (const p of ESTRUTURA_SGI) {
    blocos.push({ tipo: 'secao', texto: p.nome })
    blocos.push({ tipo: 'texto', texto: p.oque })
    if (p.filhas?.length) {
      blocos.push({
        tipo: 'tabela',
        colunas: ['Subpasta', 'O que guardar', 'Requisitos'],
        exemplos: p.filhas.map((f) => [f.nome, f.oque, (f.requisitos || []).join(', ')]),
        linhas: 0,
      })
    }
  }

  blocos.push(
    { tipo: 'secao', texto: 'Depois de organizar' },
    {
      tipo: 'texto',
      texto:
        'Abra a auditoria no portal. Em cada requisito você verá o que precisa ser mostrado, poderá baixar a minuta quando houver e enviar a evidência direto do item. O auditor responde na própria pergunta, e fica tudo registrado.',
    },
    {
      tipo: 'nota',
      texto:
        'Guia fornecido pela Real Life SSMA. A estrutura é um ponto de partida: adapte os nomes à realidade da sua empresa, mas mantenha a lógica de uma pasta por assunto e o arquivo obsoleto fora do caminho.',
    }
  )

  return blocos
}

const PASSOS = [
  {
    titulo: 'Escolha onde vai morar',
    texto:
      'Um lugar só, que a equipe inteira acessa: SharePoint, OneDrive, Google Drive ou uma pasta de rede. Documento de sistema de gestão espalhado em computador pessoal não sobrevive à primeira troca de funcionário.',
  },
  {
    titulo: 'Crie a estrutura',
    texto:
      'Baixe o criador de pastas abaixo e clique duas vezes nele dentro da pasta escolhida. Ele cria tudo de uma vez e não apaga nada do que já existir.',
  },
  {
    titulo: 'Mova o que já existe',
    texto:
      'Não comece documento novo. Pegue o que a empresa já tem e coloque no lugar certo. O que estiver vencido ou duplicado vai para 99 - Arquivo e legado, não para o lixo: o auditor pode querer ver o histórico.',
  },
  {
    titulo: 'Anote o que falta',
    texto:
      'Pasta que ficou vazia é um requisito sem evidência. Essa lista já é o seu plano de ação, antes mesmo de a auditoria começar.',
  },
  {
    titulo: 'Aí sim, abra a auditoria',
    texto:
      'Com a estrutura montada, responder requisito a requisito vira conferência, não caça ao tesouro.',
  },
]

function Ramo({ p, nivel }: { p: Pasta; nivel: number }) {
  return (
    <div className={'prep-pasta nivel-' + nivel}>
      <div className="prep-linha">
        <span className="prep-nome">{p.nome}</span>
        {(p.requisitos || []).map((r) => (
          <span key={r} className="prep-req">
            {r}
          </span>
        ))}
      </div>
      <div className="prep-oque">{p.oque}</div>
      {p.filhas?.map((f) => (
        <Ramo key={f.nome} p={f} nivel={nivel + 1} />
      ))}
    </div>
  )
}

function PrepararConteudo() {
  const [raiz, setRaiz] = useState('C:\\SGI')

  function baixarBat() {
    const texto = gerarBatEstrutura(raiz.trim() || 'C:\\SGI')
    /* Sem BOM: o cmd engasga com BOM mesmo com chcp 65001. */
    baixar(new Blob([texto], { type: 'application/octet-stream' }), 'criar-estrutura-sgi.bat')
  }

  function baixarGuia() {
    baixar(gerarDocx(blocosDoGuia()), 'guia-organizacao-sgi.docx')
  }

  const totalPastas = ESTRUTURA_SGI.reduce((s, p) => s + 1 + (p.filhas?.length || 0), 0)

  return (
    <div className="app">
      <div>
        <p className="eyebrow">AUDITORIAS</p>
        <h1 className="titulo-tela">Antes de começar</h1>
        <p className="subtitulo-tela">
          Auditoria trava quando a empresa sabe que tem o documento mas não sabe onde. O que não
          aparece em dez minutos vira constatação por falta de evidência — mesmo quando a evidência
          existe. Organize primeiro; responder depois vira conferência.
        </p>
      </div>

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
        <label className="prep-campo">
          Onde criar
          <input
            type="text"
            value={raiz}
            onChange={(e) => setRaiz(e.target.value)}
            placeholder="C:\SGI"
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={baixarBat}>
          Baixar o criador de pastas
        </button>
        <button type="button" className="btn" onClick={baixarGuia}>
          Baixar o guia em Word
        </button>
      </div>

      <p className="prep-aviso">
        O criador é um arquivo <code>.bat</code>: salve, clique duas vezes e confirme. Ele cria{' '}
        {totalPastas} pastas e não apaga nada — rodar de novo mantém o que já existe. Se preferir,
        crie à mão pela lista abaixo.
      </p>

      <div className="section-title" style={{ marginTop: 18 }}>
        A estrutura, e o requisito que cada pasta responde
      </div>

      <div className="prep-arvore">
        {ESTRUTURA_SGI.map((p) => (
          <Ramo key={p.nome} p={p} nivel={0} />
        ))}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-body">
          <div className="section-title">Organizou? Então comece</div>
          <p style={{ margin: '6px 0 12px', color: 'var(--ink-muted)', fontSize: 14 }}>
            Pasta que ficou vazia já é a sua lista do que falta — e isso vale um plano de ação antes
            mesmo da primeira pergunta.
          </p>
          <Link href="/auditorias" className="btn btn-primary">
            Ir para as auditorias
          </Link>
        </div>
      </div>
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
