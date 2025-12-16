import React from 'react'

interface MoodIndicatorProps {
  moodUser: number | null
  moodInferred: number | null
}

const MOOD_EMOJIS: { [key: number]: string } = {
  1: '01',
  2: '02',
  3: '03',
  4: '04',
  5: '05',
}

export function MoodIndicator({ moodUser, moodInferred }: MoodIndicatorProps) {
  const mood = moodUser ?? moodInferred
  const isUserSet = moodUser !== null

  if (mood === null) {
    return null
  }

  return (
    <div className={`mood-indicator mood-indicator--${mood}`}>
      <span className="mood-indicator__emoji">{MOOD_EMOJIS[mood]}</span>
      <span className="mood-indicator__source">
        {isUserSet ? 'You' : 'AI'}
      </span>
    </div>
  )
}
