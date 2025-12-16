import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, Settings, SettingsUpdate } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook to fetch user settings
 */
export function useSettings() {
  const { user, loading } = useAuth()

  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
    enabled: !loading && !!user,
  })
}

/**
 * Hook to update user settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: SettingsUpdate) => settingsApi.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
