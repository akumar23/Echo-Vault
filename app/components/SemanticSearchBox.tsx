'use client'

import { useState } from 'react'
import { searchApi, SearchResult } from '@/lib/api'
import Link from 'next/link'
import { format } from 'date-fns'
import { ErrorBoundary } from './ErrorBoundary'

function SemanticSearchBoxContent() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)
    try {
      const data = await searchApi.semantic(query, 10)
      setResults(data)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your entries semantically..."
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {searched && (
        <div>
          {loading ? (
            <p>Searching...</p>
          ) : results.length > 0 ? (
            <div>
              <h3>Results ({results.length})</h3>
              {results.map((result, i) => (
                <div key={i} className="card" style={{ marginTop: '1rem' }}>
                  <Link href={`/entries/${result.entry_id}`}>
                    <h4>{result.title || 'Untitled'}</h4>
                    <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                      {format(new Date(result.created_at), 'MMM d, yyyy')} • Score: {result.score.toFixed(3)}
                    </p>
                    <p style={{ marginTop: '0.5rem' }}>
                      {result.content.substring(0, 200)}
                      {result.content.length > 200 ? '...' : ''}
                    </p>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p>No results found.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function SemanticSearchBox() {
  return (
    <ErrorBoundary
      fallback={
        <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
          <p style={{ color: '#856404' }}>
            Failed to load semantic search. Please try refreshing the page.
          </p>
        </div>
      }
    >
      <SemanticSearchBoxContent />
    </ErrorBoundary>
  )
}

