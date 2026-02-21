'use client'

import Link from 'next/link'
import { Check, Github, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, useMotion } from '@/components/motion'

const features = [
  'Unlimited journal entries',
  'Flexible LLM support',
  'RAG-powered memory',
  'Semantic vector search',
  'Real-time AI streaming',
  'Mood tracking & insights',
  'True data deletion',
  'No ads, ever',
]

export function Pricing() {
  const { reducedMotion } = useMotion()

  return (
    <section className="pricing-new" id="pricing">
      <FadeIn>
        <motion.div
          className="pricing-card-new"
          whileHover={reducedMotion ? {} : { y: -8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="pricing-card-new__glow" />

          <div className="pricing-card-new__header">
            <span className="pricing-card-new__badge">Open Source</span>
            <div className="pricing-card-new__price">
              <motion.span
                className="pricing-card-new__price-amount"
                initial={{ scale: 0.5, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
              >
                $0
              </motion.span>
              <span className="pricing-card-new__price-period">forever</span>
            </div>
            <p className="pricing-card-new__description">
              Everything you need for private, AI-powered journaling.
            </p>
          </div>

          <StaggerContainer className="pricing-card-new__features" staggerDelay={0.05} delayChildren={0.2}>
            {features.map((feature) => (
              <StaggerItem key={feature}>
                <motion.li
                  className="pricing-card-new__feature"
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <motion.span
                    className="pricing-card-new__check"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.1 }}
                  >
                    <Check size={16} />
                  </motion.span>
                  <span>{feature}</span>
                </motion.li>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <div className="pricing-card-new__actions">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/register" className="btn btn-gradient">
                <Sparkles size={18} />
                Get Started
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="https://github.com/aryankumar/echo-vault"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-glass"
              >
                <Github size={18} />
                View on GitHub
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </FadeIn>

      <style jsx global>{`
        .pricing-new {
          padding: var(--space-10) 0;
        }

        .pricing-card-new {
          position: relative;
          max-width: 450px;
          margin: 0 auto;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          overflow: hidden;
        }

        .pricing-card-new__glow {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(
            from 180deg,
            transparent,
            var(--accent) 10%,
            transparent 30%
          );
          animation: rotate-glow 8s linear infinite;
          opacity: 0.1;
        }

        @keyframes rotate-glow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pricing-card-new__header {
          position: relative;
          text-align: center;
          margin-bottom: var(--space-5);
        }

        .pricing-card-new__badge {
          display: inline-block;
          padding: var(--space-1) var(--space-3);
          background: var(--accent-subtle);
          color: var(--accent);
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-radius: var(--radius-full);
          margin-bottom: var(--space-3);
        }

        .pricing-card-new__price {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .pricing-card-new__price-amount {
          font-size: 4rem;
          font-weight: 700;
          background: var(--gradient-aurora);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient-shift 6s ease infinite;
        }

        .pricing-card-new__price-period {
          color: var(--text-muted);
          font-size: var(--text-lg);
        }

        .pricing-card-new__description {
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .pricing-card-new__features {
          position: relative;
          list-style: none;
          padding: 0;
          margin: 0 0 var(--space-6);
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
        }

        .pricing-card-new__feature {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
        }

        .pricing-card-new__check {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          background: var(--success);
          color: white;
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }

        .pricing-card-new__actions {
          position: relative;
          display: flex;
          gap: var(--space-3);
        }

        .pricing-card-new__actions > div {
          flex: 1;
        }

        .pricing-card-new__actions .btn {
          width: 100%;
          justify-content: center;
        }

        @media (max-width: 480px) {
          .pricing-card-new__features {
            grid-template-columns: 1fr;
          }

          .pricing-card-new__actions {
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  )
}
