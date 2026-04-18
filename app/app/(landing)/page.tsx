'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Lock, Sparkles, Search, Github } from 'lucide-react'

/**
 * EchoVault landing — modern product page.
 *
 * Hero + feature grid + CTA. Quiet gradient, clean typography, Vercel-like.
 */
export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/journal')
    }
  }, [user, loading, router])

  if (loading || user) return null

  return (
    <div className="relative min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background">
              <span className="text-[10px] font-bold">EV</span>
            </span>
            <span>EchoVault</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Subtle gradient */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-primary/[0.04] via-background to-background"
        aria-hidden="true"
      />

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 text-center md:pt-28">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          Private-first. Free and open source.
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          A private journal that{' '}
          <span className="text-primary">remembers you.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          Write freely, search by meaning, and reflect with an AI that runs on
          your own machine. Your thoughts never leave your control.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Get started — it&apos;s free</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            icon={Lock}
            title="Private by default"
            description="Local LLMs via Ollama, local embeddings, local vector search. Or bring your own cloud keys."
          />
          <FeatureCard
            icon={Search}
            title="Semantic memory"
            description="Search finds entries by meaning, not keywords. Time-decay ranking surfaces what matters now."
          />
          <FeatureCard
            icon={Sparkles}
            title="Reflective insights"
            description="Weekly AI reflections surface patterns you haven't noticed. Quiet, never pushy."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-border/60 bg-card px-8 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Start writing today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Create a free account. Your journal, your data, your pace.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href="/register">Create your account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} EchoVault. Open source.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <a
              href="https://github.com/akumar23/Echo-Vault"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-6">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
