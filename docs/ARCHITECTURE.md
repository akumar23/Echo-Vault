# Architecture

This doc explains how EchoVault is put together. It is written for someone who wants to understand the system before reading the code. We start with the big picture, then drill into each piece. Diagrams and code references come in the second half.

If you are brand new to web apps, read [README.md](../README.md) first — it explains the user-facing features and the glossary.

---

## The big picture

EchoVault is a normal web app with one twist: it does AI work locally.

```
        Your browser
            |
            v
+------------------------+        +-----------------------+
|     Next.js (web)      | <----> |    FastAPI (api)      |
|     port 3000          |  HTTP  |    port 8000          |
+------------------------+        +-----------+-----------+
                                              |
              +-------------------------------+--------------------+
              |                  |                  |              |
              v                  v                  v              v
       +-----------+      +-----------+      +-----------+   +-----------+
       | Postgres  |      |   Redis   |      | Celery    |   |  Ollama   |
       | + pgvector|      |  (cache + |      | worker    |   |  (LLM)    |
       | port 5432 |      |   broker) |      | (no port) |   | port 11434|
       +-----------+      +-----------+      +-----------+   +-----------+
```

The frontend talks to the API. The API talks to the database, Redis, and Ollama. The worker reads jobs off Redis and also talks to the database and Ollama. None of these services talk to the outside internet, unless you explicitly configure a cloud LLM provider.

---

## What each piece does, in plain language

### Frontend — Next.js

The frontend is a Next.js 16 app using the App Router and React 19. It runs on port 3000 in development. Its only job is to render the UI and call the API.

- **Server state** (data from the API) is managed by **React Query** — it handles caching, refetching, and loading states for you.
- **Client state** (UI things like which modal is open) is managed by **Zustand** — a small, simple state library.
- **Auth** is stored in two places: `localStorage` for the axios HTTP client to read, and a cookie for the Next.js middleware to gate routes.

The main pages live under `app/app/`:

| Path | What it shows |
|---|---|
| `/` | Landing page (logged out) or dashboard (logged in) |
| `/journal` | The main dashboard with reflections, mood trends, recent entries |
| `/new` | The distraction-free editor |
| `/entries` | List + search of all entries |
| `/entries/[id]` | One entry, with edit/delete/forget |
| `/insights` | AI-generated insights (3/7/14/30-day analysis) |
| `/settings` | LLM endpoints, search half-life, privacy |
| `/login`, `/register` | Auth |

### Backend — FastAPI

The API is a FastAPI app (Python 3.11) running on port 8000. It exposes HTTP endpoints under `/auth`, `/entries`, `/search`, `/reflections`, `/insights`, `/settings`, `/forget`, `/export`, `/prompts`, plus one WebSocket at `/chat/ws/chat`.

- **ORM:** SQLAlchemy with the `psycopg` v3 driver.
- **Auth:** JWT tokens, signed with `JWT_SECRET` from your env.
- **Schema:** managed exclusively by Alembic migrations. The app never auto-creates tables from models — that prevents silent schema drift.
- **Rate limiting:** SlowAPI middleware on auth endpoints.

Browse the live, interactive docs at http://localhost:8000/docs once the API is running.

### Database — PostgreSQL + pgvector

PostgreSQL 16 stores everything: users, entries, settings, insights, attachments. The `pgvector` extension adds a `vector(1024)` column type used in the `entry_embeddings` table.

This is the key trick: instead of running a separate vector database, we use the same Postgres instance for both relational data and vector search. One database, one backup, one connection pool.

### Redis

Redis plays two roles:

1. **Celery message broker** — when the API enqueues a job, it gets pushed onto a Redis list. The worker pops jobs off and runs them.
2. **Reflection cache** — generated reflections are stored in Redis with a TTL so they load instantly the next time you open the dashboard. The cache key is invalidated whenever you create, update, or delete an entry.

### Celery worker

