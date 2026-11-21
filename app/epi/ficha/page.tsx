'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarCpf } from '@/lib/historicoCertificados'
import { TERMO_ENTREGA_EPI } from '@/lib/epiTermo'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import './ficha.css'

/*
 * Ficha de controle de entrega de EPI (NR-06, item 6.6.1).
 *
 * É o papel que a fiscalização pede e o que a empresa apresenta numa
 * reclamatória: uma folha por trabalhador, com tudo que ele recebeu, o
 * CA de cada equipamento, o prazo de troca e quando assinou.
 *
 * A tela mostra a ficha já no formato impresso; "Imprimir" abre a caixa
 * do navegador, que também salva em PDF. Uma ficha por página.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const MOTIVOS: Record<string, string> = {
  entrega: 'Entrega',
  substituicao: 'Substituição',
  desgaste: 'Desgaste',
  dano: 'Dano',
  perda: 'Perda',
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null; cnpj?: string | null }
type Colaborador = {
  id: string
  empresa_id: string
  nome: string
  nome_chave?: string | null
  cpf: string | null
  matricula: string | null
  funcao: string | null
  local_trabalho: string | null
  local_id: string | null
  locais_trabalho?: { nome: string } | { nome: string }[] | null
  admissao: string | null
}
type Item = {
  nome: string
  ca: string | null
  complemento: string | null
  quantidade: number
  motivo: string
  troca_em: string
  devolvido_em: string | null
  devolucao_motivo: string | null
  validade_ca: string | null
  descricao: string | null
}

/* Por que o equipamento voltou — a coluna Devolução da ficha. Sem ela a
 * ficha afirma que o trabalhador está com tudo que já recebeu na vida. */
const MOTIVOS_DEVOLUCAO: Record<string, string> = {
  devolucao: 'devolvido',
  troca: 'trocado',
  fim_vida_util: 'fim da vida útil',
  dano: 'danificado',
  perda: 'perdido',
  desligamento: 'desligamento',
}
type Entrega = {
  id: string
  colaborador_id: string
  empresa_id: string
  entregue_em: string
  assinado_em: string | null
  assinatura_imagem: string | null
  assinatura_hash: string | null
  cancelada_em: string | null
  entregue_por_nome: string | null
  /* A função do dia da entrega (supabase/epi-por-funcao.sql). Nas
   * entregas antigas pode vir vazia. */
  funcao: string | null
  foto_path: string
  epi_entregas_itens: Item[]
}

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')

/* O local vem do cadastro novo quando existe, e cai para o texto antigo
 * de quem ainda não foi ligado a um local. O PostgREST devolve a relação
 * ora como objeto, ora como lista de um — por isso os dois caminhos. */
function nomeDoLocal(p: Colaborador): string {
  const rel = Array.isArray(p.locais_trabalho) ? p.locais_trabalho[0] : p.locais_trabalho
  return rel?.nome || p.local_trabalho || '—'
}
const dataHoraBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
/* Datas curtas, como na ficha impressa: 17/02/26 e 17/02/26 12:41:55. */
const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const dataHoraCurta = (iso: string) =>
  `${dataCurta(iso)} ${new Date(iso).toLocaleTimeString('pt-BR', { hour12: false })}`

const hoje = () => new Date().toLocaleDateString('pt-BR')

