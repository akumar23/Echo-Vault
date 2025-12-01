'use client'

import { useClusterStats } from '@/hooks/useClusters'
import { format } from 'date-fns'

export function ClusterStats() {
  const { data: stats, isLoading } = useClusterStats()

  if (isLoading) {
    return (
      <div className="card">
        <p>Loading statistics...</p>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1.5rem' }}>Clustering Statistics</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            background: '#f0f8ff',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0070f3' }}>
            {stats.total_clusters}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
            Total Clusters
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            background: '#f0fff4',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>
            {stats.total_clustered_entries}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
            Clustered Entries
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            background: '#fff3cd',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
            {stats.total_unclustered_entries}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
            Unclustered Entries
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            background: '#fce7f3',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ec4899' }}>
            {stats.largest_cluster_size}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
            Largest Cluster
          </div>
        </div>
      </div>

      {stats.last_clustering_date && (
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e0e0e0',
            fontSize: '0.9rem',
            color: '#666',
            textAlign: 'center',
          }}
        >
          Last clustering: {format(new Date(stats.last_clustering_date), 'MMM d, yyyy h:mm a')}
        </div>
      )}
    </div>
  )
}
