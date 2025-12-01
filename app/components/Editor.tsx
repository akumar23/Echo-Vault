'use client'

import { useState, useEffect } from 'react'
import { Entry } from '@/lib/api'

interface EditorProps {
  entry?: Entry
  onSave: (entry: { title?: string; content: string; tags: string[]; mood_user?: number }) => Promise<void>
  saving?: boolean
}

export function Editor({ entry, onSave, saving = false }: EditorProps) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [tags, setTags] = useState<string[]>(entry?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [mood, setMood] = useState(entry?.mood_user ?? 3)
  const [useLlmPrediction, setUseLlmPrediction] = useState(entry?.mood_user == null)

  useEffect(() => {
    if (entry) {
      setTitle(entry?.title ?? '')
      setContent(entry?.content ?? '')
      setTags(entry?.tags ?? [])
      setMood(entry?.mood_user ?? 3)
      setUseLlmPrediction(entry?.mood_user == null)
    }
  }, [entry])

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      title,
      content,
      tags,
      mood_user: useLlmPrediction ? undefined : mood
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="title">Title (optional)</label>
        <input
          id="title"
          type="text"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry title..."
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          className="textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your entry here..."
          required
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="mood">Mood (1-5)</label>

        <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            <input
              type="checkbox"
              checked={useLlmPrediction}
              onChange={(e) => setUseLlmPrediction(e.target.checked)}
              aria-label="Let AI predict mood automatically"
            />
            Let AI Predict Mood
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <input
            id="mood"
            type="range"
            min="1"
            max="5"
            value={mood}
            onChange={(e) => setMood(parseInt(e.target.value))}
            style={{
              flex: 1,
              opacity: useLlmPrediction ? 0.4 : 1,
              cursor: useLlmPrediction ? 'not-allowed' : 'pointer'
            }}
            disabled={useLlmPrediction}
            aria-describedby="mood-helper"
          />
          <span style={{ opacity: useLlmPrediction ? 0.4 : 1 }}>{mood}</span>
        </div>
        <p
          id="mood-helper"
          style={{
            fontSize: '0.85rem',
            color: useLlmPrediction ? '#999' : '#666',
            marginTop: '0.25rem',
            marginLeft: '0.25rem'
          }}
        >
          {useLlmPrediction
            ? 'AI will automatically infer your mood from the entry content'
            : '1 = bad mood, 5 = good mood'}
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="tags">Tags</label>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input
            id="tags"
            type="text"
            className="input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag()
              }
            }}
            placeholder="Add a tag..."
            style={{ flex: 1 }}
          />
          <button type="button" onClick={handleAddTag} className="btn btn-secondary">
            Add
          </button>
        </div>
        {tags.length > 0 && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#f0f0f0',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    marginLeft: '0.5rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={saving || !content.trim()}>
        {saving ? 'Saving...' : 'Save Entry'}
      </button>
    </form>
  )
}

