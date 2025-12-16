'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { reflectionsApi, Reflection } from '@/lib/api'
import { ErrorBoundary } from './ErrorBoundary'

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
        <span className="loading">Loading reflection...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="scrollable-content flex-1">
        <div className="reflection reflection--error">{error}</div>
      </div>
    )
  }

  if (!reflection) {
    return (
      <div className="scrollable-content flex-1">
        <p className="text-muted">No reflection available.</p>
      </div>
    )
  }

  if (reflection.status === 'generating') {
    return (
      <div className="scrollable-content flex-1">
        <div className="flex items-center gap-2 mb-4">
          <span className="loading">Generating reflection...</span>
        </div>
        {reflection.reflection && (
          <div className="reflection reflection--loading">
            {reflection.reflection}
          </div>
        )}
      </div>
    )
  }

  if (reflection.status === 'error') {
    return (
      <div className="scrollable-content flex-1">
        <div className="reflection reflection--error">
          {reflection.reflection}
        </div>
      </div>
    )
  }

  return (
    <div className="scrollable-content flex-1">
      {reflection.reflection ? (
        <div className="reflection">{reflection.reflection}</div>
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
