'use client'

import { useEffect, useMemo, useState } from 'react'
import Icone from '@/components/Icone'
import Ajuda from '@/components/Ajuda'
import { PREFIXO_ORCAMENTO } from '@/lib/servicos'
import './cursos-ead.css'

/*
 * O catálogo de cursos dentro da vitrine.
 *
 * O QUE ISTO SUBSTITUI. Uma linha só: "Cursos EAD para a equipe —
 * NR-35, NR-12, NR-10 e outros cursos a distância, com certificado".
 * Quem entrava procurando NR-33 não achava NR-33; achava "e outros". O
 * catálogo existe, está pronto, e estava escondido atrás de uma frase.
 *
 * A LISTA NÃO MORA AQUI. Vem de /api/cursos-ead, que busca na
 * plataforma. Preço tem um dono só, e não é esta tela.
 *
 * SE A PLATAFORMA ESTIVER FORA, o bloco não some: ele vira o convite
 * de sempre, sem preço, com o botão de pedir orçamento funcionando.
 */

type Curso = {
  grupo: string
  nome: string
  nivel: string
  descricao: string
  ead: number
  pratica: number
  preco: number
  slug: string
  url: string
  novo: boolean
}

type Catalogo = {
  fora: boolean
  ordemGrupos: string[]
  cursos: Curso[]
  menorPreco: number
  maiorPreco: number
}

const reais = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/* Quantos cursos mostrar antes de "ver todos". Dez é o que cabe sem a
   lista virar rolagem antes de a pessoa decidir filtrar. */
const PRIMEIROS = 10

/*
 * O pedido de orçamento de um curso, já preenchido.
 *
 * Leva o nome, a carga e o preço de tabela para dentro do chamado: sem
 * isso, quem responde precisa procurar de que curso se trata, e o
 * cliente precisa repetir o que já tinha escolhido na tela.
 */
function linkOrcamentoCurso(c: Curso) {
  const carga = c.pratica ? `${c.ead} h a distância + ${c.pratica} h de prática` : `${c.ead} h`

  const q = new URLSearchParams({
    categoria: 'Treinamentos',
    assunto: PREFIXO_ORCAMENTO + c.nome,
    descricao:
      `Gostaríamos de um orçamento do curso: ${c.nome}.\n` +
      `Carga: ${carga}.\n` +
      `Preço de tabela por aluno: ${reais(c.preco)}.\n\n` +
      'Quantos alunos: \nQuando precisa começar: \nObservações (turno, unidade, nota fiscal): ',
  })

  return '/chamados/novo?' + q.toString()
}

