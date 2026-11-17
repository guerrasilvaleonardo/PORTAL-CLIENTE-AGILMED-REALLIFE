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
  validade_ca: string | null
  descricao: string | null
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
  assinatura_imagem: string | null
  assinatura_hash: string | null
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
/* Datas curtas, como na ficha impressa: 17/02/26 e 17/02/26 12:41:55. */
const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const dataHoraCurta = (iso: string) =>
  `${dataCurta(iso)} ${new Date(iso).toLocaleTimeString('pt-BR', { hour12: false })}`

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
  /* Links assinados do traço de cada assinatura, como os das fotos. */
  const [assinaturas, setAssinaturas] = useState<Record<string, string>>({})

  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [quem, setQuem] = useState('')
  const [comFoto, setComFoto] = useState(false)

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
              'entregue_por_nome, foto_path, assinatura_imagem, assinatura_hash, ' +
              'epi_entregas_itens(nome, ca, complemento, quantidade, motivo, troca_em, ' +
              'devolvido_em, devolucao_motivo, validade_ca, descricao)'
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

    /* O traço da assinatura sempre entra: ele é parte do documento,
       não um extra como a foto. */
    async function tracos() {
      const caminhos = fichas
        .flatMap((f) => f.linhas.map((l) => l.assinatura_imagem))
        .filter((c): c is string => Boolean(c))
      const faltando = [...new Set(caminhos)].filter((c) => !assinaturas[c])
      if (!faltando.length) return

      const { data } = await supabase.storage.from('epi-fotos').createSignedUrls(faltando, 3600)
      if (!vivo || !data) return
      const novas: Record<string, string> = {}
      for (const d of data) if (d.path && d.signedUrl) novas[d.path] = d.signedUrl
      setAssinaturas((atual) => ({ ...atual, ...novas }))
    }

    tracos()

    assinar()
    return () => {
      vivo = false
    }
  }, [fichas, comFoto, fotos])

  const empresa = empresas.find((e) => e.id === empresaAtual)

  /* No cabeçalho vai a razão social, não o nome de fantasia: a ficha é
     documento, e é a razão social que casa com o CNPJ ao lado. */
  const nomeEmpregador = () => empresa?.razao_social || empresa?.nome_fantasia || ''

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

      {fichas.map(({ pessoa, linhas }, n) => {
        return (
        <article key={pessoa.id} className="ficha">
          {/* Cabeçalho no formato da ficha que a empresa já conhece:
              a data de emissão e a página de um lado, a identificação do
              empregador no meio. */}
          <header className="ficha-topo">
            <div className="ficha-linha-topo">
              <span>Documento gerado em: {hoje()}</span>
              <span>Ficha {n + 1} de {fichas.length}</span>
            </div>
            <div className="ficha-marca">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icone-reallife.svg" alt="" className="ficha-logo" />
              <div className="ficha-identificacao">
                <strong>{nomeEmpregador()}</strong>
                <span>Ficha de EPI - Trabalhadores</span>
                <strong>
                  {nomeEmpregador()}
                  {empresa?.cnpj ? ` (${empresa.cnpj})` : ''}
                </strong>
              </div>
            </div>
          </header>

          <div className="ficha-dados">
            <div>
              <span>Nome do Trabalhador</span>
              <strong>{pessoa.nome}</strong>
            </div>
            <div>
              <span>Função</span>
              <strong>{pessoa.funcao || ''}</strong>
            </div>
            <div>
              <span>Matrícula</span>
              <strong>{pessoa.matricula || ''}</strong>
            </div>
            <div>
              <span>Data de admissão</span>
              <strong>{pessoa.admissao ? dataBr(pessoa.admissao) : ''}</strong>
            </div>
          </div>

          <div className="ficha-termo">
            <p>{TERMO_ENTREGA_EPI.join(' ')}</p>
          </div>

          <table className="ficha-tabela">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Devolução</th>
                <th>CA nº</th>
                <th>Qtde.</th>
                <th>Equipamento</th>
                <th>Motivo</th>
                {comFoto && <th>Foto</th>}
                <th>Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.flatMap((e) =>
                e.epi_entregas_itens.map((i, k) => (
                  <tr key={`${e.id}-${k}`}>
                    <td className="mono" data-rotulo="Entrega">
                      {dataCurta(e.entregue_em)}
                    </td>
                    <td className="mono" data-rotulo="Devolução">
                      {i.devolvido_em ? (
                        <>
                          {dataBr(i.devolvido_em.slice(0, 10))}
                          <br />
                          <span className="ficha-mini">
                            {MOTIVOS_DEVOLUCAO[i.devolucao_motivo || ''] || i.devolucao_motivo}
                          </span>
                        </>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="mono" data-rotulo="CA nº">
                      {i.ca || ''}
                    </td>
                    <td className="mono" data-rotulo="Qtde.">
                      {i.quantidade}
                    </td>
                    <td data-rotulo="Equipamento" className="ficha-equip">
                      <strong>
                        {i.nome.toUpperCase()}
                        {i.complemento ? ` (${i.complemento})` : ''}
                      </strong>
                      {i.validade_ca && (
                        <span className="ficha-mini">
                          Validade do C.A.: {dataBr(i.validade_ca)}
                        </span>
                      )}
                      {i.descricao && <span className="ficha-mini">{i.descricao}</span>}
                    </td>
                    <td data-rotulo="Motivo">{MOTIVOS[i.motivo] || i.motivo}</td>
                    {comFoto && (
                      <td className="ficha-foto" data-rotulo="Foto">
                        {k === 0 && fotos[e.foto_path] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={fotos[e.foto_path]} alt="" />
                        ) : null}
                      </td>
                    )}
                    <td className="ficha-ass" data-rotulo="Assinatura">
                      {k === 0 ? (
                        e.assinado_em ? (
                          <>
                            {e.assinatura_imagem && assinaturas[e.assinatura_imagem] ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                className="ficha-traco"
                                src={assinaturas[e.assinatura_imagem]}
                                alt="Assinatura do trabalhador"
                              />
                            ) : (
                              <span className="ficha-sem-traco">assinado no portal</span>
                            )}
                            {e.assinatura_hash && (
                              <span className="ficha-hash">{e.assinatura_hash.slice(0, 40)}</span>
                            )}
                            <span className="ficha-quando">{dataHoraCurta(e.assinado_em)}</span>
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


        </article>
        )
      })}
    </div>
  )
}
