'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'

/**
 * Detects online/offline status and shows toast notifications.
 * Also displays a persistent banner when offline.
 */
export function OfflineDetector() {
  const { toast } = useToast()
  const [isOffline, setIsOffline] = useState(false)
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false)

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine)

    const handleOnline = () => {
      setIsOffline(false)
      if (hasShownOfflineToast) {
        toast({ message: "You're back online!", type: 'success' })
      }
    }

    const handleOffline = () => {
      setIsOffline(true)
      setHasShownOfflineToast(true)
      toast({
        message: "You're offline. Some features may not work.",
        type: 'warning',
        duration: 6000,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [toast, hasShownOfflineToast])

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
