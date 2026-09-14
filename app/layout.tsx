import type { Metadata } from 'next'
import './globals.css'
import PortalHeader from '@/components/PortalHeader'

export const metadata: Metadata = {
  title: 'Portal do Cliente | ÁgilMed & Real Life',
  description:
    'Portal do Cliente ÁgilMed e Real Life para gestão de saúde ocupacional, segurança do trabalho, treinamentos e documentos.',
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
