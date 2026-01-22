'use client'

import Link from 'next/link'
import { ArrowRight, Download, Play } from 'lucide-react'

export function CTA() {
  return (
    <section className="cta-section">
      <div className="cta-card">
        <h2 className="cta-card__title">
          Start journaling with AI that respects your privacy and actually understands you.
        </h2>
        <p className="cta-card__tagline">
          No cloud. No fluff. Just insight.
        </p>

        <div className="cta-card__actions">
          <a
            href="https://github.com/yourusername/echovault/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-cta"
          >
            <Download size={18} />
            Download EchoVault
          </a>
          <Link href="/demo" className="btn btn-secondary">
            <Play size={18} />
            See Live Demo
          </Link>
          <Link href="/register" className="btn btn-secondary">
            Get Started
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}
