import type { Metadata } from 'next'

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
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
