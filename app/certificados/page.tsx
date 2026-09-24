'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Progresso as BarraProgressoUi } from '@/lib/graficos'
import {
  acharProgresso,
  corDoProgresso,
  CURSOS,
  formatarDataHora,
  normalizarCurso,
  type Progresso,
} from '@/lib/treinamentos'

type Empresa = {
  id: string
  razao_social: string
  nome_fantasia: string | null
}

type Certificado = {
  id: string
  numero: number
  empresa_id: string
  colaborador: string
  funcao: string | null
  tipo: string
  emissao: string | null
  validade: string | null
  observacoes: string | null
  link_certificado: string | null
  email_colaborador: string | null
  curso: string | null
  empresas?: { nome_fantasia: string | null; razao_social: string } | null
}

const TIPOS = [
  'NR-35 — Trabalho em Altura',
  'NR-33 — Espaços Confinados',
  'NR-10 — Segurança em Instalações Elétricas',
  'NR-12 — Segurança em Máquinas e Equipamentos',
  'NR-20 — Inflamáveis e Combustíveis',
  'NR-18 — Construção Civil',
  'NR-06 — Uso de EPI',
  'Brigada de Incêndio',
  'CIPA — Capacitação',
  'Primeiros Socorros',
  'ASO — Atestado de Saúde Ocupacional',
  'Outro',
]


const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const formVazio = {
  id: '',
  empresa_id: '',
  colaborador: '',
  email_colaborador: '',
  curso: '',
  funcao: '',
  tipo: '',
  emissao: '',
  validade: '',
  observacoes: '',
  link_certificado: '',
}

/*
 * O link chega de varias formas. Guardamos sempre com http(s) na
 * frente para o navegador abrir em vez de tratar como caminho interno.
 */
function normalizarLink(texto: string) {
  const limpo = (texto || '').trim()

  if (!limpo) return null

  return /^https?:\/\//i.test(limpo) ? limpo : 'https://' + limpo
}

