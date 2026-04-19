'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { ConversationsLayout } from './_layout-shell'

/**
 * /conversations — primary chat surface.
 *
 * Three-pane layout on md+:
 *   - Left: entry history (context anchors) in a collapsible sheet on mobile
 *   - Center: active chat stream
 *   - Right: current context (reflection) the chat is anchored to
 *
 * The backend currently exposes a single global chat stream
 * (WS /chat/ws/chat) that pulls the active reflection from cache. Until the
 * backend is extended, every "conversation" shares that same session; the
 * entry sidebar here lets users jump to /conversations/[id] to anchor the
 * right-side context pane to a specific entry.
 */
export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
          <Header title="Conversations" />
        </div>
        <ConversationsLayout />
      </div>
    </ProtectedRoute>
  )
}
