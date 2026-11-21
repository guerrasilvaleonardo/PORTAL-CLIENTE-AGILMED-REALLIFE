'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'
import './locais.css'

/*
 * Locais do cliente, e a etiqueta de QR de cada um.
 *
 * MOTIVO: pedido dele em 21/11/2026, depois de ver o módulo do
 * concorrente (Siclope), que tem "registro por QR Code".
 *
 * O QUE O QR RESOLVE, E NÃO É SÓ COMODIDADE. Primeiro, acaba com a
 * escolha do local: a pessoa aponta a câmera para a etiqueta colada na
 * doca e cai na tela de apontamento já naquele local, com o nome
 * escrito igual todas as vezes — que é o que mantém o agrupamento do
 * relatório inteiro. Segundo, prova presença melhor que o GPS, que
 * erra dentro de galpão e não distingue duas docas a dez metros uma da
 * outra.
 *
 * O QR NÃO DÁ ACESSO A NADA. Ele leva a uma tela do portal que
 * continua exigindo login — quem passar a câmera sem ter conta vê a
 * tela de entrada. Por isso o código pode ser colado na parede, à
 * vista de qualquer um.
 *
 * A ETIQUETA SAI COM O NOME DO LOCAL POR EXTENSO. Parede cheia de QR
 * igual é parede onde ninguém sabe qual é qual na hora de trocar.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }
type Local = { id: string; nome: string; tipo: string; cidade_uf: string | null; ativo: boolean }

function LocaisConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const [locais, setLocais] = useState<Local[]>([])
  const [novo, setNovo] = useState('')
  const [criando, setCriando] = useState(false)
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>({})

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
      const { data: perfil } = await supabase
        .from('profiles')
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .single()

      const souInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(souInterno)
      setMinhaEmpresa(perfil?.empresa_id || '')

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

  const buscarLocais = useCallback(async () => {
    if (!empresaAtual) {
      setLocais([])
      return
    }
    const { data } = await supabase
      .from('locais_trabalho')
      .select('id, nome, tipo, cidade_uf, ativo')
      .eq('empresa_id', empresaAtual)
      .order('nome')
    setLocais((data || []) as Local[])
  }, [empresaAtual])

  useEffect(() => {
    buscarLocais()
  }, [buscarLocais])

  /* As etiquetas são desenhadas no navegador, uma vez por local. */
  useEffect(() => {
    let ativo = true
    async function desenhar() {
      const feitas: Record<string, string> = {}
      for (const l of locais) {
        const url = `${window.location.origin}/inspecoes/campo?local=${l.id}`
        feitas[l.id] = await QRCode.toDataURL(url, {
          width: 420,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
      }
      if (ativo) setEtiquetas(feitas)
    }
    if (locais.length) desenhar()
    return () => {
      ativo = false
    }
  }, [locais])

  async function criar() {
    if (criando) return
    setErro('')
    if (!empresaAtual) {
      setErro('Escolha o cliente primeiro.')
      return
    }
    if (novo.trim().length < 2) {
      setErro('Dê um nome ao local.')
      return
    }
    setCriando(true)
    const { error } = await supabase
      .from('locais_trabalho')
      .insert({ empresa_id: empresaAtual, nome: novo.trim() })
    setCriando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setNovo('')
    buscarLocais()
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  const empresa = empresas.find((e) => e.id === empresaAtual)
  const nomeEmpresa = empresa ? empresa.nome_fantasia || empresa.razao_social : ''

  return (
    <div className="app">
      <div className="nao-imprimir">
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">Locais e etiquetas</h1>
        <p className="subtitulo-tela">
          Cole a etiqueta no local. Quem apontar a câmera do celular cai direto no apontamento
          daquele ponto — sem escolher nada e sem errar o nome.
        </p>
      </div>

      {erro && <div className="banner bad nao-imprimir">{erro}</div>}

      <div className="filters nao-imprimir">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Doca de recebimento"
          style={{ minWidth: 220 }}
        />
        <button type="button" className="btn btn-sm" disabled={criando} onClick={criar}>
          {criando ? 'Criando…' : 'Criar local'}
        </button>
        {locais.length > 0 && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
            Imprimir as etiquetas
          </button>
        )}
      </div>

      {!empresaAtual ? (
        <p className="empty-state nao-imprimir">Escolha o cliente para ver os locais.</p>
      ) : locais.length === 0 ? (
        <div className="panel nao-imprimir">
          <div className="panel-body">
            <p style={{ marginTop: 0 }}>
              Nenhum local cadastrado para {nomeEmpresa || 'esta empresa'}. Crie o primeiro acima
              — pode ser pelo nome que a equipe já usa: &ldquo;doca&rdquo;, &ldquo;cabine de
              pintura&rdquo;, &ldquo;pátio&rdquo;.
            </p>
          </div>
        </div>
      ) : (
        <div className="etiquetas">
          {locais.map((l) => (
            <figure key={l.id} className={'etiqueta' + (l.ativo ? '' : ' inativa')}>
              {etiquetas[l.id] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={etiquetas[l.id]} alt={'QR do local ' + l.nome} />
              ) : (
                <div className="etiqueta-vazia">desenhando…</div>
              )}
              <figcaption>
                <strong>{l.nome}</strong>
                <span>{nomeEmpresa}</span>
                <span className="etiqueta-dica">Aponte a câmera para registrar um apontamento</span>
                {!l.ativo && <span className="etiqueta-dica">local inativo</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <p className="nao-imprimir" style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
        A etiqueta não dá acesso a nada: leva a uma tela do portal que continua pedindo login.{' '}
        <Link href="/inspecoes/campo">Ir para o apontamento de campo</Link>
      </p>
    </div>
  )
}

export default function LocaisDeInspecao() {
  return (
    <ComModulo modulo="inspecoes">
      <LocaisConteudo />
    </ComModulo>
  )
}
