'use client'

import { useEntries } from '@/hooks/useEntries'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { MoodIndicator } from '@/components/MoodIndicator'
import Link from 'next/link'
import { format } from 'date-fns'

export default function EntriesPage() {
  const { data: entries, isLoading } = useEntries(0, 100)

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="container">
          <p className="loading">Loading...</p>
        </div>
      </ProtectedRoute>
    )
  }

  const getMoodClass = (entry: { mood_user: number | null; mood_inferred: number | null }) => {
    const mood = entry.mood_user ?? entry.mood_inferred
    return mood ? `entry-card--mood-${mood}` : ''
  }

  return (
    <ProtectedRoute>
      <div className="container">
        <div className="page-header">
          <h1>All Entries</h1>
          <div className="page-header-actions">
            <Link href="/new" className="btn btn-primary">
              + New Entry
            </Link>
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </div>

        {entries && entries.length > 0 ? (
          <div>
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                className={`entry-card ${getMoodClass(entry)}`}
              >
                <div className="entry-card__header">
                  <span className="entry-card__title">{entry.title || 'Untitled'}</span>
                  <span className="entry-card__date">
                    {format(new Date(entry.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="entry-card__preview">
                  {entry.content.substring(0, 200)}
                  {entry.content.length > 200 ? '...' : ''}
                </p>
                <div className="entry-card__footer">
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="tags-container">
                      {entry.tags.map((tag: string, i: number) => (
                        <span key={i} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  <MoodIndicator
                    moodUser={entry.mood_user}
                    moodInferred={entry.mood_inferred}
                  />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No entries yet.</p>
            <p><Link href="/new">Create your first entry</Link></p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
