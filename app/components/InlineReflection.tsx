'use client'

import ReactMarkdown from 'react-markdown'
import { useReflection } from '@/hooks/useReflection'

/**
 * InlineReflection — clean, quiet prose block.
 *
 * Renders the current reflection as sans-serif prose. Silent (returns null)
 * while there's nothing useful to show so callers can provide their own
 * empty-state affordance.
 */
export function InlineReflection() {
  const { reflection, error } = useReflection()

  if (error) return null
  if (!reflection?.reflection) return null
  if (reflection.status === 'error') return null

  const opacity =
    reflection.status === 'generating' ? 'opacity-70' : 'opacity-100'

  return (
    <div
      aria-label="AI reflection"
      className={`prose prose-sm prose-neutral max-w-none text-sm text-foreground transition-opacity duration-500 dark:prose-invert ${opacity}`}
    >
      <ReactMarkdown>{reflection.reflection}</ReactMarkdown>
    </div>
  )
}
