'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useToast } from '@/contexts/ToastContext'

const subscribeOnlineStatus = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getOnlineSnapshot = () => !navigator.onLine
const getServerSnapshot = () => false

/**
 * Detects online/offline status and shows toast notifications.
 * Also displays a persistent banner when offline.
 */
export function OfflineDetector() {
  const { toast } = useToast()
  const isOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerSnapshot,
  )
  const hasShownOfflineToastRef = useRef(false)
  const prevIsOfflineRef = useRef(isOffline)

  useEffect(() => {
    if (isOffline === prevIsOfflineRef.current) return

    if (isOffline) {
      hasShownOfflineToastRef.current = true
      toast({
        message: "You're offline. Some features may not work.",
        type: 'warning',
        duration: 6000,
      })
    } else if (hasShownOfflineToastRef.current) {
      toast({ message: "You're back online!", type: 'success' })
    }

    prevIsOfflineRef.current = isOffline
  }, [isOffline, toast])

  if (!isOffline) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9998] bg-[color:var(--warning)] px-4 py-3 text-center text-sm font-medium text-white shadow-lg"
      role="alert"
      aria-live="assertive"
    >
      You are currently offline. Changes may not be saved.
    </div>
  )
}
