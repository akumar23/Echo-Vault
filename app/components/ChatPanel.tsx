'use client'

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@/hooks/useChat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Send,
  MessageCircle,
  BookOpen,
  Library,
  RotateCcw,
  ChevronsLeftRight,
  ChevronsRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  /**
   * When provided, pins the chat to this specific entry and tells the backend
   * to use only that entry as context. When absent, the chat spans all of
   * the user's entries (default behavior).
   */
  activeEntryId?: number
  /** Display-only — used to label the scope pill when an entry is pinned. */
  activeEntryTitle?: string | null
  /** When true, the surrounding layout has hidden its side panels. */
  isExpanded?: boolean
  /** When provided, renders a header toggle to expand/collapse the chat. */
  onToggleExpanded?: () => void
}

/**
 * Standalone chat panel for conversing with the reflection assistant.
 * Uses shadcn primitives + Tailwind utilities; intended for embedding inside
 * a full-page conversations layout.
 */
export function ChatPanel({
  activeEntryId,
  activeEntryTitle,
  isExpanded,
  onToggleExpanded,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const viewportRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const {
    messages,
    streamingContent,
    isConnected,
    isStreaming,
    isReconnecting,
    reconnectAttempt,
    context,
    sendMessage,
    newConversation,
  } = useChat({
    enabled: true,
    entryId: activeEntryId,
    onError: (err) => setError(err),
  })

  const scopeLabel = activeEntryId
    ? `Entry: ${activeEntryTitle || context?.entry?.title || 'Untitled'}`
    : 'All entries'
  const ScopeIcon = activeEntryId ? BookOpen : Library

  // Auto-scroll to bottom when new content arrives, but only when the user
  // is already parked at the bottom.
  useEffect(() => {
    if (!autoScroll) return
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent, autoScroll])

  // Track whether the user is pinned to the bottom of the scroll region so
  // the auto-scroll behavior above knows when to engage.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const handleScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      setAutoScroll(distanceFromBottom < 64)
    }
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!inputValue.trim() || isStreaming) return

      sendMessage(inputValue)
      setInputValue('')
      setError(null)
      setAutoScroll(true)
    },
    [inputValue, isStreaming, sendMessage],
  )

  const handleNewConversation = useCallback(() => {
    newConversation()
    setError(null)
    setInputValue('')
    setAutoScroll(true)
    inputRef.current?.focus()
  }, [newConversation])

  const inputDisabled = !isConnected || isStreaming
  const sendDisabled = inputDisabled || !inputValue.trim()
  const emptyStateCopy = activeEntryId
    ? 'Ask anything about this entry — themes, feelings, loose ends.'
    : 'Ask anything about your journal — patterns, memories, recurring themes.'

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Header: scope + actions */}
      <div className="glass flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
        <Badge variant="secondary" className="gap-1.5">
          <ScopeIcon className="h-3 w-3" />
          <span className="truncate max-w-[14ch] sm:max-w-[22ch] md:max-w-[32ch]" title={scopeLabel}>{scopeLabel}</span>
        </Badge>
        <div className="flex items-center gap-1.5">
          {!isConnected && (
            <Badge
              variant="outline"
              className="gap-1.5 border-[color:var(--warning)]/40 text-[color:var(--warning)]"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {isReconnecting
                ? `Reconnecting (${reconnectAttempt}/5)`
                : 'Connecting'}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewConversation}
            disabled={isStreaming}
            className="h-7 gap-1.5 text-xs"
            aria-label="Start a new conversation"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">New chat</span>
          </Button>
          {onToggleExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpanded}
              className="hidden h-7 w-7 md:inline-flex"
              aria-label={isExpanded ? 'Show side panels' : 'Hide side panels'}
              aria-pressed={isExpanded}
              title={isExpanded ? 'Show side panels' : 'Hide side panels'}
            >
              {isExpanded ? (
                <ChevronsRightLeft className="h-3.5 w-3.5" />
              ) : (
                <ChevronsLeftRight className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 pt-3">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div ref={viewportRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 pb-28 sm:gap-8 sm:px-6 sm:pb-8">
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-12 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 opacity-40" />
              <p className="text-[15px]">{emptyStateCopy}</p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble key={index} role={message.role}>
              {message.role === 'assistant' ? (
                <div className="prose prose-neutral max-w-none break-words [overflow-wrap:anywhere] text-[16px] leading-relaxed text-foreground [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-relaxed">
                  {message.content}
                </p>
              )}
            </MessageBubble>
          ))}

          {streamingContent && (
            <div aria-live="polite" aria-atomic="false">
              <MessageBubble role="assistant">
                <div className="prose prose-neutral max-w-none break-words [overflow-wrap:anywhere] text-[16px] leading-relaxed text-foreground [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle"
                />
              </MessageBubble>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:px-0 sm:pb-0"
      >
        <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-2 px-0 sm:px-6 sm:py-4">
          <div className="glass-strong flex w-full items-center gap-1 rounded-full border border-border/50 py-1.5 pl-5 pr-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-colors focus-within:border-border-light">
            <Input
              ref={inputRef}
              type="text"
              autoFocus
              placeholder={
                activeEntryId
                  ? 'Ask about this entry…'
                  : 'Ask about your journal…'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={inputDisabled}
              className="h-10 flex-1 border-0 bg-transparent px-0 text-[16px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              type="submit"
              disabled={sendDisabled}
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function MessageBubble({
  role,
  children,
}: {
  role: 'user' | 'assistant'
  children: React.ReactNode
}) {
  const isUser = role === 'user'
  if (!isUser) {
    return (
      <div className="flex w-full justify-start">
        <div className="min-w-0 max-w-full overflow-hidden text-foreground">
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className="flex w-full justify-end">
      <div className="min-w-0 max-w-[85%] overflow-hidden rounded-3xl bg-primary/10 px-4 py-2.5 text-foreground">
        {children}
      </div>
    </div>
  )
}
