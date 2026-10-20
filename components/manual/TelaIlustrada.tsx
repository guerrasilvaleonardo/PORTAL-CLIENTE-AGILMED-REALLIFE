'use client'

import type { Bloco, Tela, Tom } from '@/lib/manual/tipos'

/*
 * Desenha a "tela" de um slide do manual: uma janela de navegador
 * com blocos que imitam os componentes do portal. Dados fictícios.
 * O número em `n` vira um marcador redondo, igual ao do passo.
 */

function Marcador({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="mn-marca" aria-label={'Passo ' + n}>
      {n}
    </span>
  )
}

function classeTom(tom?: Tom) {
  return tom ? 'mn-tom-' + tom : ''
}

function BlocoIlustrado({ b }: { b: Bloco }) {
  const conteudo = (() => {
    switch (b.t) {
      case 'menu':
        return (
          <div className="mn-menu">
            <span className="mn-logo" />
            <div className="mn-abas">
              {b.itens.map((i) => (
                <span key={i} className={i === b.ativo ? 'ativo' : ''}>
                  {i}
                </span>
              ))}
            </div>
            <span className="mn-ajuda">?</span>
            <span className="mn-sair">Sair</span>
          </div>
        )
      case 'topo':
        return (
          <div className="mn-topo">
            <div>
              {b.sobre && <div className="mn-sobre">{b.sobre}</div>}
              <div className="mn-titulo">{b.titulo}</div>
              {b.sub && <div className="mn-sub">{b.sub}</div>}
            </div>
            {b.botoes && (
              <div className="mn-botoes">
                {b.botoes.map((x, i) => (
                  <span key={x} className={'mn-btn' + (i === b.botoes!.length - 1 ? ' prim' : '')}>
                    {x}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      case 'stats':
        return (
          <div className="mn-stats">
            {b.itens.map((s) => (
              <div key={s.rotulo} className={'mn-stat ' + classeTom(s.tom)}>
                <strong>{s.valor}</strong>
                <span>{s.rotulo}</span>
              </div>
            ))}
          </div>
        )
      case 'campos':
        return (
          <div className="mn-campos">
            {b.itens.map((c) => (
              <div key={c.rotulo} className={'mn-campo' + (c.largo ? ' largo' : '')}>
                <label>
                  {c.rotulo}
                  {c.obrigatorio ? ' *' : ''}
                </label>
                <div className="mn-input">{c.valor || ''}</div>
              </div>
            ))}
          </div>
        )
      case 'botoes':
        return (
          <div className="mn-botoes">
            {b.itens.map((x) => (
              <span key={x.rotulo} className={'mn-btn' + (x.primario ? ' prim' : '')}>
                {x.rotulo}
              </span>
            ))}
          </div>
        )
      case 'opcoes':
        return (
          <div className="mn-opcoes">
            {b.itens.map((o) => (
              <div key={o.rotulo} className={'mn-opcao' + (o.ativo ? ' ativo' : '')}>
                <strong>{o.rotulo}</strong>
                {o.desc && <span>{o.desc}</span>}
              </div>
            ))}
          </div>
        )
      case 'tabela':
        return (
          <div className="mn-tabela">
            <div className="mn-tr cab" style={{ gridTemplateColumns: 'repeat(' + b.colunas.length + ', 1fr)' }}>
              {b.colunas.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {b.linhas.map((l, i) => (
              <div key={i} className="mn-tr" style={{ gridTemplateColumns: 'repeat(' + b.colunas.length + ', 1fr)' }}>
                {l.map((c, j) => (
                  <span key={j} className={b.pilulas === j ? 'mn-pilula' : ''}>
                    {c}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )
      case 'kanban':
        return (
          <div className="mn-kanban">
            {b.colunas.map((c) => (
              <div key={c.titulo} className="mn-col">
                <div className="mn-col-tit">{c.titulo}</div>
                {c.cartoes.map((x, i) => (
                  <div key={i} className={'mn-cartao ' + classeTom(x.tom)}>
                    {x.texto}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      case 'chat':
        return (
          <div className="mn-chat">
            {b.msgs.map((m, i) => (
              <div key={i} className={'mn-msg' + (m.eu ? ' eu' : '')}>
                <div className="mn-msg-autor">
                  {m.autor}
                  {m.etiqueta && <em>{m.etiqueta}</em>}
                </div>
                <div>{m.texto}</div>
              </div>
            ))}
          </div>
        )
      case 'aviso':
        return <div className={'mn-aviso ' + classeTom(b.tom || 'marca')}>{b.texto}</div>
      case 'texto':
        return <div className="mn-texto">{b.texto}</div>
      case 'barra':
        return (
          <div className="mn-barra">
            <span>{b.rotulo}</span>
            <div>
              <i style={{ width: b.pct + '%' }} />
            </div>
          </div>
        )
      case 'checklist':
        return (
          <div className="mn-check">
            {b.itens.map((x) => (
              <div key={x.texto} className={x.feito ? 'feito' : ''}>
                <span>{x.feito ? '✓' : ''}</span>
                {x.texto}
              </div>
            ))}
          </div>
        )
      case 'agenda':
        return (
          <div className="mn-agenda">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((d, i) => (
              <div key={d} className={'mn-dia' + (i === 2 ? ' feriado' : '')}>
                <div className="mn-dia-tit">{i === 2 ? d + ' · Feriado' : d}</div>
                {i !== 2 && <div className="mn-bloco" style={{ marginTop: 6 + i * 8 }} />}
                {i === 1 && <div className="mn-etiqueta-prazo">⏱ #123</div>}
              </div>
            ))}
          </div>
        )
      case 'grafico':
        return (
          <div className="mn-grafico" aria-hidden="true">
            {[60, 85, 40, 70, 95, 55].map((h, i) => (
              <i key={i} style={{ height: h + '%' }} />
            ))}
          </div>
        )
      case 'cartoes':
        return (
          <div className="mn-cartoes">
            {b.itens.map((c) => (
              <div key={c.titulo}>
                <strong>{c.titulo}</strong>
                <span>{c.texto}</span>
              </div>
            ))}
          </div>
        )
      case 'duas':
        return (
          <div className="mn-duas">
            <div>
              {b.esquerda.map((x, i) => (
                <BlocoIlustrado key={i} b={x} />
              ))}
            </div>
            <div>
              {b.direita.map((x, i) => (
                <BlocoIlustrado key={i} b={x} />
              ))}
            </div>
          </div>
        )
    }
  })()

  return (
    <div className={'mn-bloco-wrap' + (b.n ? ' destacado' : '')}>
      <Marcador n={b.n} />
      {conteudo}
    </div>
  )
}

export default function TelaIlustrada({ tela }: { tela: Tela }) {
  return (
    <div className="mn-janela" aria-label="Ilustração da tela, com dados fictícios">
      <div className="mn-barra-nav">
        <span className="mn-bolinhas">
          <i />
          <i />
          <i />
        </span>
        <span className="mn-url">Portal do Cliente{tela.url === '/' ? '' : ' › ' + tela.url}</span>
      </div>
      <div className="mn-pagina">
        {tela.blocos.map((b, i) => (
          <BlocoIlustrado key={i} b={b} />
        ))}
      </div>
    </div>
  )
}
