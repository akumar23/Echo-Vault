'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReversePrompt } from '@/hooks/useReversePrompt'
import { promptsApi } from '@/lib/api'

/**
 * ReversePrompt — a gap-mining suggestion surfaced at the bottom of an entry.
 *
 * Unlike generic writing prompts, reverse prompts are derived from what the
 * user has *referenced but not explored* in their recent corpus. The signal
 * is logged to `prompt_interactions` so the backend can learn what lands.
 */
export function ReversePrompt() {
  const { data, isLoading } = useReversePrompt()
  const router = useRouter()
  const loggedDisplayRef = useRef<string | null>(null)

  // Log a 'displayed' interaction exactly once per unique prompt text.
  useEffect(() => {
    if (!data?.has_sufficient_data) return
    if (!data.prompt_text) return
    if (loggedDisplayRef.current === data.prompt_text) return

    loggedDisplayRef.current = data.prompt_text
    promptsApi
      .logInteraction({
        prompt_text: data.prompt_text,
        prompt_type: 'reverse',
        action: 'displayed',
      })
      .catch(() => {})
  }, [data])

  if (isLoading) return null
  if (!data) return null
  if (!data.has_sufficient_data) return null
  if (!data.prompt_text) return null

  const handleClick = () => {
    promptsApi
      .logInteraction({
        prompt_text: data.prompt_text,
        prompt_type: 'reverse',
        action: 'clicked',
      })
      .catch(() => {})

    const params = new URLSearchParams({
      prompt: data.prompt_text,
      promptType: 'reverse',
    })
    router.push(`/new?${params.toString()}`)
  }

  return (
    <section
      aria-label="Reverse prompt"
      className="mt-10 rounded-lg border border-dashed border-border bg-muted/30 p-5"
    >
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        <Compass className="h-3 w-3" aria-hidden />
        <span>Something you haven&apos;t written about</span>
      </div>

      <p className="mb-1 text-sm font-medium text-foreground">
        {data.prompt_text}
      </p>

      {data.rationale && (
        <p className="mb-3 text-xs italic text-muted-foreground">
          {data.rationale}
        </p>
      )}

      <Button size="sm" variant="outline" onClick={handleClick}>
        Write about it
      </Button>
    </section>
  )
}
