'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Entry, promptsApi } from '@/lib/api'
import { VoiceInput } from './VoiceInput'

interface WritingEditorProps {
  entry?: Entry
  onSave: (entry: { title?: string; content: string; tags: string[]; mood_user?: number }) => Promise<void>
  saving?: boolean
  initialPrompt?: string
  promptType?: 'question' | 'prompt' | 'continuation'
  sourceEntryId?: number
}

const MOOD_LABELS = ['Low', 'Down', 'Neutral', 'Good', 'Great']
const MOOD_EMOJIS = ['😢', '😕', '😐', '🙂', '😊']

export function WritingEditor({ entry, onSave, saving = false, initialPrompt, promptType, sourceEntryId }: WritingEditorProps) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [tags, setTags] = useState<string[]>(entry?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [mood, setMood] = useState(entry?.mood_user ?? 3)
  const [useLlmPrediction, setUseLlmPrediction] = useState(entry?.mood_user == null)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showPrompt, setShowPrompt] = useState(!!initialPrompt)

  const contentRef = useRef<HTMLTextAreaElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Handle voice transcription
  const handleVoiceTranscript = useCallback((transcript: string) => {
    setContent(prev => {
      // Add space before transcript if content doesn't end with space or is empty
      const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n')
      return prev + (needsSpace ? ' ' : '') + transcript
    })
    // Focus the textarea after voice input
    contentRef.current?.focus()
  }, [])

  useEffect(() => {
    if (entry) {
      setTitle(entry?.title ?? '')
      setContent(entry?.content ?? '')
      setTags(entry?.tags ?? [])
      setMood(entry?.mood_user ?? 3)
      setUseLlmPrediction(entry?.mood_user == null)
    }
  }, [entry])

  // Track changes
  useEffect(() => {
    const hasContent = content.trim().length > 0
    const isDifferent = entry
      ? content !== entry.content || title !== (entry.title ?? '')
      : hasContent
    setHasChanges(isDifferent)
  }, [content, title, entry])

  // Focus content on mount
  useEffect(() => {
    if (contentRef.current && !entry) {
      contentRef.current.focus()
    }
  }, [entry])

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setToolbarOpen(false)
      }
    }
    if (toolbarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [toolbarOpen])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (content.trim() && !saving) {
          handleSave()
        }
      }
      // Escape to close toolbar
      if (e.key === 'Escape' && toolbarOpen) {
        setToolbarOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [content, saving, toolbarOpen])

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }, [tags])

  const handleSave = async () => {
    await onSave({
      title: title.trim() || undefined,
      content,
      tags,
      mood_user: useLlmPrediction ? undefined : mood
    })

    // Log completion interaction if this entry was created from a prompt
    if (initialPrompt && promptType) {
      promptsApi.logInteraction({
        prompt_text: initialPrompt,
        prompt_type: promptType,
        action: 'completed',
        source_entry_id: sourceEntryId,
      }).catch(console.error)
    }
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div className="writing-editor">
      {/* Minimal header */}
      <div className="writing-editor__header">
        <div className="writing-editor__status">
          {saving ? (
            <span className="writing-editor__saving">Saving...</span>
          ) : hasChanges ? (
            <span className="writing-editor__unsaved">Unsaved changes</span>
          ) : entry ? (
            <span className="writing-editor__saved">Saved</span>
          ) : null}
        </div>

        <div className="writing-editor__actions">
          <button
            type="button"
            className={`writing-editor__toolbar-toggle ${toolbarOpen ? 'active' : ''}`}
            onClick={() => setToolbarOpen(!toolbarOpen)}
            aria-label="Toggle options"
            aria-expanded={toolbarOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Collapsible toolbar */}
      <div
        ref={toolbarRef}
        className={`writing-editor__toolbar ${toolbarOpen ? 'open' : ''}`}
      >
        <div className="writing-editor__toolbar-content">
          {/* Mood section */}
          <div className="writing-editor__toolbar-section">
            <div className="writing-editor__toolbar-label">Mood</div>

            <label className="checkbox writing-editor__ai-toggle">
              <input
                type="checkbox"
                checked={useLlmPrediction}
                onChange={(e) => setUseLlmPrediction(e.target.checked)}
              />
              Let AI detect mood
            </label>

            {!useLlmPrediction && (
              <div className="writing-editor__mood-picker">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`writing-editor__mood-btn ${mood === value ? 'active' : ''}`}
                    onClick={() => setMood(value)}
                    aria-label={`Mood ${value}: ${MOOD_LABELS[value - 1]}`}
                  >
                    <span className="writing-editor__mood-emoji">{MOOD_EMOJIS[value - 1]}</span>
                    <span className="writing-editor__mood-label">{MOOD_LABELS[value - 1]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tags section */}
          <div className="writing-editor__toolbar-section">
            <div className="writing-editor__toolbar-label">Tags</div>

            <div className="writing-editor__tag-input-row">
              <input
                type="text"
                className="input writing-editor__tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder="Add tag..."
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                Add
              </button>
            </div>

            {tags.length > 0 && (
              <div className="tags-container">
                {tags.map((tag, i) => (
                  <span key={i} className="tag">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="tag-remove"
                      aria-label={`Remove tag ${tag}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Writing prompt from mood nudge */}
      {showPrompt && initialPrompt && (
        <div className="writing-editor__prompt-banner">
          <div className="writing-editor__prompt-content">
            <span className="writing-editor__prompt-icon">💭</span>
            <p className="writing-editor__prompt-text">"{initialPrompt}"</p>
          </div>
          <button
            type="button"
            className="writing-editor__prompt-dismiss"
            onClick={() => setShowPrompt(false)}
            aria-label="Dismiss prompt"
          >
            ×
          </button>
        </div>
      )}

      {/* Voice input row */}
      <div className="writing-editor__voice-row">
        <VoiceInput onTranscript={handleVoiceTranscript} disabled={saving} />
        <span className="writing-editor__voice-label">Voice input</span>
        <span className="writing-editor__voice-hint">Click mic to dictate</span>
      </div>

      {/* Main writing area */}
      <div className="writing-editor__document">
        {/* Inline title */}
        <input
          type="text"
          className="writing-editor__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          aria-label="Entry title"
        />

        {/* Content area */}
        <textarea
          ref={contentRef}
          className="writing-editor__content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={initialPrompt ? `Reflect on: "${initialPrompt}"` : "Start writing..."}
          aria-label="Entry content"
        />
      </div>

      {/* Footer with word count and keyboard hint */}
      <div className="writing-editor__footer">
        <span className="writing-editor__word-count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <span className="writing-editor__hint">
          <kbd>⌘</kbd> + <kbd>S</kbd> to save
        </span>
      </div>
    </div>
  )
}
