'use client'

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'theme'
const THEME_CHANGE_EVENT = 'echocault-theme-change'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const subscribeTheme = (callback: () => void) => {
  window.addEventListener('storage', callback)
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
    media.removeEventListener('change', callback)
  }
}

const getThemeSnapshot = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  return stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system'
}

const getThemeServerSnapshot = (): Theme => 'system'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const resolvedTheme: 'light' | 'dark' = mounted
    ? theme === 'system'
      ? getSystemTheme()
      : theme
    : 'light'

  useEffect(() => {
    if (!mounted) return
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [mounted, resolvedTheme])

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'system', resolvedTheme: 'light', setTheme }}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
