'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCreateEntry } from '@/hooks/useEntryMutations'
import {
  WritingEditor,
  DraftData,
  loadDraftFromStorage,
} from '@/components/WritingEditor'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { ArrowLeft } from 'lucide-react'

function BackLink() {
  return (
    <Link
      href="/journal"
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to journal
    </Link>
  )
}

function NewEntryForm() {
  const [saving, setSaving] = useState(false)
  const [initialDraft, setInitialDraft] = useState<DraftData | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const mutation = useCreateEntry()
  const searchParams = useSearchParams()

  const initialPrompt = searchParams.get('prompt') || undefined
  const promptType =
    (searchParams.get('promptType') as
      | 'question'
      | 'prompt'
      | 'continuation') || undefined
  const sourceEntryId = searchParams.get('sourceEntryId')
    ? parseInt(searchParams.get('sourceEntryId')!, 10)
    : undefined

  useEffect(() => {
    const draft = loadDraftFromStorage()
    setInitialDraft(draft)
    setDraftLoaded(true)
  }, [])

  const handleSave = async (entry: {
    title?: string
    content: string
    tags: string[]
    mood_user?: number
  }) => {
    setSaving(true)
    try {
      await mutation.mutateAsync(entry)
    } finally {
      setSaving(false)
    }
  }

  if (!draftLoaded) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <BackLink />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <BackLink />
      <WritingEditor
        onSave={handleSave}
        saving={saving}
        initialPrompt={initialPrompt}
        promptType={promptType}
        sourceEntryId={sourceEntryId}
        isDraft={true}
        initialDraft={initialDraft}
      />
    </main>
  )
}

export default function NewEntryPage() {
  return (
    <ProtectedRoute>
      <Header />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-2xl px-6 py-8">
            <BackLink />
            <p className="text-sm text-muted-foreground">Loading editor…</p>
          </main>
        }
      >
        <NewEntryForm />
      </Suspense>
    </ProtectedRoute>
  )
}
