'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { promptsApi, type PromptInteraction } from '@/lib/api'

const SESSION_KEY = 'echovault:prompt-toast-shown'

const SUGGESTION_TYPE_COPY: Record<
  'question' | 'prompt' | 'continuation',
  string
> = {
  question: 'A question for you',
  prompt: 'A writing prompt',
  continuation: 'Pick up where you left off',
}

export function PromptSuggestionToast() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const alreadyShown =
    typeof window !== 'undefined' &&
    sessionStorage.getItem(SESSION_KEY) === '1'

  const { data } = useQuery({
    queryKey: ['prompts', 'suggestions', 'toast'],
    queryFn: () => promptsApi.getSuggestions(),
    enabled: Boolean(user) && !loading && !alreadyShown,
    staleTime: Infinity,
    retry: false,
  })

  useEffect(() => {
    if (!data || alreadyShown) return
    const suggestion = data.suggestions[0]
    if (!suggestion) return

    sessionStorage.setItem(SESSION_KEY, '1')

    const logInteraction = (action: PromptInteraction['action']) => {
      promptsApi
        .logInteraction({
          prompt_text: suggestion.text,
          prompt_type: suggestion.type,
          action,
          source_entry_id: suggestion.source_entry_id,
        })
        .catch(() => {})
    }

    logInteraction('displayed')

    toast(SUGGESTION_TYPE_COPY[suggestion.type], {
      description: suggestion.text,
      duration: 12000,
      action: {
        label: 'Use it',
        onClick: () => {
          logInteraction('clicked')
          const params = new URLSearchParams({
            prompt: suggestion.text,
            promptType: suggestion.type,
          })
          if (suggestion.source_entry_id) {
            params.set('sourceEntryId', String(suggestion.source_entry_id))
          }
          router.push(`/new?${params.toString()}`)
        },
      },
      onDismiss: () => logInteraction('dismissed'),
    })
  }, [data, alreadyShown, router])

  return null
}
