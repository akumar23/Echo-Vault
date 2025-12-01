'use client'

import { useState } from 'react'
import { useClusters, useTriggerClustering } from '@/hooks/useClusters'
import { ClusterCard } from './ClusterCard'
import { ClusterDetailModal } from './ClusterDetailModal'
import { ErrorBoundary } from './ErrorBoundary'

function ClusterExplorerContent() {
  const { data: clusters, isLoading, refetch } = useClusters()
  const triggerClustering = useTriggerClustering()
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleTriggerClustering = async () => {
    setMessage(null)
    try {
      const result = await triggerClustering.mutateAsync()
      setMessage(result.message || 'Clustering triggered. This may take a few minutes.')
      // Auto-refetch after delay to check for new clusters
      setTimeout(() => refetch(), 30000)
    } catch (error) {
      setMessage('Failed to trigger clustering. Please try again.')
    }
  }

  const handleCloseModal = () => {
    setSelectedClusterId(null)
  }

  const handleNavigateToCluster = (clusterId: number) => {
    setSelectedClusterId(clusterId)
  }

  if (isLoading) {
    return (
      <div className="card">
        <p>Loading clusters...</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleTriggerClustering}
          disabled={triggerClustering.isPending}
          className="btn btn-primary"
        >
          {triggerClustering.isPending ? 'Triggering...' : 'Trigger Clustering'}
        </button>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary"
        >
          Refresh
        </button>
        {message && (
          <span style={{ marginLeft: '0.5rem', color: '#4a9eff', fontSize: '0.9rem' }}>
            {message}
          </span>
        )}
      </div>

      {clusters && clusters.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {clusters.map((cluster) => (
            <ClusterCard
              key={cluster.cluster_id}
              cluster={cluster}
              onClick={() => setSelectedClusterId(cluster.cluster_id)}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          <p>No clusters yet. Clusters are created automatically when you have enough entries.</p>
          <p style={{ marginTop: '1rem', color: '#666' }}>
            Or trigger clustering manually:
          </p>
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={handleTriggerClustering}
              disabled={triggerClustering.isPending}
              className="btn btn-primary"
            >
              {triggerClustering.isPending ? 'Triggering...' : 'Trigger Clustering'}
            </button>
          </div>
          {message && (
            <p style={{ marginTop: '1rem', color: '#4a9eff' }}>{message}</p>
          )}
        </div>
      )}

      {selectedClusterId !== null && (
        <ClusterDetailModal
          clusterId={selectedClusterId}
          onClose={handleCloseModal}
          onNavigateToCluster={handleNavigateToCluster}
        />
      )}
    </div>
  )
}

export function ClusterExplorer() {
  return (
    <ErrorBoundary
      fallback={
        <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
          <p style={{ color: '#856404' }}>
            Failed to load clusters. Please try refreshing the page.
          </p>
        </div>
      }
    >
      <ClusterExplorerContent />
    </ErrorBoundary>
  )
}
