'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useModulos } from '@/lib/modulos'
import { PREFIXO_ORCAMENTO } from '@/lib/servicos'
import { dataBr, diasAteData } from '@/lib/documentosSst'
import Icone from '@/components/Icone'
import './cursos-ead.css'

/*
 * Serviços e laudos/programas do site, dentro da tela Contratar.
 *
 * O QUE ISTO SUBSTITUI. Uma linha: "Laudos e programas — PGR, PCMSO,
 * LTCAT e outros laudos técnicos". O site lista mais de cem documentos
 * e dezoito áreas de serviço; o cliente logado, que é quem mais compra
 * de novo, só via "e outros".
 *
 * A LISTA NÃO MORA AQUI. Vem de /api/catalogo-servicos, que lê do site.
 * O texto técnico tem um dono só. O portal mostra a primeira frase; o
 * texto completo está no "Conhecer", que abre a página do site.
 *
 * O QUE O SITE NÃO TEM: o cruzamento com Documentos SST. Se a empresa
 * já tem aquele documento cadastrado, a linha diz "Sua empresa já tem",
 * com o próximo prazo, e o botão vira renovação em vez de orçamento.
 */

type ServicoSite = { slug: string; nome: string; resumo: string; url: string }

type DocumentoSite = {
  slug: string
  sigla: string
  nome: string
  norma: string
  area: string
  areaNome: string
  resumo: string
  url: string
}

type Catalogo = {
  fora: boolean
  ordemAreas: string[]
  servicos: ServicoSite[]
  documentos: DocumentoSite[]
}

/* O que a empresa já tem em Documentos SST, por tipo. */
type JaTem = { prazo: string | null; semVencimento: boolean }

const PRIMEIROS = 12

/*
 * Em que fila o pedido cai. A área do chamado é a categoria: Saúde
 * Ocupacional vai para quem cuida de PCMSO e exames; laudos e programas
 * vão para Documentos, como já iam pela linha antiga; serviços de
 * consultoria vão para Segurança do Trabalho.
 */
const AREA_SAUDE = 'saude-e-medicina-ocupacional'

function categoriaDoDocumento(d: DocumentoSite) {
  return d.area === AREA_SAUDE ? 'Saúde Ocupacional' : 'Documentos'
}

function categoriaDoServico(s: ServicoSite) {
  return s.slug === AREA_SAUDE ? 'Saúde Ocupacional' : 'Segurança do Trabalho'
}

