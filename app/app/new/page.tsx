'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCreateEntry } from '@/hooks/useEntryMutations'
import { WritingEditor } from '@/components/WritingEditor'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ArrowLeft } from 'lucide-react'

export default function NewEntryPage() {
  const [saving, setSaving] = useState(false)
  const mutation = useCreateEntry()

  const handleSave = async (entry: { title?: string; content: string; tags: string[]; mood_user?: number }) => {
    setSaving(true)
    try {
      await mutation.mutateAsync(entry)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="writing-page">
        {/* Minimal navigation bar */}
        <nav className="writing-page__nav">
          <Link href="/" className="writing-page__back">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
          <ThemeToggle />
        </nav>

        <WritingEditor onSave={handleSave} saving={saving} />
      </div>
    </ProtectedRoute>
  )
}