export default function CursosEad() {
  const [dados, setDados] = useState<Catalogo | null>(null)
  const [erro, setErro] = useState(false)
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [todos, setTodos] = useState(false)

  useEffect(() => {
    let ativo = true

    fetch('/api/cursos-ead')
      .then((r) => r.json())
      .then((d: Catalogo) => {
        if (ativo) setDados(d)
      })
      .catch(() => {
        if (ativo) setErro(true)
      })

    return () => {
      ativo = false
    }
  }, [])

  const cursos = dados?.cursos || []

  /* Os grupos que realmente têm curso, na ordem que a plataforma
     define, com a contagem de cada um. */
  const grupos = useMemo(() => {
    const conta = new Map<string, number>()
    for (const c of cursos) conta.set(c.grupo, (conta.get(c.grupo) || 0) + 1)

    const ordem = dados?.ordemGrupos || []
    return [...conta.entries()].sort((a, b) => {
      const ia = ordem.indexOf(a[0])
      const ib = ordem.indexOf(b[0])
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a[0].localeCompare(b[0])
    })
  }, [cursos, dados])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return cursos.filter((c) => {
      if (grupo && c.grupo !== grupo) return false
      if (!termo) return true
      return [c.nome, c.nivel, c.grupo, c.descricao].some((campo) =>
        (campo || '').toLowerCase().includes(termo)
      )
    })
  }, [cursos, busca, grupo])

  const visiveis = todos ? filtrados : filtrados.slice(0, PRIMEIROS)

  /*
   * SEM CATÁLOGO, o convite de sempre.
   *
   * A plataforma fora do ar, ou ainda carregando, não pode esconder o
   * caminho do orçamento: o cliente que quer treinar a equipe continua
   * conseguindo pedir.
   */
  if (erro || dados?.fora || (dados && cursos.length === 0)) {
    return (
      <div className="panel contratar-lista">
        <div className="contratar-item">
          <span className="icone-servico">
            <Icone nome="treinamentos" tamanho={24} />
          </span>
          <span className="texto">
            <strong>Cursos EAD para a equipe</strong>
            <span>NR-35, NR-33, NR-10, NR-12 e outros cursos a distância, com certificado.</span>
          </span>
          <a
            href={
              '/chamados/novo?' +
              new URLSearchParams({
                categoria: 'Treinamentos',
                assunto: PREFIXO_ORCAMENTO + 'Cursos EAD para a equipe',
                descricao:
                  'Gostaríamos de um orçamento de cursos EAD.\n\nQuais cursos: \nQuantos alunos: \nQuando precisa começar: ',
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
        <div className="empty-state">Carregando os cursos…</div>
      </div>
    )
  }

  return (
    <div className="cursos-ead">
      <p className="cursos-ead-abre">
        {cursos.length} cursos com certificado, de {reais(dados.menorPreco)} a{' '}
        {reais(dados.maiorPreco)} por aluno. Escolha o curso e peça o orçamento da turma — vira
        um chamado, com prazo de resposta.
      </p>

      <div className="panel cursos-ead-filtros nao-imprimir">
        <label className="cursos-ead-busca">
          <span className="cursos-ead-oculto">Buscar curso</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por NR, nome do curso ou função"
          />
        </label>

        <div className="cursos-ead-grupos">
          <button
            type="button"
            className={'cursos-ead-chip' + (grupo === '' ? ' sel' : '')}
            onClick={() => setGrupo('')}
          >
            Todos · {cursos.length}
          </button>
          {grupos.map(([g, n]) => (
            <button
              key={g}
              type="button"
              className={'cursos-ead-chip' + (grupo === g ? ' sel' : '')}
              onClick={() => setGrupo(g === grupo ? '' : g)}
            >
              {g} · {n}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        {filtrados.length === 0 ? (
          <div className="empty-state">
            Nenhum curso com esse termo. Tente pelo número da NR, como “35”.
          </div>
        ) : (
          <>
            <div className="cursos-ead-rolagem">
              <table className="tabela-colab cursos-ead-tabela">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>
                      Carga{' '}
                      <Ajuda
                        titulo="Carga horária"
                        texto="As horas a distância e, quando a norma exige, as horas de prática presencial. A prática acontece na sua unidade e entra no orçamento."
                      />
                    </th>
                    <th>Por aluno</th>
                    <th className="acoes" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => (
                    <tr key={c.slug}>
                      <td className="nome">
                        {c.nome}
                        <div className="cursos-ead-nivel">
                          {c.nivel}
                          {c.novo && <span className="pill good">novo</span>}
                        </div>
                      </td>
                      <td className="cursos-ead-carga">
                        {c.ead} h
                        {c.pratica > 0 && (
                          <span className="cursos-ead-pratica"> + {c.pratica} h de prática</span>
                        )}
                      </td>
                      <td className="cursos-ead-preco">{reais(c.preco)}</td>
                      <td className="acoes">
                        <a href={linkOrcamentoCurso(c)} className="btn btn-sm btn-primary">
                          Pedir orçamento
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cursos-ead-rodape">
              <span>
                {visiveis.length} de {filtrados.length}
                {filtrados.length === 1 ? ' curso' : ' cursos'}
                {filtrados.length !== cursos.length ? ` (de ${cursos.length} no catálogo)` : ''}
              </span>
              {filtrados.length > PRIMEIROS && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setTodos((v) => !v)}
                >
                  {todos ? 'Mostrar menos' : 'Ver o catálogo inteiro'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* O que acontece depois de pedir. Sem isto, "pedir orçamento"
          parece um formulário que cai no vazio. */}
      <div className="panel cursos-ead-como">
        <div className="section-title">Como funciona</div>
        <ol>
          <li>Você escolhe o curso e diz quantos alunos.</li>
          <li>Vira um chamado, com prazo de resposta — não morre no WhatsApp.</li>
          <li>
            Fechado, cada aluno recebe o acesso por e-mail e você acompanha o andamento em
            Treinamentos.
          </li>
        </ol>
        <p className="cursos-ead-nota">
          Precisa de turma fechada e presencial na sua unidade? Peça o orçamento do mesmo jeito e
          escreva isso na observação.
        </p>
      </div>
    </div>
  )
}
