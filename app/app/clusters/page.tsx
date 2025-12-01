'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ClusterExplorer } from '@/components/ClusterExplorer'
import { ClusterStats } from '@/components/ClusterStats'
import Link from 'next/link'

export default function ClustersPage() {
  return (
    <ProtectedRoute>
      <div className="container">
        <div className="page-header">
          <h1>Themes & Clusters</h1>
          <div className="page-header-actions">
            <Link
              href="/"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>⌂</span>
              Home
            </Link>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: '1.6' }}>
            Discover thematic patterns in your journal entries. Clusters are automatically
            generated based on semantic similarity, helping you identify recurring themes
            and topics in your journaling journey.
          </p>
        </div>

        <ClusterStats />

        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>All Clusters</h2>
          <ClusterExplorer />
        </div>
      </div>
    </ProtectedRoute>
  )
}
