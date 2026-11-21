'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../inspecoes.css'
import './rnc.css'

/*
 * RNC — a não conformidade em uma folha, para imprimir e entregar.
 *
 * POR QUE ELA EXISTE. O tratamento inteiro morava numa ficha de tela:
 * ótimo para preencher, imprestável para entregar. Auditor pede papel
 * (ou PDF), o cliente arquiva papel, e a reunião mensal discute papel.
 * Sem esta folha, o trabalho de investigar ficava invisível fora do
 * portal.
 *
 * OITO SEÇÕES NUMERADAS, na ordem do item 10.2: o que aconteceu, o que
 * se fez na hora, por que aconteceu, o que vai mudar, a prova, se
 * funcionou, o fecho e quem assina. A numeração não é enfeite — é
 * assim que se diz "veja a seção 4" numa reunião.
 *
 * O QUE ESTA FOLHA TEM E A DO CONCORRENTE NÃO: as fotos do campo, a
 * inspeção de origem pelo código (lá o campo existe e vive vazio),
 * número de página e hora. O que a deles tem e vale copiar, e está
 * aqui: as assinaturas no fim, com uma linha em branco para o gestor
 * que assina à caneta.
 */

type NC = {
  id: string
  empresa_id: string
  codigo: string | null
  descricao: string
  titulo: string | null
  origem: string | null
  local_nome: string | null
  gravidade: string
  classificacao: string | null
  probabilidade: number | null
  severidade: number | null
  risco: number | null
  prazo: string | null
  responsavel_nome: string | null
  acao_imediata: string | null
  porque_1: string | null
  porque_2: string | null
  porque_3: string | null
  porque_4: string | null
  porque_5: string | null
  causa: string | null
  acao_corretiva: string | null
  situacao: string
  eficaz: boolean | null
  verificacao_obs: string | null
  verificada_em: string | null
  encerrada_em: string | null
  fotos: string[] | null
  foto_path: string | null
  latitude: number | null
  longitude: number | null
  inspecao_id: string | null
  visita_id: string | null
  created_at: string
  atualizado_em: string | null
}

type Acao = {
  id: string
  ordem: number
  tipo: string
  descricao: string
  responsavel_nome: string | null
  prazo: string | null
  situacao: string
  eficaz: boolean | null
  verificacao_obs: string | null
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

const GRAVIDADE: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
}

