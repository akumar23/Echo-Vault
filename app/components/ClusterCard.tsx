'use client'

import { Cluster } from '@/lib/api'
import { format } from 'date-fns'

interface ClusterCardProps {
  cluster: Cluster
  onClick: () => void
}

export function ClusterCard({ cluster, onClick }: ClusterCardProps) {
  const displayLabel = cluster.label || 'Analyzing...'
  const isAnalyzing = !cluster.label

  return (
    <div
      className="card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative',
        opacity: isAnalyzing ? 0.7 : 1,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}
    >
      {cluster.is_stale && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#ffc107',
            color: '#856404',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}
        >
          Stale
        </div>
      )}

      <h3 style={{ marginBottom: '0.5rem', color: isAnalyzing ? '#666' : '#333' }}>
        {displayLabel}
      </h3>

      {cluster.description && (
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {cluster.description.length > 120
            ? `${cluster.description.substring(0, 120)}...`
            : cluster.description}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              background: '#0070f3',
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
            }}
          >
            {cluster.entry_count} {cluster.entry_count === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#999' }}>
          {format(new Date(cluster.created_at), 'MMM d, yyyy')}
        </div>
      </div>
    </div>
  )
}
