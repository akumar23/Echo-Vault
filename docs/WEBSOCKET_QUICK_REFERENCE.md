# WebSocket Quick Reference

Short, copy-paste snippets for the chat WebSocket. For the full explanation of why the auth flow looks like this, see [WEBSOCKET_AUTH_GUIDE.md](WEBSOCKET_AUTH_GUIDE.md).

---

## The endpoint

```
WS /chat/ws/chat?ticket={ticket}&entry_id={optional_entry_id}
```

Auth is a one-time ticket. You mint it with a normal HTTP call first.

---

## Connecting (TypeScript)

```typescript
// 1. Get a single-use ticket (cookie-authenticated)
const res = await fetch(`${API_BASE}/auth/ws-ticket`, { credentials: 'include' });
const { ticket } = await res.json();

// 2. Open the WebSocket
const url = new URL('/chat/ws/chat', WS_BASE);
url.searchParams.set('ticket', ticket);
// Optional: pin the chat to one entry
// url.searchParams.set('entry_id', String(entryId));

const ws = new WebSocket(url.toString());

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type is one of: "context", "token", "complete", "error"
};
```

`API_BASE` is your API host (`http://localhost:8000` in dev). `WS_BASE` is the same host with `http`/`https` swapped for `ws`/`wss`.

---

## Sending a message

```typescript
ws.send(JSON.stringify({ type: 'chat_message', content: 'your text here' }));
```

Limits per connection:
- Max 2000 characters per message
- Max 10 messages per minute

---

## Server message types

```json
// Initial — sent once after connect
{ "type": "context", "scope": "all" | "entry", "reflection": "...", "entry": {...}, "related_entries": [...] }

// Streaming response — repeated for each token
{ "type": "token", "content": "..." }

// End of one response
{ "type": "complete" }

// Something went wrong
{ "type": "error", "message": "..." }
```

---

## Close codes

| Code | What to do |
|---|---|
| 1000 | Normal close, nothing to do |
| 1011 | Server error — show a generic error |
| 4001 | Ticket invalid/expired, or pinned entry not found — get a fresh ticket |
| 4002 | User account inactive — send to login |

---

## Test from the terminal

```bash
# 1. Login (saves cookie)
curl -c cookies.txt -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"yourpassword"}'

# 2. Mint a ticket
TICKET=$(curl -s -b cookies.txt http://localhost:8000/auth/ws-ticket | jq -r .ticket)

# 3. Connect (requires `brew install websocat` or `cargo install websocat`)
websocat "ws://localhost:8000/chat/ws/chat?ticket=$TICKET"

# Then type a JSON message:
{"type":"chat_message","content":"Hello"}
```

---

## Run backend WebSocket tests

```bash
cd api && pytest tests/test_websocket.py -v
```

---

## Common problems

| Symptom | Likely fix |
|---|---|
| Closes with 4001 | Ticket is missing/expired/already used. Mint a new one right before connecting. |
| Closes with 4001 + you passed `entry_id` | The entry doesn't exist or isn't yours. |
| "Message too long" error | Trim to under 2000 chars. |
| "Too many messages" error | Wait — limit is 10 per minute. |
| Works in dev, breaks in production | Check `wss://` vs `ws://` and that the cookie is being sent (cross-origin needs a same-origin proxy). |

---

## Source files

- Server: `api/app/routers/chat.py`
- Tests: `api/tests/test_websocket.py`
- Full guide: [WEBSOCKET_AUTH_GUIDE.md](WEBSOCKET_AUTH_GUIDE.md)