Celery is a separate Python process that runs background jobs. The API never blocks on slow LLM calls — it enqueues a job and returns immediately.

Jobs include:

- `embedding_job` — generate the 1024-dim vector for an entry
- `mood_job` — infer a 1-5 mood score
- `reflection_job` — generate a fresh reflection
- `insights_job` — generate 3/7/14/30-day insights

All jobs use `asyncio.run()` to call async LLM service methods. There's a design note explaining why in [architecture/async-celery-pattern.md](architecture/async-celery-pattern.md).

### Ollama (or any OpenAI-compatible API)

Ollama is a small server that runs LLMs on your machine, exposing an HTTP API on port 11434. EchoVault speaks the OpenAI API format (`/v1/chat/completions` and `/v1/embeddings`), which means anything OpenAI-compatible works as a drop-in replacement: OpenAI itself, Groq, Together.ai, vLLM, LM Studio, etc.

The `LLMService` class (`api/app/services/llm_service.py`) creates a fresh `httpx.AsyncClient` per request. This avoids event-loop issues that would otherwise occur in Celery workers.

Two factory functions resolve which endpoint to use:
- `get_generation_service_for_user(db, user_id)` — for chat/reflection/insight calls
- `get_embedding_service_for_user(db, user_id)` — for vector embeddings

Both fall back to the server-wide defaults (`DEFAULT_GENERATION_*` and `DEFAULT_EMBEDDING_*` env vars) if the user has not configured their own endpoints.

---

## Database schema

The full schema lives in `api/app/models/`. Here are the important tables:

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | int | Primary key |
| `email` | string | Unique |
| `username` | string | Unique |
| `hashed_password` | string | bcrypt; passwords longer than 72 bytes are SHA-256-preprocessed first |
| `is_active` | bool | Soft-disable flag |
| `created_at` | timestamp | |

### `entries`

| Column | Type | Notes |
|---|---|---|
| `id` | int | Primary key |
| `user_id` | int | FK to `users` |
| `title` | string | Optional |
| `content` | text | The actual journal text |
| `tags` | JSON array | |
| `mood_user` | int 1-5 | Set by the user |
| `mood_inferred` | int 1-5 | Set by the AI if `mood_user` is null |
| `is_deleted` | bool | Soft-delete flag |
| `created_at`, `updated_at` | timestamps | |

### `entry_embeddings`

| Column | Type | Notes |
|---|---|---|
| `id` | int | Primary key |
| `entry_id` | int | FK to `entries` |
| `embedding` | vector(1024) | The pgvector column |
| `is_active` | bool | False after a soft-forget |

### `settings`

Per-user preferences: search half-life, privacy mode, and the LLM endpoint config (generation URL/token/model + embedding URL/token/model).

### `insights`

Stored AI insights with `summary`, `themes` (JSON), `actions` (JSON), and a `period_start`/`period_end` window.

### `attachments`

File attachments belonging to entries.

### `prompt_interactions`

Records when a user accepts/dismisses a generated prompt — used to improve future suggestions.

---

## Key data flows

### Creating an entry

```
1. Browser → POST /entries with title/content/tags/mood
2. API saves the entry row
3. API enqueues two Celery jobs:
     - embedding_job
     - mood_job (only if mood_user is null)
4. API invalidates the reflection cache key for this user
5. API returns 201 with the new entry
6. (Background) worker pops embedding_job:
     - Calls the user's embedding endpoint
     - Stores the 1024-dim vector in entry_embeddings
7. (Background) worker pops mood_job:
     - Calls the LLM with a mood prompt
     - Updates entry.mood_inferred
```

The user sees the entry instantly. The embedding and mood typically appear within a couple of seconds.

### Semantic search

```
1. Browser → POST /search/semantic with query, k, optional filters
2. API embeds the query via the user's embedding service
3. SQL: pgvector cosine_distance(query_embedding, entry_embedding)
4. Score = similarity * decay
   where decay = 1 / (1 + age_days / half_life_days)
5. Order by score desc, return top k
```

