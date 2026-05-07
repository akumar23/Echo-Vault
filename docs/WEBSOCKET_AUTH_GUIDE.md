# WebSocket Authentication Guide

This doc explains how the chat WebSocket is authenticated and how to connect to it from a client.

If you only want a quick code snippet to copy, jump to [WEBSOCKET_QUICK_REFERENCE.md](WEBSOCKET_QUICK_REFERENCE.md). For an overview of what the chat feature does, see [FEATURES.md](FEATURES.md).

---

## Why WebSockets need a different auth flow

Regular HTTP requests can carry an `Authorization: Bearer <token>` header. WebSocket connections opened from a browser **cannot** — the browser API does not let you set custom headers. There are two common workarounds:

1. **Token in the query string.** Easy, but the token ends up in proxy/server access logs. Bad for long-lived JWTs.
2. **One-time tickets.** The client first calls a normal HTTP endpoint (cookie-authenticated) to mint a short-lived ticket, then opens the WebSocket with `?ticket=<ticket>`. The ticket is consumed on use and never reappears.

EchoVault uses the second approach.

---

## The endpoint

There is a single chat WebSocket:

```
WS /chat/ws/chat?ticket={ticket}&entry_id={optional_entry_id}
```

| Query param | Required | Notes |
|---|---|---|
| `ticket` | yes | Single-use ticket from `GET /auth/ws-ticket`. Expires 60 seconds after issue. |
| `entry_id` | no | When set, the chat is pinned to one entry. The LLM is given just that entry's content as context. When omitted, the chat spans all entries. |

---

## The flow

```
1. Browser → GET /auth/ws-ticket
   (cookie set during /auth/login is used to authenticate)
   ← { "ticket": "abc123...", "expires_in": 60 }

2. Browser opens WebSocket:
   WS /chat/ws/chat?ticket=abc123...

3. Server validates and consumes the ticket
4. Server sends an initial "context" message
5. Client sends chat_message events
6. Server streams token events, then a complete event
```

The ticket is single-use: the same string can never open a second connection.

---

## Message protocol

### Client → Server

```json
{ "type": "chat_message", "content": "your message text" }
```

That's the only message type the server reads. Anything else is ignored.

### Server → Client

After `accept()`, the first message is always:

```json
{
  "type": "context",
  "scope": "all" | "entry",
  "reflection": "the cached reflection text",
  "entry": { "id": 12, "title": "...", "created_at": "..." },
  "related_entries": []
}
```

(`entry` only present when `scope == "entry"`. `related_entries` is filled per-message in "all" scope.)

For each user message, the server then streams:

```json
{ "type": "token", "content": "partial..." }
{ "type": "token", "content": " response..." }
{ "type": "token", "content": " text..." }
{ "type": "complete" }
```

On error:

```json
{ "type": "error", "message": "human-readable description" }
```

---

## Close codes

| Code | Meaning | Action |
|---|---|---|
| 1000 | Normal close | Nothing — the conversation ended cleanly. |
| 1011 | Server error | Show a generic error; user can retry. |
| 4001 | Authentication failed (missing/invalid/expired ticket, or pinned `entry_id` not found) | Get a fresh ticket and reconnect, or check the `entry_id`. |
| 4002 | User not found or inactive | Send the user to login. |

---

## Per-connection limits

The chat WebSocket enforces:

- **Max 2000 characters per message.** Longer messages get an `error` and are dropped.
- **Max 10 messages per minute** (sliding window). Beyond that, the server replies with a rate-limit `error`.

---

## Browser client example

A minimal vanilla TypeScript client:

```typescript
async function startChat(entryId?: number) {
  // 1. Mint a ticket via the cookie-authenticated HTTP endpoint
  const res = await fetch(`${API_BASE}/auth/ws-ticket`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get ws-ticket');
  const { ticket } = await res.json();

  // 2. Open the WebSocket
  const url = new URL('/chat/ws/chat', WS_BASE);
  url.searchParams.set('ticket', ticket);
  if (entryId != null) url.searchParams.set('entry_id', String(entryId));

  const ws = new WebSocket(url.toString());

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case 'context':
        console.log('Initial context:', msg);
        break;
      case 'token':
        appendToken(msg.content);
        break;
      case 'complete':
        markComplete();
        break;
      case 'error':
        console.error(msg.message);
        break;
    }
  };

  ws.onclose = (e) => {
    if (e.code === 4001) redirectToLogin();
    else if (e.code === 4002) showError('Account is inactive.');
    else if (e.code !== 1000) showError(`Connection closed (${e.code})`);
  };

  return ws;
}

function sendMessage(ws: WebSocket, text: string) {
  ws.send(JSON.stringify({ type: 'chat_message', content: text }));
}
```

