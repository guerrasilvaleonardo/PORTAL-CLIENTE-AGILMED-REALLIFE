'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import AcoesDaNC from './AcoesDaNC'
import Ajuda from '@/components/Ajuda'
import {
  TIPOLOGIAS,
  CAUSAS,
  ESPINHAS,
  sugestoesIshikawa,
  rotuloTipologia,
  type Espinha,
  type Ishikawa,
} from '@/lib/vocabularioNC'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'
import '../visual.css'

/*
 * Não conformidades e incidentes (supabase/inspecoes.sql e
 * supabase/inspecoes-incidentes.sql).
 *
 * A mesma tela trata os dois porque o que se faz depois é idêntico:
 * ação imediata, causa, ação corretiva e verificação da eficácia — o
 * ciclo que a ISO 45001 e a ISO 9001 pedem no item 10.2.
 *
 * O INCIDENTE É LANÇADO AQUI porque na 45001 ele está no mesmo item:
 * "Incidente, não conformidade e ação corretiva". Acidente e
 * quase-acidente seguem o mesmo caminho do achado de inspeção.
 *
 * Encerrar sem causa e sem ação corretiva o banco recusa — e a tela diz
 * isso antes, para ninguém preencher à toa.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const GRAVIDADE: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
}

const SITUACAO: Record<string, string> = {
  aberta: 'Aberta',
  em_acao: 'Em ação',
  aguardando_verificacao: 'Aguardando verificação',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

/*
 * As quatro etapas do tratamento, nas abas da ficha.
 *
 * POR QUE ABAS E NÃO UMA COLUNA SÓ. Tudo empilhado, a ficha é uma
 * página de vinte campos onde não se vê o que já foi feito nem o que
 * falta: quem abre no meio do tratamento rola para cima e para baixo
 * procurando onde parou. As abas são o ciclo do item 10.2 desenhado —
 * o que aconteceu, por que aconteceu, o que vamos fazer, se adiantou —
 * e a bolinha na aba diz qual delas ainda está vazia.
 *
 * Os botões de salvar e encerrar ficam FORA das abas, sempre à vista:
 * o rascunho é um só, e esconder o botão de salvar atrás da aba certa
 * seria a forma mais rápida de perder o que alguém acabou de digitar.
 */
const ABAS = [
  { chave: 'ocorrencia', rotulo: 'Ocorrência' },
  { chave: 'investigacao', rotulo: 'Investigação' },
  { chave: 'plano', rotulo: 'Plano de ação' },
  { chave: 'verificacao', rotulo: 'Verificação' },
] as const

type AbaFicha = (typeof ABAS)[number]['chave']

