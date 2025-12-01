import { useQuery } from '@tanstack/react-query'
import { insightsApi, Insight } from '@/lib/api'

/**
 * Hook to fetch recent insights
 */
export function useInsights(limit = 10) {
  return useQuery<Insight[]>({
    queryKey: ['insights', limit],
    queryFn: () => insightsApi.getRecent(limit),
  })
}
