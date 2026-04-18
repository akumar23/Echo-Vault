'use client'

import { memo } from 'react'
import { Entry } from '@/lib/api'
import { format } from 'date-fns'
import { FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface EntryItemProps {
  entry: Entry
  onClick: (entry: Entry) => void
  maxPreviewLength?: number
}

function getPreview(content: string, maxLength = 80) {
  if (!content) return ''
  const firstSentence = content.split(/[.!?]/)[0]
  if (firstSentence.length <= maxLength) {
    return (
      firstSentence.trim() +
      (content.length > firstSentence.length ? '...' : '')
    )
  }
  return firstSentence.slice(0, maxLength).trim() + '...'
}

/**
 * Memoized entry item component for list rendering.
 * Prevents unnecessary re-renders when parent state changes.
 */
export const EntryItem = memo(function EntryItem({
  entry,
  onClick,
  maxPreviewLength = 80,
}: EntryItemProps) {
  return (
    <li
      className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
      onClick={() => onClick(entry)}
    >
      <div className="mt-0.5 text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {entry.title || 'Untitled'}
        </span>
        {entry.content && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {getPreview(entry.content, maxPreviewLength)}
          </p>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          {format(new Date(entry.created_at), 'MMM d, yyyy')}
        </div>
      </div>
    </li>
  )
})

/**
 * Skeleton loader for entry items
 */
export function EntryItemSkeleton() {
  return (
    <li
      className="flex items-start gap-3 px-4 py-3"
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-4 rounded-sm" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </li>
  )
}
