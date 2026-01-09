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
}

interface UseChatReturn {
  messages: ChatMessage[]
  streamingContent: string
  isConnected: boolean
  isStreaming: boolean
  context: ChatContext | null
  sendMessage: (content: string) => void
  reset: () => void
}

/**
 * Hook for managing WebSocket chat with the reflection assistant.
 * Connects to the chat WebSocket when enabled and manages message state.
 */
export function useChat({ enabled, onError }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [context, setContext] = useState<ChatContext | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const streamingContentRef = useRef('')
  const mountedRef = useRef(true)
  // Store onError in a ref to avoid recreating callbacks
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const reset = useCallback(() => {
    setMessages([])
    setStreamingContent('')
    streamingContentRef.current = ''
    setContext(null)
    setIsStreaming(false)
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client initiated close')
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

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

      // Handle specific close codes
      if (event.code === 4001) {
        onErrorRef.current?.('Authentication failed. Please log in again.')
      } else if (event.code === 4002) {
        onErrorRef.current?.('User not found.')
      } else if (event.code !== 1000 && event.code !== 1001) {
        // Don't show error for normal closures
        if (event.reason) {
          onErrorRef.current?.(`Connection closed: ${event.reason}`)
        }
      }
    }
  }, []) // No dependencies - uses refs for callbacks

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
    context,
    sendMessage,
    reset
  }
}
