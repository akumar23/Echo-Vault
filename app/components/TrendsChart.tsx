'use client'

import { useMemo, useEffect, useState } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { format, subDays } from 'date-fns'
import { ErrorBoundary } from './ErrorBoundary'
import dynamic from 'next/dynamic'

// Dynamically import chart components to reduce initial bundle size
const Line = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Line),
  {
    ssr: false,
    loading: () => (
      <div className="skeleton" style={{ height: '200px', width: '100%' }} />
    )
  }
)

// Chart.js registration happens lazily
let chartJsRegistered = false
async function registerChartJs() {
  if (chartJsRegistered) return
  const {
    Chart: ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
  } = await import('chart.js')

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
  )
  chartJsRegistered = true
}

// Helper to get CSS variable values
function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

// Mood scale with emoji indicators
const MOOD_SCALE = [
  { value: 1, emoji: '😔', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
]

interface EntryMetadata {
  titles: string[]
  count: number
  avgMood: number
}

interface TrendsChartContentProps {
  days: 7 | 30 | 90
}

function TrendsChartContent({ days }: TrendsChartContentProps) {
  const { data: entries, isLoading } = useEntries(0, 200)
  const [chartReady, setChartReady] = useState(false)

  // Register Chart.js on mount
  useEffect(() => {
    registerChartJs().then(() => setChartReady(true))
  }, [])

  // Get theme colors from CSS variables
  const colors = useMemo(() => ({
    accent: getCssVar('--accent', '#E07A5A'),
    accentSubtle: getCssVar('--accent-subtle', 'rgba(224, 122, 90, 0.18)'),
    bgPrimary: getCssVar('--bg-primary', '#131210'),
    bgSurface: getCssVar('--bg-surface', '#1A1917'),
    textMuted: getCssVar('--text-muted', '#9A958D'),
    border: getCssVar('--border', '#3D3A36'),
    textPrimary: getCssVar('--text-primary', '#E8E4DE'),
  }), [chartReady]) // Re-compute when chart is ready (client-side)

  // Process chart data with metadata for tooltips
  // Must be called before any conditional returns to satisfy React hooks rules
  const { chartData, entryMetadata, dateRange } = useMemo(() => {
    if (!entries || entries.length === 0) {
      return { chartData: null, entryMetadata: [], dateRange: [] }
    }

    const dateRange = Array.from({ length: days }, (_, i) => subDays(new Date(), days - 1 - i))
    const metadata: (EntryMetadata | null)[] = []

    const moodData = dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayEntries = entries.filter((entry) => {
        const entryDate = format(new Date(entry.created_at), 'yyyy-MM-dd')
        return entryDate === dateStr
      })

      if (dayEntries.length === 0) {
        metadata.push(null)
        return null
      }

      const moods = dayEntries
        .map((e) => e.mood_user || e.mood_inferred)
        .filter((m): m is number => m !== null && m !== undefined)

      const avgMood = moods.length > 0
        ? moods.reduce((a, b) => a + b, 0) / moods.length
        : null

      // Store metadata for tooltips
      metadata.push({
        titles: dayEntries.map(e => e.title || 'Untitled').slice(0, 3),
        count: dayEntries.length,
        avgMood: avgMood || 0
      })

      return avgMood
    })

    // Determine tick spacing based on date range
    const tickInterval = days <= 7 ? 1 : days <= 30 ? 5 : 10

    const data = {
      labels: dateRange.map((date, i) => {
        // Show fewer labels for cleaner display
        if (days > 7 && i % tickInterval !== 0 && i !== dateRange.length - 1) {
          return ''
        }
        return format(date, days <= 7 ? 'EEE' : 'MMM d')
      }),
      datasets: [
        {
          label: 'Mood',
          data: moodData,
          borderColor: colors.accent,
          backgroundColor: colors.accentSubtle,
          borderWidth: 2,
          pointBackgroundColor: moodData.map(m => m !== null ? colors.accent : 'transparent'),
          pointBorderColor: moodData.map(m => m !== null ? colors.bgPrimary : 'transparent'),
          pointBorderWidth: 2,
          pointRadius: moodData.map(m => m !== null ? 5 : 0),
          pointHoverRadius: 8,
          tension: 0,
          spanGaps: true,
        },
      ],
    }

    return { chartData: data, entryMetadata: metadata, dateRange }
  }, [entries, days, colors])

  // Chart options - must be defined before conditional returns
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false, // Hide default legend, we'll use custom scale
      },
      title: {
        display: false, // Title handled externally
      },
      tooltip: {
        enabled: true,
        backgroundColor: colors.bgSurface,
        titleColor: colors.accent,
        bodyColor: colors.textPrimary,
        borderColor: colors.accent,
        borderWidth: 2,
        padding: 12,
        titleFont: {
          family: 'var(--font-sans), system-ui, sans-serif',
          size: 13,
          weight: 'bold' as const,
        },
        bodyFont: {
          family: 'var(--font-sans), system-ui, sans-serif',
          size: 12,
        },
        cornerRadius: 4,
        displayColors: false,
        callbacks: {
          title: (items: import('chart.js').TooltipItem<'line'>[]) => {
            if (items.length === 0) return ''
            const idx = items[0].dataIndex
            const date = dateRange[idx]
            return format(date, 'EEEE, MMM d')
          },
          label: (item: import('chart.js').TooltipItem<'line'>) => {
            const idx = item.dataIndex
            const meta = entryMetadata[idx]
            if (!meta) return 'No entries'

            const moodValue = Math.round(meta.avgMood)
            const moodInfo = MOOD_SCALE[moodValue - 1] || MOOD_SCALE[2]

            return [
              `${moodInfo.emoji} ${meta.avgMood.toFixed(1)} - ${moodInfo.label}`,
              '',
              `${meta.count} ${meta.count === 1 ? 'entry' : 'entries'}`,
              ...meta.titles.map(t => `• ${t.length > 25 ? t.slice(0, 25) + '...' : t}`),
            ]
          },
        },
      },
    },
    scales: {
      y: {
        min: 1,
        max: 5,
        ticks: {
          stepSize: 1,
          color: colors.textMuted,
          font: {
            family: 'var(--font-sans), system-ui, sans-serif',
            size: 11,
          },
          callback: (value: number | string) => {
            const v = Number(value)
            const mood = MOOD_SCALE[v - 1]
            return mood ? `${mood.emoji}` : value
          },
        },
        grid: {
          color: colors.border,
          lineWidth: 1,
        },
        border: {
          color: colors.border,
          width: 2,
        },
      },
      x: {
        ticks: {
          color: colors.textMuted,
          font: {
            family: 'var(--font-sans), system-ui, sans-serif',
            size: 10,
          },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: days <= 7 ? 7 : 8,
        },
        grid: {
          display: false,
        },
        border: {
          color: colors.border,
          width: 2,
        },
      },
    },
  }), [colors, days, dateRange, entryMetadata])

  // Conditional returns after all hooks
  if (isLoading || !chartReady) {
    return <div className="skeleton" style={{ height: '200px', width: '100%' }} />
  }

  if (!entries || entries.length === 0 || !chartData) {
    return <p className="text-muted">No data available for trends</p>
  }

  return (
    <div>
      {/* Mood Scale Legend */}
      <div className="mood-scale-legend">
        {MOOD_SCALE.map(({ value, emoji, label }) => (
          <div key={value} className="mood-scale-item">
            <span className="mood-scale-emoji">{emoji}</span>
            <span className="mood-scale-label">{value} - {label}</span>
          </div>
        ))}
      </div>

      <Line data={chartData} options={options} />
    </div>
  )
}

interface TrendsChartProps {
  days?: 7 | 30 | 90
}

export function TrendsChart({ days = 30 }: TrendsChartProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="alert alert--error">
          Failed to load trends chart. Please try refreshing the page.
        </div>
      }
    >
      <TrendsChartContent days={days} />
    </ErrorBoundary>
  )
}
