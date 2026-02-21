'use client'

import { motion } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, FloatingElement, useMotion } from '@/components/motion'

const testimonials = [
  {
    quote:
      "Finally, a journal app that doesn't want to harvest my data. The AI reflections are surprisingly thoughtful, and knowing it all runs locally gives me peace of mind.",
    author: 'Sarah M.',
    role: 'Daily Journaler',
    initials: 'SM',
    gradient: 'linear-gradient(135deg, #C94C2A, #E07A5A)',
  },
  {
    quote:
      "I recommend EchoVault to clients who want to maintain a reflective practice. The privacy-first approach means I don't have to worry about their sensitive thoughts being stored in some cloud.",
    author: 'Dr. James Chen',
    role: 'Therapist',
    initials: 'JC',
    gradient: 'linear-gradient(135deg, #2D6A4F, #52B788)',
  },
  {
    quote:
      "The semantic search is a game-changer. I can find entries by meaning, not just keywords. It's like having a conversation with my past self.",
    author: 'Alex K.',
    role: 'Software Engineer',
    initials: 'AK',
    gradient: 'linear-gradient(135deg, #D4A574, #E0B88A)',
  },
]

export function Testimonials() {
  const { reducedMotion } = useMotion()

  return (
    <section className="testimonials-new" id="testimonials">
      <FadeIn>
        <div className="testimonials-new__header">
          <span className="testimonials-new__badge">Early Users</span>
          <h2 className="testimonials-new__title">What people are saying</h2>
        </div>
      </FadeIn>

      <StaggerContainer className="testimonials-new__grid" staggerDelay={0.1} delayChildren={0.1}>
        {testimonials.map((testimonial, index) => (
          <StaggerItem key={testimonial.author}>
            <FloatingElement
              amplitude={reducedMotion ? 0 : 4}
              duration={5 + index}
              delay={index * 0.5}
            >
              <motion.div
                className="testimonial-card-new"
                whileHover={reducedMotion ? {} : { y: -8, rotate: 0 }}
                style={{
                  transform: `rotate(${index === 1 ? 0 : index === 0 ? -2 : 2}deg)`,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="testimonial-card-new__quote-mark">&ldquo;</div>
                <blockquote className="testimonial-card-new__quote">
                  {testimonial.quote}
                </blockquote>
                <div className="testimonial-card-new__author">
                  <div
                    className="testimonial-card-new__avatar"
                    style={{ background: testimonial.gradient }}
                  >
                    {testimonial.initials}
                  </div>
                  <div className="testimonial-card-new__info">
                    <span className="testimonial-card-new__name">{testimonial.author}</span>
                    <span className="testimonial-card-new__role">{testimonial.role}</span>
                  </div>
                </div>
              </motion.div>
            </FloatingElement>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <style jsx global>{`
        .testimonials-new {
          padding: var(--space-10) 0;
        }

        .testimonials-new__header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .testimonials-new__badge {
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

        .testimonials-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
        }

        .testimonials-new__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-5);
          perspective: 1000px;
        }

        .testimonial-card-new {
          position: relative;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur-light);
          -webkit-backdrop-filter: var(--glass-blur-light);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          transition: box-shadow 0.3s ease;
        }

        .testimonial-card-new:hover {
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.12);
        }

        .testimonial-card-new__quote-mark {
          position: absolute;
          top: var(--space-3);
          left: var(--space-4);
          font-size: 4rem;
          font-family: Georgia, serif;
          line-height: 1;
          background: var(--gradient-aurora);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          opacity: 0.3;
        }

        .testimonial-card-new__quote {
          position: relative;
          font-size: var(--text-base);
          line-height: 1.7;
          color: var(--text-primary);
          margin-bottom: var(--space-5);
          font-style: italic;
        }

        .testimonial-card-new__author {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .testimonial-card-new__avatar {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: var(--text-sm);
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }

        .testimonial-card-new__info {
          display: flex;
          flex-direction: column;
        }

        .testimonial-card-new__name {
          font-weight: 600;
          font-size: var(--text-sm);
        }

        .testimonial-card-new__role {
          color: var(--text-muted);
          font-size: var(--text-xs);
        }

        @media (max-width: 1024px) {
          .testimonials-new__grid {
            grid-template-columns: 1fr;
            max-width: 500px;
            margin: 0 auto;
          }

          .testimonial-card-new {
            transform: rotate(0deg) !important;
          }
        }
      `}</style>
    </section>
  )
}
