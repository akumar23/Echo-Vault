'use client'

import Link from 'next/link'
import { Shield, Eye, Server, Trash2, Lock } from 'lucide-react'

const trustSignals = [
  {
    icon: Eye,
    title: 'No tracking or analytics',
    description: 'Zero telemetry, no cookies, no fingerprinting. We literally cannot see what you write.',
  },
  {
    icon: Server,
    title: 'All AI runs locally',
    description: 'Ollama powers your AI on your machine. Your thoughts never leave your device.',
  },
  {
    icon: Lock,
    title: 'Self-hosted by design',
    description: "You control the database, the server, everything. There's no cloud to breach.",
  },
  {
    icon: Trash2,
    title: 'True deletion',
    description: "When you delete, it's gone. No soft deletes lurking in backups. Real erasure.",
  },
]

export function Privacy() {
  return (
    <section className="privacy-section" id="privacy">
      <div className="privacy-section__header">
        <div className="privacy-section__icon">
          <Shield size={48} />
        </div>

        <h2 className="privacy-section__title">Your privacy is non-negotiable</h2>

        <p className="privacy-section__description">
          EchoVault is local-first by design. We don&apos;t collect your entries, track your usage,
          or analyze your life behind your back. You own your journal. You own your AI setup.
          We just give you the tools to make it powerful.
        </p>
      </div>

      <div className="privacy-section__signals">
        {trustSignals.map((signal) => (
          <div key={signal.title} className="trust-signal">
            <div className="trust-signal__icon">
              <signal.icon size={20} />
            </div>
            <div className="trust-signal__content">
              <h3 className="trust-signal__title">{signal.title}</h3>
              <p className="trust-signal__description">{signal.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="privacy-section__footer">
        <p className="privacy-section__emphasis">
          Everything stays where you want it—on your machine, your server, or your terms.
        </p>
        <Link href="/privacy" className="privacy-section__link">
          Read our Privacy Policy
        </Link>
      </div>
    </section>
  )
}
