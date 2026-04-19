'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { useRelatedEntries } from '@/hooks/useEntries'

interface RelatedMemoriesProps {
  entryId: number
  k?: number
}

/**
 * RelatedMemories — semantically-similar past entries surfaced below the
 * current entry. Silent while the embedding job is still running (returns
 * null) so the UI stays calm for brand-new entries.
 */
export function RelatedMemories({ entryId, k = 3 }: RelatedMemoriesProps) {
  const { data, isLoading } = useRelatedEntries(entryId, k)

  if (isLoading) return null
  if (!data || data.length === 0) return null

  return (
    <section
      aria-label="Related memories"
      className="mt-10 border-t border-dashed border-border pt-6"
    >
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        <span className="mr-1.5" aria-hidden>
          ↳
        </span>
        {data.length} Related {data.length === 1 ? 'memory' : 'memories'} ·
        Surfaced by meaning
      </p>
      <ul className="space-y-1.5 font-mono text-sm">
        {data.map((entry) => (
          <li key={entry.entry_id}>
            <Link
              href={`/entries/${entry.entry_id}`}
              className="group inline-flex items-baseline gap-3 rounded-sm text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-primary" aria-hidden>
                ◆
              </span>
              <span className="tabular-nums text-muted-foreground">
                {format(new Date(entry.created_at), 'MMM dd')}
              </span>
              <span className="text-muted-foreground">—</span>
              <span className="max-w-[36ch] truncate group-hover:underline">
                {preview(entry)}
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
