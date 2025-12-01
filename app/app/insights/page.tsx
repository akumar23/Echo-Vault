'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ClusterExplorer } from '@/components/ClusterExplorer'
import { ClusterStats } from '@/components/ClusterStats'
import { Header } from '@/components/Header'

export default function InsightsPage() {
  return (
    <ProtectedRoute>
      <div className="container">
        <Header title="Insights" showNav={false} />

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: '1.6' }}>
            Discover thematic patterns in your journal entries. Themes are automatically
            generated based on semantic similarity, helping you identify recurring patterns
            and topics in your journaling journey.
          </p>
        </div>

        <ClusterStats />

        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Your Themes</h2>
          <ClusterExplorer />
        </div>
      </div>
    </ProtectedRoute>
  )
}
