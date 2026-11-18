'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
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

/* Por que o EPI voltou. É o que a ficha precisa dizer para explicar
 * por que aquele equipamento não está mais com o trabalhador. */
const MOTIVOS_DEVOLUCAO = [
  { valor: 'devolucao', rotulo: 'Devolveu' },
  { valor: 'troca', rotulo: 'Troca por outro' },
  { valor: 'fim_vida_util', rotulo: 'Fim da vida útil' },
  { valor: 'dano', rotulo: 'Danificado' },
  { valor: 'perda', rotulo: 'Perdido' },
  { valor: 'desligamento', rotulo: 'Desligamento' },
]
const MOTIVO_ROTULO: Record<string, string> = Object.fromEntries(
  MOTIVOS.map((m) => [m.valor, m.rotulo])
)

const rotuloDevolucao = (v: string | null) =>
  MOTIVOS_DEVOLUCAO.find((m) => m.valor === v)?.rotulo || v || ''

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Colaborador = {
  id: string
  empresa_id: string
  nome: string
  cpf: string | null
  funcao: string | null
  matricula: string | null
  local_id: string | null
  local_trabalho: string | null
  entrega_epi: boolean
}
type Epi = {
  id: string
  empresa_id: string
  nome: string
  ca: string | null
  complemento: string | null
  vida_util_dias: number
  tipo: string
  ativo: boolean
  validade_ca: string | null
  observacoes: string | null
}

type ItemEntrega = {
  id: string
  epi_id: string | null
  nome: string
  ca: string | null
  complemento: string | null
  quantidade: number
  troca_em: string
  motivo: string
  previsao_devolucao: string | null
  devolvido_em: string | null
  devolucao_motivo: string | null
  devolucao_obs: string | null
  devolvido_por_nome: string | null
  observacao: string | null
}
type Entrega = {
  id: string
  empresa_id: string
  entregue_em: string
  assinado_em: string | null
  cancelada_em: string | null
  token: string
  entregue_por_nome: string | null
  observacoes: string | null
  colaborador_id: string
  colaboradores: { nome: string; funcao: string | null; matricula: string | null } | null
  epi_entregas_itens: ItemEntrega[]
}

/* Campos de um item enquanto a entrega está sendo editada. */
type ItemEmEdicao = {
  troca_em: string
  previsao_devolucao: string
  observacao: string
  devolvido: boolean
  devolvido_em: string
  devolucao_motivo: string
  devolucao_obs: string
}
type Edicao = {
  entrega: Entrega
  data: string
  observacoes: string
  itens: Record<string, ItemEmEdicao>
}

const nomeEmpresa = (e: Empresa) => e.nome_fantasia || e.razao_social
const dataHoraBr = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '')

const hojeBrasilia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

/* O <input type="datetime-local"> quer "2026-11-17T18:24" no horário de
 * quem está olhando — não o ISO em UTC, que apareceria com horas a menos. */
