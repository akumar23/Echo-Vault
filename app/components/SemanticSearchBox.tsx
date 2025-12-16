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
      <form onSubmit={handleSearch} className="search-form mb-5">
        <input
          type="text"
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your entries semantically..."
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searched && (
        <div className="search-results">
          {loading ? (
            <p className="loading">Searching...</p>
          ) : results.length > 0 ? (
            <div>
              <h3 className="mb-4">Results ({results.length})</h3>
              {results.map((result, i) => (
                <Link
                  key={i}
                  href={`/entries/${result.entry_id}`}
                  className="search-result"
                  style={{ display: 'block' }}
                >
                  <div className="search-result__title">
                    {result.title || 'Untitled'}
                  </div>
                  <div className="search-result__meta">
                    <span>{format(new Date(result.created_at), 'MMM d, yyyy')}</span>
                    <span className="search-result__score">
                      Score: {result.score.toFixed(3)}
                    </span>
                  </div>
                  <p className="search-result__preview">
                    {result.content.substring(0, 200)}
                    {result.content.length > 200 ? '...' : ''}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted">No results found.</p>
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
        <div className="alert alert--error">
          Failed to load semantic search. Please try refreshing the page.
        </div>
      }
    >
      <SemanticSearchBoxContent />
    </ErrorBoundary>
  )
}
