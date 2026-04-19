'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowRight, Lock } from 'lucide-react'

const serif = 'font-[family-name:var(--font-fraunces)]'
const mono = 'font-[family-name:var(--font-geist-mono)]'

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
    <div
      className={`relative min-h-screen overflow-hidden bg-[#0A0A0A] text-[#FAFAFA] ${serif}`}
    >
      {/* Dot grid — purely decorative, sits behind all content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Ambient glow — warms the upper-left without feeling Vercel-generic */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full opacity-[0.22] blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(224,122,90,0.55) 0%, rgba(224,122,90,0) 70%)',
        }}
      />

      {/* Nav */}
      <header className="relative z-10 border-b border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10 sm:py-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E07A5A]" />
            <span className="text-xl font-medium tracking-tight sm:text-2xl">
              EchoVault
            </span>
          </Link>
          <Link
            href="/register"
            className={`inline-flex items-center gap-2 rounded-md bg-[#FAFAFA] px-4 py-2.5 text-sm text-[#0A0A0A] transition-opacity hover:opacity-90 sm:px-6 sm:py-3 ${mono}`}
          >
            <span>Start writing</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-10 pb-16 sm:px-10 sm:pt-14 sm:pb-20">
        <h1 className="font-normal leading-[1.04] tracking-tight text-[clamp(3rem,11vw,9rem)]">
          <span className="block">A journal</span>
          <span className="block">
            that <span className="italic">actually</span>
          </span>
          <span className="block">
            <em className="italic text-[#E07A5A]">remembers</em> you.
          </span>
        </h1>

        <div className="mt-10 mb-8 h-px w-24 bg-[#FAFAFA]" />

        <p className="max-w-[34rem] text-lg leading-relaxed text-[#D4D4D4] sm:text-xl md:text-[1.375rem] md:leading-[1.55]">
          Your past,{' '}
          <strong className="font-semibold text-[#FAFAFA]">
            searchable by meaning
          </strong>
          . Your AI,{' '}
          <strong className="font-semibold text-[#FAFAFA]">
            grounded in your own words
          </strong>
          . Your model, your choice.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-6 sm:gap-8">
          <Link
            href="/register"
            className={`group inline-flex items-center gap-4 rounded-[4px] bg-[#E07A5A] px-6 py-4 text-sm uppercase tracking-[0.12em] text-[#0A0A0A] shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_30px_-10px_rgba(224,122,90,0.55)] transition-transform hover:-translate-y-px sm:px-8 sm:py-5 sm:text-[0.9375rem] ${mono}`}
          >
            <span>Get started — it&apos;s free</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/docs"
            className={`group inline-flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-[#FAFAFA] ${mono}`}
          >
            <span>Read the docs</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* Feature strip */}
      <div className="relative z-10 border-t border-b border-white/[0.08]">
        <div
          className={`mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5 text-[11px] uppercase tracking-[0.18em] text-[#A3A3A3] sm:px-10 sm:text-xs ${mono}`}
        >
          <FeatureTag icon={Lock} label="Local LLMs" />
          <Dot />
          <span>MIT Licensed</span>
        </div>
      </div>

      {/* Product preview */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-10 sm:px-10 sm:pt-20">
        <EntryMock />
      </section>

      {/* Search command bar mock */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 sm:px-10 sm:pb-28">
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-white/[0.08] bg-[#141414] px-5 py-4 text-sm text-[#D4D4D4] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_40px_-18px_rgba(0,0,0,0.8)] sm:px-6 ${mono}`}
        >
          <span
            aria-hidden
            className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-[#E07A5A]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#E07A5A]" />
          </span>
          <span className="text-[#E07A5A]">search:</span>
          <span>&ldquo;when did I feel at ease?&rdquo;</span>
          <span className={`italic opacity-75 ${serif}`}>
            4 entries found by meaning
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08]">
        <div
          className={`mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[11px] uppercase tracking-[0.18em] text-[#A3A3A3] sm:px-10 sm:text-xs ${mono}`}
        >
          <span>© {new Date().getFullYear()} EchoVault</span>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="transition-colors hover:text-[#FAFAFA]"
            >
              Sign in
            </Link>
            <Link
              href="/docs"
              className="transition-colors hover:text-[#FAFAFA]"
            >
              Docs
            </Link>
            <a
              href="https://github.com/akumar23/Echo-Vault"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#FAFAFA]"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Dot() {
  return (
    <span aria-hidden className="text-[#A3A3A3]/40">
      ·
    </span>
  )
}

function FeatureTag({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  )
}

function EntryMock() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#111111] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div
        className={`flex items-center justify-between border-b border-white/[0.06] bg-[#0E0E0E] px-5 py-3.5 text-[11px] text-[#A3A3A3] sm:text-xs ${mono}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <span className="hidden uppercase tracking-[0.15em] sm:inline">
          ~/vault/entries/2026-04-18
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#E07A5A]" />
          <span>Local · saved</span>
        </span>
      </div>

      <div className="px-6 py-8 sm:px-10 sm:py-10">
        <p
          className={`mb-4 text-[11px] uppercase tracking-[0.2em] text-[#A3A3A3] sm:text-xs ${mono}`}
        >
          Saturday · April 18, 2026 · 09:42
        </p>
        <h3 className="mb-6 text-2xl font-medium leading-tight tracking-tight text-[#FAFAFA] sm:text-3xl md:text-[2rem]">
          Something about the morning light today
        </h3>
        <div className="space-y-4 text-base leading-relaxed text-[#D4D4D4] sm:text-lg sm:leading-[1.7]">
          <p>
            Woke up earlier than usual. The kind of quiet where you can hear
            the fridge from two rooms away. I&apos;ve been thinking about what
            Marcus said last week — about how the work that feels like play is
            usually the work worth doing.
          </p>
          <p>
            Maybe that&apos;s why this week felt different. Not because
            anything changed, but because I stopped trying to make it change
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] animate-pulse bg-[#E07A5A]"
            />
          </p>
        </div>

        <div className="my-8 border-t border-dashed border-white/[0.12]" />

        <p
          className={`mb-4 text-[11px] uppercase tracking-[0.2em] text-[#E07A5A] sm:text-xs ${mono}`}
        >
          <span className="mr-[0.4em]">↳</span>4 Related memories · Surfaced by
          meaning
        </p>
        <ul className={`space-y-1.5 text-sm text-[#D4D4D4] ${mono}`}>
          <MemoryItem date="Mar 04" label={'"feeling like play"'} />
          <MemoryItem date="Feb 19" label="coffee w/ Marcus" />
          <MemoryItem date="Jan 27" label="early mornings" />
        </ul>
      </div>
    </div>
  )
}

function MemoryItem({ date, label }: { date: string; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-[#E07A5A]">◆</span>
      <span>
        {date} — {label}
      </span>
    </li>
  )
}
