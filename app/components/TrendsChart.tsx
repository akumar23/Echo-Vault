'use client'

import { useMemo } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from 'chart.js'
import { format, subDays } from 'date-fns'
import { ErrorBoundary } from './ErrorBoundary'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

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

  if (isLoading) {
    return <div className="loading">Loading chart...</div>
  }

  // Process chart data with metadata for tooltips
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
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          borderWidth: 2,
          pointBackgroundColor: moodData.map(m => m !== null ? '#00ff88' : 'transparent'),
          pointBorderColor: moodData.map(m => m !== null ? '#0a0a0a' : 'transparent'),
          pointBorderWidth: 2,
          pointRadius: moodData.map(m => m !== null ? 5 : 0),
          pointHoverRadius: 8,
          tension: 0,
          spanGaps: true,
        },
      ],
    }

    return { chartData: data, entryMetadata: metadata, dateRange }
  }, [entries, days])

  if (!entries || entries.length === 0 || !chartData) {
    return <p className="text-muted">No data available for trends</p>
  }

  const options = {
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
        backgroundColor: '#1a1a1a',
        titleColor: '#00ff88',
        bodyColor: '#f0f0f0',
        borderColor: '#00ff88',
        borderWidth: 2,
        padding: 12,
        titleFont: {
          family: "'JetBrains Mono', monospace",
          size: 13,
          weight: 'bold' as const,
        },
        bodyFont: {
          family: "'JetBrains Mono', monospace",
          size: 12,
        },
        cornerRadius: 0,
        displayColors: false,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            if (items.length === 0) return ''
            const idx = items[0].dataIndex
            const date = dateRange[idx]
            return format(date, 'EEEE, MMM d')
          },
          label: (item: TooltipItem<'line'>) => {
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
          color: '#888888',
          font: {
            family: "'JetBrains Mono', monospace",
            size: 11,
          },
          callback: (value: number | string) => {
            const v = Number(value)
            const mood = MOOD_SCALE[v - 1]
            return mood ? `${mood.emoji}` : value
          },
        },
        grid: {
          color: '#333333',
          lineWidth: 1,
        },
        border: {
          color: '#333333',
          width: 2,
        },
      },
      x: {
        ticks: {
          color: '#888888',
          font: {
            family: "'JetBrains Mono', monospace",
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
          color: '#333333',
          width: 2,
        },
      },
    },
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
