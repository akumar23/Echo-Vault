'use client'

import { useMemo } from 'react'

interface AmbientBackgroundProps {
  mood?: number | null
}

interface Shape {
  id: number
  size: number
  x: number
  y: number
  duration: number
  delay: number
  opacity: number
}

export function AmbientBackground({ mood }: AmbientBackgroundProps) {
  // Generate random shapes on mount
  const shapes = useMemo((): Shape[] => {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      size: 200 + Math.random() * 300,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 40 + Math.random() * 30,
      delay: Math.random() * -20,
      opacity: 0.015 + Math.random() * 0.02,
    }))
  }, [])

  // Get mood-based color
  const getMoodColor = (m: number | null | undefined): string => {
    if (m === null || m === undefined) return 'var(--accent)'
    if (m <= 2) return 'var(--mood-2)' // Warm, cocooning
    if (m >= 4) return 'var(--mood-5)' // Fresh, vibrant
    return 'var(--mood-3)' // Neutral
  }

  const color = getMoodColor(mood)

  return (
    <div className="ambient-background" aria-hidden="true">
      {shapes.map((shape) => (
        <div
          key={shape.id}
          className="ambient-shape"
          style={{
            '--size': `${shape.size}px`,
            '--x': `${shape.x}%`,
            '--y': `${shape.y}%`,
            '--duration': `${shape.duration}s`,
            '--delay': `${shape.delay}s`,
            '--opacity': shape.opacity,
            '--color': color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
