import { useQuery } from '@tanstack/react-query'
import { entriesApi, Entry } from '@/lib/api'
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