const TIPO_INCIDENTE: Record<string, string> = {
  acidente_com_afastamento: 'Acidente com afastamento',
  acidente_sem_afastamento: 'Acidente sem afastamento',
  quase_acidente: 'Quase-acidente',
  doenca_ocupacional: 'Doença ocupacional',
  primeiros_socorros: 'Primeiros socorros',
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type NC = {
  id: string
  empresa_id: string
  inspecao_id: string | null
  codigo: string | null
  origem: string
  local_nome: string | null
  descricao: string
  gravidade: string
  classificacao: string | null
  probabilidade: number | null
  severidade: number | null
  risco: number | null
  porque_1: string | null
  porque_2: string | null
  porque_3: string | null
  porque_4: string | null
  porque_5: string | null
  prazo: string | null
  responsavel_nome: string | null
  acao_imediata: string | null
  /* O assunto, em lista fechada: vem do campo e agrupa o histórico. */
  tipologia: string | null
  /* A causa-raiz em lista fechada. É esta que vira o Pareto; a `causa`
     logo abaixo continua existindo para a frase explicando o caso. */
  causa_classe: string | null
  /* O que poderia ter acontecido, independente do que aconteceu. */
  potencial_fatal: boolean
  impacto_legal: boolean
  impacto_ambiental: boolean
  impacto_financeiro: boolean
  /* As espinhas marcadas na investigação. Rascunho, não indicador. */
  ishikawa: Ishikawa | null
  causa: string | null
  acao_corretiva: string | null
  situacao: string
  eficaz: boolean | null
  verificacao_obs: string | null
  ocorrido_em: string | null
  tipo_incidente: string | null
  envolvido_nome: string | null
  afastamento_dias: number | null
  created_at: string
}

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const hoje = () => new Date().toISOString().slice(0, 10)

/*
 * A mesma tela serve aos dois processos, porque o tratamento é o mesmo
 * — causa, ação corretiva, verificação da eficácia, o ciclo do 10.2.
 * O que NÃO é o mesmo é a lista: constatação de auditoria não aparece
 * em inspeção e vice-versa. Quem separa é o `tipo`, que o banco grava
 * na constatação a partir de quem a abriu.
 */
export function NaoConformidadesConteudo({ tipo }: { tipo: 'inspecao' | 'auditoria' }) {
  const auditoria = tipo === 'auditoria'
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [lista, setLista] = useState<NC[]>([])
  const [soAbertas, setSoAbertas] = useState(true)
  const [escolhida, setEscolhida] = useState<string>('')
  const [rascunho, setRascunho] = useState<Partial<NC>>({})
  const [salvando, setSalvando] = useState(false)
  /* Encerrar é o fim da linha: a tela pergunta de novo antes. */
  const [confirmandoFim, setConfirmandoFim] = useState(false)
  const [aba, setAba] = useState<AbaFicha>('ocorrencia')

  /* Lançar incidente. */
  const [abrindoIncidente, setAbrindoIncidente] = useState(false)
  const [inc, setInc] = useState({
    descricao: '',
    ocorrido_em: '',
    tipo_incidente: 'quase_acidente',
    envolvido_nome: '',
    afastamento_dias: '',
    local_do_evento: '',
  })

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
        .from('nao_conformidades')
        .select(
          'id, empresa_id, inspecao_id, codigo, origem, local_nome, descricao, gravidade, classificacao, prazo, ' +
            'probabilidade, severidade, risco, porque_1, porque_2, porque_3, porque_4, porque_5, ' +
            'responsavel_nome, acao_imediata, causa, acao_corretiva, situacao, eficaz, ' +
            'tipologia, causa_classe, potencial_fatal, impacto_legal, impacto_ambiental, ' +
            'impacto_financeiro, ishikawa, ' +
            'verificacao_obs, ocorrido_em, tipo_incidente, envolvido_nome, afastamento_dias, created_at'
        )
        .eq('tipo', tipo)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) {
          setSemTabela(true)
          return
        }
        throw error
      }

      setLista((data || []) as unknown as NC[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar as não conformidades.')
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
        .filter((n) => !empresaAtual || n.empresa_id === empresaAtual)
        .filter((n) => !soAbertas || !['encerrada', 'cancelada'].includes(n.situacao)),
    [lista, empresaAtual, soAbertas]
  )

  const atual = lista.find((n) => n.id === escolhida) || null

  /*
   * As sugestões da espinha de peixe mudam com o assunto da NC. Numa
   * de altura não faz sentido oferecer "ventilação do espaço
   * confinado" — e lista grande demais ninguém lê.
   */
  const sugestoes = useMemo(
    () => sugestoesIshikawa(rascunho.tipologia || null),
    [rascunho.tipologia]
  )

  /* Toca de novo e desmarca: é rascunho de investigação, não formulário. */
  function marcarEspinha(chave: Espinha, texto: string) {
    const antes = rascunho.ishikawa?.[chave] || []
    const depois = antes.includes(texto) ? antes.filter((t) => t !== texto) : [...antes, texto]
    const espinhas: Ishikawa = { ...(rascunho.ishikawa || {}), [chave]: depois }
    setRascunho({ ...rascunho, ishikawa: espinhas })
  }

  function abrir(n: NC) {
    setEscolhida(n.id)
    setConfirmandoFim(false)
    setAba('ocorrencia')
    setRascunho({
      classificacao: n.classificacao,
      gravidade: n.gravidade,
      probabilidade: n.probabilidade,
      severidade: n.severidade,
      porque_1: n.porque_1,
      porque_2: n.porque_2,
      porque_3: n.porque_3,
      porque_4: n.porque_4,
      porque_5: n.porque_5,
      prazo: n.prazo,
      acao_imediata: n.acao_imediata,
      tipologia: n.tipologia,
      causa_classe: n.causa_classe,
      potencial_fatal: n.potencial_fatal,
      impacto_legal: n.impacto_legal,
      impacto_ambiental: n.impacto_ambiental,
      impacto_financeiro: n.impacto_financeiro,
      ishikawa: n.ishikawa,
      causa: n.causa,
      acao_corretiva: n.acao_corretiva,
      situacao: n.situacao,
      verificacao_obs: n.verificacao_obs,
      eficaz: n.eficaz,
    })
  }

  async function salvar(encerrar: boolean) {
    if (!atual || salvando) return

    if (encerrar && (!rascunho.causa?.trim() || !rascunho.acao_corretiva?.trim())) {
      setErro('Para encerrar, preencha a causa e a ação corretiva.')
      return
    }

    /* Mesma regra do banco, dita antes: risco alto sem nenhum porquê é
       análise que não houve. */
    const risco = Number(rascunho.probabilidade || 0) * Number(rascunho.severidade || 0)
    if (
      encerrar &&
      risco >= 10 &&
      ![1, 2, 3, 4, 5].some((n) => (rascunho[('porque_' + n) as 'porque_1'] || '').trim())
    ) {
      setErro('Risco alto: preencha ao menos o primeiro porquê antes de encerrar.')
      return
    }

    setSalvando(true)
    setErro('')

    const { error } = await supabase
      .from('nao_conformidades')
      .update({
        classificacao: rascunho.classificacao || null,
        gravidade: rascunho.gravidade,
        probabilidade: rascunho.probabilidade || null,
        severidade: rascunho.severidade || null,
        porque_1: rascunho.porque_1 || null,
        porque_2: rascunho.porque_2 || null,
        porque_3: rascunho.porque_3 || null,
        porque_4: rascunho.porque_4 || null,
        porque_5: rascunho.porque_5 || null,
        prazo: rascunho.prazo || null,
        acao_imediata: rascunho.acao_imediata || null,
        tipologia: rascunho.tipologia || null,
        causa_classe: rascunho.causa_classe || null,
        potencial_fatal: !!rascunho.potencial_fatal,
        impacto_legal: !!rascunho.impacto_legal,
        impacto_ambiental: !!rascunho.impacto_ambiental,
        impacto_financeiro: !!rascunho.impacto_financeiro,
        /* Espinha vazia grava null, não `{}`: consulta de histórico
           fica mais simples quando "não investigou" é uma coisa só. */
        ishikawa:
          rascunho.ishikawa && Object.values(rascunho.ishikawa).some((v) => (v || []).length)
            ? rascunho.ishikawa
            : null,
        causa: rascunho.causa || null,
        acao_corretiva: rascunho.acao_corretiva || null,
        verificacao_obs: rascunho.verificacao_obs || null,
        eficaz: encerrar ? (rascunho.eficaz ?? true) : rascunho.eficaz,
        situacao: encerrar ? 'encerrada' : rascunho.situacao,
      })
      .eq('id', atual.id)

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setEscolhida('')
    setConfirmandoFim(false)
    await carregar()
  }

  async function lancarIncidente() {
    if (salvando) return
    if (!empresaAtual) {
      setErro('Escolha a empresa antes de lançar o incidente.')
      return
    }

    setSalvando(true)
    setErro('')

    const { error } = await supabase.from('nao_conformidades').insert({
      empresa_id: empresaAtual,
      origem: 'incidente',
      descricao: inc.descricao,
      ocorrido_em: inc.ocorrido_em ? new Date(inc.ocorrido_em).toISOString() : null,
      tipo_incidente: inc.tipo_incidente,
      envolvido_nome: inc.envolvido_nome || null,
      afastamento_dias: inc.afastamento_dias ? Number(inc.afastamento_dias) : null,
      local_do_evento: inc.local_do_evento || null,
      prazo: hoje(),
    })

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setAbrindoIncidente(false)
    setInc({
      descricao: '',
      ocorrido_em: '',
      tipo_incidente: 'quase_acidente',
      envolvido_nome: '',
      afastamento_dias: '',
      local_do_evento: '',
    })
    await carregar()
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

  /* A bolinha na aba: o que ainda está em branco. É a resposta à
     pergunta que todo mundo faz na frente desta ficha — "falta o quê?"
     — sem precisar abrir as quatro abas para descobrir. */
  const faltando: Record<AbaFicha, boolean> = {
    ocorrencia: false,
    investigacao: !(rascunho.causa || '').trim(),
    plano: !(rascunho.acao_corretiva || '').trim(),
    verificacao: !(rascunho.verificacao_obs || '').trim(),
  }

  /* A ficha de tratamento abre DENTRO da linha, não no fim da página.
   * Com trinta constatações, clicar em "Tratar" e ser jogado para o
   * rodapé faz perder de vista qual item estava sendo tratado — e na
   * volta ninguém sabe onde parou. */
  const ficha =
    atual ? (
        <div className="panel nc-ficha-aberta" style={{ marginTop: 16 }}>
          {/*
            * O cabeçalho da ficha, como no desenho: o código primeiro,
            * as marcas ao lado, e os quatro números que respondem
            * "em que pé está" antes de qualquer aba ser aberta.
            *
            * POR QUE O CÓDIGO VEM ANTES DO TEXTO. É por ele que esta
            * não conformidade é citada em reunião, em e-mail e no
            * relatório de auditoria. O texto da ocorrência muda com as
            * revisões; o número, não.
            *
            * A ficha continua abrindo DENTRO da linha, e não como
            * página separada: com trinta constatações, ser jogado para
            * outra tela faz perder de vista qual item estava sendo
            * tratado. O cabeçalho dá a identidade sem tirar o contexto.
            */}
          <div className="panel-head nc-ficha-topo">
            <div>
              <div className="nc-ficha-marcas">
                <span className="nc-ficha-codigo">{atual.codigo || 'sem número'}</span>
                {atual.potencial_fatal && <span className="pill bad">Potencial fatal</span>}
                {atual.tipologia && (
                  <span className="pill flat">{rotuloTipologia(atual.tipologia)}</span>
                )}
                {atual.impacto_legal && <span className="pill flat">Impacto legal</span>}
                {atual.impacto_ambiental && <span className="pill flat">Impacto ambiental</span>}
                {atual.impacto_financeiro && <span className="pill flat">Impacto financeiro</span>}
              </div>
              <h3 className="nc-ficha-titulo">{atual.descricao}</h3>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setEscolhida('')}>
              Fechar
            </button>
          </div>

          <dl className="nc-ficha-numeros">
            <div>
              <dt>Situação</dt>
              <dd>{SITUACAO[atual.situacao] || atual.situacao}</dd>
            </div>
            <div>
              <dt>Prazo</dt>
              <dd className={atual.prazo && atual.prazo < hoje() && atual.situacao !== 'encerrada' ? 'vencido' : undefined}>
                {atual.prazo ? dataBr(atual.prazo) : 'sem prazo'}
              </dd>
            </div>
            <div>
              <dt>Gravidade</dt>
              <dd>{GRAVIDADE[atual.gravidade] || atual.gravidade}</dd>
            </div>
            <div>
              <dt>Veio de</dt>
              <dd>
                {atual.inspecao_id ? (
                  <a href={'/inspecoes/' + atual.inspecao_id}>Inspeção</a>
                ) : atual.origem === 'incidente' ? (
                  'Incidente'
                ) : (
                  'Apontamento avulso'
                )}
              </dd>
            </div>
          </dl>
          <div className="panel-body insp-ficha">
            <nav className="ficha-abas nao-imprimir" aria-label="Etapas do tratamento">
              {ABAS.map((a) => (
                <button
                  key={a.chave}
                  type="button"
                  className={'ficha-aba' + (aba === a.chave ? ' ativa' : '')}
                  aria-current={aba === a.chave ? 'step' : undefined}
                  onClick={() => setAba(a.chave)}
                >
                  {a.rotulo}
                  {faltando[a.chave] && (
                    <span className="ficha-aba-falta" aria-label="ainda em branco" title="ainda em branco" />
                  )}
                </button>
              ))}
            </nav>

            {aba === 'ocorrencia' && (
            <>
            {/* O assunto costuma vir do campo já preenchido. Fica aqui
                para quem abriu a NC pela mesa, e para corrigir quem
                escolheu errado com o capacete na cabeça. */}
            <label>
              Assunto{' '}
              <Ajuda
                titulo="Assunto do desvio"
                texto="Agrupa o histórico — é o que permite dizer 'metade dos nossos desvios é altura' — e escolhe as sugestões da espinha de peixe na aba de investigação."
              />
              <select
                value={rascunho.tipologia || ''}
                onChange={(e) => setRascunho({ ...rascunho, tipologia: e.target.value })}
              >
                <option value="">Sem assunto definido</option>
                {TIPOLOGIAS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            </label>

            {/*
              * O POTENCIAL, separado da gravidade.
              *
              * Gravidade descreve o que aconteceu; potencial, o que
              * poderia ter acontecido. Um quase-acidente de gravidade
              * baixa pode ter potencial fatal, e misturar os dois é
              * como se perde o aviso que vinha antes do acidente. Os
              * outros três dizem quem mais se interessa pelo caso:
              * jurídico, ambiental e dinheiro.
              */}
            <fieldset className="nc-potencial">
              <legend>
                Se tivesse dado errado{' '}
                <Ajuda
                  titulo="Potencial, não gravidade"
                  texto="Responda pelo que PODERIA ter acontecido. Ninguém se machucou e a gravidade é baixa? Pode ter potencial fatal do mesmo jeito. O painel abre mostrando estes separados de todo o resto, porque são eles que avisam antes."
                />
              </legend>
              <label className={rascunho.potencial_fatal ? ' marcado' : ''}>
                <input
                  type="checkbox"
                  checked={!!rascunho.potencial_fatal}
                  onChange={(e) => setRascunho({ ...rascunho, potencial_fatal: e.target.checked })}
                />
                Podia ter matado alguém
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!rascunho.impacto_legal}
                  onChange={(e) => setRascunho({ ...rascunho, impacto_legal: e.target.checked })}
                />
                Impacto legal
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!rascunho.impacto_ambiental}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, impacto_ambiental: e.target.checked })
                  }
                />
                Impacto ambiental
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!rascunho.impacto_financeiro}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, impacto_financeiro: e.target.checked })
                  }
                />
                Impacto financeiro
              </label>
            </fieldset>

            {/* Numa auditoria, o nível do achado é a primeira decisão e
                muda tudo o que vem depois: a maior trava a certificação,
                a oportunidade de melhoria não pede ação corretiva
                nenhuma. Antes isto só existia no banco. */}
            {auditoria && (
              <label>
                Nível do achado
                <select
                  value={rascunho.classificacao || ''}
                  onChange={(e) => setRascunho({ ...rascunho, classificacao: e.target.value })}
                >
                  <option value="">Sem classificação</option>
                  <option value="maior">Não conformidade maior</option>
                  <option value="menor">Não conformidade menor</option>
                  <option value="observacao">Observação</option>
                  <option value="oportunidade">Oportunidade de melhoria</option>
                </select>
              </label>
            )}

            {atual.origem === 'incidente' && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
                {TIPO_INCIDENTE[atual.tipo_incidente || ''] || 'Incidente'}
                {atual.ocorrido_em
                  ? ' em ' + new Date(atual.ocorrido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : ''}
                {atual.afastamento_dias ? ` · ${atual.afastamento_dias} dia(s) de afastamento` : ''}
              </p>
            )}

            {/* Probabilidade x severidade no lugar de escolher "alta" no
                olho: dá um número que ordena a fila e se defende numa
                auditoria. A gravidade passa a sair daqui. */}
            <div className="duas">
              <label>
                Qual a chance de acontecer?
                <select
                  value={rascunho.probabilidade || ''}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, probabilidade: Number(e.target.value) || null })
                  }
                >
                  <option value="">—</option>
                  <option value={1}>1 · Muito improvável</option>
                  <option value={2}>2 · Improvável</option>
                  <option value={3}>3 · Possível</option>
                  <option value={4}>4 · Provável</option>
                  <option value={5}>5 · Quase certo</option>
                </select>
              </label>
              <label>
                Se acontecer, quão grave é?
                <select
                  value={rascunho.severidade || ''}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, severidade: Number(e.target.value) || null })
                  }
                >
                  <option value="">—</option>
                  <option value={1}>1 · Sem lesão</option>
                  <option value={2}>2 · Primeiros socorros</option>
                  <option value={3}>3 · Afastamento</option>
                  <option value={4}>4 · Lesão permanente</option>
                  <option value={5}>5 · Morte</option>
                </select>
              </label>
            </div>

            {rascunho.probabilidade && rascunho.severidade ? (
              <p style={{ margin: 0, fontSize: 13 }}>
                Risco{' '}
                <strong>{Number(rascunho.probabilidade) * Number(rascunho.severidade)}</strong> —{' '}
                <span
                  className={
                    'pill ' +
                    (Number(rascunho.probabilidade) * Number(rascunho.severidade) >= 15
                      ? 'bad'
                      : Number(rascunho.probabilidade) * Number(rascunho.severidade) >= 10
                        ? 'warn'
                        : 'flat')
                  }
                >
                  {
                    GRAVIDADE[
                      (() => {
                        const r = Number(rascunho.probabilidade) * Number(rascunho.severidade)
                        return r <= 4 ? 'baixa' : r <= 9 ? 'media' : r <= 14 ? 'alta' : 'critica'
                      })()
                    ]
                  }
                </span>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
                Sem a matriz, vale a gravidade atual: {GRAVIDADE[atual.gravidade] || atual.gravidade}.
              </p>
            )}

            <label>
              Prazo
              <input
                type="date"
                value={rascunho.prazo || ''}
                onChange={(e) => setRascunho({ ...rascunho, prazo: e.target.value })}
              />
            </label>

            <label>
              Ação imediata — o que foi feito na hora
              <textarea
                value={rascunho.acao_imediata || ''}
                onChange={(e) => setRascunho({ ...rascunho, acao_imediata: e.target.value })}
                placeholder="Ex.: área isolada e trabalho interrompido"
              />
            </label>

            </>
            )}

            {aba === 'investigacao' && (
            <>
            {/* Cinco porquês: cada resposta tem de explicar a anterior. É
                o que tira a análise de "falta de atenção" e leva até o
                processo, que é onde a ação corretiva funciona. */}
            <div>
              <div className="section-title" style={{ marginBottom: 6 }}>
                Por que aconteceu? (pode parar quando chegar na raiz)
              </div>
              {([1, 2, 3, 4, 5] as const).map((n) => {
                const chave = ('porque_' + n) as 'porque_1'
                const anterior = n === 1 ? null : (rascunho[('porque_' + (n - 1)) as 'porque_1'] || '')
                /* O porquê seguinte só aparece depois do anterior: a tela
                   não começa com cinco caixas vazias intimidando. */
                if (n > 1 && !anterior) return null
                return (
                  <input
                    key={n}
                    type="text"
                    style={{ width: '100%', marginBottom: 6 }}
                    value={(rascunho[chave] as string) || ''}
                    placeholder={n === 1 ? 'Por quê?' : 'E por que isso?'}
                    onChange={(e) => setRascunho({ ...rascunho, [chave]: e.target.value })}
                  />
                )
              })}
            </div>

            {/*
              * A espinha de peixe, com sugestão em vez de caixa vazia.
              *
              * Seis caixas em branco na frente de quem acabou de sair do
              * campo produzem seis caixas em branco. A sugestão não
              * decide nada: lembra o que costuma estar por trás daquele
              * tipo de desvio. Quem investiga toca no que serve, ignora
              * o resto e escreve o que falta.
              */}
            <div>
              <div className="section-title" style={{ marginBottom: 4 }}>
                Espinha de peixe — os 6 M{' '}
                <Ajuda
                  titulo="Para que serve a espinha"
                  texto="Os cinco porquês seguem uma linha só. A espinha abre o caso em seis famílias — método, mão de obra, máquina, material, medição e meio ambiente — para não escapar o lado que ninguém pensou. Toque nas sugestões que servem; o que não estiver na lista, escreva."
                />
              </div>
              <p className="aviso-mini" style={{ marginBottom: 10 }}>
                {rascunho.tipologia
                  ? `Sugestões de ${rotuloTipologia(rascunho.tipologia).toLowerCase()}, mais as que valem para qualquer assunto.`
                  : 'Escolha o assunto na aba Ocorrência para receber sugestões mais próximas do caso.'}
              </p>

              <div className="nc-espinhas">
                {ESPINHAS.map(({ chave, rotulo }) => {
                  const marcadas = rascunho.ishikawa?.[chave] || []
                  /* O que a pessoa escreveu à mão aparece junto das
                     sugestões, senão sumia da tela ao recarregar. */
                  const proprias = marcadas.filter((m) => !sugestoes[chave].includes(m))
                  return (
                    <div key={chave} className="nc-espinha">
                      <h4>{rotulo}</h4>
                      <div className="nc-sugestoes">
                        {[...sugestoes[chave], ...proprias].map((texto) => (
                          <button
                            key={texto}
                            type="button"
                            className={'nc-sug' + (marcadas.includes(texto) ? ' marcada' : '')}
                            aria-pressed={marcadas.includes(texto)}
                            onClick={() => marcarEspinha(chave, texto)}
                          >
                            {texto}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="nc-sug nc-sug-outra"
                          onClick={() => {
                            const texto = window.prompt(`Outra causa em ${rotulo.toLowerCase()}:`)
                            if (texto && texto.trim()) marcarEspinha(chave, texto.trim())
                          }}
                        >
                          + outra
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/*
              * A causa-raiz em dois campos, e são dois de propósito: a
              * lista fechada é o que vira o Pareto do painel — sem ela
              * não há Pareto nenhum —, e a frase é o que o leitor do
              * relatório entende. Uma não substitui a outra.
              */}
            <label>
              Causa raiz — em qual família ela cai{' '}
              <Ajuda
                titulo="Por que lista e não texto"
                texto="Dez pessoas escrevem a mesma causa de dez jeitos, e no fim do ano ninguém consegue dizer qual problema mais repete — que é justamente o que o auditor pergunta. A lista é o que transforma registro em indicador. A frase logo abaixo continua sendo sua."
              />
              <select
                value={rascunho.causa_classe || ''}
                onChange={(e) => setRascunho({ ...rascunho, causa_classe: e.target.value })}
              >
                <option value="">Ainda não classificada</option>
                {CAUSAS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Causa raiz — a conclusão dos porquês
              <textarea
                value={rascunho.causa || ''}
                onChange={(e) => setRascunho({ ...rascunho, causa: e.target.value })}
                placeholder="O que explica o problema, não o que vai ser feito"
              />
            </label>

            </>
            )}

            {aba === 'plano' && (
            <>
            <label>
              Ação corretiva — o que impede de acontecer de novo
              <textarea
                value={rascunho.acao_corretiva || ''}
                onChange={(e) => setRascunho({ ...rascunho, acao_corretiva: e.target.value })}
              />
            </label>

            <AcoesDaNC ncId={atual.id} empresaId={atual.empresa_id} />
            </>
            )}

            {aba === 'verificacao' && (
            <>
            <label>
              Verificação da eficácia
              <textarea
                value={rascunho.verificacao_obs || ''}
                onChange={(e) => setRascunho({ ...rascunho, verificacao_obs: e.target.value })}
                placeholder="O que foi conferido depois, e quando"
              />
            </label>

            <div className="duas">
              <label>
                Situação
                <select
                  value={rascunho.situacao || 'aberta'}
                  onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
                >
                  {['aberta', 'em_acao', 'aguardando_verificacao'].map((s) => (
                    <option key={s} value={s}>
                      {SITUACAO[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="caixa-marcar" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={rascunho.eficaz ?? true}
                  onChange={(e) => setRascunho({ ...rascunho, eficaz: e.target.checked })}
                />
                A ação resolveu
              </label>
            </div>

            {/* Encerrar é o fim da linha: sai da fila, entra na conta da
                eficácia e vira registro de que o problema foi tratado.
                Por isso a tela pergunta de novo, mostrando o que vai
                ficar gravado. */}
            {confirmandoFim ? (
              <div className="banner">
                <div>
                  <strong>Encerrar esta não conformidade?</strong>
                  <div style={{ fontWeight: 500, marginTop: 4 }}>
                    Vai ficar registrado que a causa foi{' '}
                    <em>{(rascunho.causa || '').trim() || '(em branco)'}</em>, que a ação corretiva
                    foi <em>{(rascunho.acao_corretiva || '').trim() || '(em branco)'}</em>, e que a
                    ação {rascunho.eficaz ?? true ? 'resolveu' : 'não resolveu'}.
                    {atual.prazo && atual.prazo < hoje() && ' O prazo já estava vencido.'}
                  </div>
                </div>
              </div>
            ) : null}
            </>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn" disabled={salvando} onClick={() => salvar(false)}>
                Salvar
              </button>

              {confirmandoFim ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={salvando}
                    onClick={() => salvar(true)}
                  >
                    Sim, encerrar
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={salvando}
                    onClick={() => setConfirmandoFim(false)}
                  >
                    Ainda não
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={salvando}
                  onClick={() => {
                    /* A checagem vem antes da pergunta: não adianta
                       confirmar o que o banco vai recusar. */
                    if (!rascunho.causa?.trim() || !rascunho.acao_corretiva?.trim()) {
                      setErro('Para encerrar, preencha a causa e a ação corretiva.')
                      return
                    }
                    setErro('')
                    setConfirmandoFim(true)
                  }}
                >
                  Encerrar
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
              Encerrar exige a causa e a ação corretiva preenchidas. É o que a ISO 45001 e a ISO
              9001 pedem no item 10.2 — fechar sem isso é só arquivar o problema.
            </p>
          </div>
        </div>
    ) : null

  return (
    <div className="app insp-v2">
      <div>
        <p className="eyebrow">{auditoria ? 'AUDITORIAS' : 'INSPEÇÕES'}</p>
        <h1 className="titulo-tela">{auditoria ? 'Constatações' : 'Não conformidades'}</h1>
        <p className="subtitulo-tela">
          {auditoria
            ? 'O que a auditoria constatou, maior e menor, com o tratamento do item 10.2: causa, ação corretiva e verificação da eficácia. Enquanto a constatação não for verificada eficaz, o requisito continua em aberto.'
            : 'O que a inspeção reprovou e os incidentes, com o mesmo tratamento: ação imediata, causa, ação corretiva e verificação da eficácia — o ciclo do item 10.2 da ISO 45001 e da 9001.'}
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={(v) => {
              setEmpresaFiltro(v)
              setEscolhida('')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <label className="caixa-marcar">
          <input type="checkbox" checked={soAbertas} onChange={(e) => setSoAbertas(e.target.checked)} />
          Só as que faltam tratar
        </label>
        <span style={{ flex: 1 }} />
        {/* Acidente e quase-acidente são do mundo de campo. Auditoria de
         * sistema de gestão não lança incidente: ela constata requisito. */}
        {!auditoria && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAbrindoIncidente((a) => !a)}
          >
            {abrindoIncidente ? 'Fechar' : 'Lançar incidente'}
          </button>
        )}
      </div>

      {!auditoria && abrindoIncidente && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Incidente</div>
          </div>
          <div className="panel-body insp-ficha">
            <label>
              O que aconteceu
              <input
                type="text"
                value={inc.descricao}
                onChange={(e) => setInc({ ...inc, descricao: e.target.value })}
                placeholder="Ex.: Trabalhador escorregou na rampa molhada"
              />
            </label>
            <div className="duas">
              <label>
                Quando
                <input
                  type="datetime-local"
                  value={inc.ocorrido_em}
                  onChange={(e) => setInc({ ...inc, ocorrido_em: e.target.value })}
                />
              </label>
              <label>
                Tipo
                <select
                  value={inc.tipo_incidente}
                  onChange={(e) => setInc({ ...inc, tipo_incidente: e.target.value })}
                >
                  {Object.entries(TIPO_INCIDENTE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="duas">
              <label>
                Quem se envolveu
                <input
                  type="text"
                  value={inc.envolvido_nome}
                  onChange={(e) => setInc({ ...inc, envolvido_nome: e.target.value })}
                  placeholder="Nome (pode ser terceiro ou visitante)"
                />
              </label>
              <label>
                Dias de afastamento
                <input
                  type="number"
                  min={0}
                  value={inc.afastamento_dias}
                  disabled={inc.tipo_incidente !== 'acidente_com_afastamento'}
                  onChange={(e) => setInc({ ...inc, afastamento_dias: e.target.value })}
                />
              </label>
            </div>
            <label>
              Onde
              <input
                type="text"
                value={inc.local_do_evento}
                onChange={(e) => setInc({ ...inc, local_do_evento: e.target.value })}
                placeholder="Ex.: Rampa de acesso ao galpão 2"
              />
            </label>
            <button type="button" className="btn btn-primary" disabled={salvando} onClick={lancarIncidente}>
              Lançar
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="empty-state">
          {interno && !empresaFiltro
            ? 'Escolha a empresa para ver as não conformidades.'
            : soAbertas
              ? 'Nada pendente de tratamento.'
              : 'Nenhuma não conformidade registrada.'}
        </p>
      ) : (
        <table className="tabela-colab">
          <thead>
            <tr>
              {/* O código vem primeiro: é por ele que a NC é citada em
                  ata, e-mail e auditoria. */}
              <th style={{ width: 118 }}>
                Número{' '}
                <Ajuda
                  titulo="Para que serve o número"
                  texto="É por ele que a não conformidade é citada em ata, e-mail e auditoria, sem reler a descrição inteira. A sequência é por empresa e por ano, não repete e não pula."
                />
              </th>
              <th>O que foi encontrado</th>
              {/* Em auditoria a pergunta não é "de onde veio" — veio da
                  auditoria, todas vieram. O que importa é se é maior ou
                  menor, que é o que decide a certificação. */}
              <th>{auditoria ? 'Classificação' : 'Origem'}</th>
              {!auditoria && <th>Local</th>}
              {!auditoria && <th>Gravidade</th>}
              <th>Prazo</th>
              <th>Situação</th>
              <th className="acoes" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((n) => {
              const vencida = n.prazo && n.prazo < hoje() && !['encerrada', 'cancelada'].includes(n.situacao)
              return (
                <Fragment key={n.id}>
                <tr>
                  <td className="mono">{n.codigo || '—'}</td>
                  <td className="nome">
                    {n.descricao}
                    {n.envolvido_nome && (
                      <span style={{ fontWeight: 500 }}> · {n.envolvido_nome}</span>
                    )}
                    {/* Aqui e não na coluna de gravidade: a marca vale
                        justamente quando a gravidade é baixa. */}
                    {n.potencial_fatal && (
                      <span className="pill bad" style={{ marginLeft: 6 }}>
                        Potencial fatal
                      </span>
                    )}
                    {n.tipologia && (
                      <span className="nc-assunto">{rotuloTipologia(n.tipologia)}</span>
                    )}
                  </td>
                  <td>
                    {auditoria ? (
                      n.classificacao === 'maior' ? (
                        <span className="pill bad">Maior</span>
                      ) : n.classificacao === 'menor' ? (
                        <span className="pill warn">Menor</span>
                      ) : n.classificacao === 'observacao' ? (
                        <span className="pill flat">Observação</span>
                      ) : n.classificacao === 'oportunidade' ? (
                        <span className="pill flat">Oportunidade</span>
                      ) : (
                        '—'
                      )
                    ) : n.origem === 'incidente' ? (
                      <span className="pill bad">
                        {TIPO_INCIDENTE[n.tipo_incidente || ''] || 'Incidente'}
                      </span>
                    ) : n.origem === 'inspecao' ? (
                      'Inspeção'
                    ) : (
                      'Avulsa'
                    )}
                  </td>
                  {!auditoria && <td>{n.local_nome || '—'}</td>}
                  {!auditoria && <td>{GRAVIDADE[n.gravidade] || n.gravidade}</td>}
                  <td>
                    {vencida ? (
                      <span className="pill warn">{dataBr(n.prazo)}</span>
                    ) : (
                      dataBr(n.prazo)
                    )}
                  </td>
                  <td>{SITUACAO[n.situacao] || n.situacao}</td>
                  <td className="acoes">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => (escolhida === n.id ? setEscolhida('') : abrir(n))}
                    >
                      {escolhida === n.id ? 'Fechar' : 'Tratar'}
                    </button>{' '}
                    {/* A folha para entregar e arquivar. Separada de
                        "Tratar" porque são dois momentos: um é
                        preencher, o outro é mostrar a alguém. */}
                    <a href={'/inspecoes/nc/' + n.id} className="btn btn-sm">
                      Ficha
                    </a>
                  </td>
                </tr>
                {escolhida === n.id && (
                  <tr className="linha-ficha">
                    <td colSpan={auditoria ? 6 : 8}>{ficha}</td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}

    </div>
  )
}

/*
 * O cliente que não contratou vê a vitrine da ferramenta, não uma tela
 * vazia. A equipe interna passa sempre.
 */
export default function NaoConformidades() {
  return (
    <ComModulo modulo="inspecoes">
      <NaoConformidadesConteudo tipo="inspecao" />
    </ComModulo>
  )
}
