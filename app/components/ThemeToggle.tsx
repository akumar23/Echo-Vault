'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'

/**
 * Cycles theme between light, dark, and system. Uses shadcn `Button` ghost
 * variant so colors and focus rings come from the design tokens.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      className="relative"
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="h-[1.125rem] w-[1.125rem]" />
      ) : (
        <Sun className="h-[1.125rem] w-[1.125rem]" />
      )}
      {theme === 'system' && (
        <span className="absolute -bottom-0.5 right-0 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          auto
        </span>
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
