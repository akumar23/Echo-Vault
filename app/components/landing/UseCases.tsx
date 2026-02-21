'use client'

import { Heart, Shield, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, GlassCard, useMotion } from '@/components/motion'

const useCases = [
  {
    icon: Heart,
    title: 'Personal Journalers',
    description:
      'Daily reflection, gratitude practice, and mental wellness tracking. Your thoughts deserve a space that understands context and remembers patterns.',
    benefits: [
      'Track mood patterns over time',
      'Search past entries semantically',
      'Get AI reflections that understand you',
    ],
    featured: true,
  },
  {
    icon: Shield,
    title: 'Privacy Advocates',
    description:
      'Your journal is deeply personal. EchoVault runs AI locally via Ollama—your words never touch external servers or cloud storage.',
    benefits: [
      'All AI processing on your machine',
      'No data collection or analytics',
      'True deletion when you want it',
    ],
  },
  {
    icon: Users,
    title: 'Therapists & Coaches',
    description:
      'Recommend to clients who want to maintain a reflective practice between sessions. Privacy-first design supports sensitive journaling.',
    benefits: [
      'Client data stays on their device',
      'Supports reflective practice',
      'No HIPAA compliance concerns',
    ],
  },
]

function UseCaseCard({ useCase, index }: { useCase: typeof useCases[0]; index: number }) {
  const { reducedMotion } = useMotion()

  return (
    <motion.div
      className={`use-case-card-new ${useCase.featured ? 'use-case-card-new--featured' : ''}`}
      whileHover={reducedMotion ? {} : { y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="use-case-card-new__header">
        <motion.div
          className="use-case-card-new__icon"
          whileHover={{ rotate: 5, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <useCase.icon size={24} />
        </motion.div>
        <h3 className="use-case-card-new__title">{useCase.title}</h3>
      </div>

      <p className="use-case-card-new__description">{useCase.description}</p>

      <ul className="use-case-card-new__benefits">
        {useCase.benefits.map((benefit, i) => (
          <motion.li
            key={benefit}
            initial={reducedMotion ? false : { opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.1 }}
          >
            <span className="use-case-card-new__check">✓</span>
            {benefit}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}

export function UseCases() {
  return (
    <section className="use-cases-new" id="use-cases">
      <FadeIn>
        <div className="use-cases-new__header">
          <h2 className="use-cases-new__title">Built for people who value privacy</h2>
          <p className="use-cases-new__subtitle">
            Whether you&apos;re journaling for personal growth, mental health, or professional
            reflection, EchoVault adapts to your needs while keeping your data private.
          </p>
        </div>
      </FadeIn>

      <StaggerContainer className="use-cases-new__grid" staggerDelay={0.1} delayChildren={0.1}>
        {useCases.map((useCase, index) => (
          <StaggerItem key={useCase.title} className={useCase.featured ? 'use-cases-new__featured-item' : ''}>
            <UseCaseCard useCase={useCase} index={index} />
          </StaggerItem>
        ))}
      </StaggerContainer>

      <style jsx global>{`
        .use-cases-new {
          padding: var(--space-10) 0;
        }

        .use-cases-new__header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .use-cases-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .use-cases-new__subtitle {
          color: var(--text-muted);
          font-size: var(--text-lg);
          max-width: 650px;
          margin: 0 auto;
        }

        .use-cases-new__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-5);
        }

        .use-cases-new__featured-item {
          grid-column: span 1;
        }

        .use-case-card-new {
          height: 100%;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur-light);
          -webkit-backdrop-filter: var(--glass-blur-light);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .use-case-card-new:hover {
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.1);
          border-color: var(--border);
        }

        .use-case-card-new--featured {
          background: linear-gradient(
            135deg,
            var(--glass-bg) 0%,
            rgba(201, 76, 42, 0.05) 100%
          );
          border-color: var(--accent-subtle);
        }

        .use-case-card-new--featured:hover {
          border-color: var(--accent);
        }

        .use-case-card-new__header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .use-case-card-new__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .use-case-card-new__title {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .use-case-card-new__description {
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.6;
          margin-bottom: var(--space-4);
          flex-grow: 1;
        }

        .use-case-card-new__benefits {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .use-case-card-new__benefits li {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-primary);
        }

        .use-case-card-new__check {
          color: var(--success);
          font-weight: 600;
        }

        @media (max-width: 1024px) {
          .use-cases-new__grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .use-cases-new__featured-item {
            grid-column: span 2;
          }
        }

        @media (max-width: 640px) {
          .use-cases-new__grid {
            grid-template-columns: 1fr;
          }

          .use-cases-new__featured-item {
            grid-column: span 1;
          }
        }
      `}</style>
    </section>
  )
}
