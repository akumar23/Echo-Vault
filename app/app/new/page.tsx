'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCreateEntry } from '@/hooks/useEntryMutations'
import { WritingEditor } from '@/components/WritingEditor'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ArrowLeft } from 'lucide-react'

function NewEntryForm() {
  const [saving, setSaving] = useState(false)
  const mutation = useCreateEntry()
  const searchParams = useSearchParams()

  // Get writing prompt metadata from URL (passed from MoodNudge component)
  const initialPrompt = searchParams.get('prompt') || undefined
  const promptType = (searchParams.get('promptType') as 'question' | 'prompt' | 'continuation') || undefined
  const sourceEntryId = searchParams.get('sourceEntryId')
    ? parseInt(searchParams.get('sourceEntryId')!, 10)
    : undefined

  const handleSave = async (entry: { title?: string; content: string; tags: string[]; mood_user?: number }) => {
    setSaving(true)
    try {
      await mutation.mutateAsync(entry)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="writing-page">
      <nav className="writing-page__nav">
        <Link href="/" className="writing-page__back">
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>
        <ThemeToggle />
      </nav>

      <WritingEditor
        onSave={handleSave}
        saving={saving}
        initialPrompt={initialPrompt}
        promptType={promptType}
        sourceEntryId={sourceEntryId}
      />
    </div>
  )
}

export default function NewEntryPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="writing-page">
          <nav className="writing-page__nav">
            <Link href="/" className="writing-page__back">
              <ArrowLeft size={20} />
              <span>Back</span>
            </Link>
            <ThemeToggle />
          </nav>
          <div className="text-center text-muted p-8">Loading editor...</div>
        </div>
      }>
        <NewEntryForm />
      </Suspense>
    </ProtectedRoute>
  )
}
