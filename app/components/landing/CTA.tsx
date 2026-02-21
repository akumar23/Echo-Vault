'use client'

import Link from 'next/link'
import { ArrowRight, Download, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, GradientText, MorphingBlob, useMotion } from '@/components/motion'

export function CTA() {
  const { reducedMotion } = useMotion()

  return (
    <section className="cta-section-new">
      {/* Animated Background */}
      <div className="cta-section-new__bg">
        <MorphingBlob
          color1="#C94C2A"
          color2="#E07A5A"
          size={400}
          blur={80}
          delay={0}
          duration={20}
          className="cta-blob-1"
        />
        <MorphingBlob
          color1="#2D6A4F"
          color2="#52B788"
          size={350}
          blur={80}
          delay={1}
          duration={25}
          className="cta-blob-2"
        />
      </div>

      <FadeIn>
        <div className="cta-card-new">
          <h2 className="cta-card-new__title">
            Start journaling with AI that has{' '}
            <GradientText as="span" animated={!reducedMotion}>
              human-like memory of you.
            </GradientText>
          </h2>
          <p className="cta-card-new__tagline">
            Privacy-first. RAG-powered. Free and open source.
          </p>

          <div className="cta-card-new__actions">
            <motion.a
              href="https://github.com/yourusername/echovault/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-gradient"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download size={18} />
              Download EchoVault
            </motion.a>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/demo" className="btn btn-glass">
                <Play size={18} />
                See Live Demo
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/register" className="btn btn-glass">
                Get Started
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      <style jsx global>{`
        .cta-section-new {
          position: relative;
          padding: var(--space-10) 0;
          overflow: hidden;
        }

        .cta-section-new__bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .cta-section-new__bg :global(.cta-blob-1) {
          top: -100px;
          left: -100px;
        }

        .cta-section-new__bg :global(.cta-blob-2) {
          bottom: -100px;
          right: -100px;
        }

        .cta-card-new {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: var(--space-10) var(--space-6);
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          max-width: 800px;
          margin: 0 auto;
        }

        .cta-card-new__title {
          font-size: clamp(1.5rem, 4vw, 2.5rem);
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: var(--space-4);
        }

        .cta-card-new__tagline {
          font-size: var(--text-lg);
          color: var(--text-muted);
          margin-bottom: var(--space-6);
        }

        .cta-card-new__actions {
          display: flex;
          justify-content: center;
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .cta-card-new {
            padding: var(--space-6) var(--space-4);
          }

          .cta-card-new__actions {
            flex-direction: column;
          }

          .cta-card-new__actions .btn,
          .cta-card-new__actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  )
}
