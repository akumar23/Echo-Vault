'use client'

import { useState } from 'react'

interface DecaySliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function DecaySlider({ value, onChange, min = 1, max = 365 }: DecaySliderProps) {
  return (
    <div>
      <label>
        Search Half-Life: {value} days
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ width: '100%', marginTop: '0.5rem' }}
        />
      </label>
      <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
        Controls how quickly older entries decay in search results. Lower values favor recent entries.
      </p>
    </div>
  )
}

