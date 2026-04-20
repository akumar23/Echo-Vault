'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EntryReflection, reflectionsApi } from '@/lib/api'

interface UseEntryReflectionReturn {
  reflection: EntryReflection | null
  isLoading: boolean
  error: string | null
  regenerate: () => Promise<void>
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_MS = 3 * 60 * 1000

export function useEntryReflection(
  entryId: number | null,
  enabled: boolean = true,
): UseEntryReflectionReturn {
  const [reflection, setReflection] = useState<EntryReflection | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAtRef = useRef<number>(0)
  const mountedRef = useRef(true)
  const fetchOnceRef = useRef<(id: number) => Promise<void>>(async () => {})

  // Derived loading state — true while waiting for an initial fetch or polling
  // for a still-generating reflection. Switches off automatically on success
  // or error without touching setState from inside an effect.
  const isLoading =
    enabled &&
    entryId != null &&
    error == null &&
    (!reflection || reflection.status === 'generating')

  const clearPoll = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  const fetchOnce = useCallback(
    async (id: number) => {
      try {
        const data = await reflectionsApi.getForEntry(id)
        if (!mountedRef.current) return
        setReflection(data)
        setError(null)

        const isTerminal = data.status === 'complete' || data.status === 'error'
        const timedOut = Date.now() - startedAtRef.current > MAX_POLL_MS
        if (!isTerminal && !timedOut) {
          pollTimeoutRef.current = setTimeout(() => fetchOnceRef.current(id), POLL_INTERVAL_MS)
        }
      } catch {
        if (!mountedRef.current) return
        setError('Failed to load reflection')
      }
    },
    [],
  )

  useEffect(() => {
    fetchOnceRef.current = fetchOnce
  }, [fetchOnce])

  const regenerate = useCallback(async () => {
    if (entryId == null) return
    clearPoll()
    setError(null)
    setReflection(null)
    startedAtRef.current = Date.now()
    try {
      const data = await reflectionsApi.regenerateForEntry(entryId)
      if (!mountedRef.current) return
      setReflection(data)
      pollTimeoutRef.current = setTimeout(
        () => fetchOnce(entryId),
        POLL_INTERVAL_MS,
      )
    } catch {
      if (!mountedRef.current) return
      setError('Failed to regenerate reflection')
    }
  }, [entryId, clearPoll, fetchOnce])

  useEffect(() => {
    mountedRef.current = true
    if (!enabled || entryId == null) {
      return
    }
    startedAtRef.current = Date.now()
    // Defer so setState inside fetchOnce doesn't trigger during effect commit.
    queueMicrotask(() => {
      if (mountedRef.current) fetchOnce(entryId)
    })

    return () => {
      mountedRef.current = false
      clearPoll()
    }
  }, [entryId, enabled, fetchOnce, clearPoll])

  return { reflection, isLoading, error, regenerate }
}
