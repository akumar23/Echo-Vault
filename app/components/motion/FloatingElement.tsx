'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { useMotion } from './MotionProvider'

interface FloatingElementProps {
  children: ReactNode
  amplitude?: number
  duration?: number
  delay?: number
  className?: string
  rotate?: number
}

export function FloatingElement({
  children,
  amplitude = 10,
  duration = 4,
  delay = 0,
  className,
  rotate = 0,
}: FloatingElementProps) {
  const { reducedMotion } = useMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -amplitude, 0],
        rotate: [0, rotate, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  )
}
