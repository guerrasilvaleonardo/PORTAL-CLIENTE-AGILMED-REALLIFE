'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/*
 * Navegação interna do módulo de EPI, em coluna à esquerda (como no
 * OnSafety). A coluna e o comportamento em celular ficam em
 * app/epi/menu.css; o lugar dela na tela, em app/epi/layout.tsx.
 *
 * A primeira entrada leva às entregas, que é o uso do dia a dia; os
 * equipamentos ficam a um clique, porque são cadastrados uma vez e
 * revistos de vez em quando.
 */

const PAGINAS = [
  { href: '/epi', rotulo: 'Entregas' },
  { href: '/epi/ficha', rotulo: 'Ficha' },
  { href: '/epi/equipamentos', rotulo: "Configuração de EPI's" },
  { href: '/epi/funcoes', rotulo: 'EPI por função' },
  { href: '/epi/painel', rotulo: 'Painel' },
]

export default function EpiAbas() {
  const pathname = usePathname()

  return (
    <nav className="modtabs vertical" aria-label="Seções do módulo de EPI">
      {PAGINAS.map((p) => (
        <Link key={p.href} href={p.href} className={pathname === p.href ? 'active' : ''}>
          {p.rotulo}
        </Link>
      ))}
    </nav>
  )
}
