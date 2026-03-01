'use client'

import { useState, memo } from 'react'
import { searchApi, SearchResult } from '@/lib/api'
import Link from 'next/link'
import { format } from 'date-fns'
import { ErrorBoundary } from './ErrorBoundary'

// Memoized search result item to prevent unnecessary re-renders
const SearchResultItem = memo(function SearchResultItem({ result }: { result: SearchResult }) {
  return (
    <Link
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
  )
})

// Skeleton loader for search results
function SearchResultSkeleton() {
  return (
    <div className="search-result search-result--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--text skeleton--title" />
      <div className="skeleton skeleton--text skeleton--meta" />
      <div className="skeleton skeleton--text skeleton--preview" />
      <div className="skeleton skeleton--text skeleton--preview-short" />
    </div>
  )
}

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
            <div>
              <h3 className="mb-4">Searching...</h3>
              {[1, 2, 3].map((i) => (
                <SearchResultSkeleton key={i} />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div>
              <h3 className="mb-4">Results ({results.length})</h3>
              {results.map((result) => (
                <SearchResultItem key={result.entry_id} result={result} />
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
