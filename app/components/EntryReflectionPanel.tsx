'use client'

import ReactMarkdown from 'react-markdown'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEntryReflection } from '@/hooks/useEntryReflection'

interface EntryReflectionPanelProps {
  entryId: number
}

export function EntryReflectionPanel({ entryId }: EntryReflectionPanelProps) {
  const { reflection, isLoading, error, regenerate } = useEntryReflection(entryId)

  const status = reflection?.status ?? (isLoading ? 'generating' : null)
  const text = reflection?.reflection ?? ''

  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>Couldn&apos;t load this reflection.</span>
        <Button variant="ghost" size="sm" onClick={regenerate}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  if (status === 'generating' || (isLoading && !text)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Thinking about this entry…</span>
      </div>
    )
  }

  if (!text) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          No reflection yet — generate one to see what stands out.
        </p>
        <Button variant="outline" size="sm" onClick={regenerate}>
          Reflect
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        aria-label="AI reflection for this entry"
        className="prose prose-sm prose-neutral max-w-none text-sm text-foreground transition-opacity duration-500 dark:prose-invert"
      >
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={regenerate}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
      </div>
    </div>
  )
}
