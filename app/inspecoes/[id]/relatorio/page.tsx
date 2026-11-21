'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import '../../../colaboradores/colaboradores.css'
import '../../inspecoes.css'
/* O formato de documento é o mesmo do relatório de auditoria — capa,
 * seções numeradas, lacuna declarada, cabeçalho controlado e regras de
 * impressão. Importar a folha de lá evita duas cópias que divergem no
 * primeiro ajuste de margem. O que é só desta tela está no .css ao
 * lado. */
import '../../../auditorias/[id]/relatorio/relatorio.css'
import './relatorio.css'

/*
 * Relatório da inspeção.
 *
 * POR QUE ELE EXISTE. A inspeção já produzia tudo — respostas, fotos,
 * não conformidades — e não produzia o documento. O cliente saía da
 * visita com o dado no portal e sem nada para entregar ao gestor da
 * área, arquivar no PGR ou mostrar ao fiscal. Dado sem documento não
 * vira evidência.
 *
 * NÃO É O RELATÓRIO DE AUDITORIA COM OUTRO NOME. A auditoria pergunta
 * "o sistema atende?" e conclui sobre o sistema; a inspeção pergunta "o
 * que está errado aqui, agora?" e conclui sobre o local. Por isso aqui
 * a foto é seção própria e não enfeite: numa inspeção de campo a
 * fotografia é a evidência principal, e é ela que o gestor da área
 * entende sem ler o resto.
 *
 * OS NÚMEROS SÃO OS CONGELADOS NA CONCLUSÃO. A inspeção guarda
 * itens_total, conformes, não conformes e percentual no momento em que
 * foi concluída. O relatório mostra esses, e não um recálculo: se
 * alguém reabrir e mexer depois, o documento emitido continua dizendo o
 * que valia no dia — que é a única coisa que um registro de inspeção
 * precisa garantir.
 *
 * O QUE FALTA APARECE. Campo em branco vira "não registrado" em vez de
 * sumir. Relatório que esconde a lacuna é bonito e inútil: quem lê
 * precisa saber que a observação não foi escrita, não achar que não
 * havia nada a dizer.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const RESPOSTAS: Record<string, string> = {
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  nao_aplicavel: 'Não aplicável',
}

const GRAVIDADES: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

const SITUACOES_NC: Record<string, string> = {
  aberta: 'Aberta',
  em_acao: 'Em ação',
  verificacao: 'Aguardando verificação',
  encerrada: 'Encerrada',
}

type Inspecao = {
  id: string
  empresa_id: string
  tipo: string | null
  modelo_nome: string
  norma: string | null
  local_nome: string | null
  inspetor_nome: string | null
  iniciada_em: string
  concluida_em: string | null
  situacao: string
  observacoes: string | null
  itens_total: number
  conformes: number
  nao_conformes: number
  nao_aplicaveis: number
  percentual: number | null
  doc_codigo: string | null
  doc_revisao: string | null
}

type Resposta = {
  id: string
  ordem: number
  categoria: string | null
  pergunta: string
  resposta: string | null
  observacao: string | null
  foto_path: string | null
  fotos: string[] | null
}

type NaoConformidade = {
  id: string
  descricao: string
  gravidade: string
  prazo: string | null
  responsavel_nome: string | null
  situacao: string
  acao_imediata: string | null
  causa: string | null
  acao_corretiva: string | null
  verificada_em: string | null
  eficaz: boolean | null
  verificacao_obs: string | null
  foto_path: string | null
}

type Empresa = { razao_social: string; nome_fantasia: string | null; cnpj: string | null }

const dataBr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' }) : null

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null

const soData = (d: string | null) => (d ? d.split('-').reverse().join('/') : null)

/* Linha rótulo/valor. Sem valor, declara a lacuna em vez de sumir. */
function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="rel-campo">
      <span className="rel-rotulo">{rotulo}</span>
      <span className={'rel-valor' + (valor ? '' : ' falta')}>{valor || 'não registrado'}</span>
    </div>
  )
}

