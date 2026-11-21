'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import { gerarDocx } from '@/lib/word'
import { MODELOS } from '@/lib/modelosImplantacao'
import '../../colaboradores/colaboradores.css'
import '../../inspecoes/inspecoes.css'
import '../implantacao.css'

/*
 * Bancada da equipe: gerar e publicar os modelos de documento.
 *
 * POR QUE PUBLICAR DAQUI E NÃO SUBIR À MÃO. Os modelos são dezoito e
 * vão crescer. Subir um por um pelo painel do Supabase é trabalho
 * manual que ninguém repete quando um texto muda — e aí o cliente
 * baixa a versão velha.
 *
 * POR QUE NÃO GERAR NO SERVIDOR. Precisaria da chave de serviço. Aqui
 * o upload sai com a sessão de quem está logado, e a política do balde
 * já exige que seja da equipe. A segurança fica no banco, não na tela.
 *
 * POR QUE REPUBLICAR SUBSTITUI. O modelo é material nosso, não dado de
 * cliente: a versão nova vale para todo mundo, e guardar as antigas só
 * criaria dúvida sobre qual baixar.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

type Estado = 'pendente' | 'publicado' | 'erro'

function ModelosConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [interno, setInterno] = useState(false)
  const [erro, setErro] = useState('')
  const [publicados, setPublicados] = useState<Record<string, Estado>>({})
  const [trabalhando, setTrabalhando] = useState(false)
  const [feito, setFeito] = useState(0)

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
        .select('perfil')
        .eq('id', user.id)
        .single()
      const souInterno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
      setInterno(souInterno)

      const { data: arquivos } = await supabase.storage.from('implantacao-modelos').list('', {
        limit: 200,
      })
      const mapa: Record<string, Estado> = {}
      ;(arquivos || []).forEach((a) => {
        mapa[a.name] = 'publicado'
      })
      setPublicados(mapa)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível ler o balde de modelos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function publicar(apenas?: string) {
    if (trabalhando) return
    setTrabalhando(true)
    setErro('')
    setFeito(0)

    const lista = apenas ? MODELOS.filter((m) => m.arquivo === apenas) : MODELOS

    for (const modelo of lista) {
      try {
        const bytes = gerarDocx(modelo.blocos)
        const arquivo = new Blob([bytes as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        const { error } = await supabase.storage
          .from('implantacao-modelos')
          .upload(modelo.arquivo, arquivo, {
            upsert: true,
            contentType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          })
        if (error) throw error
        setPublicados((a) => ({ ...a, [modelo.arquivo]: 'publicado' }))
      } catch (e: any) {
        console.error(modelo.arquivo, e)
        setPublicados((a) => ({ ...a, [modelo.arquivo]: 'erro' }))
        setErro(modelo.arquivo + ': ' + (e?.message || 'falhou'))
      }
      setFeito((n) => n + 1)
    }

    setTrabalhando(false)
  }

  /* Baixar sem publicar, para conferir o texto antes de colocar no ar. */
  function baixar(arquivo: string) {
    const modelo = MODELOS.find((m) => m.arquivo === arquivo)
    if (!modelo) return
    const bytes = gerarDocx(modelo.blocos)
    const url = URL.createObjectURL(
      new Blob([bytes as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = modelo.arquivo
    a.click()
    URL.revokeObjectURL(url)
  }

  if (carregando) {
    return (
      <div className="app">
        <p className="empty-state">Carregando…</p>
      </div>
    )
  }

  if (!interno) {
    return (
      <div className="app">
        <div className="banner">
          Esta é a bancada da equipe da Real Life. Os modelos aparecem para você dentro de cada
          atividade da sua trilha.{' '}
          <Link href="/implantacao" className="btn btn-sm">
            Ir para a implantação
          </Link>
        </div>
      </div>
    )
  }

  const noAr = MODELOS.filter((m) => publicados[m.arquivo] === 'publicado').length

  return (
    <div className="app">
      <header className="page-head">
        <div>
          <p className="eyebrow">IMPLANTAÇÃO · EQUIPE</p>
          <h1>Modelos de documento</h1>
          <p className="subtitulo">
            {noAr} de {MODELOS.length} no ar. Publicar de novo substitui a versão anterior — o
            modelo é material nosso, e a versão nova vale para todos os clientes.
          </p>
        </div>
      </header>

      {erro && <div className="banner bad">{erro}</div>}

      <div className="filters">
        <button
          type="button"
          className="btn btn-primary"
          disabled={trabalhando}
          onClick={() => publicar()}
        >
          {trabalhando ? `Publicando… ${feito}/${MODELOS.length}` : 'Gerar e publicar todos'}
        </button>
      </div>

      <table className="tabela-colab">
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Modelo</th>
            <th>Arquivo</th>
            <th>Situação</th>
            <th className="acoes" />
          </tr>
        </thead>
        <tbody>
          {MODELOS.map((m) => (
            <tr key={m.arquivo}>
              <td>
                {m.etapa}.{m.atividade}
              </td>
              <td className="nome">{m.rotulo}</td>
              <td style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{m.arquivo}</td>
              <td>
                {publicados[m.arquivo] === 'publicado' ? (
                  <span className="pill good">No ar</span>
                ) : publicados[m.arquivo] === 'erro' ? (
                  <span className="pill bad">Falhou</span>
                ) : (
                  <span className="pill flat">Fora do ar</span>
                )}
              </td>
              <td className="acoes">
                <button type="button" className="btn btn-sm" onClick={() => baixar(m.arquivo)}>
                  Conferir
                </button>{' '}
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={trabalhando}
                  onClick={() => publicar(m.arquivo)}
                >
                  Publicar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="impl-nota" style={{ marginTop: 14 }}>
        &quot;Conferir&quot; baixa o arquivo sem colocá-lo no ar — serve para ler o texto antes de
        publicar para os clientes.
      </p>
    </div>
  )
}

export default function ModelosDaImplantacao() {
  return (
    <ComModulo modulo="implantacao">
      <ModelosConteudo />
    </ComModulo>
  )
}
