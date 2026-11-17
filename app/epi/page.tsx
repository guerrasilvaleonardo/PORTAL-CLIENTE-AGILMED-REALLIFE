'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'
import { formatarCpf } from '@/lib/historicoCertificados'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import EpiAbas from '@/components/EpiAbas'
import Icone from '@/components/Icone'
import '../colaboradores/colaboradores.css'
import './entregas.css'

/*
 * Entrega de EPI (supabase/epi-entregas.sql).
 *
 * A tela que o almoxarife usa de pé, com o trabalhador na frente: escolhe
 * a pessoa, marca os equipamentos, tira a foto e salva. A foto é
 * obrigatória — sem ela o botão não acende.
 *
 * Salvou, aparece o QR: o trabalhador aponta o celular dele, confere o
 * CPF e assina em /assinar-epi/<token>. Quem não assina na hora fica na
 * lista de pendentes e pode receber o mesmo link por e-mail.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']
/* Foto de celular tem 3 a 5 MB; 900 px de lado já identifica pessoa e
 * equipamento e cai para uns 100 KB. Sem isso, o volume anual de fotos
 * fica quarenta vezes maior do que precisa. */
const FOTO_LADO = 900
const FOTO_QUALIDADE = 0.7

const MOTIVOS = [
  { valor: 'entrega', rotulo: 'Primeira entrega' },
  { valor: 'substituicao', rotulo: 'Substituição' },
  { valor: 'desgaste', rotulo: 'Desgaste' },
  { valor: 'dano', rotulo: 'Dano' },
  { valor: 'perda', rotulo: 'Perda' },
]

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Colaborador = { id: string; empresa_id: string; nome: string; cpf: string | null; funcao: string | null; matricula: string | null }
type Epi = { id: string; empresa_id: string; nome: string; ca: string | null; complemento: string | null; vida_util_dias: number; tipo: string; ativo: boolean; validade_ca: string | null }

type ItemEntrega = { nome: string; ca: string | null; complemento: string | null; quantidade: number; troca_em: string; motivo: string }
type Entrega = {
  id: string
  empresa_id: string
  entregue_em: string
  assinado_em: string | null
  cancelada_em: string | null
  token: string
  entregue_por_nome: string | null
  colaboradores: { nome: string; funcao: string | null } | null
  epi_entregas_itens: ItemEntrega[]
}

const nomeEmpresa = (e: Empresa) => e.nome_fantasia || e.razao_social
const dataHoraBr = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '')

const hojeBrasilia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

function emDias(dias: number): string {
  const d = new Date(hojeBrasilia() + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

const venceu = (iso: string) => iso < hojeBrasilia()

/* Reduz a foto no próprio aparelho antes de subir. */
async function comprimirFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, FOTO_LADO / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  tela.getContext('2d')!.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  return new Promise((resolve, reject) => {
    tela.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Não foi possível preparar a foto.'))),
      'image/jpeg',
      FOTO_QUALIDADE
    )
  })
}

