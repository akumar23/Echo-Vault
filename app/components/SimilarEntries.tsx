'use client'

import { useMemo } from 'react'
import { useEntries } from '@/hooks/useEntries'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'

const MOOD_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
}

interface SimilarEntry {
  id: number
  title: string | null
  content: string
  mood: number
  created_at: string
}

export function SimilarEntries() {
  const { data: entries } = useEntries(0, 50)

  const analysis = useMemo(() => {
    if (!entries || entries.length < 5) {
      return { showPanel: false, recentMood: null, similarEntries: [] }
    }

    // Get recent mood (average of last 3 entries)
    const recentMoods = entries
      .slice(0, 3)
      .map(e => e.mood_user ?? e.mood_inferred)
      .filter((m): m is number => m !== null)

    if (recentMoods.length === 0) {
      return { showPanel: false, recentMood: null, similarEntries: [] }
    }

    const recentMood = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length

    // Only show if mood is high (4+)
    if (recentMood < 4) {
      return { showPanel: false, recentMood, similarEntries: [] }
    }

    // Find past entries with similar high mood (excluding recent ones)
    const recentIds = new Set(entries.slice(0, 3).map(e => e.id))
    const similarEntries: SimilarEntry[] = entries
      .filter(e => {
        if (recentIds.has(e.id)) return false
        const mood = e.mood_user ?? e.mood_inferred
        return mood !== null && mood >= 4
      })
      .slice(0, 3)
      .map(e => ({
        id: e.id,
        title: e.title,
        content: e.content,
        mood: (e.mood_user ?? e.mood_inferred) as number,
        created_at: e.created_at,
      }))

    return {
      showPanel: similarEntries.length > 0,
      recentMood,
      similarEntries,
    }
  }, [entries])

  if (!analysis.showPanel) {
    return null
  }

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true })
    }
    return format(date, 'MMM d, yyyy')
  }

  const getPreview = (content: string, maxLength = 100) => {
    if (!content) return ''
    const firstLine = content.split('\n')[0]
    if (firstLine.length <= maxLength) {
      return firstLine
    }
    return firstLine.slice(0, maxLength).trim() + '...'
  }

  return (
    <div className="similar-entries">
      <div className="similar-entries__header">
        <span className="similar-entries__icon">✨</span>
        <div>
          <h3 className="similar-entries__title">You're in a good place!</h3>
          <p className="similar-entries__subtitle">
            Here are some past moments when you felt this good
          </p>
        </div>
      </div>

      <div className="similar-entries__list">
        {analysis.similarEntries.map((entry) => (
          <Link
            key={entry.id}
            href={`/entries/${entry.id}`}
            className="similar-entry-card"
          >
            <span className="similar-entry-card__emoji">
              {MOOD_EMOJIS[entry.mood]}
            </span>
            <div className="similar-entry-card__content">
              <h4 className="similar-entry-card__title">
                {entry.title || 'Untitled'}
              </h4>
              <p className="similar-entry-card__meta">
                {getTimeAgo(entry.created_at)}
              </p>
              <p className="similar-entry-card__preview">
                {getPreview(entry.content)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
