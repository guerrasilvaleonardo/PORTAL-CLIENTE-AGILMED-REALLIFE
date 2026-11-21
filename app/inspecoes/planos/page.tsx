'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import Ajuda from '@/components/Ajuda'
import '../inspecoes.css'
import './planos.css'
import '../visual.css'

/*
 * Planos de ação (supabase/planos-de-acao.sql).
 *
 * POR QUE ESTA TELA EXISTE. O tratamento estava dentro da ficha da não
 * conformidade, um campo de texto por NC. Quem queria saber o que a
 * empresa inteira devia fazer esta semana precisava abrir uma NC de
 * cada vez — e ação que ninguém consegue ver em lista é ação que vence
 * sem aviso. O sistema que fomos olhar tem 25 planos atrasados e
 * nenhuma NC encerrada: o vocabulário deles é bom, o ciclo não fecha.
 *
 * AQUI SÓ SE ACOMPANHA. Ação nova nasce dentro da NC, junto da causa
 * que a justifica — criar ação solta, sem desvio que a explique, é o
 * caminho curto para uma lista de tarefas que ninguém sabe de onde
 * veio. O que esta tela faz é mostrar o que está parado onde, e deixar
 * empurrar a ação para a coluna seguinte sem abrir a ficha.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const TIPOS: Record<string, string> = {
  correcao: 'Correção',
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  verificacao: 'Verificação',
}

/* A ordem é o andar da ação, e as colunas seguem ela. */
const COLUNAS: { chave: string; titulo: string; explica: string }[] = [
  { chave: 'aberta', titulo: 'A fazer', explica: 'Combinada, ainda não começou.' },
  { chave: 'execucao', titulo: 'Em execução', explica: 'Alguém está tocando agora.' },
  {
    chave: 'verificacao',
    titulo: 'Em verificação de eficácia',
    explica: 'Feita; falta conferir se funcionou.',
  },
  { chave: 'encerrada', titulo: 'Encerrada', explica: 'Conferida e fechada.' },
]

const SEGUINTE: Record<string, string> = {
  aberta: 'execucao',
  execucao: 'verificacao',
}

