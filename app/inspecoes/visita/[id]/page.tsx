'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { perfilAtual } from '@/lib/sessaoAtual'
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

/* Uma ação do plano daquele apontamento (nc_acoes). */
type Acao = {
  id: string
  nc_id: string
  ordem: number
  tipo: string
  descricao: string
  responsavel_nome: string | null
  prazo: string | null
  situacao: string
}

const TIPO_ACAO: Record<string, string> = {
  correcao: 'Correção',
  corretiva: 'Ação corretiva',
  preventiva: 'Ação preventiva',
  verificacao: 'Verificação',
}

const SITUACAO_ACAO: Record<string, { rotulo: string; cor: string }> = {
  aberta: { rotulo: 'Aberta', cor: 'flat' },
  execucao: { rotulo: 'Em execução', cor: 'warn' },
  verificacao: { rotulo: 'Em verificação', cor: 'warn' },
  encerrada: { rotulo: 'Encerrada', cor: 'good' },
  cancelada: { rotulo: 'Cancelada', cor: 'flat' },
}

type Apontamento = {
  id: string
  codigo: string | null
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

/* Uma correção registrada: o que foi mexido, por quem e por quê. */
type Alteracao = {
  id: number
  acao: string
  motivo: string
  campos: string | null
  revisao: number | null
  por_nome: string | null
  created_at: string
}

const ACAO: Record<string, string> = {
  reabertura: 'Reaberta para correção',
  cabecalho: 'Identificação corrigida',
  reencerramento: 'Encerrada de novo',
}

/* Nome legível de cada campo, para o histórico não falar em coluna. */
const CAMPO_ROTULO: Record<string, string> = {
  local_id: 'local',
  local_nome: 'local',
  responsavel_nome: 'quem inspecionou',
  iniciada_em: 'início',
  encerrada_em: 'encerramento',
  latitude: 'coordenada',
  longitude: 'coordenada',
  precisao_m: 'coordenada',
  observacoes: 'observações',
  ciente_nome: 'ciente',
  ciente_cargo: 'ciente',
}

const nomesDosCampos = (campos: string | null) => {
  if (!campos) return ''
  const nomes = campos
    .split(',')
    .map((c) => CAMPO_ROTULO[c.trim()] || c.trim())
    .filter((n, i, arr) => arr.indexOf(n) === i)
  return nomes.join(', ')
}

/*
 * ISO ↔ campo de data e hora da tela.
 *
 * O <input type="datetime-local"> fala no fuso de quem olha, e o banco
 * guarda em UTC. Sem converter nos dois sentidos, abrir o formulário já
 * deslocaria a hora da visita em quatro horas — e salvar sem mexer
 * gravaria esse deslocamento como se fosse correção.
 */
function paraCampo(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const doCampo = (valor: string): string | null =>
  valor ? new Date(valor).toISOString() : null

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
  const [acoes, setAcoes] = useState<Record<string, Acao[]>>({})
  const [revisando, setRevisando] = useState(false)

  /* Correção: só gestor e admin, e só com motivo. */
  const [gestao, setGestao] = useState(false)
  const [corrigindo, setCorrigindo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [alteracoes, setAlteracoes] = useState<Alteracao[]>([])
  const [locais, setLocais] = useState<{ id: string; nome: string }[]>([])
  const [form, setForm] = useState({
    local_id: '',
    responsavel_nome: '',
    iniciada_em: '',
    encerrada_em: '',
    latitude: '',
    longitude: '',
    precisao_m: '',
    observacoes: '',
  })

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
            'id, codigo, titulo, descricao, classificacao, gravidade, prazo, responsavel_nome, situacao, fotos, foto_path, created_at'
          )
          .eq('visita_id', id)
          .order('created_at'),
      ])

      setRelatorio((rel || null) as Relatorio | null)
      setEmpresa((emp || null) as Empresa | null)

      /* O formulário de correção começa com o que está valendo: quem
         corrige um campo não deveria ter de redigitar os outros. */
      setForm({
        local_id: (v as any).local_id || '',
        responsavel_nome: (v as any).responsavel_nome || '',
        iniciada_em: paraCampo((v as any).iniciada_em),
        encerrada_em: paraCampo((v as any).encerrada_em),
        latitude: (v as any).latitude === null ? '' : String((v as any).latitude),
        longitude: (v as any).longitude === null ? '' : String((v as any).longitude),
        precisao_m: (v as any).precisao_m === null ? '' : String((v as any).precisao_m),
        observacoes: (v as any).observacoes || '',
      })

      /*
       * Histórico, perfil e locais em paralelo, e nenhum deles derruba
       * a tela: o relatório precisa abrir mesmo que o SQL da correção
       * ainda não tenha rodado no banco.
       */
      const [{ data: alts }, perfil, { data: locs }] = await Promise.all([
        supabase
          .from('inspecao_visitas_alteracoes')
          .select('id, acao, motivo, campos, revisao, por_nome, created_at')
          .eq('visita_id', id)
          .order('created_at', { ascending: false }),
        perfilAtual().catch(() => null),
        supabase
          .from('locais_trabalho')
          .select('id, nome')
          .eq('empresa_id', (v as any).empresa_id)
          .order('nome'),
      ])

      setAlteracoes(((alts || []) as unknown as Alteracao[]) || [])
      setGestao(!!perfil && ['gestor', 'admin'].includes(perfil.perfil || ''))
      setLocais(((locs || []) as { id: string; nome: string }[]) || [])
      const lista = (aps || []) as unknown as Apontamento[]
      setApontamentos(lista)

      /*
       * O plano de ação de cada apontamento.
       *
       * Sem isto, o RIC prova o problema e cala sobre o tratamento: o
       * cliente lê "não conformidade, prazo 10/12" e não tem como saber
       * se alguém já definiu o que vai ser feito. A ISO 45001 10.2 não
       * pergunta se o problema foi visto, pergunta o que se fez com a
       * causa.
       */
      if (lista.length) {
        const { data: acs } = await supabase
          .from('nc_acoes')
          .select('id, nc_id, ordem, tipo, descricao, responsavel_nome, prazo, situacao')
          .in(
            'nc_id',
            lista.map((a) => a.id)
          )
          .order('ordem')
        const porNc: Record<string, Acao[]> = {}
        ;((acs || []) as unknown as Acao[]).forEach((a) => {
          porNc[a.nc_id] = [...(porNc[a.nc_id] || []), a]
        })
        setAcoes(porNc)
      }

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

  /*
   * Corrigir a identificação.
   *
   * Manda só o que está na tela, e a empresa nunca vai junto: o código
   * RIC é por empresa e por ano, e mover a visita de cliente deixaria
   * um número fora de ordem nos dois. Visita no cliente errado se
   * cancela e se refaz.
   */
  async function salvarCabecalho() {
    if (salvando) return
    if (motivo.trim().length < 5) {
      setErro('Diga o motivo da correção — é o que separa corrigir de maquiar.')
      return
    }
    setSalvando(true)
    setErro('')

    const local = locais.find((l) => l.id === form.local_id) || null
    const campos: Record<string, string | null> = {
      responsavel_nome: form.responsavel_nome.trim() || null,
      iniciada_em: doCampo(form.iniciada_em),
      encerrada_em: doCampo(form.encerrada_em),
      latitude: form.latitude.trim() || null,
      longitude: form.longitude.trim() || null,
      precisao_m: form.precisao_m.trim() || null,
      observacoes: form.observacoes.trim() || null,
    }
    /* Local só entra quando foi escolhido um da lista: assim o texto
       congelado de uma visita antiga não some por falta de cadastro. */
    if (local) {
      campos.local_id = local.id
      campos.local_nome = local.nome
    }

    const { error } = await supabase.rpc('corrigir_visita', {
      p_visita: id,
      p_motivo: motivo.trim(),
      p_campos: campos,
    })
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setCorrigindo(false)
    setMotivo('')
    carregar()
  }

  /*
   * Reabrir para mexer nos apontamentos. A tela de campo só deixa
   * editar visita em andamento — é lá que estão a foto, a classificação
   * e o prazo de cada apontamento, e refazer isso aqui seria uma
   * segunda tela dizendo a mesma coisa.
   */
  async function corrigirApontamentos() {
    if (salvando) return
    if (motivo.trim().length < 5) {
      setErro('Diga o motivo da correção — é o que separa corrigir de maquiar.')
      return
    }
    setSalvando(true)
    setErro('')
    const { error } = await supabase.rpc('reabrir_visita', {
      p_visita: id,
      p_motivo: motivo.trim(),
    })
    if (error) {
      setSalvando(false)
      setErro(error.message)
      return
    }
    window.location.href = '/inspecoes/campo?visita=' + id
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
        {gestao && visita.situacao !== 'cancelada' && (
          <button type="button" className="btn btn-sm" onClick={() => setCorrigindo((c) => !c)}>
            {corrigindo ? 'Deixar como está' : 'Corrigir esta inspeção'}
          </button>
        )}
      </div>

      {visita.situacao === 'em_andamento' && (
        <div className="banner nao-imprimir">
          Esta visita está aberta para correção.{' '}
          <Link href={'/inspecoes/campo?visita=' + id}>Voltar para a tela de campo</Link> e encerrar
          de novo — o código não muda, a revisão sobe.
        </div>
      )}

      {/*
        * CORRIGIR É PARTE DO DOCUMENTO, NÃO UMA BRECHA NELE.
        *
        * Documento que não pode ser corrigido vira documento em que
        * ninguém confia: a pessoa passa a manter a planilha paralela
        * "de verdade" do lado. O que protege o RIC é o motivo
        * registrado, o histórico embaixo e a revisão que sobe — não a
        * impossibilidade de arrumar o nome de quem inspecionou.
        */}
      {corrigindo && gestao && (
        <div className="panel nao-imprimir" style={{ marginBottom: 16 }}>
          <div className="panel-body insp-ficha">
            <h3 style={{ marginTop: 0 }}>Corrigir a inspeção</h3>
            <p className="rel-mini">
              A empresa não muda: o código {relatorio?.codigo || 'RIC'} é dela e do ano. Visita
              lançada no cliente errado se cancela e se refaz.
            </p>

            <label>
              Motivo da correção
              <textarea
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: o encerramento ficou com a hora em que o celular pegou sinal, não a da saída."
              />
            </label>

            <div className="corrigir-grade">
              <label>
                Local
                <select
                  value={form.local_id}
                  onChange={(e) => setForm({ ...form, local_id: e.target.value })}
                >
                  <option value="">
                    {visita.local_nome ? `Manter "${visita.local_nome}"` : 'Sem local'}
                  </option>
                  {locais.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Inspeção realizada por
                <input
                  value={form.responsavel_nome}
                  onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })}
                />
              </label>

              <label>
                Início
                <input
                  type="datetime-local"
                  value={form.iniciada_em}
                  onChange={(e) => setForm({ ...form, iniciada_em: e.target.value })}
                />
              </label>

              <label>
                Encerramento
                <input
                  type="datetime-local"
                  value={form.encerrada_em}
                  onChange={(e) => setForm({ ...form, encerrada_em: e.target.value })}
                />
              </label>

              <label>
                Latitude
                <input
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="-9.243703"
                />
              </label>

              <label>
                Longitude
                <input
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="-64.648577"
                />
              </label>

              <label>
                Precisão (m)
                <input
                  value={form.precisao_m}
                  onChange={(e) => setForm({ ...form, precisao_m: e.target.value })}
                  placeholder="5"
                />
              </label>
            </div>

            <label>
              Observações da visita
              <textarea
                rows={3}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </label>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={salvando}
                onClick={salvarCabecalho}
              >
                {salvando ? 'Salvando…' : 'Salvar e subir a revisão'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={salvando}
                onClick={corrigirApontamentos}
              >
                Corrigir os apontamentos
              </button>
              <Ajuda
                titulo="Corrigir os apontamentos"
                texto="Reabre a visita e leva de volta à tela de campo, onde estão a foto, a classificação e o prazo de cada apontamento. Ao encerrar de novo, o mesmo relatório sobe de revisão — não sai código novo."
              />
            </div>
          </div>
        </div>
      )}

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
                    </span>{' '}
                    {/* O código do apontamento: é por ele que se
                        conversa sobre o caso ("a NC-2026-0004 está
                        atrasada") sem reler a descrição inteira. */}
                    {a.codigo && (
                      <Link href={'/inspecoes/nc/' + a.id} className="ric-codigo-nc">
                        {a.codigo}
                      </Link>
                    )}
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

                {/*
                  * O PLANO DE AÇÃO VINCULADO.
                  *
                  * Aparece só quando existe. Inventar uma seção vazia
                  * "Plano de ação: —" em cada apontamento faria o
                  * relatório parecer completo quando não está, e o
                  * cliente assinaria a ciência sem reparar no que
                  * ninguém definiu.
                  */}
                {(acoes[a.id] || []).length > 0 && (
                  <div className="ric-plano">
                    <p className="ric-plano-rot">
                      Plano de ação · {(acoes[a.id] || []).length}{' '}
                      {(acoes[a.id] || []).length === 1 ? 'ação' : 'ações'}
                    </p>
                    <table className="tabela-colab rel-itens">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>O que</th>
                          <th>Tipo</th>
                          <th>Responsável</th>
                          <th>Prazo</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(acoes[a.id] || []).map((ac) => {
                          const s = SITUACAO_ACAO[ac.situacao] || {
                            rotulo: ac.situacao,
                            cor: 'flat',
                          }
                          return (
                            <tr key={ac.id}>
                              <td className="mono">{ac.ordem}</td>
                              <td>{ac.descricao}</td>
                              <td>{TIPO_ACAO[ac.tipo] || ac.tipo}</td>
                              <td>{ac.responsavel_nome || '—'}</td>
                              <td>{soData(ac.prazo) || '—'}</td>
                              <td>
                                <span className={'pill ' + s.cor}>{s.rotulo}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

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

        {/*
          * O histórico sai impresso, junto com o documento.
          *
          * Revisão 03 sem dizer o que mudou obriga o cliente a comparar
          * três folhas lado a lado para descobrir. É isso que a ISO
          * 7.5.2 quer dizer com controle: não é esconder a mudança, é
          * conseguir mostrá-la.
          */}
        {alteracoes.length > 0 && (
          <div className="rel-historico">
            <h3>Histórico de correções</h3>
            <table className="tabela-colab rel-itens">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>O que</th>
                  <th>Motivo</th>
                  <th>Por</th>
                  <th>Revisão</th>
                </tr>
              </thead>
              <tbody>
                {alteracoes.map((a) => (
                  <tr key={a.id}>
                    <td>{dataHora(a.created_at)}</td>
                    <td>
                      {ACAO[a.acao] || a.acao}
                      {a.campos ? ` · ${nomesDosCampos(a.campos)}` : ''}
                    </td>
                    <td>{a.motivo}</td>
                    <td>{a.por_nome || '—'}</td>
                    <td className="mono">
                      {a.revisao ? String(a.revisao).padStart(2, '0') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
