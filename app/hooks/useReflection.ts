'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Reflection, reflectionsApi } from '@/lib/api'

interface UseReflectionOptions {
  /** Whether to enable the SSE connection. Default: true */
  enabled?: boolean
  /** Callback when reflection generation completes */
  onComplete?: (reflection: Reflection) => void
  /** Callback on error */
  onError?: (error: string) => void
}

interface UseReflectionReturn {
  /** Current reflection data */
  reflection: Reflection | null
  /** True while initially loading */
  isLoading: boolean
  /** True while connected to SSE stream */
  isStreaming: boolean
  /** Error message if any */
  error: string | null
  /** Trigger regeneration of reflection */
  regenerate: () => Promise<void>
}

/**
 * Hook for managing reflection state via Server-Sent Events (SSE).
 *
 * Replaces HTTP polling with a persistent SSE connection that:
 * - Receives real-time updates from the server
 * - Auto-disconnects when tab is hidden (saves resources)
 * - Auto-reconnects when tab becomes visible
 * - Closes automatically when reflection is complete
 *
 * This reduces Redis operations by ~70% compared to polling.
 */
export function useReflection({
  enabled = true,
  onComplete,
  onError,
}: UseReflectionOptions = {}): UseReflectionReturn {
  const [reflection, setReflection] = useState<Reflection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Keep callbacks in refs to avoid recreating connectSSE
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsStreaming(false)
  }, [])

  const connectSSE = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) {
      setError('Authentication required. Please log in.')
      setIsLoading(false)
      return
    }

    // Don't connect if already connected
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return
    }

    // Close any existing connection
    closeConnection()

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const url = `${apiUrl}/reflections/stream?token=${encodeURIComponent(token)}`

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource
      setIsStreaming(true)
      setError(null)

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const data = JSON.parse(event.data) as Reflection
          setReflection(data)
          setError(null)
          setIsLoading(false)

          // Close connection when generation is complete
          if (data.status === 'complete' || data.status === 'error') {
            closeConnection()

            if (data.status === 'complete' && onCompleteRef.current) {
              onCompleteRef.current(data)
            }
            if (data.status === 'error' && onErrorRef.current) {
              onErrorRef.current(data.reflection)
            }
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSource.onerror = () => {
        if (!mountedRef.current) return

        // EventSource auto-reconnects on some errors, but CLOSED means permanent failure
        if (eventSource.readyState === EventSource.CLOSED) {
          closeConnection()
          setError('Connection lost. Please refresh the page.')
          setIsLoading(false)
          onErrorRef.current?.('Connection lost')
        }
      }
    } catch (e) {
      setError('Failed to connect to reflection stream')
      setIsLoading(false)
    }
  }, [closeConnection])

  const regenerate = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setReflection(null)

    try {
      await reflectionsApi.regenerate()
      // Reconnect SSE to get updates
      connectSSE()
    } catch (e) {
      setError('Failed to regenerate reflection')
      setIsLoading(false)
      onErrorRef.current?.('Failed to regenerate')
    }
  }, [connectSSE])

  // Handle visibility changes - pause streaming when tab is hidden
  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - disconnect to save resources
        closeConnection()
      } else {
        // Tab visible - reconnect if we need updates
        const currentStatus = reflection?.status
        if (!currentStatus || currentStatus === 'generating') {
          connectSSE()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, reflection?.status, connectSSE, closeConnection])

  // Initial connection
  useEffect(() => {
    mountedRef.current = true

    if (enabled && !document.hidden) {
      connectSSE()
    } else if (!enabled) {
      closeConnection()
      setIsLoading(false)
    }

    return () => {
      mountedRef.current = false
      closeConnection()
    }
  }, [enabled, connectSSE, closeConnection])

  return {
    reflection,
    isLoading,
    isStreaming,
    error,
    regenerate,
  }
}
