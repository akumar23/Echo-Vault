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
        <div className="container">
          <p className="loading">Loading...</p>
        </div>
      </ProtectedRoute>
    )
  }

  if (!entry) {
    return (
      <ProtectedRoute>
        <div className="container">
          <div className="alert alert--error">Entry not found</div>
          <Link href="/entries" className="btn btn-secondary">
            Back to Entries
          </Link>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container">
        <Header title={entry.title || 'Untitled'} showNav={false} />

        <div className="mb-5">
          <Link href="/entries" className="nav-link">
            &larr; Back to Entries
          </Link>
        </div>

        <div className="card mb-5">
          <h1 className="mb-2">{entry.title || 'Untitled'}</h1>
          <p className="text-muted mb-5">
            {format(new Date(entry.created_at), 'MMMM d, yyyy')}
          </p>

          <Editor
            entry={entry}
            onSave={(data) => updateMutation.mutateAsync(data)}
            saving={updateMutation.isPending}
          />

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => deleteMutation.mutate(entryId)}
              className="btn btn-danger"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => forgetMutation.mutate(entryId)}
              className="btn btn-secondary"
              disabled={forgetMutation.isPending}
            >
              {forgetMutation.isPending ? 'Forgetting...' : 'Forget (Remove from Search)'}
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
