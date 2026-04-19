'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Entry, promptsApi } from '@/lib/api'
import { VoiceInput } from './VoiceInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { MoreHorizontal, X } from 'lucide-react'

interface WritingEditorProps {
  entry?: Entry
  onSave: (entry: {
    title?: string
    content: string
    tags: string[]
    mood_user?: number
  }) => Promise<void>
  saving?: boolean
  initialPrompt?: string
  promptType?: 'question' | 'prompt' | 'continuation'
  sourceEntryId?: number
  /** Autosave delay in milliseconds. Set to 0 to disable autosave. Default: 3000ms */
  autosaveDelay?: number
  /** When true, autosave saves to localStorage as a draft instead of calling API. Default: false */
  isDraft?: boolean
  /** Callback to clear draft from localStorage after successful save */
  onDraftClear?: () => void
  /** Initial draft data to restore from localStorage */
  initialDraft?: DraftData | null
}

const MOOD_LABELS = ['Low', 'Down', 'Neutral', 'Good', 'Great']
const MOOD_EMOJIS = [
  '\u{1F622}',
  '\u{1F615}',
  '\u{1F610}',
  '\u{1F642}',
  '\u{1F60A}',
]

const DRAFT_STORAGE_KEY = 'echovault_draft'

export interface DraftData {
  title: string
  content: string
  tags: string[]
  mood: number
  useLlmPrediction: boolean
  savedAt: string
}

export function saveDraftToStorage(draft: DraftData): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch (error) {
    console.error('Failed to save draft:', error)
  }
}

export function loadDraftFromStorage(): DraftData | null {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as DraftData
    }
  } catch (error) {
    console.error('Failed to load draft:', error)
  }
  return null
}

export function clearDraftFromStorage(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear draft:', error)
  }
}

/**
 * WritingEditor — distraction-free, editorial writing surface.
 *
 * The surface is the page: no cards, borders, or persistent toolbars. Mood,
 * tags, and AI-detection controls live behind a MoreHorizontal dropdown so
 * the blank page invites prose. Autosave is expressed as a single pulsing
 * accent dot; explicit saves are still available via the Save button and
 * Cmd/Ctrl+S. All data, draft-restore, and keyboard-shortcut behaviors are
 * preserved from the previous chrome'd version.
 */
