'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { useInsights } from '@/hooks/useInsights'
import { insightsApi } from '@/lib/api'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sparkles,
  Lightbulb,
  Tag,
  CheckCircle,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

const DAY_OPTIONS = [
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
]

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
      <Header />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Insights
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated themes and patterns from your journal.
          </p>
        </div>

        <Card variant="bordered" className="mb-6">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Generate New Insights</CardTitle>
              <CardDescription>
                Ask the assistant to find themes across recent entries.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Analyze past
                <select
                  value={generateDays}
                  onChange={(e) => setGenerateDays(Number(e.target.value))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Days to analyze"
                >
                  {DAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                onClick={() => generateMutation.mutate(generateDays)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Insights
                  </>
                )}
              </Button>
            </div>
            {generateMutation.isSuccess && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Insight generation queued! It may take a moment to appear.
                </AlertDescription>
              </Alert>
            )}
            {generateMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to generate insights. Please try again.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading insights...</span>
          </div>
        ) : insights && insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight) => (
              <Card key={insight.id} variant="bordered">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {format(new Date(insight.period_start), 'MMM d')} -{' '}
                        {format(new Date(insight.period_end), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <span>
                      Generated{' '}
                      {format(new Date(insight.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Summary
                    </div>
                    <div className="prose prose-sm max-w-none text-muted-foreground">
                      <ReactMarkdown>{insight.summary}</ReactMarkdown>
                    </div>
                  </div>

                  {insight.themes && insight.themes.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                        <Tag className="h-4 w-4 text-primary" />
                        Themes
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {insight.themes.map((theme, i) => (
                          <Badge key={i} variant="secondary">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {insight.actions && insight.actions.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        Suggested Actions
                      </div>
                      <div className="prose prose-sm max-w-none text-muted-foreground">
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card variant="bordered">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  No insights yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate your first insight to see patterns in your journal
                  entries.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </ProtectedRoute>
  )
}
