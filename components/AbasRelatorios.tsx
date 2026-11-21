'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import './abas-relatorios.css'

/*
 * As duas faces de "Relatórios", numa barra só.
 *
 * POR QUE JUNTAR. No menu havia "Relatórios emitidos" e "Relatório do
 * período", duas linhas quase com a mesma palavra, e quem procurava
 * um relatório tinha de adivinhar qual das duas era a sua. São o mesmo
 * assunto — o que eu entrego — vistos de dois jeitos: o arquivo do que
 * já saiu, e o documento novo que junta um período inteiro.
 *
 * A barra some na impressão: no papel não existe navegação.
 */
const ABAS = [
  { href: '/inspecoes/relatorios', rotulo: 'Emitidos' },
  { href: '/inspecoes/relatorio', rotulo: 'Do período' },
]

export default function AbasRelatorios() {
  const pathname = usePathname()

  return (
    <nav className="abas-relatorios nao-imprimir" aria-label="Tipos de relatório">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={ativa ? 'ativa' : ''}
            aria-current={ativa ? 'page' : undefined}
          >
            {aba.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
