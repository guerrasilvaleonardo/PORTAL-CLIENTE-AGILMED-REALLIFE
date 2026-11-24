'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { marcaDoDominio, type Marca } from '@/lib/marca'
import { MODULOS, linkContratacao, useModulos, type Modulo } from '@/lib/modulos'
import { SERVICOS, linkOrcamento, PREFIXO_CONTRATACAO, PREFIXO_ORCAMENTO } from '@/lib/servicos'
import { ROTULO_SITUACAO } from '@/lib/situacoes'
import Icone from '@/components/Icone'
import CursosEad from '@/components/CursosEad'
import '../vitrine.css'

/*
 * Contratar e pedir orçamento: tudo o que o cliente pode comprar, num
 * lugar só. Ferramentas do portal (com cadeado quando não contratadas),
 * serviços e cursos, e os pedidos já feitos. Todo pedido vira chamado,
 * então a equipe não ganha fluxo novo.
 */

type Pedido = { id: string; numero: number; assunto: string; status: string; created_at: string }

const CLASSE_SITUACAO: Record<string, string> = {
  aberto: 'info',
  em_atendimento: 'warn',
  aguardando_cliente: 'warn',
  suspenso: 'bad',
  resolvido: 'good',
  encerrado: 'good',
  cancelado: 'flat',
}

/*
 * TODAS AS FERRAMENTAS DO PORTAL, não só as três cobradas à parte.
 *
 * A tela mostrava Treinamentos, Certificados e Documentos SST e parava
 * aí — mas o menu da esquerda já exibe EPI, Inspeções, Implantar e
 * Auditar com cadeado. Quem via o cadeado no menu vinha para cá pedir o
 * orçamento e não achava a ferramenta.
 *
 * A ordem é a mesma da tela inicial, de propósito: o cliente encontra
 * as ferramentas na mesma sequência nos dois lugares.
 */
const ORDEM: Modulo[] = [
  'treinamentos',
  'certificados',
  'documentos',
  'epi',
  'inspecoes',
  'implantacao',
  'auditoria',
]

export default function ContratarPage() {
  const modulos = useModulos()
  const [marca, setMarca] = useState<Marca>('reallife')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregandoPedidos, setCarregandoPedidos] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const marcaEmpresa = (await obterMarcaDaEmpresa().catch(() => null)) || marcaDoDominio()
        if (ativo) setMarca(marcaEmpresa)

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: perfil } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).maybeSingle()
        if (!perfil?.empresa_id) return

        const { data } = await supabase
          .from('chamados')
          .select('id, numero, assunto, status, created_at')
          .eq('empresa_id', perfil.empresa_id)
          /* Valores entre aspas: o assunto tem espaço e dois-pontos. */
          .or('assunto.ilike."' + PREFIXO_CONTRATACAO + '*",assunto.ilike."' + PREFIXO_ORCAMENTO + '*"')
          .order('created_at', { ascending: false })
          .limit(20)

        if (ativo) setPedidos((data || []) as Pedido[])
      } catch (e) {
        console.error('Erro ao carregar os pedidos de contratação:', e)
      } finally {
        if (ativo) setCarregandoPedidos(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  const servicos = SERVICOS.filter((s) => s.marcas.includes(marca))

  return (
    <main className="app">
      <div className="contratar">
        <div>
          <div className="section-title">Sua empresa</div>
          <h1 style={{ fontSize: 'clamp(24px, 3.2vw, 30px)', marginTop: 6 }}>Contratar e pedir orçamento</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', fontSize: 15 }}>
            Escolha o que precisa. O pedido vira um chamado e a proposta chega pelo próprio portal.
          </p>
        </div>

        <section>
          <div className="section-title" style={{ marginBottom: 10 }}>Ferramentas do portal</div>
          <div className="contratar-grade">
            {ORDEM.map((m) => {
              const info = MODULOS[m]
              const contratado = !modulos.carregando && modulos.liberado(m)

              return (
                <div key={m} className={'mod-card' + (contratado || modulos.carregando ? '' : ' bloqueado')}>
                  <div className="mod-topo">
                    <span className="mod-icone">
                      <Icone nome={m} tamanho={24} />
                    </span>
                    {!modulos.carregando &&
                      (contratado ? (
                        <span className="mod-selo">Contratado</span>
                      ) : (
                        <span className="mod-cadeado">
                          <Icone nome="cadeado" tamanho={18} rotulo="Não contratado" />
                        </span>
                      ))}
                  </div>
                  <h3>{info.rotulo}</h3>
                  <p>{info.resumo}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {contratado ? (
                      <Link href={info.href} className="btn btn-sm">
                        Abrir
                      </Link>
                    ) : (
                      <>
                        <a href={linkContratacao(m)} className="btn btn-sm btn-primary">
                          Pedir orçamento
                        </a>
                        <Link href={info.href} className="btn btn-sm btn-ghost">
                          Conhecer
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/*
          * OS CURSOS GANHARAM SEÇÃO PRÓPRIA.
          *
          * Eram uma linha no meio dos serviços — "Cursos EAD para a
          * equipe", e quem procurava NR-33 não achava NR-33. São 36
          * cursos com carga e preço, e é isso que o cliente compara
          * antes de perguntar quanto custa.
          */}
        <section>
          <div className="section-title" style={{ marginBottom: 10 }}>Cursos EAD</div>
          <CursosEad />
        </section>

        <section>
          <div className="section-title" style={{ marginBottom: 10 }}>Outros serviços</div>
          <div className="panel contratar-lista">
            {servicos.map((s) => (
              <div key={s.titulo} className="contratar-item">
                <span className="icone-servico">
                  <Icone nome={s.icone} tamanho={24} />
                </span>
                <span className="texto">
                  <strong>{s.titulo}</strong>
                  <span>{s.texto}</span>
                </span>
                <a href={linkOrcamento(s)} className="btn btn-sm btn-primary">
                  Pedir orçamento
                </a>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title" style={{ marginBottom: 10 }}>Seus pedidos</div>
          <div className="panel contratar-lista">
            {carregandoPedidos ? (
              <div className="empty-state">Carregando...</div>
            ) : pedidos.length === 0 ? (
              <div className="empty-state">Nenhum pedido de orçamento ou contratação ainda.</div>
            ) : (
              pedidos.map((p) => (
                <Link key={p.id} href={'/chamados/' + p.id} className="contratar-item">
                  <span className="texto">
                    <strong>
                      {p.assunto.replace(PREFIXO_CONTRATACAO, '').replace(PREFIXO_ORCAMENTO, '')}
                    </strong>
                    <span>
                      Chamado #{p.numero} · pedido em {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </span>
                  <span className={'pill ' + (CLASSE_SITUACAO[p.status] || 'flat')}>
                    {ROTULO_SITUACAO[p.status] || p.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
