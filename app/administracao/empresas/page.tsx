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

  return (
    <main
      style={{
        minHeight: 'calc(100vh - 70px)',
        background: '#f8fafc',
        padding: '32px 24px 60px',
      }}
    >
      <div style={{ maxWidth: 1250, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: '#0f766e',
              fontSize: 13,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
            }}
          >
            Administração
          </div>

          <h1 style={{ margin: '6px 0 0', color: '#0f172a', fontSize: 32 }}>
            Empresas
          </h1>

          <p style={{ margin: '9px 0 0', color: '#64748b' }}>
            Cadastre as empresas clientes e defina qual marca atende cada uma.
          </p>

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <Link href="/administracao/usuarios" style={abaInativa}>
              Usuários
            </Link>
            <span style={abaAtiva}>Empresas</span>
          </div>
        </div>

        {erro && <div style={avisoErro}>{erro}</div>}
        {mensagem && <div style={avisoOk}>{mensagem}</div>}

        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 18,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 20 }}>
            {editando ? 'Editar empresa' : 'Nova empresa'}
          </h2>

          <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: 14 }}>
            A marca define as cores e o nome que o cliente vê ao entrar no portal.
          </p>

          <form onSubmit={salvar}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                gap: 14,
              }}
            >
              <input
                value={form.razao_social}
                onChange={(e) => alterar('razao_social', e.target.value)}
                placeholder="Razão social *"
                style={inputStyle}
              />

              <input
                value={form.nome_fantasia}
                onChange={(e) => alterar('nome_fantasia', e.target.value)}
                placeholder="Nome fantasia"
                style={inputStyle}
              />

              <input
                value={form.cnpj}
                onChange={(e) => alterar('cnpj', e.target.value)}
                placeholder="CNPJ"
                style={inputStyle}
              />

              <select
                value={form.marca}
                onChange={(e) => alterar('marca', e.target.value)}
                style={inputStyle}
              >
                <option value="">Marca que atende *</option>
                <option value="agilmed">ÁgilMed Ocupacional</option>
                <option value="reallife">Real Life SSMA</option>
              </select>

              <input
                type="email"
                value={form.email}
                onChange={(e) => alterar('email', e.target.value)}
                placeholder="E-mail de contato"
                style={inputStyle}
              />

              <input
                value={form.telefone}
                onChange={(e) => alterar('telefone', e.target.value)}
                placeholder="Telefone"
                style={inputStyle}
              />

              <input
                value={form.endereco}
                onChange={(e) => alterar('endereco', e.target.value)}
                placeholder="Endereço"
                style={inputStyle}
              />

              <input
                value={form.cidade}
                onChange={(e) => alterar('cidade', e.target.value)}
                placeholder="Cidade"
                style={inputStyle}
              />

              <input
                value={form.estado}
                onChange={(e) => alterar('estado', e.target.value)}
                placeholder="UF"
                maxLength={2}
                style={inputStyle}
              />

              <input
                value={form.cep}
                onChange={(e) => alterar('cep', e.target.value)}
                placeholder="CEP"
                style={inputStyle}
              />

              <select
                value={form.status}
                onChange={(e) => alterar('status', e.target.value)}
                style={inputStyle}
              >
                <option value="ativo">Ativa</option>
                <option value="inativo">Inativa</option>
              </select>
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button type="submit" disabled={salvando} style={botaoPrimario}>
                {salvando
                  ? 'Salvando...'
                  : editando
                    ? 'Salvar alterações'
                    : 'Cadastrar empresa'}
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

        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 22px', borderBottom: '1px solid #e2e8f0' }}>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>
              Empresas cadastradas
            </h2>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
              {carregando
                ? 'Carregando...'
                : `${empresas.length} empresa(s)`}
            </p>
          </div>

          {!carregando && empresas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              Nenhuma empresa cadastrada ainda.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Empresa</th>
                    <th style={thStyle}>CNPJ</th>
                    <th style={thStyle}>Marca</th>
                    <th style={thStyle}>Usuários</th>
                    <th style={thStyle}>Chamados</th>
                    <th style={thStyle}>Situação</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>

                <tbody>
                  {empresas.map((empresa) => (
                    <tr key={empresa.id}>
                      <td style={tdStyle}>
                        <strong style={{ color: '#0f172a' }}>
                          {empresa.nome_fantasia || empresa.razao_social}
                        </strong>
                        {empresa.nome_fantasia && (
                          <div style={{ fontSize: 13, color: '#64748b' }}>
                            {empresa.razao_social}
                          </div>
                        )}
                      </td>

                      <td style={tdStyle}>{formatarCnpj(empresa.cnpj)}</td>

                      <td style={tdStyle}>
                        {empresa.marca ? (
                          <span
                            style={{
                              padding: '5px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#fff',
                              background: marcaCores[empresa.marca] || '#64748b',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {marcaLabels[empresa.marca] || empresa.marca}
                          </span>
                        ) : (
                          <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                            sem marca
                          </span>
                        )}
                      </td>

                      <td style={tdStyle}>{empresa.total_usuarios}</td>
                      <td style={tdStyle}>{empresa.total_chamados}</td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              empresa.status === 'ativo' ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {empresa.status === 'ativo' ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => editar(empresa)}
                          style={botaoSecundario}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
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

const abaAtiva = {
  padding: '9px 15px',
  borderRadius: 10,
  background: '#0f766e',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
}

const abaInativa = {
  padding: '9px 15px',
  borderRadius: 10,
  background: '#fff',
  border: '1px solid #cbd5e1',
  color: '#334155',
  fontSize: 14,
  fontWeight: 700,
  textDecoration: 'none',
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
