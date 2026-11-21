'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * A agenda e a lista de quem estava na sala.
 *
 * POR QUE TABELA E NÃO TEXTO. A agenda era um campo de texto solto.
 * Texto solto não imprime em tabela, não diz quais requisitos a janela
 * das 8h cobriu, e no relatório vira um parágrafo que ninguém confere.
 * O relatório da certificadora que ele guardou traz exatamente cinco
 * colunas — Horário, Processo/Área, Auditor, Participantes, Requisitos
 * — e é por elas que o auditado se organiza na véspera.
 *
 * POR QUE SALVA A CADA CAMPO. Auditoria se planeja em cima da hora, com
 * o telefone tocando. Um botão "salvar tudo" no fim é um convite a
 * perder meia hora de digitação quando a aba fecha. Cada campo grava ao
 * sair dele; adicionar e remover gravam na hora.
 */

type LinhaAgenda = {
  id: number
  ordem: number
  dia: string | null
  horario: string | null
  area: string
  auditor: string | null
  participantes: string | null
  requisitos: string | null
  observacao: string | null
}

type Participante = {
  id: number
  nome: string
  cargo: string | null
  area: string | null
  papel: string
  abertura: boolean
  encerramento: boolean
}

const PAPEIS: { valor: string; rotulo: string }[] = [
  { valor: 'auditor_lider', rotulo: 'Auditor líder' },
  { valor: 'auditor', rotulo: 'Auditor' },
  { valor: 'auditor_em_treinamento', rotulo: 'Auditor em treinamento' },
  { valor: 'observador', rotulo: 'Observador' },
  { valor: 'acompanhante', rotulo: 'Acompanhante' },
  { valor: 'auditado', rotulo: 'Auditado' },
  { valor: 'convidado', rotulo: 'Convidado' },
]

export const rotuloDoPapel = (papel: string) =>
  PAPEIS.find((p) => p.valor === papel)?.rotulo || papel

