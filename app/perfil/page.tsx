'use client'

import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import type { Marca } from '@/lib/marca'

type Perfil = {
  id: string
  nome: string | null
  email: string | null
  telefone: string | null
  cargo: string | null
  perfil: string | null
  empresa_id: string | null
  ativo: boolean | null
}

type Empresa = {
  id: string
  nome_fantasia: string
  marca: string | null
}

const perfilLabels: Record<string, string> = {
  cliente: 'Cliente',
  atendimento: 'Atendimento',
  admin: 'Administrador',
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [marca, setMarca] = useState<Marca | null>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cargo, setCargo] = useState('')

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function carregarPerfil() {
    try {
      setCarregando(true)
      setErro('')

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
            id,
            nome,
            email,
            telefone,
            cargo,
            perfil,
            empresa_id,
            ativo
          `
        )
        .eq('id', user.id)
        .single()

      if (error) throw error

      const perfilAtual: Perfil = {
        id: data.id,
        nome: data.nome ?? null,
        email: data.email ?? user.email ?? null,
        telefone: data.telefone ?? null,
        cargo: data.cargo ?? null,
        perfil: data.perfil ?? null,
        empresa_id: data.empresa_id ?? null,
        ativo: data.ativo ?? null,
      }

      setPerfil(perfilAtual)
      setNome(perfilAtual.nome ?? '')
      setTelefone(perfilAtual.telefone ?? '')
      setCargo(perfilAtual.cargo ?? '')

      if (perfilAtual.empresa_id) {
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresas')
          .select('id, nome_fantasia, marca')
          .eq('id', perfilAtual.empresa_id)
          .single()

        if (!empresaError && empresaData) {
          setEmpresa(empresaData)

          const marcaAtual = await obterMarcaDaEmpresa()

          setMarca(marcaAtual)
        }
      }
    } catch (error: any) {
      console.error(error)
      setErro(
        error?.message ||
          'Não foi possível carregar os dados do seu perfil.'
      )
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarPerfil()
  }, [])

  async function salvarPerfil(event: FormEvent) {
    event.preventDefault()

    try {
      setSalvando(true)
      setMensagem('')
      setErro('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          telefone: telefone.trim(),
          cargo: cargo.trim(),
        })
        .eq('id', user.id)

      if (error) throw error

      setMensagem('Perfil atualizado com sucesso.')
      await carregarPerfil()
    } catch (error: any) {
      console.error(error)
      setErro(
        error?.message ||
          'Não foi possível atualizar seu perfil.'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function alterarSenha(event: FormEvent) {
    event.preventDefault()

    setMensagem('')
    setErro('')

    if (!novaSenha || novaSenha.length < 6) {
      setErro('A nova senha deve possuir pelo menos 6 caracteres.')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErro('A confirmação da senha não confere.')
      return
    }

    try {
      setSalvandoSenha(true)

      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (error) throw error

      setNovaSenha('')
      setConfirmarSenha('')
      setMensagem('Senha alterada com sucesso.')
    } catch (error: any) {
      console.error(error)
      setErro(
        error?.message ||
          'Não foi possível alterar sua senha.'
      )
    } finally {
      setSalvandoSenha(false)
    }
  }

  const corPrincipal =
    marca === 'agilmed'
      ? '#2563eb'
      : marca === 'reallife'
        ? '#0f766e'
        : '#0f766e'

  if (carregando) {
    return (
      <main
        style={{
          minHeight: 'calc(100vh - 70px)',
          background: '#f8fafc',
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: '0 auto',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          Carregando seu perfil...
        </div>
      </main>
    )
  }

  if (!perfil) {
    return (
      <main
        style={{
          minHeight: 'calc(100vh - 70px)',
          background: '#f8fafc',
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: '0 auto',
            background: '#fff',
            border: '1px solid #fecaca',
            borderRadius: 16,
            padding: 24,
            color: '#991b1b',
          }}
        >
          Não foi possível localizar seu perfil.
        </div>
      </main>
    )
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
          maxWidth: 1000,
          margin: '0 auto',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: corPrincipal,
              fontSize: 13,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
            }}
          >
            Minha conta
          </div>

          <h1
            style={{
              margin: '6px 0 0',
              color: '#0f172a',
              fontSize: 32,
            }}
          >
            Meu perfil
          </h1>

          <p
            style={{
              margin: '9px 0 0',
              color: '#64748b',
            }}
          >
            Visualize e atualize seus dados pessoais.
          </p>
        </div>

        {mensagem && (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 12,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontWeight: 700,
            }}
          >
            {mensagem}
          </div>
        )}

        {erro && (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontWeight: 700,
            }}
          >
            {erro}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
            gap: 20,
          }}
        >
          <form
            onSubmit={salvarPerfil}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 18,
              padding: 24,
            }}
          >
            <h2
              style={{
                margin: '0 0 20px',
                color: '#0f172a',
                fontSize: 20,
              }}
            >
              Dados pessoais
            </h2>

            <label style={labelStyle}>
              Nome
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={inputStyle}
                required
              />
            </label>

            <label style={labelStyle}>
              E-mail
              <input
                value={perfil.email ?? ''}
                disabled
                style={{
                  ...inputStyle,
                  background: '#f8fafc',
                  color: '#64748b',
                }}
              />
              <small style={helpStyle}>
                O e-mail de acesso não pode ser alterado aqui.
              </small>
            </label>

            <label style={labelStyle}>
              Telefone
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Cargo
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Seu cargo"
                style={inputStyle}
              />
            </label>

            <button
              type="submit"
              disabled={salvando}
              style={{
                width: '100%',
                marginTop: 8,
                border: 0,
                borderRadius: 10,
                padding: '13px 16px',
                background: corPrincipal,
                color: '#fff',
                fontWeight: 800,
                cursor: salvando ? 'not-allowed' : 'pointer',
              }}
            >
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <section
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 18,
                padding: 24,
              }}
            >
              <h2
                style={{
                  margin: '0 0 20px',
                  color: '#0f172a',
                  fontSize: 20,
                }}
              >
                Acesso
              </h2>

              <Info titulo="Empresa">
                {empresa?.nome_fantasia ?? 'Não vinculada'}
              </Info>

              <Info titulo="Perfil">
                {perfilLabels[perfil.perfil ?? ''] ??
                  perfil.perfil ??
                  'Não definido'}
              </Info>

              <Info titulo="Status">
                {perfil.ativo === false ? 'Inativo' : 'Ativo'}
              </Info>
            </section>

            <form
              onSubmit={alterarSenha}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 18,
                padding: 24,
              }}
            >
              <h2
                style={{
                  margin: '0 0 20px',
                  color: '#0f172a',
                  fontSize: 20,
                }}
              >
                Segurança
              </h2>

              <label style={labelStyle}>
                Nova senha
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Confirmar nova senha
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) =>
                    setConfirmarSenha(e.target.value)
                  }
                  placeholder="Digite novamente"
                  style={inputStyle}
                />
              </label>

              <button
                type="submit"
                disabled={salvandoSenha}
                style={{
                  width: '100%',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '12px 16px',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 800,
                  cursor: salvandoSenha ? 'not-allowed' : 'pointer',
                }}
              >
                {salvandoSenha
                  ? 'Alterando...'
                  : 'Alterar senha'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}

function Info({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: '#64748b',
          fontWeight: 900,
          textTransform: 'uppercase',
          marginBottom: 5,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          color: '#0f172a',
          fontWeight: 700,
        }}
      >
        {children}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  marginBottom: 16,
  color: '#334155',
  fontSize: 13,
  fontWeight: 800,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 13px',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  background: '#fff',
  color: '#0f172a',
  fontSize: 14,
}

const helpStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 11,
  fontWeight: 500,
}
