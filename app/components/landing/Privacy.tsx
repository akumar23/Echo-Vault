'use client'

import Link from 'next/link'
import { Shield, Eye, Server, Trash2, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, useMotion } from '@/components/motion'

const trustSignals = [
  {
    icon: Eye,
    title: 'No tracking or analytics',
    description: 'Zero telemetry, no cookies, no fingerprinting. We literally cannot see what you write.',
  },
  {
    icon: Server,
    title: 'Flexible AI deployment',
    description: 'Use cloud LLM APIs out of the box, or self-host with Ollama for full local inference.',
  },
  {
    icon: Lock,
    title: 'Your data, your control',
    description: 'JWT auth, encrypted storage, and full export capabilities. Self-host for maximum privacy.',
  },
  {
    icon: Trash2,
    title: 'True deletion',
    description: "When you delete, it's gone. No soft deletes lurking in backups. Real erasure.",
  },
]

export function Privacy() {
  const { reducedMotion } = useMotion()

  return (
    <section className="privacy-section-new" id="privacy">
      <FadeIn>
        <div className="privacy-section-new__header">
          <motion.div
            className="privacy-section-new__icon"
            whileHover={{ scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Shield size={48} />
          </motion.div>

          <h2 className="privacy-section-new__title">Your privacy is non-negotiable</h2>

          <p className="privacy-section-new__description">
            EchoVault is privacy-first by design. We don&apos;t collect your entries, track your usage,
            or analyze your life behind your back. Choose cloud APIs for convenience or self-host
            for complete control—either way, your journal stays yours.
          </p>
        </div>
      </FadeIn>

      <StaggerContainer className="privacy-section-new__signals" staggerDelay={0.08} delayChildren={0.1}>
        {trustSignals.map((signal) => (
          <StaggerItem key={signal.title}>
            <motion.div
              className="trust-signal-new"
              whileHover={reducedMotion ? {} : { y: -4, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <motion.div
                className="trust-signal-new__icon"
                whileHover={{ rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <signal.icon size={20} />
              </motion.div>
              <div className="trust-signal-new__content">
                <h3 className="trust-signal-new__title">{signal.title}</h3>
                <p className="trust-signal-new__description">{signal.description}</p>
              </div>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <FadeIn delay={0.3}>
        <div className="privacy-section-new__footer">
          <p className="privacy-section-new__emphasis">
            Everything stays where you want it—on your machine, your server, or your terms.
          </p>
          <Link href="/privacy" className="privacy-section-new__link">
            Read our Privacy Policy →
          </Link>
        </div>
      </FadeIn>

      <style jsx global>{`
        .privacy-section-new {
          padding: var(--space-10) 0;
        }

        .privacy-section-new__header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .privacy-section-new__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-full);
          margin-bottom: var(--space-5);
        }

        .privacy-section-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-4);
        }

        .privacy-section-new__description {
          color: var(--text-muted);
          font-size: var(--text-lg);
          max-width: 650px;
          margin: 0 auto;
          line-height: 1.7;
        }

        .privacy-section-new__signals {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-5);
          max-width: 800px;
          margin: 0 auto var(--space-8);
        }

        .trust-signal-new {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur-light);
          -webkit-backdrop-filter: var(--glass-blur-light);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          transition: box-shadow 0.2s ease;
        }

        .trust-signal-new:hover {
          box-shadow: var(--shadow-md);
        }

        .trust-signal-new__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .trust-signal-new__content {
          flex: 1;
        }

        .trust-signal-new__title {
          font-size: var(--text-base);
          font-weight: 600;
          margin-bottom: var(--space-1);
        }

        .trust-signal-new__description {
          font-size: var(--text-sm);
          color: var(--text-muted);
          line-height: 1.5;
        }

        .privacy-section-new__footer {
          text-align: center;
        }

        .privacy-section-new__emphasis {
          color: var(--text-primary);
          font-size: var(--text-base);
          font-weight: 500;
          margin-bottom: var(--space-3);
        }

        .privacy-section-new__link {
          display: inline-block;
          font-size: var(--text-sm);
          color: var(--accent);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .privacy-section-new__link:hover {
          color: var(--accent-dim);
        }

        @media (max-width: 768px) {
          .privacy-section-new__signals {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