Filters (date range, tags) are applied as SQL WHERE clauses before the similarity sort.

### Reflections (HTTP polling pattern)

Reflections take a few seconds to generate, so we don't make the user wait. The flow:

```
1. Browser → GET /reflections
2. API checks Redis for a cached reflection
   - If present and fresh: return it with status="complete"
   - If absent: enqueue a reflection_job, return status="generating"
3. Browser polls GET /reflections every couple of seconds
4. Worker finishes the job, writes the reflection into Redis
5. Next poll returns status="complete" with the text
```

The cache is invalidated whenever the user creates, updates, or deletes an entry, so reflections stay fresh.

### Chat (single global WebSocket)

```
1. Browser → GET /auth/ws-ticket (cookie-authenticated)
   ← Returns a one-time ticket (60s TTL)
2. Browser opens WS /chat/ws/chat?ticket=<ticket>
   (optional &entry_id=N to anchor the chat to one specific entry)
3. Server validates and consumes the ticket
4. Server sends a "context" message with the current reflection
   (and, if entry-pinned, the entry contents)
5. For each user message:
   - Server fetches the top-3 semantically similar entries (when in "all" scope)
   - Builds a system prompt with reflection + related entries
   - Streams the LLM response token-by-token as {"type":"token", "content":"..."} messages
   - Sends {"type":"complete"} when done
6. The connection holds the last 10 messages for follow-up context
```

There is one important subtlety: WebSocket handlers use **short-lived database sessions per operation**, not one session per connection. A long-held session would tie up a connection from the pool for the entire chat, exhausting it under any concurrency.

### Forgetting an entry

There are two modes, controlled by `settings.privacy_hard_delete` per user:

**Soft delete (default):**
- `entry.is_deleted = True`
- `entry_embeddings.is_active = False`
- `entry_embeddings.embedding` is overwritten with `[0.0] * 1024`
- The entry is hidden from search and the UI but remains recoverable in the DB

**Hard delete:**
- The entry row is deleted
- The embedding row is deleted
- Any attachment files are removed from disk
- Nothing is recoverable

---

## Authentication

EchoVault uses JWT tokens. The flow:

1. `POST /auth/login` with email + password.
2. The API verifies the bcrypt hash, then returns `{ access_token, token_type }` and sets a cookie.
3. The browser stores the token in **two** places:
   - `localStorage`, so the axios interceptor in `lib/api.ts` can attach it as a `Bearer` header on every API call.
   - A cookie, so the Next.js middleware (`app/middleware.ts`) can gate routes server-side.
4. Both are cleared on logout.

WebSocket connections cannot send custom headers from the browser, so they use a different mechanism:

1. `GET /auth/ws-ticket` (cookie-authenticated) returns a short, single-use ticket.
2. The browser includes that ticket as `?ticket=...` when opening the WebSocket.
3. The server consumes the ticket on connection and never reads it again.

This avoids putting long-lived JWTs in server logs (where query strings end up).

---

## Rate limiting and safety

- **Auth endpoints** are rate-limited via SlowAPI middleware.
- **Chat WebSocket** has per-connection limits: max 2000 chars per message, max 10 messages per minute (sliding window).
- **Pinned-entry chat** caps the entry content sent to the LLM at 4000 chars to keep token budgets predictable.

---

## Privacy guarantees

1. **Local LLM by default.** With Ollama in Docker, no journal text leaves your machine.
2. **No telemetry.** The app does not call out to any analytics or error-reporting service.
3. **Soft delete zeros out the vector.** Even though the row stays in the DB, the embedding is replaced with zeros so it cannot resurface in search.
4. **Hard delete is real delete.** Row removed, file removed, no archive.
5. **Export.** `GET /export/entries` returns your entries as JSONL including embeddings — you can leave whenever you want.

---

## Why these technical choices?

Each major piece of the stack solves a specific problem.

