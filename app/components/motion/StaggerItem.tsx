'use client'

import { motion, Variants } from 'framer-motion'
import { ReactNode } from 'react'
import { useMotion } from './MotionProvider'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

interface StaggerItemProps {
  children: ReactNode
  direction?: Direction
  className?: string
  distance?: number
}

const getVariants = (direction: Direction, distance: number): Variants => {
  const directions: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
    none: { x: 0, y: 0 },
  }

  const { x, y } = directions[direction]

  return {
    hidden: { opacity: 0, x, y },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  }
}

export function StaggerItem({
  children,
  direction = 'up',
  className,
  distance = 20,
}: StaggerItemProps) {
  const { reducedMotion } = useMotion()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div className={className} variants={getVariants(direction, distance)}>
      {children}
    </motion.div>
  )
}
