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

const TOAST_ICON_CLASS: Record<ToastType, string> = {
  success: 'text-[color:var(--success)]',
  error: 'text-destructive',
  warning: 'text-[color:var(--warning)]',
  info: 'text-primary',
}

const TOAST_BORDER_CLASS: Record<ToastType, string> = {
  success: 'border-l-2 border-l-[color:var(--success)]',
  error: 'border-l-2 border-l-destructive',
  warning: 'border-l-2 border-l-[color:var(--warning)]',
  info: 'border-l-2 border-l-primary',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(onRemove, 200)
    }, toast.duration)

    return () => clearTimeout(timer)
  }, [toast.duration, onRemove])

  return (
    <div
      className={`pointer-events-auto flex min-w-[280px] max-w-sm items-center gap-3 rounded-md border border-border bg-card px-4 py-3 shadow-lg transition-all ${
        TOAST_BORDER_CLASS[toast.type]
      } ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}
      role="alert"
      aria-live="polite"
    >
      <span className={`w-5 flex-shrink-0 text-center font-semibold ${TOAST_ICON_CLASS[toast.type]}`}>
        {TOAST_ICONS[toast.type]}
      </span>
      <span className="flex-1 text-sm text-foreground">{toast.message}</span>
      <button
        className="flex-shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
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
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-3"
        aria-label="Notifications"
      >
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
