'use client'

import { motion } from 'framer-motion'
import { useMotion } from './MotionProvider'

interface MorphingBlobProps {
  color1: string
  color2: string
  size?: number
  className?: string
  blur?: number
  duration?: number
  delay?: number
}

/**
 * Converts a hex color to rgba format with specified alpha
 */
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(0, 0, 0, ${alpha})`
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Creates a truly soft, edgeless ambient glow effect.
 *
 * The key techniques used to eliminate visible edges:
 * 1. NO border-radius clipping - use a square element so blur extends naturally
 * 2. Multiple layered radial gradients with very gradual falloff
 * 3. Gradient stops that fade to transparent well before 100%
 * 4. Using rgba colors with decreasing opacity toward edges
 * 5. Larger blur values relative to element size
 */
export function MorphingBlob({
  color1,
  color2,
  size = 400,
  className = '',
  blur = 60,
  duration = 15,
  delay = 0,
}: MorphingBlobProps) {
  const { reducedMotion } = useMotion()

  // Create multiple gradient layers for a truly soft glow
  // Each layer fades more gradually and uses decreasing opacity
  // The key: gradient must reach full transparency BEFORE the element edge
  const layeredGradient = `
    radial-gradient(
      circle at center,
      ${hexToRgba(color1, 0.8)} 0%,
      ${hexToRgba(color1, 0.6)} 10%,
      ${hexToRgba(color2, 0.4)} 20%,
      ${hexToRgba(color2, 0.2)} 30%,
      ${hexToRgba(color2, 0.1)} 40%,
      ${hexToRgba(color2, 0.05)} 50%,
      transparent 60%
    )
  `

  // Style without border-radius to prevent clipping artifacts
  // The gradient itself creates the circular shape
  const gradientStyle = {
    width: size,
    height: size,
    position: 'absolute' as const,
    // NO border-radius - this was causing the edge artifact
    // The blur filter will naturally soften the square element
    // and the radial gradient creates the circular appearance
    background: layeredGradient,
    filter: `blur(${blur}px)`,
    // Ensure the blur can extend beyond element bounds
    // by not clipping overflow (default behavior when no border-radius)
  }

  if (reducedMotion) {
    return (
      <div
        className={`morphing-blob ${className}`}
        style={{
          ...gradientStyle,
          opacity: 0.5,
        }}
      />
    )
  }

  return (
    <motion.div
      className={`morphing-blob ${className}`}
      style={gradientStyle}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.3, 0.5, 0.3],
        scale: [1, 1.1, 1],
        x: [0, 20, -10, 0],
        y: [0, -15, 10, 0],
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}
