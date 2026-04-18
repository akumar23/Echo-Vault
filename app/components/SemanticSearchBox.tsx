'use client'

import { useState, memo } from 'react'
import { searchApi, SearchResult } from '@/lib/api'
import Link from 'next/link'
import { format } from 'date-fns'
import { ErrorBoundary } from './ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

// Memoized search result item to prevent unnecessary re-renders
const SearchResultItem = memo(function SearchResultItem({
  result,
}: {
  result: SearchResult
}) {
  return (
    <Link
      href={`/entries/${result.entry_id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
    >
      <Card variant="bordered" className="transition-colors hover:bg-muted/40">
        <CardContent className="space-y-2 p-4">
          <div className="font-medium text-foreground">
            {result.title || 'Untitled'}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{format(new Date(result.created_at), 'MMM d, yyyy')}</span>
            <span>Score: {result.score.toFixed(3)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {result.content.substring(0, 200)}
            {result.content.length > 200 ? '...' : ''}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
})

// Skeleton loader for search results
function SearchResultSkeleton() {
  return (
    <Card variant="bordered" aria-hidden="true">
      <CardContent className="space-y-2 p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </CardContent>
    </Card>
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
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          type="text"
          className="flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your entries semantically..."
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {searched && (
        <div className="space-y-3">
          {loading ? (
            <>
              <h3 className="text-sm font-medium text-muted-foreground">
                Searching...
              </h3>
              {[1, 2, 3].map((i) => (
                <SearchResultSkeleton key={i} />
              ))}
            </>
          ) : results.length > 0 ? (
            <>
              <h3 className="text-sm font-medium text-muted-foreground">
                Results ({results.length})
              </h3>
              {results.map((result) => (
                <SearchResultItem key={result.entry_id} result={result} />
              ))}
            </>
          ) : (
            <p className="text-muted-foreground">No results found.</p>
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
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load semantic search. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      }
    >
      <SemanticSearchBoxContent />
    </ErrorBoundary>
  )
}
