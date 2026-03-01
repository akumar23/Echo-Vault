'use client'

import { memo } from 'react'
import { Entry } from '@/lib/api'
import { format } from 'date-fns'
import { FileText } from 'lucide-react'

interface EntryItemProps {
  entry: Entry
  onClick: (entry: Entry) => void
  maxPreviewLength?: number
}

function getPreview(content: string, maxLength = 80) {
  if (!content) return ''
  const firstSentence = content.split(/[.!?]/)[0]
  if (firstSentence.length <= maxLength) {
    return firstSentence.trim() + (content.length > firstSentence.length ? '...' : '')
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
  maxPreviewLength = 80
}: EntryItemProps) {
  return (
    <li
      className="entry-item"
      onClick={() => onClick(entry)}
      style={{
        paddingBottom: 'var(--space-4)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="entry-item__icon">
        <FileText size={18} />
      </div>
      <div className="entry-item__content">
        <span className="entry-item__title">{entry.title || 'Untitled'}</span>
        {entry.content && (
          <p className="entry-item__preview">{getPreview(entry.content, maxPreviewLength)}</p>
        )}
        <div className="entry-item__meta">
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
      className="entry-item"
      style={{
        paddingBottom: 'var(--space-4)',
        borderBottom: '1px solid var(--border)',
      }}
      aria-hidden="true"
    >
      <div className="entry-item__icon">
        <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 'var(--radius-sm)' }} />
      </div>
      <div className="entry-item__content" style={{ flex: 1 }}>
        <div className="skeleton skeleton--text skeleton--title" />
        <div className="skeleton skeleton--text skeleton--preview" />
        <div className="skeleton skeleton--text skeleton--meta" style={{ marginTop: 'var(--space-2)' }} />
      </div>
    </li>
  )
}
