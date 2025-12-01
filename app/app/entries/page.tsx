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
    return <div className="container">Loading...</div>
  }

  return (
    <ProtectedRoute>
      <div className="container">
      <div className="page-header">
        <h1>All Entries</h1>
        <div className="page-header-actions">
          <Link
            href="/new"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem'
            }}
          >
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span>
            New Entry
          </Link>
          <Link
            href="/"
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⌂</span>
            Home
          </Link>
        </div>
      </div>

      {entries && entries.length > 0 ? (
        <div>
          {entries.map((entry) => (
            <div key={entry.id} className="card" style={{ position: 'relative' }}>
              <Link href={`/entries/${entry.id}`}>
                <h2>{entry.title || 'Untitled'}</h2>
                <p style={{ color: '#666', marginTop: '0.5rem' }}>
                  {format(new Date(entry.created_at), 'MMMM d, yyyy')}
                </p>
                <p style={{ marginTop: '1rem' }}>
                  {entry.content.substring(0, 200)}
                  {entry.content.length > 200 ? '...' : ''}
                </p>
                {entry.tags && entry.tags.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    {entry.tags.map((tag: string, i: number) => (
                      <span key={i} style={{
                        display: 'inline-block',
                        background: '#f0f0f0',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        marginRight: '0.5rem',
                        fontSize: '0.9rem'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                right: '1rem',
              }}>
                <MoodIndicator
                  moodUser={entry.mood_user}
                  moodInferred={entry.mood_inferred}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <p>No entries yet. <Link href="/new">Create your first entry</Link></p>
        </div>
      )}
      </div>
    </ProtectedRoute>
  )
}

