import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'
import { Providers } from './providers'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { CommandPalette } from '@/components/CommandPalette'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

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
    url: 'https://echo-vault-one.vercel.app',
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
    process.env.NEXT_PUBLIC_APP_URL || 'https://echo-vault-one.vercel.app'
  ),
}

/**
 * Runs before hydration so `data-theme` is set on <html> on the first paint.
 * Without this, the CSS falls back to the light-theme palette until React
 * mounts and the ThemeProvider can set the attribute — producing a brief
 * light-theme flash for system-dark users.
 *
 * Kept tiny and wrapped in try/catch so a storage exception (private-mode
 * Safari, disabled cookies, etc.) never blocks paint.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var r=(t==='light'||t==='dark')?t:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={GeistSans.variable}
    >
      <body className="font-sans antialiased">
        {/* Blocking inline script — runs before React renders any
            content below, so `data-theme` is set on the first paint.
            Must stay at the top of <body> to beat the body content. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <Providers>
            {children}
            <CommandPalette />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