const SITUACAO: Record<string, string> = {
  aberta: 'Aberta',
  em_acao: 'Em ação',
  aguardando_verificacao: 'Aguardando verificação',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

const ORIGEM: Record<string, string> = {
  inspecao: 'Inspeção de campo',
  incidente: 'Incidente',
  avulsa: 'Registro avulso',
  auditoria: 'Auditoria',
}

const TIPO_ACAO: Record<string, string> = {
  correcao: 'Correção',
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  verificacao: 'Verificação',
}

const SITUACAO_ACAO: Record<string, string> = {
  aberta: 'A fazer',
  execucao: 'Em execução',
  verificacao: 'Em verificação',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

const soData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' }) : '—'

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const soDataSimples = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'

function RncConteudo() {
  const params = useParams()
  const id = String(params?.id || '')

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [nc, setNc] = useState<NC | null>(null)
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [fotos, setFotos] = useState<string[]>([])
  const [geradoEm] = useState(() => new Date().toISOString())

  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      setErro('')

      const { data, error } = await supabase
        .from('nao_conformidades')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      const linha = data as unknown as NC
      setNc(linha)

      const [{ data: emp }, { data: lista }] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .eq('id', linha.empresa_id)
          .single(),
        supabase
          .from('nc_acoes')
          .select(
            'id, ordem, tipo, descricao, responsavel_nome, prazo, situacao, eficaz, verificacao_obs'
          )
          .eq('nc_id', id)
          .order('ordem'),
      ])

      setEmpresa((emp || null) as Empresa | null)
      /* Sem a migração das ações, a seção 4 cai no campo de texto
         antigo em vez de quebrar a folha inteira. */
      setAcoes((lista || []) as Acao[])

      const caminhos = (linha.fotos || (linha.foto_path ? [linha.foto_path] : [])).filter(Boolean)

      if (caminhos.length) {
        const { data: urls } = await supabase.storage
          .from('inspecao-fotos')
          .createSignedUrls(caminhos, 3600)
        setFotos(((urls || []) as any[]).map((u) => u.signedUrl).filter(Boolean))
      }
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível abrir a não conformidade.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (carregando) return <div className="app"><p className="empty-state">Carregando…</p></div>

  if (erro || !nc) {
    return (
      <div className="app">
        <div className="banner bad">{erro || 'Não conformidade não encontrada.'}</div>
        <Link href="/inspecoes/nc" className="btn btn-sm">
          Voltar
        </Link>
      </div>
    )
  }

  const nomeEmpresa = empresa ? empresa.nome_fantasia || empresa.razao_social : '—'
  const codigo = nc.codigo || 'sem número'
  const porques = [nc.porque_1, nc.porque_2, nc.porque_3, nc.porque_4, nc.porque_5].filter(
    (p) => (p || '').trim()
  )

  /*
   * A identificação que vai no rodapé de todas as folhas. A hora da
   * última alteração é o que diz se a folha na mão de alguém é a
   * versão de agora — a hora da impressão, sozinha, não diz nada.
   */
  const rodape =
    `${codigo} · ${nomeEmpresa} · atualizada em ${dataHora(nc.atualizado_em || nc.created_at)}`

  return (
    <div className="app rnc" data-rodape={rodape}>
      <div className="nao-imprimir" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Link href="/inspecoes/nc" className="btn btn-sm">
          Voltar
        </Link>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </button>
      </div>

      <div className="rnc-cabeca-impressa">{rodape}</div>

      <header className="rnc-cabeca">
        <div>
          <p className="rnc-empresa">{nomeEmpresa}</p>
          <h1>Relatório de Não Conformidade</h1>
          <p className="rnc-empresa">RNC · Sistema de Gestão — Inspeções</p>
        </div>
        <div className="rnc-codigo">
          <strong>{codigo}</strong>
          <span>aberta em {soData(nc.created_at)}</span>
          <span>{SITUACAO[nc.situacao] || nc.situacao}</span>
        </div>
      </header>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">1</span>Identificação
        </h2>
        <dl className="rnc-campos">
          <div>
            <dt>Número</dt>
            <dd>{codigo}</dd>
          </div>
          <div>
            <dt>Abertura</dt>
            <dd>{dataHora(nc.created_at)}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>{SITUACAO[nc.situacao] || nc.situacao}</dd>
          </div>
          <div>
            <dt>Origem</dt>
            <dd>{ORIGEM[nc.origem || ''] || nc.origem || '—'}</dd>
          </div>
          <div>
            <dt>Local</dt>
            <dd>{nc.local_nome || '—'}</dd>
          </div>
          <div>
            <dt>Gravidade</dt>
            <dd>
              {GRAVIDADE[nc.gravidade] || nc.gravidade}
              {nc.risco ? ` · risco ${nc.risco}` : ''}
            </dd>
          </div>
          <div>
            <dt>Responsável pelo tratamento</dt>
            <dd>{nc.responsavel_nome || '—'}</dd>
          </div>
          <div>
            <dt>Prazo</dt>
            <dd>{soDataSimples(nc.prazo)}</dd>
          </div>
          {/* O elo que o concorrente imprime vazio: de qual visita este
              desvio saiu. Aqui ele é preenchido pelo próprio campo. */}
          <div>
            <dt>Inspeção de origem</dt>
            <dd>
              {nc.visita_id ? (
                <Link href={'/inspecoes/visita/' + nc.visita_id}>Relatório da visita</Link>
              ) : nc.inspecao_id ? (
                <Link href={'/inspecoes/' + nc.inspecao_id}>Checklist de origem</Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Coordenada do apontamento</dt>
            <dd>
              {nc.latitude && nc.longitude
                ? `${nc.latitude.toFixed(6)}, ${nc.longitude.toFixed(6)}`
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">2</span>Descrição da ocorrência
        </h2>
        {nc.titulo && <p className="rnc-texto" style={{ fontWeight: 600 }}>{nc.titulo}</p>}
        <p className="rnc-texto">{nc.descricao}</p>

        {fotos.length > 0 && (
          <div className="rnc-fotos">
            {fotos.map((src, i) => (
              <img key={i} src={src} alt={'Foto ' + (i + 1) + ' do apontamento'} />
            ))}
          </div>
        )}
      </section>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">3</span>Ação imediata (contenção)
        </h2>
        {nc.acao_imediata?.trim() ? (
          <p className="rnc-texto">{nc.acao_imediata}</p>
        ) : (
          <p className="rnc-vazio">Nada foi registrado como contenção.</p>
        )}
      </section>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">4</span>Investigação e causa-raiz
        </h2>

        {porques.length > 0 ? (
          <ol className="rnc-porques">
            {porques.map((p, i) => (
              <li key={i}>
                <b>{i + 1}</b>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rnc-vazio">Os porquês não foram preenchidos.</p>
        )}

        <dl className="rnc-campos" style={{ marginTop: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt>Causa-raiz</dt>
            <dd style={{ fontWeight: 500 }}>{nc.causa?.trim() || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">5</span>Plano de ação
        </h2>

        {acoes.length > 0 ? (
          <table className="rnc-tabela">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>O que será feito</th>
                <th style={{ width: 92 }}>Tipo</th>
                <th style={{ width: 130 }}>Responsável</th>
                <th style={{ width: 78 }}>Prazo</th>
                <th style={{ width: 96 }}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {acoes.map((a) => (
                <tr key={a.id}>
                  <td>{a.ordem}</td>
                  <td>{a.descricao}</td>
                  <td>{TIPO_ACAO[a.tipo] || a.tipo}</td>
                  <td>{a.responsavel_nome || '—'}</td>
                  <td>{soDataSimples(a.prazo)}</td>
                  <td>{SITUACAO_ACAO[a.situacao] || a.situacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : nc.acao_corretiva?.trim() ? (
          <p className="rnc-texto">{nc.acao_corretiva}</p>
        ) : (
          <p className="rnc-vazio">Nenhuma ação registrada.</p>
        )}
      </section>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">6</span>Verificação da eficácia
        </h2>

        <dl className="rnc-campos">
          <div>
            <dt>Resultado</dt>
            <dd>
              {nc.eficaz === null
                ? 'Ainda não verificada'
                : nc.eficaz
                  ? 'As ações resolveram'
                  : 'As ações não resolveram'}
            </dd>
          </div>
          <div>
            <dt>Verificada em</dt>
            <dd>{dataHora(nc.verificada_em)}</dd>
          </div>
        </dl>

        {nc.verificacao_obs?.trim() ? (
          <p className="rnc-texto" style={{ marginTop: 12 }}>
            {nc.verificacao_obs}
          </p>
        ) : (
          <p className="rnc-vazio" style={{ marginTop: 12 }}>
            O que foi conferido depois ainda não foi escrito.
          </p>
        )}

        {acoes.some((a) => a.situacao === 'encerrada') && (
          <table className="rnc-tabela" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Ação encerrada</th>
                <th style={{ width: 110 }}>Funcionou</th>
              </tr>
            </thead>
            <tbody>
              {acoes
                .filter((a) => a.situacao === 'encerrada')
                .map((a) => (
                  <tr key={a.id}>
                    <td>{a.ordem}</td>
                    <td>{a.descricao}</td>
                    <td>{a.eficaz ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">7</span>Encerramento
        </h2>
        <dl className="rnc-campos">
          <div>
            <dt>Situação final</dt>
            <dd>{SITUACAO[nc.situacao] || nc.situacao}</dd>
          </div>
          <div>
            <dt>Encerrada em</dt>
            <dd>{dataHora(nc.encerrada_em)}</dd>
          </div>
        </dl>
      </section>

      <section className="rnc-secao">
        <h2>
          <span className="rnc-numero">8</span>Assinaturas
        </h2>
        <div className="rnc-assinaturas">
          <div className="rnc-assinatura">
            <strong>{nc.responsavel_nome || ' '}</strong>
            <span>Responsável pelo tratamento</span>
          </div>
          <div className="rnc-assinatura">
            <strong>&nbsp;</strong>
            <span>Gestor da área · data ___/___/____</span>
          </div>
          <div className="rnc-assinatura">
            <strong>&nbsp;</strong>
            <span>Responsável pelo sistema de gestão · data ___/___/____</span>
          </div>
        </div>
      </section>

      <p className="rnc-rodape-tela nao-imprimir">
        {rodape} · esta folha foi gerada em {dataHora(geradoEm)}.
      </p>
    </div>
  )
}

export default function RelatorioDaNC() {
  return (
    <ComModulo modulo="inspecoes" ou="auditoria">
      <RncConteudo />
    </ComModulo>
  )
}
