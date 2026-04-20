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
  reflection: Reflection | null
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  regenerate: () => Promise<void>
}

/**
 * Hook for managing reflection state via Server-Sent Events (SSE).
 *
 * Auth: the access_token httpOnly cookie is sent automatically by the browser
 * via { withCredentials: true } on the EventSource. No token in the URL.
 *
 * Optimizations:
 * - Auto-disconnects when browser tab is hidden (saves resources)
 * - Auto-reconnects when tab becomes visible
 * - Closes automatically when reflection is complete
 * - Reduces Redis operations by ~70% compared to polling
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

  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onComplete, onError])

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsStreaming(false)
  }, [])

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return

    closeConnection()

    const url = process.env.NEXT_PUBLIC_TAURI_BUILD === 'true'
      ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/reflections/stream`
      : '/api/reflections/stream'

    try {
      // withCredentials sends the httpOnly access_token cookie automatically
      const eventSource = new EventSource(url, { withCredentials: true })
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

          if (data.status === 'complete' || data.status === 'error') {
            closeConnection()

            if (data.status === 'complete') onCompleteRef.current?.(data)
            if (data.status === 'error') onErrorRef.current?.(data.reflection)
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSource.onerror = () => {
        if (!mountedRef.current) return

        if (eventSource.readyState === EventSource.CLOSED) {
          closeConnection()
          setError('Connection lost. Please refresh the page.')
          setIsLoading(false)
          onErrorRef.current?.('Connection lost')
        }
      }
    } catch {
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
      connectSSE()
    } catch {
      setError('Failed to regenerate reflection')
      setIsLoading(false)
      onErrorRef.current?.('Failed to regenerate')
    }
  }, [connectSSE])

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        closeConnection()
      } else {
        const currentStatus = reflection?.status
        if (!currentStatus || currentStatus === 'generating') {
          connectSSE()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, reflection?.status, connectSSE, closeConnection])

  useEffect(() => {
    mountedRef.current = true

    // Defer setState-triggering work so it doesn't run synchronously in the
    // effect body. This avoids cascading renders while preserving behavior.
    if (enabled && !document.hidden) {
      queueMicrotask(() => {
        if (mountedRef.current) connectSSE()
      })
    } else if (!enabled) {
      queueMicrotask(() => {
        if (!mountedRef.current) return
        closeConnection()
        setIsLoading(false)
      })
    }

    return () => {
      mountedRef.current = false
      closeConnection()
    }
  }, [enabled, connectSSE, closeConnection])

  return { reflection, isLoading, isStreaming, error, regenerate }
}
