'use client'

import { useState, useMemo } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, Search, BookOpen } from 'lucide-react'
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

export default function EntriesPage() {
  const { data: entries, isLoading } = useEntries(0, 100)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => {
      const hay =
        `${e.title ?? ''} ${e.content ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [entries, query])

  return (
    <ProtectedRoute>
      <Header />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Entries
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All your journal entries.{' '}
              {entries && (
                <>
                  <span className="tabular-nums">{entries.length}</span>{' '}
                  total
                </>
              )}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/new">
              <Plus className="h-3.5 w-3.5" />
              New entry
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, content, or tag"
            className="pl-9"
            aria-label="Filter entries"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((entry) => {
              const moodDot = getMoodDotClass(entry)
              const preview = entry.content
                ? entry.content.replace(/\s+/g, ' ').slice(0, 200)
                : ''
              return (
                <Link
                  key={entry.id}
                  href={`/entries/${entry.id}`}
                  className="block rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border-light hover:bg-muted/40 focus-visible:border-primary focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold text-foreground">
                        {entry.title || 'Untitled'}
                      </h2>
                      {preview && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {preview}
                        </p>
                      )}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {entry.tags.length > 3 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              +{entry.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), 'MMM d, yyyy')}
                      </span>
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', moodDot)}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-card py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No entries match &ldquo;{query}&rdquo;.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                No entries yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Capture your first thought.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/new">
                <Plus className="h-3.5 w-3.5" />
                Write your first entry
              </Link>
            </Button>
          </div>
        )}
      </main>
    </ProtectedRoute>
  )
}
