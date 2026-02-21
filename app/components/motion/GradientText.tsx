'use client'

import { motion } from 'framer-motion'
import { useMotion } from './MotionProvider'

interface GradientTextProps {
  children: string
  gradient?: string
  animated?: boolean
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'p'
  className?: string
  delay?: number
}

export function GradientText({
  children,
  gradient = 'var(--gradient-aurora)',
  animated = true,
  as: Tag = 'span',
  className = '',
  delay = 0,
}: GradientTextProps) {
  const { reducedMotion } = useMotion()
  const shouldAnimate = animated && !reducedMotion

  const MotionTag = motion.create(Tag)

  return (
    <MotionTag
      className={`gradient-text ${shouldAnimate ? 'gradient-text--animated' : ''} ${className}`}
      style={{
        background: gradient,
        backgroundSize: animated ? '200% 200%' : '100% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'inline-block',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </MotionTag>
  )
}
