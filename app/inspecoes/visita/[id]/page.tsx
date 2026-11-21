'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import Ajuda from '@/components/Ajuda'
import '../../../colaboradores/colaboradores.css'
import '../../inspecoes.css'
import '../../../auditorias/[id]/relatorio/relatorio.css'
import '../../[id]/relatorio/relatorio.css'
import './visita.css'
import '../../visual.css'

/*
 * RIC — Relatório de Inspeção de Campo.
 *
 * É o documento que fica com o cliente na saída da visita: o que foi
 * visto, com foto, onde, por quem, quando, e sob que código.
 *
 * O CÓDIGO JÁ VEM RESERVADO. Ele nasceu quando a visita foi encerrada,
 * não agora — por isso esta tela não emite nada: ela lê o relatório
 * que já existe e o desenha. Reimprimir não gera número novo, e é essa
 * estabilidade que faz o código servir como identificação de documento
 * na ISO 7.5.2.
 *
 * REVISAR É EXPLÍCITO. Se algo mudou depois da emissão — um prazo
 * repactuado, uma descrição corrigida — alguém clica em "registrar
 * revisão" e o número da revisão sobe, com data. Subir sozinho a cada
 * abertura faria o documento mudar de versão sem ninguém ter mexido
 * nele, e aí a revisão não prova nada.
 *
 * OS NÚMEROS DO CABEÇALHO SÃO OS CONGELADOS NA EMISSÃO (resumo). O que
 * aconteceu com os apontamentos depois aparece no corpo, mas o resumo
 * continua dizendo o que o documento dizia no dia.
 */

const CLASSES: Record<string, { rotulo: string; cor: string }> = {
  conforme: { rotulo: 'Conforme', cor: 'good' },
  insuficiente: { rotulo: 'Atende em parte', cor: 'warn' },
  oportunidade: { rotulo: 'Oportunidade de melhoria', cor: 'warn' },
}

type Visita = {
  id: string
  empresa_id: string
  local_nome: string | null
  responsavel_nome: string | null
  iniciada_em: string
  encerrada_em: string | null
  situacao: string
  latitude: number | null
  longitude: number | null
  precisao_m: number | null
  observacoes: string | null
  ciente_nome: string | null
  ciente_cargo: string | null
  ciente_em: string | null
}

type Relatorio = {
  id: string
  codigo: string
  revisao: number
  emitido_em: string
  revisado_em: string | null
  emitido_por_nome: string | null
  resumo: any
}

type Apontamento = {
  id: string
  titulo: string | null
  descricao: string
  classificacao: string | null
  gravidade: string
  prazo: string | null
  responsavel_nome: string | null
  situacao: string
  fotos: string[] | null
  foto_path: string | null
  created_at: string
}

type Empresa = { razao_social: string; nome_fantasia: string | null; cnpj: string | null }

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null

const soData = (d: string | null) => (d ? d.split('-').reverse().join('/') : null)

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="rel-campo">
      <span className="rel-rotulo">{rotulo}</span>
      <span className={'rel-valor' + (valor ? '' : ' falta')}>{valor || 'não registrado'}</span>
    </div>
  )
}

