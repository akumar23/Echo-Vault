'use client'

import { useState } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { ReflectionsPanel } from '@/components/ReflectionsPanel'
import { MoodInsights } from '@/components/MoodInsights'
import { ChatPanel } from '@/components/ChatPanel'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { Modal } from '@/components/Modal'
import { MoodNudge } from '@/components/MoodNudge'
import { SimilarEntries } from '@/components/SimilarEntries'
import { Entry } from '@/lib/api'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Clock,
  MessageSquare,
  FileText,
  Sparkles,
  ArrowRight,
  MessageCircle,
  ChevronDown
} from 'lucide-react'

export default function JournalDashboard() {
  const { data: entries, isLoading: entriesLoading } = useEntries(0, 5)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false)
  const [isChatModalOpen, setIsChatModalOpen] = useState(false)

  const getPreview = (content: string, maxLength = 80) => {
    if (!content) return ''
    const firstSentence = content.split(/[.!?]/)[0]
    if (firstSentence.length <= maxLength) {
      return firstSentence.trim() + (content.length > firstSentence.length ? '...' : '')
    }
    return firstSentence.slice(0, maxLength).trim() + '...'
  }

  const MOOD_EMOJIS: Record<number, string> = {
    1: '😢',
    2: '😕',
    3: '😐',
    4: '🙂',
    5: '😊',
  }

  const MOOD_LABELS: Record<number, string> = {
    1: 'Low',
    2: 'Down',
    3: 'Okay',
    4: 'Good',
    5: 'Great',
  }

  const getMoodEmoji = (mood: number | null) => {
    if (mood === null) return null
    return MOOD_EMOJIS[mood] || null
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsChatModalOpen(true)
  }

  return (
    <ProtectedRoute>
      <div className="container">
        <Header showGreeting />

        {/* Contextual mood-based components */}
        <MoodNudge />
        <SimilarEntries />

        <div className="grid-2 mb-5">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
            <div className="section-header">
              <div className="section-header__icon">
                <Clock />
              </div>
              <h2>Recent Entries</h2>
            </div>
            {entriesLoading ? (
              <p className="loading">Loading...</p>
            ) : entries && entries.length > 0 ? (
              <div className="scrollable-content flex-1">
                <ul style={{ listStyle: 'none' }}>
                  {entries.slice(0, 5).map((entry) => (
                    <li
                      key={entry.id}
                      className="entry-item"
                      onClick={() => setSelectedEntry(entry)}
                      style={{
                        paddingBottom: 'var(--space-4)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div className="entry-item__icon">
                        <FileText size={18} />
                      </div>
                      <div className="entry-item__content">
                        <span className="entry-item__title">{entry.title || 'Untitled'}</span>
                        {entry.content && (
                          <p className="entry-item__preview">{getPreview(entry.content)}</p>
                        )}
                        <div className="entry-item__meta">
                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="expand-hint">
                  <ChevronDown size={14} />
                  <span>Click to expand</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No entries yet.</p>
                <p><Link href="/new">Create your first entry</Link></p>
              </div>
            )}
          </div>

          {entries && entries.length > 0 && (
            <div
              className="card card-elevated card--clickable card--with-corner-link"
              style={{ display: 'flex', flexDirection: 'column', height: '350px' }}
              onClick={() => setIsReflectionModalOpen(true)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setIsReflectionModalOpen(true)
                }
              }}
            >
              <div className="card-header-row">
                <div className="section-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
                  <div className="section-header__icon">
                    <MessageSquare />
                  </div>
                  <h2>Reflection</h2>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleChatClick}
                  title="Chat about this reflection"
                >
                  <MessageCircle size={14} />
                  Chat
                </button>
              </div>
              <ReflectionsPanel />
              <div className="expand-hint">
                <ChevronDown size={14} />
                <span>Click to expand</span>
              </div>
              <Link
                href="/insights"
                className="corner-link"
                onClick={(e) => e.stopPropagation()}
              >
                <Sparkles size={14} />
                <span className="corner-link__text">Insights</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        <MoodInsights />
      </div>

      {/* Entry Modal */}
      <Modal
        isOpen={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry?.title || 'Untitled Entry'}
      >
        {selectedEntry && (
          <div>
            <p className="modal-entry__date">
              {format(new Date(selectedEntry.created_at), 'EEEE, MMMM d, yyyy')}
            </p>
            <div className="modal-entry__content">
              {selectedEntry.content}
            </div>
            <div className="modal-entry__footer">
              {(selectedEntry.mood_user || selectedEntry.mood_inferred) && (
                <span className={`mood-indicator mood-indicator--${selectedEntry.mood_user || selectedEntry.mood_inferred}`}>
                  <span className="mood-indicator__emoji">
                    {getMoodEmoji(selectedEntry.mood_user || selectedEntry.mood_inferred)}
                  </span>
                  <div className="mood-indicator__details">
                    <span className="mood-indicator__label">
                      {MOOD_LABELS[selectedEntry.mood_user || selectedEntry.mood_inferred || 3]}
                    </span>
                    <span className="mood-indicator__source">
                      {selectedEntry.mood_user ? 'Your mood' : 'Inferred'}
                    </span>
                  </div>
                </span>
              )}
              {selectedEntry.tags.length > 0 && (
                <div className="tags-container">
                  {selectedEntry.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 'var(--space-5)', textAlign: 'right' }}>
              <Link href={`/entries/${selectedEntry.id}`} className="btn btn-secondary">
                View Full Entry
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* Reflection Modal */}
      <Modal
        isOpen={isReflectionModalOpen}
        onClose={() => setIsReflectionModalOpen(false)}
        title="Reflection"
      >
        <ReflectionsPanel />
      </Modal>

      {/* Chat Modal */}
      <Modal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        title="Chat with Assistant"
        size="large"
      >
        <ChatPanel reflection="" />
      </Modal>
    </ProtectedRoute>
  )
}
