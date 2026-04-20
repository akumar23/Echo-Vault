'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { useEchoes } from '@/hooks/useEntries'

interface EchoesProps {
  entryId: number
  k?: number
}

/**
 * Echoes — entries across the user's journal that semantically resonate with
 * the current one, surfaced with a brief LLM-generated observation about what
 * connects them.
 *
 * Renders nothing when the user has no other entries (empty) or when the
 * current entry's embedding is still being generated (pending) — so new
 * users and new entries stay quiet.
 */
export function Echoes({ entryId, k = 3 }: EchoesProps) {
  const { data, isLoading } = useEchoes(entryId, k)

  if (isLoading) return null
  if (!data) return null
  if (data.status !== 'complete' || data.echoes.length === 0) return null

  return (
    <section
      aria-label="Echoes"
      className="mt-10 border-t border-dashed border-border pt-6"
    >
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        <span className="mr-1.5" aria-hidden>
          ⟲
        </span>
        {data.echoes.length} {data.echoes.length === 1 ? 'Echo' : 'Echoes'} ·
        Resonant entries
      </p>

      {data.framing && (
        <p className="mb-5 text-sm italic leading-relaxed text-muted-foreground">
          {data.framing}
        </p>
      )}

      <ul className="space-y-1.5 font-mono text-sm">
        {data.echoes.map((echo) => (
          <li key={echo.entry_id}>
            <Link
              href={`/entries/${echo.entry_id}`}
              className="group inline-flex items-baseline gap-3 rounded-sm text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-primary" aria-hidden>
                ◆
              </span>
              <span className="tabular-nums text-muted-foreground">
                {format(new Date(echo.created_at), 'MMM dd, yyyy')}
              </span>
              <span className="text-muted-foreground">—</span>
              <span className="max-w-[36ch] truncate group-hover:underline">
                {preview(echo)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function preview({
  title,
  content,
}: {
  title: string | null
  content: string
}): string {
  if (title && title.trim()) return title
  const firstLine = content.split('\n').find((line) => line.trim())
  return firstLine?.trim() || 'Untitled'
}
