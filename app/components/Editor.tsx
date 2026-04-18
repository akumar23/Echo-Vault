'use client'

import { Entry } from '@/lib/api'
import { useEntryEditor } from '@/hooks/useEntryEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { X } from 'lucide-react'

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry title..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your entry here..."
          required
          className="min-h-[200px]"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="mood">Mood (1-5)</Label>
          <div className="flex items-center gap-2">
            <Switch
              id="ai-mood"
              checked={useLlmPrediction}
              onCheckedChange={setUseLlmPrediction}
              aria-label="Let AI predict mood automatically"
            />
            <Label htmlFor="ai-mood" className="text-sm font-normal">
              Let AI Predict Mood
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Slider
            id="mood"
            min={1}
            max={5}
            step={1}
            value={[mood]}
            onValueChange={(values) => setMood(values[0] ?? 3)}
            disabled={useLlmPrediction}
            aria-describedby="mood-helper"
            className="flex-1"
          />
          <span
            className={
              useLlmPrediction ? 'text-muted-foreground' : 'text-primary'
            }
          >
            {mood}
          </span>
        </div>
        <p id="mood-helper" className="text-xs text-muted-foreground">
          {useLlmPrediction
            ? 'AI will automatically infer your mood from the entry content'
            : '1 = bad mood, 5 = good mood'}
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="tags">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="tags"
            type="text"
            className="flex-1"
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
          <Button type="button" onClick={handleAddTag} variant="secondary">
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

      <Button type="submit" disabled={saving || !hasContent}>
        {saving ? 'Saving...' : 'Save Entry'}
      </Button>
    </form>
  )
}
