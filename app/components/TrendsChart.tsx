'use client'

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

function TrendsChartContent() {
  const { data: entries, isLoading } = useEntries(0, 100)

  if (isLoading) {
    return <div className="loading">Loading chart...</div>
  }

  if (!entries || entries.length === 0) {
    return <p className="text-muted">No data available for trends</p>
  }

  // Group entries by date and calculate average mood
  const last30Days = Array.from({ length: 30 }, (_, i) => subDays(new Date(), 29 - i))
  const moodData = last30Days.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayEntries = entries.filter((entry) => {
      const entryDate = format(new Date(entry.created_at), 'yyyy-MM-dd')
      return entryDate === dateStr
    })

    if (dayEntries.length === 0) return null

    const moods = dayEntries
      .map((e) => e.mood_user || e.mood_inferred)
      .filter((m) => m !== null && m !== undefined)

    return moods.length > 0 ? moods.reduce((a: number, b: number) => a + b, 0) / moods.length : null
  })

  const chartData = {
    labels: last30Days.map(date => format(date, 'MMM d')),
    datasets: [
      {
        label: 'Average Mood',
        data: moodData,
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#00ff88',
        pointBorderColor: '#0a0a0a',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0, // Sharp lines for brutalist aesthetic
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#f0f0f0',
          font: {
            family: "'JetBrains Mono', monospace",
            size: 12,
          },
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      title: {
        display: true,
        text: 'MOOD TRENDS (LAST 30 DAYS)',
        color: '#f0f0f0',
        font: {
          family: "'JetBrains Mono', monospace",
          size: 14,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleColor: '#f0f0f0',
        bodyColor: '#888888',
        borderColor: '#333333',
        borderWidth: 2,
        titleFont: {
          family: "'JetBrains Mono', monospace",
        },
        bodyFont: {
          family: "'JetBrains Mono', monospace",
        },
        cornerRadius: 0,
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
          maxRotation: 45,
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
    },
  }

  return <Line data={chartData} options={options} />
}

export function TrendsChart() {
  return (
    <ErrorBoundary
      fallback={
        <div className="alert alert--error">
          Failed to load trends chart. Please try refreshing the page.
        </div>
      }
    >
      <TrendsChartContent />
    </ErrorBoundary>
  )
}
