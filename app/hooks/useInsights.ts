import { useQuery } from '@tanstack/react-query'
import { insightsApi, Insight } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook to fetch recent insights
 */
export function useInsights(limit = 10) {
  const { user, loading } = useAuth()

  return useQuery<Insight[]>({
    queryKey: ['insights', limit],
    queryFn: () => insightsApi.getRecent(limit),
    enabled: !loading && !!user,
  })
}
