'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Shield, Cpu, Search } from 'lucide-react'

export function Hero() {
  return (
    <section className="hero">
      <div className="hero__badge">
        <Shield size={14} />
        <span>100% Local AI - Your data never leaves your device</span>
      </div>

      <h1 className="hero__title">
        Your voice holds your story.
        <span className="hero__title-accent"> EchoVault helps you remember it.</span>
      </h1>

      <p className="hero__subtitle">
        A privacy-first journal that understands you. Write freely, search semantically,
        and reflect with AI—all running locally on your device. Free and open source.
      </p>

      <div className="hero__features">
        <div className="hero__feature">
          <Cpu size={16} />
          <span>Local LLM via Ollama</span>
        </div>
        <div className="hero__feature">
          <Search size={16} />
          <span>Semantic search</span>
        </div>
        <div className="hero__feature">
          <Shield size={16} />
          <span>Zero cloud storage</span>
        </div>
      </div>

      <div className="hero__actions">
        <Link href="/register" className="btn btn-cta">
          <Sparkles size={18} />
          Start Journaling Free
        </Link>
        <Link href="#how-it-works" className="btn btn-secondary">
          See How It Works
          <ArrowRight size={18} />
        </Link>
      </div>

      <div className="hero__preview">
        <div className="hero__preview-window">
          <div className="hero__preview-header">
            <div className="hero__preview-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="hero__preview-title">EchoVault</span>
          </div>
          <Image
            src="/screenshots/dashboard.png"
            alt="EchoVault dashboard showing journal entries and mood tracking"
            width={900}
            height={600}
            className="hero__preview-image"
            priority
          />
        </div>
      </div>
    </section>
  )
}
