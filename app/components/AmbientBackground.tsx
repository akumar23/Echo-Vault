'use client'

import { useState, useEffect } from 'react'

interface AmbientBackgroundProps {
  mood?: number | null
}

interface Shape {
  id: number
  size: string
  x: string
  y: string
  duration: string
  delay: string
  opacity: string
}

// Use completely static pre-computed values
const staticShapes: Shape[] = [
  { id: 0, size: '312px', x: '15%', y: '25%', duration: '45s', delay: '-5s', opacity: '0.02' },
  { id: 1, size: '425px', x: '75%', y: '60%', duration: '52s', delay: '-12s', opacity: '0.025' },
  { id: 2, size: '280px', x: '40%', y: '80%', duration: '48s', delay: '-8s', opacity: '0.018' },
  { id: 3, size: '380px', x: '85%', y: '15%', duration: '55s', delay: '-15s', opacity: '0.022' },
  { id: 4, size: '350px', x: '25%', y: '45%', duration: '50s', delay: '-3s', opacity: '0.028' },
]

export function AmbientBackground({ mood }: AmbientBackgroundProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Get mood-based color
  const getMoodColor = (m: number | null | undefined): string => {
    if (m === null || m === undefined) return 'var(--accent)'
    if (m <= 2) return 'var(--mood-2)'
    if (m >= 4) return 'var(--mood-5)'
    return 'var(--mood-3)'
  }

  const color = getMoodColor(mood)

  // Don't render anything on server, only on client
  if (!mounted) {
    return <div className="ambient-background" aria-hidden="true" />
  }

  return (
    <div className="ambient-background" aria-hidden="true">
      {staticShapes.map((shape) => (
        <div
          key={shape.id}
          className="ambient-shape"
          style={{
            '--size': shape.size,
            '--x': shape.x,
            '--y': shape.y,
            '--duration': shape.duration,
            '--delay': shape.delay,
            '--opacity': shape.opacity,
            '--color': color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
