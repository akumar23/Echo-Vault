import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { entriesApi, forgetApi, EntryUpdatePayload, EntryUploadResult, EntryWritePayload } from '@/lib/api'

/**
 * Hook to create a new entry
 */
export function useCreateEntry() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (entry: EntryWritePayload) =>
      entriesApi.create(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      router.push('/entries')
    },
  })
}

/**
 * Hook to import a file as a journal entry (extract + embed).
 */
export function useUploadEntry() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: ({
      file,
      title,
      tags,
      mood_user,
    }: {
      file: File
      title?: string
      tags?: string[]
      mood_user?: number
    }): Promise<EntryUploadResult> =>
      entriesApi.upload(file, { title, tags, mood_user }),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      router.push(`/entries/${entry.id}`)
    },
  })
}

/**
 * Hook to update an existing entry
 */
export function useUpdateEntry(entryId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: EntryUpdatePayload) => entriesApi.update(entryId, data),
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
