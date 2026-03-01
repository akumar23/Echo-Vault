'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MoodResponsiveLayout } from '@/components/MoodResponsiveLayout'
import { InsightVoiceProvider } from '@/contexts/InsightVoiceContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { BackendStatus } from '@/components/BackendStatus'
import { SkipLink } from '@/components/SkipLink'
import { OfflineDetector } from '@/components/OfflineDetector'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
        gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection (formerly cacheTime)
        retry: 1, // Only retry failed requests once
      },
    },
  }))

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <InsightVoiceProvider>
            <ToastProvider>
              <SkipLink />
              <BackendStatus />
              <OfflineDetector />
              <MoodResponsiveLayout>
                <main id="main-content">
                  {children}
                </main>
              </MoodResponsiveLayout>
            </ToastProvider>
          </InsightVoiceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

