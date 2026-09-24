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


  const internos = usuarios.filter(
    (u) => u.perfil !== 'cliente' && u.ativo
  ).length

  const clientes = usuarios.filter(
    (u) => u.perfil === 'cliente' && u.ativo
  ).length

  const inativos = usuarios.filter((u) => !u.ativo).length

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">Administração</div>

          <h1 style={{ fontSize: 30, marginTop: 6 }}>Usuários</h1>

          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--ink-muted)',
              fontSize: 14,
            }}
          >
            Acessos da equipe interna e dos clientes, por perfil.
          </p>
        </div>

        <div className="topbar-spacer" />

        <Link href="/administracao/empresas" className="btn">
          Empresas
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {mensagem && <div className="banner good">{mensagem}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{carregando ? '—' : usuarios.length}</div>
          <div className="lbl">Usuários</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : internos}</div>
          <div className="lbl">Equipe interna</div>
        </div>

        <div className="stat">
          <div className="num">{carregando ? '—' : clientes}</div>
          <div className="lbl">Clientes</div>
        </div>

        <div className={'stat' + (inativos > 0 ? ' warn' : '')}>
          <div className="num">{carregando ? '—' : inativos}</div>
          <div className="lbl">Inativos</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">
            {editando ? 'Editar usuário' : 'Novo usuário'}
          </div>

          {editando && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={limparFormulario}
            >
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={salvar} className="panel-body">
          <div className="field-row">
            <div className="field">
              <label>Nome completo *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome de quem vai acessar"
              />
            </div>

            <div className="field">
              <label>E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com.br"
                disabled={editando}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>
                {editando ? 'Nova senha (opcional)' : 'Senha inicial *'}
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={
                  editando
                    ? 'Deixe em branco para manter a atual'
                    : 'Mínimo de 6 caracteres'
                }
              />
            </div>

            <div className="field">
              <label>Telefone</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(69) 90000-0000"
              />
            </div>

            <div className="field">
              <label>Cargo</label>
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Função na empresa"
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Perfil de acesso *</label>
              <select
                value={perfil}
                onChange={(e) => setPerfil(e.target.value)}
              >
                <option value="cliente">Cliente</option>
                <option value="atendimento">Atendimento</option>
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="field">
              <label>
                Empresa {perfil === 'cliente' ? '*' : '(opcional)'}
              </label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
              >
                <option value="">
                  {perfil === 'cliente'
                    ? 'Selecione a empresa'
                    : 'Sem vínculo'}
                </option>

                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome_fantasia}
                  </option>
                ))}
              </select>
            </div>

            {editando && (
              <div className="field">
                <label>Situação</label>
                <select
                  value={ativo ? 'ativo' : 'inativo'}
                  onChange={(e) => setAtivo(e.target.value === 'ativo')}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            )}
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
                  : 'Criar usuário'}
            </button>
          </div>

          {!editando && (
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: 'var(--ink-muted)',
              }}
            >
              A pessoa recebe por e-mail o endereço do portal e a senha
              inicial que você definiu aqui.
            </p>
          )}
        </form>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="section-title">Usuários cadastrados</div>

          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            {usuarios.length} no total
          </span>
        </div>

        <div className="panel-body">
          <div className="table-wrap">
            <div className="table-scroll">
              <div
                className="trow thead"
                style={{ gridTemplateColumns: GRADE_USUARIO }}
              >
                <span>Pessoa</span>
                <span>Perfil</span>
                <span>Empresa</span>
                <span>Contato</span>
                <span>Situação</span>
                <span />
              </div>

              {carregando ? (
                <div className="empty-state">Carregando...</div>
              ) : usuarios.length === 0 ? (
                <div className="empty-state">
                  Nenhum usuário cadastrado ainda.
                </div>
              ) : (
                usuarios.map((u) => (
                  <div
                    key={u.id}
                    className="trow"
                    style={{ gridTemplateColumns: GRADE_USUARIO }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span className="tname">{u.nome || 'Sem nome'}</span>

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
                        {u.email || '—'}
                      </span>
                    </span>

                    <span>
                      <span
                        className={
                          u.perfil === 'cliente' ? 'pill flat' : 'pill'
                        }
                      >
                        {perfilLabels[u.perfil] || u.perfil}
                      </span>
                    </span>

                    <span className="tmuted" style={{ minWidth: 0 }}>
                      {u.empresas?.nome_fantasia || '—'}
                    </span>

                    <span className="tmuted" style={{ minWidth: 0 }}>
                      <span style={{ display: 'block' }}>
                        {u.telefone || '—'}
                      </span>

                      {u.cargo && (
                        <span
                          style={{ display: 'block', fontSize: 11.5 }}
                        >
                          {u.cargo}
                        </span>
                      )}
                    </span>

                    <span>
                      <span
                        className={u.ativo ? 'pill good' : 'pill bad'}
                      >
                        {u.ativo ? 'ativo' : 'inativo'}
                      </span>
                    </span>

                    <span className="trow-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => editarUsuario(u)}
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

const GRADE_USUARIO =
  'minmax(180px,1.5fr) 130px minmax(130px,1fr) minmax(130px,1fr) 100px 84px'