function paraCampoDataHora(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

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
  const [locais, setLocais] = useState<{ id: string; nome: string }[]>([])

  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)

  /* A tabela no formato do OnSafety: filtro em cada coluna, painel de
   * filtros por data, seleção em massa e paginação. */
  const [colunas, setColunas] = useState({ trabalhador: '', matricula: '', ca: '', equipamento: '' })
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [filtros, setFiltros] = useState({
    entregaDe: '',
    entregaAte: '',
    trocaDe: '',
    trocaAte: '',
    comBaixa: false,
    soVencidos: false,
    comCanceladas: false,
  })
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [menuAberto, setMenuAberto] = useState<{ id: string; x: number; y: number } | null>(null)
  /* Oito ações de 33px mais a borda: o bastante para saber se cabe
   * abaixo do botão ou se precisa subir. */
  const ALTURA_MENU = 310
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(25)

  /* Nova entrega */
  const [aberta, setAberta] = useState(false)
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [quem, setQuem] = useState('')
  const [entregador, setEntregador] = useState('')
  const [escolhidos, setEscolhidos] = useState<Record<string, { qtd: number; motivo: string }>>({})
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [preparandoFoto, setPreparandoFoto] = useState(false)
  const campoFoto = useRef<HTMLInputElement | null>(null)

  /* QR da entrega recém-salva */
  const [qr, setQr] = useState<{ url: string; imagem: string; nome: string } | null>(null)

  const [editando, setEditando] = useState<Edicao | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

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
        supabase
          .from('colaboradores')
          .select('id, empresa_id, nome, cpf, funcao, matricula, local_id, local_trabalho, entrega_epi')
          .order('nome'),
        supabase
          .from('epis')
          .select('id, empresa_id, nome, ca, complemento, vida_util_dias, tipo, ativo, validade_ca, observacoes')
          .order('nome'),
        supabase
          .from('epi_entregas')
          .select(
            'id, empresa_id, colaborador_id, entregue_em, assinado_em, cancelada_em, token, entregue_por_nome, observacoes, ' +
              'colaboradores!colaborador_id(nome, funcao, matricula), ' +
              'epi_entregas_itens(id, epi_id, nome, ca, complemento, quantidade, troca_em, motivo, ' +
              'previsao_devolucao, devolvido_em, devolucao_motivo, devolucao_obs, devolvido_por_nome, observacao)'
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

      /* Só para traduzir local_id em nome na hora de gravar a entrega. */
      const { data: locs } = await supabase
        .from('locais_trabalho')
        .select('id, nome')
        .eq('ativo', true)
      setLocais((locs || []) as { id: string; nome: string }[])
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

  /* Menu aberto fecha ao clicar em qualquer outro lugar da tela. */
  useEffect(() => {
    if (!menuAberto) return
    function aoClicar(ev: MouseEvent) {
      const alvo = ev.target as HTMLElement
      if (!alvo.closest('.menu-linha')) setMenuAberto(null)
    }
    document.addEventListener('click', aoClicar)
    return () => document.removeEventListener('click', aoClicar)
  }, [menuAberto])

  useEffect(() => {
    return () => {
      if (foto) URL.revokeObjectURL(foto.url)
    }
  }, [foto])

  const pessoasDaEmpresa = useMemo(
    () => colaboradores.filter((c) => !empresaAtual || c.empresa_id === empresaAtual),
    [colaboradores, empresaAtual]
  )
  const encarregados = useMemo(
    () => pessoasDaEmpresa.filter((c) => c.entrega_epi),
    [pessoasDaEmpresa]
  )
  const episDaEmpresa = useMemo(
    () => epis.filter((e) => e.ativo && (!empresaAtual || e.empresa_id === empresaAtual)),
    [epis, empresaAtual]
  )

  /* Uma linha por equipamento, não por entrega: é assim que a tela do
   * OnSafety mostra, e é assim que se marca um item para dar baixa. */
  const linhas = useMemo(() => {
    const texto = (v: string, alvo: string | null | undefined) =>
      !v.trim() || casaBusca(alvo || '', palavrasDaBusca(v))

    const saida: { e: Entrega; i: ItemEntrega }[] = []
    for (const e of entregas) {
      if (empresaFiltro && e.empresa_id !== empresaFiltro) continue
      if (e.cancelada_em && !filtros.comCanceladas) continue
      if (soPendentes && (e.assinado_em || e.cancelada_em)) continue
      if (filtros.entregaDe && e.entregue_em.slice(0, 10) < filtros.entregaDe) continue
      if (filtros.entregaAte && e.entregue_em.slice(0, 10) > filtros.entregaAte) continue
      if (!texto(colunas.trabalhador, e.colaboradores?.nome)) continue
      if (!texto(colunas.matricula, e.colaboradores?.matricula)) continue

      for (const i of e.epi_entregas_itens) {
        if (i.devolvido_em && !filtros.comBaixa) continue
        if (filtros.soVencidos && (i.devolvido_em || !venceu(i.troca_em))) continue
        if (filtros.trocaDe && i.troca_em < filtros.trocaDe) continue
        if (filtros.trocaAte && i.troca_em > filtros.trocaAte) continue
        if (!texto(colunas.ca, i.ca)) continue
        if (!texto(colunas.equipamento, `${i.nome} ${i.complemento || ''}`)) continue
        saida.push({ e, i })
      }
    }
    return saida
  }, [entregas, empresaFiltro, soPendentes, colunas, filtros])

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina))
  const linhasPagina = useMemo(
    () => linhas.slice((pagina - 1) * porPagina, pagina * porPagina),
    [linhas, pagina, porPagina]
  )

  /* Filtro que mudou de lugar não pode deixar a pessoa numa página que
   * não existe mais. */
  useEffect(() => {
    setPagina((n) => Math.min(n, Math.max(1, Math.ceil(linhas.length / porPagina))))
  }, [linhas.length, porPagina])

  const filtrosLigados = useMemo(
    () =>
      Object.entries(filtros).filter(([, v]) => (typeof v === 'boolean' ? v : Boolean(v))).length +
      Object.values(colunas).filter(Boolean).length +
      (soPendentes ? 1 : 0),
    [filtros, colunas, soPendentes]
  )

  /* Os itens marcados, com a entrega de cada um ao lado. */
  const marcadas = useMemo(() => linhas.filter(({ i }) => marcados.has(i.id)), [linhas, marcados])
  const emUsoMarcados = marcadas.filter(({ e, i }) => !i.devolvido_em && !e.cancelada_em)
  const podeDarBaixa = emUsoMarcados.length > 0
  /* Trocar abre uma entrega nova para a MESMA pessoa: misturar
   * trabalhadores aqui daria uma entrega que não é de ninguém. */
  const podeTrocar =
    emUsoMarcados.length > 0 &&
    new Set(emUsoMarcados.map(({ e }) => e.colaborador_id)).size === 1

  const marcouTudoNaPagina =
    linhasPagina.length > 0 && linhasPagina.every(({ i }) => marcados.has(i.id))

  function alternarMarca(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function marcarPagina(ligar: boolean) {
    setMarcados((atual) => {
      const novo = new Set(atual)
      for (const { i } of linhasPagina) {
        if (ligar) novo.add(i.id)
        else novo.delete(i.id)
      }
      return novo
    })
  }

  function limparFiltros() {
    setColunas({ trabalhador: '', matricula: '', ca: '', equipamento: '' })
    setFiltros({
      entregaDe: '',
      entregaAte: '',
      trocaDe: '',
      trocaAte: '',
      comBaixa: false,
      soVencidos: false,
      comCanceladas: false,
    })
    setSoPendentes(false)
  }

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

  /* Quem entregou de fato: o encarregado escolhido, ou quem está logado
   * quando ninguém foi escolhido. O nome vai congelado para a ficha —
   * a pessoa pode sair da empresa e a ficha continua dizendo quem foi. */
  function nomeDeQuemEntregou(): string | null {
    if (entregador) {
      return colaboradores.find((c) => c.id === entregador)?.nome || meuNome || null
    }
    return meuNome || null
  }

  /* O local vai congelado na entrega, como o CA e o prazo: a pessoa muda
   * de obra, e a ficha precisa dizer onde ela estava naquele dia. */
  function localDoTrabalhador(id: string): string | null {
    const c = colaboradores.find((x) => x.id === id)
    if (!c) return null
    return locais.find((l) => l.id === c.local_id)?.nome || c.local_trabalho || null
  }

  function abrirNova() {
    setQuem('')
    setEntregador('')
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
          entregue_por_nome: nomeDeQuemEntregou(),
          entregue_por_colaborador_id: entregador || null,
          local_nome: localDoTrabalhador(quem),
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
          /* Congelados como o CA: a ficha diz o que valia no dia. */
          validade_ca: epi.validade_ca,
          descricao: epi.observacoes,
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

  /* ---------- editar a entrega e dar baixa ----------
   * O que se altera aqui é prazo, previsão e observação — e a baixa do
   * equipamento que voltou. O que foi entregue (nome, CA, quantidade) e
   * quem recebeu não mudam: se isso está errado, a saída é cancelar.
   * Toda alteração fica gravada em epi_entregas_alteracoes pelo banco. */
  function abrirEdicao(e: Entrega) {
    setErro('')
    setEditando({
      entrega: e,
      data: paraCampoDataHora(e.entregue_em),
      observacoes: e.observacoes || '',
      itens: Object.fromEntries(
        e.epi_entregas_itens.map((i) => [
          i.id,
          {
            troca_em: i.troca_em,
            previsao_devolucao: i.previsao_devolucao || '',
            observacao: i.observacao || '',
            devolvido: Boolean(i.devolvido_em),
            devolvido_em: i.devolvido_em ? i.devolvido_em.slice(0, 10) : hojeBrasilia(),
            devolucao_motivo: i.devolucao_motivo || 'devolucao',
            devolucao_obs: i.devolucao_obs || '',
          },
        ])
      ),
    })
  }

  async function salvarEdicao(ev: FormEvent) {
    ev.preventDefault()
    if (!editando) return
    setSalvandoEdicao(true)
    setErro('')

    try {
      const { entrega, data, observacoes, itens } = editando

      const dataIso = new Date(data).toISOString()
      if (dataIso !== entrega.entregue_em || (observacoes.trim() || null) !== (entrega.observacoes || null)) {
        const { error } = await supabase
          .from('epi_entregas')
          .update({ entregue_em: dataIso, observacoes: observacoes.trim() || null })
          .eq('id', entrega.id)
        if (error) throw error
      }

      for (const item of entrega.epi_entregas_itens) {
        const f = itens[item.id]
        if (!f) continue

        const baixaAntes = Boolean(item.devolvido_em)
        const mudouPrazo =
          f.troca_em !== item.troca_em ||
          (f.previsao_devolucao || null) !== (item.previsao_devolucao || null) ||
          (f.observacao.trim() || null) !== (item.observacao || null)
        const mudouBaixa =
          f.devolvido !== baixaAntes ||
          (f.devolvido &&
            (f.devolucao_motivo !== item.devolucao_motivo ||
              (f.devolucao_obs.trim() || null) !== (item.devolucao_obs || null)))

        if (!mudouPrazo && !mudouBaixa) continue

        /* A baixa guarda o dia que a pessoa informou, às 12h de Brasília:
         * sem hora cravada, o fuso joga a data para o dia anterior. */
        const payload: Record<string, unknown> = {
          troca_em: f.troca_em,
          previsao_devolucao: f.previsao_devolucao || null,
          observacao: f.observacao.trim() || null,
          devolvido_em: f.devolvido ? `${f.devolvido_em}T12:00:00-03:00` : null,
          devolucao_motivo: f.devolvido ? f.devolucao_motivo : null,
          devolucao_obs: f.devolvido ? f.devolucao_obs.trim() || null : null,
        }

        const { error } = await supabase.from('epi_entregas_itens').update(payload).eq('id', item.id)
        if (error) throw error
      }

      setEditando(null)
      await carregar()
    } catch (err: any) {
      console.error(err)
      setErro(err?.message || 'Não foi possível salvar a alteração.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  function mudarItem(id: string, campo: string, valor: string | boolean) {
    setEditando((atual) =>
      atual
        ? { ...atual, itens: { ...atual.itens, [id]: { ...atual.itens[id], [campo]: valor } } }
        : atual
    )
  }

  /* Baixa de um item: grava a devolução do dia, como o "Dar Baixa" dele.
   * O motivo entra como "devolveu"; quem precisa de outro motivo usa o
   * painel de alteração, onde a lista inteira aparece. */
  async function baixarItens(itens: { e: Entrega; i: ItemEntrega }[], motivo = 'devolucao') {
    if (!itens.length) return
    const quando = `${hojeBrasilia()}T12:00:00-03:00`
    setErro('')
    try {
      for (const { i } of itens) {
        const { error } = await supabase
          .from('epi_entregas_itens')
          .update({ devolvido_em: quando, devolucao_motivo: motivo })
          .eq('id', i.id)
        if (error) throw error
      }
      setMarcados(new Set())
      await carregar()
    } catch (err: any) {
      console.error(err)
      setErro(err?.message || 'Não foi possível dar baixa.')
    }
  }

  async function reverterItem(i: ItemEntrega) {
    setErro('')
    try {
      const { error } = await supabase
        .from('epi_entregas_itens')
        .update({ devolvido_em: null, devolucao_motivo: null })
        .eq('id', i.id)
      if (error) throw error
      await carregar()
    } catch (err: any) {
      console.error(err)
      setErro(err?.message || 'Não foi possível reverter a baixa.')
    }
  }

  /* Abre a entrega nova já com parte do caminho andado, como os "Copiar"
   * da tela dele. Nada é gravado aqui: é só o formulário preenchido. */
  function novaEntregaCom(opcoes: { pessoa?: string; epiId?: string; motivo?: string }) {
    abrirNova()
    if (opcoes.pessoa) setQuem(opcoes.pessoa)
    if (opcoes.epiId) {
      setEscolhidos({ [opcoes.epiId]: { qtd: 1, motivo: opcoes.motivo || 'entrega' } })
    }
  }

  async function acaoLinha(acao: string, e: Entrega, i: ItemEntrega) {
    setMenuAberto(null)
    if (acao === 'alterar' || acao === 'prazo') {
      abrirEdicao(e)
      return
    }
    if (acao === 'baixa') {
      const certeza = window.confirm(
        `Dar baixa em "${i.nome}" de ${e.colaboradores?.nome || 'este trabalhador'}?\n\nFica registrado que voltou hoje. Dá para reverter depois.`
      )
      if (certeza) await baixarItens([{ e, i }])
      return
    }
    if (acao === 'reverter') {
      await reverterItem(i)
      return
    }
    if (acao === 'trocar') {
      /* Trocar é dar baixa no que está com a pessoa e entregar outro no
       * lugar: a baixa fica para quando a entrega nova for salva, senão
       * ela some da lista antes de existir substituta. */
      novaEntregaCom({ pessoa: e.colaborador_id, epiId: i.epi_id || undefined, motivo: 'substituicao' })
      return
    }
    if (acao === 'copiar-epi') {
      novaEntregaCom({ epiId: i.epi_id || undefined })
      return
    }
    if (acao === 'copiar-pessoa') {
      novaEntregaCom({ pessoa: e.colaborador_id })
      return
    }
    if (acao === 'cancelar') await cancelar(e)
  }

  async function darBaixaMarcados() {
    const itens = marcadas.filter(({ e, i }) => !i.devolvido_em && !e.cancelada_em)
    if (!itens.length) return
    const certeza = window.confirm(
      `Dar baixa em ${itens.length} equipamento${itens.length > 1 ? 's' : ''}?\n\nFica registrado que voltaram hoje. Dá para reverter depois.`
    )
    if (certeza) await baixarItens(itens)
  }

  function trocarMarcados() {
    const itens = marcadas.filter(({ e, i }) => !i.devolvido_em && !e.cancelada_em)
    if (!itens.length) return
    const pessoa = itens[0].e.colaborador_id
    abrirNova()
    setQuem(pessoa)
    const escolha: Record<string, { qtd: number; motivo: string }> = {}
    for (const { i } of itens) {
      if (i.epi_id) escolha[i.epi_id] = { qtd: i.quantidade, motivo: 'substituicao' }
    }
    setEscolhidos(escolha)
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

      {/* Barra de cima, na ordem do OnSafety: o que cria à esquerda, o
          que age sobre o que está marcado à direita. */}
      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: nomeEmpresa(e) }))}
          />
        )}
        <button type="button" className="btn btn-primary" onClick={abrirNova}>
          <Icone nome="mais" /> Nova entrega
        </button>
        <button
          type="button"
          className={`btn ${filtrosAbertos ? 'btn-ativo' : ''}`}
          onClick={() => setFiltrosAbertos((a) => !a)}
        >
          Filtros{filtrosLigados > 0 ? ` (${filtrosLigados})` : ''}
        </button>
        <span style={{ flex: 1 }} />
        <Link
          href={marcadas.length ? `/epi/ficha?itens=${marcadas.length}` : '/epi/ficha'}
          className="btn"
        >
          Fichas de EPI
        </Link>
        <button
          type="button"
          className="btn"
          disabled={!podeTrocar}
          onClick={trocarMarcados}
          title={podeTrocar ? '' : 'Marque equipamentos em uso, de um trabalhador só'}
        >
          Trocar
        </button>
        <button
          type="button"
          className="btn"
          disabled={!podeDarBaixa}
          onClick={darBaixaMarcados}
          title={podeDarBaixa ? '' : 'Marque equipamentos que ainda estão em uso'}
        >
          Dar baixa
        </button>
      </div>

      {filtrosAbertos && (
        <div className="painel-filtros">
          <div className="item-linha">
            <div className="field">
              <label htmlFor="f-entrega-de">Entrega — de</label>
              <input
                id="f-entrega-de"
                type="date"
                value={filtros.entregaDe}
                onChange={(e) => setFiltros({ ...filtros, entregaDe: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="f-entrega-ate">Entrega — até</label>
              <input
                id="f-entrega-ate"
                type="date"
                value={filtros.entregaAte}
                onChange={(e) => setFiltros({ ...filtros, entregaAte: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="f-troca-de">Trocar até — de</label>
              <input
                id="f-troca-de"
                type="date"
                value={filtros.trocaDe}
                onChange={(e) => setFiltros({ ...filtros, trocaDe: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="f-troca-ate">Trocar até — até</label>
              <input
                id="f-troca-ate"
                type="date"
                value={filtros.trocaAte}
                onChange={(e) => setFiltros({ ...filtros, trocaAte: e.target.value })}
              />
            </div>
          </div>
          <div className="linha-marcas">
            <label className="caixa-marcar">
              <input
                type="checkbox"
                checked={filtros.comBaixa}
                onChange={(e) => setFiltros({ ...filtros, comBaixa: e.target.checked })}
              />
              Mostrar devolvidos
            </label>
            <label className="caixa-marcar">
              <input
                type="checkbox"
                checked={soPendentes}
                onChange={(e) => setSoPendentes(e.target.checked)}
              />
              Só sem assinatura
            </label>
            <label className="caixa-marcar">
              <input
                type="checkbox"
                checked={filtros.soVencidos}
                onChange={(e) => setFiltros({ ...filtros, soVencidos: e.target.checked })}
              />
              Só com troca vencida
            </label>
            <label className="caixa-marcar">
              <input
                type="checkbox"
                checked={filtros.comCanceladas}
                onChange={(e) => setFiltros({ ...filtros, comCanceladas: e.target.checked })}
              />
              Mostrar canceladas
            </label>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm" onClick={limparFiltros}>
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <span className="section-title">
            {carregando
              ? 'Carregando…'
              : `${linhas.length} equipamento${linhas.length === 1 ? '' : 's'} entregue${
                  linhas.length === 1 ? '' : 's'
                }`}
          </span>
          <span className="paginacao">
            <label htmlFor="por-pagina">Por página</label>
            <select
              id="por-pagina"
              value={porPagina}
              onChange={(e) => {
                setPorPagina(Number(e.target.value))
                setPagina(1)
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((n) => n - 1)}
            >
              Anterior
            </button>
            <span className="mono">
              {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((n) => n + 1)}
            >
              Próxima
            </button>
          </span>
        </div>

        <div className="table-scroll">
          <table className="tabela-colab tabela-entregas">
            <thead>
              <tr>
                <th className="col-marca">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos desta página"
                    checked={marcouTudoNaPagina}
                    onChange={(e) => marcarPagina(e.target.checked)}
                  />
                </th>
                <th>Trabalhador</th>
                <th>Matrícula</th>
                <th>Qtde.</th>
                <th>CA</th>
                <th>Equipamento</th>
                <th>Entrega</th>
                <th>Previsão de troca</th>
                <th aria-label="Opções" />
              </tr>
              {/* Filtro em cada coluna, como na tela dele: dá para achar um
                  CA ou um nome sem sair da tabela. */}
              <tr className="linha-filtros">
                <th />
                <th>
                  <input
                    value={colunas.trabalhador}
                    onChange={(e) => setColunas({ ...colunas, trabalhador: e.target.value })}
                    aria-label="Filtrar por trabalhador"
                  />
                </th>
                <th>
                  <input
                    value={colunas.matricula}
                    onChange={(e) => setColunas({ ...colunas, matricula: e.target.value })}
                    aria-label="Filtrar por matrícula"
                  />
                </th>
                <th />
                <th>
                  <input
                    value={colunas.ca}
                    onChange={(e) => setColunas({ ...colunas, ca: e.target.value })}
                    aria-label="Filtrar por CA"
                  />
                </th>
                <th>
                  <input
                    value={colunas.equipamento}
                    onChange={(e) => setColunas({ ...colunas, equipamento: e.target.value })}
                    aria-label="Filtrar por equipamento"
                  />
                </th>
                <th />
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {!carregando && linhas.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">
                    Nenhum equipamento entregue com esses filtros.
                  </td>
                </tr>
              )}
              {linhasPagina.map(({ e, i }) => (
                <tr
                  key={i.id}
                  className={e.cancelada_em ? 'inativo' : i.devolvido_em ? 'item-devolvido' : ''}
                >
                  <td className="col-marca">
                    <input
                      type="checkbox"
                      aria-label="Marcar este equipamento"
                      checked={marcados.has(i.id)}
                      onChange={() => alternarMarca(i.id)}
                    />
                  </td>
                  <td className="nome">
                    {e.colaboradores?.nome || '—'}
                    {e.cancelada_em ? (
                      <span className="pill flat"> Cancelada</span>
                    ) : e.assinado_em ? null : (
                      <span className="pill warn"> Sem assinatura</span>
                    )}
                  </td>
                  <td className="mono">{e.colaboradores?.matricula || '—'}</td>
                  <td className="mono">{i.quantidade}</td>
                  <td className="mono">{i.ca || '—'}</td>
                  <td>
                    {i.nome}
                    {i.complemento && <span className="complemento"> · {i.complemento}</span>}
                    <span className="motivo-item"> · {MOTIVO_ROTULO[i.motivo] || i.motivo}</span>
                  </td>
                  <td className="mono">{dataHoraBr(e.entregue_em)}</td>
                  <td className="mono">
                    {i.devolvido_em ? (
                      <span className="baixa">
                        devolvido {dataBr(i.devolvido_em.slice(0, 10))}
                      </span>
                    ) : (
                      <span className={venceu(i.troca_em) ? 'troca vencida' : 'troca'}>
                        {dataBr(i.troca_em)}
                      </span>
                    )}
                  </td>
                  <td className="acoes">
                    <div className="menu-linha">
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-haspopup="menu"
                        aria-expanded={menuAberto?.id === i.id}
                        onClick={(ev) => {
                          if (menuAberto?.id === i.id) {
                            setMenuAberto(null)
                            return
                          }
                          const r = ev.currentTarget.getBoundingClientRect()
                          const cabeAbaixo = r.bottom + ALTURA_MENU < window.innerHeight
                          setMenuAberto({
                            id: i.id,
                            x: r.right,
                            y: cabeAbaixo ? r.bottom + 4 : r.top - ALTURA_MENU - 4,
                          })
                        }}
                      >
                        Opções ▾
                      </button>
                      {menuAberto?.id === i.id && (
                        <div
                          className="menu-lista"
                          role="menu"
                          style={{ top: menuAberto.y, left: menuAberto.x }}
                        >
                          <button type="button" onClick={() => acaoLinha('alterar', e, i)}>
                            Alterar
                          </button>
                          <button type="button" onClick={() => acaoLinha('prazo', e, i)}>
                            Alterar previsão de troca
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(i.devolvido_em || e.cancelada_em)}
                            onClick={() => acaoLinha('trocar', e, i)}
                          >
                            Trocar
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(i.devolvido_em || e.cancelada_em)}
                            onClick={() => acaoLinha('baixa', e, i)}
                          >
                            Dar baixa
                          </button>
                          <button
                            type="button"
                            disabled={!i.devolvido_em}
                            onClick={() => acaoLinha('reverter', e, i)}
                          >
                            Reverter baixa
                          </button>
                          <button type="button" onClick={() => acaoLinha('copiar-epi', e, i)}>
                            Copiar EPI
                          </button>
                          <button type="button" onClick={() => acaoLinha('copiar-pessoa', e, i)}>
                            Copiar trabalhador
                          </button>
                          <button
                            type="button"
                            className="perigo"
                            disabled={Boolean(e.cancelada_em)}
                            onClick={() => acaoLinha('cancelar', e, i)}
                          >
                            Cancelar a entrega
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                {quem && localDoTrabalhador(quem) && (
                  <p className="dica">Local: {localDoTrabalhador(quem)}</p>
                )}
              </div>

              {/* Quem entrega quase nunca é quem está logado. A lista só
                  aparece quando a empresa marcou alguém como encarregado
                  em Colaboradores — até lá, fica o nome de quem registrou. */}
              {encarregados.length > 0 && (
                <div className="field">
                  <label htmlFor="entrega-entregador">Quem está entregando</label>
                  <select
                    id="entrega-entregador"
                    value={entregador}
                    onChange={(e) => setEntregador(e.target.value)}
                  >
                    <option value="">{meuNome ? `${meuNome} (você)` : 'Você'}</option>
                    {encarregados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.funcao ? ` · ${c.funcao}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

      {/* ---------- editar a entrega e dar baixa ---------- */}
      {editando && (
        <div className="cortina" role="dialog" aria-modal="true" aria-label="Editar entrega">
          <form className="painel-lateral" onSubmit={salvarEdicao}>
            <div className="painel-head">
              <h2>Entrega de {editando.entrega.colaboradores?.nome || '—'}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditando(null)}
                disabled={salvandoEdicao}
              >
                Fechar
              </button>
            </div>

            <div className="painel-corpo">
              {editando.entrega.assinado_em && (
                <div className="banner">
                  Esta entrega já foi assinada em {dataHoraBr(editando.entrega.assinado_em)}. O que
                  você mudar aqui fica registrado com o seu nome e aparece na ficha.
                </div>
              )}

              <div className="field">
                <label htmlFor="edicao-data">Data e hora da entrega</label>
                <input
                  id="edicao-data"
                  type="datetime-local"
                  value={editando.data}
                  onChange={(ev) => setEditando({ ...editando, data: ev.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="edicao-obs">Observação da entrega</label>
                <input
                  id="edicao-obs"
                  type="text"
                  value={editando.observacoes}
                  onChange={(ev) => setEditando({ ...editando, observacoes: ev.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <p className="section-title">Equipamentos</p>
              {editando.entrega.epi_entregas_itens.map((i) => {
                const f = editando.itens[i.id]
                if (!f) return null
                return (
                  <div key={i.id} className={`item-edicao ${f.devolvido ? 'baixado' : ''}`}>
                    <strong>
                      {i.quantidade > 1 ? `${i.quantidade}× ` : ''}
                      {i.nome}
                      {i.complemento ? ` · ${i.complemento}` : ''}
                      {i.ca ? ` · CA ${i.ca}` : ''}
                    </strong>

                    <div className="item-linha">
                      <div className="field">
                        <label htmlFor={`troca-${i.id}`}>Trocar até</label>
                        <input
                          id={`troca-${i.id}`}
                          type="date"
                          value={f.troca_em}
                          onChange={(ev) => mudarItem(i.id, 'troca_em', ev.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`prev-${i.id}`}>Previsão de devolução</label>
                        <input
                          id={`prev-${i.id}`}
                          type="date"
                          value={f.previsao_devolucao}
                          onChange={(ev) => mudarItem(i.id, 'previsao_devolucao', ev.target.value)}
                        />
                      </div>
                    </div>

                    <label className="caixa-marcar">
                      <input
                        type="checkbox"
                        checked={f.devolvido}
                        onChange={(ev) => mudarItem(i.id, 'devolvido', ev.target.checked)}
                      />
                      Este equipamento voltou
                    </label>

                    {f.devolvido && (
                      <div className="item-linha">
                        <div className="field">
                          <label htmlFor={`dev-${i.id}`}>Quando voltou</label>
                          <input
                            id={`dev-${i.id}`}
                            type="date"
                            value={f.devolvido_em}
                            max={hojeBrasilia()}
                            onChange={(ev) => mudarItem(i.id, 'devolvido_em', ev.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`mot-${i.id}`}>Por quê</label>
                          <select
                            id={`mot-${i.id}`}
                            value={f.devolucao_motivo}
                            onChange={(ev) => mudarItem(i.id, 'devolucao_motivo', ev.target.value)}
                          >
                            {MOTIVOS_DEVOLUCAO.map((m) => (
                              <option key={m.valor} value={m.valor}>
                                {m.rotulo}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {f.devolvido && (
                      <div className="field">
                        <label htmlFor={`devobs-${i.id}`}>Observação da devolução</label>
                        <input
                          id={`devobs-${i.id}`}
                          type="text"
                          value={f.devolucao_obs}
                          onChange={(ev) => mudarItem(i.id, 'devolucao_obs', ev.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                    )}

                    {i.devolvido_por_nome && f.devolvido && (
                      <p className="dica">Baixa registrada por {i.devolvido_por_nome}.</p>
                    )}
                  </div>
                )
              })}

              <p className="dica">
                O equipamento, o CA e a quantidade não mudam aqui: é o que está escrito na ficha
                que o trabalhador assinou. Se a entrega saiu errada, cancele e faça outra.
              </p>
            </div>

            <div className="painel-rodape">
              <button
                type="button"
                className="btn"
                onClick={() => setEditando(null)}
                disabled={salvandoEdicao}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={salvandoEdicao}>
                {salvandoEdicao ? 'Salvando…' : 'Salvar'}
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
            <p>Falta {qr.nome.split(' ')[0]} assinar o recebimento.</p>
            {/* Nem todo trabalhador tem o celular na mão, e quem entrega quase
                sempre está com o aparelho aberto nesta tela. Passar o telefone
                abre a MESMA página de assinatura, com o mesmo CPF e o mesmo
                registro de horário — muda só como se chega nela. */}
            <a href={qr.url} className="btn btn-primary btn-larga" target="_blank" rel="noreferrer">
              Assinar neste aparelho
            </a>
            <p className="qr-ou">ou peça para ele apontar a câmera do próprio celular aqui</p>
            <img src={qr.imagem} alt="Código QR para assinar o recebimento" width={210} height={210} />
            <p className="qr-link">{qr.url}</p>
            <div className="qr-acoes">
              <button type="button" className="btn btn-sm" onClick={copiarLink}>
                Copiar o link
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setQr(null)}>
                Fechar
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
