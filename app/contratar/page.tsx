'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { obterMarcaDaEmpresa } from '@/lib/empresa'
import { marcaDoDominio, type Marca } from '@/lib/marca'
import {
  DIAS_DE_TESTE,
  MODULOS,
  MODULOS_COM_TESTE,
  iniciarTeste,
  linkContratacao,
  useModulos,
  type Modulo,
} from '@/lib/modulos'
import { SERVICOS, linkOrcamento, PREFIXO_CONTRATACAO, PREFIXO_ORCAMENTO } from '@/lib/servicos'
import { ROTULO_SITUACAO } from '@/lib/situacoes'
import Icone from '@/components/Icone'
import CursosEad from '@/components/CursosEad'
import CatalogoServicos from '@/components/CatalogoServicos'
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

/* O que cada ferramenta com teste promete no cartão. */
const CHAMADA_DO_TESTE: Partial<Record<Modulo, { titulo: string; texto: string }>> = {
  epi: {
    titulo: 'Experimente com a sua equipe, por ' + DIAS_DE_TESTE + ' dias',
    texto:
      'Sem cartão e sem compromisso. No 8º dia a ferramenta fecha — e tudo o que você registrou continua aqui, para ver e imprimir.',
  },
  inspecoes: {
    titulo: 'Faça uma visita de verdade, por ' + DIAS_DE_TESTE + ' dias',
    texto:
      'Use um checklist nosso ou o seu. No 8º dia a ferramenta fecha — e o relatório da visita continua aqui.',
  },
}

export default function ContratarPage() {
  const modulos = useModulos()
  const [marca, setMarca] = useState<Marca>('reallife')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregandoPedidos, setCarregandoPedidos] = useState(true)
  const [ligando, setLigando] = useState<Modulo | null>(null)
  const [erroTeste, setErroTeste] = useState('')

  async function comecarTeste(m: Modulo) {
    if (ligando) return
    setErroTeste('')
    setLigando(m)
    const r = await iniciarTeste(m)
    setLigando(null)
    if (!r.ok) {
      setErroTeste(r.erro || 'Não foi possível começar o teste agora.')
      return
    }
    /* Recarrega para a ferramenta já aparecer aberta no menu. */
    window.location.href = MODULOS[m].href
  }

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

  /*
   * "Laudos e programas" continua em lib/servicos.ts, mas sai desta lista:
   * a seção do catálogo, logo acima, mostra cada laudo e programa do site
   * um a um. Se o site estiver fora, o catálogo mostra a linha genérica.
   */
  const servicos = SERVICOS.filter((s) => s.marcas.includes(marca) && s.titulo !== 'Laudos e programas')

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
          {erroTeste && <div className="banner bad" style={{ marginBottom: 10 }}>{erroTeste}</div>}
          <div className="contratar-grade">
            {ORDEM.map((m) => {
              const info = MODULOS[m]
              /* `contratado` é contrato mesmo — o teste não conta aqui. */
              const contratado = !modulos.carregando && modulos.contratado(m)
              const teste = modulos.teste(m)
              const podeTestar =
                !modulos.carregando && !contratado && MODULOS_COM_TESTE.includes(m) && teste.estado === 'nenhum'
              const emTeste = teste.estado === 'andamento'
              const testeAcabou = !contratado && teste.estado === 'encerrado'
              const chamada = CHAMADA_DO_TESTE[m]

              return (
                <div
                  key={m}
                  className={
                    'mod-card' +
                    (contratado || emTeste || modulos.carregando ? '' : ' bloqueado') +
                    (podeTestar || emTeste ? ' com-teste' : '')
                  }
                >
                  <div className="mod-topo">
                    <span className="mod-icone">
                      <Icone nome={m} tamanho={24} />
                    </span>
                    {!modulos.carregando &&
                      (contratado ? (
                        <span className="mod-selo">Contratado</span>
                      ) : emTeste ? (
                        <span className="mod-selo selo-teste">
                          {teste.diasRestantes === 0
                            ? 'Teste acaba hoje'
                            : teste.diasRestantes === 1
                              ? 'Teste · falta 1 dia'
                              : 'Teste · faltam ' + teste.diasRestantes + ' dias'}
                        </span>
                      ) : podeTestar ? (
                        <span className="mod-selo selo-teste">{DIAS_DE_TESTE} dias grátis</span>
                      ) : (
                        <span className="mod-cadeado">
                          <Icone nome="cadeado" tamanho={18} rotulo="Não contratado" />
                        </span>
                      ))}
                  </div>
                  <h3>{info.rotulo}</h3>
                  <p>{info.resumo}</p>

                  {/* O convite do teste, com o que acontece no 8º dia dito
                      antes do 8º dia: teste sem relógio parece armadilha. */}
                  {podeTestar && chamada && (
                    <div className="mod-convite">
                      <strong>{chamada.titulo}</strong>
                      <span>{chamada.texto}</span>
                    </div>
                  )}

                  {testeAcabou && (
                    <div className="mod-convite">
                      <strong>Seu teste terminou</strong>
                      <span>
                        O que você registrou continua aqui para ver e imprimir. Para voltar a
                        registrar, é só contratar.
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {contratado || emTeste ? (
                      <Link href={info.href} className="btn btn-sm">
                        Abrir
                      </Link>
                    ) : podeTestar ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => comecarTeste(m)}
                          disabled={ligando === m}
                        >
                          {ligando === m ? 'Abrindo…' : 'Começar o teste'}
                        </button>
                        <Link href={info.href} className="btn btn-sm btn-ghost">
                          Conhecer
                        </Link>
                      </>
                    ) : (
                      <>
                        <a href={linkContratacao(m)} className="btn btn-sm btn-primary">
                          Pedir orçamento
                        </a>
                        <Link href={info.href} className="btn btn-sm btn-ghost">
                          {testeAcabou ? 'Ver meus registros' : 'Conhecer'}
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

        {/*
          * LAUDOS, PROGRAMAS E SERVIÇOS DO SITE, um a um, lidos do site
          * (uma fonte só), cruzados com o que a empresa já tem em
          * Documentos SST.
          */}
        <section>
          <div className="section-title" style={{ marginBottom: 10 }}>Laudos, programas e serviços técnicos</div>
          <CatalogoServicos />
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
