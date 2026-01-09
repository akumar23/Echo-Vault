'use client'

import { useState } from 'react'
import { useEntry } from '@/hooks/useEntries'
import { useUpdateEntry, useDeleteEntry, useForgetEntry } from '@/hooks/useEntryMutations'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { WritingEditor } from '@/components/WritingEditor'
import { ReflectionsPanel } from '@/components/ReflectionsPanel'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function EntryDetailPage() {
  const params = useParams()
  const entryId = parseInt(params.id as string)
  const [showReflection, setShowReflection] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const { data: entry, isLoading } = useEntry(entryId)
  const updateMutation = useUpdateEntry(entryId)
  const deleteMutation = useDeleteEntry()
  const forgetMutation = useForgetEntry()

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="writing-page">
          <p className="loading">Loading...</p>
        </div>
      </ProtectedRoute>
    )
  }

  if (!entry) {
    return (
      <ProtectedRoute>
        <div className="writing-page">
          <div className="alert alert--error">Entry not found</div>
          <Link href="/entries" className="btn btn-secondary">
            Back to Entries
          </Link>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="writing-page">
        {/* Minimal navigation bar */}
        <nav className="writing-page__nav">
          <Link href="/entries" className="writing-page__back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
              {format(new Date(entry.created_at), 'MMM d, yyyy')}
            </span>
            <ThemeToggle />
          </div>
        </nav>

        <WritingEditor
          entry={entry}
          onSave={(data) => updateMutation.mutateAsync(data)}
          saving={updateMutation.isPending}
        />

        {/* Expandable sections */}
        <div className="entry-extras">
          {/* Reflection toggle */}
          <button
            type="button"
            className={`entry-extras__toggle ${showReflection ? 'active' : ''}`}
            onClick={() => setShowReflection(!showReflection)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            AI Reflection
            <svg
              className={`entry-extras__chevron ${showReflection ? 'open' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showReflection && (
            <div className="entry-extras__panel">
              <ReflectionsPanel />
            </div>
          )}

          {/* Actions toggle */}
          <button
            type="button"
            className={`entry-extras__toggle entry-extras__toggle--danger ${showActions ? 'active' : ''}`}
            onClick={() => setShowActions(!showActions)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Danger Zone
            <svg
              className={`entry-extras__chevron ${showActions ? 'open' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showActions && (
            <div className="entry-extras__panel entry-extras__panel--danger">
              <p className="text-muted mb-4" style={{ fontSize: 'var(--text-sm)' }}>
                These actions cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => forgetMutation.mutate(entryId)}
                  className="btn btn-secondary"
                  disabled={forgetMutation.isPending}
                >
                  {forgetMutation.isPending ? 'Forgetting...' : 'Forget'}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(entryId)}
                  className="btn btn-danger"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
