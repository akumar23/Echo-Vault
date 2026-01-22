'use client'

import { createContext, useContext, useMemo, ReactNode } from 'react'
import { useEntries } from '@/hooks/useEntries'

interface MoodContextValue {
  currentMood: number | null
  moodTrend: 'up' | 'down' | 'steady' | null
  isLoading: boolean
}

const MoodContext = createContext<MoodContextValue>({
  currentMood: null,
  moodTrend: null,
  isLoading: true,
})

export function useMood() {
  return useContext(MoodContext)
}

interface MoodProviderProps {
  children: ReactNode
}

export function MoodProvider({ children }: MoodProviderProps) {
  const { data: entries, isLoading } = useEntries(0, 10)

  const moodData = useMemo((): Omit<MoodContextValue, 'isLoading'> => {
    if (!entries || entries.length === 0) {
      return { currentMood: null, moodTrend: null }
    }

    // Get moods from recent entries
    const moods = entries
      .map(e => e.mood_user ?? e.mood_inferred)
      .filter((m): m is number => m !== null)

    if (moods.length === 0) {
      return { currentMood: null, moodTrend: null }
    }

    // Current mood is average of last 3 entries
    const recentMoods = moods.slice(0, Math.min(3, moods.length))
    const currentMood = Math.round(
      recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length
    )

    // Calculate trend
    let moodTrend: 'up' | 'down' | 'steady' | null = null
    if (moods.length >= 4) {
      const mid = Math.floor(moods.length / 2)
      const olderAvg = moods.slice(mid).reduce((a, b) => a + b, 0) / (moods.length - mid)
      const newerAvg = moods.slice(0, mid).reduce((a, b) => a + b, 0) / mid
      const diff = newerAvg - olderAvg
      if (diff > 0.3) moodTrend = 'up'
      else if (diff < -0.3) moodTrend = 'down'
      else moodTrend = 'steady'
    }

    return { currentMood, moodTrend }
  }, [entries])

  const value: MoodContextValue = {
    ...moodData,
    isLoading,
  }

  return (
    <MoodContext.Provider value={value}>
      {children}
    </MoodContext.Provider>
  )
}
