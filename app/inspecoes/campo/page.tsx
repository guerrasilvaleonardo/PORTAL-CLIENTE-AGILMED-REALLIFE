'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

const agoraBr = () =>
  new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function CampoConteudo() {
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

  const [tipo, setTipo] = useState<'oportunidade' | 'nao_conformidade'>('oportunidade')
  const [descricao, setDescricao] = useState('')
  const [gravidade, setGravidade] = useState('media')
  const [prazo, setPrazo] = useState('')
  const [responsavel, setResponsavel] = useState('')
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
      const { data } = await supabase
        .from('locais_trabalho')
        .select('id, nome')
        .eq('empresa_id', empresaAtual)
        .eq('ativo', true)
        .order('nome')
      if (ativo) setLocais((data || []) as Local[])
    }
    buscar()
    return () => {
      ativo = false
    }
  }, [empresaAtual])

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

    setSalvando(true)
    try {
      const local = locais.find((l) => l.id === localId)
      const oportunidade = tipo === 'oportunidade'

      const { data, error } = await supabase
        .from('nao_conformidades')
        .insert({
          empresa_id: empresaAtual,
          origem: 'avulsa',
          tipo: 'inspecao',
          local_id: localId || null,
          local_nome: local?.nome || null,
          descricao: descricao.trim(),
          classificacao: oportunidade ? 'oportunidade' : null,
          /* Oportunidade entra como baixa para não inflar a fila de
             gravidade alta; a tela nem mostra o campo. */
          gravidade: oportunidade ? 'baixa' : gravidade,
          prazo: oportunidade || !prazo ? null : prazo,
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
          classificacao: oportunidade ? 'oportunidade' : null,
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
      setDescricao('')
      setFotos([])
      setPrevias({})
      setPrazo('')
      setResponsavel('')
      setAviso('Apontamento salvo. Pode seguir para o próximo.')
      setTimeout(() => setAviso(''), 3000)
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
              <div className="campo-tipo">
                <button
                  type="button"
                  className={tipo === 'oportunidade' ? 'sel' : ''}
                  onClick={() => setTipo('oportunidade')}
                >
                  Oportunidade de melhoria
                </button>
                <button
                  type="button"
                  className={tipo === 'nao_conformidade' ? 'sel' : ''}
                  onClick={() => setTipo('nao_conformidade')}
                >
                  Não conformidade
                </button>
              </div>

              <label className="campo-linha">
                <span>O que você viu</span>
                <textarea
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Corrimão da rampa pode receber faixa antiderrapante"
                />
              </label>

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

              {tipo === 'nao_conformidade' ? (
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
                    <input
                      type="text"
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      placeholder="Quem vai resolver"
                    />
                  </label>
                </div>
              ) : (
                <p className="campo-dica">
                  Oportunidade não pede prazo nem responsável: nada está errado. Abrir ação
                  corretiva do que não falhou ensina a equipe a parar de sugerir.
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
                        'pill ' + (a.classificacao === 'oportunidade' ? 'good' : 'bad')
                      }
                    >
                      {a.classificacao === 'oportunidade' ? 'Melhoria' : 'Não conformidade'}
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
      <CampoConteudo />
    </ComModulo>
  )
}
