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
    up: 'mood-insight-icon-wrapper--success',
    down: 'mood-insight-icon-wrapper--warning',
    steady: '',
    star: '',
    streak: '',
    plus: 'mood-insight-icon-wrapper--success',
    average: ''
  }

  return (
    <div className={`mood-insight-icon-wrapper ${colorClass[iconType]} ${className || ''}`}>
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
      <div className="card">
        <div className="section-header">
          <div className="section-header__icon">
            <TrendingUp />
          </div>
          <h2>Mood Insights</h2>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span className="text-muted">Loading...</span>
        </div>
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="card">
        <div className="section-header">
          <div className="section-header__icon">
            <TrendingUp />
          </div>
          <h2>Mood Insights</h2>
        </div>
        <p className="text-muted">Start journaling to see mood insights</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="section-header">
        <div className="section-header__icon">
          <TrendingUp />
        </div>
        <h2>Mood Insights</h2>
      </div>

      {insights.length > 0 ? (
        <ul className="mood-insights-list">
          {insights.map((insight, i) => (
            <li key={i} className="mood-insight-item">
              <InsightIcon iconType={insight.iconType} />
              <span>{insight.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Not enough data yet for insights</p>
      )}

      {/* Time Range Filter Tabs */}
      <div className="mood-chart-filters">
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className={`mood-chart-filter-btn ${timeRange === value ? 'mood-chart-filter-btn--active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Always visible chart */}
      <div className="mood-insights-chart" style={{ marginTop: 'var(--space-3)' }}>
        <TrendsChart days={timeRange} />
      </div>
    </div>
  )
}
