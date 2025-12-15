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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
            <h2 style={{ marginBottom: '1rem', flexShrink: 0 }}>Recent Entries</h2>
            {entriesLoading ? (
              <p>Loading...</p>
            ) : entries && entries.length > 0 ? (
              <div className="scrollable-content" style={{
                overflowY: 'auto',
                flex: 1,
                scrollBehavior: 'smooth',
                paddingRight: '0.5rem'
              }}>
                <ul style={{ listStyle: 'none' }}>
                  {entries.slice(0, 5).map((entry) => (
                    <li key={entry.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
                      <Link href={`/entries/${entry.id}`}>
                        <strong>{entry.title || 'Untitled'}</strong>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>No entries yet. <Link href="/new">Create your first entry</Link></p>
            )}
          </div>

          {entries && entries.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <h2 style={{ marginBottom: '1rem', flexShrink: 0 }}>Reflection</h2>
              <ReflectionsPanel />
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Mood Trends</h2>
          <TrendsChart />
        </div>
      </div>
    </ProtectedRoute>
  )
}
