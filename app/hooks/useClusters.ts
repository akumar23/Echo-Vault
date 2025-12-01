import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  clustersApi,
  Cluster,
  ClusterDetail,
  ClusterStats,
  ClusterEvolutionSnapshot,
  RelatedCluster
} from '@/lib/api'

/**
 * Hook to fetch all clusters
 */
export function useClusters() {
  return useQuery<Cluster[]>({
    queryKey: ['clusters'],
    queryFn: () => clustersApi.list(),
  })
}

/**
 * Hook to fetch a single cluster with entries
 */
export function useClusterDetail(id: number, enabled = true) {
  return useQuery<ClusterDetail>({
    queryKey: ['cluster', id],
    queryFn: () => clustersApi.get(id),
    enabled: enabled && !!id,
  })
}

/**
 * Hook to fetch cluster statistics
 */
export function useClusterStats() {
  return useQuery<ClusterStats>({
    queryKey: ['cluster-stats'],
    queryFn: () => clustersApi.stats(),
  })
}

/**
 * Hook to fetch cluster evolution/history
 */
export function useClusterEvolution() {
  return useQuery<ClusterEvolutionSnapshot[]>({
    queryKey: ['cluster-evolution'],
    queryFn: () => clustersApi.evolution(),
  })
}

/**
 * Hook to fetch related clusters
 */
export function useRelatedClusters(id: number, enabled = true) {
  return useQuery<RelatedCluster[]>({
    queryKey: ['cluster-related', id],
    queryFn: () => clustersApi.related(id),
    enabled: enabled && !!id,
  })
}

/**
 * Hook to trigger clustering manually
 */
export function useTriggerClustering() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => clustersApi.trigger(),
    onSuccess: () => {
      // Invalidate all cluster-related queries to refetch after clustering
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      queryClient.invalidateQueries({ queryKey: ['cluster-stats'] })
      queryClient.invalidateQueries({ queryKey: ['cluster-evolution'] })
    },
  })
}
