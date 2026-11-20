import type { ReactNode } from 'react'
import EpiAbas from '@/components/EpiAbas'
import './menu.css'

/*
 * O módulo de EPI tem menu em coluna, à esquerda, como no OnSafety.
 *
 * POR QUE AQUI E NÃO EM CADA TELA. O menu é o mesmo nas cinco telas e
 * precisa ficar FORA do conteúdo para a coluna existir. Num layout ele é
 * montado uma vez e não recarrega ao trocar de tela.
 *
 * Em tela estreita (celular) a coluna vira a faixa de botões de antes —
 * menu lateral em 360px de largura come metade da tela.
 *
 * Na impressão o menu some: a ficha de EPI é documento.
 */
export default function LayoutEpi({ children }: { children: ReactNode }) {
  return (
    <div className="epi-area">
      <aside className="epi-menu nao-imprimir">
        <EpiAbas />
      </aside>
      <div className="epi-conteudo">{children}</div>
    </div>
  )
}
