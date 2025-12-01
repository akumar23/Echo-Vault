import React from 'react'

interface MoodIndicatorProps {
  moodUser: number | null
  moodInferred: number | null
}

const MOOD_EMOJIS: { [key: number]: string } = {
  1: '😢',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
}

const MOOD_COLORS: { [key: number]: string } = {
  1: '#ef4444',
  2: '#f59e0b',
  3: '#6b7280',
  4: '#10b981',
  5: '#22c55e',
}

export function MoodIndicator({ moodUser, moodInferred }: MoodIndicatorProps) {
  const mood = moodUser ?? moodInferred
  const isUserSet = moodUser !== null

  if (mood === null) {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
      }}
    >
      <span
        style={{
          fontSize: '1.5rem',
          filter: isUserSet ? 'none' : 'opacity(0.7)',
        }}
      >
        {MOOD_EMOJIS[mood]}
      </span>
      <span
        style={{
          color: MOOD_COLORS[mood],
          fontSize: '0.75rem',
          fontWeight: 500,
          opacity: 0.8,
        }}
      >
        {isUserSet ? 'You' : 'AI'}
      </span>
    </div>
  )
}
