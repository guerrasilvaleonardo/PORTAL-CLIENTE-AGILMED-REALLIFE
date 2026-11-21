'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ComModulo } from '@/components/ModuloBloqueado'
import Ajuda from '@/components/Ajuda'
import FiltroEmpresa from '@/components/FiltroEmpresa'
import AbasRelatorios from '@/components/AbasRelatorios'
import '../../colaboradores/colaboradores.css'
import '../inspecoes.css'

/*
 * Todos os relatórios emitidos, por código.
 *
 * MOTIVO: pedido dele em 21/11/2026. "relatórios de inspeção deve
 * gerar todos os relatórios realizados (...) para que eu possa
 * imprimir e cumprir requisitos de ISO, ter qualificação técnica."
 *
 * O QUE ESTA TELA PROVA. Numa auditoria, a pergunta não é "você faz
 * inspeção?" — é "me mostre as inspeções de março". Uma lista com
 * código sequencial responde isso em dez segundos e, de quebra, mostra
 * se faltou mês: código 0007 seguido de 0009 é uma pergunta que a
 * empresa precisa saber responder.
 *
 * NÃO HÁ APAGAR. Relatório emitido é documento, e documento não
 * desaparece — some da lista e a sequência denuncia. Se um foi emitido
 * por engano, o caminho é emitir a revisão dizendo isso.
 */

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

const TIPOS: Record<string, string> = {
  visita: 'Inspeção de campo',
  periodo: 'Consolidado do período',
  inspecao: 'Inspeção com checklist',
  auditoria: 'Auditoria',
}

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null }

