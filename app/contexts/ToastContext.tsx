'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (options: { message: string; type?: ToastType; duration?: number }) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(onRemove, 200) // Wait for exit animation
    }, toast.duration)

    return () => clearTimeout(timer)
  }, [toast.duration, onRemove])

  return (
    <div
      className={`toast toast--${toast.type} ${isExiting ? 'toast--exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast__icon">{TOAST_ICONS[toast.type]}</span>
      <span className="toast__message">{toast.message}</span>
      <button
        className="toast__close"
        onClick={() => {
          setIsExiting(true)
          setTimeout(onRemove, 200)
        }}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(({ message, type = 'info', duration = 4000 }: { message: string; type?: ToastType; duration?: number }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
      <div className="toast-container" aria-label="Notifications">
        {toasts.map(t => (
          <ToastItem
            key={t.id}
            toast={t}
            onRemove={() => removeToast(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