type Acao = {
  id: string
  empresa_id: string
  nc_id: string
  ordem: number
  tipo: string
  descricao: string
  responsavel_nome: string | null
  prazo: string | null
  situacao: string
  eficaz: boolean | null
  verificacao_obs: string | null
  nao_conformidades: {
    codigo: string | null
    descricao: string
    gravidade: string
    local_nome: string | null
  } | null
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const hoje = () => new Date().toISOString().slice(0, 10)

/* Atraso só existe enquanto a ação não fechou: cobrar prazo de ação
   encerrada é barulho sobre trabalho que já foi feito. */
const atrasada = (a: Acao) =>
  !!a.prazo && a.prazo < hoje() && !['encerrada', 'cancelada'].includes(a.situacao)

function PlanosConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [lista, setLista] = useState<Acao[]>([])
  const [soAtrasadas, setSoAtrasadas] = useState(false)
  const [salvando, setSalvando] = useState('')

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
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const { data, error } = await supabase
        .from('nc_acoes')
        .select(
          'id, empresa_id, nc_id, ordem, tipo, descricao, responsavel_nome, prazo, situacao, ' +
            'eficaz, verificacao_obs, nao_conformidades!inner(codigo, descricao, gravidade, local_nome, tipo)'
        )
        .eq('nao_conformidades.tipo', 'inspecao')
        .order('prazo', { ascending: true, nullsFirst: false })
        .limit(500)

      if (error) {
        /* Migração ainda não rodada: a tela avisa o que falta em vez de
           mostrar um erro de banco para o cliente. */
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setLista((data || []) as unknown as Acao[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os planos de ação.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const visiveis = useMemo(
    () =>
      lista
        .filter((a) => !empresaAtual || a.empresa_id === empresaAtual)
        .filter((a) => !soAtrasadas || atrasada(a)),
    [lista, empresaAtual, soAtrasadas]
  )

  const atrasadas = useMemo(
    () => lista.filter((a) => (!empresaAtual || a.empresa_id === empresaAtual) && atrasada(a)).length,
    [lista, empresaAtual]
  )

  /*
   * Empurrar a ação para a coluna seguinte. Encerrar é o único passo
   * que pede resposta: ação encerrada sem dizer se funcionou é o
   * buraco por onde o ciclo da 10.2 vaza — fica o registro de que algo
   * foi feito e nenhum de que adiantou.
   */
  async function avancar(a: Acao) {
    if (salvando) return

    const destino = SEGUINTE[a.situacao]
    if (!destino) return

    setSalvando(a.id)
    setErro('')

    const { error } = await supabase
      .from('nc_acoes')
      .update({
        situacao: destino,
        concluida_em: destino === 'verificacao' ? new Date().toISOString() : null,
      })
      .eq('id', a.id)

    setSalvando('')

    if (error) {
      setErro(error.message)
      return
    }

    setLista((l) => l.map((x) => (x.id === a.id ? { ...x, situacao: destino } : x)))
  }

  async function encerrar(a: Acao, eficaz: boolean) {
    if (salvando) return

    setSalvando(a.id)
    setErro('')

    const { error } = await supabase
      .from('nc_acoes')
      .update({
        situacao: 'encerrada',
        eficaz,
        verificada_em: new Date().toISOString(),
      })
      .eq('id', a.id)

    setSalvando('')

    if (error) {
      setErro(error.message)
      return
    }

    setLista((l) => l.map((x) => (x.id === a.id ? { ...x, situacao: 'encerrada', eficaz } : x)))
  }

  if (carregando) return <div className="app insp-v2">Carregando…</div>

  if (semTabela) {
    return (
      <div className="app insp-v2">
        <div>
          <p className="eyebrow">INSPEÇÕES</p>
          <h1 className="titulo-tela">Planos de ação</h1>
        </div>
        <div className="banner bad">
          A tabela ainda não existe no banco. Rode <code>supabase/planos-de-acao.sql</code> no
          editor SQL do Supabase e recarregue esta página.
        </div>
      </div>
    )
  }

  return (
    <div className="app insp-v2">
      {/* Título à esquerda, o que se filtra à direita — como no
          desenho. O atraso vem primeiro e em vermelho: é o número que
          o cliente cobra na reunião. */}
      <div className="insp-cabeca">
        <div>
          <p className="eyebrow">INSPEÇÕES</p>
          <h1 className="titulo-tela">Planos de ação</h1>
          <p className="subtitulo-tela">
            Uma não conformidade pode ter várias ações, de tipos diferentes. Ação nova se cria
            dentro da não conformidade, junto da causa que a justifica; aqui se acompanha.
          </p>
        </div>

        <div className="insp-cabeca-acoes nao-imprimir">
          {interno && (
            <FiltroEmpresa
              valor={empresaFiltro}
              aoMudar={setEmpresaFiltro}
              opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
            />
          )}

          <button
            type="button"
            className={'btn btn-sm' + (soAtrasadas ? ' btn-perigo' : '')}
            onClick={() => setSoAtrasadas((v) => !v)}
          >
            {atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}
          </button>
        </div>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="planos-tipos">
        <div>
          <span className="pill warn">Correção</span>
          <p>Resolve o que está na frente, agora. Não ataca a causa.</p>
        </div>
        <div>
          <span className="pill flat">Corretiva</span>
          <p>Ataca a causa-raiz desta não conformidade, para ela não voltar.</p>
        </div>
        <div>
          <span className="pill good">Preventiva</span>
          <p>Estende a lição para onde ainda não aconteceu.</p>
        </div>
        <div>
          <span className="pill flat">Verificação</span>
          <p>Confere, depois, se o que foi feito funcionou mesmo.</p>
        </div>
      </div>

      <div className="planos-colunas">
        {COLUNAS.map((coluna) => {
          const dela = visiveis.filter((a) => a.situacao === coluna.chave)

          return (
            <section key={coluna.chave} className="planos-coluna">
              <h3>
                {coluna.titulo}
                <span className="planos-conta">{dela.length}</span>
                <Ajuda titulo={coluna.titulo} texto={coluna.explica} />
              </h3>

              <div className="planos-pilha">
                {dela.length === 0 && <p className="plano-vazio">Nada aqui.</p>}

                {dela.map((a) => (
                  <article key={a.id} className={'plano-cartao' + (atrasada(a) ? ' atrasado' : '')}>
                    <div className="plano-topo">
                      <span
                        className={
                          'pill ' +
                          (a.tipo === 'correcao' ? 'warn' : a.tipo === 'preventiva' ? 'good' : 'flat')
                        }
                      >
                        {TIPOS[a.tipo] || a.tipo}
                      </span>
                      <a href={'/inspecoes/nc/' + a.nc_id} className="mono">
                        {a.nao_conformidades?.codigo || 'NC sem número'}
                      </a>
                    </div>

                    <p className="plano-descricao">{a.descricao}</p>

                    <div className="plano-rodape">
                      <span>{a.responsavel_nome || 'Sem responsável'}</span>
                      {atrasada(a) ? (
                        <span className="plano-prazo-vencido">venceu {dataBr(a.prazo)}</span>
                      ) : (
                        <span className="plano-prazo">{dataBr(a.prazo)}</span>
                      )}
                    </div>

                    {a.situacao === 'encerrada' && (
                      <div className="plano-rodape">
                        <span className={'pill ' + (a.eficaz ? 'good' : 'bad')}>
                          {a.eficaz ? 'Eficácia confirmada' : 'Não resolveu'}
                        </span>
                      </div>
                    )}

                    {SEGUINTE[a.situacao] && (
                      <div className="plano-acoes">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={salvando === a.id}
                          onClick={() => avancar(a)}
                        >
                          {a.situacao === 'aberta' ? 'Começar' : 'Marcar como feita'}
                        </button>
                      </div>
                    )}

                    {a.situacao === 'verificacao' && (
                      <div className="plano-acoes">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={salvando === a.id}
                          onClick={() => encerrar(a, true)}
                        >
                          Funcionou
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={salvando === a.id}
                          onClick={() => encerrar(a, false)}
                        >
                          Não resolveu
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default function PlanosDeAcao() {
  return (
    <ComModulo modulo="inspecoes">
      <PlanosConteudo />
    </ComModulo>
  )
}
