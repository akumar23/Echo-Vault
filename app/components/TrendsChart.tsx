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
    return <div>Loading chart...</div>
  }

  if (!entries || entries.length === 0) {
    return <p style={{ color: '#666' }}>No data available for trends</p>
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
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Mood Trends (Last 30 Days)',
      },
    },
    scales: {
      y: {
        min: 1,
        max: 5,
        ticks: {
          stepSize: 1,
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
        <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
          <p style={{ color: '#856404' }}>
            Failed to load trends chart. Please try refreshing the page.
          </p>
        </div>
      }
    >
      <TrendsChartContent />
    </ErrorBoundary>
  )
}

