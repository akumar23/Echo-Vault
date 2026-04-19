import { Fraunces } from 'next/font/google'
import { GeistMono } from 'geist/font/mono'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className={`${fraunces.variable} ${GeistMono.variable}`}>
      {children}
    </main>
  )
}
