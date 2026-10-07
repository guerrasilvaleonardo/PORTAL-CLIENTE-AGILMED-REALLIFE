'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Quem do lado do cliente enxerga o chamado.
 *
 * chamados.visibilidade:
 *   'restrita' -> só quem abriu + participantes escolhidos;
 *   'empresa'  -> todos os usuários da empresa.
 * A equipe interna sempre vê tudo. Quem escolhe: equipe interna e
 * quem abriu o chamado (regras no banco:
 * supabase/chamados-participantes-e-mensagens-automaticas.sql).
 */

type Colega = { id: string; nome: string; email: string | null }

async function colegasDaEmpresa(empresaId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, email')
    .eq('empresa_id', empresaId)
    .eq('perfil', 'cliente')
    .eq('ativo', true)
    .order('nome')

  if (error) {
    console.error('Colegas da empresa:', error)
    return []
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    nome: p.nome || p.email || 'Sem nome',
    email: p.email,
  })) as Colega[]
}

function ListaDeColegas({
  colegas,
  marcados,
  bloqueados,
  desativado,
  onAlternar,
  cor,
}: {
  colegas: Colega[]
  marcados: Set<string>
  bloqueados?: Set<string>
  desativado?: boolean
  onAlternar: (id: string, marcado: boolean) => void
  cor: string
}) {
  if (!colegas.length) {
    return (
      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
        Não há outros usuários ativos cadastrados nesta empresa.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
      {colegas.map((c) => {
        const fixo = bloqueados?.has(c.id)

        return (
          <label
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              cursor: desativado || fixo ? 'default' : 'pointer',
              background: marcados.has(c.id) ? '#f8fafc' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={marcados.has(c.id) || !!fixo}
              disabled={desativado || fixo}
              onChange={(e) => onAlternar(c.id, e.target.checked)}
              style={{ width: 17, height: 17, accentColor: cor, flexShrink: 0 }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>
                {c.nome}
                {fixo && (
                  <span style={{ fontSize: 11, color: '#64748b' }}> · abriu o chamado</span>
                )}
              </span>
              {c.email && (
                <span style={{ display: 'block', fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>
                  {c.email}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function OpcaoVisibilidade({
  todaEmpresa,
  onChange,
  desativado,
  cor,
}: {
  todaEmpresa: boolean
  onChange: (v: boolean) => void
  desativado?: boolean
  cor: string
}) {
  const opcao = (valor: boolean, titulo: string, texto: string) => (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '9px 11px',
        border: '1px solid ' + (todaEmpresa === valor ? cor : '#e2e8f0'),
        borderRadius: 10,
        cursor: desativado ? 'default' : 'pointer',
        flex: '1 1 220px',
      }}
    >
      <input
        type="radio"
        checked={todaEmpresa === valor}
        disabled={desativado}
        onChange={() => onChange(valor)}
        style={{ accentColor: cor, marginTop: 3 }}
      />
      <span>
        <strong style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>{titulo}</strong>
        <span style={{ fontSize: 12, color: '#64748b' }}>{texto}</span>
      </span>
    </label>
  )

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {opcao(false, 'Só pessoas selecionadas', 'Quem abriu e quem for marcado abaixo.')}
      {opcao(true, 'Toda a empresa', 'Todos os usuários da empresa veem o chamado.')}
    </div>
  )
}

/*
 * Seletor usado na abertura do chamado: ainda não há chamado gravado,
 * então só devolve as escolhas para quem chamou.
 */
export function SeletorParticipantes({
  empresaId,
  usuarioAtualId,
  selecionados,
  onSelecionados,
  todaEmpresa,
  onTodaEmpresa,
  cor = '#0f766e',
}: {
  empresaId: string
  usuarioAtualId?: string
  selecionados: string[]
  onSelecionados: (ids: string[]) => void
  todaEmpresa: boolean
  onTodaEmpresa: (v: boolean) => void
  cor?: string
}) {
  const [colegas, setColegas] = useState<Colega[]>([])

  useEffect(() => {
    if (!empresaId) {
      setColegas([])
      return
    }

    colegasDaEmpresa(empresaId).then((lista) =>
      setColegas(lista.filter((c) => c.id !== usuarioAtualId))
    )
  }, [empresaId, usuarioAtualId])

  const marcados = new Set(selecionados)

  return (
    <div>
      <OpcaoVisibilidade todaEmpresa={todaEmpresa} onChange={onTodaEmpresa} cor={cor} />

      {!todaEmpresa && (
        <ListaDeColegas
          colegas={colegas}
          marcados={marcados}
          cor={cor}
          onAlternar={(id, marcado) =>
            onSelecionados(
              marcado ? [...selecionados, id] : selecionados.filter((s) => s !== id)
            )
          }
        />
      )}
    </div>
  )
}

/*
 * Cartão do chamado já aberto. Quem pode gerenciar edita; os demais
 * só veem quem tem acesso.
 */
export default function ParticipantesChamado({
  chamadoId,
  empresaId,
  criadoPor,
  podeGerenciar,
  cor = '#0f766e',
  cardStyle,
  titleStyle,
}: {
  chamadoId: string
  empresaId: string
  criadoPor: string | null
  podeGerenciar: boolean
  cor?: string
  cardStyle?: React.CSSProperties
  titleStyle?: React.CSSProperties
}) {
  const [colegas, setColegas] = useState<Colega[]>([])
  const [participantes, setParticipantes] = useState<Set<string>>(new Set())
  const [todaEmpresa, setTodaEmpresa] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    const [{ data: ch, error: e1 }, { data: parts, error: e2 }, lista] =
      await Promise.all([
        supabase.from('chamados').select('visibilidade').eq('id', chamadoId).maybeSingle(),
        supabase.from('chamado_participantes').select('usuario_id').eq('chamado_id', chamadoId),
        colegasDaEmpresa(empresaId),
      ])

    if (e1 || e2) {
      /* Banco ainda sem o recurso: esconde o cartão sem quebrar a página. */
      console.error('Participantes do chamado:', e1 || e2)
      setIndisponivel(true)
      setCarregando(false)
      return
    }

    setTodaEmpresa((ch as any)?.visibilidade === 'empresa')
    setParticipantes(new Set((parts || []).map((p: any) => p.usuario_id)))
    setColegas(lista)
    setCarregando(false)
  }

  useEffect(() => {
    if (chamadoId && empresaId) carregar()
  }, [chamadoId, empresaId])

  async function mudarVisibilidade(valor: boolean) {
    if (valor === todaEmpresa) return

    if (
      !valor &&
      !window.confirm(
        'Restringir o chamado? Usuários da empresa que não abriram o chamado e não estão marcados deixam de vê-lo.'
      )
    ) {
      return
    }

    setSalvando(true)
    setErro('')

    const { error } = await supabase
      .from('chamados')
      .update({ visibilidade: valor ? 'empresa' : 'restrita' })
      .eq('id', chamadoId)

    if (error) {
      console.error(error)
      setErro('Não foi possível alterar quem vê o chamado.')
    } else {
      setTodaEmpresa(valor)
    }

    setSalvando(false)
  }

  async function alternar(id: string, marcado: boolean) {
    setSalvando(true)
    setErro('')

    const { error } = marcado
      ? await supabase.from('chamado_participantes').insert({ chamado_id: chamadoId, usuario_id: id })
      : await supabase.from('chamado_participantes').delete().eq('chamado_id', chamadoId).eq('usuario_id', id)

    if (error) {
      console.error(error)
      setErro('Não foi possível salvar o participante.')
    } else {
      setParticipantes((atual) => {
        const novo = new Set(atual)
        if (marcado) novo.add(id)
        else novo.delete(id)
        return novo
      })
    }

    setSalvando(false)
  }

  if (carregando || indisponivel) return null

  const fixos = new Set(criadoPor ? [criadoPor] : [])
  const comAcesso = todaEmpresa
    ? colegas
    : colegas.filter((c) => participantes.has(c.id) || fixos.has(c.id))

  return (
    <section style={cardStyle}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={titleStyle}>Quem vê este chamado</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
          {todaEmpresa
            ? 'Todos os usuários da empresa.'
            : comAcesso.length + ' pessoa(s) da empresa, além da nossa equipe.'}
        </p>
      </div>

      {podeGerenciar ? (
        <>
          <OpcaoVisibilidade
            todaEmpresa={todaEmpresa}
            onChange={mudarVisibilidade}
            desativado={salvando}
            cor={cor}
          />

          {!todaEmpresa && (
            <ListaDeColegas
              colegas={colegas}
              marcados={participantes}
              bloqueados={fixos}
              desativado={salvando}
              onAlternar={alternar}
              cor={cor}
            />
          )}
        </>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#334155' }}>
          {comAcesso.map((c) => (
            <li key={c.id}>{c.nome}</li>
          ))}
        </ul>
      )}

      {erro && <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 10 }}>{erro}</div>}
    </section>
  )
}
