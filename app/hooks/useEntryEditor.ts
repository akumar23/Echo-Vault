import { useState, useEffect, useCallback } from 'react'
import { Entry } from '@/lib/api'

export interface EntryEditorState {
  title: string
  content: string
  tags: string[]
  tagInput: string
  mood: number
  useLlmPrediction: boolean
}

export interface EntryEditorActions {
  setTitle: (title: string) => void
  setContent: (content: string) => void
  setTags: (tags: string[]) => void
  setTagInput: (input: string) => void
  setMood: (mood: number) => void
  setUseLlmPrediction: (use: boolean) => void
  handleAddTag: () => void
  handleRemoveTag: (tag: string) => void
  getEntryData: () => { title?: string; content: string; tags: string[]; mood_user?: number }
  hasContent: boolean
}

export interface UseEntryEditorOptions {
  entry?: Entry
  /** Normalize tags to lowercase. Default: true */
  normalizeTags?: boolean
}

/**
 * Shared hook for entry editing state management.
 * Used by both Editor and WritingEditor components.
 */
export function useEntryEditor(options: UseEntryEditorOptions = {}): EntryEditorState & EntryEditorActions {
  const { entry, normalizeTags = true } = options

  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [tags, setTags] = useState<string[]>(entry?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [mood, setMood] = useState(entry?.mood_user ?? 3)
  const [useLlmPrediction, setUseLlmPrediction] = useState(entry?.mood_user == null)

  // Sync state when entry prop changes
  useEffect(() => {
    if (entry) {
      setTitle(entry.title ?? '')
      setContent(entry.content ?? '')
      setTags(entry.tags ?? [])
      setMood(entry.mood_user ?? 3)
      setUseLlmPrediction(entry.mood_user == null)
    }
  }, [entry])

  const handleAddTag = useCallback(() => {
    const trimmed = normalizeTags ? tagInput.trim().toLowerCase() : tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
      setTagInput('')
    }
  }, [tagInput, tags, normalizeTags])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }, [])

  const getEntryData = useCallback(() => ({
    title: title.trim() || undefined,
    content,
    tags,
    mood_user: useLlmPrediction ? undefined : mood
  }), [title, content, tags, mood, useLlmPrediction])

  const hasContent = content.trim().length > 0

  return {
    // State
    title,
    content,
    tags,
    tagInput,
    mood,
    useLlmPrediction,
    // Actions
    setTitle,
    setContent,
    setTags,
    setTagInput,
    setMood,
    setUseLlmPrediction,
    handleAddTag,
    handleRemoveTag,
    getEntryData,
    hasContent,
  }
}
