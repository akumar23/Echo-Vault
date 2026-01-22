'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export function Hero() {
  return (
    <section className="hero">
      <h1 className="hero__title">
        Your Thoughts, Understood.
        <span className="hero__title-accent"> Privately.</span>
      </h1>

      <p className="hero__subtitle">
        EchoVault is a private, AI-powered journaling platform that analyzes your writing,
        tracks your mood, and reflects back meaningful insights—without sending your data to the cloud.
      </p>

      <p className="hero__tagline">
        Start journaling with AI that remembers, respects, and reflects.
      </p>

      <div className="hero__actions">
        <Link href="/register" className="btn btn-cta">
          <Sparkles size={18} />
          Start Journaling
        </Link>
        <Link href="#how-it-works" className="btn btn-secondary">
          See How It Works
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  )
}
