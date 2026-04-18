'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  PenLine,
  MessageCircle,
  MessagesSquare,
  Settings,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { searchApi, type SearchResult } from '@/lib/api'
import { format } from 'date-fns'

/**
 * Global command palette.
 *
 * Bound to Cmd+K (mac) / Ctrl+K (others). Renders globally via app/layout.tsx.
 * Only exposes authenticated actions when a user is signed in; search is
 * performed lazily against the semantic endpoint with a 250ms debounce.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const { setTheme } = useTheme()
  const { user } = useAuth()

  // Entry-aware: "Ask about this entry" only visible on /entries/[id]
  const currentEntryId = useMemo(() => {
    if (!pathname) return null
    const match = pathname.match(/^\/entries\/(\d+)$/)
    if (match) return match[1]
    // Also expose from params when on dynamic routes
    const id = (params as { id?: string })?.id
    if (pathname.startsWith('/entries/') && id) return id
    return null
  }, [pathname, params])

  // Global hotkey binding
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Reset query whenever the palette closes so reopening feels fresh.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  // Debounce the search query
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setDebouncedQuery('')
      return
    }
    const t = setTimeout(() => setDebouncedQuery(trimmed), 250)
    return () => clearTimeout(t)
  }, [query])

  const searchEnabled = Boolean(user) && debouncedQuery.length >= 2 && open

  const { data: searchResults, isFetching: searching } = useQuery<
    SearchResult[]
  >({
    queryKey: ['command-palette-search', debouncedQuery],
    queryFn: () => searchApi.semantic(debouncedQuery, 6),
    enabled: searchEnabled,
    staleTime: 30_000,
  })

  const runAndClose = useCallback(
    (action: () => void) => {
      setOpen(false)
      // Defer navigation/action so Radix can finish its close animation.
      setTimeout(action, 10)
    },
    []
  )

  // Don't render the palette chrome at all for logged-out users.
  // Cmd+K still toggles, but we render a minimal "Sign in" surface.

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command menu"
      description="Search, navigate, or act"
    >
      <CommandInput
        placeholder={
          user
            ? 'Search entries, jump to pages, or run an action…'
            : 'Sign in to search your journal'
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? 'Searching…' : 'No results.'}
        </CommandEmpty>

        {user && searchResults && searchResults.length > 0 && (
          <>
            <CommandGroup heading="Entries">
              {searchResults.map((result) => (
                <CommandItem
                  key={result.entry_id}
                  value={`entry-${result.entry_id}-${result.title ?? ''}-${result.content.slice(0, 40)}`}
                  onSelect={() =>
                    runAndClose(() =>
                      router.push(`/entries/${result.entry_id}`)
                    )
                  }
                >
                  <FileText />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium leading-snug">
                      {result.title || 'Untitled'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {format(new Date(result.created_at), 'MMM d, yyyy')}
                      {' — '}
                      {result.content.slice(0, 80)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {user && (
          <CommandGroup heading="Actions">
            <CommandItem
              value="new-entry"
              onSelect={() => runAndClose(() => router.push('/new'))}
            >
              <PenLine />
              <span>New entry</span>
            </CommandItem>

            {currentEntryId && (
              <CommandItem
                value="ask-about-entry"
                onSelect={() =>
                  runAndClose(() =>
                    router.push(`/conversations/${currentEntryId}`)
                  )
                }
              >
                <MessageCircle />
                <span>Ask about this entry</span>
              </CommandItem>
            )}

            <CommandItem
              value="open-conversations"
              onSelect={() => runAndClose(() => router.push('/conversations'))}
            >
              <MessagesSquare />
              <span>Open conversations</span>
            </CommandItem>

            <CommandItem
              value="open-settings"
              onSelect={() => runAndClose(() => router.push('/settings'))}
            >
              <Settings />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem
            value="theme-light"
            onSelect={() => runAndClose(() => setTheme('light'))}
          >
            <Sun />
            <span>Light</span>
          </CommandItem>
          <CommandItem
            value="theme-dark"
            onSelect={() => runAndClose(() => setTheme('dark'))}
          >
            <Moon />
            <span>Dark</span>
          </CommandItem>
          <CommandItem
            value="theme-system"
            onSelect={() => runAndClose(() => setTheme('system'))}
          >
            <Laptop />
            <span>System</span>
          </CommandItem>
        </CommandGroup>

        {!user && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Account">
              <CommandItem
                value="sign-in"
                onSelect={() => runAndClose(() => router.push('/login'))}
              >
                <span>Sign in</span>
              </CommandItem>
              <CommandItem
                value="create-account"
                onSelect={() => runAndClose(() => router.push('/register'))}
              >
                <span>Create account</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
