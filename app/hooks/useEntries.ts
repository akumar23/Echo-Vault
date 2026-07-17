import { useQuery } from '@tanstack/react-query'
import { entriesApi, Entry, EchoesResponse } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook to fetch a list of entries with pagination
 */
export function useEntries(skip = 0, limit = 100) {
  const { user, loading } = useAuth()

  return useQuery<Entry[]>({
    queryKey: ['entries', skip, limit],
    queryFn: () => entriesApi.list(skip, limit),
    enabled: !loading && !!user,
  })
}

/**
 * Hook to fetch a single entry by ID
 */
export function useEntry(id: number, enabled = true) {
  const { user, loading } = useAuth()

  return useQuery<Entry>({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.get(id),
    enabled: enabled && !!id && !loading && !!user,
  })
}

/**
 * Hook to fetch recent or tag-related "echoes", wrapped in an LLM-generated
 * observation about what connects them.
 */
export function useEchoes(id: number, k = 3, enabled = true) {
  const { user, loading } = useAuth()

  return useQuery<EchoesResponse>({
    queryKey: ['entry', id, 'echoes', k],
    queryFn: () => entriesApi.getEchoes(id, k),
    enabled: enabled && !!id && !loading && !!user,
    staleTime: 5 * 60_000,
  })
}