export default function FichaEpi() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [fotos, setFotos] = useState<Record<string, string>>({})
  /* Links assinados do traço de cada assinatura, como os das fotos. */
  const [assinaturas, setAssinaturas] = useState<Record<string, string>>({})

  const [empresaFiltro, setEmpresaFiltro] = useState('')
  /* Quem veio marcado da tela de Pessoas, pelo endereço. Lido do
   * window em vez de useSearchParams para a página não precisar de
   * Suspense só por causa disso. */
  const [escolhidas, setEscolhidas] = useState<string[]>([])

  const [comFoto, setComFoto] = useState(false)

  /*
   * A tela abre na LISTA de trabalhadores, e a ficha é montada só para
   * quem foi escolhido — é a ordem do OnSafety (escolhe o pessoal e o
   * período, clica em emitir). Montar todas as fichas de uma empresa de
   * 900 pessoas de uma vez, como era antes, trava o navegador, e quase
   * sempre quem entra aqui quer a ficha de uma pessoa só.
   */
  const [modo, setModo] = useState<'lista' | 'ficha'>('lista')
  const [marcados, setMarcados] = useState<string[]>([])
  const [local, setLocal] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  /* Quem saiu da empresa continua tendo ficha — ela é o documento que
   * prova a entrega numa reclamatória depois do desligamento. Mas fica
   * fora da lista do dia a dia. */
  const [comDesligados, setComDesligados] = useState(false)
  const [desligados, setDesligados] = useState<Set<string>>(new Set())

  useEffect(() => {
    const lista = new URLSearchParams(window.location.search).get('pessoas')
    if (lista) {
      const ids = lista.split(',').filter(Boolean)
      setEscolhidas(ids)
      /* Veio de Colaboradores com gente marcada: já abre a ficha. */
      setMarcados(ids)
      setModo('ficha')
    }
  }, [])

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

      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()
      if (perfilError) throw perfilError

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

      const { data: emps } = await supabase
        .from('empresas')
        .select('id, razao_social, nome_fantasia, cnpj')
        .order('razao_social')
      setEmpresas((emps || []) as Empresa[])

      const [{ data: cols }, { data: ents, error: erroEnt }, { data: fora }] = await Promise.all([
        supabase
          .from('colaboradores')
          .select(
            'id, empresa_id, nome, nome_chave, cpf, matricula, funcao, local_trabalho, local_id, admissao, locais_trabalho(nome)'
          )
          .order('nome'),
        supabase
          .from('epi_entregas')
          .select(
            'id, colaborador_id, empresa_id, entregue_em, assinado_em, cancelada_em, funcao, ' +
              'entregue_por_nome, foto_path, assinatura_imagem, assinatura_hash, ' +
              'epi_entregas_itens(nome, ca, complemento, quantidade, motivo, troca_em, ' +
              'devolvido_em, devolucao_motivo, validade_ca, descricao)'
          )
          .is('cancelada_em', null)
          .order('entregue_em'),
        /* Mesma fonte que Colaboradores e o painel leem, para não haver
         * duas respostas sobre quem está desligado. */
        supabase.from('colaboradores_desligados').select('empresa_id, nome_chave').is('reativado_em', null),
      ])

      if (erroEnt) {
        if (erroEnt.code === '42P01' || /does not exist|schema cache/i.test(erroEnt.message || '')) {
          setSemTabela(true)
          return
        }
        throw erroEnt
      }

      setColaboradores((cols || []) as Colaborador[])
      setEntregas((ents || []) as unknown as Entrega[])
      setDesligados(new Set(((fora || []) as any[]).map((d) => `${d.empresa_id}|${d.nome_chave}`)))
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar a ficha.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

  const pessoas = useMemo(
    () => colaboradores.filter((c) => !empresaAtual || c.empresa_id === empresaAtual),
    [colaboradores, empresaAtual]
  )

  /* O período filtra a DATA DA ENTREGA, como no OnSafety: a ficha sai
   * com o que foi entregue naquele intervalo. Vazio = tudo. */
  const entregasNoPeriodo = useMemo(
    () =>
      entregas.filter((e) => {
        const dia = e.entregue_em.slice(0, 10)
        if (de && dia < de) return false
        if (ate && dia > ate) return false
        return true
      }),
    [entregas, de, ate]
  )

  const hojeIso = new Date().toISOString().slice(0, 10)

  /* Uma linha por trabalhador que tem entrega no período. */
  const linhas = useMemo(() => {
    const porPessoa = new Map<string, Entrega[]>()
    for (const e of entregasNoPeriodo) {
      porPessoa.set(e.colaborador_id, [...(porPessoa.get(e.colaborador_id) || []), e])
    }

    const texto = busca.trim().toLowerCase()

    return pessoas
      .filter((c) => porPessoa.has(c.id))
      .filter((c) => !local || nomeDoLocal(c) === local)
      .filter((c) => comDesligados || !desligados.has(`${c.empresa_id}|${c.nome_chave || ''}`))
      .filter(
        (c) =>
          !texto ||
          c.nome.toLowerCase().includes(texto) ||
          (c.matricula || '').toLowerCase().includes(texto)
      )
      .map((c) => {
        const suas = porPessoa.get(c.id) || []
        const ultima = suas[suas.length - 1]
        const itens = suas.flatMap((e) => e.epi_entregas_itens || [])
        return {
          pessoa: c,
          entregas: suas,
          ultima: ultima?.entregue_em || '',
          /* A função do dia da última entrega, que é a que vai na ficha. */
          funcao: [...suas].reverse().map((e) => e.funcao).find((f) => f && f.trim()) || c.funcao || '',
          semAssinatura: suas.filter((e) => !e.assinado_em).length,
          vencidos: itens.filter((i) => !i.devolvido_em && i.troca_em < hojeIso).length,
          desligado: desligados.has(`${c.empresa_id}|${c.nome_chave || ''}`),
        }
      })
  }, [pessoas, entregasNoPeriodo, local, busca, comDesligados, desligados, hojeIso])

  const locais = useMemo(
    () => [...new Set(pessoas.map((c) => nomeDoLocal(c)).filter((n) => n && n !== '—'))].sort(),
    [pessoas]
  )

  /* Quem entra na emissão: os marcados na lista. */
  const fichas = useMemo(() => {
    if (!marcados.length) return []
    return pessoas
      .filter((c) => marcados.includes(c.id))
      .map((c) => ({
        pessoa: c,
        linhas: entregasNoPeriodo.filter((e) => e.colaborador_id === c.id),
      }))
      .filter((f) => f.linhas.length > 0)
  }, [pessoas, entregasNoPeriodo, marcados])

  function emitir(ids: string[]) {
    if (!ids.length) return
    setMarcados(ids)
    setModo('ficha')
    window.scrollTo(0, 0)
  }

  /* As fotos ficam num balde privado: cada uma precisa de link assinado. */
  useEffect(() => {
    let vivo = true

    async function assinar() {
      if (!comFoto) return
      const caminhos = fichas.flatMap((f) => f.linhas.map((l) => l.foto_path)).filter(Boolean)
      const faltando = [...new Set(caminhos)].filter((c) => !fotos[c])
      if (!faltando.length) return

      const { data } = await supabase.storage.from('epi-fotos').createSignedUrls(faltando, 3600)
      if (!vivo || !data) return
      const novas: Record<string, string> = {}
      for (const d of data) if (d.path && d.signedUrl) novas[d.path] = d.signedUrl
      setFotos((atual) => ({ ...atual, ...novas }))
    }

    /* O traço da assinatura sempre entra: ele é parte do documento,
       não um extra como a foto. */
    async function tracos() {
      const caminhos = fichas
        .flatMap((f) => f.linhas.map((l) => l.assinatura_imagem))
        .filter((c): c is string => Boolean(c))
      const faltando = [...new Set(caminhos)].filter((c) => !assinaturas[c])
      if (!faltando.length) return

      const { data } = await supabase.storage.from('epi-fotos').createSignedUrls(faltando, 3600)
      if (!vivo || !data) return
      const novas: Record<string, string> = {}
      for (const d of data) if (d.path && d.signedUrl) novas[d.path] = d.signedUrl
      setAssinaturas((atual) => ({ ...atual, ...novas }))
    }

    tracos()

    assinar()
    return () => {
      vivo = false
    }
  }, [fichas, comFoto, fotos])

  const empresa = empresas.find((e) => e.id === empresaAtual)

  /* No cabeçalho vai a razão social, não o nome de fantasia: a ficha é
     documento, e é a razão social que casa com o CNPJ ao lado. */
  const nomeEmpregador = () => empresa?.razao_social || empresa?.nome_fantasia || ''

  if (semTabela) {
    return (
      <div className="app">
        <div className="banner bad">
          As entregas ainda não foram criadas no banco. Rode <code>supabase/epi-entregas.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="nao-imprimir">
        <p className="eyebrow">EPI</p>
        <h1 className="titulo-tela">Ficha de entrega</h1>
        <p className="subtitulo-tela">
          Clique no trabalhador para emitir a ficha dele, ou marque vários e emita de uma vez. Uma
          folha por trabalhador, com tudo que ele recebeu, o CA de cada equipamento e quando
          assinou. É o documento exigido pelo item 6.6.1 da NR-06.
        </p>
      </div>

      {erro && <div className="banner bad nao-imprimir">{erro}</div>}

      {escolhidas.length > 0 && modo === 'ficha' && (
        <div className="banner nao-imprimir">
          Mostrando {escolhidas.length} trabalhador{escolhidas.length > 1 ? 'es' : ''} escolhido
          {escolhidas.length > 1 ? 's' : ''} em Colaboradores.{' '}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setEscolhidas([])
              setMarcados([])
              setModo('lista')
              window.history.replaceState(null, '', '/epi/ficha')
            }}
          >
            Ver a lista
          </button>
        </div>
      )}

      <div className="filters nao-imprimir">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={(v) => {
              setEmpresaFiltro(v)
              setMarcados([])
              setModo('lista')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}

        {modo === 'lista' ? (
          <>
            <input
              type="search"
              id="ficha-busca"
              placeholder="Nome ou matrícula"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select id="ficha-local" value={local} onChange={(e) => setLocal(e.target.value)}>
              <option value="">Todos os locais</option>
              {locais.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <label className="caixa-marcar">
              Entregas de
              <input type="date" id="ficha-de" value={de} onChange={(e) => setDe(e.target.value)} />
            </label>
            <label className="caixa-marcar">
              até
              <input type="date" id="ficha-ate" value={ate} onChange={(e) => setAte(e.target.value)} />
            </label>
            <label className="caixa-marcar">
              <input
                type="checkbox"
                id="ficha-desligados"
                checked={comDesligados}
                onChange={(e) => setComDesligados(e.target.checked)}
              />
              Incluir desligados
            </label>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!marcados.length}
              onClick={() => emitir(marcados)}
            >
              Emitir ficha{marcados.length > 1 ? ` (${marcados.length})` : ''}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => setModo('lista')}>
              ← Voltar à lista
            </button>
            <label className="caixa-marcar">
              <input
                type="checkbox"
                id="ficha-foto"
                checked={comFoto}
                onChange={(e) => setComFoto(e.target.checked)}
              />
              Incluir as fotos
            </label>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              Imprimir
            </button>
          </>
        )}
      </div>

      {carregando && <p className="empty-state nao-imprimir">Carregando…</p>}

      {!carregando && modo === 'lista' && (
        interno && !empresaFiltro ? (
          <p className="empty-state">Escolha a empresa para ver as fichas.</p>
        ) : linhas.length === 0 ? (
          <p className="empty-state">
            {de || ate || busca || local
              ? 'Nenhuma entrega com esses filtros.'
              : 'Nenhuma entrega registrada ainda.'}
          </p>
        ) : (
          <table className="tabela-colab">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Marcar todos"
                    checked={marcados.length > 0 && marcados.length === linhas.length}
                    onChange={(e) => setMarcados(e.target.checked ? linhas.map((l) => l.pessoa.id) : [])}
                  />
                </th>
                <th>Trabalhador</th>
                <th>Função</th>
                <th>Local</th>
                <th>Entregas</th>
                <th>Última entrega</th>
                <th>Situação</th>
                <th className="acoes" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.pessoa.id}
                  className={l.desligado ? 'inativo' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => emitir([l.pessoa.id])}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={'Marcar ' + l.pessoa.nome}
                      checked={marcados.includes(l.pessoa.id)}
                      onChange={(e) =>
                        setMarcados((atual) =>
                          e.target.checked
                            ? [...atual, l.pessoa.id]
                            : atual.filter((id) => id !== l.pessoa.id)
                        )
                      }
                    />
                  </td>
                  <td className="nome">
                    {l.pessoa.nome}
                    {l.pessoa.matricula ? ' · ' + l.pessoa.matricula : ''}
                    {l.desligado && <span className="pill flat"> Desligado</span>}
                  </td>
                  <td>{l.funcao || '—'}</td>
                  <td>{nomeDoLocal(l.pessoa)}</td>
                  <td>{l.entregas.length}</td>
                  <td>{l.ultima ? dataHoraBr(l.ultima) : '—'}</td>
                  <td>
                    {l.vencidos > 0 && (
                      <span className="pill warn">
                        {l.vencidos} vencido{l.vencidos > 1 ? 's' : ''}
                      </span>
                    )}
                    {l.semAssinatura > 0 && (
                      <span className="pill warn">
                        {' '}
                        {l.semAssinatura} sem assinatura
                      </span>
                    )}
                    {!l.vencidos && !l.semAssinatura && (
                      <span style={{ color: 'var(--ink-faint)' }}>em dia</span>
                    )}
                  </td>
                  <td className="acoes">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        emitir([l.pessoa.id])
                      }}
                    >
                      Emitir ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {!carregando && modo === 'ficha' && fichas.length === 0 && (
        <p className="empty-state nao-imprimir">
          Nenhuma entrega no período para quem você escolheu.
        </p>
      )}

      {modo === 'ficha' &&
        fichas.map(({ pessoa, linhas }, n) => {
        /* A função que vai no cabeçalho é a da última entrega desta
         * ficha, não a do cadastro de hoje: se a pessoa mudou de cargo,
         * o documento tem de dizer o que ela era quando recebeu. Entrega
         * antiga, de antes de guardarmos isso, cai no cadastro. */
        const funcaoDaFicha =
          [...linhas].reverse().map((l) => l.funcao).find((f) => f && f.trim()) ||
          pessoa.funcao ||
          ''
        return (
        <article key={pessoa.id} className="ficha">
          {/* Cabeçalho no formato da ficha que a empresa já conhece:
              a data de emissão e a página de um lado, a identificação do
              empregador no meio. */}
          <header className="ficha-topo">
            <div className="ficha-linha-topo">
              <span>Documento gerado em: {hoje()}</span>
              <span>Ficha {n + 1} de {fichas.length}</span>
            </div>
            <div className="ficha-marca">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icone-reallife.svg" alt="" className="ficha-logo" />
              <div className="ficha-identificacao">
                <strong>{nomeEmpregador()}</strong>
                <span>Ficha de EPI - Trabalhadores</span>
                <strong>
                  {nomeEmpregador()}
                  {empresa?.cnpj ? ` (${empresa.cnpj})` : ''}
                </strong>
              </div>
            </div>
          </header>

          <div className="ficha-dados">
            <div>
              <span>Nome do Trabalhador</span>
              <strong>{pessoa.nome}</strong>
            </div>
            <div>
              <span>Função</span>
              <strong>{funcaoDaFicha}</strong>
            </div>
            <div>
              <span>Matrícula</span>
              <strong>{pessoa.matricula || ''}</strong>
            </div>
            <div>
              <span>Data de admissão</span>
              <strong>{pessoa.admissao ? dataBr(pessoa.admissao) : ''}</strong>
            </div>
          </div>

          <div className="ficha-termo">
            <p>{TERMO_ENTREGA_EPI.join(' ')}</p>
          </div>

          <table className="ficha-tabela">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Devolução</th>
                <th>CA nº</th>
                <th>Qtde.</th>
                <th>Equipamento</th>
                <th>Motivo</th>
                {comFoto && <th>Foto</th>}
                <th>Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.flatMap((e) =>
                e.epi_entregas_itens.map((i, k) => (
                  <tr key={`${e.id}-${k}`}>
                    <td className="mono" data-rotulo="Entrega">
                      {dataCurta(e.entregue_em)}
                      {/* Quem entregou, só na primeira linha da entrega —
                          as demais são itens da mesma entrega, e repetir
                          o nome em cada uma suja a ficha impressa.
                          Vai aqui, embaixo da data, em vez de virar nona
                          coluna: a ficha é impressa em retrato e não
                          sobra largura. */}
                      {k === 0 && (
                        <span className="ficha-mini">
                          por {e.entregue_por_nome || 'não registrado'}
                        </span>
                      )}
                    </td>
                    <td className="mono" data-rotulo="Devolução">
                      {i.devolvido_em ? (
                        <>
                          {dataBr(i.devolvido_em.slice(0, 10))}
                          <br />
                          <span className="ficha-mini">
                            {MOTIVOS_DEVOLUCAO[i.devolucao_motivo || ''] || i.devolucao_motivo}
                          </span>
                        </>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="mono" data-rotulo="CA nº">
                      {i.ca || ''}
                    </td>
                    <td className="mono" data-rotulo="Qtde.">
                      {i.quantidade}
                    </td>
                    <td data-rotulo="Equipamento" className="ficha-equip">
                      <strong>
                        {i.nome.toUpperCase()}
                        {i.complemento ? ` (${i.complemento})` : ''}
                      </strong>
                      {i.validade_ca && (
                        <span className="ficha-mini">
                          Validade do C.A.: {dataBr(i.validade_ca)}
                        </span>
                      )}
                      {i.descricao && <span className="ficha-mini">{i.descricao}</span>}
                    </td>
                    <td data-rotulo="Motivo">{MOTIVOS[i.motivo] || i.motivo}</td>
                    {comFoto && (
                      <td className="ficha-foto" data-rotulo="Foto">
                        {k === 0 && fotos[e.foto_path] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={fotos[e.foto_path]} alt="" />
                        ) : null}
                      </td>
                    )}
                    <td className="ficha-ass" data-rotulo="Assinatura">
                      {k === 0 ? (
                        e.assinado_em ? (
                          <>
                            {e.assinatura_imagem && assinaturas[e.assinatura_imagem] ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                className="ficha-traco"
                                src={assinaturas[e.assinatura_imagem]}
                                alt="Assinatura do trabalhador"
                              />
                            ) : (
                              <span className="ficha-sem-traco">assinado no portal</span>
                            )}
                            {e.assinatura_hash && (
                              <span className="ficha-hash">{e.assinatura_hash.slice(0, 40)}</span>
                            )}
                            <span className="ficha-quando">{dataHoraCurta(e.assinado_em)}</span>
                          </>
                        ) : (
                          <span className="ficha-pendente">sem assinatura</span>
                        )
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>


        </article>
        )
      })}
    </div>
  )
}
