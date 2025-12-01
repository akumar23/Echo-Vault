import { useQuery } from '@tanstack/react-query'
import { entriesApi, Entry } from '@/lib/api'

/**
 * Hook to fetch a list of entries with pagination
 */
export function useEntries(skip = 0, limit = 100) {
  return useQuery<Entry[]>({
    queryKey: ['entries', skip, limit],
    queryFn: () => entriesApi.list(skip, limit),
  })
}

/**
 * Hook to fetch a single entry by ID
 */
export function useEntry(id: number, enabled = true) {
  return useQuery<Entry>({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.get(id),
    enabled: enabled && !!id,
  })
}
