import { useQuery } from '@tanstack/react-query'
import { promptsApi, ReversePromptResponse } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook to fetch the current reverse prompt — a gap-mining suggestion derived
 * from the user's last ~30 days of entries. Backed by a 24h Redis cache on
 * the server, so React Query's staleTime mirrors that window.
 */
export function useReversePrompt(enabled = true) {
  const { user, loading } = useAuth()

  return useQuery<ReversePromptResponse>({
    queryKey: ['prompts', 'reverse'],
    queryFn: () => promptsApi.getReverse(),
    enabled: enabled && !loading && !!user,
    staleTime: 60 * 60 * 1000,
    retry: false,
  })
}
