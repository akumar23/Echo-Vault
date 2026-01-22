'use client'

import { useEffect, useState, useCallback } from 'react'

interface HealthStatus {
  api: boolean
  database: boolean
  ollama: boolean
  message: string
}

/**
 * Check if running inside Tauri desktop app
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

/**
 * Hook for Tauri-specific functionality
 * Returns null values when not running in Tauri
 */
export function useTauri() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  useEffect(() => {
    setIsDesktop(isTauri())
  }, [])

  const checkBackendHealth = useCallback(async (): Promise<HealthStatus | null> => {
    if (!isDesktop) return null

    setIsCheckingHealth(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const status = await invoke<HealthStatus>('check_backend_health')
      setHealthStatus(status)
      return status
    } catch (error) {
      console.error('Failed to check backend health:', error)
      const errorStatus: HealthStatus = {
        api: false,
        database: false,
        ollama: false,
        message: 'Failed to check backend status',
      }
      setHealthStatus(errorStatus)
      return errorStatus
    } finally {
      setIsCheckingHealth(false)
    }
  }, [isDesktop])

  const openExternalUrl = useCallback(async (url: string): Promise<void> => {
    if (!isDesktop) {
      window.open(url, '_blank')
      return
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_external_url', { url })
    } catch (error) {
      console.error('Failed to open URL:', error)
      // Fallback to browser
      window.open(url, '_blank')
    }
  }, [isDesktop])

  const showNotification = useCallback(async (title: string, body: string): Promise<void> => {
    if (!isDesktop) {
      // Use browser notifications as fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
      return
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('show_notification', { title, body })
    } catch (error) {
      console.error('Failed to show notification:', error)
    }
  }, [isDesktop])

  return {
    isDesktop,
    healthStatus,
    isCheckingHealth,
    checkBackendHealth,
    openExternalUrl,
    showNotification,
  }
}
