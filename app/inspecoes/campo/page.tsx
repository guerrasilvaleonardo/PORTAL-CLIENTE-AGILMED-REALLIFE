'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'
import './campo.css'

/*
 * Apontamento de campo — o registro avulso, sem checklist.
 *
 * MOTIVO: pedido dele em 21/11/2026. "temos que ter um modelo avulso,
 * tipo RCN, onde eu chego no campo e vou identificando cada
 * oportunidade de melhoria sem checklist, inserindo as fotos e os
 * demais itens, e também o local do cliente."
 *
 * A INSPEÇÃO PERGUNTA, ISTO ANOTA. O checklist serve quando se sabe de
 * antemão o que verificar. Em campo aparece o que ninguém previu — e
 * fazer o técnico procurar em qual item do checklist aquilo se encaixa
 * é o jeito mais rápido de ele não registrar.
 *
 * O LOCAL SE ESCOLHE UMA VEZ. Se fosse campo de cada apontamento, a
 * mesma coisa seria digitada quinze vezes numa manhã — e na décima
 * começaria a ser abreviada diferente, quebrando o agrupamento por
 * local no relatório.
 *
 * DÁ PARA CRIAR O LOCAL NA HORA, e isso não é conveniência: na
 * primeira vez que esta tela abrir não existe local nenhum cadastrado.
 * Tela que só deixa escolher de uma lista vazia é tela inutilizável.
 *
 * OPORTUNIDADE NÃO PEDE PRAZO NEM DONO. Nada está errado. Pedir ação
 * corretiva do que não falhou ensina a equipe a parar de sugerir — o
 * contrário do que a melhoria contínua precisa.
 *
 * A COORDENADA É OPCIONAL E DECLARADA. O galpão pode não ter sinal e o
 * navegador pode negar. Bloquear o registro por isso faria o técnico
 * desistir de apontar, e apontamento sem coordenada vale muito mais do
 * que apontamento nenhum.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Local = { id: string; nome: string }
type Pessoa = { id: string; nome: string | null; email: string | null; cargo: string | null }

type Apontamento = {
  id: string
  descricao: string
  classificacao: string | null
  gravidade: string
  prazo: string | null
  responsavel_nome: string | null
  fotos: string[]
  criado: string
}

type Posicao = { lat: number; lon: number; precisao: number } | null

/*
 * O mesmo problema, apontado antes neste mesmo local.
 *
 * É o que o relatório do concorrente mostra como "situação anterior" e
 * "situação atual". Aqui aparece ANTES de salvar, enquanto a pessoa
 * ainda está na frente do problema: saber que já foi apontado em
 * agosto muda o que ela escreve e com quem ela fala.
 */
type Anterior = {
  id: string
  descricao: string
  classificacao: string | null
  situacao: string
  quando: string
  foto: string | null
  quantas: number
} | null

