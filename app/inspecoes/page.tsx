'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import Ajuda from '@/components/Ajuda'
import FaixaDoTeste from '@/components/FaixaDoTeste'
import { useModulos } from '@/lib/modulos'
import '../colaboradores/colaboradores.css'
import './inspecoes.css'
import './visual.css'

/*
 * Inspeções aplicadas (supabase/inspecoes.sql).
 *
 * A lista do que já foi a campo e o botão para começar uma nova. Ao
 * começar, as perguntas do modelo são COPIADAS para a inspeção: mudar o
 * modelo amanhã não reescreve o que foi inspecionado hoje.
 *
 * Quem aplica: o técnico da Real Life no cliente, e o próprio cliente
 * nas inspeções dele. O banco decide quem pode (pode_gerir_inspecoes).
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Local = { id: string; empresa_id: string; nome: string }
type Modelo = { id: string; empresa_id: string | null; nome: string; norma: string | null; ativo: boolean }

type Inspecao = {
  id: string
  empresa_id: string
  modelo_nome: string
  norma: string | null
  local_nome: string | null
  inspetor_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  itens_total: number
  conformes: number
  nao_conformes: number
  percentual: number | null
  visita_id: string | null
}

/*
 * O caminho de uma inspeção, escrito na tela.
 *
 * POR QUE ISTO EXISTE. A lista dizia "em andamento" ou "concluída" e
 * parava aí. Só que concluir o checklist não é o fim: o fim é o
 * relatório com código na mão do cliente — e entre uma coisa e outra
 * cabem três dias e um telefonema perguntando "já posso mandar?".
 * Quem abre esta tela precisa ver o caminho inteiro de uma vez, e em
 * que degrau cada visita parou.
 */