`API_BASE` is `http://localhost:8000` (or your deployment). `WS_BASE` is the same URL with `http`/`https` swapped for `ws`/`wss`.

---

## React hook example

```typescript
import { useEffect, useRef, useState } from 'react';

interface UseChatOptions {
  entryId?: number;
  enabled: boolean;
}

export function useChat({ entryId, enabled }: UseChatOptions) {
  const [tokens, setTokens] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      const res = await fetch('/api/auth/ws-ticket', { credentials: 'include' });
      if (!res.ok) {
        setError('Authentication failed');
        return;
      }
      const { ticket } = await res.json();
      if (cancelled) return;

      const url = new URL('/chat/ws/chat', WS_BASE);
      url.searchParams.set('ticket', ticket);
      if (entryId != null) url.searchParams.set('entry_id', String(entryId));

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'token') setTokens((prev) => prev + msg.content);
        if (msg.type === 'complete') {/* handle done */}
        if (msg.type === 'error') setError(msg.message);
      };

      ws.onclose = (e) => {
        if (e.code === 4001) {
          setError('Session expired — please log in again.');
        } else if (e.code !== 1000) {
          setError(`Disconnected (${e.code})`);
        }
      };
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close(1000, 'unmount');
    };
  }, [entryId, enabled]);

  const send = (text: string) =>
    wsRef.current?.send(JSON.stringify({ type: 'chat_message', content: text }));

  return { tokens, error, send };
}
```

---

## Testing from the command line

Install [websocat](https://github.com/vi/websocat):

```bash
brew install websocat                   # macOS
cargo install websocat                  # if you have Rust
```

Then:

```bash
# 1. Login and capture the cookie
curl -c cookies.txt -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"yourpassword"}'

# 2. Mint a ticket
TICKET=$(curl -s -b cookies.txt http://localhost:8000/auth/ws-ticket | jq -r .ticket)

# 3. Connect
websocat "ws://localhost:8000/chat/ws/chat?ticket=$TICKET"

# Then type:
{"type":"chat_message","content":"What patterns do you see in my recent entries?"}
```

You should see the initial `context` message, followed by streamed `token` messages.

---

## Server-side implementation notes

Source: `api/app/routers/chat.py`.

- **Short-lived DB sessions** are used for each operation (`get_db_session()` context manager). Holding one session for the lifetime of the connection would tie up a connection from the pool for the entire chat — under any concurrency, that exhausts the pool.
- **Ticket validation** uses `token_store.consume_ws_ticket(ticket)` — atomic consume so the same ticket never validates twice.
- **Pinned-entry validation** happens before `accept()`, so an unauthorized request fails the handshake instead of opening then immediately closing.
- **Rate limiting** is a `deque` of timestamps, evicted lazily before each new message.
- **Streaming** uses `async for token in generation_service.chat_completion_stream(...)`. If the client disconnects mid-stream, breaking out of the loop closes the upstream HTTP generator, cancelling the LLM request — important for cloud providers that bill per token.

---

## Security considerations

- **Tickets are short-lived (60s) and single-use.** Even if one leaks into a log, it's useless after the next garbage-collection sweep.
- **Long-lived JWTs never appear in the WebSocket URL.** The cookie + ticket separation ensures only the `auth/ws-ticket` HTTP request is authenticated with the JWT (in a cookie, which never appears in URL logs).
- **All queries are user-scoped.** A pinned `entry_id` is filtered by `Entry.user_id == user_id` before the connection is accepted.
- **No sensitive details in error messages.** Close `reason` strings are deliberately generic.

---

## Troubleshooting

### Connection closes with code 4001 immediately

- The ticket is missing, expired, or already used. Mint a fresh one with `GET /auth/ws-ticket` right before opening the WebSocket.
- The `entry_id` query parameter points to an entry that doesn't exist or isn't owned by the authenticated user.

### Connection works in dev but not in production

Check that:
- You are using `wss://` (not `ws://`) in production.
- The frontend's `fetch('/auth/ws-ticket')` includes credentials so the cookie is sent. With cross-origin Vercel + a separate API, you usually need a Vercel rewrite to proxy `/auth/*` so the cookie is same-origin (see [DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md)).

### "Too many messages" error

Per-connection limit: 10 messages per minute. Slow down or open a new connection.

### "Message too long" error

Hard limit: 2000 characters. Split your message.

---

## Where to go next

- [WEBSOCKET_QUICK_REFERENCE.md](WEBSOCKET_QUICK_REFERENCE.md) — copy-paste snippets
- [API.md](API.md) — full HTTP endpoint reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — how chat fits into the rest of the system