function VisitaConteudo() {
  const params = useParams()
  const id = String(params?.id || '')

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [visita, setVisita] = useState<Visita | null>(null)
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([])
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const [revisando, setRevisando] = useState(false)

  const carregar = useCallback(async () => {
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

      const { data: v, error: e1 } = await supabase
        .from('inspecao_visitas')
        .select('*')
        .eq('id', id)
        .single()
      if (e1) throw e1
      setVisita(v as unknown as Visita)

      const [{ data: rel }, { data: emp }, { data: aps }] = await Promise.all([
        supabase
          .from('relatorios_emitidos')
          .select('id, codigo, revisao, emitido_em, revisado_em, emitido_por_nome, resumo')
          .eq('visita_id', id)
          .order('emitido_em', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('empresas')
          .select('razao_social, nome_fantasia, cnpj')
          .eq('id', (v as any).empresa_id)
          .maybeSingle(),
        supabase
          .from('nao_conformidades')
          .select(
            'id, titulo, descricao, classificacao, gravidade, prazo, responsavel_nome, situacao, fotos, foto_path, created_at'
          )
          .eq('visita_id', id)
          .order('created_at'),
      ])

      setRelatorio((rel || null) as Relatorio | null)
      setEmpresa((emp || null) as Empresa | null)
      const lista = (aps || []) as unknown as Apontamento[]
      setApontamentos(lista)

      const caminhos = lista
        .flatMap((a) => a.fotos || (a.foto_path ? [a.foto_path] : []))
        .filter((c, i, arr) => c && arr.indexOf(c) === i)

      if (caminhos.length) {
        const { data: urls } = await supabase.storage
          .from('inspecao-fotos')
          .createSignedUrls(caminhos, 3600)
        const mapa: Record<string, string> = {}
        ;(urls || []).forEach((u: any) => {
          if (u.signedUrl && u.path) mapa[u.path] = u.signedUrl
        })
        setFotos(mapa)
      }
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível abrir o relatório.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function registrarRevisao() {
    if (!relatorio || revisando) return
    setRevisando(true)
    const { error } = await supabase.rpc('revisar_relatorio', { p_relatorio: relatorio.id })
    setRevisando(false)
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  if (carregando) {
    return (
      <div className="app insp-v2">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  if (erro || !visita) {
    return (
      <div className="app insp-v2">
        <div className="banner bad">{erro || 'Visita não encontrada.'}</div>
        <Link href="/inspecoes/campo" className="btn btn-sm">
          Voltar
        </Link>
      </div>
    )
  }

  const empresaNome = empresa ? empresa.nome_fantasia || empresa.razao_social : null
  const rodape = relatorio
    ? `${relatorio.codigo} rev. ${String(relatorio.revisao).padStart(2, '0')}`
    : 'sem código'

  const porClasse = (c: string | null) =>
    apontamentos.filter((a) => (a.classificacao || null) === c)

  return (
    <div className="app rel ric" data-rodape={rodape}>
      <div className="nao-imprimir ric-acoes">
        <Link href="/inspecoes/relatorios" className="btn btn-sm">
          Todos os relatórios
        </Link>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </button>
        {relatorio && (
          <button type="button" className="btn btn-sm" disabled={revisando} onClick={registrarRevisao}>
            {revisando ? 'Registrando…' : 'Registrar revisão'}
          </button>
        )}
      </div>

      {!relatorio && (
        <div className="banner bad nao-imprimir">
          Esta visita não tem relatório emitido. Isso acontece quando o encerramento falhou por
          falta de sinal — os apontamentos estão salvos, e encerrar de novo resolve.
        </div>
      )}

      {/* Cabeçalho que repete no alto de cada página impressa. */}
      <div className="ric-cabeca-impressa">
        {empresaNome} · {visita.local_nome || 'local não registrado'} · {rodape}
      </div>

      <div className="rel-capa">
        <p className="eyebrow">RELATÓRIO DE INSPEÇÃO DE CAMPO</p>
        <h1>{empresaNome || 'Empresa não identificada'}</h1>
        <p className="rel-sub">
          {visita.local_nome || 'Local não registrado'} ·{' '}
          {dataHora(visita.iniciada_em)}
          {visita.encerrada_em ? ` às ${hora(visita.encerrada_em)}` : ' — ainda em andamento'}
        </p>
      </div>

      <div className={'rel-controle' + (relatorio ? '' : ' falta')}>
        <span>
          <strong>Código:</strong> {relatorio?.codigo || 'não emitido'}{' '}
          <Ajuda
            titulo="Código e revisão"
            texto="O código identifica esta visita para sempre; reimprimir não gera número novo. Se algo mudar depois de emitido — um prazo repactuado, um texto corrigido —, use 'Registrar revisão': é o que a ISO 7.5.2 espera de um documento controlado."
          />
        </span>
        <span>
          <strong>Revisão:</strong>{' '}
          {relatorio ? String(relatorio.revisao).padStart(2, '0') : '—'}
          {relatorio?.revisado_em ? ` · ${dataHora(relatorio.revisado_em)}` : ''}
        </span>
        <span>
          <strong>Emitido em:</strong> {dataHora(relatorio?.emitido_em || null) || '—'}
        </span>
      </div>

      <section>
        <h2>1. Identificação</h2>
        <div className="rel-campos">
          <Campo rotulo="Empresa" valor={empresa?.razao_social} />
          <Campo rotulo="CNPJ" valor={empresa?.cnpj} />
          <Campo rotulo="Local" valor={visita.local_nome} />
          <Campo rotulo="Inspeção realizada por" valor={visita.responsavel_nome} />
          <Campo rotulo="Preparado por" valor="Real Life SSMA" />
          <Campo rotulo="Início" valor={dataHora(visita.iniciada_em)} />
          <Campo rotulo="Encerramento" valor={dataHora(visita.encerrada_em)} />
          <Campo
            rotulo="Coordenada"
            valor={
              visita.latitude !== null && visita.longitude !== null
                ? `${Number(visita.latitude).toFixed(6)}, ${Number(visita.longitude).toFixed(6)}` +
                  (visita.precisao_m ? ` (±${visita.precisao_m} m)` : '')
                : null
            }
          />
          <Campo rotulo="Emitido por" valor={relatorio?.emitido_por_nome} />
        </div>
      </section>

      <section>
        <h2>2. Resumo</h2>
        <table className="tabela-colab rel-itens">
          <thead>
            <tr>
              <th>Conformes</th>
              <th>Atendem em parte</th>
              <th>Oportunidades</th>
              <th>Não conformidades</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">{porClasse('conforme').length}</td>
              <td className="mono">{porClasse('insuficiente').length}</td>
              <td className="mono">{porClasse('oportunidade').length}</td>
              <td className="mono">{porClasse(null).length}</td>
              <td className="mono">
                <strong>{apontamentos.length}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        {visita.observacoes && (
          <>
            <p className="rel-sub-h">Observações da visita</p>
            <p className="rel-valor">{visita.observacoes}</p>
          </>
        )}
      </section>

      <section>
        <h2>3. Apontamentos</h2>
        {apontamentos.length === 0 ? (
          <p className="rel-valor falta">Nenhum apontamento foi registrado nesta visita.</p>
        ) : (
          apontamentos.map((a, i) => {
            const classe = a.classificacao ? CLASSES[a.classificacao] : null
            const imagens = (a.fotos || (a.foto_path ? [a.foto_path] : [])).filter((f) => fotos[f])
            return (
              <div key={a.id} className="ric-item">
                <div className="ric-item-cabeca">
                  <span className="ric-num">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="ric-titulo">{a.titulo || 'Sem título'}</p>
                    <span className={'pill ' + (classe ? classe.cor : 'bad')}>
                      {classe ? classe.rotulo : 'Não conformidade'}
                    </span>
                  </div>
                </div>

                <p className="ric-desc">{a.descricao}</p>

                {!classe || a.classificacao === 'insuficiente' ? (
                  <div className="rel-campos ric-tratamento">
                    <Campo rotulo="Gravidade" valor={a.gravidade} />
                    <Campo rotulo="Responsável" valor={a.responsavel_nome} />
                    <Campo rotulo="Prazo" valor={soData(a.prazo)} />
                    <Campo rotulo="Situação" valor={a.situacao} />
                  </div>
                ) : null}

                {imagens.length > 0 && (
                  <div className="ric-fotos">
                    {imagens.map((f, k) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img key={k} src={fotos[f]} alt="" />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>

      <section className="rel-rodape">
        <h2>4. Ciência e encerramento</h2>
        <p className="rel-nota">
          A inspeção é verificação por amostragem, do que estava visível no local e no momento da
          visita. O que não foi registrado não prova ausência de problema: prova que não foi
          observado nesta visita.
        </p>

        {visita.ciente_em ? (
          <div className="rel-campos">
            <Campo rotulo="Ciente" valor={visita.ciente_nome} />
            <Campo rotulo="Cargo" valor={visita.ciente_cargo} />
            <Campo rotulo="Data" valor={dataHora(visita.ciente_em)} />
          </div>
        ) : null}

        <div className="rel-assinaturas">
          <div>
            <span className="rel-linha-ass" />
            <p>{visita.responsavel_nome || 'Responsável pela inspeção'}</p>
            <p className="rel-mini">Real Life SSMA</p>
          </div>
          <div>
            <span className="rel-linha-ass" />
            <p>{visita.ciente_nome || 'Responsável pela área'}</p>
            <p className="rel-mini">Ciente dos apontamentos e dos prazos</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function RelatorioDaVisita() {
  return (
    <ComModulo modulo="inspecoes">
      <VisitaConteudo />
    </ComModulo>
  )
}
