'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarCpf } from '@/lib/historicoCertificados'
import { TERMO_ENTREGA_EPI } from '@/lib/epiTermo'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import EpiAbas from '@/components/EpiAbas'
import '../../colaboradores/colaboradores.css'
import './ficha.css'

/*
 * Ficha de controle de entrega de EPI (NR-06, item 6.6.1).
 *
 * É o papel que a fiscalização pede e o que a empresa apresenta numa
 * reclamatória: uma folha por trabalhador, com tudo que ele recebeu, o
 * CA de cada equipamento, o prazo de troca e quando assinou.
 *
 * A tela mostra a ficha já no formato impresso; "Imprimir" abre a caixa
 * do navegador, que também salva em PDF. Uma ficha por página.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
const MOTIVOS: Record<string, string> = {
  entrega: 'Entrega',
  substituicao: 'Substituição',
  desgaste: 'Desgaste',
  dano: 'Dano',
  perda: 'Perda',
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null; cnpj?: string | null }
type Colaborador = {
  id: string
  empresa_id: string
  nome: string
  cpf: string | null
  matricula: string | null
  funcao: string | null
  local_trabalho: string | null
  local_id: string | null
  locais_trabalho?: { nome: string } | { nome: string }[] | null
  admissao: string | null
}
type Item = {
  nome: string
  ca: string | null
  complemento: string | null
  quantidade: number
  motivo: string
  troca_em: string
  devolvido_em: string | null
  devolucao_motivo: string | null
}

/* Por que o equipamento voltou — a coluna Devolução da ficha. Sem ela a
 * ficha afirma que o trabalhador está com tudo que já recebeu na vida. */
const MOTIVOS_DEVOLUCAO: Record<string, string> = {
  devolucao: 'devolvido',
  troca: 'trocado',
  fim_vida_util: 'fim da vida útil',
  dano: 'danificado',
  perda: 'perdido',
  desligamento: 'desligamento',
}
type Entrega = {
  id: string
  colaborador_id: string
  empresa_id: string
  entregue_em: string
  assinado_em: string | null
  cancelada_em: string | null
  entregue_por_nome: string | null
  foto_path: string
  epi_entregas_itens: Item[]
}

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')

/* O local vem do cadastro novo quando existe, e cai para o texto antigo
 * de quem ainda não foi ligado a um local. O PostgREST devolve a relação
 * ora como objeto, ora como lista de um — por isso os dois caminhos. */
function nomeDoLocal(p: Colaborador): string {
  const rel = Array.isArray(p.locais_trabalho) ? p.locais_trabalho[0] : p.locais_trabalho
  return rel?.nome || p.local_trabalho || '—'
}
const dataHoraBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const hoje = () => new Date().toLocaleDateString('pt-BR')

