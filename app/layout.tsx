import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import PortalHeader from '@/components/PortalHeader'

/*
 * Ícone da aba pelo endereço: cada cliente vê só a marca que o atende
 * (portal.reallifessma.com.br ou portal.agilmedocupacional.com.br), a
 * mesma regra de lib/marca.ts.
 */
export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host') || ''
  const agilmed = host.includes('agilmed')

  return {
    title: agilmed ? 'Portal do Cliente | ÁgilMed Ocupacional' : 'Portal do Cliente | Real Life SSMA',
    description:
      'Portal do Cliente ÁgilMed e Real Life para gestão de saúde ocupacional, segurança do trabalho, treinamentos e documentos.',
    icons: { icon: agilmed ? '/icone-agilmed.svg' : '/icone-reallife.svg' },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <PortalHeader />
        {children}
      </body>
    </html>
  )
}
