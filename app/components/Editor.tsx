'use client'

import { Entry } from '@/lib/api'
import { useEntryEditor } from '@/hooks/useEntryEditor'

interface EditorProps {
  entry?: Entry
  onSave: (entry: { title?: string; content: string; tags: string[]; mood_user?: number }) => Promise<void>
  saving?: boolean
}

export function Editor({ entry, onSave, saving = false }: EditorProps) {
  const {
    title,
    setTitle,
    content,
    setContent,
    tags,
    tagInput,
    setTagInput,
    mood,
    setMood,
    useLlmPrediction,
    setUseLlmPrediction,
    handleAddTag,
    handleRemoveTag,
    getEntryData,
    hasContent,
  } = useEntryEditor({ entry, normalizeTags: false })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(getEntryData())
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
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

      <div className="form-group">
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

      <div className="form-group">
        <label htmlFor="mood">Mood (1-5)</label>

        <label className="checkbox mb-4">
          <input
            type="checkbox"
            checked={useLlmPrediction}
            onChange={(e) => setUseLlmPrediction(e.target.checked)}
            aria-label="Let AI predict mood automatically"
          />
          Let AI Predict Mood
        </label>

        <div className="flex items-center gap-4">
          <input
            id="mood"
            type="range"
            min="1"
            max="5"
            value={mood}
            onChange={(e) => setMood(parseInt(e.target.value))}
            className="range-slider flex-1"
            disabled={useLlmPrediction}
            aria-describedby="mood-helper"
          />
          <span className={useLlmPrediction ? 'text-muted' : 'text-accent'}>
            {mood}
          </span>
        </div>
        <p id="mood-helper" className="form-helper">
          {useLlmPrediction
            ? 'AI will automatically infer your mood from the entry content'
            : '1 = bad mood, 5 = good mood'}
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="tags">Tags</label>
        <div className="flex gap-2 mb-4">
          <input
            id="tags"
            type="text"
            className="input flex-1"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag()
              }
            }}
            placeholder="Add a tag..."
          />
          <button type="button" onClick={handleAddTag} className="btn btn-secondary">
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

      <button type="submit" className="btn btn-primary" disabled={saving || !hasContent}>
        {saving ? 'Saving...' : 'Save Entry'}
      </button>
    </form>
  )
}