function diasAte(validade: string | null) {
  if (!validade) return null

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const alvo = new Date(validade + 'T00:00:00')

  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

function situacao(validade: string | null) {
  const d = diasAte(validade)

  if (d === null) return { texto: 'Sem validade', pill: 'pill flat' }
  if (d < 0) return { texto: 'Vencido há ' + Math.abs(d) + 'd', pill: 'pill bad' }
  if (d <= 30) return { texto: 'Vence em ' + d + 'd', pill: 'pill bad' }
  if (d <= 90) return { texto: 'Vence em ' + d + 'd', pill: 'pill warn' }

  return { texto: 'Válido', pill: 'pill good' }
}

function formatarData(valor: string | null) {
  if (!valor) return '—'

  const [a, m, d] = valor.split('-')

  return `${d}/${m}/${a}`
}

export default function CertificadosPage() {
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [progressos, setProgressos] = useState<Progresso[]>([])
  const [atualizandoEad, setAtualizandoEad] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')

  const [form, setForm] = useState(formVazio)
  const editando = form.id !== ''

  function alterar(campo: keyof typeof formVazio, valor: string) {
    /*
     * O curso e sempre gravado em MAIUSCULAS, mesmo quando digitado
     * a mao. O e-mail e sempre em minusculas, para casar com o EAD.
     */
    const tratado =
      campo === 'curso'
        ? valor.toUpperCase()
        : campo === 'email_colaborador'
          ? valor.toLowerCase().trim()
          : valor

    setForm((atual) => ({ ...atual, [campo]: tratado }))
  }

  /* A mesma regra usada no relatorio de Treinamentos. */
  function progressoDe(c: Certificado) {
    return acharProgresso(c.email_colaborador, c.curso, progressos)
  }

  async function atualizarEad() {
    if (atualizandoEad) return

    setErro('')
    setMensagem('')
    setAtualizandoEad(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const resposta = await fetch('/api/cron/treinamentos', {
        headers: { Authorization: 'Bearer ' + (session?.access_token || '') },
      })

      const corpo = await resposta.json()

      if (!resposta.ok || corpo?.sucesso === false) {
        setErro(corpo?.erro || 'Não foi possível ler a plataforma de ensino.')
        return
      }

      const semCadastro: string[] = corpo?.sem_cadastro_no_ead || []

      setMensagem(
        'Progresso atualizado: ' +
          (corpo?.registros ?? 0) +
          ' matrícula(s).' +
          (semCadastro.length
            ? ' Sem matrícula no EAD: ' + semCadastro.join(', ') + '.'
            : '')
      )

      await carregar()
    } catch (e: any) {
      console.error(e)
      setErro('Não foi possível falar com a plataforma de ensino.')
    } finally {
      setAtualizandoEad(false)
    }
  }

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

      if (ehInterno) {
        const { data: empresasData } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')

        setEmpresas(empresasData || [])
      }

      const { data, error } = await supabase
        .from('certificados')
        .select(
          'id, numero, empresa_id, colaborador, funcao, tipo, emissao, validade, observacoes, link_certificado, email_colaborador, curso, empresas(nome_fantasia, razao_social)'
        )
        .order('validade', { ascending: true, nullsFirst: false })

      if (error) throw error

      setCertificados(
        (data || []).map((item: any) => ({
          ...item,
          empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas,
        }))
      )

      const { data: progressoData } = await supabase
        .from('treinamentos_progresso')
        .select('email, curso, progresso, situacao, atualizado_em')

      setProgressos((progressoData || []) as Progresso[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os certificados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(event: FormEvent) {
    event.preventDefault()

    if (salvando) return

    setErro('')
    setMensagem('')

    if (!form.empresa_id) {
      setErro('Selecione a empresa.')
      return
    }

    if (!form.colaborador.trim()) {
      setErro('Informe o nome do colaborador.')
      return
    }

    if (!form.tipo) {
      setErro('Selecione o tipo de certificado.')
      return
    }

    try {
      setSalvando(true)

      const registro = {
        empresa_id: form.empresa_id,
        colaborador: form.colaborador.trim(),
        email_colaborador: form.email_colaborador.trim().toLowerCase() || null,
        curso: form.curso.trim().toUpperCase() || null,
        funcao: form.funcao.trim() || null,
        tipo: form.tipo,
        emissao: form.emissao || null,
        validade: form.validade || null,
        observacoes: form.observacoes.trim() || null,
        link_certificado: normalizarLink(form.link_certificado),
      }

      if (editando) {
        const { error } = await supabase
          .from('certificados')
          .update(registro)
          .eq('id', form.id)

        if (error) throw error

        setMensagem('Certificado atualizado.')
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { error } = await supabase
          .from('certificados')
          .insert({ ...registro, criado_por: user?.id || null })

        if (error) throw error

        setMensagem('Certificado registrado.')
      }

      setForm(formVazio)
      await carregar()
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível salvar o certificado.')
    } finally {
      setSalvando(false)
    }
  }

  function editar(c: Certificado) {
    setErro('')
    setMensagem('')
    setForm({
      id: c.id,
      empresa_id: c.empresa_id,
      colaborador: c.colaborador,
      email_colaborador: c.email_colaborador || '',
      curso: c.curso || '',
      funcao: c.funcao || '',
      tipo: c.tipo,
      emissao: c.emissao || '',
      validade: c.validade || '',
      observacoes: c.observacoes || '',
      link_certificado: c.link_certificado || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remover(c: Certificado) {
    setErro('')
    setMensagem('')

    const { error } = await supabase.from('certificados').delete().eq('id', c.id)

    if (error) {
      setErro('Não foi possível remover o certificado.')
      return
    }

    setMensagem(`Certificado de ${c.colaborador} removido.`)
    await carregar()
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return certificados.filter((c) => {
      if (filtroEmpresa && c.empresa_id !== filtroEmpresa) return false
      if (filtroTipo && c.tipo !== filtroTipo) return false

      if (filtroSituacao) {
        const d = diasAte(c.validade)

        if (filtroSituacao === 'vencidos' && !(d !== null && d < 0)) return false
        if (filtroSituacao === '30' && !(d !== null && d >= 0 && d <= 30)) return false
        if (filtroSituacao === '90' && !(d !== null && d >= 0 && d <= 90)) return false
        if (filtroSituacao === 'validos' && !(d !== null && d > 90)) return false
      }

      if (!termo) return true

      return [
        c.colaborador,
        c.email_colaborador,
        c.curso,
        c.funcao,
        c.tipo,
        c.empresas?.nome_fantasia,
        c.empresas?.razao_social,
      ]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
  }, [certificados, busca, filtroEmpresa, filtroTipo, filtroSituacao])

  const indicadores = useMemo(() => {
    let vencidos = 0
    let em30 = 0
    let em90 = 0
    let validos = 0

    for (const c of certificados) {
      const d = diasAte(c.validade)

      if (d === null) continue
      if (d < 0) vencidos += 1
      else if (d <= 30) em30 += 1
      else if (d <= 90) em90 += 1
      else validos += 1
    }

    return { vencidos, em30, em90, validos }
  }, [certificados])


  const grade = interno ? GRADE_CERT_INTERNO : GRADE_CERT_CLIENTE

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">
            {interno ? 'Todos os clientes' : 'Sua empresa'}
          </div>

          <h1 style={{ fontSize: 30, marginTop: 6 }}>Certificados</h1>

          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--ink-muted)',
              fontSize: 14,
            }}
          >
            Treinamentos e exames por colaborador, com o que vence primeiro
            no topo.
          </p>
        </div>

        <div className="topbar-spacer" />

        <Link href="/treinamentos" className="btn">
          Relatório de treinamentos
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {mensagem && <div className="banner good">{mensagem}</div>}

      <div className="stats">
        <div
          className={'stat' + (indicadores.vencidos > 0 ? ' bad' : '')}
        >
          <div className="num">
            {carregando ? '—' : indicadores.vencidos}
          </div>
          <div className="lbl">Vencidos</div>
        </div>

        <div className={'stat' + (indicadores.em30 > 0 ? ' bad' : '')}>
          <div className="num">{carregando ? '—' : indicadores.em30}</div>
          <div className="lbl">Vencem em 30 dias</div>
        </div>

        <div className={'stat' + (indicadores.em90 > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : indicadores.em90}</div>
          <div className="lbl">Vencem em 90 dias</div>
        </div>

        <div className="stat good">
          <div className="num">
            {carregando ? '—' : indicadores.validos}
          </div>
          <div className="lbl">Em dia</div>
        </div>
      </div>

      {interno && (
        <div className="panel">
          <div className="panel-head">
            <div className="section-title">
              {editando ? 'Editar certificado' : 'Novo certificado'}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={atualizarEad}
                disabled={atualizandoEad}
              >
                {atualizandoEad
                  ? 'Atualizando...'
                  : 'Atualizar progresso do EAD'}
              </button>

              {editando && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setForm(formVazio)
                    setErro('')
                    setMensagem('')
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </div>

          <form onSubmit={salvar} className="panel-body">
            <div className="field-row">
              <div className="field">
                <label>Empresa *</label>
                <select
                  value={form.empresa_id}
                  onChange={(e) => alterar('empresa_id', e.target.value)}
                >
                  <option value="">Selecione</option>

                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Colaborador *</label>
                <input
                  value={form.colaborador}
                  onChange={(e) => alterar('colaborador', e.target.value)}
                  placeholder="Nome de quem fez o treinamento"
                />
              </div>

              <div className="field">
                <label>Função</label>
                <input
                  value={form.funcao}
                  onChange={(e) => alterar('funcao', e.target.value)}
                  placeholder="Cargo na empresa"
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>E-mail do colaborador</label>
                <input
                  type="email"
                  value={form.email_colaborador}
                  onChange={(e) =>
                    alterar('email_colaborador', e.target.value)
                  }
                  placeholder="É por ele que buscamos o progresso no EAD"
                />
              </div>

              <div className="field">
                <label>Curso no EAD</label>
                <input
                  list="lista-cursos"
                  value={form.curso}
                  onChange={(e) => alterar('curso', e.target.value)}
                  placeholder="Escolha ou digite — grava em MAIÚSCULAS"
                />

                <datalist id="lista-cursos">
                  {CURSOS.map((curso) => (
                    <option key={curso} value={curso} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => alterar('tipo', e.target.value)}
                >
                  <option value="">Selecione</option>

                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Emissão</label>
                <input
                  type="date"
                  value={form.emissao}
                  onChange={(e) => alterar('emissao', e.target.value)}
                />
              </div>

              <div className="field">
                <label>Validade</label>
                <input
                  type="date"
                  value={form.validade}
                  onChange={(e) => alterar('validade', e.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Observações</label>
                <input
                  value={form.observacoes}
                  onChange={(e) => alterar('observacoes', e.target.value)}
                  placeholder="Anotação livre"
                />
              </div>

              <div className="field">
                <label>Link do certificado</label>
                <input
                  value={form.link_certificado}
                  onChange={(e) =>
                    alterar('link_certificado', e.target.value)
                  }
                  placeholder="Endereço do arquivo, se houver"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={salvando}
              >
                {salvando
                  ? 'Salvando...'
                  : editando
                    ? 'Salvar alterações'
                    : 'Registrar certificado'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Certificados</div>

          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            {filtrados.length} de {certificados.length}
          </span>
        </div>

        <div className="panel-body">
          <div className="filters">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar colaborador, função ou curso"
            />

            {interno && (
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
              >
                <option value="">Todas as empresas</option>

                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos os tipos</option>

              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
            >
              <option value="">Todas as situações</option>
              <option value="vencidos">Vencidos</option>
              <option value="30">Vencem em 30 dias</option>
              <option value="90">Vencem em 90 dias</option>
              <option value="validos">Em dia</option>
            </select>
          </div>

          <div className="table-wrap">
            <div className="table-scroll">
              <div
                className="trow thead"
                style={{ gridTemplateColumns: grade }}
              >
                <span>Colaborador</span>
                {interno && <span>Empresa</span>}
                <span>Tipo</span>
                <span>Curso no EAD</span>
                <span>Progresso</span>
                <span>Validade</span>
                <span>Situação</span>
                {interno && <span />}
              </div>

              {carregando ? (
                <div className="empty-state">Carregando...</div>
              ) : filtrados.length === 0 ? (
                <div className="empty-state">
                  {certificados.length === 0
                    ? 'Nenhum certificado cadastrado ainda.'
                    : 'Nenhum certificado com esses filtros.'}
                </div>
              ) : (
                filtrados.map((c) => {
                  const s = situacao(c.validade)
                  const registro = progressoDe(c)

                  return (
                    <div
                      key={c.id}
                      className="trow"
                      style={{ gridTemplateColumns: grade }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span className="tname">{c.colaborador}</span>

                        {c.funcao && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11.5,
                              color: 'var(--ink-muted)',
                            }}
                          >
                            {c.funcao}
                          </span>
                        )}

                        {c.email_colaborador && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11.5,
                              color: 'var(--ink-faint)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.email_colaborador}
                          </span>
                        )}

                        {c.link_certificado && (
                          <a
                            href={c.link_certificado}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-block',
                              marginTop: 3,
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: 'var(--primary)',
                            }}
                          >
                            Abrir certificado
                          </a>
                        )}
                      </span>

                      {interno && (
                        <span className="tmuted" style={{ minWidth: 0 }}>
                          {c.empresas?.nome_fantasia ||
                            c.empresas?.razao_social ||
                            '—'}
                        </span>
                      )}

                      <span className="tmuted" style={{ minWidth: 0 }}>
                        {c.tipo}
                      </span>

                      <span style={{ minWidth: 0 }}>
                        {c.curso ? (
                          <span style={{ display: 'block' }}>{c.curso}</span>
                        ) : (
                          <span style={{ color: 'var(--ink-faint)' }}>—</span>
                        )}

                        {registro && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11,
                              color: 'var(--ink-faint)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatarDataHora(registro.atualizado_em)}
                          </span>
                        )}
                      </span>

                      <span>
                        {registro ? (
                          <BarraProgressoUi
                            valor={registro.progresso}
                            cor={corDoProgresso(registro.progresso)}
                            largura={70}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--ink-faint)',
                            }}
                          >
                            sem dados
                          </span>
                        )}
                      </span>

                      <span className="tmuted">
                        {formatarData(c.validade)}
                      </span>

                      <span>
                        <span className={s.pill}>{s.texto}</span>
                      </span>

                      {interno && (
                        <span className="trow-actions">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => editar(c)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => remover(c)}
                            style={{
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            Remover
                          </button>
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/*
 * O cliente nao ve a coluna de empresa nem os botoes de acao, entao
 * a grade precisa ter exatamente as colunas que foram renderizadas —
 * senao a tabela desalinha do cabecalho.
 */
const GRADE_CERT_INTERNO =
  'minmax(180px,1.4fr) minmax(120px,1fr) minmax(140px,1.1fr) minmax(130px,1.1fr) 130px 100px 120px 150px'

const GRADE_CERT_CLIENTE =
  'minmax(180px,1.4fr) minmax(140px,1.1fr) minmax(130px,1.1fr) 130px 100px 120px'