### Why Docker?

EchoVault has six moving parts (web, api, worker, db, redis, ollama). Without Docker, you would install Postgres, Redis, Python, Node, and Ollama on your host machine and pray nothing conflicts with another project. Docker gives each service its own sealed environment and lets one command (`docker compose up`) start them all in the right order.

**Alternatives considered:** Direct install (too painful), Vagrant (heavyweight), Nix (steep learning curve).

### Why FastAPI?

FastAPI is a modern Python web framework that is fast, async-first, and generates interactive OpenAPI docs for free. Most of the LLM ecosystem is Python-first, so a Python backend was natural.

**Alternatives:** Django (too monolithic for an API-only service), Flask (no async, no auto-docs), Node/Express (would have meant duplicating the LLM library code that already exists in Python).

### Why Next.js?

Next.js is the de facto framework for production React apps. It gives you routing, SSR, image optimization, and a clean deployment story to Vercel. The App Router (introduced in 13, mature in 16) makes layouts and middleware easy.

**Alternatives:** Plain React + Vite (more wiring, no SSR), Remix (smaller community), SvelteKit (would have meant rewriting with a different framework).

### Why PostgreSQL with pgvector?

We need two kinds of storage: relational (users, entries, settings) and vector (embeddings for semantic search). pgvector lets one database handle both. One backup, one connection pool, one set of credentials, transactional consistency between an entry and its embedding.

**Alternatives:** Postgres + a separate vector DB like Pinecone or Weaviate (operational complexity, network latency between two systems, no transactions across them), SQLite (no vector support), MongoDB (weaker relational story).

### Why Redis?

Redis is the most common Celery broker, and it doubles as a fast in-memory cache for reflections. Free 80% of the way and well understood.

**Alternatives:** RabbitMQ as broker (more setup, more features we don't need), in-memory queues (lost on restart), database-backed queues (slower).

### Why Celery?

Generating an embedding takes 1-2 seconds. Generating a reflection takes 5-30 seconds. If the API blocked on these, every entry creation would feel sluggish. Celery moves the slow work off the request path so the UI stays responsive.

**Alternatives:** asyncio background tasks (lost on API restart, harder to scale workers separately), `arq` or `dramatiq` (smaller ecosystems), no background work (terrible UX).

### Why Ollama?

The whole privacy story falls apart if we have to send your journal entries to OpenAI for every reflection. Ollama runs LLMs on your machine and exposes an HTTP API that's compatible with the OpenAI format. That means we can default to local but let advanced users swap in any cloud provider.

**Alternatives:** llama.cpp directly (no HTTP API out of the box), LM Studio (GUI, less scriptable), cloud-only (privacy-first goal abandoned).

---

## Scaling notes

The default config is sized for a single user on a laptop. If you wanted to scale this up:

- **Database:** vector indexes (HNSW or IVFFlat) help once you have tens of thousands of entries. See `api/SEARCH_OPTIMIZATION_INDEXES.sql`.
- **Worker:** the worker is started with `--concurrency=1` to minimize Redis ops for single-user installs. Bump it for multi-user.
- **API:** for production, swap uvicorn for gunicorn with uvicorn workers (`gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker`).
- **Ollama:** the bottleneck for any real workload. Run on a GPU box, or switch to a hosted OpenAI-compatible API.

---

## Where to go next

- [SETUP.md](../SETUP.md) — get it running locally
- [docs/FEATURES.md](FEATURES.md) — what each feature does, end-to-end
- [docs/API.md](API.md) — endpoint-by-endpoint reference
- [docs/ENV_CONFIG.md](ENV_CONFIG.md) — every env var, what it does
- [docs/architecture/async-celery-pattern.md](architecture/async-celery-pattern.md) — design note on async/sync at the Celery boundary
- [docs/WEBSOCKET_AUTH_GUIDE.md](WEBSOCKET_AUTH_GUIDE.md) — how the chat WebSocket is authenticated