export default function EntregasEpi() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semTabela, setSemTabela] = useState(false)
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [meuNome, setMeuNome] = useState('')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [epis, setEpis] = useState<Epi[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])

  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)

  /* Nova entrega */
  const [aberta, setAberta] = useState(false)
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [quem, setQuem] = useState('')
  const [escolhidos, setEscolhidos] = useState<Record<string, { qtd: number; motivo: string }>>({})
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [preparandoFoto, setPreparandoFoto] = useState(false)
  const campoFoto = useRef<HTMLInputElement | null>(null)

  /* QR da entrega recém-salva */
  const [qr, setQr] = useState<{ url: string; imagem: string; nome: string } | null>(null)

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

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
        .select('perfil, empresa_id, nome')
        .eq('id', user.id)
        .single()
      if (perfilError) throw perfilError

      const ehInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(ehInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')
      setMeuNome(perfil?.nome || '')

      if (ehInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }

      const [{ data: cols }, { data: eqs }, { data: ents, error: erroEnt }] = await Promise.all([
        supabase.from('colaboradores').select('id, empresa_id, nome, cpf, funcao, matricula').order('nome'),
        supabase.from('epis').select('id, empresa_id, nome, ca, complemento, vida_util_dias, tipo, ativo, validade_ca').order('nome'),
        supabase
          .from('epi_entregas')
          .select(
            'id, empresa_id, entregue_em, assinado_em, cancelada_em, token, entregue_por_nome, ' +
              'colaboradores(nome, funcao), ' +
              'epi_entregas_itens(nome, ca, complemento, quantidade, troca_em, motivo)'
          )
          .order('entregue_em', { ascending: false })
          .limit(300),
      ])

      if (erroEnt) {
        if (erroEnt.code === '42P01' || /does not exist|schema cache/i.test(erroEnt.message || '')) {
          setSemTabela(true)
          return
        }
        throw erroEnt
      }

      setColaboradores((cols || []) as Colaborador[])
      setEpis((eqs || []) as Epi[])
      setEntregas(
        ((ents || []) as any[]).map((e) => ({
          ...e,
          colaboradores: Array.isArray(e.colaboradores) ? e.colaboradores[0] : e.colaboradores,
        })) as Entrega[]
      )
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar as entregas.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    return () => {
      if (foto) URL.revokeObjectURL(foto.url)
    }
  }, [foto])

  const pessoasDaEmpresa = useMemo(
    () => colaboradores.filter((c) => !empresaAtual || c.empresa_id === empresaAtual),
    [colaboradores, empresaAtual]
  )
  const episDaEmpresa = useMemo(
    () => epis.filter((e) => e.ativo && (!empresaAtual || e.empresa_id === empresaAtual)),
    [epis, empresaAtual]
  )

  const listadas = useMemo(() => {
    const palavras = palavrasDaBusca(busca)
    return entregas.filter((e) => {
      if (empresaFiltro && e.empresa_id !== empresaFiltro) return false
      if (soPendentes && (e.assinado_em || e.cancelada_em)) return false
      if (!palavras.length) return true
      const alvo = [e.colaboradores?.nome, ...e.epi_entregas_itens.map((i) => `${i.nome} ${i.ca || ''}`)].join(' ')
      return casaBusca(alvo, palavras)
    })
  }, [entregas, empresaFiltro, soPendentes, busca])

  const numeros = useMemo(() => {
    const base = empresaFiltro ? entregas.filter((e) => e.empresa_id === empresaFiltro) : entregas
    const vivas = base.filter((e) => !e.cancelada_em)
    const mes = new Date()
    mes.setDate(mes.getDate() - 30)
    return {
      mes: vivas.filter((e) => new Date(e.entregue_em) >= mes).length,
      pendentes: vivas.filter((e) => !e.assinado_em).length,
      trocaVencida: vivas.filter((e) => e.epi_entregas_itens.some((i) => venceu(i.troca_em))).length,
    }
  }, [entregas, empresaFiltro])

  function abrirNova() {
    setQuem('')
    setEscolhidos({})
    if (foto) URL.revokeObjectURL(foto.url)
    setFoto(null)
    setAviso('')
    setAberta(true)
  }

  function alternarEpi(id: string) {
    setEscolhidos((atual) => {
      const copia = { ...atual }
      if (copia[id]) delete copia[id]
      else copia[id] = { qtd: 1, motivo: 'entrega' }
      return copia
    })
  }

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    try {
      setPreparandoFoto(true)
      setAviso('')
      const blob = await comprimirFoto(arquivo)
      if (foto) URL.revokeObjectURL(foto.url)
      setFoto({ blob, url: URL.createObjectURL(blob) })
    } catch (err: any) {
      console.error(err)
      setAviso('Não foi possível usar essa foto. Tente tirar de novo.')
    } finally {
      setPreparandoFoto(false)
      if (campoFoto.current) campoFoto.current.value = ''
    }
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    setAviso('')

    const empresaId = empresaAtual
    if (!empresaId) {
      setAviso('Escolha a empresa.')
      return
    }
    if (!quem) {
      setAviso('Escolha quem está recebendo.')
      return
    }
    const itens = Object.entries(escolhidos)
    if (!itens.length) {
      setAviso('Marque pelo menos um equipamento.')
      return
    }
    if (!foto) {
      setAviso('A foto da entrega é obrigatória.')
      return
    }

    const comCaVencido = itens
      .map(([id]) => epis.find((e) => e.id === id))
      .filter((e) => e && e.validade_ca && venceu(e.validade_ca))
    if (comCaVencido.length) {
      setAviso(`${comCaVencido[0]!.nome} está com o CA vencido e não pode ser entregue.`)
      return
    }

    try {
      setSalvando(true)

      /* 1. Foto para o balde privado, sempre sob a pasta da empresa. */
      const caminho = `${empresaId}/${crypto.randomUUID()}.jpg`
      const { error: erroFoto } = await supabase.storage
        .from('epi-fotos')
        .upload(caminho, foto.blob, { contentType: 'image/jpeg', upsert: false })
      if (erroFoto) throw erroFoto

      /* 2. A entrega. */
      const { data: entrega, error: erroEntrega } = await supabase
        .from('epi_entregas')
        .insert({
          empresa_id: empresaId,
          colaborador_id: quem,
          foto_path: caminho,
          entregue_por_nome: meuNome || null,
        })
        .select('id, token')
        .single()
      if (erroEntrega) throw erroEntrega

      /* 3. Os itens, com CA e prazo congelados. */
      const linhas = itens.map(([id, info]) => {
        const epi = epis.find((e) => e.id === id)!
        return {
          entrega_id: entrega.id,
          epi_id: epi.id,
          nome: epi.nome,
          ca: epi.ca,
          complemento: epi.complemento,
          vida_util_dias: epi.vida_util_dias,
          quantidade: info.qtd,
          motivo: info.motivo,
          troca_em: emDias(epi.vida_util_dias),
        }
      })
      const { error: erroItens } = await supabase.from('epi_entregas_itens').insert(linhas)
      if (erroItens) throw erroItens

      /* 4. O QR para o trabalhador assinar na hora. */
      const url = `${window.location.origin}/assinar-epi/${entrega.token}`
      const imagem = await QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      const pessoa = colaboradores.find((c) => c.id === quem)
      setQr({ url, imagem, nome: pessoa?.nome || '' })

      setAberta(false)
      await carregar()
    } catch (e: any) {
      console.error(e)
      setAviso(e?.message || 'Não foi possível registrar a entrega.')
    } finally {
      setSalvando(false)
    }
  }

  /*
   * Cancelar é a única saída para uma entrega errada: ela não se apaga
   * nem se edita. O motivo fica registrado junto com quem cancelou.
   */
  async function cancelar(e: Entrega) {
    const motivo = window.prompt(
      `Cancelar a entrega de ${e.colaboradores?.nome || 'este trabalhador'}?\n\nPor quê? (fica registrado na ficha)`
    )
    if (motivo === null) return
    if (!motivo.trim()) {
      setErro('Diga o motivo do cancelamento.')
      return
    }

    try {
      const { error } = await supabase
        .from('epi_entregas')
        .update({ cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo.trim() })
        .eq('id', e.id)
      if (error) throw error
      await carregar()
    } catch (err: any) {
      console.error(err)
      setErro(err?.message || 'Não foi possível cancelar a entrega.')
    }
  }

  async function copiarLink() {
    if (!qr) return
    try {
      await navigator.clipboard.writeText(qr.url)
      setAviso('')
    } catch {
      /* Sem permissão de área de transferência: o link fica visível para copiar à mão. */
    }
  }

  if (semTabela) {
    return (
      <div className="app">
        <EpiAbas />
        <div className="banner bad">
          As entregas ainda não foram criadas no banco. Rode <code>supabase/epi-entregas.sql</code>{' '}
          no SQL Editor do Supabase.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <EpiAbas />

      <div>
        <p className="eyebrow">EPI</p>
        <h1 className="titulo-tela">Entregas</h1>
        <p className="subtitulo-tela">
          Cada entrega sai com foto e com a assinatura do trabalhador, feita no celular dele. É o que
          monta a ficha da NR-06.
        </p>
      </div>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="stats">
        <div className="stat">
          <div className="num">{numeros.mes}</div>
          <div className="lbl">Nos últimos 30 dias</div>
        </div>
        <div className="stat warn">
          <div className="num">{numeros.pendentes}</div>
          <div className="lbl">Aguardando assinatura</div>
        </div>
        <div className="stat bad">
          <div className="num">{numeros.trocaVencida}</div>
          <div className="lbl">Com troca vencida</div>
        </div>
      </div>

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: nomeEmpresa(e) }))}
          />
        )}
        <input
          type="search"
          id="busca-entrega"
          placeholder="Trabalhador, equipamento ou CA"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="caixa-marcar">
          <input
            type="checkbox"
            id="so-pendentes"
            checked={soPendentes}
            onChange={(e) => setSoPendentes(e.target.checked)}
          />
          Só sem assinatura
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={abrirNova}>
          <Icone nome="mais" /> Nova entrega
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="section-title">
            {carregando ? 'Carregando…' : `${listadas.length} entrega${listadas.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="lista-entregas">
          {!carregando && listadas.length === 0 && (
            <p className="empty-state">Nenhuma entrega registrada ainda.</p>
          )}
          {listadas.map((e) => (
            <article key={e.id} className={`entrega ${e.cancelada_em ? 'cancelada' : ''}`}>
              <div className="entrega-topo">
                <strong>{e.colaboradores?.nome || '—'}</strong>
                {e.cancelada_em ? (
                  <span className="pill flat">Cancelada</span>
                ) : e.assinado_em ? (
                  <span className="pill good">Assinada</span>
                ) : (
                  <span className="pill warn">Aguardando assinatura</span>
                )}
              </div>
              <p className="entrega-quando">
                {dataHoraBr(e.entregue_em)}
                {e.entregue_por_nome ? ` · por ${e.entregue_por_nome}` : ''}
                {!e.cancelada_em && (
                  <button type="button" className="entrega-cancelar" onClick={() => cancelar(e)}>
                    Cancelar
                  </button>
                )}
              </p>
              <ul className="entrega-itens">
                {e.epi_entregas_itens.map((i, n) => (
                  <li key={n}>
                    {i.quantidade > 1 ? `${i.quantidade}× ` : ''}
                    {i.nome}
                    {i.complemento ? ` · ${i.complemento}` : ''}
                    {i.ca ? ` · CA ${i.ca}` : ''}
                    <span className={venceu(i.troca_em) ? 'troca vencida' : 'troca'}>
                      trocar até {dataBr(i.troca_em)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      {/* ---------- nova entrega ---------- */}
      {aberta && (
        <div className="cortina" role="dialog" aria-modal="true" aria-label="Nova entrega">
          <form className="painel-lateral" onSubmit={salvar}>
            <div className="painel-head">
              <h2>Nova entrega</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAberta(false)}
                disabled={salvando}
              >
                Fechar
              </button>
            </div>

            <div className="painel-corpo">
              {aviso && <div className="banner bad">{aviso}</div>}

              {interno && !empresaFiltro && (
                <div className="banner">Escolha a empresa no filtro antes de registrar a entrega.</div>
              )}

              <div className="field">
                <label htmlFor="entrega-quem">Quem está recebendo</label>
                <select id="entrega-quem" value={quem} onChange={(e) => setQuem(e.target.value)}>
                  <option value="">Escolha o trabalhador</option>
                  {pessoasDaEmpresa.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.matricula ? ` · ${c.matricula}` : ''}
                      {c.funcao ? ` · ${c.funcao}` : ''}
                    </option>
                  ))}
                </select>
                {quem && !colaboradores.find((c) => c.id === quem)?.cpf && (
                  <p className="dica">
                    Esta pessoa está sem CPF no cadastro. Sem CPF ela não consegue assinar — complete
                    em Colaboradores antes de entregar.
                  </p>
                )}
              </div>

              <div className="field">
                <label>Equipamentos</label>
                {episDaEmpresa.length === 0 ? (
                  <p className="dica">
                    Nenhum equipamento cadastrado para esta empresa. Cadastre em “Equipamentos”.
                  </p>
                ) : (
                  <ul className="escolher-epi">
                    {episDaEmpresa.map((e) => {
                      const marcado = !!escolhidos[e.id]
                      const caVencido = !!e.validade_ca && venceu(e.validade_ca)
                      return (
                        <li key={e.id} className={marcado ? 'marcado' : ''}>
                          <label>
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternarEpi(e.id)}
                              disabled={caVencido}
                            />
                            <span>
                              <strong>
                                {e.nome}
                                {e.complemento ? ` · ${e.complemento}` : ''}
                              </strong>
                              <small>
                                {e.ca ? `CA ${e.ca} · ` : ''}
                                troca a cada {e.vida_util_dias} dias
                                {caVencido ? ' · CA vencido' : ''}
                              </small>
                            </span>
                          </label>
                          {marcado && (
                            <div className="item-detalhe">
                              <input
                                type="number"
                                min={1}
                                max={999}
                                aria-label="Quantidade"
                                value={escolhidos[e.id].qtd}
                                onChange={(ev) =>
                                  setEscolhidos({
                                    ...escolhidos,
                                    [e.id]: { ...escolhidos[e.id], qtd: Number(ev.target.value) || 1 },
                                  })
                                }
                              />
                              <select
                                aria-label="Motivo"
                                value={escolhidos[e.id].motivo}
                                onChange={(ev) =>
                                  setEscolhidos({
                                    ...escolhidos,
                                    [e.id]: { ...escolhidos[e.id], motivo: ev.target.value },
                                  })
                                }
                              >
                                {MOTIVOS.map((m) => (
                                  <option key={m.valor} value={m.valor}>
                                    {m.rotulo}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="field">
                <label htmlFor="entrega-foto">
                  Foto da entrega <span className="obrigatorio">obrigatória</span>
                </label>
                <input
                  ref={campoFoto}
                  id="entrega-foto"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={aoEscolherFoto}
                  hidden
                />
                {foto ? (
                  <div className="foto-feita">
                    <img src={foto.url} alt="Foto da entrega" />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => campoFoto.current?.click()}
                    >
                      Tirar outra
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="foto-vazia"
                    onClick={() => campoFoto.current?.click()}
                    disabled={preparandoFoto}
                  >
                    <span aria-hidden="true">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </span>
                    {preparandoFoto ? 'Preparando a foto…' : 'Tirar a foto'}
                    <small>Sem a foto a entrega não é salva</small>
                  </button>
                )}
              </div>
            </div>

            <div className="painel-rodape">
              <button type="button" className="btn" onClick={() => setAberta(false)} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={salvando || !foto}>
                {salvando ? 'Registrando…' : 'Registrar entrega'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- QR da assinatura ---------- */}
      {qr && (
        <div className="cortina" role="dialog" aria-modal="true" aria-label="Assinatura">
          <div className="painel-qr">
            <h2>Entrega registrada</h2>
            <p>
              Peça para {qr.nome.split(' ')[0]} apontar a câmera do celular e assinar agora.
            </p>
            <img src={qr.imagem} alt="Código QR para assinar o recebimento" width={240} height={240} />
            <p className="qr-link">{qr.url}</p>
            <div className="qr-acoes">
              <button type="button" className="btn btn-sm" onClick={copiarLink}>
                Copiar o link
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setQr(null)}>
                Pronto
              </button>
            </div>
            <p className="dica">
              Se ele não assinar agora, a entrega fica em “Aguardando assinatura” e o link continua
              valendo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
