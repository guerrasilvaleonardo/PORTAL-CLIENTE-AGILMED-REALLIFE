'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { carregarFeriados, type Feriado } from '@/lib/feriados'

/*
 * Calendário de feriados do SLA.
 *
 * Dia cadastrado aqui não conta hora útil no prazo dos chamados.
 * Ao cadastrar, o banco estende o prazo dos chamados em andamento que
 * passam por aquele dia (supabase/feriados-e-pausa-sla.sql).
 * Só gestor e admin cadastram ou removem; a equipe consulta.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const ABRANGENCIAS: Record<string, string> = {
  nacional: 'Nacional',
  estadual: 'Estadual (RO)',
  municipal: 'Municipal (Porto Velho)',
  empresa: 'Recesso da empresa',
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function dataLonga(data: string) {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d))

  return (
    String(d).padStart(2, '0') +
    '/' +
    String(m).padStart(2, '0') +
    '/' +
    a +
    ' · ' +
    DIAS[dia.getUTCDay()]
  )
}

function fimDeSemana(data: string) {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay()

  return dia === 0 || dia === 6
}

export default function FeriadosPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [perfil, setPerfil] = useState('')
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [ano, setAno] = useState(String(new Date().getFullYear()))

  const [data, setData] = useState('')
  const [descricao, setDescricao] = useState('')
  const [abrangencia, setAbrangencia] = useState('municipal')
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState('')
  const [confirmar, setConfirmar] = useState('')

  const ehGestor = ['gestor', 'admin'].includes(perfil)

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

      const { data: meu } = await supabase
        .from('profiles')
        .select('perfil')
        .eq('id', user.id)
        .single()

      if (!PERFIS_INTERNOS.includes(meu?.perfil || '')) {
        window.location.href = '/'
        return
      }

      setPerfil(meu?.perfil || '')

      const { data: lista, error } = await supabase
        .from('feriados')
        .select('data, descricao, abrangencia')
        .order('data')

      if (error) throw error

      setFeriados((lista || []) as Feriado[])
      await carregarFeriados(supabase, true)
    } catch (e) {
      console.error(e)
      setErro(
        'Não foi possível carregar o calendário. Confira se o script supabase/feriados-e-pausa-sla.sql já foi rodado no banco.'
      )
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const anos = useMemo(() => {
    const lista = new Set(feriados.map((f) => f.data.slice(0, 4)))

    lista.add(String(new Date().getFullYear()))

    return [...lista].sort()
  }, [feriados])

  const doAno = useMemo(
    () => feriados.filter((f) => f.data.startsWith(ano)),
    [feriados, ano]
  )

  async function cadastrar(event: FormEvent) {
    event.preventDefault()

    if (!ehGestor) return

    if (!data || descricao.trim().length < 2) {
      setErro('Informe a data e a descrição do feriado.')
      return
    }

    try {
      setSalvando(true)
      setErro('')
      setAviso('')

      const { error } = await supabase.from('feriados').insert({
        data,
        descricao: descricao.trim(),
        abrangencia,
      })

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um feriado cadastrado nessa data.')
        }

        throw error
      }

      setAviso(
        fimDeSemana(data)
          ? 'Feriado cadastrado. Cai em fim de semana, então não muda nenhum prazo.'
          : 'Feriado cadastrado. Os chamados em andamento que passam por esse dia tiveram o prazo estendido.'
      )
      setAno(data.slice(0, 4))
      setData('')
      setDescricao('')
      await carregar()
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Não foi possível cadastrar o feriado.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(dia: string) {
    if (!ehGestor) return

    try {
      setRemovendo(dia)
      setErro('')
      setAviso('')

      const { error } = await supabase.from('feriados').delete().eq('data', dia)

      if (error) throw error

      setConfirmar('')
      setAviso(
        'Feriado removido. Prazos já estendidos por ele não são encurtados; novos cálculos voltam a contar esse dia.'
      )
      await carregar()
    } catch (e) {
      console.error(e)
      setErro('Não foi possível remover o feriado.')
    } finally {
      setRemovendo('')
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="section-title">Atendimento</div>
          <h1 style={{ fontSize: 26, marginTop: 6 }}>Calendário de feriados</h1>
        </div>

        <div className="topbar-spacer" />

        <Link href="/atendimento/prioridades" className="btn btn-sm">
          Prioridades
        </Link>

        <Link href="/atendimento" className="btn btn-sm">
          Quadro de chamados
        </Link>
      </div>

      {erro && <div className="banner bad">{erro}</div>}
      {aviso && <div className="banner good">{aviso}</div>}

      <div className="panel">
        <div className="panel-body">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
            Dia cadastrado aqui <strong>não conta hora útil</strong> no prazo dos chamados
            (expediente seg–sex, 08h–12h e 13h–17h, horário de Porto Velho). Ao cadastrar um
            feriado, os chamados em andamento que passam por esse dia têm o prazo estendido
            automaticamente, sem afetar as estrelas do atendente.
          </p>
        </div>
      </div>

      {ehGestor && (
        <form className="panel" onSubmit={cadastrar}>
          <div className="panel-head">
            <div className="section-title">Cadastrar feriado</div>
          </div>

          <div className="panel-body">
            <div className="field-row">
              <div className="field" style={{ maxWidth: 200 }}>
                <label htmlFor="feriado-data">Data</label>
                <input
                  id="feriado-data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="feriado-descricao">Descrição</label>
                <input
                  id="feriado-descricao"
                  type="text"
                  maxLength={120}
                  placeholder="Ex.: Aniversário de Porto Velho"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  required
                />
              </div>

              <div className="field" style={{ maxWidth: 240 }}>
                <label htmlFor="feriado-abrangencia">Tipo</label>
                <select
                  id="feriado-abrangencia"
                  value={abrangencia}
                  onChange={(e) => setAbrangencia(e.target.value)}
                >
                  {Object.entries(ABRANGENCIAS).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Cadastrar feriado'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="section-title">Feriados de {ano}</div>
          <div style={{ flex: 1 }} />
          <select value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano">
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="panel-body" style={{ gap: 0 }}>
          {carregando ? (
            <span style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Carregando...</span>
          ) : doAno.length === 0 ? (
            <span style={{ color: 'var(--ink-muted)', fontSize: 14 }}>
              Nenhum feriado cadastrado em {ano}.
            </span>
          ) : (
            doAno.map((f) => (
              <div
                key={f.data}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--line, #e2e8f0)',
                }}
              >
                <span className="mono" style={{ minWidth: 170, fontSize: 13 }}>
                  {dataLonga(f.data)}
                </span>

                <span style={{ flex: 1, minWidth: 160, fontSize: 14 }}>
                  <strong>{f.descricao}</strong>
                  {fimDeSemana(f.data) && (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}> · fim de semana</span>
                  )}
                </span>

                <span className="pill flat">{ABRANGENCIAS[f.abrangencia] || f.abrangencia}</span>

                {ehGestor &&
                  (confirmar === f.data ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: 'var(--danger)' }}
                        disabled={removendo === f.data}
                        onClick={() => remover(f.data)}
                      >
                        {removendo === f.data ? 'Removendo...' : 'Confirmar remoção'}
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setConfirmar('')}>
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={() => setConfirmar(f.data)}>
                      Remover
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
