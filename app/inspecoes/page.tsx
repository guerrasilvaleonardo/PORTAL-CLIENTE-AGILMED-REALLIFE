'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import Ajuda from '@/components/Ajuda'
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
            'concluida_em, situacao, itens_total, nao_conformes, percentual, visita_id'
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
          percentual,
          /* Uma só: é por ela que se abre quando não há visita. */
          inspecaoId: primeira.id,
        }
      })
      .sort((a, b) => (b.quando || '').localeCompare(a.quando || ''))
  }, [visiveis, relatorioDaVisita])

  const modelosDisponiveis = modelos.filter(
    (m) => m.ativo && (m.empresa_id === null || m.empresa_id === empresaAtual)
  )
  const locaisDaEmpresa = locais.filter((l) => l.empresa_id === empresaAtual)

  async function comecar() {
    if (abrindo) return
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
     * MAIS DE UM CHECKLIST VIRA UMA VISITA.
     *
     * Cada `inspecoes` guarda um modelo só — é o que permite o
     * percentual de conformidade ser daquela norma, e não uma média
     * sem sentido entre NR-18 e NR-35. Para juntar vários na mesma ida
     * ao cliente, o que agrupa é a visita: um documento, um código, e
     * dentro dele o resultado de cada checklist.
     */
    if (escolhidos.length > 1) {
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

    const modelo = modelosDisponiveis.find((m) => m.id === escolhidos[0])
    if (!modelo) {
      setAbrindo(false)
      setErro('Escolha o modelo de checklist.')
      return
    }

    const { data: nova, error } = await supabase
      .from('inspecoes')
      .insert({
        empresa_id: empresaAtual,
        modelo_id: modelo.id,
        modelo_nome: modelo.nome,
        norma: modelo.norma,
        local_id: local?.id || null,
        local_nome: local?.nome || null,
        inspetor_nome: meuNome || null,
      })
      .select('id')
      .single()

    if (error || !nova) {
      setAbrindo(false)
      setErro(error?.message || 'Não foi possível começar a inspeção.')
      return
    }

    /* As perguntas são copiadas agora: a inspeção é documento do dia. */
    const { data: itens } = await supabase
      .from('inspecao_modelo_itens')
      .select('id, ordem, categoria, pergunta, peso')
      .eq('modelo_id', modelo.id)
      .eq('ativo', true)
      .order('ordem')

    if (itens && itens.length) {
      const { error: erroResp } = await supabase.from('inspecao_respostas').insert(
        (itens as any[]).map((i) => ({
          inspecao_id: (nova as any).id,
          item_id: i.id,
          ordem: i.ordem,
          categoria: i.categoria,
          pergunta: i.pergunta,
          peso: i.peso,
        }))
      )
      if (erroResp) {
        setAbrindo(false)
        setErro('A inspeção foi aberta, mas as perguntas não entraram: ' + erroResp.message)
        return
      }
    }

    window.location.href = '/inspecoes/' + (nova as any).id
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
      <div>
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">Inspeções</h1>
        <p className="subtitulo-tela">
          O que foi a campo, o que estava conforme e o que virou não conformidade. Cada item
          reprovado abre uma não conformidade quando a inspeção é concluída.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      {/*
       * ONDE COMEÇA.
       *
       * Isto era uma barra de filtros com um botão no meio, e botão no
       * meio de filtro ninguém vê: a pergunta "por onde eu começo?"
       * veio de quem já tinha a tela aberta na frente. O começo agora
       * tem título, número em cada passo e fica acima da lista, que é
       * o resultado do trabalho — não a porta de entrada dele.
       */}
      <section className="insp-comecar">
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
        <select value={localEscolhido} onChange={(e) => setLocalEscolhido(e.target.value)}>
          <option value="">2. Local (opcional)…</option>
          {locaisDaEmpresa.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
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
        <table className="tabela-colab">
          <thead>
            <tr>
              <th>Visita</th>
              <th>Local</th>
              <th>Inspetor</th>
              <th>Quando</th>
              <th>
                Situação{' '}
                <Ajuda
                  titulo="Até onde foi"
                  texto="Em campo: ainda apontando. Concluída · falta emitir: o checklist acabou e o relatório nunca saiu. Relatório emitido: o cliente tem o documento, com código e revisão."
                />
              </th>
              <th>Conformidade</th>
              <th className="acoes" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}>
                <td className="nome">
                  {l.titulo}
                  {l.detalhe && (
                    <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                      {l.detalhe}
                    </div>
                  )}
                </td>
                <td>{l.local}</td>
                <td>{l.inspetor}</td>
                <td>{dataHora(l.quando)}</td>
                <td>
                  {l.emitido && l.situacao !== 'cancelada' ? (
                    <>
                      <span className="pill good">Relatório emitido</span>
                      <div className="mono" style={{ fontSize: 11.5, marginTop: 3 }}>
                        {l.emitido.codigo}
                        {l.emitido.revisao > 1 ? ' · rev. ' + l.emitido.revisao : ''}
                      </div>
                    </>
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
                <td>
                  {l.percentual === null ? (
                    '—'
                  ) : (
                    <>
                      {l.percentual}%
                      {l.naoConformes > 0 && <span className="pill bad"> {l.naoConformes} NC</span>}
                    </>
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
