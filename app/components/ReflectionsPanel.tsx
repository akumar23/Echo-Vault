'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { reflectionsApi, Reflection } from '@/lib/api'
import { ErrorBoundary } from './ErrorBoundary'
import { Loader2, AlertCircle, FileText } from 'lucide-react'

interface ReflectionsPanelProps {}

function ReflectionsPanelContent({}: ReflectionsPanelProps) {
  const [reflection, setReflection] = useState<Reflection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const fetchReflection = useCallback(async () => {
    try {
      const data = await reflectionsApi.get()
      if (mountedRef.current) {
        setReflection(data)
        setError('')

        // If still generating, continue polling
        if (data.status === 'generating') {
          pollIntervalRef.current = setTimeout(fetchReflection, 2000)
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Failed to load reflection')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    // Check for auth token
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) {
      setError('Authentication required. Please log in.')
      setLoading(false)
      return
    }

    // Fetch reflection on mount
    fetchReflection()

    return () => {
      mountedRef.current = false
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current)
      }
    }
  }, [fetchReflection])

  if (loading) {
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
          <span className="text-accent">Generating reflection...</span>
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
