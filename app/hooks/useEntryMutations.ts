import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { entriesApi, forgetApi, Entry } from '@/lib/api'

/**
 * Hook to create a new entry
 */
export function useCreateEntry() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (entry: { title?: string; content: string; tags?: string[]; mood_user?: number }) =>
      entriesApi.create(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      router.push('/entries')
    },
  })
}

/**
 * Hook to update an existing entry
 */
export function useUpdateEntry(entryId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Entry>) => entriesApi.update(entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}

/**
 * Hook to delete an entry
 */
export function useDeleteEntry() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (entryId: number) => entriesApi.delete(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      router.push('/entries')
    },
  })
}

/**
 * Hook to forget an entry (remove from search)
 */
export function useForgetEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entryId: number) => forgetApi.forget(entryId),
    onSuccess: (_, entryId) => {
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}