type Relatorio = {
  id: string
  empresa_id: string
  tipo: string
  codigo: string
  revisao: number
  visita_id: string | null
  inspecao_id: string | null
  periodo_de: string | null
  periodo_ate: string | null
  emitido_em: string
  revisado_em: string | null
  emitido_por_nome: string | null
  resumo: any
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const soData = (d: string | null) => (d ? d.split('-').reverse().join('/') : null)

function RelatoriosConteudo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [interno, setInterno] = useState(false)
  const [minhaEmpresa, setMinhaEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [lista, setLista] = useState<Relatorio[]>([])
  const [tipo, setTipo] = useState('')

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

      const { data } = await supabase
        .from('relatorios_emitidos')
        .select(
          'id, empresa_id, tipo, codigo, revisao, visita_id, inspecao_id, periodo_de, periodo_ate, emitido_em, revisado_em, emitido_por_nome, resumo'
        )
        .order('emitido_em', { ascending: false })
        .limit(500)
      setLista((data || []) as unknown as Relatorio[])
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar os relatórios.')
    } finally {
      setCarregando(false)
    }
  }, [])

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

  const visiveis = lista
    .filter((r) => !empresaAtual || r.empresa_id === empresaAtual)
    .filter((r) => !tipo || r.tipo === tipo)

  const nomeDaEmpresa = (id: string) => {
    const e = empresas.find((x) => x.id === id)
    return e ? e.nome_fantasia || e.razao_social : ''
  }

  const destino = (r: Relatorio) =>
    r.visita_id
      ? '/inspecoes/visita/' + r.visita_id
      : r.inspecao_id
        ? '/inspecoes/' + r.inspecao_id + '/relatorio'
        : '/inspecoes/relatorio'

  return (
    <div className="app">
      <div>
        <p className="eyebrow">INSPEÇÕES</p>
        <h1 className="titulo-tela">Relatórios</h1>
        <p className="subtitulo-tela">
          Todos, por código e em ordem. Reimprimir não gera número novo — o código é do evento, e
          o que muda é a revisão.
        </p>
      </div>

      <AbasRelatorios />

      {erro && <div className="banner bad">{erro}</div>}

      <div className="rel-duas-colunas">
      <div className="rel-coluna-lista">

      <div className="filters">
        {interno && (
          <FiltroEmpresa
            valor={empresaFiltro}
            aoMudar={setEmpresaFiltro}
            opcoes={empresas.map((e) => ({ id: e.id, nome: e.nome_fantasia || e.razao_social }))}
          />
        )}
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {visiveis.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <p style={{ marginTop: 0 }}>
              Nenhum relatório emitido ainda. O primeiro nasce quando uma visita de campo for
              encerrada em <Link href="/inspecoes/campo">Apontamento de campo</Link>.
            </p>
          </div>
        </div>
      ) : (
        <table className="tabela-colab">
          <thead>
            <tr>
              <th>
                Código{' '}
                <Ajuda
                  titulo="Código do relatório"
                  texto="RIC é o relatório de uma visita de campo; RIP é o consolidado de um período. A numeração é por empresa e por ano, então um salto na sequência (0007 para 0009) é um relatório que sumiu — e uma pergunta que a auditoria vai fazer."
                />
              </th>
              <th>Tipo</th>
              {interno && <th>Empresa</th>}
              <th>Referência</th>
              <th>Emitido</th>
              <th>Por</th>
              <th className="acoes" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => (
              <tr key={r.id}>
                <td className="nome mono">
                  {r.codigo}
                  {r.revisao > 1 && (
                    <span className="pill flat" style={{ marginLeft: 6 }}>
                      rev. {String(r.revisao).padStart(2, '0')}
                    </span>
                  )}
                </td>
                <td>{TIPOS[r.tipo] || r.tipo}</td>
                {interno && <td>{nomeDaEmpresa(r.empresa_id)}</td>}
                <td>
                  {r.periodo_de
                    ? `${soData(r.periodo_de)} a ${soData(r.periodo_ate)}`
                    : r.resumo?.apontamentos !== undefined
                      ? `${r.resumo.apontamentos} apontamento${r.resumo.apontamentos === 1 ? '' : 's'}`
                      : '—'}
                </td>
                <td className="mono">{dataHora(r.emitido_em)}</td>
                <td>{r.emitido_por_nome || '—'}</td>
                <td className="acoes">
                  <Link href={destino(r)} className="btn btn-sm">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      </div>

      {/*
       * A coluna da direita: o que o arquivo não responde sozinho.
       *
       * Quem abre esta tela com uma auditoria marcada precisa saber
       * duas coisas que não estão na tabela — como o código é formado
       * (para explicar um salto de sequência) e o que sai na folha
       * impressa. Estavam só na minha cabeça e no código; agora estão
       * onde a pergunta acontece.
       */}
      <aside className="rel-coluna-lado nao-imprimir">
        <div className="panel">
          <div className="panel-body">
            <div className="section-title" style={{ marginBottom: 10 }}>
              Gerar o relatório do período
            </div>
            <p className="ajuda-linha" style={{ marginBottom: 12 }}>
              Junta várias visitas num documento só, com indicadores. É o que vai para a reunião
              mensal — e o número já fica reservado na emissão.
            </p>
            <Link href="/inspecoes/relatorio" className="btn btn-sm btn-primary">
              Abrir o do período
            </Link>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">
            <div className="section-title" style={{ marginBottom: 10 }}>
              Como o código funciona
            </div>

            <p className="rel-codigo-exemplo mono">RIC-2026-0041</p>

            <dl className="rel-codigo-partes">
              <div>
                <dt>RIC</dt>
                <dd>relatório de inspeção de campo (RIP é o do período)</dd>
              </div>
              <div>
                <dt>2026</dt>
                <dd>ano da emissão</dd>
              </div>
              <div>
                <dt>0041</dt>
                <dd>sequência da empresa naquele ano, sem buraco e sem repetir</dd>
              </div>
            </dl>

            <p className="ajuda-linha" style={{ marginTop: 12 }}>
              Mudou algo depois de emitido? O código fica o mesmo e a revisão sobe, com o motivo
              escrito. O documento anterior continua guardado.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">
            <div className="section-title" style={{ marginBottom: 10 }}>
              Na folha impressa
            </div>
            <ul className="rel-folha">
              <li>Cabeçalho com cliente, local e o código em todas as páginas</li>
              <li>Rodapé com “página 2 de 9” e a data e hora da emissão</li>
              <li>Foto nunca corta entre duas páginas</li>
              <li>Assinatura de quem inspecionou e de quem deu ciência</li>
            </ul>
          </div>
        </div>
      </aside>

      </div>
    </div>
  )
}

export default function RelatoriosEmitidos() {
  return (
    <ComModulo modulo="inspecoes">
      <RelatoriosConteudo />
    </ComModulo>
  )
}
