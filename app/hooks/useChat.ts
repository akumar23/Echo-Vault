'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatContext {
  reflection: string
  related_entries: Array<{
    title: string | null
    content: string
    created_at: string
    score: number
  }>
}

interface UseChatOptions {
  enabled: boolean
  onError?: (error: string) => void
  /** Maximum number of reconnection attempts. Default: 5 */
  maxReconnectAttempts?: number
  /** Base delay for reconnection in ms. Default: 1000 */
  reconnectBaseDelay?: number
}

interface UseChatReturn {
  messages: ChatMessage[]
  streamingContent: string
  isConnected: boolean
  isStreaming: boolean
  isReconnecting: boolean
  reconnectAttempt: number
  context: ChatContext | null
  sendMessage: (content: string) => void
  reset: () => void
}

/**
 * Hook for managing WebSocket chat with the reflection assistant.
 * Connects to the chat WebSocket when enabled and manages message state.
 * Includes automatic reconnection with exponential backoff.
 */
export function useChat({
  enabled,
  onError,
  maxReconnectAttempts = 5,
  reconnectBaseDelay = 1000,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [context, setContext] = useState<ChatContext | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const streamingContentRef = useRef('')
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shouldReconnectRef = useRef(true)
  // Store onError in a ref to avoid recreating callbacks
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const reset = useCallback(() => {
    setMessages([])
    setStreamingContent('')
    streamingContentRef.current = ''
    setContext(null)
    setIsStreaming(false)
    setReconnectAttempt(0)
    setIsReconnecting(false)
  }, [])

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    clearReconnectTimeout()
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client initiated close')
      wsRef.current = null
    }
    setIsConnected(false)
    setIsReconnecting(false)
    setReconnectAttempt(0)
  }, [clearReconnectTimeout])

  const connect = useCallback(() => {
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) {
      onErrorRef.current?.('Not authenticated')
      return
    }

    // Don't reconnect if already connected or connecting
    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return
      }
    }

    // Build WebSocket URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws'
    const wsHost = apiUrl.replace(/^https?:\/\//, '')
    const wsUrl = `${wsProtocol}://${wsHost}/chat/ws/chat?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (mountedRef.current) {
        setIsConnected(true)
        setIsReconnecting(false)
        setReconnectAttempt(0)
      }
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return

      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'context':
            setContext({
              reflection: data.reflection,
              related_entries: data.related_entries
            })
            break

          case 'token':
            setIsStreaming(true)
            streamingContentRef.current += data.content
            setStreamingContent(streamingContentRef.current)
            break

          case 'complete':
            // Move streaming content to messages
            // Capture value before clearing to avoid race condition with async state update
            const finalContent = streamingContentRef.current
            if (finalContent) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: finalContent
              }])
            }
            streamingContentRef.current = ''
            setStreamingContent('')
            setIsStreaming(false)
            break

          case 'error':
            onErrorRef.current?.(data.message)
            setIsStreaming(false)
            break
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onerror = () => {
      if (mountedRef.current) {
        onErrorRef.current?.('WebSocket connection error')
      }
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return

      setIsConnected(false)
      setIsStreaming(false)

      // Handle specific close codes - don't reconnect for auth errors
      if (event.code === 4001) {
        onErrorRef.current?.('Authentication failed. Please log in again.')
        shouldReconnectRef.current = false
        return
      } else if (event.code === 4002) {
        onErrorRef.current?.('User not found.')
        shouldReconnectRef.current = false
        return
      }

      // Don't reconnect for normal closures (1000 = normal, 1001 = going away)
      if (event.code === 1000 || event.code === 1001) {
        return
      }

      // Attempt reconnection with exponential backoff
      setReconnectAttempt(prev => {
        const nextAttempt = prev + 1

        if (nextAttempt <= maxReconnectAttempts && shouldReconnectRef.current) {
          setIsReconnecting(true)
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s)
          const delay = Math.min(
            reconnectBaseDelay * Math.pow(2, prev),
            30000
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && shouldReconnectRef.current) {
              connect()
            }
          }, delay)
        } else if (nextAttempt > maxReconnectAttempts) {
          setIsReconnecting(false)
          onErrorRef.current?.('Connection lost. Please refresh the page to reconnect.')
        }

        return nextAttempt
      })
    }
  }, [maxReconnectAttempts, reconnectBaseDelay]) // Dependencies for reconnection config

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onErrorRef.current?.('Not connected to chat')
      return
    }

    const trimmedContent = content.trim()
    if (!trimmedContent) {
      return
    }

    // Add user message immediately for responsive UI
    setMessages(prev => [...prev, { role: 'user', content: trimmedContent }])

    // Send to server
    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      content: trimmedContent
    }))
  }, [])

  // Connect when enabled, disconnect when disabled
  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      shouldReconnectRef.current = true
      connect()
    } else {
      disconnect()
      reset()
    }

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [enabled, connect, disconnect, reset])

  return {
    messages,
    streamingContent,
    isConnected,
    isStreaming,
    isReconnecting,
    reconnectAttempt,
    context,
    sendMessage,
    reset
  }
}
