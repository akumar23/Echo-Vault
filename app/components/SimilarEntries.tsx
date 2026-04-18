'use client'

import { useMemo } from 'react'
import { useEntries } from '@/hooks/useEntries'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

const MOOD_EMOJIS: Record<number, string> = {
  1: '\u{1F622}',
  2: '\u{1F615}',
  3: '\u{1F610}',
  4: '\u{1F642}',
  5: '\u{1F60A}',
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
      .map((e) => e.mood_user ?? e.mood_inferred)
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
    const recentIds = new Set(entries.slice(0, 3).map((e) => e.id))
    const similarEntries: SimilarEntry[] = entries
      .filter((e) => {
        if (recentIds.has(e.id)) return false
        const mood = e.mood_user ?? e.mood_inferred
        return mood !== null && mood >= 4
      })
      .slice(0, 3)
      .map((e) => ({
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
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    )

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
    <Card variant="bordered" className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">
              You&apos;re in a good place!
            </h3>
            <p className="text-sm text-muted-foreground">
              Here are some past moments when you felt this good
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {analysis.similarEntries.map((entry) => (
            <Link
              key={entry.id}
              href={`/entries/${entry.id}`}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <Card variant="bordered" className="h-full transition-colors hover:bg-background/60">
                <CardContent className="space-y-1.5 p-3">
                  <div className="flex items-start gap-2">
                    <span
                      className="text-lg leading-none"
                      aria-hidden="true"
                    >
                      {MOOD_EMOJIS[entry.mood]}
                    </span>
                    <h4 className="flex-1 line-clamp-1 text-sm font-medium text-foreground">
                      {entry.title || 'Untitled'}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getTimeAgo(entry.created_at)}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {getPreview(entry.content)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
