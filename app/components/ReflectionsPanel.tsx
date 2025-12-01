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
      <div className="scrollable-content" style={{
        overflowY: 'auto',
        flex: 1,
        scrollBehavior: 'smooth',
        paddingRight: '0.5rem'
      }}>
        Loading reflection...
      </div>
    )
  }

  if (error) {
    return (
      <div className="scrollable-content" style={{
        overflowY: 'auto',
        flex: 1,
        scrollBehavior: 'smooth',
        paddingRight: '0.5rem',
        color: 'red'
      }}>
        {error}
      </div>
    )
  }

  if (!reflection) {
    return (
      <div className="scrollable-content" style={{
        overflowY: 'auto',
        flex: 1,
        scrollBehavior: 'smooth',
        paddingRight: '0.5rem'
      }}>
        <p style={{ color: '#666' }}>No reflection available.</p>
      </div>
    )
  }

  if (reflection.status === 'generating') {
    return (
      <div className="scrollable-content" style={{
        overflowY: 'auto',
        flex: 1,
        scrollBehavior: 'smooth',
        paddingRight: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Generating reflection...</span>
        </div>
        {reflection.reflection && (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginTop: '0.5rem', opacity: 0.7 }}>
            {reflection.reflection}
          </div>
        )}
      </div>
    )
  }

  if (reflection.status === 'error') {
    return (
      <div className="scrollable-content" style={{
        overflowY: 'auto',
        flex: 1,
        scrollBehavior: 'smooth',
        paddingRight: '0.5rem',
        color: 'red'
      }}>
        {reflection.reflection}
      </div>
    )
  }

  return (
    <div className="scrollable-content" style={{
      overflowY: 'auto',
      flex: 1,
      scrollBehavior: 'smooth',
      paddingRight: '0.5rem'
    }}>
      {reflection.reflection ? (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{reflection.reflection}</div>
      ) : (
        <p style={{ color: '#666' }}>No reflection available. Create an entry to generate a reflection.</p>
      )}
    </div>
  )
}

export function ReflectionsPanel({}: ReflectionsPanelProps) {
  return (
    <ErrorBoundary
      fallback={
        <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
          <p style={{ color: '#856404' }}>
            Failed to load reflection. Please try refreshing the page.
          </p>
        </div>
      }
    >
      <ReflectionsPanelContent />
    </ErrorBoundary>
  )
}
