'use client'

import { useEntry } from '@/hooks/useEntries'
import {
  useUpdateEntry,
  useDeleteEntry,
  useForgetEntry,
} from '@/hooks/useEntryMutations'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { WritingEditor } from '@/components/WritingEditor'
import { EntryReflectionPanel } from '@/components/EntryReflectionPanel'
import { Echoes } from '@/components/Echoes'
import { ReversePrompt } from '@/components/ReversePrompt'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  MessageCircle,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react'

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
        <Header />
        <main className="mx-auto w-full max-w-2xl px-6 py-8">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      </ProtectedRoute>
    )
  }

  if (!entry) {
    return (
      <ProtectedRoute>
        <Header />
        <main className="mx-auto w-full max-w-2xl px-6 py-8">
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>Entry not found</AlertDescription>
          </Alert>
          <Button asChild variant="secondary">
            <Link href="/entries">Back to entries</Link>
          </Button>
        </main>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Header />
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        {/* Meta row */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/entries"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All entries
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {format(new Date(entry.created_at), 'MMMM d, yyyy')}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => forgetMutation.mutate(entryId)}
                  disabled={forgetMutation.isPending}
                >
                  {forgetMutation.isPending ? 'Forgetting…' : 'Forget'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => deleteMutation.mutate(entryId)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive focus:text-destructive"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <WritingEditor
          entry={entry}
          onSave={(data) => updateMutation.mutateAsync(data)}
          saving={updateMutation.isPending}
        />

        <Echoes entryId={entryId} />

        {/* Reflection with inline Chat entry point */}
        <Card variant="bordered" className="mt-10">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Reflection</CardTitle>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3"
            >
              <Link
                href={`/conversations/${entry.id}`}
                aria-label="Ask about this entry"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Chat
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <EntryReflectionPanel entryId={entryId} />
          </CardContent>
        </Card>

        <ReversePrompt />
      </main>
    </ProtectedRoute>
  )
}
