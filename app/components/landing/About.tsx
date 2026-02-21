'use client'

import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, GradientText, useMotion } from '@/components/motion'

export function About() {
  const { reducedMotion } = useMotion()

  return (
    <section className="about-new" id="about">
      <div className="about-new__content">
        <FadeIn>
          <motion.div
            className="about-new__icon"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Heart size={32} />
          </motion.div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="about-new__title">
            Why I built{' '}
            <GradientText as="span" animated={!reducedMotion}>
              EchoVault
            </GradientText>
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="about-new__text">
            <p>
              I started journaling years ago as a way to process my thoughts and track my mental
              health. But every app I tried either felt like it was harvesting my data, or lacked
              the intelligent features that could actually help me understand patterns in my life.
            </p>

            <p>
              When RAG and vector databases became accessible, I saw an opportunity: what if you could
              chat with an AI that actually <em>remembers</em> your past writing? What if journaling
              could be both private and intelligent, with flexible model support for any use case?
            </p>

            <p>
              EchoVault is the result—a journal with human-like memory powered by semantic search
              and RAG. Use cloud APIs for convenience or self-host for privacy. It&apos;s open source
              because I believe everyone deserves access to intelligent journaling.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <motion.div
            className="about-new__author"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className="about-new__avatar">AK</div>
            <div className="about-new__author-info">
              <span className="about-new__author-name">Aryan Kumar</span>
              <span className="about-new__author-role">Creator of EchoVault</span>
            </div>
          </motion.div>
        </FadeIn>
      </div>

      <style jsx global>{`
        .about-new {
          padding: var(--space-10) 0;
        }

        .about-new__content {
          max-width: 650px;
          margin: 0 auto;
          text-align: center;
        }

        .about-new__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-full);
          margin-bottom: var(--space-5);
        }

        .about-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-6);
        }

        .about-new__text {
          text-align: left;
          margin-bottom: var(--space-6);
        }

        .about-new__text p {
          color: var(--text-muted);
          font-size: var(--text-base);
          line-height: 1.8;
          margin-bottom: var(--space-4);
        }

        .about-new__text p:last-child {
          margin-bottom: 0;
        }

        .about-new__text em {
          color: var(--accent);
          font-style: normal;
          font-weight: 500;
        }

        .about-new__author {
          display: inline-flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur-light);
          -webkit-backdrop-filter: var(--glass-blur-light);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-full);
        }

        .about-new__avatar {
          width: 44px;
          height: 44px;
          background: var(--gradient-warm-flow);
          color: white;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: var(--text-sm);
        }

        .about-new__author-info {
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .about-new__author-name {
          font-weight: 600;
          font-size: var(--text-base);
        }

        .about-new__author-role {
          color: var(--text-muted);
          font-size: var(--text-sm);
        }
      `}</style>
    </section>
  )
}
