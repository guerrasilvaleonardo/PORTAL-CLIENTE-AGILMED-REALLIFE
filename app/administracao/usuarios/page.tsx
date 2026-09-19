'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
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
  gestor: 'Gestor',
  atendimento: 'Atendimento',
  cliente: 'Cliente',
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  /* Quando tem id aqui, o mesmo formulário vira tela de edição. */
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cargo, setCargo] = useState('')
  const [perfil, setPerfil] = useState('cliente')
  const [empresaId, setEmpresaId] = useState('')
  const [ativo, setAtivo] = useState(true)

  const editando = editandoId !== null

  function limparFormulario() {
    setEditandoId(null)
    setNome('')
    setEmail('')
    setSenha('')
    setTelefone('')
    setCargo('')
    setPerfil('cliente')
    setEmpresaId('')
    setAtivo(true)
  }

  function editarUsuario(usuario: Usuario) {
    setErro('')
    setMensagem('')
    setEditandoId(usuario.id)
    setNome(usuario.nome || '')
    setEmail(usuario.email || '')
    setSenha('')
    setTelefone(usuario.telefone || '')
    setCargo(usuario.cargo || '')
    setPerfil(usuario.perfil || 'cliente')
    setEmpresaId(usuario.empresa_id || '')
    setAtivo(usuario.ativo !== false)

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

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
          Authorization: 'Bearer ' + session.access_token,
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
          .eq('status', 'ativo')
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

  async function salvar(event: FormEvent) {
    event.preventDefault()

    try {
      setErro('')
      setMensagem('')

      if (!nome.trim()) {
        setErro('Preencha o nome.')
        return
      }

      if (!editando && !email.trim()) {
        setErro('Preencha o e-mail.')
        return
      }

      if (!editando && !senha.trim()) {
        setErro('Defina a senha inicial.')
        return
      }

      if (senha && senha.length < 6) {
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

      setSalvando(true)

      const corpo = editando
        ? {
            id: editandoId,
            nome: nome.trim(),
            telefone: telefone.trim(),
            cargo: cargo.trim(),
            perfil,
            empresa_id: empresaId || null,
            ativo,
            senha: senha || '',
          }
        : {
            nome: nome.trim(),
            email: email.trim(),
            senha,
            telefone: telefone.trim(),
            cargo: cargo.trim(),
            perfil,
            empresa_id: empresaId || null,
          }

      const resposta = await fetch('/api/administracao/usuarios', {
        method: editando ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify(corpo),
      })

      const resultado = await resposta.json()

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            resultado.detalhe ||
            'Não foi possível salvar o usuário.'
        )
      }

      setMensagem(
        editando
          ? resultado.senha_alterada
            ? 'Usuário atualizado e senha redefinida.'
            : 'Usuário atualizado com sucesso.'
          : 'Usuário criado com sucesso.'
      )

      limparFormulario()

      await carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar usuário.')
    } finally {
      setSalvando(false)
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

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <span
              style={{
                padding: '9px 15px',
                borderRadius: 10,
                background: '#0f766e',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Usuários
            </span>

            <Link
              href="/administracao/empresas"
              style={{
                padding: '9px 15px',
                borderRadius: 10,
                background: '#fff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Empresas
            </Link>
          </div>
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
            border: editando ? '2px solid #0f766e' : '1px solid #e2e8f0',
            borderRadius: 18,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: '0 0 6px',
              color: '#0f172a',
              fontSize: 20,
            }}
          >
            {editando ? 'Editar usuário' : 'Novo usuário'}
          </h2>

          <p
            style={{
              margin: '0 0 18px',
              color: '#64748b',
              fontSize: 14,
            }}
          >
            {editando
              ? 'O e-mail não muda. Deixe a senha em branco para manter a atual.'
              : 'A senha definida aqui é a senha inicial de acesso.'}
          </p>

          <form onSubmit={salvar}>
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
                disabled={editando}
                style={
                  editando
                    ? { ...inputStyle, background: '#f1f5f9', color: '#64748b' }
                    : inputStyle
                }
              />

              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={
                  editando
                    ? 'Nova senha (opcional)'
                    : 'Senha inicial'
                }
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
                <option value="gestor">Gestor</option>
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

              {editando && (
                <select
                  value={ativo ? 'ativo' : 'inativo'}
                  onChange={(e) => setAtivo(e.target.value === 'ativo')}
                  style={inputStyle}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo (sem acesso)</option>
                </select>
              )}
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={salvando}
                style={{
                  border: 0,
                  background: '#0f766e',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '12px 18px',
                  fontWeight: 800,
                  cursor: salvando ? 'default' : 'pointer',
                  opacity: salvando ? 0.6 : 1,
                }}
              >
                {salvando
                  ? 'Salvando...'
                  : editando
                    ? 'Salvar alterações'
                    : 'Criar usuário'}
              </button>

              {editando && (
                <button
                  type="button"
                  onClick={limparFormulario}
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    borderRadius: 10,
                    padding: '12px 18px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
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
                  minWidth: 950,
                }}
              >
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Usuário</th>
                    <th style={thStyle}>Empresa</th>
                    <th style={thStyle}>Perfil</th>
                    <th style={thStyle}>Cargo</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {usuarios.map((usuario) => (
                    <tr
                      key={usuario.id}
                      style={
                        editandoId === usuario.id
                          ? { background: '#f0fdfa' }
                          : undefined
                      }
                    >
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

                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => editarUsuario(usuario)}
                          style={{
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#0f766e',
                            borderRadius: 8,
                            padding: '7px 13px',
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
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
