# Features

A tour of what EchoVault does, written from the user's perspective. If you want to know how the same features are wired up internally, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## The big idea

EchoVault is a journaling app where:

1. You write entries in a clean editor.
2. The app reads them with a local AI to surface patterns and insights.
3. You can search by what you *meant*, not just the words you used.
4. Nothing leaves your machine unless you ask it to.

Everything below builds on those four ideas.

---

## Writing entries

### The editor

Open `/new` (or hit `Cmd/Ctrl + Shift + E` if you're using the desktop app) for a distraction-free writing surface.

| Feature | What it does |
|---|---|
| Inline title | Type your title at the top, it scales with the prose. |
| Word count | Live count in the toolbar. |
| Auto-save indicator | Shows whether you have unsaved changes. |
| `Cmd/Ctrl + S` | Save the entry. |
| Tag input | Add comma-separated tags. |
| Mood picker | Pick a 1-5 mood, or toggle "Let AI detect mood" to skip it. |

### Voice input

Click the mic icon to dictate. EchoVault uses the browser's built-in Web Speech API:

- **Real-time transcription** as you speak
- **Continuous mode** for longer sessions
- **Appends** to whatever you've already typed

Works best in Chrome and Edge. Firefox support varies.

### Mood

A 1-5 scale with emoji indicators:

| Score | Label | Meaning |
|---|---|---|
| 1 | Very Negative | Despair, severe anxiety, hopelessness |
| 2 | Somewhat Negative | Stress, frustration, sadness |
| 3 | Neutral | Mixed emotions, factual reporting |
| 4 | Somewhat Positive | Contentment, hope, calm |
| 5 | Very Positive | Joy, achievement, love |

If you don't pick a mood, a background AI job reads the entry and infers one. The inferred score is shown alongside any score you set manually, so you can spot disagreement.

---

## Reading and finding entries

### The dashboard

`/journal` is the main view. You'll see:

- **Personalized greeting** — time-of-day aware, mood-aware.
- **Recent entries panel** — the last 5 entries, click to expand.
- **Reflection panel** — an AI-generated note about your recent writing (more on this below).
- **Mood insights** — chart of your mood over 7 / 30 / 90 days, plus AI-generated observations.
- **Streaks and best days** — light gamification.

### Semantic search

`/entries` has a search bar that does **semantic search** — it understands meaning, not just keywords.

Search "feeling stuck at work" and you'll get hits like "Why is everything boring lately?" or "Need to switch projects" — because the AI knows those are about the same thing.

How it works under the hood:

1. Your query is turned into a 1024-dimensional vector by the embedding model.
2. PostgreSQL (with pgvector) finds entries whose vectors are closest by cosine similarity.
3. Each result's score is multiplied by a time-decay factor:

   ```
   score = similarity * (1 / (1 + age_days / half_life_days))
   ```

   Recent entries get a small boost; ancient entries need to be very on-topic to rank.

4. Results come back ranked by combined score.

You can adjust the half-life in Settings (default: 30 days). Lower = favor recent. Higher = treat all entries equally.

Optional filters:
- Date range
- Tag filter
- Number of results (`k`, default 10)

### Entry detail

`/entries/[id]` shows one entry full-screen, with edit, delete, and "forget" buttons. From here you can also open a **chat** anchored to just this one entry.

---

## AI features

### Reflections

A reflection is a short (~250 word) AI-generated note about your recent journaling. It might say something like:

> You've mentioned feeling overwhelmed three times this week, mostly tied to deadlines. Notice that "smaller chunks" appears as a coping idea on Tuesday but doesn't reappear later — worth revisiting.

The flow:

- The reflection is generated in the background and **cached in Redis**.
- The frontend polls `GET /reflections` every couple of seconds until the status flips from `generating` to `complete`.
- The cache is invalidated whenever you create, update, or delete an entry — so reflections stay current.

### Chat

Click "Chat" on the dashboard or any entry to open a real-time conversation about your journal.

Two modes:

| Mode | What's in context |
|---|---|
| **All entries** (default) | The current reflection + the top 3 semantically-similar entries to your message |
| **Pinned to one entry** | Just that entry's full content (capped at 4000 chars) |

The chat is delivered over a WebSocket and streams token-by-token, so you see the answer typing out in real time. Conversation history is kept for the last 10 messages so follow-ups have context.

Per-connection limits:
- Max 2000 chars per message
- Max 10 messages per minute (sliding window)

### Insights

`/insights` generates a longer analysis on demand. Pick a window:

- 3-day
- 7-day (default)
- 14-day
- 30-day

Each insight contains:

- **Summary** — a factual overview of the period.
- **Themes** — 3-5 phrases like "creative work", "family", "burnout".
- **Suggested actions** — concrete recommendations the AI thinks would help.

Insights are persisted to the database so you can scroll back through them.

### Semantic mood insights

A more advanced analysis that correlates topics with mood:

| Type | Example |
|---|---|
| `positive_theme` | "Your mood lifts when writing about creative projects." |
| `negative_theme` | "Entries about work deadlines tend toward lower mood." |
| `mood_trend` | "Your overall mood has been improving over time." |

Requirements:
- At least 10 entries with mood data
- At least 3 entries each in the high (4+) or low (2-) buckets
- The LLM extracts a common theme phrase from grouped entries

### Mood nudges

When your recent mood average drops below 2.5 **and** you haven't journaled in 2+ days, EchoVault surfaces a gentle nudge with a writing prompt. Examples:

- "What's one small thing that brought you comfort today?"
- "If you could tell your past self one thing, what would it be?"
- "What would make tomorrow a little better?"

Click to start a new entry with the prompt pre-loaded, or dismiss it.

### Similar entries (positive surfacing)

When your recent mood is high (4+), the dashboard shows up to 3 past entries with similarly high moods. The idea: help you notice what was working when you were doing well.

---

## Privacy and data control

### Local-first by default

Out of the box, all AI calls go to a local Ollama instance. No journal text leaves your machine. You can verify this — block outbound traffic and the app still works.

### Optional cloud LLMs

If you want to use OpenAI, Groq, Together.ai, or any OpenAI-compatible API, configure it per-account in Settings. The UI shows you what URL each request will go to.

### Soft delete (default)

When you "forget" an entry:

- `entries.is_deleted` is set to `true` — the entry disappears from the UI.
- `entry_embeddings.is_active` is set to `false`.
- The embedding vector is overwritten with 1024 zeros — the entry can no longer surface in semantic search.
- The original content stays in the database (recoverable in principle, but not via the UI).

### Hard delete (opt-in)

Toggle "Hard delete" in Settings. After that, "forget" actually deletes:

- Entry row → gone
- Embedding row → gone
- Attachment files on disk → gone

There's no undo.

### Export

`GET /export/entries` returns your data as JSONL (one JSON object per line). Each line includes the entry plus its embedding vector, so you can migrate to another system without losing semantic search.

---

## Authentication

- **JWT-based.** Tokens are signed with `JWT_SECRET` and expire after 7 days by default.
- **bcrypt** password hashing (with a SHA-256 preprocessing step for passwords longer than 72 bytes).
- **Stored in two places** in the browser: `localStorage` for the axios HTTP client, and a cookie for the Next.js middleware that gates routes.
- **WebSockets** can't send custom headers, so they use a different mechanism: `GET /auth/ws-ticket` returns a single-use ticket (60s TTL), which the WebSocket includes as a query string. See [WEBSOCKET_AUTH_GUIDE.md](WEBSOCKET_AUTH_GUIDE.md).

All data endpoints require a valid JWT. All queries are scoped to the authenticated user — you can't read someone else's entries even if you guess their entry ID.

---

## Settings page

`/settings` lets users override per-account preferences:

### Search

- **Half-life days** (1-365, default 30) — controls how aggressively older entries decay in search.

### LLM endpoints

You configure generation and embedding **separately**, each with URL + token + model. This lets you mix providers — for example, local embeddings + cloud generation.

| Field | Example |
|---|---|
| Generation URL | `http://localhost:11434` or `https://api.openai.com/v1` |
| Generation Model | `llama3.1:8b` or `gpt-4o-mini` |
| Generation API Token | Bearer token (only needed for cloud) |
| Embedding URL | `http://localhost:11434` |
| Embedding Model | `mxbai-embed-large` or `text-embedding-3-small` |
| Embedding API Token | Bearer token (only needed for cloud) |

Tokens are write-only — once saved, they're never returned by the API.

### Privacy

- **Hard delete toggle** — switches "forget" from soft to hard.

### Insight voice

Three personalities for AI-generated text:

| Voice | Style | Sample greeting |
|---|---|---|
| Gentle | Warm, supportive | "You've been on a great streak lately." |
| Direct | Concise, factual | "Mood up. Strong momentum." |
| Playful | Fun, expressive | "Look at you go! On fire!" |

### Theme

Light, dark, or follow system. Persisted in `localStorage`.

---

## Background processing

Everything slow runs in a Celery worker so the UI stays snappy:

| Job | When it runs | How long |
|---|---|---|
| Embedding | Entry created or updated | ~500ms - 2s |
| Mood inference | Entry created without a user-set mood | ~1 - 5s |
| Reflection | On reflection request, after entry changes | ~5 - 30s |
| Insights | Manual trigger or scheduled cron | ~5 - 30s |

All jobs auto-retry up to 3 times with exponential backoff if they fail (e.g. Ollama momentarily unreachable).

For weekly insights, set up an external cron to call `POST /insights/cron/weekly` — there's no Celery Beat in this deployment.

---

## Desktop app

EchoVault also ships as a Tauri-based desktop app for macOS, Windows, and Linux:

- **System tray** — minimize the app, quick "new entry" shortcut.
- **Global hotkey** — `Cmd/Ctrl + Shift + E` opens a new entry from anywhere.
- **Native notifications** — reminders and mood nudges via OS notifications.
- **Auto-update** — when new versions are released.

The desktop app still requires Docker Desktop running with the backend services. It's a wrapper around the same web app, not a standalone build.

See [README.md](../README.md#desktop-app) for installation.

---

## API summary

Every feature above is built on top of these endpoints:

### Auth
- `POST /auth/register` — create account
- `POST /auth/login` — get JWT
- `POST /auth/refresh` — refresh token
- `POST /auth/logout` — clear cookie
- `GET /auth/me` — current user
- `GET /auth/ws-ticket` — single-use WebSocket ticket

### Entries
- `POST /entries` — create
- `GET /entries` — list
- `GET /entries/{id}` — read one
- `PUT /entries/{id}` — update
- `DELETE /entries/{id}` — soft delete
- `GET /entries/{id}/related` — find similar
- `GET /entries/{id}/echoes` — past entries that "rhyme" with this one
- `GET /entries/{id}/reflection` — per-entry reflection
- `POST /entries/{id}/reflection/regenerate` — force regen
- `POST /entries/retry-failed` — re-run failed embedding/mood jobs

### Search
- `POST /search/semantic` — semantic search with time decay

### Reflections
- `GET /reflections` — get cached or trigger generation
- `POST /reflections/regenerate` — force regen
- `GET /reflections/stream` — server-sent events stream

### Insights
- `POST /insights/generate` — generate now
- `GET /insights/recent` — list recent insights
- `GET /insights/mood-content` — semantic mood insights
- `POST /insights/cron/weekly` — endpoint for an external cron

### Settings
- `GET /settings` — read
- `PUT /settings` — update

### Privacy
- `POST /forget/{id}` — soft or hard delete based on settings
- `GET /export/entries` — JSONL export

### Prompts (suggestions)
- `GET /prompts/suggestions` — get a prompt
- `POST /prompts/interaction` — record accept/dismiss
- `GET /prompts/stats` — interaction stats
- `GET /prompts/reverse` — reverse prompts (entry → suggested follow-up)
- `GET /prompts/welcome-back` — re-engagement prompts

### Chat
- `WS /chat/ws/chat?ticket=...&entry_id=...` — streaming chat (see [WEBSOCKET_AUTH_GUIDE.md](WEBSOCKET_AUTH_GUIDE.md))

### Health
- `GET /health` — DB only (lightweight, used by load balancers)
- `GET /health/full` — DB + Redis

For request/response schemas, see [API.md](API.md) or the live interactive docs at http://localhost:8000/docs.

---

## Where to go next

- [README.md](../README.md) — project overview and quick start
- [SETUP.md](../SETUP.md) — first-time install guide
- [ARCHITECTURE.md](ARCHITECTURE.md) — how these features are implemented
- [API.md](API.md) — endpoint reference
