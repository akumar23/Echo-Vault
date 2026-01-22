import React from 'react'

interface MoodIndicatorProps {
  moodUser: number | null
  moodInferred: number | null
  size?: 'default' | 'large'
}

const MOOD_EMOJIS: { [key: number]: string } = {
  1: '😢',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
}

const MOOD_LABELS: { [key: number]: string } = {
  1: 'Low',
  2: 'Down',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
}

export function MoodIndicator({ moodUser, moodInferred, size = 'default' }: MoodIndicatorProps) {
  const mood = moodUser ?? moodInferred
  const isUserSet = moodUser !== null

  if (mood === null) {
    return null
  }

  return (
    <div className={`mood-indicator mood-indicator--${mood} ${size === 'large' ? 'mood-indicator--large' : ''}`}>
      <span className="mood-indicator__emoji">{MOOD_EMOJIS[mood]}</span>
      <div className="mood-indicator__details">
        <span className="mood-indicator__label">{MOOD_LABELS[mood]}</span>
        <span className="mood-indicator__source">
          {isUserSet ? 'You' : 'AI'}
        </span>
      </div>
    </div>
  )
}
