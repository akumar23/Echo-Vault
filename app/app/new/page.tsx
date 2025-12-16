'use client'

import { useState } from 'react'
import { useCreateEntry } from '@/hooks/useEntryMutations'
import { Editor } from '@/components/Editor'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'

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
      <div className="container">
        <Header title="New Entry" showNav={false} />
        <div className="card">
          <Editor onSave={handleSave} saving={saving} />
        </div>
      </div>
    </ProtectedRoute>
  )
}