const CAMINHO = [
  { titulo: '1. Em campo', texto: 'Estou apontando. Pode fechar o celular e voltar.' },
  { titulo: '2. Concluída', texto: 'Checklist respondido. Ainda dá para rever.' },
  { titulo: '3. Relatório emitido', texto: 'Tem código, data e hora. Mudança vira revisão.' },
]

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function InspecoesConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [meuNome, setMeuNome] = useState('')
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [locais, setLocais] = useState<Local[]>([])
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([])
  const [relatorioDaVisita, setRelatorioDaVisita] = useState<
    Record<string, { codigo: string; revisao: number }>
  >({})

  const [modeloEscolhido, setModeloEscolhido] = useState('')
  /* Os checklists desta inspeção. Vazio = nenhum escolhido ainda. */
  const [extras, setExtras] = useState<string[]>([])
  const [localEscolhido, setLocalEscolhido] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

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
        .select('perfil, empresa_id, nome')
        .eq('id', user.id)
        .single()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')
      setMeuNome(perfil?.nome || '')

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const { data: lista, error: erroI } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, modelo_nome, norma, local_nome, inspetor_nome, iniciada_em, ' +
            'concluida_em, situacao, itens_total, conformes, nao_conformes, percentual, visita_id'
        )
        /* Auditoria de sistema de gestão é outro processo e tem tela
         * própria. Misturar as duas aqui faria o canteiro e o requisito
         * 9.3 da ISO disputarem a mesma lista. */
        .neq('tipo', 'auditoria')
        .order('iniciada_em', { ascending: false })
        .limit(300)

      if (erroI) {
        if (erroI.code === '42P01' || /does not exist|schema cache/i.test(erroI.message || '')) {
          setSemTabela(true)
          return
        }
        throw erroI
      }

      setInspecoes((lista || []) as unknown as Inspecao[])

      /*
       * Quais visitas já viraram documento. É isto que separa "o
       * checklist acabou" de "o cliente tem o relatório": sem esta
       * consulta a lista pararia na conclusão, que é justamente onde
       * a dúvida começa.
       *
       * A tabela pode não existir ainda (migração não rodada): aqui o
       * silêncio é a resposta certa — a coluna mostra a situação de
       * antes em vez de quebrar a tela inteira.
       */
      const { data: emitidos } = await supabase
        .from('relatorios_emitidos')
        .select('visita_id, codigo, revisao')
        .eq('tipo', 'inspecao')
        .not('visita_id', 'is', null)
        .limit(1000)

      const porVisita: Record<string, { codigo: string; revisao: number }> = {}
      for (const r of (emitidos || []) as any[]) {
        /* Várias revisões do mesmo código: fica a mais alta. */
        const atual = porVisita[r.visita_id]
        if (!atual || r.revisao > atual.revisao) {
          porVisita[r.visita_id] = { codigo: r.codigo, revisao: r.revisao }
        }
      }
      setRelatorioDaVisita(porVisita)

      const [{ data: ms }, { data: ls }] = await Promise.all([
        /* Os checklists de auditoria ficam na tela de Auditorias. */
        supabase
          .from('inspecao_modelos')
          .select('id, empresa_id, nome, norma, ativo')
          .neq('tipo', 'auditoria')
          .order('nome'),
        supabase.from('locais_trabalho').select('id, empresa_id, nome').order('nome'),
      ])
      setModelos((ms || []) as Modelo[])
      setLocais((ls || []) as Local[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar as inspeções.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const visiveis = useMemo(
    () => inspecoes.filter((i) => !empresaAtual || i.empresa_id === empresaAtual),
    [inspecoes, empresaAtual]
  )

  /*
   * Os filtros da lista.
   *
   * Busca por código é o caso mais comum de todos: o cliente liga
   * citando "RIC-2026-0041" e alguém precisa achar aquilo em
   * segundos. Local e situação são os dois cortes que a equipe faz
   * sozinha o tempo todo — "o que está em campo agora", "o que ficou
   * pendente no Galpão 03".
   */
  const [busca, setBusca] = useState('')
  const [localFiltro, setLocalFiltro] = useState('')
  const [situacaoFiltro, setSituacaoFiltro] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 15

  /*
   * UMA LINHA POR VISITA, não por checklist.
   *
   * Sete checklists escolhidos na mesma ida ao cliente viravam sete
   * linhas iguais na lista — mesmo local, mesmo inspetor, mesma hora —
   * como se fossem sete inspeções. Não são: são uma visita só, que
   * termina num documento só, com um código só. A tela estava
   * contando a história do banco (onde cada checklist é mesmo uma
   * linha, para o percentual sair por norma) em vez da história do
   * trabalho.
   *
   * Inspeção antiga, sem visita, continua uma linha por si: ali o
   * checklist é a visita inteira.
   */
  const linhas = useMemo(() => {
    const grupos = new Map<string, Inspecao[]>()

    for (const i of visiveis) {
      const chave = i.visita_id || 'avulsa:' + i.id
      const atual = grupos.get(chave)
      if (atual) atual.push(i)
      else grupos.set(chave, [i])
    }

    return [...grupos.entries()]
      .map(([chave, itens]) => {
        const primeira = itens[0]
        const visitaId = primeira.visita_id
        const emitido = visitaId ? relatorioDaVisita[visitaId] || null : null

        /* A visita só está concluída quando nenhum checklist dela
           continua aberto: um respondido e três em branco é visita em
           campo, não visita pronta. */
        const emCampo = itens.some((i) => i.situacao === 'em_andamento')
        const todasCanceladas = itens.every((i) => i.situacao === 'cancelada')
        const situacao = todasCanceladas ? 'cancelada' : emCampo ? 'em_andamento' : 'concluida'

        /* Conformidade da visita: média ponderada pelos itens de cada
           checklist. Média simples faria um checklist de 3 perguntas
           pesar igual a um de 40. */
        const comNota = itens.filter((i) => i.percentual !== null && i.itens_total > 0)
        const pesoTotal = comNota.reduce((s, i) => s + i.itens_total, 0)
        const percentual = pesoTotal
          ? Math.round(
              (comNota.reduce((s, i) => s + Number(i.percentual) * i.itens_total, 0) / pesoTotal) *
                100
            ) / 100
          : null

        const quando = itens
          .map((i) => i.concluida_em || i.iniciada_em)
          .sort()
          .slice(-1)[0]

        return {
          chave,
          visitaId,
          titulo:
            itens.length === 1
              ? primeira.modelo_nome + (primeira.norma ? ' · ' + primeira.norma : '')
              : itens.length + ' checklists nesta visita',
          detalhe:
            itens.length === 1
              ? null
              : itens
                  .map((i) => i.norma || i.modelo_nome)
                  .filter((v, k, a) => a.indexOf(v) === k)
                  .join(' · '),
          local: primeira.local_nome || '—',
          inspetor: primeira.inspetor_nome || '—',
          quando,
          situacao,
          emitido,
          naoConformes: itens.reduce((s, i) => s + (i.nao_conformes || 0), 0),
          conformes: itens.reduce((s, i) => s + (i.conformes || 0), 0),
          /* Quantos checklists foram levados nesta visita. "2
             aplicados" e "3 escolhidos" são coisas diferentes: o
             primeiro já tem resposta, o segundo ainda não. */
          checklists: itens.length,
          respondidos: itens.filter((i) => (i.itens_total || 0) > 0).length,
          percentual,
          /* Uma só: é por ela que se abre quando não há visita. */
          inspecaoId: primeira.id,
        }
      })
      .sort((a, b) => (b.quando || '').localeCompare(a.quando || ''))
  }, [visiveis, relatorioDaVisita])

  /* O que sobra depois dos filtros, antes de cortar em páginas. */
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return linhas.filter((l) => {
      if (localFiltro && l.local !== localFiltro) return false
      if (situacaoFiltro) {
        const situacaoVisivel = l.emitido && l.situacao !== 'cancelada' ? 'emitido' : l.situacao
        if (situacaoVisivel !== situacaoFiltro) return false
      }
      if (!termo) return true
      return [l.emitido?.codigo, l.local, l.inspetor, l.titulo, l.detalhe]
        .filter(Boolean)
        .some((campo) => (campo as string).toLowerCase().includes(termo))
    })
  }, [linhas, busca, localFiltro, situacaoFiltro])

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const naPagina = filtradas.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA)

  /* Mudou o filtro, volta para a primeira página: continuar na página
     3 de uma lista que agora tem uma página só mostra tela vazia. */
  useEffect(() => {
    setPagina(0)
  }, [busca, localFiltro, situacaoFiltro, empresaAtual])

  /*
   * O aviso some quando o problema é resolvido.
   *
   * "Escolha a empresa antes de começar" continuava na tela depois de
   * a empresa ser escolhida, e a pessoa ficava procurando o que mais
   * estaria errado. Aviso que não some vira ruído, e ruído faz o
   * próximo aviso de verdade ser ignorado.
   */
  useEffect(() => {
    setErro('')
  }, [empresaAtual, modeloEscolhido, extras.length])

  /* Os locais que realmente aparecem na lista, não o cadastro inteiro:
     filtro que oferece opção sem resultado é filtro que frustra. */
  const locaisNaLista = useMemo(
    () => [...new Set(linhas.map((l) => l.local).filter((l) => l && l !== '—'))].sort(),
    [linhas]
  )

  /*
   * O TESTE DE 7 DIAS (supabase/teste-de-7-dias.sql).
   *
   * Encerrado o teste, a tela continua aberta: o relatório da visita é
   * registro da empresa e não fica refém de contrato. O que fecha é a
   * inspeção nova — e o banco recusa junto, não é trava só de tela.
   */
  const modulos = useModulos()
  const teste = modulos.teste('inspecoes')
  const podeGravar = modulos.carregando || modulos.podeGravar('inspecoes')

  const numerosDoTeste = useMemo(() => {
    if (teste.estado !== 'encerrado') return []
    const vivas = inspecoes.filter((i) => i.situacao !== 'cancelada')
    const locaisVistos = new Set(vivas.map((i) => i.local_nome).filter(Boolean))
    return [
      { valor: vivas.length, rotulo: 'inspeções aplicadas em campo' },
      { valor: locaisVistos.size, rotulo: 'locais de trabalho visitados' },
      {
        valor: vivas.reduce((s, i) => s + (i.nao_conformes || 0), 0),
        rotulo: 'achados virando não conformidade',
      },
    ]
  }, [inspecoes, teste.estado])

  const modelosDisponiveis = modelos.filter(
    (m) => m.ativo && (m.empresa_id === null || m.empresa_id === empresaAtual)
  )
  const locaisDaEmpresa = locais.filter((l) => l.empresa_id === empresaAtual)

  async function comecar() {
    if (abrindo) return
    if (!podeGravar) {
      setErro('O teste de 7 dias terminou. Contrate as Inspeções para aplicar novas visitas — o que você já registrou continua aqui.')
      return
    }
    if (!empresaAtual) {
      setErro('Escolha a empresa antes de começar.')
      return
    }
    const escolhidos = extras.length
      ? extras
      : modeloEscolhido
        ? [modeloEscolhido]
        : []

    if (!escolhidos.length) {
      setErro('Escolha pelo menos um checklist.')
      return
    }

    setAbrindo(true)
    setErro('')

    const local = locaisDaEmpresa.find((l) => l.id === localEscolhido) || null

    /*
     * TODA INSPEÇÃO NASCE DENTRO DE UMA VISITA — inclusive a de um
     * checklist só.
     *
     * Antes havia dois caminhos: vários checklists abriam visita e
     * caíam na tela de campo; um checklist só criava a inspeção solta
     * e caía na tela de aplicar checklist. Quem escolhia um perdia a
     * régua das etapas, o apontamento livre, a foto com GPS, o
     * potencial fatal e o "o que falta para encerrar" — e, pior, não
     * tinha como emitir o relatório, porque o código é da visita. A
     * tela que a pessoa via dependia de um detalhe que, para ela, não
     * quer dizer nada.
     *
     * Cada `inspecoes` continua guardando um modelo só: é o que
     * permite o percentual de conformidade ser daquela norma, e não
     * uma média sem sentido entre NR-18 e NR-35. O que agrupa é a
     * visita: um documento, um código, e dentro dele o resultado de
     * cada checklist.
     */
    {
      const { data: visita, error: erroVisita } = await supabase
        .from('inspecao_visitas')
        .insert({
          empresa_id: empresaAtual,
          local_id: local?.id || null,
          local_nome: local?.nome || null,
          responsavel_nome: meuNome || null,
        })
        .select('id')
        .single()

      if (erroVisita || !visita) {
        setAbrindo(false)
        setErro(erroVisita?.message || 'Não foi possível abrir a visita.')
        return
      }

      for (const id of escolhidos) {
        const m = modelosDisponiveis.find((x) => x.id === id)
        if (!m) continue

        const { data: insp } = await supabase
          .from('inspecoes')
          .insert({
            empresa_id: empresaAtual,
            visita_id: (visita as any).id,
            modelo_id: m.id,
            modelo_nome: m.nome,
            norma: m.norma,
            local_id: local?.id || null,
            local_nome: local?.nome || null,
            inspetor_nome: meuNome || null,
          })
          .select('id')
          .single()
        if (!insp) continue

        const { data: itens } = await supabase
          .from('inspecao_modelo_itens')
          .select('id, ordem, categoria, pergunta, peso')
          .eq('modelo_id', m.id)
          .eq('ativo', true)
          .order('ordem')

        if (itens && itens.length) {
          await supabase.from('inspecao_respostas').insert(
            (itens as any[]).map((i) => ({
              inspecao_id: (insp as any).id,
              item_id: i.id,
              ordem: i.ordem,
              categoria: i.categoria,
              pergunta: i.pergunta,
              peso: i.peso,
            }))
          )
        }
      }

      window.location.href = '/inspecoes/campo?visita=' + (visita as any).id
      return
    }
  }

  if (semTabela) {
    return (
      <div className="app insp-v2">
        <div className="banner bad">
          As inspeções ainda não foram criadas no banco. Rode <code>supabase/inspecoes.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app insp-v2">
      <div className="insp-cabeca">
        <div>
          <p className="eyebrow">INSPEÇÕES</p>
          <h1 className="titulo-tela">Inspeções</h1>
          <p className="subtitulo-tela">
            Cada visita de campo, do rascunho ao relatório emitido. Item reprovado abre uma não
            conformidade quando a inspeção é concluída.
          </p>
        </div>
        {/* O botão leva ao quadro de começar, logo abaixo: a visita
            nasce escolhendo local e checklists, e não existe tela
            separada para isso. */}
        {podeGravar ? (
          <a href="#comecar" className="btn btn-primary">
            Nova inspeção
          </a>
        ) : (
          /* Visível e desligado: é o que o cliente deixa na mesa. */
          <span className="btn btn-primary teste-desligado" aria-disabled="true">
            Nova inspeção
          </span>
        )}
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <FaixaDoTeste modulo="inspecoes" teste={teste} numeros={numerosDoTeste} />

      {/*
       * ONDE COMEÇA.
       *
       * Isto era uma barra de filtros com um botão no meio, e botão no
       * meio de filtro ninguém vê: a pergunta "por onde eu começo?"
       * veio de quem já tinha a tela aberta na frente. O começo agora
       * tem título, número em cada passo e fica acima da lista, que é
       * o resultado do trabalho — não a porta de entrada dele.
       */}
      <section className="insp-comecar" id="comecar">
        <h2>
          Começar uma inspeção{' '}
          <Ajuda
            titulo="O que é uma inspeção aqui"
            texto="É uma visita ao cliente. Pode levar um checklist ou vários: tudo o que for apontado entra num documento só, com um código só. Quem vai a campo começa por aqui."
          />
        </h2>
        <p className="insp-comecar-ajuda">
          Escolha o que vai conferir e abra a visita. O apontamento de campo abre em seguida, já
          com a visita aberta — e é lá que entram fotos, voz e os itens fora do checklist.
        </p>

        <div className="filters" style={{ margin: 0 }}>
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={(v) => {
              setEmpresaFiltro(v)
              setModeloEscolhido('')
              setLocalEscolhido('')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        {/* Vários de uma vez: uma visita ao cliente raramente cabe num
            checklist só, e obrigar a abrir uma inspeção por norma
            fazia a mesma visita virar três registros sem nada ligando
            — e três relatórios para o cliente. */}
        <select
          value={modeloEscolhido}
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            setExtras((x) => (x.includes(id) ? x : [...x, id]))
            setModeloEscolhido('')
          }}
        >
          <option value="">
            {extras.length ? '2. Juntar outro checklist…' : '1. Escolha o checklist…'}
          </option>
          {modelosDisponiveis
            .filter((m) => !extras.includes(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {m.norma ? ' · ' + m.norma : ''}
              </option>
            ))}
        </select>
        {/*
          * O SELETOR DE LOCAL DIZ POR QUE ESTÁ VAZIO.
          *
          * Antes ele aparecia com uma opção só e nenhuma explicação:
          * quem abria a tela achava que era defeito. São dois motivos
          * diferentes, e cada um pede uma frase — ainda não escolheu a
          * empresa, ou a empresa não tem local cadastrado. O segundo
          * leva direto ao cadastro, porque é lá que se resolve.
          */}
        <select
          value={localEscolhido}
          onChange={(e) => setLocalEscolhido(e.target.value)}
          disabled={!empresaAtual || locaisDaEmpresa.length === 0}
        >
          <option value="">
            {!empresaAtual
              ? 'Escolha a empresa primeiro'
              : locaisDaEmpresa.length === 0
                ? 'Esta empresa não tem local cadastrado'
                : '2. Local (opcional)…'}
          </option>
          {locaisDaEmpresa.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
        {empresaAtual && locaisDaEmpresa.length === 0 && (
          <Link href="/inspecoes/locais" className="btn btn-sm">
            Cadastrar local
          </Link>
        )}
        <button type="button" className="btn btn-primary" disabled={abrindo} onClick={comecar}>
          {abrindo
            ? 'Abrindo…'
            : extras.length > 1
              ? `3. Começar · ${extras.length} checklists`
              : '3. Começar a inspeção'}
        </button>
        <span style={{ flex: 1 }} />
        <Link href="/inspecoes/modelos" className="btn btn-sm">
          Modelos
        </Link>
        </div>
      </section>

      {extras.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-body">
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-muted)' }}>
              {extras.length === 1
                ? 'Um checklist nesta inspeção.'
                : `${extras.length} checklists nesta visita — um documento só, com o resultado de cada um.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {extras.map((id) => {
                const m = modelosDisponiveis.find((x) => x.id === id)
                return (
                  <button
                    key={id}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setExtras((x) => x.filter((v) => v !== id))}
                  >
                    {m?.nome || 'checklist'} ✕
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* O caminho fica à vista mesmo sem nenhuma inspeção: é
          justamente quem ainda não fez a primeira que precisa dele. */}
      <ol className="insp-caminho nao-imprimir">
        {CAMINHO.map((passo) => (
          <li key={passo.titulo}>
            <strong>{passo.titulo}</strong>
            <span>{passo.texto}</span>
          </li>
        ))}
      </ol>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="empty-state">
          {interno && !empresaFiltro
            ? 'Escolha a empresa para ver as inspeções.'
            : 'Nenhuma inspeção ainda. A primeira começa no quadro acima.'}
        </p>
      ) : (
        <>
        {/*
          * A BARRA DE FILTROS, dentro do mesmo quadro da lista.
          *
          * Busca por código primeiro: o cliente liga citando
          * "RIC-2026-0041" e alguém precisa achar aquilo em segundos.
          */}
        <div className="insp-filtros nao-imprimir">
          <label className="insp-busca">
            <span className="insp-oculto">Buscar inspeção</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, local ou inspetor"
            />
          </label>
          <label>
            <span className="insp-oculto">Local</span>
            <select value={localFiltro} onChange={(e) => setLocalFiltro(e.target.value)}>
              <option value="">Todos os locais</option>
              {locaisNaLista.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="insp-oculto">Situação</span>
            <select value={situacaoFiltro} onChange={(e) => setSituacaoFiltro(e.target.value)}>
              <option value="">Todas as situações</option>
              <option value="em_andamento">Em campo</option>
              <option value="concluida">Concluída · falta emitir</option>
              <option value="emitido">Relatório emitido</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
        </div>

        <table className="tabela-colab">
          <thead>
            <tr>
              <th>Código</th>
              <th>Data</th>
              <th>Local</th>
              <th>Checklists</th>
              <th>Achados</th>
              <th>Inspetor</th>
              <th>
                Situação{' '}
                <Ajuda
                  titulo="Até onde foi"
                  texto="Em campo: ainda apontando. Concluída · falta emitir: o checklist acabou e o relatório nunca saiu. Relatório emitido: o cliente tem o documento, com código e revisão."
                />
              </th>
              <th className="acoes" />
            </tr>
          </thead>
          <tbody>
            {naPagina.map((l) => (
              <tr key={l.chave}>
                {/* O código é o nome da visita fora do portal. Enquanto
                    o relatório não sai, a visita ainda não tem nome —
                    e a tela diz isso em vez de inventar um. */}
                <td className="mono nome">
                  {l.emitido && l.situacao !== 'cancelada' ? (
                    <>
                      {l.emitido.codigo}
                      {l.emitido.revisao > 1 && (
                        <span style={{ fontWeight: 500, color: 'var(--ink-muted)' }}>
                          {' · rev. ' + l.emitido.revisao}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontWeight: 500, color: 'var(--ink-faint)' }}>sem código</span>
                  )}
                  <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                    {l.detalhe || l.titulo}
                  </div>
                </td>
                <td>{dataHora(l.quando)}</td>
                <td>{l.local}</td>
                <td style={{ color: 'var(--ink-muted)' }}>
                  {l.checklists === 0
                    ? '—'
                    : l.respondidos === l.checklists
                      ? `${l.checklists} aplicado${l.checklists > 1 ? 's' : ''}`
                      : `${l.checklists} escolhido${l.checklists > 1 ? 's' : ''}`}
                </td>
                <td>
                  {l.checklists === 0 || (l.naoConformes === 0 && l.conformes === 0) ? (
                    <span style={{ color: 'var(--ink-faint)' }}>—</span>
                  ) : (
                    <>
                      {l.naoConformes > 0 && (
                        <b style={{ color: 'var(--danger)' }}>{l.naoConformes} NC</b>
                      )}
                      {l.naoConformes > 0 && <span style={{ color: 'var(--ink-muted)' }}> · </span>}
                      <span style={{ color: 'var(--ink-muted)' }}>{l.conformes} ok</span>
                      {l.percentual !== null && (
                        <span style={{ color: 'var(--ink-faint)' }}> · {l.percentual}%</span>
                      )}
                    </>
                  )}
                </td>
                <td>{l.inspetor}</td>
                <td>
                  {l.emitido && l.situacao !== 'cancelada' ? (
                    /* O código já está na primeira coluna; repetir
                       aqui só gastava linha. */
                    <span className="pill good">Relatório emitido</span>
                  ) : l.situacao === 'em_andamento' ? (
                    <span className="pill warn">Em campo</span>
                  ) : l.situacao === 'concluida' ? (
                    <>
                      <span className="pill flat">Concluída</span>
                      <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--ink-faint)' }}>
                        falta emitir
                      </div>
                    </>
                  ) : (
                    <span className="pill flat">Cancelada</span>
                  )}
                </td>
                <td className="acoes">
                  {/* Continuar leva de volta ao campo com a visita
                      aberta — não a um checklist solto dela. */}
                  <Link
                    href={
                      l.situacao === 'em_andamento'
                        ? l.visitaId
                          ? '/inspecoes/campo?visita=' + l.visitaId
                          : '/inspecoes/' + l.inspecaoId
                        : l.visitaId
                          ? '/inspecoes/visita/' + l.visitaId
                          : '/inspecoes/' + l.inspecaoId
                    }
                    className="btn btn-sm"
                  >
                    {l.situacao === 'em_andamento' ? 'Continuar' : 'Abrir'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Quantas estão à vista de quantas existem, e como ver o
            resto. Sem isto, uma lista cortada em quinze parece uma
            empresa que só fez quinze inspeções. */}
        <div className="insp-rodape nao-imprimir">
          <span>
            {naPagina.length} de {filtradas.length}
            {filtradas.length === 1 ? ' inspeção' : ' inspeções'}
            {filtradas.length !== linhas.length ? ` (de ${linhas.length} no total)` : ''}
          </span>
          {paginas > 1 && (
            <span className="insp-rodape-botoes">
              <button
                type="button"
                className="btn btn-sm"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={pagina >= paginas - 1}
                onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
              >
                Próxima
              </button>
            </span>
          )}
        </div>
        </>
      )}
    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function Inspecoes() {
  return (
    <ComModulo modulo="inspecoes">
      <InspecoesConteudo />
    </ComModulo>
  )
}
