'use client'

import { useClusterDetail, useRelatedClusters } from '@/hooks/useClusters'
import { format } from 'date-fns'
import Link from 'next/link'
import { useEffect } from 'react'

interface ClusterDetailModalProps {
  clusterId: number
  onClose: () => void
  onNavigateToCluster?: (clusterId: number) => void
}

export function ClusterDetailModal({ clusterId, onClose, onNavigateToCluster }: ClusterDetailModalProps) {
  const { data: cluster, isLoading } = useClusterDetail(clusterId)
  const { data: relatedClusters } = useRelatedClusters(clusterId)

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '2rem',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#666',
            padding: '0.5rem',
            lineHeight: 1,
          }}
          aria-label="Close modal"
        >
          ×
        </button>

        {isLoading ? (
          <div>Loading cluster details...</div>
        ) : cluster ? (
          <div>
            <h2 id="modal-title" style={{ marginBottom: '0.5rem' }}>
              {cluster.label || 'Analyzing...'}
            </h2>

            {cluster.description && (
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                {cluster.description}
              </p>
            )}

            {cluster.confidence !== null && (
              <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
                Confidence: {(cluster.confidence * 100).toFixed(1)}%
              </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>
                Entries ({cluster.entries.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cluster.entries.map((entry) => {
                  const isRepresentative = cluster.representative_entry_ids.includes(entry.entry_id)
                  return (
                    <div
                      key={entry.entry_id}
                      style={{
                        padding: '1rem',
                        background: isRepresentative ? '#f0f8ff' : '#f9f9f9',
                        borderRadius: '6px',
                        border: isRepresentative ? '2px solid #0070f3' : '1px solid #e0e0e0',
                        position: 'relative',
                      }}
                    >
                      {isRepresentative && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            background: '#0070f3',
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                          }}
                        >
                          Representative
                        </div>
                      )}
                      <Link
                        href={`/entries/${entry.entry_id}`}
                        style={{ display: 'block' }}
                        onClick={onClose}
                      >
                        <h4 style={{ marginBottom: '0.5rem' }}>
                          {entry.title || 'Untitled'}
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>
                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        </p>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>
                          {entry.content.substring(0, 150)}
                          {entry.content.length > 150 ? '...' : ''}
                        </p>
                        {entry.tags && entry.tags.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {entry.tags.map((tag, i) => (
                              <span
                                key={i}
                                style={{
                                  background: '#e0e0e0',
                                  padding: '0.2rem 0.4rem',
                                  borderRadius: '3px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>

            {relatedClusters && relatedClusters.length > 0 && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Related Clusters</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {relatedClusters.map((related) => (
                    <div
                      key={related.cluster_id}
                      onClick={() => {
                        if (onNavigateToCluster) {
                          onNavigateToCluster(related.cluster_id)
                        }
                      }}
                      style={{
                        padding: '0.75rem',
                        background: '#f9f9f9',
                        borderRadius: '6px',
                        cursor: onNavigateToCluster ? 'pointer' : 'default',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (onNavigateToCluster) {
                          e.currentTarget.style.background = '#f0f0f0'
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#f9f9f9'
                      }}
                      role={onNavigateToCluster ? 'button' : undefined}
                      tabIndex={onNavigateToCluster ? 0 : undefined}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                            {related.label || 'Analyzing...'}
                          </div>
                          {related.description && (
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {related.description.substring(0, 80)}
                              {related.description.length > 80 ? '...' : ''}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', color: '#666' }}>
                            {related.entry_count} entries
                          </span>
                          <span
                            style={{
                              background: '#e0e0e0',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {(related.similarity * 100).toFixed(0)}% similar
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>Cluster not found</div>
        )}
      </div>
    </div>
  )
}
