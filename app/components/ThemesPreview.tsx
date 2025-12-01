'use client'

import { useClusters, useTriggerClustering } from '@/hooks/useClusters'
import Link from 'next/link'
import { format } from 'date-fns'
import { useState } from 'react'

export function ThemesPreview() {
  const { data: clusters, isLoading, refetch } = useClusters()
  const triggerClustering = useTriggerClustering()
  const [message, setMessage] = useState<string | null>(null)

  const handleTriggerClustering = async () => {
    setMessage(null)
    try {
      const result = await triggerClustering.mutateAsync()
      setMessage(result.message || 'Clustering triggered. This may take a few minutes.')
      setTimeout(() => refetch(), 30000)
    } catch (error) {
      setMessage('Failed to trigger clustering. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Recurring Themes</h2>
        </div>
        <p style={{ color: '#666' }}>Loading themes...</p>
      </div>
    )
  }

  // Filter out stale clusters and those without labels, sort by entry count, take top 5
  const topClusters = clusters
    ?.filter(c => !c.is_stale && c.label && c.label !== 'Analyzing...')
    .sort((a, b) => b.entry_count - a.entry_count)
    .slice(0, 5) || []

  if (topClusters.length === 0) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Recurring Themes</h2>
          <Link
            href="/insights"
            style={{
              color: '#0070f3',
              fontSize: '0.9rem',
              fontWeight: '500',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            View All
            <span style={{ fontSize: '1.1rem' }}>→</span>
          </Link>
        </div>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          No themes discovered yet. Themes are automatically identified as you create more entries,
          or you could try to trigger it manually.
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
          <p style={{ marginTop: '1rem', color: '#4a9eff', fontSize: '0.9rem' }}>{message}</p>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Recurring Themes</h2>
        <Link
          href="/insights"
          style={{
            color: '#0070f3',
            fontSize: '0.9rem',
            fontWeight: '500',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(4px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0)'
          }}
        >
          View All Themes
          <span style={{ fontSize: '1.1rem' }}>→</span>
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '1rem',
        }}
      >
        {topClusters.map((cluster) => (
          <Link
            key={cluster.cluster_id}
            href="/insights"
            style={{
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                padding: '1rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: '#fafafa',
                transition: 'all 0.2s',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#0070f3'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#e0e0e0'
              }}
            >
              <div
                style={{
                  fontWeight: '600',
                  fontSize: '1rem',
                  marginBottom: '0.5rem',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🔖</span>
                {cluster.label}
              </div>

              {cluster.description && (
                <p
                  style={{
                    color: '#666',
                    fontSize: '0.85rem',
                    marginBottom: '0.75rem',
                    lineHeight: '1.4',
                    flex: 1,
                  }}
                >
                  {cluster.description.length > 80
                    ? `${cluster.description.substring(0, 80)}...`
                    : cluster.description}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #e0e0e0',
                }}
              >
                <span
                  style={{
                    background: '#0070f3',
                    color: 'white',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                  }}
                >
                  {cluster.entry_count} {cluster.entry_count === 1 ? 'entry' : 'entries'}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#999' }}>
                  {format(new Date(cluster.created_at), 'MMM d')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
