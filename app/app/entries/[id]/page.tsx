'use client'

import { useEntry } from '@/hooks/useEntries'
import { useUpdateEntry, useDeleteEntry, useForgetEntry } from '@/hooks/useEntryMutations'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Editor } from '@/components/Editor'
import { ReflectionsPanel } from '@/components/ReflectionsPanel'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'

export default function EntryDetailPage() {
  const params = useParams()
  const entryId = parseInt(params.id as string)

  const { data: entry, isLoading } = useEntry(entryId)
  const updateMutation = useUpdateEntry(entryId)
  const deleteMutation = useDeleteEntry()
  const forgetMutation = useForgetEntry()

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="container">Loading...</div>
      </ProtectedRoute>
    )
  }

  if (!entry) {
    return (
      <ProtectedRoute>
        <div className="container">Entry not found</div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container">
        <Header title={entry.title || 'Untitled'} showNav={false} />
        <div style={{ marginBottom: '1rem' }}>
          <Link href="/entries">← Back to Entries</Link>
        </div>

        <div className="card">
          <h1>{entry.title || 'Untitled'}</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            {format(new Date(entry.created_at), 'MMMM d, yyyy')}
          </p>

          <Editor
            entry={entry}
            onSave={(data) => updateMutation.mutateAsync(data)}
            saving={updateMutation.isPending}
          />

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => deleteMutation.mutate(entryId)}
              className="btn btn-secondary"
              disabled={deleteMutation.isPending}
            >
              Delete
            </button>
            <button
              onClick={() => forgetMutation.mutate(entryId)}
              className="btn btn-secondary"
              disabled={forgetMutation.isPending}
            >
              Forget (Remove from Search)
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Reflection</h2>
          <ReflectionsPanel />
        </div>
      </div>
    </ProtectedRoute>
  )
}