export function WritingEditor({
  entry,
  onSave,
  saving = false,
  initialPrompt,
  promptType,
  sourceEntryId,
  autosaveDelay = 3000,
  isDraft = false,
  onDraftClear,
  initialDraft,
}: WritingEditorProps) {
  // Initialize from entry (existing), initialDraft (restored draft), or empty state
  const [title, setTitle] = useState(entry?.title ?? initialDraft?.title ?? '')
  const [content, setContent] = useState(
    entry?.content ?? initialDraft?.content ?? ''
  )
  const [tags, setTags] = useState<string[]>(
    entry?.tags ?? initialDraft?.tags ?? []
  )
  const [tagInput, setTagInput] = useState('')
  const [mood, setMood] = useState(entry?.mood_user ?? initialDraft?.mood ?? 3)
  const [useLlmPrediction, setUseLlmPrediction] = useState(
    entry?.mood_user == null && (initialDraft?.useLlmPrediction ?? true)
  )
  const [hasChanges, setHasChanges] = useState(false)
  const [showPrompt, setShowPrompt] = useState(!!initialPrompt)
  const [isAutosaving, setIsAutosaving] = useState(false)
  const [lastSavedContent, setLastSavedContent] = useState(
    entry?.content ?? initialDraft?.content ?? ''
  )
  const [lastSavedTitle, setLastSavedTitle] = useState(
    entry?.title ?? initialDraft?.title ?? ''
  )

  const contentRef = useRef<HTMLTextAreaElement>(null)
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Handle voice transcription
  const handleVoiceTranscript = useCallback((transcript: string) => {
    setContent((prev) => {
      const needsSpace =
        prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n')
      return prev + (needsSpace ? ' ' : '') + transcript
    })
    contentRef.current?.focus()
  }, [])

  useEffect(() => {
    if (entry) {
      setTitle(entry?.title ?? '')
      setContent(entry?.content ?? '')
      setTags(entry?.tags ?? [])
      setMood(entry?.mood_user ?? 3)
      setUseLlmPrediction(entry?.mood_user == null)
      setLastSavedContent(entry?.content ?? '')
      setLastSavedTitle(entry?.title ?? '')
    }
  }, [entry])

  useEffect(() => {
    const hasContent = content.trim().length > 0
    const isDifferent = entry
      ? content !== entry.content || title !== (entry.title ?? '')
      : hasContent
    setHasChanges(isDifferent)
  }, [content, title, entry])

  // Warn on navigate-away when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !saving && !isAutosaving) {
        e.preventDefault()
        e.returnValue =
          'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges, saving, isAutosaving])

  // Autosave
  useEffect(() => {
    if (autosaveDelay === 0 || saving || isAutosaving) return

    const hasContent = content.trim().length > 0
    const hasNewChanges =
      content !== lastSavedContent || title !== lastSavedTitle

    if (!hasContent || !hasNewChanges) return

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = setTimeout(async () => {
      setIsAutosaving(true)
      try {
        if (isDraft) {
          saveDraftToStorage({
            title,
            content,
            tags,
            mood,
            useLlmPrediction,
            savedAt: new Date().toISOString(),
          })
        } else {
          await onSave({
            title: title.trim() || undefined,
            content,
            tags,
            mood_user: useLlmPrediction ? undefined : mood,
          })
        }
        setLastSavedContent(content)
        setLastSavedTitle(title)
      } catch (error) {
        console.error('Autosave failed:', error)
      } finally {
        setIsAutosaving(false)
      }
    }, autosaveDelay)

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [
    content,
    title,
    autosaveDelay,
    saving,
    isAutosaving,
    lastSavedContent,
    lastSavedTitle,
    tags,
    mood,
    useLlmPrediction,
    onSave,
    isDraft,
  ])

  // Focus content on mount when creating a new entry
  useEffect(() => {
    if (contentRef.current && !entry) {
      contentRef.current.focus()
    }
  }, [entry])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (content.trim() && !saving) {
          handleSave()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, saving])

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      setTags(tags.filter((tag) => tag !== tagToRemove))
    },
    [tags]
  )

  const handleSave = async () => {
    await onSave({
      title: title.trim() || undefined,
      content,
      tags,
      mood_user: useLlmPrediction ? undefined : mood,
    })

    setLastSavedContent(content)
    setLastSavedTitle(title)

    if (isDraft) {
      clearDraftFromStorage()
      onDraftClear?.()
    }

    if (initialPrompt && promptType) {
      promptsApi
        .logInteraction({
          prompt_text: initialPrompt,
          prompt_type: promptType,
          action: 'completed',
          source_entry_id: sourceEntryId,
        })
        .catch(console.error)
    }
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const isSaving = saving || isAutosaving

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Status + actions row */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {isSaving ? (
            <>
              <span
                className="block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                aria-hidden="true"
              />
              <span>Saving…</span>
            </>
          ) : hasChanges ? (
            <>
              <span
                className="block h-1.5 w-1.5 rounded-full bg-[color:var(--warning)]"
                aria-hidden="true"
              />
              <span>Unsaved changes</span>
            </>
          ) : (
            <>
              <span
                className="block h-1.5 w-1.5 rounded-full bg-[color:var(--success)]"
                aria-hidden="true"
              />
              <span>Saved</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={saving} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-4">
              <div className="space-y-5">
                {/* Mood */}
                <div className="space-y-2">
                  <div className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                    Mood
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ai-detect-mood"
                      checked={useLlmPrediction}
                      onCheckedChange={setUseLlmPrediction}
                    />
                    <Label
                      htmlFor="ai-detect-mood"
                      className="text-sm font-normal"
                    >
                      Let AI detect
                    </Label>
                  </div>

                  {!useLlmPrediction && (
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => {
                        const active = mood === value
                        return (
                          <button
                            key={value}
                            type="button"
                            className={cn(
                              'flex min-h-11 flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                              active
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border text-muted-foreground hover:bg-muted'
                            )}
                            onClick={() => setMood(value)}
                            aria-label={`Mood ${value}: ${MOOD_LABELS[value - 1]}`}
                          >
                            <span className="text-base leading-none">
                              {MOOD_EMOJIS[value - 1]}
                            </span>
                            <span>{MOOD_LABELS[value - 1]}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <div className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                    Tags
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      className="h-8 flex-1 text-sm"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddTag()
                        }
                      }}
                      placeholder="Add tag…"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                    >
                      Add
                    </Button>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="inline-flex items-center gap-1 pr-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="rounded-sm p-0.5 hover:bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            aria-label={`Remove tag ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saving
              ? isDraft
                ? 'Adding…'
                : 'Saving…'
              : isDraft
                ? 'Add'
                : 'Save'}
          </Button>
        </div>
      </div>

      {/* Writing prompt from mood nudge */}
      {showPrompt && initialPrompt && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {initialPrompt}
          </p>
          <button
            type="button"
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => setShowPrompt(false)}
            aria-label="Dismiss prompt"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Title — large sans, no chrome */}
      <input
        type="text"
        className="w-full border-none bg-transparent p-0 text-2xl font-bold tracking-tight text-foreground placeholder:font-normal placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 sm:text-3xl"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        aria-label="Entry title"
      />

      {/* Content — sans, comfortable line-height */}
      <textarea
        ref={contentRef}
        className="min-h-[60vh] w-full resize-none border-none bg-transparent p-0 text-base leading-7 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          initialPrompt
            ? `Reflect on: "${initialPrompt}"`
            : 'Start writing…'
        }
        aria-label="Entry content"
      />

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <span className="hidden items-center gap-1 sm:inline-flex">
          <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            {'\u2318'}
          </kbd>
          <span>+</span>
          <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            S
          </kbd>
          <span className="ml-1">to save</span>
        </span>
      </div>
    </div>
  )
}
