import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/lib/api'

const DEBOUNCE_MS = 400

/**
 * Fetch the OpenAI-compatible model list for the URL/token currently in the
 * form. Debounced so we don't hit the provider on every keystroke.
 */
export function useLLMModels(
  url: string,
  apiToken: string,
  enabled = true,
  tokenSet = false,
  serviceType: 'generation' | 'embedding' = 'generation',
) {
  const [debouncedUrl, setDebouncedUrl] = useState(url)
  const [debouncedToken, setDebouncedToken] = useState(apiToken)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUrl(url)
      setDebouncedToken(apiToken)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [url, apiToken])

  return useQuery({
    // tokenSet distinguishes "no token" from "use the saved token" after
    // the typed field is cleared on save.
    queryKey: ['llm-models', serviceType, debouncedUrl, debouncedToken, tokenSet],
    queryFn: () =>
      settingsApi.listModels({
        service_type: serviceType,
        url: debouncedUrl || null,
        api_token: debouncedToken || null,
      }),
    enabled,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
