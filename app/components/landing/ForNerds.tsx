'use client'

import Link from 'next/link'
import {
  Terminal,
  ArrowRight,
  Key,
  Server,
  Layers,
  Zap,
  Trash2,
  Cpu
} from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, useMotion } from '@/components/motion'

const features = [
  {
    icon: Key,
    title: 'Bring your own LLM',
    points: [
      'Works with anything that supports the OpenAI API format.',
      'Use ChatGPT, Gemini, Claude, Mistral, or any other model you have API access to.',
      'Drop in your own keys or route traffic through your own proxy/backend.',
    ],
    size: 'large',
  },
  {
    icon: Server,
    title: 'Go local, go hybrid, go wild',
    points: [
      'Supports local LLMs via Ollama, LM Studio, vLLM, LocalAI, etc.',
      'Want to use OpenAI for chat but keep your embeddings local? Totally fine.',
      "Everything's configurable—model endpoints, provider priorities, even fallbacks.",
    ],
    size: 'large',
  },
  {
    icon: Layers,
    title: 'Flexible embeddings',
    points: [
      'Choose from OpenAI embeddings or local models from HuggingFace or similar.',
      'Async processing via Celery so the app never slows down—even with big journals.',
    ],
    size: 'normal',
  },
  {
    icon: Zap,
    title: 'Fast, streamed responses',
    points: [
      'Real-time reflections via WebSockets—no waiting for the AI to "finish thinking."',
      'Feels like a real-time chat, but smarter (and less forgetful).',
    ],
    size: 'normal',
  },
  {
    icon: Trash2,
    title: 'Real deletion',
    points: [
      'Hard deletes wipe everything: content, embeddings, cached memory, semantic indexes.',
      'No shadow data. No "oops we kept that." When you say delete, we listen.',
    ],
    size: 'normal',
  },
]

export function ForNerds() {
  const { reducedMotion } = useMotion()

  return (
    <section className="for-nerds-new" id="for-nerds">
      <FadeIn>
        <div className="for-nerds-new__header">
          <motion.div
            className="for-nerds-new__badge"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Terminal size={14} />
            <span>For Developers</span>
          </motion.div>
          <h2 className="for-nerds-new__title">For Nerds</h2>
          <p className="for-nerds-new__subtitle">
            EchoVault isn't just compatible with AI—it's modular by design.
            It's a journaling platform that AI plugs into, not the other way around.
          </p>
        </div>
      </FadeIn>

      <StaggerContainer className="for-nerds-new__grid" staggerDelay={0.08} delayChildren={0.1}>
        {features.map((feature) => (
          <StaggerItem key={feature.title}>
            <motion.div
              className={`for-nerds-new__card ${feature.size === 'large' ? 'for-nerds-new__card--large' : ''}`}
              whileHover={reducedMotion ? {} : { y: -4, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <div className="for-nerds-new__card-header">
                <motion.div
                  className="for-nerds-new__card-icon"
                  whileHover={{ rotate: 5, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <feature.icon size={20} />
                </motion.div>
                <h3>{feature.title}</h3>
              </div>
              <ul className="for-nerds-new__list">
                {feature.points.map((point, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i, duration: 0.3 }}
                  >
                    <span className="for-nerds-new__bullet">→</span>
                    {point}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <FadeIn delay={0.3}>
        <motion.div
          className="for-nerds-new__tldr"
          whileHover={reducedMotion ? {} : { scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="for-nerds-new__tldr-glow" />
          <motion.div
            className="for-nerds-new__tldr-icon"
            animate={reducedMotion ? {} : { rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          >
            <Cpu size={24} />
          </motion.div>
          <div className="for-nerds-new__tldr-content">
            <h3>TL;DR</h3>
            <p>
              EchoVault is the journaling OS. LLMs are plugins. You pick the model.
              You pick the stack. We just make it work.
            </p>
          </div>
        </motion.div>
      </FadeIn>

      <FadeIn delay={0.4}>
        <div className="for-nerds-new__cta">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link href="/docs" className="btn btn-glass">
              Read the Full Documentation
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </FadeIn>

      <style jsx global>{`
        .for-nerds-new {
          padding: var(--space-10) 0;
        }

        .for-nerds-new__header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .for-nerds-new__badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          font-family: var(--font-mono);
          color: var(--accent);
          margin-bottom: var(--space-4);
        }

        .for-nerds-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .for-nerds-new__subtitle {
          color: var(--text-muted);
          font-size: var(--text-lg);
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.7;
        }

        .for-nerds-new__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }

        .for-nerds-new__card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-5);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .for-nerds-new__card:hover {
          border-color: var(--accent-subtle);
          box-shadow: var(--shadow-md);
        }

        .for-nerds-new__card--large {
          grid-column: span 1;
        }

        .for-nerds-new__card-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .for-nerds-new__card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--accent);
        }

        .for-nerds-new__card h3 {
          font-size: var(--text-base);
          font-weight: 600;
          font-family: var(--font-mono);
        }

        .for-nerds-new__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .for-nerds-new__list li {
          display: flex;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-muted);
          line-height: 1.6;
        }

        .for-nerds-new__bullet {
          color: var(--accent);
          font-family: var(--font-mono);
          flex-shrink: 0;
        }

        .for-nerds-new__tldr {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--space-4);
          max-width: 600px;
          margin: 0 auto var(--space-6);
          padding: var(--space-5);
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--accent-subtle);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .for-nerds-new__tldr-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--gradient-aurora);
          background-size: 200% 100%;
          animation: gradient-shift 4s ease infinite;
        }

        .for-nerds-new__tldr-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .for-nerds-new__tldr-content h3 {
          font-size: var(--text-base);
          font-weight: 700;
          font-family: var(--font-mono);
          margin-bottom: var(--space-1);
        }

        .for-nerds-new__tldr-content p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          line-height: 1.6;
        }

        .for-nerds-new__cta {
          text-align: center;
        }

        .for-nerds-new__cta .btn {
          font-family: var(--font-mono);
        }

        @media (max-width: 1024px) {
          .for-nerds-new__grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .for-nerds-new__card--large {
            grid-column: span 1;
          }
        }

        @media (max-width: 640px) {
          .for-nerds-new__grid {
            grid-template-columns: 1fr;
          }

          .for-nerds-new__tldr {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </section>
  )
}
