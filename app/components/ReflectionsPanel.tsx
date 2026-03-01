'use client'

import ReactMarkdown from 'react-markdown'
import { useReflection } from '@/hooks/useReflection'
import { ErrorBoundary } from './ErrorBoundary'
import { Loader2, AlertCircle, FileText } from 'lucide-react'

interface ReflectionsPanelProps {}

function ReflectionsPanelContent({}: ReflectionsPanelProps) {
  const { reflection, isLoading, isStreaming, error } = useReflection()

  if (isLoading) {
    return (
      <div className="scrollable-content flex-1">
        <div className="flex items-center gap-2">
          <Loader2 size={18} className="loading" style={{ animation: 'spin 1s linear infinite' }} />
          <span className="text-muted">Loading reflection...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="scrollable-content flex-1">
        <div className="reflection reflection--error flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      </div>
    )
  }

  if (!reflection) {
    return (
      <div className="scrollable-content flex-1">
        <div className="flex items-center gap-2 text-muted">
          <FileText size={18} />
          <p>No reflection available.</p>
        </div>
      </div>
    )
  }

  if (reflection.status === 'generating') {
    return (
      <div className="scrollable-content flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 size={18} className="text-accent" style={{ animation: 'spin 1s linear infinite' }} />
          <span className="text-accent">
            Generating reflection...
            {isStreaming && <span className="text-muted ml-2">(streaming)</span>}
          </span>
        </div>
        {reflection.reflection && (
          <div className="reflection reflection--loading prose prose-sm">
            <ReactMarkdown>{reflection.reflection}</ReactMarkdown>
          </div>
        )}
      </div>
    )
  }

  if (reflection.status === 'error') {
    return (
      <div className="scrollable-content flex-1">
        <div className="reflection reflection--error prose prose-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} />
            <span>Error</span>
          </div>
          <ReactMarkdown>{reflection.reflection}</ReactMarkdown>
        </div>
      </div>
    )
  }

  return (
    <div className="scrollable-content flex-1">
      {reflection.reflection ? (
        <div className="reflection prose prose-sm">
          <ReactMarkdown>{reflection.reflection}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-muted">No reflection available. Create an entry to generate a reflection.</p>
      )}
    </div>
  )
}

export function ReflectionsPanel({}: ReflectionsPanelProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="alert alert--error">
          Failed to load reflection. Please try refreshing the page.
        </div>
      }
    >
      <ReflectionsPanelContent />
    </ErrorBoundary>
  )
}
