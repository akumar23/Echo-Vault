'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { useInsights } from '@/hooks/useInsights'
import { insightsApi } from '@/lib/api'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Sparkles,
  Home,
  Lightbulb,
  Tag,
  CheckCircle,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

export default function InsightsPage() {
  const { data: insights, isLoading } = useInsights(10)
  const [generateDays, setGenerateDays] = useState(7)
  const queryClient = useQueryClient()

  const generateMutation = useMutation({
    mutationFn: (days: number) => insightsApi.generate(days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
  })

  return (
    <ProtectedRoute>
      <div className="container">
        <div className="page-header">
          <div className="flex items-center gap-4">
            <div className="section-header__icon" style={{ width: '48px', height: '48px' }}>
              <Sparkles size={24} />
            </div>
            <h1>Insights</h1>
          </div>
          <div className="page-header-actions">
            <Link href="/" className="btn btn-ghost">
              <Home size={16} />
              Home
            </Link>
          </div>
        </div>

        <div className="card card-elevated" style={{ marginBottom: '1.5rem' }}>
          <div className="section-header">
            <div className="section-header__icon">
              <Lightbulb />
            </div>
            <h3 style={{ margin: 0, padding: 0, border: 'none' }}>Generate New Insights</h3>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} className="text-muted" />
              Analyze past
              <select
                value={generateDays}
                onChange={(e) => setGenerateDays(Number(e.target.value))}
                className="input"
                style={{ width: 'auto' }}
              >
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </label>
            <button
              onClick={() => generateMutation.mutate(generateDays)}
              disabled={generateMutation.isPending}
              className="btn btn-cta"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Insights
                </>
              )}
            </button>
          </div>
          {generateMutation.isSuccess && (
            <div className="alert alert--success alert--sm" style={{ marginTop: '0.75rem' }}>
              <CheckCircle2 size={16} />
              Insight generation queued! It may take a moment to appear.
            </div>
          )}
          {generateMutation.isError && (
            <div className="alert alert--error alert--sm" style={{ marginTop: '0.75rem' }}>
              <AlertCircle size={16} />
              Failed to generate insights. Please try again.
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span className="text-muted">Loading insights...</span>
          </div>
        ) : insights && insights.length > 0 ? (
          <div>
            {insights.map((insight) => (
              <div key={insight.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted" />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {format(new Date(insight.period_start), 'MMM d')} - {format(new Date(insight.period_end), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Generated {format(new Date(insight.created_at), 'MMM d, yyyy')}
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                    <Lightbulb size={16} className="text-accent" />
                    <h4 style={{ margin: 0 }}>Summary</h4>
                  </div>
                  <div className="prose prose-sm">
                    <ReactMarkdown>{insight.summary}</ReactMarkdown>
                  </div>
                </div>

                {insight.themes && insight.themes.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                      <Tag size={16} className="text-accent" />
                      <h4 style={{ margin: 0 }}>Themes</h4>
                    </div>
                    <div className="tags-container">
                      {insight.themes.map((theme, i) => (
                        <span key={i} className="tag">{theme}</span>
                      ))}
                    </div>
                  </div>
                )}

                {insight.actions && insight.actions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                      <CheckCircle size={16} className="text-accent" />
                      <h4 style={{ margin: 0 }}>Suggested Actions</h4>
                    </div>
                    <div className="prose prose-sm">
                      <ul>
                        {insight.actions.map((action, i) => (
                          <li key={i}>
                            <ReactMarkdown>{action}</ReactMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Sparkles size={48} className="text-muted" style={{ marginBottom: 'var(--space-4)' }} />
            <p>No insights yet.</p>
            <p>Generate your first insight to see patterns in your journal entries.</p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
