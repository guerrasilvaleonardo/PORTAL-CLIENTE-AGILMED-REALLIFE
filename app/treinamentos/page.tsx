'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Barras, Progresso as BarraProgresso, Rosca } from '@/lib/graficos'
import {
  acharProgresso,
  corDoProgresso,
  etapaDoProgresso,
  formatarDataHora,
  normalizarCurso,
  PILL_ETAPA,
  ROTULO_ETAPA,
  type Etapa,
  type Progresso,
} from '@/lib/treinamentos'

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = {
  id: string
  razao_social: string
  nome_fantasia: string | null
}

type Certificado = {
  id: string
  empresa_id: string
  colaborador: string
  funcao: string | null
  email_colaborador: string | null
  curso: string | null
  tipo: string
  validade: string | null
}

type Linha = {
  id: string
  colaborador: string
  funcao: string | null
  email: string | null
  empresaId: string
  empresa: string
  curso: string
  cursoEad: string | null
  progresso: number
  etapa: Etapa
  situacao: string | null
  atualizado: string | null
}

function nomeEmpresa(e: Empresa) {
  return e.nome_fantasia || e.razao_social
}

function csvSeguro(valor: string) {
  return '"' + valor.replace(/"/g, '""') + '"'
}

export default function TreinamentosPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [interno, setInterno] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [progressos, setProgressos] = useState<Progresso[]>([])

  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [busca, setBusca] = useState('')

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
        .select('perfil, empresa_id, ativo')
        .eq('id', user.id)
        .maybeSingle()

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')

      setInterno(ehInterno)

      /*
       * O RLS ja limita o cliente aos certificados da propria
       * empresa. Aqui so montamos a lista de empresas para quem e da
       * equipe interna poder filtrar.
       */
      if (ehInterno) {
        const { data: listaEmpresas } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')

        setEmpresas((listaEmpresas || []) as Empresa[])
      }

      const { data: certs, error: erroCerts } = await supabase
        .from('certificados')
        .select(
          'id, empresa_id, colaborador, funcao, email_colaborador, curso, tipo, validade'
        )
        .order('colaborador')

      if (erroCerts) throw erroCerts

      const { data: prog } = await supabase
        .from('treinamentos_progresso')
        .select('email, curso, progresso, situacao, atualizado_em')

      setCertificados((certs || []) as Certificado[])
      setProgressos((prog || []) as Progresso[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os treinamentos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function atualizarEad() {
    if (atualizando) return

    setErro('')
    setMensagem('')
    setAtualizando(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const resposta = await fetch('/api/cron/treinamentos', {
        headers: {
          authorization: 'Bearer ' + (session?.access_token || ''),
        },
      })

      const corpo = await resposta.json()

      if (!resposta.ok) {
        throw new Error(corpo?.erro || 'Não foi possível atualizar.')
      }

      setMensagem(
        'Progresso atualizado a partir do EAD. ' +
          (corpo?.gravados ?? 0) +
          ' matrícula(s) lida(s).'
      )

      await carregar()
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível atualizar o progresso.')
    } finally {
      setAtualizando(false)
    }
  }

  const empresaPorId = useMemo(() => {
    const mapa: Record<string, string> = {}

    empresas.forEach((e) => {
      mapa[e.id] = nomeEmpresa(e)
    })

    return mapa
  }, [empresas])

  /* Uma linha por certificado, com a matricula do EAD ao lado. */
  const linhas = useMemo<Linha[]>(() => {
    return certificados.map((c) => {
      const registro = acharProgresso(
        c.email_colaborador,
        c.curso,
        progressos
      )

      return {
        id: c.id,
        colaborador: c.colaborador,
        funcao: c.funcao,
        email: c.email_colaborador,
        empresaId: c.empresa_id,
        empresa: empresaPorId[c.empresa_id] || '—',
        curso: c.curso || c.tipo,
        cursoEad: registro?.curso ?? null,
        progresso: registro?.progresso ?? 0,
        etapa: etapaDoProgresso(registro),
        situacao: registro?.situacao ?? null,
        atualizado: registro?.atualizado_em ?? null,
      }
    })
  }, [certificados, progressos, empresaPorId])

  const filtradas = useMemo(() => {
    const termo = normalizarCurso(busca)

    return linhas.filter((l) => {
      if (filtroEmpresa && l.empresaId !== filtroEmpresa) return false
      if (filtroEtapa && l.etapa !== filtroEtapa) return false

      if (filtroCurso && normalizarCurso(l.curso) !== filtroCurso) {
        return false
      }

      if (!termo) return true

      const alvo = normalizarCurso(
        l.colaborador + ' ' + (l.email || '') + ' ' + l.curso
      )

      return alvo.includes(termo)
    })
  }, [linhas, filtroEmpresa, filtroCurso, filtroEtapa, busca])

  const resumo = useMemo(() => {
    const conta = (e: Etapa) => filtradas.filter((l) => l.etapa === e).length

    const comMatricula = filtradas.filter((l) => l.etapa !== 'sem_dados')

    const media =
      comMatricula.length > 0
        ? Math.round(
            comMatricula.reduce((s, l) => s + l.progresso, 0) /
              comMatricula.length
          )
        : 0

    return {
      total: filtradas.length,
      concluido: conta('concluido'),
      andamento: conta('andamento'),
      naoIniciado: conta('nao_iniciado'),
      semDados: conta('sem_dados'),
      media,
    }
  }, [filtradas])

  /* Colaboradores que existem no EAD mas nao tem certificado aqui. */
  const semCadastro = useMemo(() => {
    const cadastrados = new Set(
      certificados
        .map((c) => (c.email_colaborador || '').toLowerCase().trim())
        .filter(Boolean)
    )

    const soltos = new Set(
      progressos
        .map((p) => p.email.toLowerCase().trim())
        .filter((e) => e && !cadastrados.has(e))
    )

    return [...soltos]
  }, [certificados, progressos])

  const porEmpresa = useMemo(() => {
    const mapa: Record<string, { nome: string; soma: number; qtd: number }> = {}

    filtradas.forEach((l) => {
      if (l.etapa === 'sem_dados') return

      if (!mapa[l.empresaId]) {
        mapa[l.empresaId] = { nome: l.empresa, soma: 0, qtd: 0 }
      }

      mapa[l.empresaId].soma += l.progresso
      mapa[l.empresaId].qtd += 1
    })

    return Object.values(mapa)
      .map((e) => ({
        rotulo: e.nome,
        valor: Math.round(e.soma / e.qtd),
        detalhe: e.qtd + ' treinamento(s)',
        cor: corDoProgresso(Math.round(e.soma / e.qtd)),
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [filtradas])

  const porCurso = useMemo(() => {
    const mapa: Record<string, { soma: number; qtd: number }> = {}

    filtradas.forEach((l) => {
      if (l.etapa === 'sem_dados') return

      const chave = l.curso

      if (!mapa[chave]) mapa[chave] = { soma: 0, qtd: 0 }

      mapa[chave].soma += l.progresso
      mapa[chave].qtd += 1
    })

    return Object.entries(mapa)
      .map(([nome, e]) => ({
        rotulo: nome,
        valor: Math.round(e.soma / e.qtd),
        detalhe: e.qtd + ' colaborador(es)',
        cor: corDoProgresso(Math.round(e.soma / e.qtd)),
      }))
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 10)
  }, [filtradas])

  const cursosDisponiveis = useMemo(() => {
    const vistos = new Map<string, string>()

    linhas.forEach((l) => {
      const chave = normalizarCurso(l.curso)

      if (chave && !vistos.has(chave)) vistos.set(chave, l.curso)
    })

    return [...vistos.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [linhas])

  function baixarCsv() {
    const cabecalho = [
      'Colaborador',
      'Funcao',
      'E-mail',
      'Empresa',
      'Curso',
      'Curso no EAD',
      'Progresso (%)',
      'Situacao',
      'Atualizado em',
    ]

    const corpo = filtradas.map((l) =>
      [
        l.colaborador,
        l.funcao || '',
        l.email || '',
        l.empresa,
        l.curso,
        l.cursoEad || '',
        String(l.progresso),
        ROTULO_ETAPA[l.etapa],
        l.atualizado ? formatarDataHora(l.atualizado) : '',
      ]
        .map(csvSeguro)
        .join(';')
    )

    /* O BOM faz o Excel em portugues abrir os acentos corretamente. */
    const conteudo = '﻿' + [cabecalho.map(csvSeguro).join(';'), ...corpo].join('\r\n')

    const url = URL.createObjectURL(
      new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
    )

    const link = document.createElement('a')

    link.href = url
    link.download =
      'treinamentos-' + new Date().toISOString().slice(0, 10) + '.csv'
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <div>
        <div className="section-title">Relatório</div>

        <h1 style={{ fontSize: 30, marginTop: 6 }}>Treinamentos</h1>

        <p
          style={{
            margin: '8px 0 0',
            color: 'var(--ink-muted)',
            fontSize: 14,
          }}
        >
          O andamento de cada colaborador no EAD, por empresa e por curso.
          O progresso vem do Maestrus e é atualizado todo dia de manhã.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {mensagem && <div className="banner good">{mensagem}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : resumo.total}</div>
          <div className="lbl">Treinamentos</div>
        </div>

        <div className={'stat' + (resumo.concluido > 0 ? ' good' : '')}>
          <div className="num">{carregando ? '—' : resumo.concluido}</div>
          <div className="lbl">Concluídos</div>
        </div>

        <div className={'stat' + (resumo.andamento > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : resumo.andamento}</div>
          <div className="lbl">Em andamento</div>
        </div>

        <div className={'stat' + (resumo.naoIniciado > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : resumo.naoIniciado}</div>
          <div className="lbl">Não iniciados</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 14,
        }}
      >
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Situação geral</div>

            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
              {resumo.media}% médio
            </span>
          </div>

          <div className="panel-body">
            <Rosca
              centro={resumo.total}
              legendaCentro="treinamentos"
              fatias={[
                {
                  rotulo: 'Concluídos',
                  valor: resumo.concluido,
                  cor: 'var(--success)',
                },
                {
                  rotulo: 'Em andamento',
                  valor: resumo.andamento,
                  cor: 'var(--amber)',
                },
                {
                  rotulo: 'Não iniciados',
                  valor: resumo.naoIniciado,
                  cor: 'var(--danger)',
                },
                {
                  rotulo: 'Sem matrícula',
                  valor: resumo.semDados,
                  cor: 'var(--ink-faint)',
                },
              ]}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Progresso médio por empresa</div>
          </div>

          <div className="panel-body">
            <Barras
              barras={porEmpresa}
              sufixo="%"
              vazio="Nenhum colaborador com matrícula no EAD."
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="section-title">Cursos que mais travam</div>
          </div>

          <div className="panel-body">
            <Barras
              barras={porCurso}
              sufixo="%"
              vazio="Nenhum curso com matrícula no EAD."
            />
          </div>
        </div>
      </div>

      {!carregando && semCadastro.length > 0 && interno && (
        <div className="banner">
          {semCadastro.length} e-mail(s) com matrícula no EAD sem
          certificado cadastrado aqui: {semCadastro.slice(0, 4).join(', ')}
          {semCadastro.length > 4 ? ' e outros' : ''}.
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Por colaborador</div>

          <div style={{ display: 'flex', gap: 8 }}>
            {interno && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={atualizarEad}
                disabled={atualizando}
              >
                {atualizando ? 'Atualizando...' : 'Atualizar do EAD'}
              </button>
            )}

            <button
              type="button"
              className="btn btn-sm"
              onClick={baixarCsv}
              disabled={filtradas.length === 0}
            >
              Baixar CSV
            </button>
          </div>
        </div>

        <div className="panel-body">
          <div className="filters">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar colaborador, e-mail ou curso"
            />

            {interno && (
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
              >
                <option value="">Todas as empresas</option>

                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {nomeEmpresa(e)}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filtroCurso}
              onChange={(e) => setFiltroCurso(e.target.value)}
            >
              <option value="">Todos os cursos</option>

              {cursosDisponiveis.map(([chave, rotulo]) => (
                <option key={chave} value={chave}>
                  {rotulo}
                </option>
              ))}
            </select>

            <select
              value={filtroEtapa}
              onChange={(e) => setFiltroEtapa(e.target.value)}
            >
              <option value="">Todas as situações</option>
              <option value="concluido">Concluídos</option>
              <option value="andamento">Em andamento</option>
              <option value="nao_iniciado">Não iniciados</option>
              <option value="sem_dados">Sem matrícula</option>
            </select>
          </div>

          <div className="table-wrap">
            <div className="table-scroll">
              <div
                className="trow thead"
                style={{
                  gridTemplateColumns:
                    '1.6fr 1.1fr 1.4fr 150px 120px 110px',
                }}
              >
                <span>Colaborador</span>
                <span>Empresa</span>
                <span>Curso</span>
                <span>Progresso</span>
                <span>Situação</span>
                <span>Atualizado</span>
              </div>

              {carregando ? (
                <div className="empty-state">Carregando...</div>
              ) : filtradas.length === 0 ? (
                <div className="empty-state">
                  {linhas.length === 0
                    ? 'Nenhum certificado cadastrado ainda.'
                    : 'Nenhum treinamento com esses filtros.'}
                </div>
              ) : (
                filtradas.map((l) => (
                  <div
                    key={l.id}
                    className="trow"
                    style={{
                      gridTemplateColumns:
                        '1.6fr 1.1fr 1.4fr 150px 120px 110px',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span className="tname">{l.colaborador}</span>

                      {l.email && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            color: 'var(--ink-faint)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {l.email}
                        </span>
                      )}
                    </span>

                    <span className="tmuted">{l.empresa}</span>

                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block' }}>{l.curso}</span>

                      {l.cursoEad && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            color: 'var(--ink-faint)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          EAD: {l.cursoEad}
                        </span>
                      )}
                    </span>

                    <span>
                      {l.etapa === 'sem_dados' ? (
                        <span style={{ color: 'var(--ink-faint)' }}>—</span>
                      ) : (
                        <BarraProgresso
                          valor={l.progresso}
                          cor={corDoProgresso(l.progresso)}
                        />
                      )}
                    </span>

                    <span>
                      <span className={PILL_ETAPA[l.etapa]}>
                        {ROTULO_ETAPA[l.etapa]}
                      </span>
                    </span>

                    <span
                      className="tmuted"
                      style={{ fontSize: 11.5 }}
                    >
                      {formatarDataHora(l.atualizado)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="footnote">
            {filtradas.length} de {linhas.length} treinamento(s).
          </div>
        </div>
      </div>
    </div>
  )
}
