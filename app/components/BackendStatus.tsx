'use client'

import { useEffect, useState } from 'react'
import { useTauri } from '@/hooks/useTauri'
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react'

/**
 * Shows a banner when running as desktop app and backend services are not available
 */
export function BackendStatus() {
  const { isDesktop, healthStatus, isCheckingHealth, checkBackendHealth } = useTauri()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isDesktop) {
      checkBackendHealth()
    }
  }, [isDesktop, checkBackendHealth])

  // Don't show anything if not in desktop mode or backend is healthy
  if (!isDesktop || dismissed || healthStatus?.api) {
    return null
  }

  // Don't show during initial check
  if (healthStatus === null && !isCheckingHealth) {
    return null
  }

  return (
    <div className="backend-status">
      <div className="backend-status__content">
        <AlertTriangle size={20} className="backend-status__icon" />
        <div className="backend-status__message">
          <strong>Backend services not available</strong>
          <p>
            {healthStatus?.message || 'Checking connection...'}
          </p>
        </div>
      </div>

      <div className="backend-status__actions">
        <div className="backend-status__command">
          <Terminal size={14} />
          <code>cd infra && docker compose up -d</code>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => checkBackendHealth()}
          disabled={isCheckingHealth}
        >
          <RefreshCw size={14} className={isCheckingHealth ? 'animate-spin' : ''} />
          {isCheckingHealth ? 'Checking...' : 'Retry'}
        </button>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>

      <style jsx>{`
        .backend-status {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: var(--color-warning-bg, #fef3c7);
          border-bottom: 2px solid var(--color-warning, #f59e0b);
          padding: 1rem;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .backend-status__content {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .backend-status__icon {
          color: var(--color-warning, #f59e0b);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .backend-status__message strong {
          display: block;
          color: var(--color-warning-dark, #92400e);
        }

        .backend-status__message p {
          margin: 0.25rem 0 0;
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .backend-status__actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .backend-status__command {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .backend-status__command code {
          font-family: var(--font-mono);
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (prefers-color-scheme: dark) {
          .backend-status {
            background: var(--color-warning-bg-dark, #78350f);
            border-color: var(--color-warning, #f59e0b);
          }

          .backend-status__message strong {
            color: var(--color-warning-light, #fcd34d);
          }
        }
      `}</style>
    </div>
  )
}
