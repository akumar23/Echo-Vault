import type { Metadata } from 'next'
import { Instrument_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ThemeProvider } from '@/contexts/ThemeContext'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: {
    default: 'EchoVault - Privacy-First AI Journal',
    template: '%s | EchoVault',
  },
  description:
    'A privacy-first journal that understands you. Write freely, search semantically, and reflect with AI—all running locally on your device. Free and open source.',
  keywords: [
    'journal',
    'diary',
    'privacy',
    'local AI',
    'Ollama',
    'self-hosted',
    'open source',
    'mental health',
    'reflection',
    'semantic search',
  ],
  authors: [{ name: 'Aryan Kumar' }],
  creator: 'Aryan Kumar',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://echovault.app',
    siteName: 'EchoVault',
    title: 'EchoVault - Privacy-First AI Journal',
    description:
      'A privacy-first journal that understands you. Write freely, search semantically, and reflect with AI—all running locally on your device.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'EchoVault - Privacy-First AI Journal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EchoVault - Privacy-First AI Journal',
    description:
      'A privacy-first journal that understands you. Write freely, search semantically, and reflect with AI—all running locally.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://echovault.app'
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={instrumentSans.className}>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
