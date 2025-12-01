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
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [ollamaUrlError, setOllamaUrlError] = useState('')

  // Sync state when settings load
  useEffect(() => {
    if (settings) {
      setHalfLife(settings?.search_half_life_days ?? 30)
      setHardDelete(settings?.privacy_hard_delete ?? false)
      setOllamaUrl(settings?.ollama_url ?? '')
    }
  }, [settings])

  const validateOllamaUrl = (url: string): boolean => {
    if (!url) return true // Empty is valid (uses default)
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setOllamaUrlError('URL must use http:// or https://')
        return false
      }
      setOllamaUrlError('')
      return true
    } catch {
      setOllamaUrlError('Please enter a valid URL (e.g., http://localhost:11434)')
      return false
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="container">Loading...</div>
      </ProtectedRoute>
    )
  }

  const handleSave = () => {
    if (!validateOllamaUrl(ollamaUrl)) {
      return
    }

    updateMutation.mutate(
      {
        search_half_life_days: halfLife,
        privacy_hard_delete: hardDelete,
        ollama_url: ollamaUrl || null,
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
          <h2>LLM Settings</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="ollama-url" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Custom Ollama/LLM URL
            </label>
            <input
              id="ollama-url"
              type="url"
              value={ollamaUrl}
              onChange={(e) => {
                setOllamaUrl(e.target.value)
                if (ollamaUrlError) validateOllamaUrl(e.target.value)
              }}
              onBlur={(e) => validateOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: ollamaUrlError ? '2px solid #dc3545' : '1px solid #ccc',
                borderRadius: '6px',
                marginTop: '0.5rem',
              }}
            />
            {ollamaUrlError && (
              <p style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {ollamaUrlError}
              </p>
            )}
            <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#f5f5f5', borderRadius: '6px' }}>
              <p style={{ color: '#333', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                What does this do?
              </p>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                By default, EchoVault uses the Ollama server configured by the system administrator. You can override this to use your own Ollama instance or any compatible LLM API.
              </p>
              <ul style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                <li><strong>Leave empty:</strong> Use the default system Ollama server</li>
                <li><strong>Local Ollama:</strong> Use <code>http://localhost:11434</code></li>
                <li><strong>Remote server:</strong> Use your own server URL (e.g., <code>http://192.168.1.100:11434</code>)</li>
              </ul>
              <p style={{ color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>
                <strong>Note:</strong> The server must be running Ollama and have the required models installed (embedding and reflection models).
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

