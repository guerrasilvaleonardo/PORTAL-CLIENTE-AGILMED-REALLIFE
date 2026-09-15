'use client'

import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome_fantasia: string
  marca: string | null
}

type Usuario = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  cargo: string | null
  perfil: string
  empresa_id: string | null
  ativo: boolean
  created_at: string
  empresas:
    | {
        id: string
        nome_fantasia: string
        marca: string | null
      }
    | null
}

const perfilLabels: Record<string, string> = {
  admin: 'Administrador',
  atendimento: 'Atendimento',
  cliente: 'Cliente',
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cargo, setCargo] = useState('')
  const [perfil, setPerfil] = useState('cliente')
  const [empresaId, setEmpresaId] = useState('')

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        window.location.href = '/login'
        return
      }

      const resposta = await fetch('/api/administracao/usuarios', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const resultado = await resposta.json()

      if (!resposta.ok) {
        throw new Error(resultado.erro || 'Não foi possível carregar os usuários.')
      }

      setUsuarios(resultado.usuarios || [])

      const { data: empresasData, error: empresasError } =
        await supabase
          .from('empresas')
          .select('id,nome_fantasia,marca')
          .eq('ativo', true)
          .order('nome_fantasia')

      if (empresasError) {
        throw empresasError
      }

      setEmpresas(empresasData || [])
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar administração.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criarUsuario(event: FormEvent) {
    event.preventDefault()

    try {
      setErro('')
      setMensagem('')

      if (!nome.trim() || !email.trim() || !senha.trim()) {
        setErro('Preencha nome, e-mail e senha.')
        return
      }

      if (senha.length < 6) {
        setErro('A senha deve possuir pelo menos 6 caracteres.')
        return
      }

      if (perfil === 'cliente' && !empresaId) {
        setErro('Selecione a empresa do cliente.')
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        window.location.href = '/login'
        return
      }

      const resposta = await fetch('/api/administracao/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          senha,
          telefone: telefone.trim(),
          cargo: cargo.trim(),
          perfil,
          empresa_id: empresaId || null,
        }),
      })

      const resultado = await resposta.json()

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            resultado.detalhe ||
            'Não foi possível criar o usuário.'
        )
      }

      setNome('')
      setEmail('')
      setSenha('')
      setTelefone('')
      setCargo('')
      setPerfil('cliente')
      setEmpresaId('')

      setMensagem('Usuário criado com sucesso.')

      await carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro ao criar usuário.')
    }
  }

  return (
    <main
      style={{
        minHeight: 'calc(100vh - 70px)',
        background: '#f8fafc',
        padding: '32px 24px 60px',
      }}
    >
      <div
        style={{
          maxWidth: 1250,
          margin: '0 auto',
        }}
      >
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

          <h1
            style={{
              margin: '6px 0 0',
              color: '#0f172a',
              fontSize: 32,
            }}
          >
            Usuários
          </h1>

          <p
            style={{
              margin: '9px 0 0',
              color: '#64748b',
            }}
          >
            Gerencie usuários, perfis e empresas do Portal do Cliente.
          </p>
        </div>

        {erro && (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 10,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontWeight: 700,
            }}
          >
            {erro}
          </div>
        )}

        {mensagem && (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 10,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontWeight: 700,
            }}
          >
            {mensagem}
          </div>
        )}

        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 18,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: '0 0 18px',
              color: '#0f172a',
              fontSize: 20,
            }}
          >
            Novo usuário
          </h2>

          <form onSubmit={criarUsuario}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(220px,1fr))',
                gap: 14,
              }}
            >
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                style={inputStyle}
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                style={inputStyle}
              />

              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha inicial"
                style={inputStyle}
              />

              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Telefone"
                style={inputStyle}
              />

              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Cargo"
                style={inputStyle}
              />

              <select
                value={perfil}
                onChange={(e) => setPerfil(e.target.value)}
                style={inputStyle}
              >
                <option value="cliente">Cliente</option>
                <option value="atendimento">Atendimento</option>
                <option value="admin">Administrador</option>
              </select>

              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Selecione a empresa</option>

                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nome_fantasia}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              style={{
                marginTop: 16,
                border: 0,
                background: '#0f766e',
                color: '#fff',
                borderRadius: 10,
                padding: '12px 18px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Criar usuário
            </button>
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
          <div
            style={{
              padding: 20,
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color: '#0f172a',
                  fontSize: 20,
                }}
              >
                Usuários cadastrados
              </h2>

              <div
                style={{
                  marginTop: 5,
                  color: '#64748b',
                  fontSize: 14,
                }}
              >
                {usuarios.length} usuário(s)
              </div>
            </div>

            <button
              type="button"
              onClick={carregar}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                borderRadius: 10,
                padding: '10px 15px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ↻ Atualizar
            </button>
          </div>

          {carregando ? (
            <div
              style={{
                padding: 30,
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              Carregando usuários...
            </div>
          ) : usuarios.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 850,
                }}
              >
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Usuário</th>
                    <th style={thStyle}>Empresa</th>
                    <th style={thStyle}>Perfil</th>
                    <th style={thStyle}>Cargo</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id}>
                      <td style={tdStyle}>
                        <strong>{usuario.nome}</strong>
                        <div
                          style={{
                            color: '#64748b',
                            fontSize: 13,
                            marginTop: 3,
                          }}
                        >
                          {usuario.email || 'Sem e-mail'}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        {usuario.empresas?.nome_fantasia ||
                          'Sem empresa'}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '5px 9px',
                            borderRadius: 999,
                            background:
                              usuario.perfil === 'admin'
                                ? '#ede9fe'
                                : usuario.perfil ===
                                    'atendimento'
                                  ? '#ecfeff'
                                  : '#eff6ff',
                            color:
                              usuario.perfil === 'admin'
                                ? '#6d28d9'
                                : usuario.perfil ===
                                    'atendimento'
                                  ? '#0e7490'
                                  : '#1d4ed8',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {perfilLabels[usuario.perfil] ||
                            usuario.perfil}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {usuario.cargo || '—'}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            color: usuario.ativo
                              ? '#15803d'
                              : '#b91c1c',
                            fontWeight: 800,
                          }}
                        >
                          {usuario.ativo
                            ? 'Ativo'
                            : 'Inativo'}
                        </span>
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
