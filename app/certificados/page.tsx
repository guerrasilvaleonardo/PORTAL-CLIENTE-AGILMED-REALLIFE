'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  funcao: '',
  tipo: '',
  emissao: '',
  validade: '',
  observacoes: '',
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

  if (d === null) return { texto: 'Sem validade', cor: '#64748b', fundo: '#f1f5f9', ordem: 4 }
  if (d < 0) return { texto: `Vencido há ${Math.abs(d)}d`, cor: '#b91c1c', fundo: '#fef2f2', ordem: 0 }
  if (d <= 30) return { texto: `Vence em ${d}d`, cor: '#c2410c', fundo: '#fff7ed', ordem: 1 }
  if (d <= 90) return { texto: `Vence em ${d}d`, cor: '#a16207', fundo: '#fefce8', ordem: 2 }

  return { texto: 'Válido', cor: '#15803d', fundo: '#f0fdf4', ordem: 3 }
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

  const [busca, setBusca] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')

  const [form, setForm] = useState(formVazio)
  const editando = form.id !== ''

  function alterar(campo: keyof typeof formVazio, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
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
          'id, numero, empresa_id, colaborador, funcao, tipo, emissao, validade, observacoes, empresas(nome_fantasia, razao_social)'
        )
        .order('validade', { ascending: true, nullsFirst: false })

      if (error) throw error

      setCertificados(
        (data || []).map((item: any) => ({
          ...item,
          empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas,
        }))
      )
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
        funcao: form.funcao.trim() || null,
        tipo: form.tipo,
        emissao: form.emissao || null,
        validade: form.validade || null,
        observacoes: form.observacoes.trim() || null,
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
      funcao: c.funcao || '',
      tipo: c.tipo,
      emissao: c.emissao || '',
      validade: c.validade || '',
      observacoes: c.observacoes || '',
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

      return [c.colaborador, c.funcao, c.tipo, c.empresas?.nome_fantasia, c.empresas?.razao_social]
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

  return (
    <main
      style={{
        minHeight: 'calc(100vh - 70px)',
        background: '#f8fafc',
        padding: '32px 24px 60px',
      }}
    >
      <div style={{ maxWidth: 1250, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              color: '#0f766e',
              fontSize: 13,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
            }}
          >
            Saúde e segurança
          </div>

          <h1 style={{ margin: '6px 0 0', color: '#0f172a', fontSize: 32 }}>
            Certificados e treinamentos
          </h1>

          <p style={{ margin: '9px 0 0', color: '#64748b' }}>
            {interno
              ? 'Tudo que vence, por empresa e por colaborador — antes de virar problema.'
              : 'Os treinamentos e exames da sua equipe, com o que vence primeiro no topo.'}
          </p>
        </div>

        {erro && <div style={avisoErro}>{erro}</div>}
        {mensagem && <div style={avisoOk}>{mensagem}</div>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <Indicador titulo="Vencidos" valor={indicadores.vencidos} cor="#b91c1c" fundo="#fef2f2" borda="#fecaca" />
          <Indicador titulo="Vencem em 30 dias" valor={indicadores.em30} cor="#c2410c" fundo="#fff7ed" borda="#fed7aa" />
          <Indicador titulo="Vencem em 90 dias" valor={indicadores.em90} cor="#a16207" fundo="#fefce8" borda="#fde68a" />
          <Indicador titulo="Em dia" valor={indicadores.validos} cor="#15803d" fundo="#f0fdf4" borda="#bbf7d0" />
        </div>

        {interno && (
          <section
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 18,
              padding: 22,
              marginBottom: 24,
            }}
          >
            <h2 style={{ margin: '0 0 18px', color: '#0f172a', fontSize: 20 }}>
              {editando ? 'Editar certificado' : 'Novo certificado'}
            </h2>

            <form onSubmit={salvar}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                  gap: 14,
                }}
              >
                <select
                  value={form.empresa_id}
                  onChange={(e) => alterar('empresa_id', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Empresa *</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </option>
                  ))}
                </select>

                <input
                  value={form.colaborador}
                  onChange={(e) => alterar('colaborador', e.target.value)}
                  placeholder="Colaborador *"
                  style={inputStyle}
                />

                <input
                  value={form.funcao}
                  onChange={(e) => alterar('funcao', e.target.value)}
                  placeholder="Função"
                  style={inputStyle}
                />

                <select
                  value={form.tipo}
                  onChange={(e) => alterar('tipo', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Tipo *</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <label style={rotuloCampo}>
                  Emissão
                  <input
                    type="date"
                    value={form.emissao}
                    onChange={(e) => alterar('emissao', e.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label style={rotuloCampo}>
                  Validade
                  <input
                    type="date"
                    value={form.validade}
                    onChange={(e) => alterar('validade', e.target.value)}
                    style={inputStyle}
                  />
                </label>

                <input
                  value={form.observacoes}
                  onChange={(e) => alterar('observacoes', e.target.value)}
                  placeholder="Observações"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                <button type="submit" disabled={salvando} style={botaoPrimario}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Registrar certificado'}
                </button>

                {editando && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(formVazio)
                      setErro('')
                      setMensagem('')
                    }}
                    style={botaoSecundario}
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '18px 22px',
              borderBottom: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
              gap: 12,
            }}
          >
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar colaborador, função ou tipo"
              style={inputStyle}
            />

            {interno && (
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                style={inputStyle}
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
              style={inputStyle}
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
              style={inputStyle}
            >
              <option value="">Todas as situações</option>
              <option value="vencidos">Vencidos</option>
              <option value="30">Vencem em 30 dias</option>
              <option value="90">Vencem em 90 dias</option>
              <option value="validos">Em dia</option>
            </select>
          </div>

          {carregando ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              {certificados.length === 0
                ? 'Nenhum certificado cadastrado ainda.'
                : 'Nenhum certificado com esses filtros.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Colaborador</th>
                    {interno && <th style={thStyle}>Empresa</th>}
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Emissão</th>
                    <th style={thStyle}>Validade</th>
                    <th style={thStyle}>Situação</th>
                    {interno && <th style={thStyle}></th>}
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map((c) => {
                    const s = situacao(c.validade)

                    return (
                      <tr key={c.id}>
                        <td style={tdStyle}>
                          <strong style={{ color: '#0f172a' }}>{c.colaborador}</strong>
                          {c.funcao && (
                            <div style={{ fontSize: 13, color: '#64748b' }}>{c.funcao}</div>
                          )}
                        </td>

                        {interno && (
                          <td style={tdStyle}>
                            {c.empresas?.nome_fantasia || c.empresas?.razao_social || '—'}
                          </td>
                        )}

                        <td style={tdStyle}>{c.tipo}</td>
                        <td style={tdStyle}>{formatarData(c.emissao)}</td>
                        <td style={tdStyle}>{formatarData(c.validade)}</td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '6px 11px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              color: s.cor,
                              background: s.fundo,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.texto}
                          </span>
                        </td>

                        {interno && (
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" onClick={() => editar(c)} style={botaoSecundario}>
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => remover(c)}
                                style={{ ...botaoSecundario, color: '#b91c1c', borderColor: '#fecaca' }}
                              >
                                Remover
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Indicador({
  titulo,
  valor,
  cor,
  fundo,
  borda,
}: {
  titulo: string
  valor: number
  cor: string
  fundo: string
  borda: string
}) {
  return (
    <div
      style={{
        background: fundo,
        border: `1px solid ${borda}`,
        borderRadius: 16,
        padding: 18,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 600 }}>{titulo}</p>
      <p style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 800, color: cor }}>{valor}</p>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '12px 13px',
  background: '#fff',
  color: '#0f172a',
  fontSize: 14,
}

const rotuloCampo = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '.04em',
}

const thStyle = {
  padding: '13px 15px',
  textAlign: 'left' as const,
  fontSize: 12,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  borderBottom: '1px solid #e2e8f0',
}

const tdStyle = {
  padding: '15px',
  borderBottom: '1px solid #f1f5f9',
  color: '#334155',
  fontSize: 14,
}

const botaoPrimario = {
  border: 0,
  borderRadius: 10,
  padding: '12px 20px',
  background: '#0f766e',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
}

const botaoSecundario = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '10px 16px',
  background: '#fff',
  color: '#334155',
  fontSize: 14,
  fontWeight: 700,
}

const avisoErro = {
  marginBottom: 18,
  padding: 14,
  borderRadius: 10,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  fontWeight: 700,
}

const avisoOk = {
  marginBottom: 18,
  padding: 14,
  borderRadius: 10,
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  color: '#15803d',
  fontWeight: 700,
}
