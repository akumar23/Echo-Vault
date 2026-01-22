'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEntries } from '@/hooks/useEntries'
import { useInsightVoice, getPhrase, InsightVoice } from '@/contexts/InsightVoiceContext'
import { useMemo } from 'react'

interface MoodSummary {
  avgMood: number | null
  trend: 'up' | 'down' | 'steady' | null
  recentCount: number
  lastEntryDaysAgo: number | null
}

const MOOD_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

function getGreeting(timeOfDay: string): string {
  const greetings: Record<string, string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Good night',
  }
  return greetings[timeOfDay] || 'Hello'
}

function getMoodMessage(summary: MoodSummary, timeOfDay: string, voice: InsightVoice): string | null {
  if (summary.recentCount === 0) {
    return getPhrase('greetings', 'readyStart', voice)
  }

  if (summary.lastEntryDaysAgo !== null && summary.lastEntryDaysAgo > 3) {
    return getPhrase('greetings', 'beenAwhile', voice)
  }

  if (summary.avgMood === null) return null

  // Mood-based contextual messages
  if (summary.avgMood >= 4) {
    if (summary.trend === 'up') {
      return getPhrase('greetings', 'streak', voice)
    }
    return getPhrase('greetings', 'doingWell', voice)
  }

  if (summary.avgMood >= 3) {
    if (summary.trend === 'up') {
      return getPhrase('greetings', 'lookingUp', voice)
    }
    if (summary.trend === 'down') {
      return getPhrase('greetings', 'oneDay', voice)
    }
    return getPhrase('greetings', 'howsDay', voice)
  }

  // Lower mood
  if (summary.trend === 'up') {
    return getPhrase('greetings', 'progress', voice)
  }

  if (timeOfDay === 'morning') {
    return getPhrase('greetings', 'newDay', voice)
  }

  return getPhrase('greetings', 'writeHelp', voice)
}

export function PersonalizedGreeting() {
  const { user } = useAuth()
  const { data: entries, isLoading } = useEntries(0, 10)
  const { voice } = useInsightVoice()

  const moodSummary = useMemo((): MoodSummary => {
    if (!entries || entries.length === 0) {
      return { avgMood: null, trend: null, recentCount: 0, lastEntryDaysAgo: null }
    }

    // Calculate average mood from recent entries
    const moods = entries
      .map(e => e.mood_user ?? e.mood_inferred)
      .filter((m): m is number => m !== null)

    const avgMood = moods.length > 0
      ? moods.reduce((a, b) => a + b, 0) / moods.length
      : null

    // Calculate trend (compare first half to second half of recent entries)
    let trend: 'up' | 'down' | 'steady' | null = null
    if (moods.length >= 4) {
      const mid = Math.floor(moods.length / 2)
      const olderAvg = moods.slice(mid).reduce((a, b) => a + b, 0) / (moods.length - mid)
      const newerAvg = moods.slice(0, mid).reduce((a, b) => a + b, 0) / mid
      const diff = newerAvg - olderAvg
      if (diff > 0.3) trend = 'up'
      else if (diff < -0.3) trend = 'down'
      else trend = 'steady'
    }

    // Calculate days since last entry
    const lastEntry = entries[0]
    const lastEntryDaysAgo = lastEntry
      ? Math.floor((Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null

    return { avgMood, trend, recentCount: entries.length, lastEntryDaysAgo }
  }, [entries])

  const timeOfDay = getTimeOfDay()
  const greeting = getGreeting(timeOfDay)
  const moodMessage = getMoodMessage(moodSummary, timeOfDay, voice)

  // Get representative emoji for current mood state
  const moodEmoji = moodSummary.avgMood !== null
    ? MOOD_EMOJIS[Math.round(moodSummary.avgMood)]
    : null

  if (isLoading) {
    return (
      <div className="personalized-greeting">
        <h1 className="personalized-greeting__title">
          {greeting}, {user?.username ?? 'there'}
        </h1>
      </div>
    )
  }

  return (
    <div className="personalized-greeting">
      <div className="personalized-greeting__main">
        <h1 className="personalized-greeting__title">
          {greeting}, {user?.username ?? 'there'}
          {moodEmoji && <span className="personalized-greeting__emoji">{moodEmoji}</span>}
        </h1>
        {moodMessage && (
          <p className="personalized-greeting__subtitle">{moodMessage}</p>
        )}
      </div>
      {moodSummary.avgMood !== null && moodSummary.recentCount >= 3 && (
        <div className="personalized-greeting__mood-indicator">
          <span className="personalized-greeting__mood-label">Recent mood</span>
          <div className="personalized-greeting__mood-bar">
            <div
              className="personalized-greeting__mood-fill"
              style={{ width: `${(moodSummary.avgMood / 5) * 100}%` }}
            />
          </div>
          {moodSummary.trend && (
            <span className={`personalized-greeting__trend personalized-greeting__trend--${moodSummary.trend}`}>
              {moodSummary.trend === 'up' && '↑'}
              {moodSummary.trend === 'down' && '↓'}
              {moodSummary.trend === 'steady' && '→'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
