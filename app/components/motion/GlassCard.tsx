'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { useMotion } from './MotionProvider'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  tilt?: boolean
  glowColor?: string
}

export function GlassCard({
  children,
  className = '',
  hover = true,
  tilt = false,
  glowColor,
}: GlassCardProps) {
  const { reducedMotion } = useMotion()

  const hoverAnimation = hover && !reducedMotion
    ? {
        scale: 1.02,
        y: -4,
        boxShadow: glowColor
          ? `0 20px 40px -15px ${glowColor}40, 0 0 30px -10px ${glowColor}30`
          : '0 20px 40px -15px rgba(0,0,0,0.15)',
      }
    : {}

  return (
    <motion.div
      className={`glass-card ${className}`}
      whileHover={hoverAnimation}
      transition={{
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {children}
    </motion.div>
  )
}
