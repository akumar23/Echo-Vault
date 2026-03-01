'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@/hooks/useChat'

interface ChatPanelProps {
  reflection: string
}

/**
 * Standalone chat panel for conversing with the reflection assistant.
 * Designed to be used in its own modal.
 */
export function ChatPanel({ reflection }: ChatPanelProps) {
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
    sendMessage
  } = useChat({
    enabled: true,
    onError: (err) => setError(err)
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input on mount
  useEffect(() => {
    // Small delay to ensure modal animation completes
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

  return (
    <div className="chat-panel">
      {!isConnected && (
        <div className="chat-status-bar">
          <span className="chat-status chat-status--disconnected">
            {isReconnecting
              ? `Reconnecting... (attempt ${reconnectAttempt}/5)`
              : 'Connecting...'}
          </span>
        </div>
      )}

      {error && (
        <div className="alert alert--error alert--sm">
          {error}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && !streamingContent && (
          <div className="chat-empty">
            <p className="text-muted">
              Ask questions about your reflection or journal entries.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`chat-message chat-message--${message.role}`}
          >
            <div className="chat-message__label">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div className="chat-message__content">
              {message.role === 'assistant' ? (
                <div className="prose prose-sm">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}

        {streamingContent && (
          <div className="chat-message chat-message--assistant">
            <div className="chat-message__label">Assistant</div>
            <div className="chat-message__content">
              <div className="prose prose-sm">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
              <span className="chat-cursor" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Ask about your reflection..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={!isConnected || isStreaming}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={!isConnected || isStreaming || !inputValue.trim()}
        >
          {isStreaming ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