function RelatorioConteudo() {
  const params = useParams()
  const id = String(params?.id || '')

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [inspecao, setInspecao] = useState<Inspecao | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [ncs, setNcs] = useState<NaoConformidade[]>([])
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const [interno, setInterno] = useState(false)

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

      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil')
        .eq('id', user.id)
        .single()
      setInterno(PERFIS_INTERNOS.includes(perfil?.perfil || ''))

      const { data: insp, error: e1 } = await supabase
        .from('inspecoes')
        .select(
          'id, empresa_id, tipo, modelo_nome, norma, local_nome, inspetor_nome, iniciada_em, ' +
            'concluida_em, situacao, observacoes, itens_total, conformes, nao_conformes, ' +
            'nao_aplicaveis, percentual, doc_codigo, doc_revisao'
        )
        .eq('id', id)
        .single()
      if (e1) throw e1
      setInspecao(insp as unknown as Inspecao)

      const [{ data: emp }, { data: resp }, { data: nc }] = await Promise.all([
        supabase
          .from('empresas')
          .select('razao_social, nome_fantasia, cnpj')
          .eq('id', (insp as any).empresa_id)
          .maybeSingle(),
        supabase
          .from('inspecao_respostas')
          .select('id, ordem, categoria, pergunta, resposta, observacao, foto_path, fotos')
          .eq('inspecao_id', id)
          .order('ordem'),
        supabase
          .from('nao_conformidades')
          .select(
            'id, descricao, gravidade, prazo, responsavel_nome, situacao, acao_imediata, ' +
              'causa, acao_corretiva, verificada_em, eficaz, verificacao_obs, foto_path'
          )
          .eq('inspecao_id', id)
          .order('created_at'),
      ])

      setEmpresa((emp || null) as Empresa | null)
      const listaResp = (resp || []) as unknown as Resposta[]
      setRespostas(listaResp)
      setNcs((nc || []) as unknown as NaoConformidade[])

      /* As fotos vêm por URL assinada: o balde é privado, e deixá-lo
         público para facilitar o relatório exporia foto de obra de
         cliente a quem tiver o endereço. */
      const caminhos = [
        ...listaResp.flatMap((r) => r.fotos || (r.foto_path ? [r.foto_path] : [])),
        ...((nc || []) as any[]).map((n) => n.foto_path).filter(Boolean),
      ].filter((c, i, a) => c && a.indexOf(c) === i) as string[]

      if (caminhos.length > 0) {
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
      setErro(e?.message || 'Não foi possível montar o relatório.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  if (erro || !inspecao) {
    return (
      <div className="app">
        <div className="banner bad">{erro || 'Inspeção não encontrada.'}</div>
        <Link href="/inspecoes" className="btn btn-sm">
          Voltar
        </Link>
      </div>
    )
  }

  /* Inspeção e auditoria dividem a mesma tabela, distinguidas por
     `tipo`. Sem esta porta, abrir o id de uma auditoria aqui produziria
     um documento com cara de inspeção sobre uma auditoria — e um
     relatório que descreve errado o que foi feito é pior do que
     relatório nenhum. */
  if (inspecao.tipo === 'auditoria') {
    return (
      <div className="app">
        <div className="banner">
          Isto é uma auditoria, não uma inspeção. O relatório dela segue a ISO 19011 e tem outro
          formato.{' '}
          <Link href={'/auditorias/' + inspecao.id + '/relatorio'} className="btn btn-sm">
            Abrir o relatório da auditoria
          </Link>
        </div>
      </div>
    )
  }

  const concluida = inspecao.situacao === 'concluida'
  const naoConformes = respostas.filter((r) => r.resposta === 'nao_conforme')
  const comFoto = respostas.filter((r) => (r.fotos || []).length > 0 || r.foto_path)

  /* Agrupa por categoria preservando a ordem de aplicação — o
     relatório tem de ler na mesma sequência em que foi percorrido em
     campo, senão quem acompanhou a inspeção não reconhece o documento. */
  const categorias: { nome: string; itens: Resposta[] }[] = []
  respostas.forEach((r) => {
    const nome = r.categoria || 'Itens'
    const atual = categorias[categorias.length - 1]
    if (atual && atual.nome === nome) atual.itens.push(r)
    else categorias.push({ nome, itens: [r] })
  })

  const empresaNome = empresa ? empresa.nome_fantasia || empresa.razao_social : null

  return (
    <div className="app rel">
      <div className="nao-imprimir" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Link href={'/inspecoes/' + inspecao.id} className="btn btn-sm">
          Voltar à inspeção
        </Link>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </button>
      </div>

      {!concluida && (
        <div className="banner nao-imprimir">
          Esta inspeção ainda não foi concluída. O relatório sai assim mesmo, com o que já existe
          — mas os números só congelam quando ela for encerrada.
        </div>
      )}

      <div className="rel-capa">
        <p className="eyebrow">RELATÓRIO DE INSPEÇÃO</p>
        <h1>{inspecao.modelo_nome}</h1>
        <p className="rel-sub">
          {empresaNome || 'Empresa não identificada'}
          {inspecao.local_nome ? ' · ' + inspecao.local_nome : ''}
          {inspecao.concluida_em ? ' · ' + dataBr(inspecao.concluida_em) : ''}
        </p>
      </div>

      {/* Cabeçalho controlado: um relatório sem código e revisão é ele
          mesmo uma não conformidade de informação documentada. */}
      <div className={'rel-controle' + (inspecao.doc_codigo ? '' : ' falta')}>
        <span>
          <strong>Documento:</strong> {inspecao.doc_codigo || 'sem código'}
        </span>
        <span>
          <strong>Revisão:</strong> {inspecao.doc_revisao || '00'}
        </span>
        <span>
          <strong>Emitido em:</strong> {dataHora(new Date().toISOString())}
        </span>
      </div>

      <section>
        <h2>1. Identificação</h2>
        <div className="rel-campos">
          <Campo rotulo="Empresa" valor={empresa?.razao_social} />
          <Campo rotulo="CNPJ" valor={empresa?.cnpj} />
          <Campo rotulo="Local inspecionado" valor={inspecao.local_nome} />
          <Campo rotulo="Checklist aplicado" valor={inspecao.modelo_nome} />
          <Campo rotulo="Norma de referência" valor={inspecao.norma} />
          <Campo rotulo="Inspetor" valor={inspecao.inspetor_nome} />
          <Campo rotulo="Início" valor={dataHora(inspecao.iniciada_em)} />
          <Campo rotulo="Conclusão" valor={dataHora(inspecao.concluida_em)} />
        </div>
      </section>

      <section>
        <h2>2. Resultado</h2>
        <table className="tabela-colab rel-itens">
          <thead>
            <tr>
              <th>Itens verificados</th>
              <th>Conformes</th>
              <th>Não conformes</th>
              <th>Não aplicáveis</th>
              <th>Conformidade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{inspecao.itens_total || respostas.length}</td>
              <td>{inspecao.conformes}</td>
              <td>{inspecao.nao_conformes}</td>
              <td>{inspecao.nao_aplicaveis}</td>
              <td>
                <strong>
                  {inspecao.percentual !== null ? inspecao.percentual + '%' : 'não calculada'}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="rel-nota">
          A conformidade considera só os itens que valiam ponto: o que foi marcado como não
          aplicável fica fora da conta, para não premiar nem punir quem não tinha aquele risco.
        </p>
        {inspecao.observacoes && (
          <>
            <p className="rel-sub-h">Observações gerais do inspetor</p>
            <p className="rel-valor">{inspecao.observacoes}</p>
          </>
        )}
      </section>

      <section>
        <h2>3. Não conformidades</h2>
        {ncs.length === 0 ? (
          <p className={'rel-valor' + (naoConformes.length > 0 ? ' falta' : '')}>
            {naoConformes.length > 0
              ? `${naoConformes.length} item marcado como não conforme não virou não conformidade registrada. Item reprovado sem dono e sem prazo não é tratado.`
              : 'Nenhuma não conformidade registrada nesta inspeção.'}
          </p>
        ) : (
          ncs.map((n, i) => (
            <div key={n.id} className="rel-nc">
              <p className="rel-sub-h">
                {i + 1}. {n.descricao}
              </p>
              <div className="rel-campos">
                <Campo rotulo="Gravidade" valor={GRAVIDADES[n.gravidade] || n.gravidade} />
                <Campo rotulo="Responsável" valor={n.responsavel_nome} />
                <Campo rotulo="Prazo" valor={soData(n.prazo)} />
                <Campo rotulo="Situação" valor={SITUACOES_NC[n.situacao] || n.situacao} />
                <Campo rotulo="Ação imediata" valor={n.acao_imediata} />
                <Campo rotulo="Causa" valor={n.causa} />
                <Campo rotulo="Ação corretiva" valor={n.acao_corretiva} />
                <Campo
                  rotulo="Verificação da eficácia"
                  valor={
                    n.verificada_em
                      ? `${dataBr(n.verificada_em)} — ${n.eficaz ? 'eficaz' : 'não eficaz'}` +
                        (n.verificacao_obs ? `: ${n.verificacao_obs}` : '')
                      : null
                  }
                />
              </div>
              {n.foto_path && fotos[n.foto_path] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="rel-foto" src={fotos[n.foto_path]} alt="" />
              )}
            </div>
          ))
        )}
        <p className="rel-nota">
          A verificação da eficácia é o que a ISO 45001 e a ISO 9001 pedem no 10.2: não basta
          executar a ação, é preciso conferir depois que o problema parou de acontecer.
        </p>
      </section>

      <section>
        <h2>4. Item a item</h2>
        {respostas.length === 0 ? (
          <p className="rel-valor falta">Nenhum item respondido.</p>
        ) : (
          categorias.map((c, ci) => (
            <div key={ci} className="rel-req">
              <p className="rel-sub-h">{c.nome}</p>
              <table className="tabela-colab rel-itens">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>O que foi verificado</th>
                    <th style={{ width: 130 }}>Resultado</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {c.itens.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.ordem}</td>
                      <td>{r.pergunta}</td>
                      <td>
                        {r.resposta === 'nao_conforme' && (
                          <span className="pill bad">Não conforme</span>
                        )}
                        {r.resposta === 'conforme' && <span className="pill good">Conforme</span>}
                        {r.resposta === 'nao_aplicavel' && (
                          <span className="pill flat">Não aplicável</span>
                        )}
                        {!r.resposta && <span className="pill warn">Sem resposta</span>}
                      </td>
                      <td className={r.observacao ? '' : 'rel-valor falta'}>
                        {r.observacao ||
                          (r.resposta === 'nao_conforme' ? 'não registrada' : '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      <section>
        <h2>5. Registro fotográfico</h2>
        {comFoto.length === 0 ? (
          <p className="rel-valor falta">
            Nenhuma foto anexada. Em inspeção de campo a foto costuma ser a evidência mais forte
            do que foi visto.
          </p>
        ) : (
          <div className="rel-galeria">
            {comFoto.flatMap((r) =>
              (r.fotos || (r.foto_path ? [r.foto_path] : [])).map((caminho, k) =>
                fotos[caminho] ? (
                  <figure key={`${r.id}-${k}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotos[caminho]} alt="" />
                    <figcaption>
                      <strong>{r.ordem}.</strong> {r.pergunta}
                      {r.resposta === 'nao_conforme' && ' — não conforme'}
                    </figcaption>
                  </figure>
                ) : null
              )
            )}
          </div>
        )}
      </section>

      <section>
        <h2>6. Ressalva</h2>
        <p className="rel-nota">
          A inspeção é uma verificação por amostragem, do que estava visível no local e no momento
          da visita. Item conforme aqui não garante conformidade permanente, e a ausência de
          registro de um problema não prova que ele não exista: prova que não foi observado nesta
          visita.
        </p>
      </section>

      <section className="rel-rodape">
        <h2>7. Encerramento</h2>
        <div className="rel-campos">
          <Campo rotulo="Inspeção realizada por" valor={inspecao.inspetor_nome} />
          <Campo rotulo="Data da conclusão" valor={dataHora(inspecao.concluida_em)} />
        </div>
        <div className="rel-assinaturas">
          <div>
            <span className="rel-linha-ass" />
            <p>{inspecao.inspetor_nome || 'Inspetor'}</p>
            <p className="rel-mini">Responsável pela inspeção</p>
          </div>
          <div>
            <span className="rel-linha-ass" />
            <p>Responsável pela área</p>
            <p className="rel-mini">Ciente das não conformidades e dos prazos</p>
          </div>
        </div>
        {interno && (
          <p className="rel-mini nao-imprimir">
            Emitido pelo portal da Real Life a partir dos registros da inspeção. Os números são os
            congelados na conclusão.
          </p>
        )}
      </section>
    </div>
  )
}

export default function RelatorioDaInspecao() {
  return (
    <ComModulo modulo="inspecoes">
      <RelatorioConteudo />
    </ComModulo>
  )
}