const agoraBr = () =>
  new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function CampoConteudo() {
  const parametros = useSearchParams()
  /* Lido uma vez: o QR colado na parede manda ?local=…, e a pessoa já
     cai apontando, sem escolher nada. */
  const localDoQr = parametros?.get('local') || ''

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const [interno, setInterno] = useState(false)
  const [usuario, setUsuario] = useState('')
  const [meuNome, setMeuNome] = useState('')
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [locais, setLocais] = useState<Local[]>([])
  const [localId, setLocalId] = useState('')
  const [localNovo, setLocalNovo] = useState('')
  const [emVisita, setEmVisita] = useState(false)

  const [posicao, setPosicao] = useState<Posicao>(null)
  const [posicaoErro, setPosicaoErro] = useState('')

  /*
   * Três conclusões possíveis para o mesmo olhar: está certo, dá para
   * melhorar, está errado. A inspetora pediu a primeira — relatório só
   * de defeito descreve a empresa pior do que ela é, e não diz quantos
   * itens foram olhados para achar os dois problemas.
   */
  const [tipo, setTipo] = useState<
    'conforme' | 'insuficiente' | 'oportunidade' | 'nao_conformidade'
  >('conforme')
  const [titulo, setTitulo] = useState('')
  const [titulosConhecidos, setTitulosConhecidos] = useState<string[]>([])
  const [anterior, setAnterior] = useState<Anterior>(null)
  const [descricao, setDescricao] = useState('')
  const [gravidade, setGravidade] = useState('media')
  const [prazo, setPrazo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [ditando, setDitando] = useState(false)
  const [vozIndisponivel, setVozIndisponivel] = useState(false)
  const reconhecimento = useRef<any>(null)
  const [fotos, setFotos] = useState<string[]>([])
  const [previas, setPrevias] = useState<Record<string, string>>({})
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [feitos, setFeitos] = useState<Apontamento[]>([])
  const inputFoto = useRef<HTMLInputElement>(null)

  const empresaAtual = interno ? empresaFiltro : minhaEmpresa

  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setUsuario(user.id)

      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil, empresa_id, nome')
        .eq('id', user.id)
        .single()

      const souInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(souInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')
      setMeuNome((perfil as any)?.nome || '')

      if (souInterno) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('razao_social')
        setEmpresas((emps || []) as Empresa[])
      }
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível abrir a tela.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /* Os locais seguem a empresa escolhida. */
  useEffect(() => {
    let ativo = true
    async function buscar() {
      if (!empresaAtual) {
        setLocais([])
        return
      }
      const [{ data }, { data: gente }] = await Promise.all([
        supabase
          .from('locais_trabalho')
          .select('id, nome')
          .eq('empresa_id', empresaAtual)
          .eq('ativo', true)
          .order('nome'),
        /* Quem pode receber uma não conformidade. Escolher da lista em
           vez de digitar o nome é o que permite avisar por e-mail: nome
           digitado não tem para onde mandar. */
        supabase
          .from('profiles')
          .select('id, nome, email, cargo')
          .eq('empresa_id', empresaAtual)
          .eq('ativo', true)
          .order('nome'),
      ])
      if (ativo) {
        const lista = (data || []) as Local[]
        setLocais(lista)
        setPessoas((gente || []) as Pessoa[])

        /* Veio de QR: entra direto na visita, sem passar pela escolha.
           Só se o local for mesmo desta empresa — QR de outro cliente
           não abre visita aqui. */
        if (localDoQr && lista.some((l) => l.id === localDoQr)) {
          setLocalId(localDoQr)
          setEmVisita(true)
          pedirPosicao()
          carregarTitulos(empresaAtual, localDoQr)
        }
      }
    }
    buscar()
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual, localDoQr])

  /*
   * DITAR É O QUE FAZ ESTA TELA SER USADA. De capacete e luva, digitar
   * três linhas num celular é o atrito que faz o técnico decidir
   * "anoto depois" — que quer dizer nunca.
   *
   * Usa o reconhecimento de fala do próprio navegador: não manda áudio
   * para serviço nenhum, não tem custo por minuto e funciona no
   * Chrome do Android, que é o aparelho do campo. Onde não existe, o
   * botão some e o teclado continua lá — nunca o contrário.
   *
   * O texto ditado é ACRESCENTADO ao que já está escrito. Substituir
   * faria a segunda frase apagar a primeira, e quem está falando não
   * olha a tela para perceber.
   */
  function ditar() {
    if (ditando) {
      reconhecimento.current?.stop()
      return
    }

    const Motor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Motor) {
      setVozIndisponivel(true)
      setErro('Este navegador não reconhece fala. Use o teclado — ou o Chrome no Android.')
      return
    }

    const r = new Motor()
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = false

    r.onresult = (evento: any) => {
      let novo = ''
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        if (evento.results[i].isFinal) novo += evento.results[i][0].transcript
      }
      if (novo.trim()) {
        setDescricao((atual) => (atual ? atual.trim() + ' ' : '') + novo.trim())
      }
    }
    r.onerror = (e: any) => {
      setDitando(false)
      if (e.error === 'not-allowed') setErro('O microfone está bloqueado neste aparelho.')
    }
    r.onend = () => setDitando(false)

    reconhecimento.current = r
    setErro('')
    setDitando(true)
    r.start()
  }

  /* Reconhecimento que fica aberto em tela trocada continua ouvindo. */
  useEffect(() => {
    return () => {
      try {
        reconhecimento.current?.stop()
      } catch {
        /* já parado */
      }
    }
  }, [])

  /*
   * Os títulos já usados neste local, para a lista de sugestão. É a
   * peça que faz o histórico funcionar: título escolhido da lista casa
   * com o anterior; título digitado de novo, a cada visita, nunca casa.
   */
  const carregarTitulos = useCallback(async (empresa: string, local: string) => {
    if (!empresa || !local) return
    const { data } = await supabase
      .from('nao_conformidades')
      .select('titulo')
      .eq('empresa_id', empresa)
      .eq('local_id', local)
      .not('titulo', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
    const vistos: string[] = []
    for (const r of (data || []) as any[]) {
      if (r.titulo && !vistos.includes(r.titulo)) vistos.push(r.titulo)
    }
    setTitulosConhecidos(vistos)
  }, [])

  /*
   * Procura o mesmo título, no mesmo local, apontado antes. A regra é
   * a do concorrente, menos um critério: eles exigem que a inspeção
   * anterior já tenha sido exportada. Aqui não — o apontamento de
   * campo não tem exportação, e esperar por ela esconderia o histórico
   * justamente de quem está em campo agora.
   */
  const buscarAnterior = useCallback(
    async (texto: string) => {
      const t = texto.trim()
      if (!t || !empresaAtual || !localId) {
        setAnterior(null)
        return
      }
      const { data } = await supabase
        .from('nao_conformidades')
        .select('id, descricao, classificacao, situacao, created_at, foto_path')
        .eq('empresa_id', empresaAtual)
        .eq('local_id', localId)
        .eq('titulo', t)
        .order('created_at', { ascending: false })
        .limit(20)

      const lista = (data || []) as any[]
      if (!lista.length) {
        setAnterior(null)
        return
      }

      const ultimo = lista[0]
      let foto: string | null = null
      if (ultimo.foto_path) {
        const { data: url } = await supabase.storage
          .from('inspecao-fotos')
          .createSignedUrl(ultimo.foto_path, 3600)
        foto = url?.signedUrl || null
      }

      setAnterior({
        id: ultimo.id,
        descricao: ultimo.descricao,
        classificacao: ultimo.classificacao,
        situacao: ultimo.situacao,
        quando: new Date(ultimo.created_at).toLocaleDateString('pt-BR'),
        foto,
        quantas: lista.length,
      })
    },
    [empresaAtual, localId]
  )

  function pedirPosicao() {
    setPosicaoErro('')
    if (!('geolocation' in navigator)) {
      setPosicaoErro('Este aparelho não informa a localização.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPosicao({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          precisao: Math.round(p.coords.accuracy),
        }),
      (e) =>
        setPosicaoErro(
          e.code === e.PERMISSION_DENIED
            ? 'Localização negada no aparelho. O apontamento salva sem ela.'
            : 'Não foi possível obter a localização agora.'
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  }

  async function comecar() {
    setErro('')
    if (!empresaAtual) {
      setErro('Escolha o cliente antes de começar.')
      return
    }
    if (!localId && !localNovo.trim()) {
      setErro('Diga em que local você está.')
      return
    }

    /* Local novo vira cadastro de verdade: o próximo apontamento, e a
       próxima visita, acham o mesmo nome na lista. */
    if (!localId && localNovo.trim()) {
      const { data, error } = await supabase
        .from('locais_trabalho')
        .insert({ empresa_id: empresaAtual, nome: localNovo.trim() })
        .select('id, nome')
        .single()
      if (error) {
        setErro(error.message)
        return
      }
      setLocais((l) => [...l, data as Local])
      setLocalId((data as Local).id)
    }

    setEmVisita(true)
    pedirPosicao()
    carregarTitulos(empresaAtual, localId || '')
  }

  async function encolher(arquivo: File): Promise<Blob> {
    const bitmap = await createImageBitmap(arquivo)
    const maior = Math.max(bitmap.width, bitmap.height)
    const escala = maior > 1600 ? 1600 / maior : 1
    const tela = document.createElement('canvas')
    tela.width = Math.round(bitmap.width * escala)
    tela.height = Math.round(bitmap.height * escala)
    tela.getContext('2d')?.drawImage(bitmap, 0, 0, tela.width, tela.height)
    return new Promise((ok) => tela.toBlob((b) => ok(b as Blob), 'image/jpeg', 0.8))
  }

  async function anexar(arquivo: File | undefined) {
    if (!arquivo || enviandoFoto) return
    if (fotos.length >= 3) {
      setErro('Três fotos por apontamento já é bastante para provar o achado.')
      return
    }
    setEnviandoFoto(true)
    setErro('')
    try {
      const blob = await encolher(arquivo)
      const caminho = `${empresaAtual}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage
        .from('inspecao-fotos')
        .upload(caminho, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      setFotos((f) => [...f, caminho])
      setPrevias((p) => ({ ...p, [caminho]: URL.createObjectURL(blob) }))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível enviar a foto.')
    } finally {
      setEnviandoFoto(false)
      if (inputFoto.current) inputFoto.current.value = ''
    }
  }

  function tirar(caminho: string) {
    setFotos((f) => f.filter((x) => x !== caminho))
    supabase.storage.from('inspecao-fotos').remove([caminho])
  }

  async function salvar() {
    if (salvando) return
    setErro('')
    if (descricao.trim().length < 5) {
      setErro('Escreva o que você viu — uma linha já serve, mas em branco não.')
      return
    }

    /*
     * Conforme exige foto. É a diferença entre dizer que está certo e
     * mostrar que está: sem imagem, o apontamento positivo vira a
     * palavra de quem inspecionou contra a de quem pergunta, e é o
     * primeiro que o auditor externo derruba. Os outros três não
     * exigem — problema sem foto ainda é problema que precisa entrar.
     */
    if (tipo === 'conforme' && fotos.length === 0) {
      setErro('Conforme precisa de foto: é ela que prova que está certo.')
      return
    }

    setSalvando(true)
    try {
      const local = locais.find((l) => l.id === localId)
      /*
       * Conforme e oportunidade não têm prazo, dono nem aviso: nada
       * está errado. "Atende em parte" tem tudo isso, como a não
       * conformidade — é problema, só que começado. Essa é a linha que
       * impede o parcial de virar esconderijo.
       */
      const oportunidade = tipo === 'conforme' || tipo === 'oportunidade'

      const { data, error } = await supabase
        .from('nao_conformidades')
        .insert({
          empresa_id: empresaAtual,
          origem: 'avulsa',
          tipo: 'inspecao',
          local_id: localId || null,
          local_nome: local?.nome || null,
          descricao: descricao.trim(),
          titulo: titulo.trim() || null,
          classificacao: tipo === 'nao_conformidade' ? null : tipo,
          /* Oportunidade entra como baixa para não inflar a fila de
             gravidade alta; a tela nem mostra o campo. */
          gravidade: oportunidade ? 'baixa' : gravidade,
          prazo: oportunidade || !prazo ? null : prazo,
          responsavel_id:
            oportunidade || !responsavelId || responsavelId === 'outro' ? null : responsavelId,
          responsavel_nome: oportunidade ? null : responsavel.trim() || null,
          fotos,
          foto_path: fotos[0] || null,
          latitude: posicao?.lat ?? null,
          longitude: posicao?.lon ?? null,
          precisao_m: posicao?.precisao ?? null,
          ocorrido_em: new Date().toISOString(),
          aberta_por: usuario || null,
        })
        .select('id')
        .single()
      if (error) throw error

      setFeitos((lista) => [
        {
          id: (data as any).id,
          descricao: descricao.trim(),
          classificacao: tipo === 'nao_conformidade' ? null : tipo,
          gravidade: oportunidade ? 'baixa' : gravidade,
          prazo: oportunidade || !prazo ? null : prazo,
          responsavel_nome: oportunidade ? null : responsavel.trim() || null,
          fotos,
          criado: agoraBr(),
        },
        ...lista,
      ])

      /* Limpa o apontamento, mantém a visita: o local, a empresa e a
         posição seguem valendo para o próximo. */
      /*
       * O aviso é disparado DEPOIS de o registro estar salvo, e uma
       * falha no e-mail não desfaz nada: a não conformidade existe, e
       * o responsável a vê no portal de qualquer jeito. Travar o
       * salvamento por causa do servidor de e-mail seria perder o
       * apontamento que a pessoa acabou de fazer em campo.
       */
      const destinatario = pessoas.find((p) => p.id === responsavelId)
      if (!oportunidade && destinatario?.email) {
        try {
          const { data: sessao } = await supabase.auth.getSession()
          const resposta = await fetch('/api/inspecoes/aviso-nc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + (sessao.session?.access_token || ''),
            },
            body: JSON.stringify({ id: (data as any).id }),
          })
          if (!resposta.ok) throw new Error(String(resposta.status))
          setAviso(`Apontamento salvo. ${destinatario.nome || 'O responsável'} foi avisado.`)
        } catch {
          setAviso('Apontamento salvo, mas o aviso por e-mail não saiu. Ele vê no portal.')
        }
      } else {
        setAviso('Apontamento salvo. Pode seguir para o próximo.')
      }

      setDescricao('')
      setTitulo('')
      setAnterior(null)
      setFotos([])
      setPrevias({})
      setPrazo('')
      setResponsavel('')
      setResponsavelId('')
      carregarTitulos(empresaAtual, localId)
      setTimeout(() => setAviso(''), 4000)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  const local = locais.find((l) => l.id === localId)
  const empresa = empresas.find((e) => e.id === empresaAtual)

  return (
    <div className="app campo">
      {!emVisita ? (
        <>
          <div className="nao-imprimir">
            <p className="eyebrow">INSPEÇÕES</p>
            <h1 className="titulo-tela">Onde você está</h1>
            <p className="subtitulo-tela">
              Escolhido uma vez. Vale para todos os apontamentos desta visita.
            </p>
          </div>

          {erro && <div className="banner bad">{erro}</div>}

          <div className="panel">
            <div className="panel-body campo-form">
              {interno && (
                <label className="campo-linha">
                  <span>Cliente</span>
                  <FiltroEmpresa
                    valor={empresaFiltro}
                    aoMudar={setEmpresaFiltro}
                    opcoes={empresas.map((e) => ({
                      id: e.id,
                      nome: e.nome_fantasia || e.razao_social,
                    }))}
                  />
                </label>
              )}

              <label className="campo-linha">
                <span>Local</span>
                <select value={localId} onChange={(e) => setLocalId(e.target.value)}>
                  <option value="">
                    {locais.length ? 'Escolha o local…' : 'Nenhum local cadastrado ainda'}
                  </option>
                  {locais.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </label>

              {!localId && (
                <label className="campo-linha">
                  <span>Ou crie agora</span>
                  <input
                    type="text"
                    value={localNovo}
                    onChange={(e) => setLocalNovo(e.target.value)}
                    placeholder="Doca de recebimento"
                  />
                </label>
              )}

              <button type="button" className="btn btn-primary" onClick={comecar}>
                Começar a apontar
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="campo-cabeca nao-imprimir">
            <div>
              <p className="eyebrow">APONTAMENTO DE CAMPO</p>
              <h1 className="titulo-tela">{local?.nome || 'Local'}</h1>
              <p className="subtitulo-tela">
                {empresa ? empresa.nome_fantasia || empresa.razao_social : ''}
                {posicao
                  ? ` · ${posicao.lat.toFixed(6)}, ${posicao.lon.toFixed(6)} · ±${posicao.precisao} m`
                  : ''}
              </p>
              {!posicao && (
                <p className="campo-sem-gps">
                  {posicaoErro || 'Localização ainda não obtida.'}{' '}
                  <button type="button" className="btn btn-sm" onClick={pedirPosicao}>
                    Tentar de novo
                  </button>
                </p>
              )}
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setEmVisita(false)}>
              Trocar de local
            </button>
          </div>

          {erro && <div className="banner bad nao-imprimir">{erro}</div>}
          {aviso && <div className="banner nao-imprimir">{aviso}</div>}

          <div className="panel nao-imprimir">
            <div className="panel-body campo-form">
              {/* Quatro conclusões, na ordem do melhor para o pior. A
                  do meio é a que faltava: em campo a verdade quase
                  sempre é "está pela metade", e obrigar a escolher
                  entre certo e errado produz relatório que o cliente
                  não reconhece. */}
              <div className="campo-tipo quatro">
                <button
                  type="button"
                  className={'bom' + (tipo === 'conforme' ? ' sel' : '')}
                  onClick={() => setTipo('conforme')}
                >
                  Conforme
                </button>
                <button
                  type="button"
                  className={'parcial' + (tipo === 'insuficiente' ? ' sel' : '')}
                  onClick={() => setTipo('insuficiente')}
                >
                  Atende em parte
                </button>
                <button
                  type="button"
                  className={'melhoria' + (tipo === 'oportunidade' ? ' sel' : '')}
                  onClick={() => setTipo('oportunidade')}
                >
                  Oportunidade
                </button>
                <button
                  type="button"
                  className={'ruim' + (tipo === 'nao_conformidade' ? ' sel' : '')}
                  onClick={() => setTipo('nao_conformidade')}
                >
                  Não conformidade
                </button>
              </div>

              <label className="campo-linha">
                <span>Título curto</span>
                <input
                  type="text"
                  list="titulos-do-local"
                  value={titulo}
                  maxLength={80}
                  onChange={(e) => setTitulo(e.target.value)}
                  onBlur={(e) => buscarAnterior(e.target.value)}
                  placeholder="Extintor obstruído"
                />
                <span className="campo-mini">
                  É por ele que o portal reconhece o mesmo problema na próxima visita. Escolha da
                  lista quando já existir.
                </span>
                <datalist id="titulos-do-local">
                  {titulosConhecidos.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>

              {anterior && (
                <div className="campo-anterior">
                  <p className="campo-anterior-tit">
                    Já apontado aqui em {anterior.quando}
                    {anterior.quantas > 1 ? ` — ${anterior.quantas} vezes no total` : ''}
                  </p>
                  <div className="campo-anterior-corpo">
                    {anterior.foto && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={anterior.foto} alt="Situação anterior" />
                    )}
                    <div>
                      <p>{anterior.descricao}</p>
                      <p className="campo-mini">
                        {anterior.situacao === 'encerrada'
                          ? 'Aquele foi encerrado. Se voltou, a ação não funcionou — vale dizer isso na descrição.'
                          : 'Aquele continua em aberto. Em vez de abrir outro, considere atualizar o que já existe.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="campo-linha">
                <div className="campo-rotulo-voz">
                  <span>O que você viu</span>
                  {!vozIndisponivel && (
                    <button
                      type="button"
                      className={'campo-voz' + (ditando ? ' ouvindo' : '')}
                      onClick={ditar}
                    >
                      {ditando ? 'ouvindo… toque para parar' : 'ditar'}
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Corrimão da rampa pode receber faixa antiderrapante"
                />
              </div>

              <div className="campo-fotos">
                {fotos.map((f) => (
                  <div key={f} className="campo-foto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previas[f]} alt="" />
                    <button type="button" onClick={() => tirar(f)} aria-label="Remover foto">
                      ×
                    </button>
                  </div>
                ))}
                {fotos.length < 3 && (
                  <label className="campo-add-foto">
                    {enviandoFoto ? 'enviando…' : 'foto'}
                    <input
                      ref={inputFoto}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => anexar(e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>

              {tipo === 'nao_conformidade' || tipo === 'insuficiente' ? (
                <div className="campo-nc">
                  <label className="campo-linha">
                    <span>Gravidade</span>
                    <select value={gravidade} onChange={(e) => setGravidade(e.target.value)}>
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </label>
                  <label className="campo-linha">
                    <span>Prazo</span>
                    <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                  </label>
                  <label className="campo-linha">
                    <span>Responsável</span>
                    <select
                      value={responsavelId}
                      onChange={(e) => {
                        setResponsavelId(e.target.value)
                        const p = pessoas.find((x) => x.id === e.target.value)
                        setResponsavel(p?.nome || '')
                      }}
                    >
                      <option value="">
                        {pessoas.length ? 'Escolha quem vai resolver…' : 'Ninguém com acesso ainda'}
                      </option>
                      {pessoas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome || p.email}
                          {p.cargo ? ` — ${p.cargo}` : ''}
                          {p.email ? '' : ' (sem e-mail)'}
                        </option>
                      ))}
                      <option value="outro">Outra pessoa, fora do portal</option>
                    </select>
                  </label>

                  {responsavelId === 'outro' && (
                    <label className="campo-linha">
                      <span>Nome de quem vai resolver</span>
                      <input
                        type="text"
                        value={responsavel}
                        onChange={(e) => setResponsavel(e.target.value)}
                        placeholder="Quem vai resolver"
                      />
                    </label>
                  )}

                  {responsavelId && responsavelId !== 'outro' && (
                    <p className="campo-dica">
                      {pessoas.find((p) => p.id === responsavelId)?.email
                        ? 'Ao salvar, essa pessoa recebe um e-mail com o apontamento, o prazo e o link.'
                        : 'Essa pessoa não tem e-mail no cadastro, então não há como avisar. Ela verá no portal.'}
                    </p>
                  )}
                </div>
              ) : (
                <p className="campo-dica">
                  {tipo === 'conforme'
                    ? 'Conforme não pede prazo nem responsável: está certo e fica registrado. Precisa de foto — conformidade sem imagem é palavra, com imagem é evidência.'
                    : 'Oportunidade não pede prazo nem responsável: nada está errado. Abrir ação corretiva do que não falhou ensina a equipe a parar de sugerir.'}
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary"
                disabled={salvando}
                onClick={salvar}
              >
                {salvando ? 'Salvando…' : 'Salvar e apontar o próximo'}
              </button>
            </div>
          </div>

          {feitos.length > 0 && (
            <div className="campo-visita">
              <div className="campo-visita-cabeca">
                <h2>Nesta visita · {feitos.length}</h2>
                <button
                  type="button"
                  className="btn btn-sm nao-imprimir"
                  onClick={() => window.print()}
                >
                  Imprimir o RCN desta visita
                </button>
              </div>

              {/* Cabeçalho que só aparece no papel: quem recebe a folha
                  precisa saber de quem é, de onde e de quando. */}
              <div className="campo-so-impresso">
                <p className="campo-rcn-titulo">Registro de campo</p>
                <p>
                  {empresa ? empresa.nome_fantasia || empresa.razao_social : ''} · {local?.nome}
                </p>
                <p>
                  {agoraBr()} · {meuNome || 'equipe Real Life'}
                  {posicao
                    ? ` · ${posicao.lat.toFixed(6)}, ${posicao.lon.toFixed(6)} (±${posicao.precisao} m)`
                    : ' · sem coordenada'}
                </p>
              </div>

              <ol className="campo-lista">
                {feitos.map((a) => (
                  <li key={a.id}>
                    <span
                      className={
                        'pill ' +
                        (a.classificacao === 'conforme'
                          ? 'good'
                          : a.classificacao === 'oportunidade' ||
                              a.classificacao === 'insuficiente'
                            ? 'warn'
                            : 'bad')
                      }
                    >
                      {a.classificacao === 'conforme'
                        ? 'Conforme'
                        : a.classificacao === 'insuficiente'
                          ? 'Atende em parte'
                          : a.classificacao === 'oportunidade'
                            ? 'Melhoria'
                            : 'Não conformidade'}
                    </span>
                    <p>{a.descricao}</p>
                    <p className="campo-mini">
                      {a.criado}
                      {a.prazo ? ` · prazo ${a.prazo.split('-').reverse().join('/')}` : ''}
                      {a.responsavel_nome ? ` · ${a.responsavel_nome}` : ''}
                      {a.fotos.length ? ` · ${a.fotos.length} foto(s)` : ' · sem foto'}
                    </p>
                  </li>
                ))}
              </ol>

              <p className="campo-mini nao-imprimir">
                Tudo isto já está salvo e aparece em{' '}
                <Link href="/inspecoes/nc">Não conformidades</Link> e no relatório do período.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ApontamentoDeCampo() {
  return (
    <ComModulo modulo="inspecoes">
      {/* useSearchParams precisa de fronteira de suspensão: sem ela a
          página inteira vira renderização de cliente no build. */}
      <Suspense fallback={<div className="app"><p className="empty-state">Carregando…</p></div>}>
        <CampoConteudo />
      </Suspense>
    </ComModulo>
  )
}
