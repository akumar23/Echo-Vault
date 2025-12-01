import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, Settings } from '@/lib/api'

/**
 * Hook to fetch user settings
 */
export function useSettings() {
  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })
}

/**
 * Hook to update user settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: Partial<Settings>) => settingsApi.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
