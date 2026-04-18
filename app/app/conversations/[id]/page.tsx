'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { useEntry } from '@/hooks/useEntries'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink } from 'lucide-react'
import { ConversationsLayout } from '../_layout-shell'

/**
 * /conversations/[id] — chat anchored to a specific entry.
 *
 * The backend chat websocket is shared across conversations; this page
 * simply hydrates the right-hand context pane with the entry the user
 * chose to reference and marks it active in the left sidebar.
 */
export default function ConversationPage() {
  const params = useParams()
  const entryId = parseInt(params.id as string, 10)

  return (
    <ProtectedRoute>
      <div className="flex h-[100dvh] flex-col bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
          <Header title="Conversations" />
        </div>
        <ConversationsLayout
          activeEntryId={entryId}
          contextPane={<EntryContext entryId={entryId} />}
        />
      </div>
    </ProtectedRoute>
  )
}

function EntryContext({ entryId }: { entryId: number }) {
  const { data: entry, isLoading } = useEntry(entryId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!entry) {
    return (
      <p className="text-sm text-muted-foreground">
        Entry not found or no longer available.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-medium text-foreground">
          {entry.title || 'Untitled'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {format(new Date(entry.created_at), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {entry.content}
      </p>

      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag: string) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Button asChild variant="outline" size="sm" className="w-full">
        <Link href={`/entries/${entry.id}`}>
          <ExternalLink className="h-4 w-4" />
          Open full entry
        </Link>
      </Button>
    </div>
  )
}