/* Sem acento, minúsculo, sem pontuação: "NR-10" casa com "nr 10". */
function normal(t: string | null | undefined) {
  return (t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/* A primeira frase do resumo do site. O resto está no "Conhecer". */
function primeiraFrase(t: string) {
  const fim = t.search(/[.!?](\s|$)/)
  return fim === -1 ? t : t.slice(0, fim + 1)
}

function linkOrcamento(titulo: string, categoria: string, url: string) {
  const q = new URLSearchParams({
    categoria,
    assunto: PREFIXO_ORCAMENTO + titulo,
    descricao:
      'Gostaríamos de um orçamento de: ' +
      titulo +
      '.\n' +
      'Referência: ' +
      url +
      '\n\nUnidade(s) ou endereço: \nQuantidade aproximada (trabalhadores, unidades ou equipamentos): \nPrazo desejado: \nMelhor contato para a proposta: ',
  })
  return '/chamados/novo?' + q.toString()
}

function linkRenovacao(d: DocumentoSite, jaTem: JaTem) {
  const titulo = d.sigla && d.sigla !== d.nome ? `${d.sigla} — ${d.nome}` : d.nome
  const prazo = jaTem.prazo ? ` O prazo atual é ${dataBr(jaTem.prazo)}.` : ''
  const q = new URLSearchParams({
    categoria: categoriaDoDocumento(d),
    assunto: PREFIXO_ORCAMENTO + 'Revisão/renovação de ' + titulo,
    descricao:
      `Gostaríamos de um orçamento para revisar/renovar o documento: ${titulo}.${prazo}\n\n` +
      'Houve mudança de processo, função, equipamento ou endereço desde a última versão? \nPrazo desejado: \nMelhor contato para a proposta: ',
  })
  return '/chamados/novo?' + q.toString()
}

export default function CatalogoServicos() {
  const modulos = useModulos()
  const [dados, setDados] = useState<Catalogo | null>(null)
  const [erro, setErro] = useState(false)
  const [aba, setAba] = useState<'documentos' | 'servicos'>('documentos')
  const [busca, setBusca] = useState('')
  const [area, setArea] = useState('')
  const [todos, setTodos] = useState(false)
  /* Chave: sigla ou nome normalizado do tipo em Documentos SST. */
  const [jaTem, setJaTem] = useState<Map<string, JaTem>>(new Map())

  useEffect(() => {
    let ativo = true

    fetch('/api/catalogo-servicos')
      .then((r) => r.json())
      .then((d: Catalogo) => {
        if (ativo) setDados(d)
      })
      .catch(() => {
        if (ativo) setErro(true)
      })

    /*
     * O que a empresa já tem. Se a tabela não existir, a pessoa não for
     * de uma empresa ou o banco recusar, o catálogo aparece do mesmo
     * jeito, só sem o selo "Sua empresa já tem".
     */
    async function carregarDocumentos() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: perfil } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).maybeSingle()
        if (!perfil?.empresa_id) return

        const [{ data: tipos }, { data: docs }] = await Promise.all([
          supabase.from('documentos_sst_tipos').select('id, nome, sigla'),
          supabase
            .from('documentos_sst')
            .select('tipo_id, vencimento, proxima_revisao, sem_vencimento, situacao')
            .eq('empresa_id', perfil.empresa_id)
            .eq('situacao', 'vigente'),
        ])
        if (!tipos || !docs) return

        const porTipo = new Map(tipos.map((t) => [t.id as string, t as { nome: string; sigla: string | null }]))
        const mapa = new Map<string, JaTem>()

        for (const d of docs) {
          const t = porTipo.get(d.tipo_id as string)
          if (!t) continue
          /* O prazo que vem primeiro: vencimento ou próxima revisão. */
          const prazos = [d.vencimento, d.proxima_revisao].filter(Boolean).sort() as string[]
          const item: JaTem = { prazo: prazos[0] || null, semVencimento: Boolean(d.sem_vencimento) }
          for (const chave of [normal(t.sigla), normal(t.nome)]) {
            if (!chave) continue
            const atual = mapa.get(chave)
            if (!atual || (item.prazo && (!atual.prazo || item.prazo < atual.prazo))) mapa.set(chave, item)
          }
        }

        if (ativo) setJaTem(mapa)
      } catch (e) {
        console.error('Erro ao cruzar o catálogo com Documentos SST:', e)
      }
    }

    carregarDocumentos()

    return () => {
      ativo = false
    }
  }, [])

  const documentos = dados?.documentos || []
  const servicos = dados?.servicos || []

  function jaTemDocumento(d: DocumentoSite) {
    return jaTem.get(normal(d.sigla)) || jaTem.get(normal(d.nome)) || null
  }

  /* As áreas que têm documento, na ordem do site, com a contagem. */
  const areas = useMemo(() => {
    const conta = new Map<string, { nome: string; n: number }>()
    for (const d of documentos) {
      const atual = conta.get(d.area) || { nome: d.areaNome, n: 0 }
      atual.n++
      conta.set(d.area, atual)
    }
    const ordem = dados?.ordemAreas || []
    const pos = (a: string) => (ordem.indexOf(a) === -1 ? 999 : ordem.indexOf(a))
    return [...conta.entries()].sort((a, b) => pos(a[0]) - pos(b[0]))
  }, [documentos, dados])

  const termo = normal(busca)

  const documentosFiltrados = useMemo(() => {
    const lista = documentos.filter((d) => {
      if (area && d.area !== area) return false
      if (!termo) return true
      return normal([d.sigla, d.nome, d.norma, d.areaNome, d.resumo].join(' ')).includes(termo)
    })
    /* O que a empresa já tem sobe para o topo: é a renovação, a venda
       mais provável. */
    return lista.sort((a, b) => Number(Boolean(jaTemDocumento(b))) - Number(Boolean(jaTemDocumento(a))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentos, area, termo, jaTem])

  const servicosFiltrados = useMemo(
    () => servicos.filter((s) => !termo || normal(s.nome + ' ' + s.resumo).includes(termo)),
    [servicos, termo]
  )

  /*
   * SEM CATÁLOGO, a linha de sempre. O site fora do ar não pode esconder
   * o caminho do orçamento.
   */
  if (erro || dados?.fora) {
    return (
      <div className="panel contratar-lista">
        <div className="contratar-item">
          <span className="icone-servico">
            <Icone nome="prancheta" tamanho={24} />
          </span>
          <span className="texto">
            <strong>Laudos, programas e serviços técnicos</strong>
            <span>PGR, PCMSO, LTCAT, laudos de insalubridade e periculosidade, NR-10, NR-12 e outros.</span>
          </span>
          <a
            href={
              '/chamados/novo?' +
              new URLSearchParams({
                categoria: 'Documentos',
                assunto: PREFIXO_ORCAMENTO + 'Laudos, programas e serviços técnicos',
                descricao:
                  'Gostaríamos de um orçamento.\n\nQuais documentos ou serviços: \nUnidade(s) ou endereço: \nPrazo desejado: ',
              }).toString()
            }
            className="btn btn-sm btn-primary"
          >
            Pedir orçamento
          </a>
        </div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="panel">
        <div className="empty-state">Carregando os serviços…</div>
      </div>
    )
  }

  const lista = aba === 'documentos' ? documentosFiltrados : servicosFiltrados
  const visiveis = todos ? lista : lista.slice(0, PRIMEIROS)
  const quantosJaTem = documentos.filter((d) => jaTemDocumento(d)).length

  return (
    <div className="cursos-ead">
      <p className="cursos-ead-abre">
        {documentos.length} laudos, programas e relatórios técnicos e {servicos.length} áreas de serviço, emitidos com
        responsabilidade técnica. Peça o orçamento aqui mesmo: vira um chamado, com prazo de resposta.
        {quantosJaTem > 0 &&
          ` ${quantosJaTem === 1 ? 'Um deles sua empresa já tem' : quantosJaTem + ' deles sua empresa já tem'} em Documentos SST — aparecem primeiro, com o prazo.`}
      </p>

      <div className="panel cursos-ead-filtros nao-imprimir">
        <div className="cursos-ead-grupos" role="tablist" aria-label="Tipo de item">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'documentos'}
            className={'cursos-ead-chip' + (aba === 'documentos' ? ' sel' : '')}
            onClick={() => {
              setAba('documentos')
              setTodos(false)
            }}
          >
            Laudos e programas · {documentos.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'servicos'}
            className={'cursos-ead-chip' + (aba === 'servicos' ? ' sel' : '')}
            onClick={() => {
              setAba('servicos')
              setTodos(false)
            }}
          >
            Serviços · {servicos.length}
          </button>
        </div>

        <label className="cursos-ead-busca">
          <span className="cursos-ead-oculto">Buscar</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setTodos(false)
            }}
            placeholder={
              aba === 'documentos'
                ? 'Buscar por sigla, nome ou norma — ex.: PGR, LTCAT, NR 10'
                : 'Buscar serviço — ex.: elétrica, incêndio, ISO'
            }
          />
        </label>

        {aba === 'documentos' && areas.length > 1 && (
          <div className="cursos-ead-grupos">
            <button
              type="button"
              className={'cursos-ead-chip' + (area === '' ? ' sel' : '')}
              onClick={() => setArea('')}
            >
              Todas as áreas
            </button>
            {areas.map(([a, info]) => (
              <button
                key={a || 'outros'}
                type="button"
                className={'cursos-ead-chip' + (area === a ? ' sel' : '')}
                onClick={() => {
                  setArea(a === area ? '' : a)
                  setTodos(false)
                }}
              >
                {info.nome} · {info.n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel contratar-lista">
        {lista.length === 0 ? (
          <div className="empty-state">
            Nada com esse termo. Tente a sigla ou o número da NR — ou peça mesmo assim: descreva a necessidade
            num chamado.
          </div>
        ) : aba === 'documentos' ? (
          (visiveis as DocumentoSite[]).map((d) => {
            const tem = jaTemDocumento(d)
            const dias = tem?.prazo ? diasAteData(tem.prazo) : null
            const titulo = d.sigla && d.sigla !== d.nome ? `${d.sigla} — ${d.nome}` : d.nome

            return (
              <div key={d.slug} className="contratar-item">
                <span className="icone-servico">
                  <Icone nome="prancheta" tamanho={22} />
                </span>
                <span className="texto">
                  <strong>
                    {titulo}
                    {d.norma && (
                      <span className="pill flat" style={{ marginLeft: 8, display: 'inline-block' }}>
                        {d.norma}
                      </span>
                    )}
                  </strong>
                  <span>{primeiraFrase(d.resumo)}</span>
                  {tem && (
                    <span style={{ marginTop: 4 }}>
                      <span className={'pill ' + (dias !== null && dias < 0 ? 'bad' : dias !== null && dias <= 60 ? 'warn' : 'good')}>
                        Sua empresa já tem
                        {tem.prazo
                          ? dias !== null && dias < 0
                            ? ` · prazo vencido em ${dataBr(tem.prazo)}`
                            : ` · próximo prazo ${dataBr(tem.prazo)}`
                          : tem.semVencimento
                            ? ' · sem vencimento'
                            : ''}
                      </span>
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tem && modulos.liberado('documentos') ? (
                    <Link href="/documentos" className="btn btn-sm btn-primary">
                      Ver em Documentos SST
                    </Link>
                  ) : (
                    <a
                      href={tem ? linkRenovacao(d, tem) : linkOrcamento(titulo, categoriaDoDocumento(d), d.url)}
                      className="btn btn-sm btn-primary"
                    >
                      {tem ? 'Pedir renovação' : 'Pedir orçamento'}
                    </a>
                  )}
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost">
                    Conhecer
                  </a>
                </span>
              </div>
            )
          })
        ) : (
          (visiveis as ServicoSite[]).map((s) => (
            <div key={s.slug} className="contratar-item">
              <span className="icone-servico">
                <Icone nome="documentos" tamanho={22} />
              </span>
              <span className="texto">
                <strong>{s.nome}</strong>
                <span>{s.resumo}</span>
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <a href={linkOrcamento(s.nome, categoriaDoServico(s), s.url)} className="btn btn-sm btn-primary">
                  Pedir orçamento
                </a>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost">
                  Conhecer
                </a>
              </span>
            </div>
          ))
        )}

        {lista.length > PRIMEIROS && (
          <div className="cursos-ead-rodape" style={{ padding: '12px 18px' }}>
            <span>
              {visiveis.length} de {lista.length}
            </span>
            <button type="button" className="btn btn-sm" onClick={() => setTodos((v) => !v)}>
              {todos ? 'Mostrar menos' : 'Ver todos'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
