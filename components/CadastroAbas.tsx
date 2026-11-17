'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/*
 * Navegação dos cadastros da empresa. As pessoas são o uso do dia a dia;
 * os locais de trabalho são cadastrados uma vez, quando abre a obra, e
 * revistos de vez em quando — por isso ficam a um clique, não na frente.
 */

const PAGINAS = [
  { href: '/colaboradores', rotulo: 'Pessoas' },
  { href: '/colaboradores/locais', rotulo: 'Locais de trabalho' },
]

export default function CadastroAbas() {
  const pathname = usePathname()

  return (
    <nav className="modtabs" aria-label="Seções dos cadastros">
      {PAGINAS.map((p) => (
        <Link key={p.href} href={p.href} className={pathname === p.href ? 'active' : ''}>
          {p.rotulo}
        </Link>
      ))}
    </nav>
  )
}
