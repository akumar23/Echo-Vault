'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles, Shield, Cpu, Search, Check, Github } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  GradientText,
  StaggerContainer,
  StaggerItem,
  FadeIn,
  useMotion,
} from '@/components/motion'

const pricingFeatures = [
  'Unlimited journal entries',
  'Flexible LLM support',
  'RAG-powered memory',
  'Semantic vector search',
  'Real-time AI streaming',
  'Mood tracking & insights',
  'True data deletion',
  'No ads, ever',
]

const features = [
  { icon: Cpu, label: 'Flexible LLM support' },
  { icon: Search, label: 'RAG-powered memory' },
  { icon: Shield, label: 'Privacy-first design' },
]

export function Hero() {
  const { reducedMotion } = useMotion()

  return (
    <section className="hero-new">
      {/* Background is now provided by AmbientBackground at layout level */}

      <div className="hero-new__content">
        {/* Left Content */}
        <div className="hero-new__left">
          {/* Badge */}
          <FadeIn direction="down" delay={0.1}>
            <motion.div
              className="hero-new__badge"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Shield size={14} />
              <span>Privacy-first journaling with flexible AI</span>
            </motion.div>
          </FadeIn>

          {/* Title */}
          <FadeIn direction="up" delay={0.2}>
            <h1 className="hero-new__title">
              <span className="hero-new__title-line">Journal with an AI that</span>
              <GradientText
                as="span"
                className="hero-new__title-gradient"
                delay={0.4}
                animated={!reducedMotion}
              >
                actually remembers you.
              </GradientText>
            </h1>
          </FadeIn>

          {/* Subtitle */}
          <FadeIn direction="up" delay={0.35}>
            <p className="hero-new__subtitle">
              Chat directly with an LLM that has human-like memory of your past writing.
              Powered by RAG with semantic vector search, real-time AI reflections, and
              flexible model support—use cloud APIs or self-host your own.
            </p>
          </FadeIn>

          {/* Feature Pills */}
          <StaggerContainer
            className="hero-new__features"
            staggerDelay={0.08}
            delayChildren={0.5}
          >
            {features.map(({ icon: Icon, label }) => (
              <StaggerItem key={label}>
                <motion.div
                  className="hero-new__feature"
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* CTA Buttons */}
          <FadeIn direction="up" delay={0.6}>
            <div className="hero-new__actions">
              <Link href="/register" className="btn btn-gradient">
                <Sparkles size={18} />
                Start Journaling Free
              </Link>
              <Link href="#how-it-works" className="btn btn-glass">
                See How It Works
                <ArrowRight size={18} />
              </Link>
            </div>
          </FadeIn>
        </div>

        {/* Right - Pricing Card */}
        <div className="hero-new__right">
          <FadeIn direction="left" delay={0.4} duration={0.8}>
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
                {pricingFeatures.map((feature) => (
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
        </div>
      </div>

    </section>
  )
}
