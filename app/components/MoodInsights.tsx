'use client'

import { useState, useMemo, ReactNode } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { useSemanticMoodInsights } from '@/hooks/useInsights'
import { TrendsChart } from './TrendsChart'
import { format, subDays, startOfDay, getDay } from 'date-fns'
import { SemanticMoodInsight } from '@/lib/api'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Flame,
  Plus,
  Loader2,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TimeRange = 7 | 30 | 90

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface MoodInsight {
  iconType: 'up' | 'down' | 'steady' | 'star' | 'streak' | 'plus' | 'average'
  text: string
  type?: 'semantic' | 'basic'  // Track insight source
}

function InsightIcon({ iconType, className }: { iconType: MoodInsight['iconType']; className?: string }) {
  const icons: Record<MoodInsight['iconType'], ReactNode> = {
    up: <TrendingUp size={18} />,
    down: <TrendingDown size={18} />,
    steady: <Minus size={18} />,
    star: <Star size={18} />,
    streak: <Flame size={18} />,
    plus: <Plus size={18} />,
    average: <BarChart3 size={18} />
  }

  const colorClass: Record<MoodInsight['iconType'], string> = {
    up: 'bg-[color:var(--success)]/15 text-[color:var(--success)]',
    down: 'bg-[color:var(--warning)]/15 text-[color:var(--warning)]',
    steady: 'bg-muted text-muted-foreground',
    star: 'bg-primary/10 text-primary',
    streak: 'bg-primary/10 text-primary',
    plus: 'bg-[color:var(--success)]/15 text-[color:var(--success)]',
    average: 'bg-muted text-muted-foreground'
  }

  return (
    <div
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${colorClass[iconType]} ${className || ''}`}
    >
      {icons[iconType]}
    </div>
  )
}

function calculateInsights(entries: Array<{ created_at: string; mood_user: number | null; mood_inferred: number | null }>): MoodInsight[] {
  if (!entries || entries.length === 0) {
    return []
  }

  const insights: MoodInsight[] = []
  const today = startOfDay(new Date())

  // Get moods with dates
  const entriesWithMood = entries
    .map(e => ({
      date: new Date(e.created_at),
      mood: e.mood_user ?? e.mood_inferred
    }))
    .filter(e => e.mood !== null) as Array<{ date: Date; mood: number }>

  if (entriesWithMood.length === 0) {
    return []
  }

  // Weekly change calculation
  const thisWeekStart = subDays(today, 7)
  const lastWeekStart = subDays(today, 14)

  const thisWeekMoods = entriesWithMood.filter(e => e.date >= thisWeekStart)
  const lastWeekMoods = entriesWithMood.filter(e => e.date >= lastWeekStart && e.date < thisWeekStart)

  if (thisWeekMoods.length > 0 && lastWeekMoods.length > 0) {
    const thisWeekAvg = thisWeekMoods.reduce((sum, e) => sum + e.mood, 0) / thisWeekMoods.length
    const lastWeekAvg = lastWeekMoods.reduce((sum, e) => sum + e.mood, 0) / lastWeekMoods.length
    const changePercent = Math.round(((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100)

    if (changePercent > 5) {
      insights.push({ iconType: 'up', text: `Mood up ${changePercent}% from last week` })
    } else if (changePercent < -5) {
      insights.push({ iconType: 'down', text: `Mood down ${Math.abs(changePercent)}% from last week` })
    } else {
      insights.push({ iconType: 'steady', text: 'Mood steady compared to last week' })
    }
  } else if (thisWeekMoods.length > 0) {
    const thisWeekAvg = thisWeekMoods.reduce((sum, e) => sum + e.mood, 0) / thisWeekMoods.length
    insights.push({ iconType: 'average', text: `Average mood this week: ${thisWeekAvg.toFixed(1)}/5` })
  }

  // Best day of the week
  const moodByDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  entriesWithMood.forEach(e => {
    const day = getDay(e.date)
    moodByDay[day].push(e.mood)
  })

  const dayAverages = Object.entries(moodByDay)
    .filter(([_, moods]) => moods.length > 0)
    .map(([day, moods]) => ({
      day: parseInt(day),
      avg: moods.reduce((a, b) => a + b, 0) / moods.length
    }))
    .sort((a, b) => b.avg - a.avg)

  if (dayAverages.length >= 2) {
    const bestDay = dayAverages[0]
    insights.push({ iconType: 'star', text: `Best mood on ${DAY_NAMES[bestDay.day]}s` })
  }

  // Journaling streak
  const sortedDates = [...new Set(entries.map(e => format(new Date(e.created_at), 'yyyy-MM-dd')))]
    .sort()
    .reverse()

  let streak = 0
  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = format(subDays(today, i), 'yyyy-MM-dd')
    if (sortedDates.includes(expectedDate)) {
      streak++
    } else {
      break
    }
  }

  if (streak > 0) {
    insights.push({
      iconType: 'streak',
      text: streak === 1 ? 'Wrote today' : `${streak}-day writing streak`
    })
  }

  // Entry count comparison
  const thisWeekEntries = entries.filter(e => new Date(e.created_at) >= thisWeekStart).length
  const lastWeekEntries = entries.filter(e => {
    const date = new Date(e.created_at)
    return date >= lastWeekStart && date < thisWeekStart
  }).length

  if (thisWeekEntries > lastWeekEntries && lastWeekEntries > 0) {
    insights.push({ iconType: 'plus', text: `${thisWeekEntries - lastWeekEntries} more entries than last week` })
  }

  return insights.slice(0, 4)
}

/**
 * Convert semantic mood insights to display format
 */
function semanticToDisplay(semantic: SemanticMoodInsight): MoodInsight {
  const iconTypes: Record<SemanticMoodInsight['type'], MoodInsight['iconType']> = {
    positive_theme: 'up',
    negative_theme: 'down',
    mood_trend: 'steady'
  }

  return {
    iconType: iconTypes[semantic.type],
    text: semantic.insight,
    type: 'semantic'
  }
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
]

export function MoodInsights() {
  const [timeRange, setTimeRange] = useState<TimeRange>(30)
  const { data: entries, isLoading: entriesLoading } = useEntries(0, 200)
  const { data: semanticData, isLoading: semanticLoading } = useSemanticMoodInsights()

  const insights = useMemo(() => {
    const result: MoodInsight[] = []

    // Prioritize semantic insights (the actionable ones)
    if (semanticData?.has_sufficient_data && semanticData.insights.length > 0) {
      result.push(...semanticData.insights.map(semanticToDisplay))
    }

    // Fill remaining slots with basic insights
    if (entries && result.length < 4) {
      const basicInsights = calculateInsights(entries)
      // Only add basic insights that don't duplicate semantic ones
      for (const basic of basicInsights) {
        if (result.length >= 4) break
        // Skip "Best mood on X" type insights when we have semantic ones
        if (result.length > 0 && basic.text.includes('Best mood on')) continue
        result.push({ ...basic, type: 'basic' })
      }
    }

    return result.slice(0, 4)
  }, [entries, semanticData])

  const isLoading = entriesLoading || semanticLoading

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    )
  }

  const entriesWithMood = entries?.filter(
    (e) => e.mood_user !== null || e.mood_inferred !== null,
  ) ?? []

  if (!entries || entries.length === 0 || entriesWithMood.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        {entries && entries.length > 0
          ? 'Not enough mood data yet. Log a few more entries to see trends.'
          : 'Start journaling to see mood insights.'}
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {insights.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {insights.map((insight, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground"
            >
              <InsightIcon iconType={insight.iconType} />
              <span>{insight.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Not enough data yet for insights.
        </p>
      )}

      {/* Time Range Filter Tabs */}
      <div className="inline-flex rounded-md border border-border bg-muted/50 p-0.5">
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              timeRange === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Always visible chart */}
      <div>
        <TrendsChart days={timeRange} />
      </div>
    </div>
  )
}
