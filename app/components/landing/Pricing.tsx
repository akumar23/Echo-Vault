'use client'

import Link from 'next/link'
import { Check, Github, Sparkles } from 'lucide-react'

const features = [
  'Unlimited journal entries',
  'Local AI via Ollama',
  'Semantic search',
  'Mood tracking & insights',
  'AI reflections & chat',
  'True data deletion',
  'Self-hosted control',
  'No ads, ever',
]

export function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="pricing__header">
        <h2 className="pricing__title">Free. Forever. No catch.</h2>
        <p className="pricing__subtitle">
          EchoVault is open source and self-hosted. You own your data,
          your AI, and your journal. No subscriptions, no premium tiers.
        </p>
      </div>

      <div className="pricing__card">
        <div className="pricing__card-header">
          <span className="pricing__badge">Open Source</span>
          <div className="pricing__price">
            <span className="pricing__price-amount">$0</span>
            <span className="pricing__price-period">forever</span>
          </div>
          <p className="pricing__card-description">
            Everything you need for private, AI-powered journaling.
          </p>
        </div>

        <ul className="pricing__features">
          {features.map((feature) => (
            <li key={feature} className="pricing__feature">
              <Check size={18} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="pricing__actions">
          <Link href="/register" className="btn btn-cta">
            <Sparkles size={18} />
            Get Started
          </Link>
          <Link
            href="https://github.com/aryankumar/echo-vault"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <Github size={18} />
            View on GitHub
          </Link>
        </div>
      </div>
    </section>
  )
}
