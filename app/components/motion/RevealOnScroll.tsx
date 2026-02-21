'use client'

import { motion, useInView, Variants } from 'framer-motion'
import { ReactNode, useRef } from 'react'
import { useMotion } from './MotionProvider'

interface RevealOnScrollProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  once?: boolean
  amount?: number
  scale?: boolean
}

export function RevealOnScroll({
  children,
  className,
  delay = 0,
  duration = 0.6,
  once = true,
  amount = 0.3,
  scale = false,
}: RevealOnScrollProps) {
  const { reducedMotion } = useMotion()
  const ref = useRef(null)
  const isInView = useInView(ref, { once, amount })

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: 30,
      scale: scale ? 0.95 : 1,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
