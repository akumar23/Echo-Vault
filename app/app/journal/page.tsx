'use client'

import Link from 'next/link'
import { format, startOfDay, subDays } from 'date-fns'
import { useMemo } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { InlineReflection } from '@/components/InlineReflection'
import { MoodInsights } from '@/components/MoodInsights'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ArrowRight,
  BookOpen,
  MessageCircle,
  PenLine,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MOOD_DOT: Record<number, string> = {
  1: 'bg-[color:var(--mood-1)]',
  2: 'bg-[color:var(--mood-2)]',
  3: 'bg-[color:var(--mood-3)]',
  4: 'bg-[color:var(--mood-4)]',
  5: 'bg-[color:var(--mood-5)]',
}

function getMoodDotClass(entry: {
  mood_user: number | null
  mood_inferred: number | null
}) {
  const mood = entry.mood_user ?? entry.mood_inferred
  return mood ? MOOD_DOT[mood] : 'bg-border'
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'
  return 'Good night'
}

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 transition-colors">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export default function JournalDashboard() {
  // Pull enough entries to compute this-week metrics and still show five.
  const { data: entries, isLoading: entriesLoading } = useEntries(0, 50)
  const { user } = useAuth()

  const greeting = getGreeting()
  const displayName = user?.username ?? 'there'

  const { entriesThisWeek, currentStreak, averageMood } = useMemo(() => {
    if (!entries || entries.length === 0) {
      return { entriesThisWeek: 0, currentStreak: 0, averageMood: null as number | null }
    }

    const today = startOfDay(new Date())
    const weekAgo = subDays(today, 7)

    const thisWeek = entries.filter(
      (e) => new Date(e.created_at) >= weekAgo,
    )

    // Compute current consecutive-day streak ending at today (or yesterday).
    const dateKeys = new Set(
      entries.map((e) => format(startOfDay(new Date(e.created_at)), 'yyyy-MM-dd')),
    )
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const key = format(subDays(today, i), 'yyyy-MM-dd')
      if (dateKeys.has(key)) {
        streak++
      } else if (i === 0) {
        // allow streak to start yesterday if no entry today yet
        continue
      } else {
        break
      }
    }

    const moods = entries
      .map((e) => e.mood_user ?? e.mood_inferred)
      .filter((m): m is number => m !== null && m !== undefined)
    const avg = moods.length > 0
      ? moods.reduce((sum, m) => sum + m, 0) / moods.length
      : null

    return {
      entriesThisWeek: thisWeek.length,
      currentStreak: streak,
      averageMood: avg,
    }
  }, [entries])

  const recentEntries = entries?.slice(0, 5) ?? []

  return (
    <ProtectedRoute>
      <Header />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        {/* Greeting */}
        <section className="mb-10">
          <p className="text-sm text-muted-foreground">
            {greeting}, {displayName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {format(new Date(), 'EEEE, MMMM d')}
          </h1>
        </section>

        {/* Stats row */}
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Entries this week"
            value={entriesLoading ? '—' : entriesThisWeek}
            hint={
              !entriesLoading && entriesThisWeek > 0
                ? 'Keep it up'
                : 'A gentle nudge'
            }
          />
          <StatCard
            label="Current streak"
            value={
              entriesLoading
                ? '—'
                : currentStreak > 0
                  ? `${currentStreak} day${currentStreak === 1 ? '' : 's'}`
                  : '—'
            }
            hint={
              !entriesLoading && currentStreak > 0
                ? 'Consecutive days'
                : 'Start today'
            }
          />
          <StatCard
            label="Average mood"
            value={
              entriesLoading
                ? '—'
                : averageMood !== null
                  ? `${averageMood.toFixed(1)} / 5`
                  : '—'
            }
            hint={
              !entriesLoading && averageMood !== null ? 'All time' : 'No data yet'
            }
          />
        </section>

        {/* Recent entries */}
        <section className="mb-8">
          <Card variant="bordered">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent entries</CardTitle>
              {entries && entries.length > 0 && (
                <Link
                  href="/entries"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  View all →
                </Link>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {entriesLoading ? (
                <div className="px-6 py-8 text-sm text-muted-foreground">
                  Loading entries…
                </div>
              ) : recentEntries.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {recentEntries.map((entry) => {
                    const moodDot = getMoodDotClass(entry)
                    const preview = entry.content
                      ? entry.content.replace(/\s+/g, ' ').slice(0, 120)
                      : ''
                    return (
                      <li key={entry.id}>
                        <Link
                          href={`/entries/${entry.id}`}
                          className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {entry.title || 'Untitled'}
                            </p>
                            {preview && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {preview}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(entry.created_at), 'MMM d')}
                            </span>
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                moodDot,
                              )}
                              aria-hidden="true"
                            />
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No entries yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Start writing to build your journal.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href="/new">
                      <PenLine className="h-3.5 w-3.5" />
                      Write your first entry
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Reflection */}
        <section className="mb-8">
          <Card variant="bordered">
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Reflection</CardTitle>
            </CardHeader>
            <CardContent>
              <ReflectionBlock />
            </CardContent>
          </Card>
        </section>

        {/* Chat CTA — entry point into the all-entries conversation */}
        <section className="mb-8">
          <Card variant="bordered">
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Chat with your journal
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Ask questions across every entry. Open a single entry to
                    scope the chat to just that one.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="self-start sm:self-auto">
                <Link href="/conversations">
                  Start chatting
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Mood trends */}
        <section className="mb-12">
          <Card variant="bordered">
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Mood trends</CardTitle>
            </CardHeader>
            <CardContent>
              <MoodInsights />
            </CardContent>
          </Card>
        </section>
      </main>
    </ProtectedRoute>
  )
}

/**
 * Thin wrapper around InlineReflection that provides a quiet empty state
 * when there's no reflection yet. The InlineReflection renders nothing
 * silently when empty; we need an affordance inside a card.
 */
function ReflectionBlock() {
  // Import inside to preserve the "no reflection -> renders null" semantics.
  // InlineReflection handles its own loading/error/ready states.
  return (
    <div className="min-h-[3rem]">
      <InlineReflection />
      <ReflectionEmptyState />
    </div>
  )
}

function ReflectionEmptyState() {
  // We rely on InlineReflection's absence of output. Use CSS to hide this
  // empty state when a sibling renders. Since InlineReflection either renders
  // an <aside> or null, we can use :has() or a JS fallback — simplest is to
  // just always render a muted fallback after it; InlineReflection's own
  // content will visually precede. This keeps markup simple.
  return (
    <p className="text-sm text-muted-foreground [&:not(:only-child)]:hidden">
      Your reflection will appear here once there&apos;s enough writing to
      ponder over. Come back after your next entry.
    </p>
  )
}
