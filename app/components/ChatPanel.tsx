'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@/hooks/useChat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  /**
   * Reflection text is unused by the panel itself; the backend pulls it from
   * the reflection cache on connect. The prop is preserved to keep existing
   * call sites (e.g. legacy modal) compiling.
   */
  reflection?: string
}

/**
 * Standalone chat panel for conversing with the reflection assistant.
 * Uses shadcn primitives + Tailwind utilities; intended for embedding inside
 * a full-page conversations layout.
 */
export function ChatPanel({}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    messages,
    streamingContent,
    isConnected,
    isStreaming,
    isReconnecting,
    reconnectAttempt,
    sendMessage,
  } = useChat({
    enabled: true,
    onError: (err) => setError(err),
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isStreaming) return

    sendMessage(inputValue)
    setInputValue('')
    setError(null)
  }

  const inputDisabled = !isConnected || isStreaming
  const sendDisabled = inputDisabled || !inputValue.trim()

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!isConnected && (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <Badge
            variant="outline"
            className="gap-2 border-[color:var(--warning)]/40 text-[color:var(--warning)]"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            {isReconnecting
              ? `Reconnecting... (attempt ${reconnectAttempt}/5)`
              : 'Connecting...'}
          </Badge>
        </div>
      )}

      {error && (
        <div className="px-4 pt-3">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                Ask questions about your reflection or journal entries.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble key={index} role={message.role}>
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </p>
              )}
            </MessageBubble>
          ))}

          {streamingContent && (
            <MessageBubble role="assistant">
              <div className="prose prose-sm max-w-none text-foreground">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
            </MessageBubble>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border bg-background/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Ask about your reflection..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={inputDisabled}
            className="flex-1"
          />
          <Button type="submit" disabled={sendDisabled} size="icon">
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
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
  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] space-y-1 rounded-lg px-4 py-3 shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-card-foreground',
        )}
      >
        <div
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            isUser ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          {isUser ? 'You' : 'Assistant'}
        </div>
        {children}
      </div>
    </div>
  )
}
