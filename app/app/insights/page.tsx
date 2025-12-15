'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'

export default function InsightsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard since clustering is removed for MVP
    router.replace('/')
  }, [router])

  return (
    <ProtectedRoute>
      <div className="container">
        <Header title="Insights" showNav={false} />
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: '1.6' }}>
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