export function AgendaDaAuditoria({ inspecaoId }: { inspecaoId: string }) {
  const [linhas, setLinhas] = useState<LinhaAgenda[]>([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('auditoria_agenda')
      .select('id, ordem, dia, horario, area, auditor, participantes, requisitos, observacao')
      .eq('inspecao_id', inspecaoId)
      .order('ordem')
      .order('id')
    if (error) {
      setErro(error.message)
      return
    }
    setLinhas((data || []) as unknown as LinhaAgenda[])
  }, [inspecaoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function adicionar() {
    setErro('')
    const { error } = await supabase.from('auditoria_agenda').insert({
      inspecao_id: inspecaoId,
      ordem: linhas.length,
      area: '',
    })
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  async function gravar(linha: LinhaAgenda, campo: keyof LinhaAgenda, valor: string) {
    if (String(linha[campo] ?? '') === valor) return
    setErro('')
    const { error } = await supabase
      .from('auditoria_agenda')
      .update({ [campo]: valor || null })
      .eq('id', linha.id)
    if (error) {
      setErro(error.message)
      return
    }
    setLinhas((atual) =>
      atual.map((l) => (l.id === linha.id ? { ...l, [campo]: valor || null } : l))
    )
  }

  async function remover(linha: LinhaAgenda) {
    if (!window.confirm('Tirar esta linha da agenda?')) return
    const { error } = await supabase.from('auditoria_agenda').delete().eq('id', linha.id)
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  return (
    <div className="aud-grade">
      {erro && <div className="banner bad">{erro}</div>}

      <table className="tabela-colab aud-tabela">
        <thead>
          <tr>
            <th style={{ width: 110 }}>Dia</th>
            <th style={{ width: 130 }}>Horário</th>
            <th>Processo / Área</th>
            <th style={{ width: 150 }}>Auditor</th>
            <th style={{ width: 170 }}>Participantes</th>
            <th style={{ width: 140 }}>Requisitos</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={7} className="aud-vazio">
                Sem agenda. Monte a sua: é o que o auditado recebe antes para saber quando é a vez
                dele.
              </td>
            </tr>
          )}
          {linhas.map((l) => (
            <tr key={l.id}>
              <td>
                <input
                  type="date"
                  defaultValue={l.dia || ''}
                  onBlur={(e) => gravar(l, 'dia', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  defaultValue={l.horario || ''}
                  placeholder="08:00 às 09:30"
                  onBlur={(e) => gravar(l, 'horario', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  defaultValue={l.area || ''}
                  placeholder="Ex.: Manutenção — 8.1 Planejamento operacional"
                  onBlur={(e) => gravar(l, 'area', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  defaultValue={l.auditor || ''}
                  onBlur={(e) => gravar(l, 'auditor', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  defaultValue={l.participantes || ''}
                  placeholder="Quem recebe"
                  onBlur={(e) => gravar(l, 'participantes', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  defaultValue={l.requisitos || ''}
                  placeholder="4.1, 6.1, 8.1"
                  onBlur={(e) => gravar(l, 'requisitos', e.target.value)}
                />
              </td>
              <td>
                <button type="button" className="btn btn-sm" onClick={() => remover(l)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className="btn btn-sm" onClick={adicionar}>
        Adicionar janela
      </button>
    </div>
  )
}

export function ParticipantesDaAuditoria({ inspecaoId }: { inspecaoId: string }) {
  const [pessoas, setPessoas] = useState<Participante[]>([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('auditoria_participantes')
      .select('id, nome, cargo, area, papel, abertura, encerramento')
      .eq('inspecao_id', inspecaoId)
      .order('papel')
      .order('nome')
    if (error) {
      setErro(error.message)
      return
    }
    setPessoas((data || []) as unknown as Participante[])
  }, [inspecaoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function adicionar() {
    setErro('')
    const { error } = await supabase
      .from('auditoria_participantes')
      .insert({ inspecao_id: inspecaoId, nome: 'Novo participante' })
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  async function gravar(p: Participante, campo: keyof Participante, valor: string | boolean) {
    if (p[campo] === valor) return
    setErro('')
    const limpo = typeof valor === 'string' ? valor || null : valor
    const { error } = await supabase
      .from('auditoria_participantes')
      .update({ [campo]: limpo })
      .eq('id', p.id)
    if (error) {
      setErro(error.message)
      return
    }
    setPessoas((atual) => atual.map((x) => (x.id === p.id ? { ...x, [campo]: limpo } : x)))
  }

  async function remover(p: Participante) {
    if (!window.confirm('Tirar ' + p.nome + ' da lista?')) return
    const { error } = await supabase.from('auditoria_participantes').delete().eq('id', p.id)
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  return (
    <div className="aud-grade">
      {erro && <div className="banner bad">{erro}</div>}

      <table className="tabela-colab aud-tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th style={{ width: 160 }}>Cargo</th>
            <th style={{ width: 150 }}>Área</th>
            <th style={{ width: 170 }}>Papel</th>
            <th style={{ width: 70 }}>Abert.</th>
            <th style={{ width: 70 }}>Encerr.</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {pessoas.length === 0 && (
            <tr>
              <td colSpan={7} className="aud-vazio">
                Ninguém registrado. Seis meses depois, quem sabe o que foi dito na abertura é quem
                estava lá — e essa lista é a única memória disso.
              </td>
            </tr>
          )}
          {pessoas.map((p) => (
            <tr key={p.id}>
              <td>
                <input
                  type="text"
                  defaultValue={p.nome}
                  onBlur={(e) => gravar(p, 'nome', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  defaultValue={p.cargo || ''}
                  onBlur={(e) => gravar(p, 'cargo', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  defaultValue={p.area || ''}
                  onBlur={(e) => gravar(p, 'area', e.target.value)}
                />
              </td>
              <td>
                <select value={p.papel} onChange={(e) => gravar(p, 'papel', e.target.value)}>
                  {PAPEIS.map((x) => (
                    <option key={x.valor} value={x.valor}>
                      {x.rotulo}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={p.abertura}
                  onChange={(e) => gravar(p, 'abertura', e.target.checked)}
                />
              </td>
              <td style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={p.encerramento}
                  onChange={(e) => gravar(p, 'encerramento', e.target.checked)}
                />
              </td>
              <td>
                <button type="button" className="btn btn-sm" onClick={() => remover(p)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className="btn btn-sm" onClick={adicionar}>
        Adicionar pessoa
      </button>
    </div>
  )
}