export default function FichaEpi() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [fotos, setFotos] = useState<Record<string, string>>({})

  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [quem, setQuem] = useState('')
  const [comFoto, setComFoto] = useState(true)

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

      const { data: emps } = await supabase
        .from('empresas')
        .select('id, razao_social, nome_fantasia, cnpj')
        .order('razao_social')
      setEmpresas((emps || []) as Empresa[])

      const [{ data: cols }, { data: ents, error: erroEnt }] = await Promise.all([
        supabase
          .from('colaboradores')
          .select('id, empresa_id, nome, cpf, matricula, funcao, local_trabalho, local_id, admissao, locais_trabalho(nome)')
          .order('nome'),
        supabase
          .from('epi_entregas')
          .select(
            'id, colaborador_id, empresa_id, entregue_em, assinado_em, cancelada_em, ' +
              'entregue_por_nome, foto_path, ' +
              'epi_entregas_itens(nome, ca, complemento, quantidade, motivo, troca_em, devolvido_em, devolucao_motivo)'
          )
          .is('cancelada_em', null)
          .order('entregue_em'),
      ])

      if (erroEnt) {
        if (erroEnt.code === '42P01' || /does not exist|schema cache/i.test(erroEnt.message || '')) {
          setSemTabela(true)
          return
        }
        throw erroEnt
      }

      setColaboradores((cols || []) as Colaborador[])
      setEntregas((ents || []) as unknown as Entrega[])
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar a ficha.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

  const pessoas = useMemo(
    () => colaboradores.filter((c) => !empresaAtual || c.empresa_id === empresaAtual),
    [colaboradores, empresaAtual]
  )

  /* Quem aparece: a pessoa escolhida, ou todas que têm entrega. */
  const fichas = useMemo(() => {
    const comEntrega = new Set(entregas.map((e) => e.colaborador_id))
    return pessoas
      .filter((c) => (quem ? c.id === quem : comEntrega.has(c.id)))
      .map((c) => ({
        pessoa: c,
        linhas: entregas.filter((e) => e.colaborador_id === c.id),
      }))
      .filter((f) => f.linhas.length > 0)
  }, [pessoas, entregas, quem])

  /* As fotos ficam num balde privado: cada uma precisa de link assinado. */
  useEffect(() => {
    let vivo = true

    async function assinar() {
      if (!comFoto) return
      const caminhos = fichas.flatMap((f) => f.linhas.map((l) => l.foto_path)).filter(Boolean)
      const faltando = [...new Set(caminhos)].filter((c) => !fotos[c])
      if (!faltando.length) return

      const { data } = await supabase.storage.from('epi-fotos').createSignedUrls(faltando, 3600)
      if (!vivo || !data) return
      const novas: Record<string, string> = {}
      for (const d of data) if (d.path && d.signedUrl) novas[d.path] = d.signedUrl
      setFotos((atual) => ({ ...atual, ...novas }))
    }

    assinar()
    return () => {
      vivo = false
    }
  }, [fichas, comFoto, fotos])

  const empresa = empresas.find((e) => e.id === empresaAtual)

  if (semTabela) {
    return (
      <div className="app">
        <EpiAbas />
        <div className="banner bad">
          As entregas ainda não foram criadas no banco. Rode <code>supabase/epi-entregas.sql</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="nao-imprimir">
        <EpiAbas />
      </div>

      <div className="nao-imprimir">
        <p className="eyebrow">EPI</p>
        <h1 className="titulo-tela">Ficha de entrega</h1>
        <p className="subtitulo-tela">
          Uma folha por trabalhador, com tudo que ele recebeu, o CA de cada equipamento e quando
          assinou. É o documento exigido pelo item 6.6.1 da NR-06.
        </p>
      </div>

      {erro && <div className="banner bad nao-imprimir">{erro}</div>}

      <div className="filters nao-imprimir">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={(v) => {
              setEmpresaFiltro(v)
              setQuem('')
            }}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <select id="ficha-quem" value={quem} onChange={(e) => setQuem(e.target.value)}>
          <option value="">Todos os trabalhadores com entrega</option>
          {pessoas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <label className="caixa-marcar">
          <input
            type="checkbox"
            id="ficha-foto"
            checked={comFoto}
            onChange={(e) => setComFoto(e.target.checked)}
          />
          Incluir as fotos
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>

      {carregando && <p className="empty-state nao-imprimir">Carregando…</p>}

      {!carregando && fichas.length === 0 && (
        <p className="empty-state nao-imprimir">
          {interno && !empresaFiltro
            ? 'Escolha a empresa para montar a ficha.'
            : 'Nenhuma entrega registrada ainda.'}
        </p>
      )}

      {fichas.map(({ pessoa, linhas }) => {
        /* A coluna Devolucao so entra quando ha algo devolvido nesta
           ficha: em A4 cada coluna a mais espreme as outras, e a ficha
           de quem nunca devolveu nada nao ganha nada com ela. */
        const temDevolucao = linhas.some((e) =>
          e.epi_entregas_itens.some((i) => i.devolvido_em)
        )
        return (
        <article key={pessoa.id} className="ficha">
          <header className="ficha-topo">
            <div>
              <h2>Ficha de controle de entrega de EPI</h2>
              <p className="ficha-base">NR-06, item 6.6.1</p>
            </div>
            <div className="ficha-empresa">
              <strong>{empresa ? empresa.nome_fantasia || empresa.razao_social : ''}</strong>
              {empresa?.cnpj && <span>CNPJ {empresa.cnpj}</span>}
            </div>
          </header>

          <dl className="ficha-pessoa">
            <div>
              <dt>Trabalhador</dt>
              <dd>{pessoa.nome}</dd>
            </div>
            <div>
              <dt>CPF</dt>
              <dd>{formatarCpf(pessoa.cpf) || '—'}</dd>
            </div>
            <div>
              <dt>Matrícula</dt>
              <dd>{pessoa.matricula || '—'}</dd>
            </div>
            <div>
              <dt>Função</dt>
              <dd>{pessoa.funcao || '—'}</dd>
            </div>
            <div>
              <dt>Local</dt>
              <dd>{nomeDoLocal(pessoa)}</dd>
            </div>
            <div>
              <dt>Admissão</dt>
              <dd>{dataBr(pessoa.admissao)}</dd>
            </div>
          </dl>

          <table className="ficha-tabela">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Equipamento</th>
                <th>CA</th>
                <th>Qtd</th>
                <th>Motivo</th>
                <th>Trocar até</th>
                {temDevolucao && <th>Devolução</th>}
                {comFoto && <th>Foto</th>}
                <th>Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.flatMap((e) =>
                e.epi_entregas_itens.map((i, n) => (
                  <tr key={`${e.id}-${n}`}>
                    <td className="mono" data-rotulo="Entrega">
                      {n === 0 ? dataHoraBr(e.entregue_em) : ''}
                    </td>
                    <td data-rotulo="Equipamento" className="ficha-equip">
                      {i.nome}
                      {i.complemento ? ` · ${i.complemento}` : ''}
                    </td>
                    <td className="mono" data-rotulo="CA">
                      {i.ca || '—'}
                    </td>
                    <td className="mono" data-rotulo="Qtd">
                      {i.quantidade}
                    </td>
                    <td data-rotulo="Motivo">{MOTIVOS[i.motivo] || i.motivo}</td>
                    <td className="mono" data-rotulo="Trocar até">
                      {dataBr(i.troca_em)}
                    </td>
                    {temDevolucao && (
                    <td className="mono" data-rotulo="Devolução">
                      {i.devolvido_em ? (
                        <>
                          {dataBr(i.devolvido_em.slice(0, 10))}
                          <br />
                          {MOTIVOS_DEVOLUCAO[i.devolucao_motivo || ''] || i.devolucao_motivo}
                        </>
                      ) : (
                        'em uso'
                      )}
                    </td>
                    )}
                    {comFoto && (
                      <td className="ficha-foto" data-rotulo="Foto">
                        {n === 0 && fotos[e.foto_path] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={fotos[e.foto_path]} alt="" />
                        ) : null}
                      </td>
                    )}
                    <td className="mono ficha-ass" data-rotulo="Assinatura">
                      {n === 0 ? (
                        e.assinado_em ? (
                          <>
                            <strong>Assinado</strong>
                            <br />
                            {dataHoraBr(e.assinado_em)}
                          </>
                        ) : (
                          <span className="ficha-pendente">sem assinatura</span>
                        )
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <section className="ficha-termo">
            <h3>Declaração do trabalhador</h3>
            {TERMO_ENTREGA_EPI.map((p, n) => (
              <p key={n}>{p}</p>
            ))}
          </section>

          <footer className="ficha-assinaturas">
            <div>
              <span>{pessoa.nome}</span>
              trabalhador
            </div>
            <div>
              <span>{linhas[linhas.length - 1]?.entregue_por_nome || ''}</span>
              responsável pela entrega
            </div>
            <div>
              <span>{empresa ? empresa.nome_fantasia || empresa.razao_social : ''}</span>
              empregador
            </div>
          </footer>

          <p className="ficha-rodape">
            Emitida em {hoje()} pelo Portal do Cliente · as assinaturas registradas no portal
            constam na coluna “Assinatura”, com data e hora.
          </p>
        </article>
        )
      })}
    </div>
  )
}
