'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { ChatPanel } from '@/components/ChatPanel'
import { ReflectionsPanel } from '@/components/ReflectionsPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { format } from 'date-fns'
import { BookOpen, Menu, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared three-pane layout shell used by both `/conversations` and
 * `/conversations/[id]`. Kept as an underscore-prefixed module so the
 * App Router does not treat it as a routable segment.
 */
export function ConversationsLayout({
  activeEntryId,
  activeEntryTitle,
  contextPane,
}: {
  activeEntryId?: number
  activeEntryTitle?: string | null
  contextPane?: React.ReactNode
}) {
  const [isChatExpanded, setIsChatExpanded] = useState(false)

  return (
    <div className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 gap-4 px-4 pb-4 md:px-6">
      {/* Mobile: history in Sheet */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="glass fixed left-3 top-[4.25rem] z-30 h-10 w-10 rounded-full border border-border/50 shadow-md"
              aria-label="Open history"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="glass-strong w-[85%] max-w-sm border-r-border/50 p-0 sm:w-80"
          >
            <SheetTitle className="border-b border-border/50 px-5 py-4 text-base font-semibold">
              History
            </SheetTitle>
            <HistoryList activeEntryId={activeEntryId} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: three-pane */}
      <aside
        className={cn(
          'hidden w-64 min-h-0 flex-shrink-0 md:flex md:flex-col',
          isChatExpanded && 'md:hidden',
        )}
      >
        <Card variant="bordered" className="glass flex min-h-0 flex-1 flex-col overflow-hidden border-border/50">
          <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </div>
          <HistoryList activeEntryId={activeEntryId} />
        </Card>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Card variant="bordered" className="glass flex min-h-0 flex-1 flex-col overflow-hidden border-border/50 p-0">
          {/* `key` keys the panel (and its websocket) to the active scope so
              switching between all-entries and a specific entry always
              reopens a fresh connection. */}
          <ChatPanel
            key={activeEntryId ?? 'all'}
            activeEntryId={activeEntryId}
            activeEntryTitle={activeEntryTitle}
            isExpanded={isChatExpanded}
            onToggleExpanded={() => setIsChatExpanded((v) => !v)}
          />
        </Card>
      </main>

      <aside
        className={cn(
          'hidden w-80 min-h-0 flex-shrink-0 lg:flex lg:flex-col',
          isChatExpanded && 'lg:hidden',
        )}
      >
        <Card variant="bordered" className="glass flex min-h-0 flex-1 flex-col overflow-hidden border-border/50">
          <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Context
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">{contextPane ?? <DefaultContextPane />}</div>
          </ScrollArea>
        </Card>
      </aside>
    </div>
  )
}

function DefaultContextPane() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        Current reflection
      </div>
      <ReflectionsPanel />
    </div>
  )
}

function HistoryList({ activeEntryId }: { activeEntryId?: number }) {
  const { data: entries, isLoading } = useEntries(0, 50)

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading...</div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <BookOpen className="h-5 w-5 opacity-50" />
        <p>No entries yet.</p>
        <Button asChild variant="link" size="sm">
          <Link href="/new">Write your first entry</Link>
        </Button>
      </div>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul className="space-y-1 p-2">
        {entries.map((entry) => {
          const isActive = activeEntryId === entry.id
          return (
            <li key={entry.id}>
              <Link
                href={`/conversations/${entry.id}`}
                className={cn(
                  'block rounded-xl px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
                )}
              >
                <div className="line-clamp-1 text-[15px] font-medium">
                  {entry.title || 'Untitled'}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(entry.created_at), 'MMM d, yyyy')}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}
