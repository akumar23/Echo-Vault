'use client'

import { useEntries } from '@/hooks/useEntries'
import { ReflectionsPanel } from '@/components/ReflectionsPanel'
import { TrendsChart } from '@/components/TrendsChart'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import Link from 'next/link'
import { format } from 'date-fns'

export default function Dashboard() {
  const { data: entries, isLoading: entriesLoading } = useEntries(0, 5)

  return (
    <ProtectedRoute>
      <div className="container">
        <Header />

        <div className="grid-2 mb-5">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
            <h2>Recent Entries</h2>
            {entriesLoading ? (
              <p className="loading">Loading...</p>
            ) : entries && entries.length > 0 ? (
              <div className="scrollable-content flex-1">
                <ul style={{ listStyle: 'none' }}>
                  {entries.slice(0, 5).map((entry) => (
                    <li
                      key={entry.id}
                      style={{
                        marginBottom: 'var(--space-4)',
                        paddingBottom: 'var(--space-4)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <Link href={`/entries/${entry.id}`}>
                        <strong>{entry.title || 'Untitled'}</strong>
                        <p className="text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="empty-state">
                <p>No entries yet.</p>
                <p><Link href="/new">Create your first entry</Link></p>
              </div>
            )}
          </div>

          {entries && entries.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <h2>Reflection</h2>
              <ReflectionsPanel />
            </div>
          )}
        </div>

        <div className="card">
          <h2>Mood Trends</h2>
          <TrendsChart />
        </div>
      </div>
    </ProtectedRoute>
  )
}
