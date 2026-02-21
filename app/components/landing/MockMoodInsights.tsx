'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'

const mockInsights = [
  {
    icon: TrendingUp,
    text: 'Your mood lifts when writing about existential crisis',
    iconClass: 'mock-insight-icon--success',
  },
  {
    icon: TrendingDown,
    text: 'Entries about work stress tend toward lower mood',
    iconClass: 'mock-insight-icon--warning',
  },
  {
    icon: Minus,
    text: 'Your overall mood has been declining over time',
    iconClass: '',
  },
  {
    icon: BarChart3,
    text: 'Average mood this week: 2.0/5',
    iconClass: '',
  },
]

// Mock mood data points for the chart (scaled 1-5)
const mockMoodData = [
  { day: 'Dec 1', mood: 2.5 },
  { day: 'Dec 5', mood: 4.2 },
  { day: 'Dec 8', mood: 1.8 },
  { day: 'Dec 12', mood: 3.5 },
  { day: 'Dec 15', mood: 2.0 },
  { day: 'Dec 18', mood: 3.0 },
  { day: 'Dec 20', mood: 5.0 },
  { day: 'Dec 22', mood: 3.5 },
  { day: 'Dec 25', mood: 2.5 },
  { day: 'Dec 28', mood: 1.0 },
  { day: 'Dec 30', mood: 3.5 },
  { day: 'Jan 2', mood: 3.5 },
  { day: 'Jan 5', mood: 2.5 },
  { day: 'Jan 8', mood: 3.5 },
  { day: 'Jan 10', mood: 4.5 },
  { day: 'Jan 12', mood: 1.5 },
]

const MOOD_SCALE = [
  { value: 1, emoji: '😔', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
]

function MockMoodChart() {
  const chartWidth = 500
  const chartHeight = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Calculate point positions
  const points = mockMoodData.map((d, i) => ({
    x: padding.left + (i / (mockMoodData.length - 1)) * innerWidth,
    y: padding.top + innerHeight - ((d.mood - 1) / 4) * innerHeight,
    mood: d.mood,
  }))

  // Create path for the line
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')

  return (
    <div className="mock-mood-chart">
      {/* Time range filter tabs */}
      <div className="mock-chart-filters">
        <button className="mock-chart-filter">7D</button>
        <button className="mock-chart-filter mock-chart-filter--active">30D</button>
        <button className="mock-chart-filter">90D</button>
      </div>

      {/* Mood scale legend */}
      <div className="mock-mood-legend">
        {MOOD_SCALE.map(({ value, emoji, label }) => (
          <span key={value} className="mock-mood-legend-item">
            <span className="mock-mood-emoji">{emoji}</span>
            <span className="mock-mood-label">{value} - {label}</span>
          </span>
        ))}
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mock-chart-svg">
        {/* Y-axis labels (emoji scale) */}
        {[5, 4, 3, 2, 1].map((value) => {
          const y = padding.top + innerHeight - ((value - 1) / 4) * innerHeight
          const mood = MOOD_SCALE[value - 1]
          return (
            <g key={value}>
              <text x={padding.left - 8} y={y + 4} className="mock-chart-label" textAnchor="end">
                {mood?.emoji}
              </text>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                className="mock-chart-grid"
              />
            </g>
          )
        })}

        {/* X-axis labels */}
        <text x={padding.left} y={chartHeight - 8} className="mock-chart-label">
          Dec 1
        </text>
        <text x={chartWidth - padding.right} y={chartHeight - 8} className="mock-chart-label" textAnchor="end">
          Jan 12
        </text>

        {/* Line path */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="#00ff88"
          strokeWidth={2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#00ff88"
            stroke="#1a1a1a"
            strokeWidth={2}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 * i, duration: 0.2 }}
          />
        ))}
      </svg>
    </div>
  )
}

export function MockMoodInsights() {
  return (
    <div className="mock-mood-insights">
      <div className="mock-mood-insights__card">
        {/* Header */}
        <div className="mock-mood-insights__header">
          <div className="mock-mood-insights__icon">
            <TrendingUp size={20} />
          </div>
          <h3 className="mock-mood-insights__title">Mood Insights</h3>
        </div>

        {/* Insights List */}
        <ul className="mock-mood-insights__list">
          {mockInsights.map((insight, i) => (
            <motion.li
              key={i}
              className="mock-mood-insights__item"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
            >
              <div className={`mock-insight-icon ${insight.iconClass}`}>
                <insight.icon size={18} />
              </div>
              <span>{insight.text}</span>
            </motion.li>
          ))}
        </ul>

        {/* Mood Chart */}
        <MockMoodChart />
      </div>

      <style jsx global>{`
        .mock-mood-insights {
          width: 100%;
          max-width: 700px;
          margin: 0 auto;
        }

        .mock-mood-insights__card {
          background: rgba(26, 26, 26, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: var(--space-5);
        }

        .mock-mood-insights__header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-3);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .mock-mood-insights__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--accent-subtle);
          border-radius: 8px;
          color: var(--accent);
        }

        .mock-mood-insights__title {
          font-size: var(--text-xl);
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .mock-mood-insights__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .mock-mood-insights__item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          font-size: var(--text-sm);
          color: var(--text-primary);
        }

        .mock-insight-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .mock-insight-icon--success {
          background: rgba(0, 255, 136, 0.1);
          color: #00ff88;
        }

        .mock-insight-icon--warning {
          background: rgba(255, 184, 108, 0.1);
          color: #ffb86c;
        }

        /* Chart styles */
        .mock-mood-chart {
          margin-top: var(--space-4);
          padding-top: var(--space-4);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .mock-chart-filters {
          display: flex;
          gap: var(--space-1);
          margin-bottom: var(--space-3);
        }

        .mock-chart-filter {
          padding: var(--space-2) var(--space-3);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: var(--text-muted);
          font-size: var(--text-xs);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mock-chart-filter:hover {
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-primary);
        }

        .mock-chart-filter--active {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: var(--text-primary);
        }

        .mock-mood-legend {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
          padding: var(--space-3);
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        .mock-mood-legend-item {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .mock-mood-emoji {
          font-size: var(--text-sm);
        }

        .mock-chart-svg {
          width: 100%;
          height: auto;
        }

        .mock-chart-label {
          font-size: 11px;
          fill: #888;
          font-family: var(--font-mono);
        }

        .mock-chart-grid {
          stroke: rgba(255, 255, 255, 0.06);
          stroke-width: 1;
        }

        @media (max-width: 640px) {
          .mock-mood-insights__card {
            padding: var(--space-4);
          }

          .mock-mood-insights__item {
            padding: var(--space-2) var(--space-3);
            font-size: var(--text-xs);
          }

          .mock-mood-legend {
            gap: var(--space-2);
          }

          .mock-mood-legend-item {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  )
}
