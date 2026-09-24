'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  email: string | null
  telefone: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  marca: string | null
  status: string
  total_usuarios: number
  total_chamados: number
}

const marcaLabels: Record<string, string> = {
  agilmed: 'ÁgilMed Ocupacional',
  reallife: 'Real Life SSMA',
}

const marcaCores: Record<string, string> = {
  agilmed: '#2563eb',
  reallife: '#0f766e',
}

const formVazio = {
  id: '',
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  email: '',
  telefone: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  marca: '',
  status: 'ativo',
}

function formatarCnpj(valor: string | null) {
  if (!valor) return '—'

  const d = valor.replace(/\D/g, '')

  if (d.length !== 14) return valor

  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [form, setForm] = useState(formVazio)

  const editando = form.id !== ''

  function alterar(campo: keyof typeof formVazio, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function token() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      window.location.href = '/login'
      return null
    }

    return session.access_token
  }

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const acesso = await token()
      if (!acesso) return

      const resposta = await fetch('/api/administracao/empresas', {
        headers: { Authorization: `Bearer ${acesso}` },
      })

      const resultado = await resposta.json()

      if (!resposta.ok) {
        throw new Error(resultado.erro || 'Não foi possível carregar as empresas.')
      }

      setEmpresas(resultado.empresas || [])
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar empresas.')
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

    if (!form.razao_social.trim()) {
      setErro('Informe a razão social.')
      return
    }

    if (!form.marca) {
      setErro('Selecione a marca que atende a empresa.')
      return
    }

    try {
      setSalvando(true)

      const acesso = await token()
      if (!acesso) return

      const resposta = await fetch('/api/administracao/empresas', {
        method: editando ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${acesso}`,
        },
        body: JSON.stringify(form),
      })

      const resultado = await resposta.json()

      if (!resposta.ok) {
        throw new Error(resultado.erro || 'Não foi possível salvar a empresa.')
      }

      setMensagem(
        editando
          ? 'Empresa atualizada.'
          : 'Empresa cadastrada. Agora você já pode criar os usuários dela.'
      )
      setForm(formVazio)
      await carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar empresa.')
    } finally {
      setSalvando(false)
    }
  }

  function editar(empresa: Empresa) {
    setErro('')
    setMensagem('')
    setForm({
      id: empresa.id,
      razao_social: empresa.razao_social || '',
      nome_fantasia: empresa.nome_fantasia || '',
      cnpj: empresa.cnpj || '',
      email: empresa.email || '',
      telefone: empresa.telefone || '',
      endereco: empresa.endereco || '',
      cidade: empresa.cidade || '',
      estado: empresa.estado || '',
      cep: empresa.cep || '',
      marca: empresa.marca || '',
      status: empresa.status || 'ativo',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  const ativas = empresas.filter((e) => e.status === 'ativo').length
  const usuarios = empresas.reduce((s, e) => s + (e.total_usuarios || 0), 0)
  const chamados = empresas.reduce((s, e) => s + (e.total_chamados || 0), 0)

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">Administração</div>

          <h1 style={{ fontSize: 30, marginTop: 6 }}>Empresas</h1>

          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--ink-muted)',
              fontSize: 14,
            }}
          >
            Cadastro das empresas clientes e a marca que atende cada uma.
          </p>
        </div>

        <div className="topbar-spacer" />

        <Link href="/administracao/usuarios" className="btn">
          Usuários
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {mensagem && <div className="banner good">{mensagem}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : empresas.length}</div>
          <div className="lbl">Empresas</div>
        </div>

        <div className="stat good">
          <div className="num">{carregando ? '—' : ativas}</div>
          <div className="lbl">Ativas</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : usuarios}</div>
          <div className="lbl">Usuários vinculados</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : chamados}</div>
          <div className="lbl">Chamados abertos</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">
            {editando ? 'Editar empresa' : 'Nova empresa'}
          </div>

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

        <form onSubmit={salvar} className="panel-body">
          <div className="field-row">
            <div className="field">
              <label>Razão social *</label>
              <input
                value={form.razao_social}
                onChange={(e) => alterar('razao_social', e.target.value)}
                placeholder="Nome registrado da empresa"
              />
            </div>

            <div className="field">
              <label>Nome fantasia</label>
              <input
                value={form.nome_fantasia}
                onChange={(e) => alterar('nome_fantasia', e.target.value)}
                placeholder="Como a empresa é conhecida"
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>CNPJ</label>
              <input
                value={form.cnpj}
                onChange={(e) => alterar('cnpj', e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="field">
              <label>Marca que atende *</label>
              <select
                value={form.marca}
                onChange={(e) => alterar('marca', e.target.value)}
              >
                <option value="">Selecione</option>
                <option value="agilmed">ÁgilMed Ocupacional</option>
                <option value="reallife">Real Life SSMA</option>
              </select>
            </div>

            <div className="field">
              <label>Situação</label>
              <select
                value={form.status}
                onChange={(e) => alterar('status', e.target.value)}
              >
                <option value="ativo">Ativa</option>
                <option value="inativo">Inativa</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => alterar('email', e.target.value)}
                placeholder="contato@empresa.com.br"
              />
            </div>

            <div className="field">
              <label>Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => alterar('telefone', e.target.value)}
                placeholder="(69) 90000-0000"
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Endereço</label>
              <input
                value={form.endereco}
                onChange={(e) => alterar('endereco', e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div className="field">
              <label>Cidade</label>
              <input
                value={form.cidade}
                onChange={(e) => alterar('cidade', e.target.value)}
              />
            </div>

            <div className="field" style={{ maxWidth: 110, minWidth: 90 }}>
              <label>UF</label>
              <input
                value={form.estado}
                maxLength={2}
                onChange={(e) =>
                  alterar('estado', e.target.value.toUpperCase())
                }
              />
            </div>

            <div className="field" style={{ maxWidth: 150, minWidth: 120 }}>
              <label>CEP</label>
              <input
                value={form.cep}
                onChange={(e) => alterar('cep', e.target.value)}
                placeholder="00000-000"
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
                  : 'Cadastrar empresa'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Empresas cadastradas</div>

          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            {empresas.length} no total
          </span>
        </div>

        <div className="panel-body">
          <div className="table-wrap">
            <div className="table-scroll">
              <div
                className="trow thead"
                style={{ gridTemplateColumns: GRADE_EMPRESA }}
              >
                <span>Empresa</span>
                <span>CNPJ</span>
                <span>Marca</span>
                <span>Contato</span>
                <span style={{ textAlign: 'right' }}>Usuários</span>
                <span style={{ textAlign: 'right' }}>Chamados</span>
                <span />
              </div>

              {carregando ? (
                <div className="empty-state">Carregando...</div>
              ) : empresas.length === 0 ? (
                <div className="empty-state">
                  Nenhuma empresa cadastrada ainda. Comece pelo formulário
                  acima.
                </div>
              ) : (
                empresas.map((empresa) => (
                  <div
                    key={empresa.id}
                    className="trow"
                    style={{ gridTemplateColumns: GRADE_EMPRESA }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span className="tname">
                        {empresa.nome_fantasia || empresa.razao_social}
                      </span>

                      {empresa.nome_fantasia && (
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
                          {empresa.razao_social}
                        </span>
                      )}

                      {empresa.status !== 'ativo' && (
                        <span
                          className="pill bad"
                          style={{ marginTop: 4 }}
                        >
                          inativa
                        </span>
                      )}
                    </span>

                    <span className="tcode">
                      {formatarCnpj(empresa.cnpj)}
                    </span>

                    <span>
                      <span
                        className={
                          empresa.marca === 'agilmed'
                            ? 'pill'
                            : 'pill good'
                        }
                      >
                        {marcaLabels[empresa.marca || ''] || '—'}
                      </span>
                    </span>

                    <span className="tmuted" style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {empresa.email || '—'}
                      </span>

                      {empresa.telefone && (
                        <span
                          style={{ display: 'block', fontSize: 11.5 }}
                        >
                          {empresa.telefone}
                        </span>
                      )}
                    </span>

                    <span
                      className="mono"
                      style={{ textAlign: 'right', fontWeight: 600 }}
                    >
                      {empresa.total_usuarios ?? 0}
                    </span>

                    <span
                      className="mono"
                      style={{ textAlign: 'right', fontWeight: 600 }}
                    >
                      {empresa.total_chamados ?? 0}
                    </span>

                    <span className="trow-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => editar(empresa)}
                      >
                        Editar
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const GRADE_EMPRESA =
  'minmax(180px,1.5fr) 150px 140px minmax(150px,1.2fr) 80px 84px 84px'
