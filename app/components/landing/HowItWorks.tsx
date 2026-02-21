'use client'

import { PenLine, Cpu, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, useMotion } from '@/components/motion'

const steps = [
  {
    number: '1',
    icon: PenLine,
    title: 'Write your entry.',
    description: "Open EchoVault and write what's on your mind. No tags, no templates—just your raw thoughts.",
    color: 'var(--accent)',
  },
  {
    number: '2',
    icon: Cpu,
    title: 'AI gets to work (quietly).',
    description: 'In the background, EchoVault analyzes your mood, embeds your entry for deep search, and prepares it for future insight. All without slowing you down.',
    color: 'var(--accent-secondary)',
  },
  {
    number: '3',
    icon: Sparkles,
    title: 'Reflect, search, and grow.',
    description: "When you're ready, ask the AI to reflect on what you wrote. Search past entries by meaning. Track your mood over time. Let the insights unfold.",
    color: 'var(--warning)',
  },
]

export function HowItWorks() {
  const { reducedMotion } = useMotion()

  return (
    <section className="how-it-works-new" id="how-it-works">
      <FadeIn>
        <div className="how-it-works-new__header">
          <h2 className="how-it-works-new__title">How It Works</h2>
          <p className="how-it-works-new__subtitle">
            Three simple steps to deeper self-understanding.
          </p>
        </div>
      </FadeIn>

      <StaggerContainer className="how-it-works-new__steps" staggerDelay={0.15} delayChildren={0.1}>
        {steps.map((step, index) => (
          <StaggerItem key={step.number}>
            <motion.div
              className="how-it-works-new__step"
              whileHover={reducedMotion ? {} : { y: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <motion.div
                className="how-it-works-new__step-number"
                style={{ background: step.color }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                {step.number}
              </motion.div>
              <div
                className="how-it-works-new__step-icon"
                style={{ color: step.color }}
              >
                <step.icon size={32} />
              </div>
              <h3 className="how-it-works-new__step-title">{step.title}</h3>
              <p className="how-it-works-new__step-description">{step.description}</p>

              {index < steps.length - 1 && (
                <div className="how-it-works-new__connector">
                  <motion.div
                    className="how-it-works-new__connector-line"
                    initial={reducedMotion ? {} : { scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 + index * 0.2 }}
                  />
                </div>
              )}
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <style jsx global>{`
        .how-it-works-new {
          padding: var(--space-10) 0;
        }

        .how-it-works-new__header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .how-it-works-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .how-it-works-new__subtitle {
          color: var(--text-muted);
          font-size: var(--text-lg);
        }

        .how-it-works-new__steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-6);
          position: relative;
        }

        .how-it-works-new__step {
          position: relative;
          text-align: center;
          padding: var(--space-5);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          transition: box-shadow 0.3s ease;
        }

        .how-it-works-new__step:hover {
          box-shadow: var(--shadow-lg);
        }

        .how-it-works-new__step-number {
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: var(--text-sm);
          color: white;
          border-radius: var(--radius-full);
        }

        .how-it-works-new__step-icon {
          margin: var(--space-4) 0;
        }

        .how-it-works-new__step-title {
          font-size: var(--text-lg);
          font-weight: 600;
          margin-bottom: var(--space-3);
        }

        .how-it-works-new__step-description {
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.6;
        }

        .how-it-works-new__connector {
          display: none;
          position: absolute;
          top: 50%;
          right: -24px;
          width: 48px;
          height: 2px;
        }

        .how-it-works-new__connector-line {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, var(--border), var(--accent-subtle));
          transform-origin: left;
        }

        @media (min-width: 1024px) {
          .how-it-works-new__connector {
            display: block;
          }
        }

        @media (max-width: 1024px) {
          .how-it-works-new__steps {
            grid-template-columns: 1fr;
            max-width: 500px;
            margin: 0 auto;
          }
        }
      `}</style>
    </section>
  )
}
