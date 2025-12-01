'use client'

import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const [halfLife, setHalfLife] = useState(30)
  const [hardDelete, setHardDelete] = useState(false)

  // Sync state when settings load
  useEffect(() => {
    if (settings) {
      setHalfLife(settings?.search_half_life_days ?? 30)
      setHardDelete(settings?.privacy_hard_delete ?? false)
    }
  }, [settings])

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="container">Loading...</div>
      </ProtectedRoute>
    )
  }

  const handleSave = () => {
    updateMutation.mutate(
      {
        search_half_life_days: halfLife,
        privacy_hard_delete: hardDelete,
      },
      {
        onSuccess: () => alert('Settings updated!')
      }
    )
  }

  return (
    <ProtectedRoute>
      <div className="container">
        <Header title="Settings" showNav={false} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <Link href="/help" style={{ color: '#0070f3', textDecoration: 'underline' }}>
            Need help? View Help Page →
          </Link>
        </div>

        <div className="card">
          <h2>Search Settings</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="half-life" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Search Half-Life: {halfLife} days
            </label>
            <input
              id="half-life"
              type="range"
              min="1"
              max="365"
              value={halfLife}
              onChange={(e) => setHalfLife(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: '0.5rem' }}
            />
            <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#f5f5f5', borderRadius: '6px' }}>
              <p style={{ color: '#333', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                What does this do?
              </p>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                This controls how search results balance relevance vs. recency. When you search for entries, the system considers both how similar they are to your query AND how recent they are.
              </p>
              <ul style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                <li><strong>Lower values (1-15 days):</strong> Recent entries rank higher, even if slightly less relevant</li>
                <li><strong>Medium values (15-60 days):</strong> Balanced approach - both relevance and recency matter</li>
                <li><strong>Higher values (60-365 days):</strong> All entries treated equally by age - only relevance matters</li>
              </ul>
              <p style={{ color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>
                <strong>Example:</strong> With 7 days, a recent entry about "work stress" will rank above an older, more detailed entry about the same topic. With 90 days, the more detailed entry would rank higher.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Privacy Settings</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
                style={{ marginRight: '0.5rem', width: '1.2rem', height: '1.2rem' }}
              />
              Enable Hard Delete
            </label>
            <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#f5f5f5', borderRadius: '6px' }}>
              <p style={{ color: '#333', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                What does this do?
              </p>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                Controls what happens when you use the "Forget" feature on an entry.
              </p>
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <strong>When disabled (Soft Delete):</strong>
                </p>
                <ul style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1.5rem' }}>
                  <li>Entry is removed from search results</li>
                  <li>Entry content is preserved in your journal</li>
                  <li>You can still access it directly if you know the entry ID</li>
                  <li>Embedding vector is zeroed out (can't be found by search)</li>
                </ul>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <strong>When enabled (Hard Delete):</strong>
                </p>
                <ul style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1.5rem' }}>
                  <li>Entry is permanently deleted from the database</li>
                  <li>All associated data is removed (embeddings, attachments)</li>
                  <li>This action cannot be undone</li>
                  <li>Use this if you want complete removal for privacy</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={updateMutation.isPending}
          style={{ marginTop: '1rem' }}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </ProtectedRoute>
  )
}

