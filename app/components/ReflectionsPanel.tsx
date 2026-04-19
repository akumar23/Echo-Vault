'use client'

import ReactMarkdown from 'react-markdown'
import { useReflection } from '@/hooks/useReflection'
import { ErrorBoundary } from './ErrorBoundary'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, FileText } from 'lucide-react'

function ReflectionsPanelContent() {
  const { reflection, isLoading, isStreaming, error } = useReflection()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading reflection...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!reflection) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="h-4 w-4" />
        <p>No reflection available.</p>
      </div>
    )
  }

  if (reflection.status === 'generating') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            Generating reflection...
            {isStreaming && (
              <span className="ml-2 text-muted-foreground">(streaming)</span>
            )}
          </span>
        </div>
        {reflection.reflection && (
          <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere] text-foreground opacity-80 [&_pre]:overflow-x-auto [&_pre]:max-w-full">
            <ReactMarkdown>{reflection.reflection}</ReactMarkdown>
          </div>
        )}
      </div>
    )
  }

  if (reflection.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere] [&_pre]:overflow-x-auto [&_pre]:max-w-full">
            <ReactMarkdown>{reflection.reflection}</ReactMarkdown>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div>
      {reflection.reflection ? (
        <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere] text-foreground [&_pre]:overflow-x-auto [&_pre]:max-w-full">
          <ReactMarkdown>{reflection.reflection}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-muted-foreground">
          No reflection available. Create an entry to generate a reflection.
        </p>
      )}
    </div>
  )
}

export function ReflectionsPanel() {
  return (
    <ErrorBoundary
      fallback={
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load reflection. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      }
    >
      <ReflectionsPanelContent />
    </ErrorBoundary>
  )
}
