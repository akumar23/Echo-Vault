import { useQuery } from '@tanstack/react-query'
import { insightsApi, Insight, SemanticMoodInsightsResponse } from '@/lib/api'
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

/**
 * Hook to fetch semantic mood insights (content-mood correlations)
 */
export function useSemanticMoodInsights() {
  const { user, loading } = useAuth()

  return useQuery<SemanticMoodInsightsResponse>({
    queryKey: ['semantic-mood-insights'],
    queryFn: () => insightsApi.getMoodContent(),
    enabled: !loading && !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}
