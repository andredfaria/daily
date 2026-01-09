import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Daily Status - Gestão Inteligente via WhatsApp',
  description: 'Automatize seus dailies, acompanhe métricas de equipe e gerencie status report diretamente pelo WhatsApp. Teste grátis por 7 dias.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'Daily Status - Gestão Inteligente via WhatsApp',
    description: 'Automatize seus dailies e acompanhe métricas de equipe diretamente pelo WhatsApp.',
    siteName: 'Daily Status',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-slate-950 text-slate-50 min-h-screen`}>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
